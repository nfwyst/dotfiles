local api = vim.api
local fn = vim.fn
local dst = vim.diagnostic
local fs = vim.fs
local cmd = api.nvim_create_user_command
local cursor = vim.opt.guicursor

function MERGE_TABLE(...)
  return vim.tbl_deep_extend('force', ...)
end

function FILTER_TABLE(tbl, filter)
  local tb = {}
  for key, value in pairs(tbl) do
    local ok = filter(value, key)
    if ok then
      if type(key) == 'number' then
        table.insert(tb, value)
      else
        tb[key] = value
      end
    end
  end
  return tb
end

function MERGE_ARRAYS(...)
  local arr = {}
  for _, array in ipairs({ ... }) do
    for _, value in ipairs(array) do
      table.insert(arr, value)
    end
  end
  return arr
end

function DEFINE_SIGNS(signs)
  for name, sign in pairs(signs) do
    local opt = { text = sign, numhl = '' }
    if type(sign) == 'table' then
      opt = MERGE_TABLE(opt, sign)
    end
    fn.sign_define(name, opt)
  end
end

function SET_USER_COMMANDS(table)
  for k, v in pairs(table) do
    USER_COMMAND(k, v)
  end
end

function USER_COMMAND(name, func)
  cmd(name, func, { range = true })
end

function SET_HL(table)
  for group, value in pairs(table) do
    if value.force == nil then
      value.force = true
    end
    local old_value = GET_HL(group)
    api.nvim_set_hl(0, group, MERGE_TABLE(old_value, value))
  end
end

function GET_HL(name)
  return api.nvim_get_hl(0, { name = name })
end

function SHOW_CURSOR()
  SET_HL(CURSOR_HILIGHT_OPTS)
  cursor:remove('a:Cursor/lCursor')
end

function HIDE_CURSOR()
  SET_HL({ Cursor = { blend = 100 } })
  cursor:append('a:Cursor/lCursor')
end

function GET_HIGHLIGHT(name, opt)
  local ht = GET_HL(name)
  if not opt then
    return ht
  end
  return ht[opt]
end

function SET_KEY_MAPS(table)
  for mode, maps in pairs(table) do
    for _, v in ipairs(maps) do
      KEY_MAP(mode, v.lhs, v.rhs, v.opts)
    end
  end
end

function GET_MAX_WIDTH(offset, multiple)
  local width = GET_EDITOR_WIDTH()
  if multiple then
    return math.floor(width * multiple)
  end
  offset = offset or 20
  width = width - offset
  return width > 0 and width or -width
end

function GET_MAX_HEIGHT(offset, multiple)
  local height = GET_EDITOR_HEIGHT()
  if multiple then
    return math.floor(height * multiple)
  end
  offset = offset or 20
  height = height - offset
  return height > 0 and height or -height
end

local function key_exists(mode, lhs)
  local ok, exists = pcall(function(...)
    local keys = require('lazy.core.handler').handlers.keys
    if keys.active[keys.parse(...).id] then
      return true
    end
    return false
  end, { lhs, mode = mode })
  if not ok then
    return false
  end
  return exists
end

function KEY_MAP(mode, lhs, rhs, opts)
  local has_key = key_exists(mode, lhs)
  if has_key then
    LOG_ERROR('key map error', 'key' .. lhs .. 'already exists')
    return
  end
  opts = opts or {}
  local silent = opts.silent ~= false
  opts = MERGE_TABLE({ noremap = true, silent = silent }, opts)
  vim.keymap.set(mode, lhs, rhs, opts)
end

function SET_GLOBAL_OPTS(opts)
  for k, v in pairs(opts) do
    vim.g[k] = v
  end
end

function GET_FIRST_WINDOW_BY_BUF(bufnr)
  return fn.bufwinid(bufnr)
end

function SHORT_HOME_PATH(path)
  return path:gsub('^' .. HOME_PATH, '~')
end

function GET_WINDOWS_BY_BUF(bufnr)
  local windows = {}
  for _, win in ipairs(api.nvim_list_wins()) do
    if GET_BUFFER_ID(win) == bufnr then
      table.insert(windows, win)
    end
  end
  return windows
end

function SET_OPT(k, v, config)
  if not config then
    vim.opt[k] = v
    return
  end
  function set_opt_for_win(bufnr)
    for _, win in ipairs(GET_WINDOWS_BY_BUF(bufnr)) do
      ---@diagnostic disable-next-line: deprecated
      api.nvim_win_set_option(win, k, v)
    end
  end
  local buf = config.buf
  local win = config.win
  if win then
    ---@diagnostic disable-next-line: deprecated
    api.nvim_win_set_option(win, k, v)
    return
  end
  if not buf then
    return
  end
  local ok, _ = pcall(function()
    ---@diagnostic disable-next-line: deprecated
    api.nvim_buf_set_option(buf, k, v)
  end)
  if not ok then
    set_opt_for_win(buf)
  end
end

function SET_OPTS(opts, config)
  for k, v in pairs(opts) do
    SET_OPT(k, v, config)
  end
end

local table_contains_cache = {}
function INCLUDES(arr, value, cache_key)
  local function process(cacher)
    for _, v in ipairs(arr) do
      if v == value then
        if cacher then
          cacher[value] = true
        end
        return true
      end
    end
    if cacher then
      cacher[value] = false
    end
    return false
  end
  if not cache_key then
    return process()
  end
  if not table_contains_cache[cache_key] then
    table_contains_cache[cache_key] = {}
  end
  local cacher = table_contains_cache[cache_key]
  local cached = cacher[value]
  if cached ~= nil then
    return cached
  end
  return process(cacher)
end

function TABLE_REMOVE_BY_VAL(table, value)
  for k, v in pairs(table) do
    if v == value then
      table[k] = nil
    end
  end
end

function TABLE_REMOVE_BY_KEY(table, key)
  table[key] = nil
end

local function center_string_by_width(str, width, offset)
  local padding = math.floor((width - #str) / 2)
  if not offset then
    offset = 0
  end
  return string.rep(' ', padding + offset) .. str
end

function GET_PROJECT_NAME(winid)
  local cache = {}
  local ok, util = pcall(require, 'lspconfig.util')
  local basename = fs.basename
  if not ok then
    LOG_ERROR('pcall error', util)
    return
  end

  return function(working_dir)
    local title = basename(working_dir)
    local working_dir_name = title
    local win_width = api.nvim_win_get_width(winid())
    if not BAR_PATH then
      return center_string_by_width(title, win_width, 1)
    end

    local cache_key = BAR_PATH .. win_width
    local cached = cache[cache_key]
    if cached then
      return cached
    end

    working_dir = GET_PROJECT_ROOT(BAR_PATH)
    title = basename(working_dir)
    local child_dir_parent = GET_DIR_PATH(working_dir)
    local parent_project_root = GET_PROJECT_ROOT(child_dir_parent)

    if parent_project_root then
      local parent_name = basename(parent_project_root)
      title = parent_name .. '  ' .. title
    elseif title ~= working_dir_name then
      title = title .. '  ' .. working_dir_name
    end

    title = center_string_by_width(title, win_width, 1)
    cache[cache_key] = title
    return title
  end
end

function UNPACK(table)
  local up = table.unpack or unpack
  return up(table)
end

function SET_AUTOCMDS(list)
  for _, item in ipairs(list) do
    local event = item[1]
    local defs = item[2]
    AUTOCMD(event, defs)
  end
end

function SET_COLORSCHEME(scheme)
  vim.cmd.colorscheme(scheme)
end

function GET_CURRENT_BUFFER()
  return api.nvim_get_current_buf() or 0
end

function GET_CURRENT_WIN()
  return api.nvim_get_current_win() or 0
end

function IS_PACKAGE_LOADED(pkg)
  return not not package.loaded[pkg]
end

function NEW_FILE(bang, open)
  vim.ui.input({ prompt = 'Enter a file name: ' }, function(fname)
    if not fname then
      LOG_ERROR('cant save', 'file name missing')
      return
    end
    if open then
      vim.cmd.edit(fname)
    end
    vim.cmd.write({ fname, bang = bang })
  end)
end

function SAVE(force)
  local bang = force ~= nil and force ~= false
  local buffer_path = GET_CURRENT_BUFFER_PATH()
  if buffer_path == '' then
    NEW_FILE(bang)
    return
  end
  vim.cmd.write({ bang = bang })
end

function QUIT(force)
  pcall(vim.cmd.quit, { bang = force ~= nil and force ~= false })
end

function SAVE_THEN_QUIT(force)
  vim.cmd.wa({ bang = force ~= nil and force ~= false })
  QUIT(force)
end

function GET_BUFFER_PATH(bufnr)
  return api.nvim_buf_get_name(bufnr or GET_CURRENT_BUFFER())
end

function GET_OPT(optname, config)
  if not config then
    return vim.o[optname]
  end
  return api.nvim_get_option_value(optname, config)
end

function RUN_CMD(command, check)
  local name = ':' .. command:match('^%s*(%S+)')
  if check and fn.exists(name) == 0 then
    return false
  end
  PCALL(vim.cmd, command)
end

function SET_TIMEOUT(func, timeout)
  vim.defer_fn(func, timeout or 0)
end

function GET_DIR_PATH(path)
  return fs.dirname(path)
end

function IS_FILE_IN_FS(filepath)
  local ok, Path = pcall(require, 'plenary.path')
  if not ok then
    return false
  end
  return Path:new(filepath):is_file()
end

function IS_DIR_IN_FS(dirpath)
  local ok, Path = pcall(require, 'plenary.path')
  if not ok then
    return false
  end
  return Path:new(dirpath):is_dir()
end

function PCALL(f, ...)
  local ok, err = pcall(f, ...)
  if ok or not err then
    return err
  end
  LOG_ERROR('pcall error', err)
end

function LOG_INFO(title, message, timeout)
  -- fix that vim.notify has not rewrite by noice
  SET_TIMEOUT(function()
    vim.notify(message or '', INFO, {
      title = title,
      timeout = timeout ~= nil and timeout or 3000,
    })
  end)
end

function LOG_ERROR(title, message)
  -- fix that vim.notify has not rewrite by noice
  SET_TIMEOUT(function()
    vim.notify(message, ERROR, {
      title = title,
    })
  end)
end

function LOG_WARN(title, message)
  -- fix that vim.notify has not rewrite by noice
  SET_TIMEOUT(function()
    vim.notify(message, WARN, {
      title = title,
    })
  end)
end

local function PARTITION(arr, low, high, compare)
  local pivot = arr[high]
  local i = low - 1

  for j = low, high - 1 do
    if compare(arr[j], pivot) then
      i = i + 1
      arr[i], arr[j] = arr[j], arr[i]
    end
  end

  arr[i + 1], arr[high] = arr[high], arr[i + 1]
  return i + 1
end

function QUICKSORT(arr, low, high, compare)
  if low < high then
    local pivot = PARTITION(arr, low, high, compare)
    QUICKSORT(arr, low, pivot - 1, compare)
    QUICKSORT(arr, pivot + 1, high, compare)
  end
end

function GET_COLOR()
  local colors = require('NeoSolarized.colors')
  return colors[SCHEME_BACKGROUND]
end

function INIT_HL()
  local color = GET_COLOR()
  SET_HL(MERGE_TABLE(CURSOR_HILIGHT_OPTS, {
    CursorLine = { bg = color.fg1 },
    CursorLineNr = { fg = '#388bfd' },
    ['@variable'] = { fg = color.fg0 },
    Normal = { fg = color.fg0 },
    Comment = { fg = color.fg2 },
    LineNrAbove = { fg = color.fg1 },
    LineNr = { fg = color.fg1 },
    LineNrBelow = { fg = color.fg1 },
    MatchParen = { bg = '#000000' },
  }))
end

function TOGGLE_INLAY_HINT()
  vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled({}))
end

function IS_GPT_PROMPT_CHAT(bufnr)
  if not IS_PACKAGE_LOADED('gp') then
    return false
  end
  local ok, gp = pcall(require, 'gp')
  if not ok then
    return false
  end
  local buf = bufnr or GET_CURRENT_BUFFER()
  local buffer_path = GET_BUFFER_PATH(buf)
  return gp.not_chat(buf, buffer_path) == nil
end

function NEW_PICKER(title, theme, results, opts)
  theme.entry_parser = opts.entry_parser
  local pickers = require('telescope.pickers')
  local finders = require('telescope.finders')
  local conf = require('telescope.config').values
  local actions = require('telescope.actions')
  local action_state = require('telescope.actions.state')

  local function attach_mappings(prompt_bufnr, _)
    actions.select_default:replace(function()
      local selection = action_state.get_selected_entry()
      actions.close(prompt_bufnr)
      opts.on_select(results[selection.index])
    end)
    return true
  end

  pickers
    .new(theme, {
      prompt_title = title,
      finder = finders.new_table({
        results = results,
      }),
      previewer = opts.preview and PREVIEWER.new(theme) or nil,
      sorter = conf.generic_sorter(theme),
      attach_mappings = opts.on_select and attach_mappings or nil,
    })
    :find()
end

function FEED_KEYS(keys, mode)
  local from_part = true
  local do_lt = false
  local special = true
  local keyscode = api.nvim_replace_termcodes(keys, from_part, do_lt, special)
  api.nvim_feedkeys(keyscode, mode, false)
end

function GET_VIEWPORT_HEIGHT(winnr)
  local win_height = api.nvim_win_get_height(winnr)
  local scrolloff = GET_OPT('scrolloff', { win = winnr })
  return win_height - 2 * scrolloff
end

function BUF_VALID(bufnr)
  return api.nvim_buf_is_valid(bufnr)
end

function WIN_VALID(win)
  return api.nvim_win_is_valid(win)
end

function GET_FILETYPE(bufnr)
  return GET_OPT('filetype', { buf = bufnr })
end

function GET_BUFFER_ID(winid)
  return api.nvim_win_get_buf(winid)
end

function IS_CURSOR_HIDE()
  return GET_HIGHLIGHT('Cursor', 'blend') == 100
end

function FIND_FIRST_FILE_OR_DIR_PATH(file_or_dirs, start_path, stop_path)
  local path_wraper = fs.find(file_or_dirs, {
    upward = true,
    path = start_path or GET_CURRENT_FILE_OR_DIR_PATH(),
    stop = stop_path or HOME_PATH,
    limit = 1,
  })
  return path_wraper[1]
end

local project_root_cache = {}
function GET_PROJECT_ROOT(start_path, exclude_git_root)
  local marker = PROJECT_PATTERNS
  local cache_key = exclude_git_root and start_path .. '_no_git' or start_path
  local cached = project_root_cache[cache_key]
  if cached then
    return cached
  end
  if exclude_git_root then
    marker = SLICE(PROJECT_PATTERNS, 1, #PROJECT_PATTERNS - 1)
  end
  local root = fs.root(start_path, marker)
  project_root_cache[cache_key] = root
  return root
end

function SLICE(arr, from, to)
  return { unpack(arr, from, to) }
end

function GET_WORKING_DIR()
  ---@diagnostic disable-next-line: undefined-field
  return vim.uv.cwd()
end

function GET_CURRENT_BUFFER_PATH()
  return GET_BUFFER_PATH(GET_CURRENT_BUFFER())
end

function GET_CURRENT_FILE_OR_DIR_PATH()
  local current_buffer_path = GET_CURRENT_BUFFER_PATH()
  if IS_FILE_IN_FS(current_buffer_path) then
    return current_buffer_path
  end
  return GET_WORKING_DIR()
end

local git_root_cache = {}
function GET_GIT_ROOT(start_path)
  if not start_path then
    start_path = GET_CURRENT_FILE_OR_DIR_PATH()
  end
  local cached = git_root_cache[start_path]
  if cached then
    return cached
  end
  local root = fs.root(start_path, '.git')
  git_root_cache[start_path] = root
  return root
end
HAS_GIT_ROOT = GET_GIT_ROOT()

function SPLIT_STRING_BY_LEN(str, max_len)
  if #str < max_len then
    return { str }
  end

  local result = {}
  local start_index = 1

  while start_index <= #str do
    local end_index = start_index + max_len - 1
    if end_index > #str then
      end_index = #str
    end
    table.insert(result, str:sub(start_index, end_index))
    start_index = end_index + 1
  end

  return result
end

function GET_EDITOR_WIDTH()
  return vim.o.columns
end

function GET_EDITOR_HEIGHT()
  return vim.o.lines
end

function SCROLL_TO(line, col)
  api.nvim_win_set_cursor(GET_CURRENT_WIN(), { line, col })
end

function START_WITH(str, prefix)
  return string.sub(str, 1, #prefix) == prefix
end

function STRING_HAS(str, substr)
  return fn.stridx(str, substr) ~= -1
end

function HAS_WILDCARD(str)
  return STRING_HAS(str, '[*?]')
end

local function string_to_pattern(str, fuzzy)
  if not HAS_WILDCARD(str) then
    return str
  end
  local pattern = str:gsub('%.', '%%.'):gsub('%*', '.*')
  if fuzzy then
    return pattern
  end
  return '^' .. pattern .. '$'
end

function STRING_PATTERN_MATCHED(str, patterns, fuzzy)
  if type(patterns) == 'string' then
    patterns = { patterns }
  end
  local function matcher(_str, pattern)
    if HAS_WILDCARD(pattern) then
      return string.match(_str, string_to_pattern(pattern, fuzzy))
    end
    return _str == pattern
  end
  for _, pattern in ipairs(patterns) do
    if matcher(str, pattern) then
      return true
    end
  end
  return false
end

function GET_CUR_BUF_TO_GIT_PATH()
  return fn.expand('%')
end

function BIND_QUIT(bufnr)
  local option = { silent = true, buffer = bufnr }
  KEY_MAP('n', 'q', vim.cmd.close, option)
end

function DEBOUNCE(fn, config)
  local last_time_of = {}
  config = config or {}
  local delay = config.delay or 800
  local omitter = config.omitter
  return function(...)
    local original_args = { ... }
    local args = {}

    if omitter then
      for index, original_arg in ipairs(original_args) do
        args[index] = OMIT_TABLE(original_arg, omitter)
      end
    else
      args = original_args
    end

    local args_str = vim.inspect(args)
    local last_time = last_time_of[args_str] or 0
    ---@diagnostic disable-next-line: undefined-field
    local current_time = vim.uv.now()
    local delay_done = current_time - last_time > delay

    last_time_of[args_str] = current_time

    if not delay_done then
      return
    end

    fn(UNPACK(original_args))
  end
end

function GET_ALL_BUFFERS(only_file, new_buf)
  local buffers = api.nvim_list_bufs()
  if not only_file then
    return buffers
  end
  return FILTER_TABLE(buffers, function(bufnr)
    local is_new = new_buf and new_buf == bufnr
    local is_file = is_new or IS_FILE_IN_FS(GET_BUFFER_PATH(bufnr))
    local is_in_list = GET_OPT('buflisted', { buf = bufnr })
    return is_file and is_in_list
  end)
end

function OMIT_TABLE(tbl, should_omit)
  return FILTER_TABLE(tbl, function(value, key)
    return not should_omit(value, key)
  end)
end

function IS_BIG_FILE(bufnr, multiple)
  local buffer_path = GET_BUFFER_PATH(bufnr)
  if not IS_FILE_IN_FS(buffer_path) then
    return false, false
  end

  local file_length = api.nvim_buf_line_count(bufnr)
  if not multiple then
    multiple = 1
  end
  if file_length > MAX_FILE_LENGTH * multiple then
    return true, true
  end

  ---@diagnostic disable-next-line: undefined-field
  local stats = vim.uv.fs_stat(buffer_path)
  if not stats then
    return false, true
  end

  return stats.size > 131072, true -- 128 Kib
end

function GET_HIDE_COLUMN_OPTS(status)
  local opt = {
    number = false,
    relativenumber = false,
    foldcolumn = '0',
    list = false,
    showbreak = 'NONE',
  }
  if status then
    opt.statuscolumn = ''
  end
  return opt
end

function ADD_CMP_SOURCE(name, opt)
  local has_cmp, cmp = pcall(require, 'cmp')
  if not has_cmp then
    return
  end
  opt = opt or {}
  local config = cmp.get_config()
  local newSource = {
    group_index = opt.group_index or 1,
    priority = opt.priority,
    name = name,
    max_item_count = opt.max_item_count or 3,
  }
  table.insert(config.sources, newSource)
  cmp.setup(config)
end

function FILETYPE_VALID(buf, invalid_arr, cache_key)
  local filetype = GET_FILETYPE(buf)
  invalid_arr = invalid_arr or INVALID_FILETYPE
  cache_key = cache_key or CONSTANTS.INVALID_FILETYPE
  return not INCLUDES(invalid_arr, filetype, cache_key)
end

function ENABLE_CURSORLINE(opts, force)
  local buf = opts.buf
  local winid = opts.win
  local invalid_arr = INVALID_CURSORLINE_FILETYPE
  local cache_key = CONSTANTS.INVALID_CURSORLINE_FILETYPE
  if not force then
    buf = buf or GET_BUFFER_ID(winid)
    if not FILETYPE_VALID(buf, invalid_arr, cache_key) then
      return
    end
  end
  local function process(win)
    local opt = { win = win }
    if not GET_OPT('cursorline', opt) then
      SET_OPT('cursorline', true, opt)
    end
  end
  if winid then
    return process(winid)
  end
  local wins = GET_WINDOWS_BY_BUF(buf)
  for _, win in ipairs(wins) do
    process(win)
  end
end

function IS_FILETYPE(filetype, opts)
  opts = opts or {}
  local buf = opts.buf
  local win = opts.win
  if not buf then
    buf = win and GET_BUFFER_ID(win) or GET_CURRENT_BUFFER()
  end
  return GET_FILETYPE(buf) == filetype
end

function ENABLE_DIAGNOSTIC(bufnr, on_done)
  local opt = bufnr and { bufnr = bufnr } or nil
  if dst.is_enabled(opt) then
    return
  end
  dst.enable(true, opt)
  if on_done then
    on_done(bufnr)
  end
end

function GET_BUFFER_VARIABLE(bufnr, name)
  local ok, value = pcall(api.nvim_buf_get_var, bufnr, name)
  if ok then
    return value
  end
end

function SET_BUFFER_VARIABLE(bufnr, name, value)
  api.nvim_buf_set_var(bufnr, name, value)
end

function DISABLE_DIAGNOSTIC(bufnr)
  local opt = bufnr and { bufnr = bufnr } or nil
  if not dst.is_enabled(opt) then
    return
  end
  dst.enable(false, opt)
end

function RUN_IN_BUFFER(bufnr, callback)
  api.nvim_buf_call(bufnr, callback)
end

function RUN_IN_WINDOW(win, callback)
  api.nvim_win_call(win, callback)
end
