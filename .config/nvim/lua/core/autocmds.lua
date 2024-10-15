local group = AUTOGROUP("_general_settings_", { clear = true })
local fn = vim.fn
local v = vim.v

local function remove_qf_normal()
  local start_index = fn.line(".")
  local count = v.count > 0 and v.count or 1
  return start_index, count
end

local function remove_qf_visual()
  local v_start_idx = fn.line("v")
  local v_end_idx = fn.line(".")

  local start_index = math.min(v_start_idx, v_end_idx)
  local count = math.abs(v_end_idx - v_start_idx) + 1
  FEED_KEYS("<esc>", "x")
  return start_index, count
end

local function remove_qf_item(is_normal)
  return function()
    local start_index
    local count
    if is_normal then
      start_index, count = remove_qf_normal()
    else
      start_index, count = remove_qf_visual()
    end
    local qflist = fn.getqflist()

    for _ = 1, count, 1 do
      table.remove(qflist, start_index)
    end

    fn.setqflist(qflist, "r")
    fn.cursor(start_index, 1)
  end
end

function is_empty_line(line)
  line = line:gsub("[\r\n]+$", "")
  return line == "" or line:match("^%s*$")
end

function get_lines_from_file(file, num)
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

function lines_tab_more_than_space(lines)
  local tab_num = 0
  local space_num = 0
  for _, line in ipairs(lines) do
    local empty = is_empty_line(line)
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

function get_lines_from_buf(bufnr, line_num)
  return vim.api.nvim_buf_get_lines(bufnr, 0, line_num, false)
end

local function is_indent_with_tab(params)
  local filepath = params.filepath
  local line_num = 50
  if filepath then
    local file = io.open(filepath, "r")
    if not file then
      return false
    end
    local lines = get_lines_from_file(file, line_num)
    local is_tab_indent = lines_tab_more_than_space(lines)
    file:close()
    return is_tab_indent
  end
  local bufnr = params.buf
  if not bufnr then
    bufnr = GET_CURRENT_BUFFER()
  end
  local lines = get_lines_from_buf(bufnr, line_num)
  return lines_tab_more_than_space(lines)
end

local function restore_position(bufnr)
  local ft = GET_FILETYPE(bufnr)
  local last_known_line = vim.api.nvim_buf_get_mark(bufnr, '"')[1]
  if
    not (ft:match("commit") and ft:match("rebase"))
    and last_known_line > 1
    and last_known_line <= vim.api.nvim_buf_line_count(bufnr)
  then
    FEED_KEYS([[g`"]], "nx")
  end
end

local function set_grug_far_fold_width(bufnr)
  local filetype = GET_FILETYPE(bufnr)
  if filetype ~= "grug-far" then
    return
  end
  SET_TIMEOUT(function()
    SET_OPT("foldcolumn", "2", { buf = bufnr })
  end, 10)
end

local filetype_to_runner = {
  [{
    "qf",
    "help",
    "man",
    "notify",
    "lspinfo",
    "DressingInput",
    "DressingSelect",
    "DiffviewFileHistory",
    "grug-far",
  }] = DEBOUNCE(function(event)
    local bufnr = event.buf
    set_grug_far_fold_width(bufnr)
    BIND_QUIT(bufnr)
  end, { delay = 2000 }),
  [{ "help", "gitconfig" }] = DEBOUNCE(function(event)
    SET_OPT("list", false, event)
  end),
  qf = DEBOUNCE(function(event)
    local opt = {
      buflisted = false,
      relativenumber = false,
    }
    SET_OPTS(opt, event)
    opt = { buffer = event.buf }
    KEY_MAP("n", "dd", remove_qf_item(true), opt)
    KEY_MAP("x", "d", remove_qf_item(), opt)
  end),
  [{
    "lazy",
    "DressingInput",
    "DressingSelect",
  }] = DEBOUNCE(function(event)
    SET_TIMEOUT(function()
      SET_OPT("wrap", true, event)
      if IS_CURSOR_HIDE() then
        SHOW_CURSOR()
      end
      if event.match == "lazy" then
        SET_OPT("cursorline", true, event)
      end
    end, 10)
  end),
  [{
    "markdown",
    "gitcommit",
    "NeogitCommitMessage",
    "Avante",
  }] = DEBOUNCE(function(event)
    local isAvante = "Avante" == event.match
    local buf = event.buf
    local isChat = IS_GPT_PROMPT_CHAT(buf)
    local opts = {
      wrap = true,
      tabstop = 2,
      softtabstop = 2,
      shiftwidth = 2,
    }
    SET_TIMEOUT(function()
      if isAvante or isChat then
        opts = MERGE_TABLE(opts, {
          number = false,
          relativenumber = false,
          statuscolumn = "",
          foldcolumn = "0",
          list = false,
          showbreak = "NONE",
        })
      end
      SET_OPTS(opts, event)
    end, 100)
  end),
  ["Neogit*"] = DEBOUNCE(function(event)
    SET_OPT("foldcolumn", "0", event)
  end),
}

local function close_alpha_when_open_file(bufnr)
  local buffer_path = GET_BUFFER_PATH(bufnr)
  local is_file = IS_FILE_PATH(buffer_path)
  if not ALPHA_BUF or not is_file then
    return
  end
  SET_TIMEOUT(function()
    if not BUF_VALID(ALPHA_BUF) then
      ALPHA_BUF = nil
      return
    end
    vim.api.nvim_buf_call(ALPHA_BUF, function()
      vim.cmd("Alpha")
      ALPHA_BUF = nil
    end)
  end, 10)
end

local function update_winbar(event)
  local bufnr = event.buf
  local is_new = event.event == "BufNewFile"
  local filetype = GET_FILETYPE(bufnr)
  local is_invalid = TABLE_CONTAINS(INVALID_FILETYPE, filetype)
  if not bufnr or is_invalid then
    return
  end
  local bar_path = GET_BUFFER_PATH(bufnr)
  local is_file = is_new or IS_FILE_PATH(bar_path)
  local is_chat = IS_GPT_PROMPT_CHAT(bufnr)
  if not is_file or is_chat then
    return
  end
  local postfix = vim.fn.systemlist("hostname")[1]
  if IS_LEETING then
    postfix = ""
  end
  BAR_PATH = bar_path
  SET_TIMEOUT(function()
    local winbar = "%#WinBar1#%m "
      .. "%#WinBar2#("
      .. #GET_ALL_BUFFERS(true)
      .. ") "
      .. "%#WinBar1#"
      .. bar_path:gsub(HOME_PATH, "~")
      .. "%*%=%#WinBar2#"
      .. string.lower(postfix)
    for _, win in ipairs(GET_WINDOWS_BY_BUF(bufnr)) do
      SET_OPT("winbar", winbar, { win = win })
    end
  end, 10)
end

SET_HL({
  WinBar1 = { fg = "#04d1f9", bg = "#1E2030" },
  WinBar2 = { fg = "#37f499", bg = "#1E2030" },
})

SET_AUTOCMDS({
  {
    "FileType",
    {
      pattern = vim.iter(vim.tbl_keys(filetype_to_runner)):flatten(1):totable(),
      group = group,
      callback = function(event)
        local filetype = GET_FILETYPE(event.buf)
        for filetypes, runner in pairs(filetype_to_runner) do
          local matched = STRING_PATTERN_MATCHED(filetype, filetypes)
          if matched then
            runner(event)
          end
        end
      end,
    },
  },
  {
    "TextYankPost",
    {
      callback = function()
        pcall(vim.highlight.on_yank, { higroup = "Visual", timeout = 200 })
      end,
      group = group,
    },
  },
  {
    { "BufEnter", "BufWinEnter", "BufNewFile" },
    {
      group = group,
      callback = DEBOUNCE(update_winbar, {
        omitter = function(_, key)
          return key == "event"
        end,
      }),
    },
  },
  {
    "BufWinEnter",
    {
      callback = function(event)
        local bufnr = event.buf
        if GET_OPT("buflisted", { buf = bufnr }) then
          return
        end
        local buffer_path = GET_BUFFER_PATH(bufnr)
        local is_file = IS_FILE_PATH(buffer_path)
        if not is_file then
          return
        end
        SET_OPT("buflisted", true, { buf = bufnr })
      end,
      group = group,
    },
  },
  {
    "VimResized",
    {
      command = "silent!tabdo wincmd =",
      group = AUTOGROUP("_auto_resize_", { clear = true }),
    },
  },
  {
    "BufReadPost",
    {
      group = AUTOGROUP("_indent_tab_", { clear = true }),
      callback = function(event)
        local expandtab = true
        local width = 2
        if is_indent_with_tab(event) then
          expandtab = false
          width = 4
        end
        vim.bo.expandtab = expandtab
        vim.bo.tabstop = width
        vim.bo.softtabstop = width
        vim.bo.shiftwidth = width
        local bufnr = event.buf
        close_alpha_when_open_file(bufnr)
        restore_position(bufnr)
      end,
    },
  },
  {
    "InsertEnter",
    {
      group = group,
      callback = function(event)
        SET_OPT("cursorline", false, event)
      end,
    },
  },
  {
    "InsertLeave",
    {
      group = group,
      callback = function(event)
        local filetype = GET_FILETYPE(event.buf)
        local exclude_filetype = TABLE_CONTAINS(INVALID_FILETYPE, filetype)
        if exclude_filetype then
          return
        end
        SET_OPT("cursorline", true, event)
      end,
    },
  },
})
