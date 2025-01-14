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
    if type(scope) == "string" then
      vim[scope][k] = v
    else
      scope[k] = v
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

local white_list = {
  help = true,
  text = true,
  markdown = true,
  Avante = true,
}
function IS_BIG_FILE(bufnr)
  local filetype = bo[bufnr].filetype
  if white_list[filetype] then
    return false
  end
  if filetype == "bigfile" then
    return true
  end
  local line_numbers = BUF_COUNT(bufnr)
  if line_numbers > MAX_FILE_LENGTH then
    return true
  end
end

function GET_GIT_ROOT(bufnr_or_path)
  bufnr_or_path = bufnr_or_path or CUR_BUF()
  local root = fs.root(bufnr_or_path, ".git")
  return root or fs.root(fn.getcwd(), ".git")
end

function GET_MAX_WIDTH(offset, multiple)
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

function ENABLE_CURSORLINE(bufnr)
  local win = fn.bufwinid(bufnr)
  wo[win].cursorline = true
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

function GET_HL(group_name)
  return api.nvim_get_hl(0, { name = group_name })
end

function SET_HLS(highlights)
  for group, highlight in pairs(highlights) do
    if highlight.force == nil then
      highlight.force = true
    end
    local old_value = GET_HL(group)
    api.nvim_set_hl(0, group, merge(old_value, highlight))
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

function CLEAN_TABLINE_TITLE_MAP(bufnr)
  local bufpath = BUF_PATH(bufnr)
  if not IS_FILEPATH(bufpath) then
    return
  end

  local bufname = fs.basename(bufpath)
  local showed_map = TABLINE_TITLE_MAP[bufname]

  if showed_map then
    TABLINE_TITLE_MAP[bufname] = filter(function(buf)
      return buf ~= bufnr
    end, showed_map)
  end

  if #showed_map < 1 then
    TABLINE_TITLE_MAP[bufname] = nil
  end
end
