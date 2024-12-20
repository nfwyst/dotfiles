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

function ASSIGN(to, from)
  for key, value in pairs(from) do
    to[key] = value
  end
  return to
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

function WIN_CURSOR(win, value)
  if not value then
    return api.nvim_win_get_cursor(win)
  end
  api.nvim_win_set_cursor(win, value)
end

function PRESS_KEYS(keys, mode)
  local codes = api.nvim_replace_termcodes(keys, false, true, true)
  vim.api.nvim_feedkeys(codes, mode, false)
end
