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

function IS_BUF_LISTED(bufnr_or_info)
  local bufinfo = bufnr_or_info
  if type(bufnr_or_info) == "number" then
    bufinfo = BUF_INFO(bufnr_or_info)
  end
  if bufinfo.loaded == 0 then
    return false
  end
  return bufinfo.listed == 1
end

function IS_DIRPATH(path)
  return fn.isdirectory(path) == 1
end

function NOTIFY(...)
  local args = { ... }
  defer(function()
    vim.notify(unpack(args))
  end, 0)
end

function REQUEST_USER_INPUT(title, on_submit)
  ui.input({ prompt = title }, function(result)
    if result then
      on_submit(result)
    end
  end)
end

function REQUEST_USER_SELECT(options, title, on_submit)
  ui.select(options, { prompt = title }, function(result)
    if result then
      on_submit(result)
    end
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

  local buffer = opt.buffer
  if buffer then
    local key = mode
    if type(mode) == "table" then
      key = table.concat(mode, ",")
    end
    key = key .. from
    SET_BUF_DEL_MAP(key, function(bufnr)
      if bufnr == buffer then
        pcall(keymap.del, mode, from, { buffer = buffer })
        SET_BUF_DEL_MAP(key, nil)
      end
    end)
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
  return input == "" or not input
end

function SHORT_HOME_PATH(path)
  return path:gsub("^" .. HOME_PATH, "~")
end

function OPT(name, opt, value)
  if not opt then
    opt = { scope = "global" }
  elseif opt.win and not opt.scope then
    opt.scope = "local"
  end

  if value == nil then
    return api.nvim_get_option_value(name, opt)
  end

  if type(value) == "function" then
    value = value(api.nvim_get_option_value(name, opt))
  end

  if opt.scope ~= "global" then
    return api.nvim_set_option_value(name, value, opt)
  end

  o[name] = value
end

function SET_OPTS(opts, opt)
  for name, value in pairs(opts) do
    if type(opt) == "string" then
      vim[opt][name] = value
    else
      OPT(name, opt, value)
    end
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

function GET_KEYS_CODE(keys)
  return api.nvim_replace_termcodes(keys, true, true, true)
end

function PRESS_KEYS(keys, mode)
  api.nvim_feedkeys(GET_KEYS_CODE(keys), mode, false)
end

function LINE_COUNT(bufnr)
  return api.nvim_buf_line_count(bufnr)
end

function BUF_LINES(bufnr, _end, start)
  return api.nvim_buf_get_lines(bufnr, start or 0, _end, false)
end

local white_list = {
  help = true,
  text = true,
  markdown = true,
  Avante = true,
  octo = true,
  codecompanion = true,
}
function IS_BIG_FILE(bufnr)
  local filetype = OPT("filetype", { buf = bufnr })
  if white_list[filetype] then
    return false
  end
  if filetype == "bigfile" then
    return true
  end
  if LINE_COUNT(bufnr) > MAX_FILE_LENGTH then
    return true
  end
end

function GIT_ROOT(bufnr_or_path)
  bufnr_or_path = bufnr_or_path or CUR_BUF()
  local root = fs.root(bufnr_or_path, ".git")
  return root or fs.root(uv.cwd() or CUR_BUF(), ".git")
end

function MAX_WIDTH(offset, multiple)
  local editor_width = o.columns
  if multiple then
    return math.floor(editor_width * multiple)
  end
  local width = editor_width - (offset or 20)
  return width > 0 and width or editor_width
end

function EXCLUDE_LIST(list, excludes)
  return filter(function(item)
    return not contains(excludes or {}, item)
  end, list)
end

function ENABLE_CURSORLINE(bufnr, win)
  win = win or fn.bufwinid(bufnr)
  if OPT("cursorline", { win = win }) then
    return
  end
  defer(function()
    OPT("cursorline", { win = win }, true)
  end, 30)
end

function RUN_IN_BUF(bufnr, callback, opt)
  opt = opt or {}
  if not api.nvim_buf_is_valid(bufnr) then
    if opt.on_invalid then
      opt.on_invalid()
    end
    if opt.silent then
      return
    end
    return NOTIFY("RUN_IN_BUFFER: invalid buffer " .. bufnr, levels.ERROR)
  end
  api.nvim_buf_call(bufnr, callback)
end

function RUN_IN_WIN(win, callback, opt)
  opt = opt or {}
  if not api.nvim_win_is_valid(win) then
    if opt.on_invalid then
      opt.on_invalid()
    end
    if opt.silent then
      return
    end
    return NOTIFY("RUN_IN_WIN: invalid win " .. win, levels.ERROR)
  end
  api.nvim_win_call(win, callback)
end

function BUF_VAR(bufnr, name, value)
  if value ~= nil then
    return api.nvim_buf_set_var(bufnr, name, value)
  end
  local ok, val = pcall(api.nvim_buf_get_var, bufnr, name)
  if ok then
    return val
  end
end

function WIN_VAR(win, name, value)
  if value ~= nil then
    return api.nvim_win_set_var(win, name, value)
  end
  local ok, val = pcall(api.nvim_win_get_var, win, name)
  if ok then
    return val
  end
end

function FIND_FILE(file_or_dirs, opts)
  opts = opts or {}
  local bufinfo = BUF_INFO(CUR_BUF())
  local from = opts.from
  if not from and IS_BUF_LISTED(bufinfo) then
    from = bufinfo.name
  end
  local path_wraper = fs.find(file_or_dirs, {
    upward = true,
    path = from,
    stop = opts.to or HOME_PATH,
    limit = 1,
  })
  return path_wraper[1]
end

function HL(group_name)
  return api.nvim_get_hl(0, { name = group_name })
end

function SET_HLS(highlights)
  for group, highlight in pairs(highlights) do
    if highlight.force == nil then
      highlight.force = true
    end
    api.nvim_set_hl(0, group, merge(HL(group), highlight))
  end
end

function PUSH(dest, from)
  dest[#dest + 1] = from
end

function COLUMN_OPTS(enable, statuscolumn)
  local signcolumn = enable and "yes" or "no"
  return {
    number = enable,
    relativenumber = enable,
    foldcolumn = enable and "1" or "0",
    statuscolumn = statuscolumn or "",
    signcolumn = signcolumn,
  }
end

function WIN_HEIGHT(win, exclude_scrolloff)
  local height = api.nvim_win_get_height(win)

  if exclude_scrolloff then
    return height
  end

  return height - 2 * OPT("scrolloff", { win = win })
end

local direction_map = {
  up = "",
  down = "",
  right = "zl",
  left = "zh",
}
function SCROLL(win, direction, scroll_len)
  if not scroll_len then
    scroll_len = WIN_HEIGHT(win, true)
  end
  if scroll_len > 0 then
    if api.nvim_get_mode().mode == "n" then
      -- only run in normal mode
      cmd.normal({ scroll_len .. direction_map[direction], bang = true })
    end
  end
end

local buf_del_map = {}
function SET_BUF_DEL_MAP(key, func)
  buf_del_map[key] = func
end

function ON_BUF_DEL(bufnr)
  for _, func in pairs(buf_del_map) do
    func(bufnr)
  end
end

function LINE_BEFORE_CURSOR(opt)
  local win = opt.win
  local bufnr = opt.bufnr

  if bufnr then
    win = fn.bufwinid(bufnr)
  end

  local pos = WIN_CURSOR(win)
  local col = pos[2]
  local cur_line = api.nvim_get_current_line()
  local contents_before_cursor = cur_line:sub(1, col)
  return contents_before_cursor, pos
end
