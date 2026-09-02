-- Shared TypeScript/LSP utilities
-- Used by tsc.lua, vtsls.lua, lsp.lua, and keymaps.lua
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
}

-- Cache expensive lookups
local _vue_cache = {}
local _cmd_cache = {}
local _data_dir = vim.fn.stdpath("data")

--- Scan a directory (non-recursively) for .vue files.
--- @param dir string absolute path
--- @return boolean
local function dir_has_vue(dir)
  if not vim.uv.fs_stat(dir) then
    return false
  end
  local handle = vim.uv.fs_scandir(dir)
  if not handle then
    return false
  end
  local subdirs_scanned = 0
  while true do
    local name, typ = vim.uv.fs_scandir_next(handle)
    if not name then break end
    if name:match("%.vue$") then return true end
    -- Scan one level of subdirectories (e.g., src/components/*.vue)
    -- Limit to 50 subdirs to avoid slowdowns in large monorepos
    if typ == "directory" and name ~= "node_modules" and name ~= ".git" then
      subdirs_scanned = subdirs_scanned + 1
      if subdirs_scanned > 50 then break end
      local sub = dir .. "/" .. name
      local sub_handle = vim.uv.fs_scandir(sub)
      if sub_handle then
        while true do
          local sub_name = vim.uv.fs_scandir_next(sub_handle)
          if not sub_name then break end
          if sub_name:match("%.vue$") then return true end
        end
      end
    end
  end
  return false
end

--- Check if a given project root is a Vue project.
--- Uses absolute paths — never changes CWD. Results are cached per root.
--- @param root string absolute path to project root
--- @return boolean
function M.is_vue_project(root)
  if not root then
    return false
  end
  if _vue_cache[root] ~= nil then
    return _vue_cache[root]
  end

  local result = false

  -- Fast check: vue/nuxt config files
  for _, name in ipairs(vue_config_markers) do
    if vim.uv.fs_stat(root .. "/" .. name) then
      result = true
      _vue_cache[root] = result
      return result
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
      if data and (data:find('"vue"') or data:find('"nuxt"') or data:find('"@vue/')) then
        result = true
        _vue_cache[root] = result
        return result
      end
    end
  end
  -- Fallback: check if any .vue files exist under src/ (handles monorepos
  -- where vue dependency is hoisted to a parent package.json).
  -- Scans src/ and one level of its subdirectories (e.g., src/components/).
  if dir_has_vue(root .. "/src") then
    result = true
  end

  _vue_cache[root] = result
  return result
end

--- Check if a given project root is a Deno project.
--- Uses vim.fs.root() for upward traversal — correctly detects Deno even when
--- deno.json is in a parent directory (e.g., monorepo root).
--- @param root string absolute path to project root
--- @return boolean
function M.is_deno_project(root)
  if not root then
    return false
  end
  -- Use vim.fs.root() to search upward for deno markers
  local deno_root = vim.fs.root(root, deno_markers)
  if not deno_root then
    return false
  end
  -- If npm/yarn/pnpm/bun lock files exist at the deno marker location,
  -- it's a hybrid project — NOT a pure Deno project
  local npm_locks = { "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "bun.lock" }
  for _, name in ipairs(npm_locks) do
    if vim.uv.fs_stat(deno_root .. "/" .. name) then
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
--- "baseUrl": "." is safe because it equals the tsconfig location — tsc
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

--- Find the most precise project root for TS/JS LSP servers.
--- In monorepo setups, sub-projects may have their own tsconfig.json without
--- a package.json. This two-phase lookup ensures we anchor to the sub-project
--- rather than the monorepo root:
---   Phase 1: find the nearest tsconfig.json / jsconfig.json (precise boundary)
---   Phase 2: fallback to package.json / .git (broad boundary)
--- @param bufnr number buffer number
--- @return string|nil root absolute path to the project root
function M.find_project_root(bufnr)
  -- Phase 1: precise boundary — tsconfig/jsconfig defines a TS project scope
  local precise = vim.fs.root(bufnr, { "tsconfig.json", "jsconfig.json" })
  if precise then
    return precise
  end
  -- Phase 2: broad boundary — package.json or repo root
  return vim.fs.root(bufnr, { "package.json", ".git" })
end

-- ===================================================================
-- File References (gR) — find every module that imports the current file
-- ===================================================================
-- Two-tier strategy, most reliable first:
--   Tier 1 (semantic): if an attached LSP advertises a file-references
--     command (vtsls: typescript.findAllFileReferences, vue_ls:
--     vue.findAllFileReferences), execute it. Results come straight from the
--     TS project graph, so path aliases, barrel re-exports and dynamic
--     imports are all counted exactly. tsc (TypeScript 7) does NOT
--     advertise this yet, hence the runtime capability probe rather than a
--     hardcoded server name.
--   Tier 2 (fallback): resolution-verified ripgrep. rg gives broad recall
--     (any string literal mentioning the basename); we then RESOLVE each
--     matched import specifier (relative + tsconfig paths/baseUrl aliases)
--     and keep only the ones that resolve to THIS file. This removes the
--     false positives (other files sharing the basename) and false negatives
--     (alias imports) of the old pure-basename regex.

-- LSP commands that return file-level references as Location[].
local FILE_REF_COMMANDS = {
  ["typescript.findAllFileReferences"] = true,
  ["vue.findAllFileReferences"] = true,
}

-- Module resolution extension order (mirrors tsc moduleResolution).
local RESOLVE_EXTS =
  { "", ".ts", ".tsx", ".d.ts", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".vue", ".svelte", ".astro", ".mdx", ".json" }
local INDEX_FILES =
  { "/index.ts", "/index.tsx", "/index.js", "/index.jsx", "/index.mjs", "/index.cjs", "/index.vue" }

--- Resolve a base path (no extension) to a real file, trying extensions then
--- /index.* — matching how a bundler/tsc would resolve a module specifier.
--- @param base string absolute, normalized path without extension
--- @return string|nil normalized absolute file path
local function resolve_with_exts(base)
  for _, ext in ipairs(RESOLVE_EXTS) do
    local p = base .. ext
    local st = vim.uv.fs_stat(p)
    if st and st.type == "file" then
      return vim.fs.normalize(p)
    end
  end
  for _, idx in ipairs(INDEX_FILES) do
    local p = base .. idx
    local st = vim.uv.fs_stat(p)
    if st and st.type == "file" then
      return vim.fs.normalize(p)
    end
  end
  return nil
end

--- Load tsconfig/jsconfig alias config (baseUrl + paths) for a project root.
--- paths targets are relative to baseUrl, per the TS spec. extends chains are
--- not followed here (rare for paths); baseUrl defaults to root.
--- @param root string
--- @return { base: string, paths: table<string, string[]> }
function M._load_alias_config(root)
  for _, name in ipairs({ "tsconfig.json", "jsconfig.json" }) do
    local data = read_file(root .. "/" .. name)
    if data then
      local cfg = safe_json_decode(data)
      local co = cfg and cfg.compilerOptions
      if co and (co.baseUrl or co.paths) then
        local base = co.baseUrl and vim.fs.normalize(root .. "/" .. co.baseUrl) or root
        return { base = base, paths = co.paths or {} }
      end
    end
  end
  return { base = root, paths = {} }
end

--- Resolve a single import specifier (as written in source) to an absolute
--- file path, given the directory of the importing file and alias config.
--- Handles: relative (./ ../), tsconfig path aliases (prefix/* and exact),
--- and bare baseUrl-relative specifiers. Returns nil for node_modules / unresolved.
--- @param spec string the quoted module specifier text
--- @param from_dir string absolute dir of the importing file
--- @param alias { base: string, paths: table<string, string[]> }
--- @return string|nil
local function resolve_specifier(spec, from_dir, alias)
  -- Relative import
  if spec:sub(1, 1) == "." then
    return resolve_with_exts(vim.fs.normalize(from_dir .. "/" .. spec))
  end
  -- tsconfig "paths" aliases
  for pat, targets in pairs(alias.paths) do
    if type(targets) == "table" then
      if pat:sub(-1) == "*" then
        local prefix = pat:sub(1, #pat - 1)
        if spec:sub(1, #prefix) == prefix then
          local rest = spec:sub(#prefix + 1)
          for _, t in ipairs(targets) do
            local tprefix = t:sub(-1) == "*" and t:sub(1, #t - 1) or t
            local cand = resolve_with_exts(vim.fs.normalize(alias.base .. "/" .. tprefix .. rest))
            if cand then
              return cand
            end
          end
        end
      elseif pat == spec then
        for _, t in ipairs(targets) do
          local cand = resolve_with_exts(vim.fs.normalize(alias.base .. "/" .. t))
          if cand then
            return cand
          end
        end
      end
    end
  end
  -- baseUrl-relative bare specifier (e.g. "components/Button" with baseUrl=src)
  return resolve_with_exts(vim.fs.normalize(alias.base .. "/" .. spec))
end

--- Open a list of {filename,lnum,col,text} items as a Trouble qflist,
--- falling back to the native quickfix window if Trouble is unavailable.
--- @param items table[]
--- @param title string
local function show_items(items, title)
  if #items == 0 then
    vim.notify("No file references found", vim.log.levels.INFO)
    return
  end
  vim.fn.setqflist({}, " ", { title = title, items = items })
  local ok = pcall(vim.cmd, "Trouble qflist open")
  if not ok then
    vim.cmd.copen()
  end
end

--- Tier 2: resolution-verified ripgrep fallback.
--- @param current_file string absolute path of the buffer
local function grep_file_references(current_file)
  local root = vim.fs.root(0, M.root_markers) or vim.fn.getcwd()
  local target = vim.fs.normalize(vim.fn.fnamemodify(current_file, ":p"))
  local stem = vim.fn.fnamemodify(current_file, ":t:r")
  -- For index files the specifier usually names the parent dir, not "index".
  local hay = stem == "index" and vim.fn.fnamemodify(current_file, ":h:t") or stem
  local alias = M._load_alias_config(root)

  -- Broad recall: any string literal containing the basename. Precision comes
  -- from the resolve-verify pass below, so we keep the regex permissive.
  local escaped = hay:gsub("([%.%+%*%?%[%]%^%$%(%)%{%}%|\\])", "\\%1")
  local pattern = "['\"][^'\"]*" .. escaped .. "[^'\"]*['\"]"

  local cmd = {
    "rg", "--vimgrep", "--no-heading", "--color=never",
    "--type-add", "web:*.{ts,tsx,js,jsx,mjs,cjs,mts,cts,vue,svelte,astro,mdx}",
    "-tweb", "-e", pattern, root,
  }

  vim.system(cmd, { text = true }, function(obj)
    vim.schedule(function()
      if not obj.stdout or obj.stdout == "" then
        vim.notify("No file references found", vim.log.levels.INFO)
        return
      end
      local items, seen = {}, {}
      for line in obj.stdout:gmatch("[^\r\n]+") do
        local file, row, col, text = line:match("^(.-):(%d+):(%d+):(.*)$")
        if file then
          local abs = vim.fs.normalize(vim.fn.fnamemodify(file, ":p"))
          local from_dir = vim.fn.fnamemodify(abs, ":h")
          -- A line may hold several quoted specifiers; verify each.
          for spec in text:gmatch("['\"]([^'\"]+)['\"]") do
            if resolve_specifier(spec, from_dir, alias) == target and abs ~= target then
              local key = abs .. ":" .. row
              if not seen[key] then
                seen[key] = true
                table.insert(items, {
                  filename = file,
                  lnum = tonumber(row),
                  col = tonumber(col) or 1,
                  text = vim.trim(text or ""),
                })
              end
              break
            end
          end
        end
      end
      show_items(items, "File References: " .. vim.fn.fnamemodify(current_file, ":~:."))
    end)
  end)
end

--- Find all files that import/require the current file (File References).
--- Tier 1 semantic LSP command when supported, else resolution-verified rg.
function M.find_file_references()
  local bufnr = 0
  local current_file = vim.api.nvim_buf_get_name(bufnr)
  if current_file == "" then
    vim.notify("No file in current buffer", vim.log.levels.WARN)
    return
  end

  -- Tier 1: semantic LSP file-references (ground truth from the TS graph).
  for _, client in ipairs(vim.lsp.get_clients({ bufnr = bufnr })) do
    local provider = client.server_capabilities.executeCommandProvider
    local cmds = provider and provider.commands or {}
    for _, cmd in ipairs(cmds) do
      if FILE_REF_COMMANDS[cmd] then
        client:request("workspace/executeCommand", {
          command = cmd,
          arguments = { vim.uri_from_bufnr(bufnr) },
        }, function(err, result)
          vim.schedule(function()
            if err then
              vim.notify("LSP file references failed, using ripgrep: " .. tostring(err.message or err), vim.log.levels.WARN)
              return grep_file_references(current_file)
            end
            local locs = result or {}
            if not vim.islist(locs) or #locs == 0 then
              vim.notify("No file references found", vim.log.levels.INFO)
              return
            end
            local items = vim.lsp.util.locations_to_items(locs, client.offset_encoding)
            show_items(items, "File References: " .. vim.fn.fnamemodify(current_file, ":~:."))
          end)
        end, bufnr)
        return
      end
    end
  end

  -- Tier 2: resolution-verified ripgrep fallback (tsc / no LSP).
  grep_file_references(current_file)
end


-- ===================================================================
-- Mason / bun helpers (shared by multiple LSP configs)
-- ===================================================================

--- Build a bun-optimized cmd for a Mason-installed JS language server.
--- Mason's bin wrappers are #!/usr/bin/env node scripts; bun resolves them
--- as package script names, not file paths. This function resolves the actual
--- JS entry point and runs it directly via bun. Results are cached.
--- @param mason_pkg string Mason package name, also used as fallback binary
--- @param js_entry string relative path from mason package dir to JS entry
--- @param extra_args? string[] additional args after the JS entry (e.g., {"--stdio"})
--- @return string[] cmd
function M.bun_cmd(mason_pkg, js_entry, extra_args)
  local cache_key = mason_pkg .. "|" .. js_entry
  local args = extra_args or {}
  -- Fallback to node when bun is not available on PATH
  local runner = vim.fn.executable("bun") == 1 and "bun" or "node"
  if _cmd_cache[cache_key] == nil then
    local js = _data_dir .. "/mason/packages/" .. mason_pkg .. "/" .. js_entry
    _cmd_cache[cache_key] = vim.uv.fs_stat(js) and js or false
  end
  if _cmd_cache[cache_key] then
    if runner == "bun" then
      return vim.list_extend({ "bun", "run", "--bun", _cmd_cache[cache_key] }, args)
    else
      return vim.list_extend({ "node", _cmd_cache[cache_key] }, args)
    end
  end
  return vim.list_extend({ mason_pkg }, args)
end

--- Resolve TypeScript SDK path from Mason's vtsls bundle.
--- Used by both vtsls.lua and vue_ls.lua.
--- @return string|nil tsdk absolute path or nil if not found
function M.mason_tsdk()
  local lib = "/mason/packages/vtsls/node_modules/@vtsls/language-server/node_modules/typescript/lib"
  local p = _data_dir .. lib
  if vim.fn.isdirectory(p) == 1 then
    return p
  end
  return nil
end


-- ===================================================================
-- Shared TS server settings (tsc + vtsls)
-- ===================================================================
-- These capability/preference blocks are identical between tsc.lua and
-- vtsls.lua; centralize them here so drift between the two servers is
-- impossible by construction.
M.ts_common = {
  referencesCodeLens = {
    enabled = true,
    showOnAllFunctions = true,
  },
  implementationsCodeLens = {
    enabled = true,
    showOnInterfaceMethods = true,
    showOnAllClassMethods = true,
  },
  inlayHints = {
    enumMemberValues = { enabled = true },
    functionLikeReturnTypes = { enabled = true },
    parameterNames = {
      enabled = "literals",
      suppressWhenArgumentMatchesName = true,
    },
    parameterTypes = { enabled = true },
    propertyDeclarationTypes = { enabled = true },
    variableTypes = { enabled = false },
  },
}

return M
