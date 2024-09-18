local group = AUTOGROUP("_general_settings_", { clear = true })
local fn = vim.fn
local v = vim.v
local cmd = vim.cmd

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

SET_AUTOCMDS({
  {
    "FileType",
    {
      pattern = {
        "qf",
        "help",
        "gitconfig",
        "man",
        "notify",
        "lspinfo",
        "DressingInput",
        "DressingSelect",
        "DiffviewFileHistory",
      },
      callback = function(event)
        local match = event.match
        if match ~= "gitconfig" then
          cmd.nnoremap("<silent> <buffer> q :close<cr>")
        end
        if match == "help" or match == "gitconfig" then
          SET_OPT("list", false, event.buf)
        end
      end,
      group = group,
    },
  },
  {
    "TextYankPost",
    {
      pattern = "*",
      callback = function()
        pcall(vim.highlight.on_yank, { higroup = "Visual", timeout = 200 })
      end,
      group = group,
    },
  },
  {
    "BufWinEnter",
    {
      pattern = "*",
      callback = function(event)
        local bufnr = event.buf
        if GET_BUFFER_OPT(bufnr, "buflisted") then
          return
        end
        local filename = GET_BUFFER_NAME(bufnr)
        local is_file = IS_FILE_PATH(filename)
        if not is_file then
          return
        end
        vim.opt_local.buflisted = true
      end,
      group = group,
    },
  },
  {
    "BufDelete",
    {
      pattern = "*",
      callback = function(event)
        local bufnr = event.buf
        TABLE_REMOVE_BY_VAL(BIGFILES, bufnr)
        TABLE_REMOVE_BY_KEY(BUFFER_OPENED_TIME, bufnr)
      end,
      group = group,
    },
  },
  {
    "FileType",
    {
      pattern = "qf",
      callback = function(event)
        local bufnr = event.buf
        SET_OPTS({
          buflisted = false,
          relativenumber = false,
        }, bufnr)
        local opt = { buffer = bufnr }
        KEY_MAP("n", "dd", remove_qf_item(true), opt)
        KEY_MAP("x", "d", remove_qf_item(), opt)
      end,
      group = group,
    },
  },
  {
    "FileType",
    {
      pattern = { "lazy", "DressingInput", "DressingSelect" },
      callback = function(event)
        SET_TIMEOUT(function()
          local ft = event.match
          local fts_no_cursorline = { "DressingSelect", "DressingInput" }
          local no_cursorline = TABLE_CONTAINS(fts_no_cursorline, ft)
          SET_OPT("wrap", true, event.buf)
          if IS_CURSOR_HIDE() then
            SHOW_CURSOR()
          end
          if no_cursorline then
            return
          end
          SET_OPT("cursorline", true, event.buf)
        end, 1)
      end,
      group = group,
    },
  },
  {
    "FileType",
    {
      pattern = {
        "markdown",
        "gitcommit",
        "NeogitCommitMessage",
        "Avante",
      },
      callback = function(event)
        local isAvante = "Avante" == event.match
        SET_TIMEOUT(function()
          local bufnr = event.buf
          local opts = {
            wrap = true,
            tabstop = 2,
            softtabstop = 2,
            shiftwidth = 2,
          }
          if isAvante or IS_GPT_PROMPT_CHAT(bufnr) then
            opts = MERGE_TABLE(opts, {
              number = false,
              relativenumber = false,
              statuscolumn = "",
              foldcolumn = "0",
              list = false,
              showbreak = "NONE",
            })
          end
          SET_OPTS(opts, bufnr)
        end, 100)
      end,
      group = AUTOGROUP("_markdown_git_", { clear = true }),
    },
  },
  {
    "FileType",
    {
      pattern = "Neogit*",
      callback = function(event)
        SET_OPT("foldcolumn", "0", event.buf)
      end,
    },
  },
  {
    "VimResized",
    {
      pattern = "*",
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
      end,
    },
  },
  {
    "InsertEnter",
    {
      pattern = "*",
      group = group,
      callback = function(event)
        SET_OPT("cursorline", false, event.buf)
      end,
    },
  },
  {
    "InsertLeave",
    {
      pattern = "*",
      group = group,
      callback = function(event)
        SET_OPT(
          "cursorline",
          not TABLE_CONTAINS(INVALID_FILETYPE, vim.bo.filetype),
          event.buf
        )
      end,
    },
  },
})
