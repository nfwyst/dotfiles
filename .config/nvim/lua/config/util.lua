local M = {}

-- Root directory detection
function M.root()
  return vim.fs.root(0, { ".git", "lua" }) or vim.uv.cwd()
end

function M.git_root()
  return vim.fs.root(0, { ".git" }) or vim.uv.cwd()
end

-- Icons
M.icons = {
  diagnostics = {
    Error = " ",
    Warn = " ",
    Info = " ",
    Hint = "󰌶 ",
  },
  git = {
    added = " ",
    modified = " ",
    removed = " ",
  },
}

-- Utility functions
function M.has_eslint_config(package_json_path)
  local _, content = pcall(vim.fn.readfile, package_json_path)
  if not content then
    return false
  end
  local package_json = table.concat(content, "\n")
  local _, parsed = pcall(vim.fn.json_decode, package_json)
  if not parsed then
    return false
  end
  return parsed.eslintConfig ~= nil
end

function M.get_file_path(filenames, opts)
  local bufnr = vim.api.nvim_get_current_buf()
  local stop_home = vim.fn.expand("~")
  local buflisted = vim.bo[bufnr].buflisted
  local start_path = opts.start_path
  if not start_path and buflisted then
    start_path = vim.api.nvim_buf_get_name(bufnr)
  end
  local target_path = vim.fs.find(filenames, {
    upward = true,
    path = start_path,
    stop = stop_home,
    limit = 1,
  })[1]
  if opts.for_eslint and target_path and target_path:match("package%.json$") then
    local has_eslint_config = M.has_eslint_config(target_path)
    local parent_dir = vim.fs.dirname(vim.fs.dirname(target_path))
    if not has_eslint_config and parent_dir ~= stop_home then
      return M.get_file_path(filenames, vim.tbl_deep_extend("force", opts, { start_path = parent_dir }))
    end
  end
  if not target_path then
    return target_path
  end
  if opts.ensure_package then
    local dirname = vim.fs.dirname(target_path)
    local parent_dir = vim.fs.dirname(dirname)
    if vim.fn.filereadable(dirname .. "/package.json") == 0 and parent_dir ~= stop_home then
      return M.get_file_path(filenames, vim.tbl_deep_extend("force", opts, { start_path = parent_dir }))
    end
  end
  return target_path
end

function M.format_snippet_json(args)
  local start_line = args.line1
  local end_line = args.line2
  local bufnr = vim.api.nvim_get_current_buf()
  local lines = vim.api.nvim_buf_get_lines(bufnr, start_line - 1, end_line, false)
  local min_start = math.huge
  for _, line in ipairs(lines) do
    local first_non_blank = line:find("%S")
    if first_non_blank and first_non_blank < min_start then
      min_start = first_non_blank
    end
  end
  for i, line in ipairs(lines) do
    line = line:gsub('"', "'")
    local quoted_line = line:sub(1, min_start - 1) .. '"' .. line:sub(min_start)
    quoted_line = quoted_line .. '"'
    if i < #lines then
      quoted_line = quoted_line .. ","
    end
    lines[i] = quoted_line
  end
  vim.api.nvim_buf_set_lines(bufnr, start_line - 1, end_line, false, lines)
end

function M.set_hl(hl, delay)
  if not delay then
    return vim.cmd.hi(hl)
  end
  vim.schedule(function()
    vim.cmd.hi(hl)
  end)
end


--- Load JSON schemas from SchemaStore.nvim (safe, returns {} on failure).
--- @param fmt "json"|"yaml" schema format
--- @return table schemas
function M.schemastore(fmt)
  local ok, store = pcall(require, "schemastore")
  if ok and store[fmt] then
    return store[fmt].schemas()
  end
  return {}
end

--- Extract foreground color from a highlight group as "#rrggbb".
--- Returns nil if the group has no fg.
--- @param group string highlight group name
--- @return string|nil hex
function M.hl_fg(group)
  local hl = vim.api.nvim_get_hl(0, { name = group })
  if hl.fg then
    return string.format("#%06x", hl.fg)
  end
  return nil
end

--- Resolve prettierrc config path based on current buffer's shiftwidth.
--- @return string absolute path to prettierrc config
function M.prettierrc_config()
  local name = ".prettierrc.json"
  if vim.api.nvim_get_option_value("shiftwidth", { buf = vim.api.nvim_get_current_buf() }) == 4 then
    name = ".prettierrc_tab.json"
  end
  return vim.fn.expand("~") .. "/.config/" .. name
end

--- Check if autoformat is enabled for a buffer.
--- @param bufnr number buffer number
--- @return boolean
function M.autoformat_enabled(bufnr)
  if vim.b[bufnr].autoformat == false then return false end
  if vim.b[bufnr].autoformat == nil and not vim.g.autoformat then return false end
  return true
end

return M
