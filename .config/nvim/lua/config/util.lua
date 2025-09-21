local M = {}

function M.get_file_path(fienames, start_path)
  local bufnr = vim.api.nvim_get_current_buf()
  local buflisted = vim.bo[bufnr].buflisted
  if not start_path and buflisted then
    start_path = vim.api.nvim_buf_get_name(bufnr)
  end

  local path_wraper = vim.fs.find(fienames, {
    upward = true,
    path = start_path,
    stop = vim.fn.expand("~"),
    limit = 1,
  })

  return path_wraper[1]
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

return M
