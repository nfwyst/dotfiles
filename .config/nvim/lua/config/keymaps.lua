-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here
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
    {
      from = "zz",
      to = function()
        return "zt" .. math.floor(vim.fn.winheight(0) / 4) .. "<c-y>"
      end,
      opt = { expr = true },
    },
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
  n = { "gc", "grn", "grr", "gri", "gra", "grt" },
}

vim.api.nvim_create_autocmd("User", {
  pattern = "LazyVimKeymaps",
  once = true,
  callback = function()
    for mode, keys in pairs(keys_to_delete) do
      for _, key in ipairs(keys) do
        pcall(vim.keymap.del, mode, key)
      end
    end

    for mode, maps in pairs(keymaps) do
      for _, map in ipairs(maps) do
        map.opt = map.opt or {}
        map.opt.silent = true
        map.opt.noremap = true
        vim.keymap.set(mode, map.from, map.to, map.opt)
      end
    end
  end,
})
