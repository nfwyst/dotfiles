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
    local is_number = type(key) == "number"
    if ok then
      if is_number then
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

function GET_MAX_WIDTH(offset)
  offset = offset or 20
  local width = GET_EDITOR_WIDTH() - offset
  return width > 0 and width or -width
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
  for _, win in ipairs(vim.api.nvim_list_wins()) do
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
  local setter = api.nvim_set_option_value
  function set_opt_for_win(bufnr)
    for _, win in ipairs(GET_WINDOWS_BY_BUF(bufnr)) do
      setter(k, v, { win = win })
    end
  end
  local buf = config.buf
  local win = config.win
  if win then
    setter(k, v, { win = win })
    return
  end
  if not buf then
    return
  end
  local ok, _ = pcall(function()
    setter(k, v, { buf = buf })
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

function GET_PROJECT_NAME()
  local cached_index = nil
  return function()
    local ok, util = pcall(require, "lspconfig.util")
    if not ok then
      LOG_ERROR("pcall error", util)
      return
    end
    local bf_ok, bufferline = pcall(require, "bufferline")
    if not bf_ok then
      LOG_ERROR("pcall error", bufferline)
      return
    end
    local lazy = require("bufferline.lazy")
    local state = lazy.require("bufferline.state")
    local commands = lazy.require("bufferline.commands")
    local current_index = commands.get_current_element_index(state)
    if current_index == nil then
      current_index = cached_index
    else
      cached_index = current_index
    end
    local current_element = bufferline.get_elements().elements[current_index]
    local basename = vim.fs.basename
    if current_element == nil then
      local find = false
      local bufs = api.nvim_list_bufs()
      for _, bufnr in ipairs(bufs) do
        local buffer_path = GET_BUFFER_PATH(bufnr)
        if IS_FILE_PATH(buffer_path) then
          current_element = { path = buffer_path }
          find = true
          break
        end
      end
      if not find then
        return "文件浏览器"
      end
    end
    ---@diagnostic disable-next-line: need-check-nil
    local current_file_path = current_element.path
    local name = basename(GET_WORKSPACE_PATH(current_file_path))
    local repo_name = basename(GET_GIT_PATH(current_file_path))
    return name ~= repo_name and name or "文件浏览器"
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
  return api.nvim_buf_get_name(bufnr)
end

function GET_OPT(optname, config)
  if not config then
    return vim.o[optname]
  end
  return api.nvim_get_option_value(optname, config)
end

function RUN_CMD(command, check)
  if check and vim.fn.exists(":" .. command) == 0 then
    return
  end
  PCALL(vim.cmd, command)
end

function SET_TIMEOUT(func, timeout)
  vim.defer_fn(func, timeout or 0)
end

function IS_FILE_PATH(path)
  local Path = require("plenary.path")
  return Path:new(path):is_file()
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

function OPEN_LINK_OR_FILE(uri)
  vim.fn.system({ "open", uri })
end

function IS_GPT_PROMPT_CHAT(bufnr)
  local ok, gp = pcall(require, "gp")
  if not ok then
    return false
  end
  local buf = bufnr or GET_CURRENT_BUFFER()
  local buffer_path = GET_BUFFER_PATH(buf)
  return gp.not_chat(buf, buffer_path) == nil
end

function GET_CURRENT_MODE()
  return string.lower(vim.fn.mode())
end

function GET_FILES_FROM_PATH(path, num)
  local files = {}
  local handle = io.popen("ls -a " .. path)
  if not handle then
    return files
  end

  for _ = 1, num do
    local file = handle:read("*l")
    if not file then
      handle:close()
      return files
    end
    table.insert(files, file)
  end

  handle:close()
  return files
end

function IS_EMPTY_LINE(line)
  line = line:gsub("[\r\n]+$", "")
  return line == "" or line:match("^%s*$")
end

function GET_LINES_FROM_BUF(bufnr, line_num)
  return api.nvim_buf_get_lines(bufnr, 0, line_num, false)
end

function LINES_TAB_MORE_THAN_SPACE(lines)
  local tab_num = 0
  local space_num = 0
  for _, line in ipairs(lines) do
    local empty = IS_EMPTY_LINE(line)
    local start_with_tab = line:match("^\t")
    if not empty and start_with_tab then
      tab_num = tab_num + 1
    end
    if not empty and not start_with_tab and line:match("^%s") then
      space_num = space_num + 1
    end
  end
  return tab_num > space_num
end

function GET_LINES_FROM_FILE(file, num)
  local lines = {}
  for _ = 1, num do
    local line = file:read("*l")
    if not line then
      return lines
    end
    table.insert(lines, line)
  end
  return lines
end

function IS_INDENT_WITH_TAB(params)
  local filepath = params.filepath
  local line_num = 50
  if filepath then
    local file = io.open(filepath, "r")
    if not file then
      return false
    end
    local lines = GET_LINES_FROM_FILE(file, line_num)
    local is_tab_indent = LINES_TAB_MORE_THAN_SPACE(lines)
    file:close()
    return is_tab_indent
  end
  local bufnr = params.buf
  if not bufnr then
    bufnr = GET_CURRENT_BUFFER()
  end
  local lines = GET_LINES_FROM_BUF(bufnr, line_num)
  return LINES_TAB_MORE_THAN_SPACE(lines)
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

function HIGHLIGHT_ROW(bufnr, row)
  local hl_group = "CursorLine"
  vim.api.nvim_buf_add_highlight(bufnr, -1, hl_group, row - 1, 0, -1)
end

function GET_VIEWPORT_HEIGHT(winnr)
  local win_height = vim.api.nvim_win_get_height(winnr)
  local scrolloff = GET_OPT("scrolloff", { win = winnr })
  return win_height - 2 * scrolloff
end

function GET_FILETYPE(bufnr)
  return vim.filetype.match({ buf = bufnr }) or vim.bo[bufnr].filetype
end

function GET_BUFFER_ID(winid)
  return vim.api.nvim_win_get_buf(winid)
end

function IS_CURSOR_HIDE()
  return GET_HIGHLIGHT("Cursor", "blend") == 100
end

function LOOKUP_FILE_PATH(file_names, start_filepath)
  local dirname = vim.fs.dirname
  for _, file_name in ipairs(file_names) do
    local pathes = vim.fs.find(file_name, {
      upward = true,
      ---@diagnostic disable-next-line: undefined-field
      stop = dirname(vim.uv.os_homedir()),
      path = dirname(start_filepath or GET_CURRENT_BUFFER_PATH()),
    })
    if #pathes > 0 then
      return pathes[1]
    end
  end
end

function GET_DIR_MATCH_PATTERNS(file_name_patterns, start_filepath)
  local util = require("lspconfig.util")
  local get_root = util.root_pattern(UNPACK(file_name_patterns))
  return get_root(start_filepath or GET_CURRENT_BUFFER_PATH())
end

function GET_WORKSPACE_PATH(start_filepath)
  return GET_DIR_MATCH_PATTERNS(PROJECT_PATTERNS, start_filepath)
end

function GET_GIT_PATH(start_filepath)
  local util = require("lspconfig.util")
  if not start_filepath then
    ---@diagnostic disable-next-line: undefined-field
    return vim.uv.cwd()
  end
  return util.find_git_ancestor(start_filepath)
end

function GET_CURRENT_BUFFER_PATH()
  return GET_BUFFER_PATH(GET_CURRENT_BUFFER())
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

function TIP(message, timeout)
  local editor_width = GET_EDITOR_WIDTH()
  local max_width = math.floor(editor_width * 0.3)
  local lines = SPLIT_STRING_BY_LEN(message, max_width)

  local win_width = math.min(max_width, #message)
  local win_height = #lines

  local row = math.floor((GET_EDITOR_HEIGHT() - win_height) / 2)
  local col = math.floor((editor_width - win_width) / 2)

  local buf = api.nvim_create_buf(false, true)
  local win = api.nvim_open_win(buf, false, {
    relative = "editor",
    width = win_width,
    height = win_height,
    row = row,
    col = col,
    style = "minimal",
    border = "rounded",
  })
  api.nvim_buf_set_lines(buf, 0, -1, false, lines)

  SET_OPTS({
    winhl = "Normal:Normal,FloatBorder:TelescopeBorder",
    cursorline = false,
  }, { win = win })

  SET_TIMEOUT(function()
    api.nvim_win_close(win, true)
  end, timeout or 1000)
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

function STRING_TO_PATTERN(str)
  return "^" .. str:gsub("%.", "%%."):gsub("%*", ".*") .. "$"
end

function STRING_PATTERN_MATCHED(str, patterns)
  if type(patterns) == "string" then
    return string.match(str, patterns)
  end
  for _, pattern in ipairs(patterns) do
    if string.match(str, pattern) then
      return true
    end
  end
  return false
end
