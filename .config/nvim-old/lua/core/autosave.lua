---@diagnostic disable: undefined-field
local uv = vim.uv
local timers = {}
local augroup = AUTOGROUP('AutoSave', { clear = true })

local DELAY_TIME = 1000

local function save_buffer(bufnr)
  RUN_IN_BUFFER(bufnr, function()
    PCALL(SAVE)
  end)
end

local function reset_buffer_timer_when_exists(bufnr)
  local timer = timers[bufnr]
  if not timer then
    return
  end
  timer:stop()
  timer:close()
  timers[bufnr] = nil
end

local function check_is_valid_buffer(bufnr)
  local opt = { buf = bufnr }
  local modifiable = GET_OPT('modifiable', opt)
  if not modifiable then
    return
  end
  local unsaved = GET_OPT('modified', opt)
  if not unsaved then
    return
  end
  local buffer_path = GET_BUFFER_PATH(bufnr)
  local is_file_in_fs = IS_FILE_IN_FS(buffer_path)
  if not is_file_in_fs then
    return
  end
  return true
end

local function get_save_wrapper(bufnr)
  return vim.schedule_wrap(function()
    save_buffer(bufnr)
    timers[bufnr] = nil
  end)
end

local function save_delay(event)
  local bufnr = event.buf
  local is_valid_buffer = check_is_valid_buffer(bufnr)
  if not is_valid_buffer then
    return
  end
  reset_buffer_timer_when_exists(bufnr)
  timers[bufnr] = uv.new_timer()
  timers[bufnr]:start(DELAY_TIME, 0, get_save_wrapper(bufnr))
end

local function save_immediately(event)
  local bufnr = event.buf
  local timer = timers[bufnr]
  if not timer then
    return
  end
  reset_buffer_timer_when_exists(bufnr)
  save_buffer(bufnr)
end

if not IS_MAC then
  return
end

SET_AUTOCMDS({
  {
    { 'TextChanged', 'TextChangedI' },
    {
      group = augroup,
      callback = save_delay,
    },
  },
  {
    { 'BufLeave', 'VimLeave' },
    {
      group = augroup,
      callback = save_immediately,
    },
  },
})
