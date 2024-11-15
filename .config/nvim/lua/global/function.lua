local api = vim.api
local cmd = api.nvim_create_user_command
local cursor = vim.opt.guicursor

function MERGE_TABLE(...)
  return vim.tbl_deep_extend("force", ...)
end

function FILTER_TABLE(tbl, filter)
  local tb = {}
  for key, value in pairs(tbl) do
    local ok = filter(value, key)
    if ok then
      if type(key) == "number" then
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
    local opt = { text = sign, numhl = "" }
    if type(sign) == "table" then
      opt = MERGE_TABLE(opt, sign)
    end
    vim.fn.sign_define(name, opt)
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
  cursor:remove("a:Cursor/lCursor")
end

function HIDE_CURSOR()
  SET_HL({ Cursor = { blend = 100 } })
  cursor:append("a:Cursor/lCursor")
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
    local keys = require("lazy.core.handler").handlers.keys
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
    LOG_ERROR("key map error", "key" .. lhs .. "already exists")
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

function TABLE_CONTAINS(table, value)
  for _, v in pairs(table) do
    if v == value then
      return true
    end
  end
  return false
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

function SET_WORKSPACE_PATH_GLOBAL()
  local ok, util = pcall(require, "lspconfig.util")
  if not ok then
    LOG_ERROR("pcall error", util)
    return
  end
  WORKSPACE_PATH = GET_WORKSPACE_PATH()
  LOG_INFO("changing workspace path", "new path: " .. WORKSPACE_PATH)
end

function CENTER_STRING_BY_WIDTH(str, width, offset)
  local padding = math.floor((width - #str) / 2)
  if not offset then
    offset = 0
  end
  return string.rep(" ", padding + offset) .. str
end

function GET_PROJECT_NAME(winid)
  local cached = {}
  local ok, util = pcall(require, "lspconfig.util")
  local basename = vim.fs.basename
  if not ok then
    LOG_ERROR("pcall error", util)
    return
  end

  return function(root_path)
    local root_name = basename(root_path)
    local win_width = api.nvim_win_get_width(winid())
    if not BAR_PATH then
      return CENTER_STRING_BY_WIDTH(root_name, win_width, 1)
    end

    local result = cached[BAR_PATH]
    if result then
      return result
    end

    local name = basename(GET_WORKSPACE_PATH(BAR_PATH, true))
    result = root_name
    local key
    if name ~= root_name then
      key = root_name .. "  " .. name
      if cached[key] then
        return cached[key]
      end
      result = key
    end

    result = CENTER_STRING_BY_WIDTH(result, win_width, 2)
    cached[BAR_PATH] = result
    if key then
      cached[key] = result
    end

    return result
  end
end

function UNPACK(table)
  local up = table.unpack or unpack
  return up(table)
end

function IS_ABSOLUTE_PATH(path)
  local seps = { "/", "\\" }
  return TABLE_CONTAINS(seps, string.sub(path, 1, 1))
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

function SAVE(force)
  local bang = force ~= nil and force ~= false
  local buffer_path = GET_CURRENT_BUFFER_PATH()
  if buffer_path == "" then
    vim.ui.input({ prompt = "Enter a file name: " }, function(fname)
      if not fname then
        LOG_ERROR("cant save", "file name missing")
      else
        vim.cmd.write({ fname, bang = bang })
      end
    end)
  else
    vim.cmd.write({ bang = bang })
  end
end

function QUIT(force)
  pcall(vim.cmd.quit, { bang = force ~= nil and force ~= false })
end

function SAVE_THEN_QUIT(force)
  vim.cmd.wa({ bang = force ~= nil and force ~= false })
  QUIT(force)
end

function GET_BUFFER_PATH(bufnr)
  return api.nvim_buf_get_name(bufnr or 0)
end

function GET_OPT(optname, config)
  if not config then
    return vim.o[optname]
  end
  return api.nvim_get_option_value(optname, config)
end

function RUN_CMD(command, check)
  local name = ":" .. command:match("^%s*(%S+)")
  if check and vim.fn.exists(name) == 0 then
    return
  end
  PCALL(vim.cmd, command)
end

function SET_TIMEOUT(func, timeout)
  vim.defer_fn(func, timeout or 0)
end

function GET_DIR_PATH(path)
  return vim.fs.dirname(path)
end

function IS_FILE_PATH(path, include_dir)
  local ok, Path = pcall(require, "plenary.path")
  if not ok then
    return
  end
  path = Path:new(path)
  local is_file = path:is_file()
  local is_dir = path:is_dir()
  if include_dir then
    return is_dir or is_file
  end
  return is_file
end

function PCALL(f, ...)
  local ok, err = pcall(f, ...)
  if ok or not err then
    return err
  end
  LOG_ERROR("pcall error", err)
end

function LOG_INFO(title, message, timeout)
  -- fix that vim.notify has not rewrite by noice
  SET_TIMEOUT(function()
    vim.notify(message or "", vim.log.levels.INFO, {
      title = title,
      timeout = timeout ~= nil and timeout or 3000,
    })
  end)
end

function LOG_ERROR(title, message)
  -- fix that vim.notify has not rewrite by noice
  SET_TIMEOUT(function()
    vim.notify(message, vim.log.levels.ERROR, {
      title = title,
    })
  end)
end

function LOG_WARN(title, message)
  -- fix that vim.notify has not rewrite by noice
  SET_TIMEOUT(function()
    vim.notify(message, vim.log.levels.WARN, {
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
  local colors = require("NeoSolarized.colors")
  return colors[SCHEME_BACKGROUND]
end

function INIT_HL()
  local color = GET_COLOR()
  SET_HL(MERGE_TABLE(CURSOR_HILIGHT_OPTS, {
    CursorLine = { bg = color.fg1 },
    CursorLineNr = { fg = "#388bfd" },
    ["@variable"] = { fg = color.fg0 },
    Normal = { fg = color.fg0 },
    Comment = { fg = color.fg2 },
    LineNrAbove = { fg = color.fg1 },
    LineNr = { fg = color.fg1 },
    LineNrBelow = { fg = color.fg1 },
  }))
end

function TOGGLE_INLAY_HINT()
  vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled({}))
end

function IS_GPT_PROMPT_CHAT(bufnr)
  if not IS_PACKAGE_LOADED("gp") then
    return false
  end
  local ok, gp = pcall(require, "gp")
  if not ok then
    return false
  end
  local buf = bufnr or GET_CURRENT_BUFFER()
  local buffer_path = GET_BUFFER_PATH(buf)
  return gp.not_chat(buf, buffer_path) == nil
end

function NEW_PICKER(title, theme, results, opts)
  theme.entry_parser = opts.entry_parser
  local pickers = require("telescope.pickers")
  local finders = require("telescope.finders")
  local conf = require("telescope.config").values
  local actions = require("telescope.actions")
  local action_state = require("telescope.actions.state")

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
  local scrolloff = GET_OPT("scrolloff", { win = winnr })
  return win_height - 2 * scrolloff
end

function BUF_VALID(bufnr)
  return api.nvim_buf_is_valid(bufnr)
end

function GET_FILETYPE(bufnr)
  return vim.filetype.match({ buf = bufnr }) or vim.bo[bufnr].filetype
end

function GET_BUFFER_ID(winid)
  return api.nvim_win_get_buf(winid)
end

function IS_CURSOR_HIDE()
  return GET_HIGHLIGHT("Cursor", "blend") == 100
end

function LOOKUP_FILE_PATH(file_names, start_path, stop_dir)
  if not stop_dir then
    ---@diagnostic disable-next-line: undefined-field
    stop_dir = vim.uv.os_homedir()
  end

  if start_path and IS_FILE_PATH(start_path) then
    start_path = GET_DIR_PATH(start_path)
  else
    local start, is_dir = GET_CURRENT_BUFFER_PATH(true)
    start_path = start
    if not is_dir then
      start_path = GET_DIR_PATH(start_path)
    end
  end

  for _, file_name in ipairs(file_names) do
    local pathes = vim.fs.find(file_name, {
      upward = true,
      stop = stop_dir,
      path = start_path,
    })
    if #pathes > 0 then
      return pathes[1]
    end
  end
end

function GET_DIR_MATCH_PATTERNS(file_name_patterns, start_filepath)
  local util = require("lspconfig.util")
  local get_root = util.root_pattern(UNPACK(file_name_patterns))
  return get_root(start_filepath or GET_CURRENT_BUFFER_PATH(true))
end

function GET_WORKSPACE_PATH(start_filepath, no_git)
  local w_path = GET_DIR_MATCH_PATTERNS(PROJECT_PATTERNS, start_filepath)
  if not w_path then
    return no_git and CWD() or GET_GIT_PATH(start_filepath)
  end
  return w_path
end

function GET_GIT_PATH(start_filepath)
  local util = require("lspconfig.util")
  return util.find_git_ancestor(start_filepath or GET_CURRENT_BUFFER_PATH(true))
end

function GET_CURRENT_BUFFER_PATH(fallback)
  local buffer_path = GET_BUFFER_PATH(GET_CURRENT_BUFFER())
  if buffer_path ~= "" and not IS_FILE_PATH(buffer_path) then
    buffer_path = ""
  end
  if buffer_path == "" and fallback then
    return CWD(), true
  end
  return buffer_path, false
end

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
  return vim.fn.stridx(str, substr) ~= -1
end

function HAS_WILDCARD(str)
  return STRING_HAS(str, "[*?]")
end

local function string_to_pattern(str, fuzzy)
  if not HAS_WILDCARD(str) then
    return str
  end
  local pattern = str:gsub("%.", "%%."):gsub("%*", ".*")
  if fuzzy then
    return pattern
  end
  return "^" .. pattern .. "$"
end

function STRING_PATTERN_MATCHED(str, patterns, fuzzy)
  if type(patterns) == "string" then
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
  return vim.fn.expand("%")
end

function BIND_QUIT(bufnr)
  local option = { silent = true, buffer = bufnr }
  KEY_MAP("n", "q", vim.cmd.close, option)
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
    local is_file = is_new or IS_FILE_PATH(GET_BUFFER_PATH(bufnr))
    local is_in_list = GET_OPT("buflisted", { buf = bufnr })
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
  if not IS_FILE_PATH(buffer_path) then
    return false
  end

  local file_length = api.nvim_buf_line_count(bufnr)
  if not multiple then
    multiple = 1
  end
  if file_length > MAX_FILE_LENGTH * multiple then
    return true
  end

  ---@diagnostic disable-next-line: undefined-field
  local stats = vim.uv.fs_stat(buffer_path)
  if not stats then
    return false
  end

  return stats.size > 131072 -- 128 Kib
end

function CWD()
  ---@diagnostic disable-next-line: undefined-field
  return vim.uv.cwd()
end

function GET_HIDE_COLUMN_OPTS(status)
  local opt = {
    number = false,
    relativenumber = false,
    foldcolumn = "0",
    list = false,
    showbreak = "NONE",
  }
  if status then
    opt.statuscolumn = ""
  end
  return opt
end

function ADD_CMP_SOURCE(source, index)
  local has_cmp, cmp = pcall(require, "cmp")
  if not has_cmp then
    return
  end
  if index == nil then
    index = 1
  end
  local config = cmp.get_config()
  table.insert(config.sources, index, {
    group_index = 1,
    name = source,
    max_item_count = 3,
  })
  cmp.setup(config)
end
