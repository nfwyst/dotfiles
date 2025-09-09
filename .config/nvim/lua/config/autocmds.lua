-- Autocmds are automatically loaded on the VeryLazy event
-- Default autocmds that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/autocmds.lua
--
-- Add any additional autocmds here
-- with `vim.api.nvim_create_autocmd`
--
-- Or remove existing autocmds by their group name (which is prefixed with `lazyvim_` for the defaults)
-- e.g. vim.api.nvim_del_augroup_by_name("lazyvim_wrap_spell")

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

local bufread_group = vim.api.nvim_create_augroup("vimade_active", { clear = true })
vim.api.nvim_create_autocmd({ "BufReadPost", "BufNewFile" }, {
  group = bufread_group,
  callback = function(event)
    if not package.loaded.vimade then
      return
    end

    local bufnr = event.buf
    local win = vim.fn.bufwinid(bufnr)
    if not vim.api.nvim_win_is_valid(win) then
      return
    end

    vim.api.nvim_win_call(win, function()
      pcall(vim.cmd.VimadeFadeActive)
    end)
  end,
})

local function center_buf(event)
  local buf = event.buf
  local buflisted = vim.api.nvim_get_option_value("buflisted", { buf = buf })
  if not buflisted then
    return
  end

  local readable = vim.fn.filereadable(vim.api.nvim_buf_get_name(buf))
  if not readable then
    return
  end

  local win = vim.fn.bufwinid(buf)
  if not vim.api.nvim_win_is_valid(win) then
    return
  end

  local pos = vim.api.nvim_win_get_cursor(win)
  local row = pos[1]
  local col = pos[2]

  if vim.b.last_line == nil then
    vim.b.last_line = row
  end

  if row ~= vim.b.last_line then
    local mode = vim.api.nvim_get_mode().mode

    local view = vim.fn.winsaveview()

    local winheight = vim.fn.winheight(win)
    local scroll_offset = math.floor(winheight / 3)
    local new_topline = math.max(1, row - scroll_offset)

    view.topline = new_topline
    vim.fn.winrestview(view)

    if mode:match("^i") then
      vim.api.nvim_win_set_cursor(win, { row, col })
    end

    vim.b.last_line = row
  end
end

local cursor_moved_group = vim.api.nvim_create_augroup("cursor_is_moved", { clear = true })
vim.api.nvim_create_autocmd({ "CursorMoved", "CursorMovedI" }, {
  group = cursor_moved_group,
  callback = center_buf,
})

local buffer_entered_group = vim.api.nvim_create_augroup("buffer_entered", { clear = true })
vim.api.nvim_create_autocmd("BufEnter", {
  group = buffer_entered_group,
  callback = center_buf,
})
