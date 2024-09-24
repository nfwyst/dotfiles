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
    "spectre_panel",
  }] = function(event)
    local option = { silent = true, buffer = event.buf }
    KEY_MAP("n", "q", vim.cmd.close, option)
  end,
  [{ "help", "gitconfig" }] = function(event)
    SET_OPT("list", false, event)
  end,
  qf = function(event)
    local opt = {
      buflisted = false,
      relativenumber = false,
    }
    SET_OPTS(opt, event)
    opt = { buffer = event.buf }
    KEY_MAP("n", "dd", remove_qf_item(true), opt)
    KEY_MAP("x", "d", remove_qf_item(), opt)
  end,
  [{
    "lazy",
    "DressingInput",
    "DressingSelect",
  }] = function(event)
    SET_TIMEOUT(function()
      SET_OPT("wrap", true, event)
      if IS_CURSOR_HIDE() then
        SHOW_CURSOR()
      end
      if event.match == "lazy" then
        SET_OPT("cursorline", true, event)
      end
    end, 10)
  end,
  [{
    "markdown",
    "gitcommit",
    "NeogitCommitMessage",
    "Avante",
  }] = function(event)
    local isAvante = "Avante" == event.match
    local isChat = IS_GPT_PROMPT_CHAT(event.buf)
    SET_TIMEOUT(function()
      local opts = {
        wrap = true,
        tabstop = 2,
        softtabstop = 2,
        shiftwidth = 2,
      }
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
  end,
  ["Neogit*"] = function(event)
    SET_OPT("foldcolumn", "0", event)
  end,
}

local function close_alpha_when_open_file(event)
  local buffer_path = GET_BUFFER_PATH(event.buf)
  if not ALPHA_BUF or not IS_FILE_PATH(buffer_path) then
    return
  end
  if not vim.api.nvim_buf_is_valid(ALPHA_BUF) then
    ALPHA_BUF = nil
    return
  end
  SET_TIMEOUT(function()
    vim.api.nvim_buf_call(ALPHA_BUF, function()
      vim.cmd("Alpha")
      ALPHA_BUF = nil
    end)
  end, 10)
end

SET_AUTOCMDS({
  {
    "FileType",
    {
      pattern = vim.iter(vim.tbl_keys(filetype_to_runner)):flatten(1):totable(),
      group = group,
      callback = function(event)
        local filetype = GET_FILETYPE(event.buf)
        for filetypes, runner in pairs(filetype_to_runner) do
          local is_table = type(filetypes) == "table"
          local equal = filetypes == filetype
          local contain = is_table and TABLE_CONTAINS(filetypes, filetype)
          if equal or contain then
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
    "BufDelete",
    {
      callback = function(event)
        local bufnr = event.buf
        TABLE_REMOVE_BY_VAL(BIGFILES, bufnr)
        TABLE_REMOVE_BY_KEY(BUFFER_OPENED_TIME, bufnr)
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
        if IS_INDENT_WITH_TAB(event) then
          expandtab = false
          width = 4
        end
        vim.bo.expandtab = expandtab
        vim.bo.tabstop = width
        vim.bo.softtabstop = width
        vim.bo.shiftwidth = width
        close_alpha_when_open_file(event)
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
