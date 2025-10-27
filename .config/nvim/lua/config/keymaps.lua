-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here
local util = require("config.util")

local function get_resizer(is_increase, is_vertical)
  return function()
    local delta = is_increase and "+2" or "-2"
    local command = "resize " .. delta
    if is_vertical then
      command = "vertical " .. command
    end

    vim.cmd(command)
  end
end

local function toggle_mark()
  local char_code = vim.fn.getchar()
  if char_code == 0 then
    return
  end

  if type(char_code) ~= "number" then
    return
  end

  local char = vim.fn.nr2char(char_code)
  if not char:match("^[a-zA-Z]$") then
    return vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("m" .. char, true, true, true), "n", false)
  end

  local mark = vim.fn.getpos("'" .. char)
  local buf = mark[1]
  local bufnr = vim.api.nvim_get_current_buf()
  if buf == 0 then
    buf = bufnr
  end

  local mark_row = mark[2]
  local row = vim.api.nvim_win_get_cursor(vim.api.nvim_get_current_win())[1]
  if buf == bufnr and mark_row == row then
    return vim.cmd.delmarks(char)
  end

  vim.cmd.normal({ "m" .. char, bang = true })
end

local keymaps = {
  n = {
    { from = "<s-j>", to = "<cmd>execute 'move .+' . v:count1<cr>==" },
    { from = "<s-k>", to = "<cmd>execute 'move .-' . (v:count1 + 1)<cr>==" },
    { from = "<leader>Q", to = "<cmd>quit<cr>", opt = {
      desc = "Quit",
    } },
    { from = "<leader>qf", to = "<cmd>ccl<cr>", opt = {
      desc = "Quit Quickfix List",
    } },
    { from = "<s-up>", to = get_resizer(true), opt = { desc = "Increase Window Height" } },
    { from = "<s-down>", to = get_resizer(false), opt = { desc = "Decrease Window Height" } },
    { from = "<s-left>", to = get_resizer(true, true), opt = { desc = "Increase Window Width" } },
    { from = "<s-right>", to = get_resizer(false, true), opt = { desc = "Decrease Window Width" } },
    { from = "<leader>o", to = ":update<cr> :source<cr>" },
  },
  [{ "n", "x", "s" }] = {
    { from = "<leader>i", to = "<cmd>w<cr>", opt = { desc = "Save File" } },
    { from = "<leader>I", to = "<cmd>wall<cr>", opt = { desc = "Save All" } },
    { from = "<leader>X", to = "<cmd>xall<cr>", opt = { desc = "Save And Quit" } },
    { from = "m", to = toggle_mark },
  },
  [{ "v", "x" }] = {
    { from = "<s-j>", to = ":<C-u>execute \"'<,'>move '>+\" . v:count1<cr>gv=gv" },
    { from = "<s-k>", to = ":<C-u>execute \"'<,'>move '<-\" . (v:count1 + 1)<cr>gv=gv" },
  },
  [{ "n", "v" }] = {
    {
      from = "<leader>cf",
      to = function()
        local name = ".prettierrc.json"
        if vim.api.nvim_get_option_value("shiftwidth", { buf = vim.api.nvim_get_current_buf() }) == 4 then
          name = ".prettierrc_tab.json"
        end
        vim.env.PRETTIERD_DEFAULT_CONFIG = vim.fn.expand("~") .. "/.config/" .. name

        LazyVim.format({ force = true })
      end,
      opt = { desc = "Format" },
    },
  },
  [{ "i" }] = {
    {
      from = "jk",
      to = function()
        vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("<esc>", true, true, true), "n", false)
      end,
    },
  },
}

local keys_to_delete = {
  [{ "n", "v" }] = { "<leader>cf" },
  n = { "grn", "grr", "gri", "gra", "grt" },
}

local function set(mode, lhs, rhs, opts)
  opts = opts or {}
  vim.keymap.set(mode, lhs, rhs, vim.tbl_extend("force", opts, { silent = true, noremap = true }))
end

vim.api.nvim_create_autocmd("User", {
  pattern = "LazyVimKeymaps",
  group = vim.api.nvim_create_augroup("is_lazyvim_keymap_done", { clear = true }),
  once = true,
  callback = function()
    for mode, keys in pairs(keys_to_delete) do
      for _, key in ipairs(keys) do
        pcall(vim.keymap.del, mode, key)
      end
    end

    for mode, maps in pairs(keymaps) do
      for _, map in ipairs(maps) do
        set(mode, map.from, map.to, map.opt)
      end
    end
  end,
})

local function remove_qf_normal(row)
  local start_index = row
  local count = vim.v.count > 0 and vim.v.count or 1
  return start_index, count
end

local function remove_qf_visual(row)
  local v_start_idx = vim.fn.line("v")
  local v_end_idx = row

  local start_index = math.min(v_start_idx, v_end_idx)
  local count = math.abs(v_end_idx - v_start_idx) + 1
  vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("<esc>", true, true, true), "x", false)
  return start_index, count
end

local function remove_qf_item(is_normal)
  return function(qflist, qfwin, pos)
    local start_index
    local count
    if is_normal then
      start_index, count = remove_qf_normal(pos[1])
    else
      start_index, count = remove_qf_visual(pos[1])
    end

    for _ = 1, count, 1 do
      table.remove(qflist, start_index)
    end

    vim.fn.setqflist(qflist, "r")
    if vim.tbl_isempty(qflist) then
      return vim.cmd.ccl()
    end

    vim.api.nvim_win_set_cursor(qfwin, { math.min(start_index, #qflist), pos[2] })
  end
end

local qfkeymaps = {
  n = {
    {
      from = "<cr>",
      to = function(qflist, qfwin, pos)
        local entry = qflist[pos[1]]
        if not entry or entry.valid ~= 1 then
          return
        end
        -- open file
        vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("<cr>", true, true, true), "n", false)
        -- ensure quickfix window in right location
        vim.schedule(function()
          local win = vim.fn.bufwinid(entry.bufnr)
          if vim.api.nvim_win_is_valid(win) then
            vim.api.nvim_win_set_cursor(qfwin, pos)
          end
        end)
      end,
    },
    {
      from = "dd",
      to = remove_qf_item(true),
    },
  },
  [{ "n", "v" }] = {
    {
      from = "d",
      to = remove_qf_item(),
    },
  },
}

vim.api.nvim_create_autocmd("FileType", {
  pattern = "qf",
  group = vim.api.nvim_create_augroup("is_filetype_qf", { clear = true }),
  callback = function(event)
    local bufnr = event.buf
    local qfwin = vim.fn.bufwinid(bufnr)
    for mode, maps in pairs(qfkeymaps) do
      for _, map in ipairs(maps) do
        set(mode, map.from, function()
          local qflist = vim.fn.getqflist()
          local pos = vim.api.nvim_win_get_cursor(qfwin)
          map.to(qflist, qfwin, pos)
        end, { buffer = bufnr })
      end
    end
  end,
})

-- command for creating code snippets in json
vim.api.nvim_create_user_command("AddQuotes", util.format_snippet_json, { range = true })
vim.api.nvim_create_autocmd("FileType", {
  pattern = "json",
  group = vim.api.nvim_create_augroup("is_filetype_json", { clear = true }),
  callback = function(event)
    local bufnr = event.buf
    set("v", '<leader>"', ":AddQuotes<cr>", { buffer = bufnr, desc = "Add Multiple Line Quotes" })
  end,
})
