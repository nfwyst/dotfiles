function CUR_BUF()
  return api.nvim_get_current_buf()
end

function CUR_WIN()
  return api.nvim_get_current_win()
end

function BUF_INFO(bufnr)
  if not bufnr then
    return fn.getbufinfo()
  end
  return fn.getbufinfo(bufnr)[1]
end

function IS_FILEPATH(path)
  return fn.filereadable(path) == 1
end

function IS_DIRPATH(path)
  return fn.isdirectory(path) == 1
end

function KEYS_TO_CMD(keys, cmd)
  cmd = cmd or {}
  for _, key in ipairs(keys) do
    if type(key[2]) == "string" then
      cmd[#cmd + 1] = key.desc
    end
  end
  return cmd
end

function NOTIFY(...)
  local args = { ... }
  defer(function()
    vim.notify(unpack(args))
  end, 0)
end

function GET_USER_INPUT(title, on_submit)
  vim.ui.input({ prompt = title }, function(result)
    if not result then
      return
    end
    on_submit(result)
  end)
end

function MAP(mode, from, to, opt)
  opt = opt or {}
  if EMPTY(opt.silent) then
    opt.silent = true
  end
  if EMPTY(opt.remap) and EMPTY(opt.noremap) then
    opt.noremap = true
  end
  keymap.set(mode, from, to, opt)
end

function MAPS(config)
  for mode, maps in pairs(config) do
    for _, map in ipairs(maps) do
      MAP(mode, map.from, map.to, map.opt)
    end
  end
end

function BUF_PATH(bufnr)
  return api.nvim_buf_get_name(bufnr)
end

function EMPTY(input)
  return not input or input == ""
end

function SHORT_HOME_PATH(path)
  return path:gsub("^" .. HOME_PATH, "~")
end

function SET_OPTS(opts, scope)
  scope = scope or "opt"
  for k, v in pairs(opts) do
    vim[scope][k] = v
  end
end

function SET_LOCAL_OPTS(opts, buf)
  for k, v in pairs(opts) do
    api.nvim_set_option_value(k, v, { buf = buf })
  end
end

function WIN_CURSOR(win, value)
  if not value then
    return api.nvim_win_get_cursor(win)
  end
  api.nvim_win_set_cursor(win, value)
end

function PRESS_KEYS(keys, mode)
  local codes = api.nvim_replace_termcodes(keys, false, true, true)
  api.nvim_feedkeys(codes, mode, false)
end

function BUF_COUNT(bufnr)
  return api.nvim_buf_line_count(bufnr)
end

function BUF_LINES(bufnr, total_line)
  return api.nvim_buf_get_lines(bufnr, 0, total_line, false)
end
