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

local function set_topline(new_topline)
  local view = vim.fn.winsaveview()
  view.topline = new_topline
  vim.fn.winrestview(view)
end

local function get_row_col(win)
  local pos = vim.api.nvim_win_get_cursor(win)
  return pos[1], pos[2]
end

local function get_new_topline(win, row)
  local winheight = vim.fn.winheight(win)
  local scroll_offset = math.floor(winheight / 3) + 6
  return math.max(1, row - scroll_offset)
end

function M.center_buf(buf, animation, duration)
  if not vim.api.nvim_buf_is_valid(buf) then
    return
  end

  local buflisted = vim.api.nvim_get_option_value("buflisted", { buf = buf })
  if not buflisted then
    return
  end

  local readable = vim.fn.filereadable(vim.api.nvim_buf_get_name(buf))
  if not readable then
    return
  end

  local win = vim.fn.bufwinid(buf)
  if not vim.api.nvim_win_is_valid(win) then
    return
  end

  local row, col = get_row_col(win)
  local new_topline = get_new_topline(win, row)
  local is_insert_mode = vim.api.nvim_get_mode().mode:match("^i")
  if not animation or duration == 0 then
    if row == vim.b.last_line then
      return
    end
    vim.b.last_line = row
    if is_insert_mode then
      return vim.api.nvim_win_set_cursor(win, { row, col })
    end
    return set_topline(new_topline)
  end

  vim.schedule(function()
    if not vim.api.nvim_win_is_valid(win) then
      return
    end
    row, col = get_row_col(win)
    if is_insert_mode then
      local current_line = vim.fn.line(".")
      if current_line == row then
        return
      end
      return Snacks.animate(current_line, row, function(val, ctx)
        if ctx.done then
          vim.api.nvim_win_set_cursor(win, { row, col })
        else
          vim.api.nvim_win_set_cursor(win, { math.floor(val), col })
        end
      end, { duration = duration or 10 })
    end
    local current_topline = vim.fn.line("w0")
    new_topline = get_new_topline(win, row)
    if current_topline == new_topline then
      return
    end
    Snacks.animate(current_topline, new_topline, function(val, ctx)
      if ctx.done then
        set_topline(new_topline)
      else
        set_topline(math.floor(val))
      end
    end, { duration = duration or 10 })
  end)
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
