local M = {}

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

function M.get_file_path(fienames, opts)
  local bufnr = vim.api.nvim_get_current_buf()
  local stop_home = vim.fn.expand("~")
  local buflisted = vim.bo[bufnr].buflisted
  local start_path = opts.start_path
  if not start_path and buflisted then
    start_path = vim.api.nvim_buf_get_name(bufnr)
  end

  local target_path = vim.fs.find(fienames, {
    upward = true,
    path = start_path,
    stop = stop_home,
    limit = 1,
  })[1]

  -- ensure eslintConfig field in package.json file
  if opts.for_eslint and target_path and target_path:match("package%.json$") then
    local has_eslint_config = M.has_eslint_config(target_path)
    local parent_dir = vim.fs.dirname(vim.fs.dirname(target_path))
    if not has_eslint_config and parent_dir ~= stop_home then
      return M.get_file_path(fienames, vim.tbl_deep_extend(opts, { start_path = parent_dir }))
    end
  end

  if not target_path then
    return target_path
  end

  -- ensure package.json file exists in same directory
  if opts.ensure_package then
    local dirname = vim.fs.dirname(target_path)
    local parent_dir = vim.fs.dirname(dirname)
    if vim.fn.filereadable(dirname .. "/package.json") == 0 and parent_dir ~= stop_home then
      return M.get_file_path(fienames, vim.tbl_deep_extend(opts, { start_path = parent_dir }))
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

return M
