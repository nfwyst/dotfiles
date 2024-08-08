local M = {}

local function is_same_buffer(buffer_id)
  return vim.api.nvim_get_current_buf() == buffer_id
end

-- 辅助函数：遍历字符串并执行回调函数
local function traverse_string_chars(str, callback)
  local byte_index = 1
  local char_index = 1

  while byte_index <= #str do
    local byte = str:byte(byte_index)
    local char_length

    if byte <= 127 then
      char_length = 1
    elseif byte <= 223 then
      char_length = 2
    elseif byte <= 239 then
      char_length = 3
    else
      char_length = 4
    end

    local char = str:sub(byte_index, byte_index + char_length - 1)
    local continue = callback(char, char_index, byte_index, char_length)

    if not continue then
      break
    end

    byte_index = byte_index + char_length
    char_index = char_index + 1
  end
end

-- 获取字符串长度
local function get_string_length(str)
  local length = 0

  traverse_string_chars(str, function(_, char_index)
    length = char_index
    return true
  end)

  return length
end

-- 通过索引获取字符
local function get_char_by_index_of_string(str, index)
  local result = nil

  traverse_string_chars(str, function(char, char_index)
    if char_index == index then
      result = char
      return false
    end
    return true
  end)

  return result
end

local prev_char = {}

-- 以给定的速度输入单个字符
local function type_string(str, buffer_id, speed, pos, on_type_next)
  if not prev_char[buffer_id] then
    prev_char[buffer_id] = nil
  end
  local current_row, current_col = unpack(pos)
  local function type_char(index)
    if index > get_string_length(str) then
      return on_type_next(current_row, current_col)
    end
    local char = get_char_by_index_of_string(str, index)
    local _prev_char = prev_char[buffer_id]
    prev_char[buffer_id] = char
    if char == "\n" then
      if _prev_char == "\n" then
        return vim.defer_fn(function()
          type_char(index + 1)
        end, 1000 * speed)
      end
      vim.api.nvim_buf_set_lines(
        buffer_id,
        current_row + 1,
        current_row + 1,
        false,
        { "" }
      )
    else
      vim.api.nvim_buf_set_text(
        buffer_id,
        current_row,
        current_col,
        current_row,
        current_col,
        { char }
      )
    end
    if is_same_buffer(buffer_id) then
      vim.api.nvim_win_set_cursor(0, { current_row + 1, current_col })
    end
    current_col = current_col + #char
    if char == "\n" then
      current_row = current_row + 1
      current_col = 0
    end
    vim.defer_fn(function()
      type_char(index + 1)
    end, 1000 * speed)
  end

  type_char(1)
end

-- 获取缓冲区的最后一行和最后一列
local function get_last_line_and_col(buffer_id)
  local lines = vim.api.nvim_buf_get_lines(buffer_id, 0, -1, false)
  if #lines == 0 then
    return 0, 0
  end
  local last_line = lines[#lines]
  return #lines - 1, #last_line - 1
end

local function get_start_position(buffer_id)
  local start_row, start_col
  if is_same_buffer(buffer_id) then
    -- 如果 buffer_id 是当前打开的 buffer, 则从当前光标所在的位置开始
    -- row: from 1, col: from 0
    start_row, start_col = unpack(vim.api.nvim_win_get_cursor(0))
    start_row = start_row - 1 -- 转换为零基索引
  else
    -- 如果 buffer_id 是后台 buffer, 则从 buffer 中最后一个字符开始
    start_row, start_col = get_last_line_and_col(buffer_id)
  end
  return start_row, start_col
end

M.typing_queue = {}

local function process_queue(buffer_id, row, col)
  if #M.typing_queue[buffer_id] <= 0 then
    M.typing_queue[buffer_id].running = false
    vim.api.nvim_set_option_value("modifiable", true, { buf = buffer_id })
    return
  end
  local task = table.remove(M.typing_queue[buffer_id], 1)
  local strings, speed, pause = task.strings, task.speed, task.pause
  local current_row = 0
  local current_col = 0
  if row ~= nil and col ~= nil then
    current_row = row
    current_col = col
  else
    current_row, current_col = get_start_position(buffer_id)
  end

  local function type_next(index)
    if index > #strings then
      return process_queue(buffer_id, current_row, current_col)
    end
    local str = strings[index]
    type_string(
      str,
      buffer_id,
      speed,
      { current_row, current_col },
      function(new_row, new_col)
        vim.defer_fn(function()
          current_row = new_row
          current_col = new_col
          type_next(index + 1)
        end, pause * 1000) -- 将暂停时间转换为毫秒
      end
    )
  end

  type_next(1)
end

-- 在指定缓冲区中以指定速度开始输入给定的字符串
function M.start_typing(strings, buffer_id, speed, pause)
  speed = speed or 0.01 -- 默认速度是每字符0.1秒
  pause = pause or 0 -- 默认字符串之间的暂停时间为0秒

  buffer_id = buffer_id or vim.api.nvim_get_current_buf()

  if not M.typing_queue[buffer_id] then
    M.typing_queue[buffer_id] = {
      running = false,
    }
  end

  table.insert(M.typing_queue[buffer_id], {
    strings = strings,
    speed = speed,
    pause = pause,
  })

  if M.typing_queue[buffer_id].running then
    return
  end

  M.typing_queue[buffer_id].running = true
  vim.api.nvim_set_option_value("modifiable", false, { buf = buffer_id })
  process_queue(buffer_id)
end

return M
