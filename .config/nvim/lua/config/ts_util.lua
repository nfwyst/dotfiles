-- Shared TypeScript/LSP utilities
-- Used by tsgo.lua, vtsls.lua, lsp.lua, and keymaps.lua
local M = {}

local vue_config_markers = {
  "vue.config.js",
  "vue.config.ts",
  "nuxt.config.js",
  "nuxt.config.ts",
  "nuxt.config.mjs",
}

local deno_markers = {
  "deno.json",
  "deno.jsonc",
  "deno.lock",
}

--- Check if a given project root is a Vue project.
--- Uses absolute paths — never changes CWD.
--- @param root string absolute path to project root
--- @return boolean
function M.is_vue_project(root)
  if not root then
    return false
  end
  -- Fast check: vue/nuxt config files
  for _, name in ipairs(vue_config_markers) do
    if vim.uv.fs_stat(root .. "/" .. name) then
      return true
    end
  end
  -- Check package.json for vue/nuxt dependency
  local pkg_path = root .. "/package.json"
  local stat = vim.uv.fs_stat(pkg_path)
  if stat then
    local fd = vim.uv.fs_open(pkg_path, "r", 438)
    if fd then
      local data = vim.uv.fs_read(fd, stat.size, 0)
      vim.uv.fs_close(fd)
      if data and (data:find('"vue"') or data:find('"nuxt"')) then
        return true
      end
    end
  end
  return false
end

--- Check if a given project root is a Deno project.
--- Deno projects should not start tsgo or vtsls.
--- Logic: if deno markers are found closer to (or at the same level as) the
--- root than any npm/bun/yarn/pnpm lock file, treat it as Deno.
--- @param root string absolute path to project root
--- @return boolean
function M.is_deno_project(root)
  if not root then
    return false
  end
  local has_deno = false
  for _, name in ipairs(deno_markers) do
    if vim.uv.fs_stat(root .. "/" .. name) then
      has_deno = true
      break
    end
  end
  if not has_deno then
    return false
  end
  -- If npm/yarn/pnpm/bun lock files also exist at root, it's NOT a pure Deno project
  local npm_locks = { "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "bun.lock" }
  for _, name in ipairs(npm_locks) do
    if vim.uv.fs_stat(root .. "/" .. name) then
      return false
    end
  end
  return true
end

--- Read a file's content synchronously.
--- @param path string
--- @return string|nil
local function read_file(path)
  local stat = vim.uv.fs_stat(path)
  if not stat then
    return nil
  end
  local fd = vim.uv.fs_open(path, "r", 438)
  if not fd then
    return nil
  end
  local data = vim.uv.fs_read(fd, stat.size, 0)
  vim.uv.fs_close(fd)
  return data
end

--- Strip single-line (//) and block (/* */) comments from JSONC content,
--- then remove trailing commas for valid JSON parsing.
--- @param text string
--- @return string
local function strip_jsonc_comments(text)
  -- Remove single-line comments (// ...)
  text = text:gsub("//[^\r\n]*", "")
  -- Remove block comments (/* ... */)
  text = text:gsub("/%*.-%*/", "")
  -- Remove trailing commas before } or ]
  text = text:gsub(",%s*([}%]])", "%1")
  return text
end

--- Safely decode a JSONC (JSON with comments) string.
--- @param text string
--- @return table|nil
local function safe_json_decode(text)
  local clean = strip_jsonc_comments(text)
  local ok, result = pcall(vim.json.decode, clean)
  if ok and type(result) == "table" then
    return result
  end
  return nil
end

--- Analyze a tsconfig/jsconfig file and its extends chain for baseUrl.
--- Returns the effective baseUrl value (or nil if not set).
--- @param config_path string absolute path to the config file
--- @param depth number remaining recursion depth
--- @return string|nil baseUrl value if found
function M._find_baseurl_in_config(config_path, depth)
  if depth <= 0 then
    return nil
  end

  local data = read_file(config_path)
  if not data then
    return nil
  end

  local config = safe_json_decode(data)
  if not config then
    return nil
  end

  -- Check if this file directly sets baseUrl
  local compiler_opts = config.compilerOptions or {}
  if compiler_opts.baseUrl then
    return compiler_opts.baseUrl
  end

  -- Follow "extends" to parent config (supports string or array)
  local extends = config.extends
  if type(extends) == "string" then
    extends = { extends }
  end
  if type(extends) == "table" then
    local config_dir = vim.fn.fnamemodify(config_path, ":h")
    for _, ext in ipairs(extends) do
      if type(ext) == "string" then
        local parent_path
        if ext:sub(1, 1) == "." then
          parent_path = config_dir .. "/" .. ext
        else
          parent_path = config_dir .. "/node_modules/" .. ext
        end
        if not parent_path:match("%.json$") then
          parent_path = parent_path .. ".json"
        end
        parent_path = vim.fn.fnamemodify(parent_path, ":p")
        local base_url = M._find_baseurl_in_config(parent_path, depth - 1)
        if base_url then
          return base_url
        end
      end
    end
  end

  return nil
end

--- Check if a project needs vtsls fallback due to non-trivial baseUrl usage.
--- Returns true only when baseUrl is set to something other than "." or "./"
--- (meaning bare module specifiers and paths resolution depend on it).
--- "baseUrl": "." is safe because it equals the tsconfig location — tsgo
--- resolves paths relative to tsconfig by default, so the behavior is identical.
--- @param root string absolute path to project root
--- @return boolean
function M.needs_baseurl_fallback(root)
  if not root then
    return false
  end

  local config_names = { "tsconfig.json", "jsconfig.json" }
  for _, name in ipairs(config_names) do
    local base_url = M._find_baseurl_in_config(root .. "/" .. name, 3)
    if base_url and base_url ~= "." and base_url ~= "./" then
      return true
    end
  end
  return false
end

M.root_markers = { "tsconfig.json", "package.json", "jsconfig.json", ".git" }

--- Find all files that import/require the current file (File References).
--- Uses ripgrep for speed; works with any LSP or none at all.
--- Results are displayed via Snacks.picker.grep or quickfix as fallback.
function M.find_file_references()
  local current_file = vim.api.nvim_buf_get_name(0)
  if current_file == "" then
    vim.notify("No file in current buffer", vim.log.levels.WARN)
    return
  end

  local root = vim.fs.root(0, M.root_markers)
  if not root then
    root = vim.fn.getcwd()
  end

  local rel = current_file:sub(#root + 2) -- strip root + separator
  local stem = vim.fn.fnamemodify(current_file, ":t:r")
  local ext = vim.fn.fnamemodify(current_file, ":e")

  -- For index files, use parent dir name as the search target
  -- e.g., components/Button/index.ts → search for "Button"
  local search_name = stem
  if stem == "index" then
    search_name = vim.fn.fnamemodify(current_file, ":h:t")
  end

  -- Escape special regex chars
  local escaped = search_name:gsub("([%.%+%*%?%[%]%^%$%(%)%{%}%|\\])", "\\%1")

  -- Build ripgrep pattern:
  -- Matches import/export/require statements containing our file
  -- e.g., from './Button', from './Button.vue', require('./Button'), import('./Button')
  local pattern
  if stem == "index" then
    -- For index files: match "Button" or "Button/index" with optional extension
    pattern = "['\"][^'\"]*[/]"
      .. escaped
      .. "(?:/index)?(?:\\."
      .. ext
      .. ")?['\"]"
  else
    -- For normal files: match "Button" with optional extension
    pattern = "['\"][^'\"]*[/]"
      .. escaped
      .. "(?:\\."
      .. ext
      .. ")?['\"]"
  end

  -- Use Snacks.picker.grep if available (consistent with user's existing keymaps)
  local has_snacks, Snacks = pcall(require, "snacks")
  if has_snacks and Snacks.picker then
    Snacks.picker.grep({
      search = pattern,
      regex = true,
      dirs = { root },
    })
    return
  end

  -- Fallback: ripgrep → quickfix
  local cmd = {
    "rg", "--vimgrep", "--no-heading", "--color=never",
    "--type-add", "web:*.{ts,tsx,js,jsx,mjs,cjs,vue,svelte,mdx,astro}",
    "-tweb", "-e", pattern, root,
  }

  vim.system(cmd, { text = true }, function(obj)
    vim.schedule(function()
      if not obj.stdout or obj.stdout == "" then
        vim.notify("No file references found", vim.log.levels.INFO)
        return
      end
      local items = {}
      for line in obj.stdout:gmatch("[^\r\n]+") do
        local file, row, col, text = line:match("^(.-):(%d+):(%d+):(.*)$")
        if file then
          local abs = vim.fn.fnamemodify(file, ":p")
          if abs ~= current_file then
            table.insert(items, {
              filename = file, lnum = tonumber(row),
              col = tonumber(col) or 1, text = vim.trim(text or ""),
            })
          end
        end
      end
      if #items == 0 then
        vim.notify("No file references found", vim.log.levels.INFO)
        return
      end
      vim.fn.setqflist(items, "r")
      vim.fn.setqflist({}, "a", { title = "File References: " .. rel })
      vim.cmd.copen()
    end)
  end)
end

return M
