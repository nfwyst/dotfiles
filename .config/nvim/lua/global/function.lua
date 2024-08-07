local cmd = vim.api.nvim_create_user_command
local cursor = vim.opt.guicursor

function MERGE_TABLE(...)
  return vim.tbl_deep_extend("force", ...)
end

function FILTER_TABLE(table, filter)
  local tb = {}
  for key, value in pairs(table) do
    local ok = filter(value, key)
    if ok then
      tb[key] = value
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
    local is_table = type(sign) == "table"
    if is_table then
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
  cmd(name, func, {})
end

function SET_HL(table)
  for group, value in pairs(table) do
    if value.force == nil then
      value.force = true
    end
    local old_value = GET_HL(group)
    vim.api.nvim_set_hl(0, group, MERGE_TABLE(old_value, value))
  end
end

function GET_HL(name)
  return vim.api.nvim_get_hl(0, { name = name })
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

function SET_BUF_KEY_MAPS(table)
  for mode, maps in pairs(table) do
    for _, v in ipairs(maps) do
      BUF_KEY_MAP(mode, v.lhs, v.rhs, v.opts)
    end
  end
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
  local win_width = vim.fn.winwidth(0)
  local width = win_width - offset
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

function BUF_KEY_MAP(mode, lhs, rhs, opts, bufnr)
  local has_key = key_exists(mode, lhs)
  if has_key then
    return
  end
  opts = opts or {}
  local silent = opts.silent ~= false
  opts = MERGE_TABLE({ noremap = true, silent = silent }, opts)
  vim.api.nvim_buf_set_keymap(bufnr or 0, mode, lhs, rhs, opts)
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

function SET_OPTS(opts, is_local)
  for k, v in pairs(opts) do
    if is_local then
      vim.opt_local[k] = v
    else
      vim.opt[k] = v
    end
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
  local get_root = util.root_pattern(UNPACK(PROJECT_PATTERNS))
  WORKSPACE_PATH = get_root(GET_CURRENT_FILE_PATH(true)) or vim.loop.cwd()
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
      local bufs = vim.api.nvim_list_bufs()
      for _, bufnr in ipairs(bufs) do
        local path_name = vim.api.nvim_buf_get_name(bufnr)
        if IS_FILE_URI(path_name) then
          current_element = { path = path_name }
          find = true
          break
        end
      end
      if not find then
        return "文件浏览器"
      end
    end
    local current_file_path = current_element.path
    local get_pattern = util.root_pattern(UNPACK(PROJECT_PATTERNS))
    local name = basename(get_pattern(current_file_path))
    local repo_name = basename(vim.loop.cwd())
    return name ~= repo_name and name or "文件浏览器"
  end
end

function UNPACK(table)
  local up = table.unpack or unpack
  return up(table)
end

function IS_ABSOLUTE_PATH(path)
  return string.sub(path, 1, 1) == OS_SEP
end

function SET_AUTOCMDS(list)
  for _, item in ipairs(list) do
    local event = item[1]
    local defs = item[2]
    AUTOCMD(event, defs)
  end
end

function SET_COLORSCHEME(scheme)
  if scheme ~= DEFAULT_COLORSCHEME then
    return
  end
  vim.cmd.colorscheme(DEFAULT_COLORSCHEME)
end

function GET_CURRENT_BUFFER()
  return vim.api.nvim_get_current_buf()
end

function IS_PACKAGE_LOADED(pkg)
  return not not package.loaded[pkg]
end

function GET_CURRENT_FILE_PATH(absolute)
  return vim.fn.expand(absolute and "%:p" or "%")
end

function SAVE(force)
  local bang = force ~= nil and force ~= false
  local filename = GET_CURRENT_FILE_PATH(true)
  if filename == "" then
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
  vim.cmd.quit({ bang = force ~= nil and force ~= false })
end

function SAVE_THEN_QUIT(force)
  vim.cmd.wa({ bang = force ~= nil and force ~= false })
  QUIT(force)
end

function GET_BUFFER_NAME(bufnr)
  return vim.api.nvim_buf_get_name(bufnr)
end

function GET_BUFFER_OPT(bufnr, optname)
  return vim.api.nvim_buf_get_option(bufnr, optname)
end

function STR_INCLUDES(str, pattern, init, plain)
  return string.find(str, pattern, init, plain) ~= nil
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

function IS_FILE_URI(path)
  if type(path) ~= "string" then
    return false
  end

  if not path:match("^[/\\]") then
    return false
  end

  if path:match("[*?<>|]") then
    return false
  end

  local f = io.open(path, "r")
  if f ~= nil then
    io.close(f)
    return true
  else
    return false
  end
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
  local illuminate = { bg = "#B2D4FC", fg = "#4d2b03", bold = true }
  SET_HL(MERGE_TABLE(CURSOR_HILIGHT_OPTS, {
    CursorLine = { bg = color.fg1 },
    CursorLineNr = { fg = "#388bfd" },
    ["@variable"] = { fg = color.fg0 },
    Normal = { fg = color.fg0 },
    Comment = { fg = color.fg2 },
    LineNrAbove = { fg = color.fg1 },
    LineNr = { fg = color.fg1 },
    LineNrBelow = { fg = color.fg1 },
    IlluminatedWord = illuminate,
    IlluminatedCurWord = illuminate,
    IlluminatedWordText = illuminate,
    IlluminatedWordRead = illuminate,
    IlluminatedWordWrite = illuminate,
    NvimTreeIndentMarker = { fg = color.green },
  }))
end

function TOGGLE_INLAY_HINT()
  vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled({}))
end

function OPEN_LINK_OR_FILE(uri)
  vim.fn.system({ "open", uri })
end
