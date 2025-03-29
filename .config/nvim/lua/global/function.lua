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

function IS_FILEPATH(path, include_format)
  if include_format then
    local matched = string.match(path, "^/.*%.[%a]+$")
    if matched then
      return true
    end
  end

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
    if islist(mode) then
      key = table.concat(mode, ",")
    end
    key = key .. from
    ADD_BUF_DEL_CALLBACK(key, function(bufnr)
      if bufnr == buffer then
        pcall(keymap.del, mode, from, { buffer = buffer })
        ADD_BUF_DEL_CALLBACK(key, nil)
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

function EMPTY(input, table_mode)
  if table_mode and type(input) == "table" then
    return vim.tbl_isempty(input)
  end

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

  local is_global = opt.scope == "global"
  if type(value) == "function" then
    if is_global then
      value = value(vim.opt[name])
    else
      value = value(api.nvim_get_option_value(name, opt))
    end
  end

  if not is_global then
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

function WIN_CURSOR(win, value)
  if not value then
    return api.nvim_win_get_cursor(win)
  end

  pcall(api.nvim_win_set_cursor, win, value)
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

function HL(group_name, hl)
  local ns_id = 0
  if not hl then
    return api.nvim_get_hl(ns_id, { name = group_name })
  end

  api.nvim_set_hl(ns_id, group_name, hl)
end

function SET_HLS(hls)
  for group_name, hl in pairs(hls) do
    local origin_hl = HL(group_name)
    if type(hl) == "function" then
      hl = hl(origin_hl)
    else
      hl = merge(origin_hl, hl)
    end

    if hl.force == nil then
      hl.force = true
    end

    HL(group_name, hl)
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

function WIN_HEIGHT(win, height)
  if not height then
    return api.nvim_win_get_height(win)
  end

  api.nvim_win_set_height(win, height)
end

function WIN_WIDTH(win, width)
  if not width then
    return api.nvim_win_get_width(win)
  end

  api.nvim_win_set_width(win, width)
end

local function is_normal_mode()
  local mode = api.nvim_get_mode().mode
  return contains({ "n", "niI", "niR", "niV", "nt", "ntT" }, mode)
end

local direction_map = {
  up = "",
  down = "",
  right = "zl",
  left = "zh",
}
function SCROLL(win, direction, scroll_len)
  if not scroll_len then
    scroll_len = WIN_HEIGHT(win)
  end

  if scroll_len > 0 and is_normal_mode() then
    -- only run in normal mode
    cmd.normal({ scroll_len .. direction_map[direction], bang = true })
  end
end

local cursor_move_callback_map = {}
function ADD_CURSOR_MOVE_CALLBACK(key, callback)
  cursor_move_callback_map[key] = callback
end

function ON_CURSOR_MOVE(event)
  for _, callback in pairs(cursor_move_callback_map) do
    callback(event)
  end
end

local buf_del_callback_map = {}
function ADD_BUF_DEL_CALLBACK(key, func)
  buf_del_callback_map[key] = func
end

function ON_BUF_DEL(bufnr)
  for _, callback in pairs(buf_del_callback_map) do
    callback(bufnr)
  end
end

function LINE_BEFORE_CURSOR(opt)
  local win = opt.win
  local bufnr = opt.bufnr

  if bufnr then
    win = fn.bufwinid(bufnr)
  end

  if not api.nvim_win_is_valid(win) then
    return
  end

  local pos = WIN_CURSOR(win)
  local cur_line = api.nvim_get_current_line()
  local prefix = cur_line:sub(1, pos[2])

  return prefix, pos
end

function STR_CONTAINS(str, substr)
  if #substr == 0 then
    return true
  end

  return string.find(str, substr, 1, true) ~= nil
end

function DEL_BUF(bufnr, wipe)
  ON_BUF_DEL(bufnr)

  if wipe then
    return Snacks.bufdelete({ buf = bufnr, wipe = wipe })
  end

  api.nvim_buf_delete(bufnr, { force = false })
end

function SELECT_PROMPT(on_select)
  REQUEST_USER_SELECT({ "programmer", "generic", "default" }, "Select Prompt: ", function(prompt)
    local result
    if prompt == "programmer" then
      result = PROMPT
    end

    if prompt == "generic" then
      result = PURE_PROMPT
    end

    on_select(result)
  end)
end

function ADD_BLINK_SOURCE(opt)
  local blink = require("blink.cmp")

  schedule(function()
    local id = opt.id
    local config = opt.config
    local is_default = opt.default
    local filetypes = opt.filetypes
    local origin_config = require("blink.cmp.config")
    local has_filetypes = not EMPTY(filetypes, true)

    if is_default and not has_filetypes then
      local defaults = origin_config.sources.default
      if type(defaults) ~= "function" and not contains(defaults, id) then
        return PUSH(defaults, id)
      end
    end

    if config then
      config.opts = config.opts or {}
      if is_default and has_filetypes then
        config.enabled = function()
          local filetype = OPT("filetype", { buf = CUR_BUF() })
          return contains(filetypes, filetype)
        end
      end

      blink.add_source_provider(id, config)
    end

    if has_filetypes then
      for _, filetype in ipairs(filetypes) do
        blink.add_filetype_source(filetype, id)
      end
    end

    if opt.keymap then
      local apply = require("blink.cmp.keymap.apply")
      for key, callback in pairs(opt.keymap) do
        if type(callback) == "function" then
          apply.set("i", key, function()
            return callback(blink)
          end)
        else
          NOTIFY("ADD_BLINK_SOURCE: callback for " .. key .. " should be function")
        end
      end
    end
  end)
end

function ADD_BLINK_COMPAT_SOURCES(opt)
  for _, id in ipairs(opt.ids) do
    ADD_BLINK_SOURCE({
      id = id,
      filetypes = opt.filetypes,
      default = opt.default,
      config = {
        name = id,
        module = "blink.compat.source",
      },
    })
  end
end

function NewFile()
  local buf = CUR_BUF()
  cmd("ene | startinsert")

  local bufnr = CUR_BUF()
  if bufnr ~= buf then
    BUF_VAR(bufnr, CONSTS.IS_NEW_FILE, true)
  end
end

local function get_hl(hl)
  if type(hl) == "function" then
    return hl
  end

  local new_hl = hl[o.background]
  if new_hl then
    return new_hl
  end

  local syntax_off = hl.syntax_off
  if IS_SYNTAX_OFF and syntax_off then
    return syntax_off
  end

  if not hl.light and not hl.dark and not syntax_off then
    return hl
  end
end

function UPDATE_HLS(new_hls)
  local hls = {}
  if new_hls then
    assign(HIGHLIGHTS, new_hls)
  end

  for group_name, hl in pairs(HIGHLIGHTS) do
    hls[group_name] = get_hl(hl)
  end

  SET_HLS(hls)
end

function SET_SCOPE_DIM()
  if IS_LINUX or not Snacks then
    return
  end

  local enable = not contains(BINARY_SCHEMES, g.colors_name)
  if enable then
    return Snacks.dim.enable()
  end

  Snacks.dim.disable()
end

function SET_KEYMAP_PRE_HOOK(modes, lhses, pre_hook)
  for _, mode in ipairs(modes) do
    for _, lhs in ipairs(lhses) do
      local function hook()
        local conf = fn.maparg(lhs, mode, false, true)
        if not EMPTY(conf, true) then
          local callback = conf.callback
          if not callback then
            callback = function()
              PRESS_KEYS(conf.rhs, mode:lower())
            end
          end

          local opt = {
            noremap = conf.noremap == 1,
            silent = conf.silent == 1,
            nowait = conf.nowait == 1,
            script = conf.script == 1,
            expr = conf.expr == 1,
            desc = conf.desc,
          }
          local function rhs()
            if pre_hook() ~= false then
              callback()
            end
          end

          if conf.buffer ~= 0 then
            opt.buffer = conf.buffer
          end

          MAP(mode, lhs, rhs, opt)
        end
      end

      if LAZYVIM_KEYMAP_INITED then
        hook()
      else
        KEYMAP_PRE_HOOKS[mode .. lhs] = hook
      end
    end
  end
end

function ADD_LUALINE_COMPONENT(section_name, component, index)
  local lualine = require("lualine")

  schedule(function()
    local config = lualine.get_config()
    if type(component) == "function" then
      component = component()
    end

    local target_section = config.sections[section_name]
    if not target_section then
      target_section = {}
      config.sections[section_name] = target_section
    end

    for _, existing in ipairs(target_section) do
      if existing == component then
        return
      end
    end

    if type(index) == "number" then
      local last_pos = #target_section + 1
      if index < 0 then
        index = index + last_pos
      end

      index = math.max(1, math.min(index, last_pos))

      table.insert(target_section, index, component)
    else
      PUSH(target_section, component)
    end

    lualine.setup(config)
  end)
end
