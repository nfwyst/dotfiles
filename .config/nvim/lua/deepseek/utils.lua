local config = require("deepseek.config")
local typing = require("core.typing")

local M = {}

-- TODO: use
function M.get_selected_text()
  local start_row, start_col = vim.fn.getpos("'<")[2], vim.fn.getpos("'<")[3]
  local end_row, end_col = vim.fn.getpos("'>")[2], vim.fn.getpos("'>")[3]
  local lines = vim.fn.getline(start_row, end_row)
  if #lines == 0 then
    return ""
  end
  lines[1] = lines[1]:sub(start_col)
  lines[#lines] = lines[#lines]:sub(1, end_col - 1)
  return table.concat(lines, "\n")
end

function M.reset()
  M.result_buffer = nil
  M.float_win = nil
  M.result_string = ""
  M.context = nil
  M.context_buffer = nil
end

local function get_window_options()
  local cursor = vim.api.nvim_win_get_cursor(0)
  local new_win_width = vim.api.nvim_win_get_width(0)
  local win_height = vim.api.nvim_win_get_height(0)

  local middle_row = win_height / 2

  local new_win_height = math.floor(win_height / 2)
  local new_win_row
  if cursor[1] <= middle_row then
    new_win_row = 5
  else
    new_win_row = -5 - new_win_height
  end

  return {
    relative = "cursor",
    width = new_win_width,
    height = new_win_height,
    row = new_win_row,
    col = 0,
    style = "minimal",
    border = "rounded",
  }
end

local function setup_split()
  M.result_buffer = vim.fn.bufnr("%")
  M.float_win = vim.fn.win_getid()
  vim.api.nvim_set_option_value(
    "filetype",
    "markdown",
    { buf = M.result_buffer }
  )
  vim.api.nvim_set_option_value("buftype", "nofile", { buf = M.result_buffer })
  vim.api.nvim_set_option_value("wrap", true, { win = M.float_win })
  vim.api.nvim_set_option_value("linebreak", true, { win = M.float_win })
end

function M.create_window()
  if config.display_mode == "float" then
    if M.result_buffer then
      vim.api.nvim_buf_delete(M.result_buffer, { force = true })
    end
    local win_opts =
      vim.tbl_deep_extend("force", get_window_options(), config.win_config)
    M.result_buffer = vim.api.nvim_create_buf(false, true)
    vim.api.nvim_set_option_value(
      "filetype",
      "markdown",
      { buf = M.result_buffer }
    )

    M.float_win = vim.api.nvim_open_win(M.result_buffer, true, win_opts)
  elseif config.display_mode == "horizontal-split" then
    vim.cmd("split deepseek")
    setup_split()
  else
    vim.cmd("vnew deepseek")
    setup_split()
  end
  -- vim.keymap.set("n", M.quit_map, "<cmd>quit<cr>", { buffer = M.result_buffer })
  -- vim.keymap.set("n", M.retry_map, function()
  --   vim.api.nvim_win_close(0, true)
  --   M.run_command(cmd, opts)
  -- end, { buffer = M.result_buffer })
end

function M.process_response(str, _)
  if str == nil or string.len(str) == 0 then
    return
  end

  if
    M.result_buffer == nil
    or M.float_win == nil
    or not vim.api.nvim_win_is_valid(M.float_win)
  then
    M.create_window()
  end

  M.result_string = M.result_string .. str
  local speed = 0.05 -- 0.05 seconds per character
  typing.start_typing({ str }, M.result_buffer, speed)
end

return M
