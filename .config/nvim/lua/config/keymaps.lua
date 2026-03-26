-- Keymaps (LazyVim defaults + custom keymaps)
local util = require("config.util")
local map = vim.keymap.set

local function set(mode, lhs, rhs, opts)
  opts = opts or {}
  vim.keymap.set(mode, lhs, rhs, vim.tbl_extend("force", { silent = true, noremap = true }, opts))
end

-- ===================================================================
-- LazyVim default keymaps
-- ===================================================================

-- Better up/down
map({ "n", "x" }, "j", "v:count == 0 ? 'gj' : 'j'", { desc = "Down", expr = true, silent = true })
map({ "n", "x" }, "k", "v:count == 0 ? 'gk' : 'k'", { desc = "Up", expr = true, silent = true })
map({ "n", "x" }, "<Down>", "v:count == 0 ? 'gj' : 'j'", { desc = "Down", expr = true, silent = true })
map({ "n", "x" }, "<Up>", "v:count == 0 ? 'gk' : 'k'", { desc = "Up", expr = true, silent = true })

-- Move to window using <ctrl> hjkl
map("n", "<C-h>", "<C-w>h", { desc = "Go to Left Window", remap = true })
map("n", "<C-j>", "<C-w>j", { desc = "Go to Lower Window", remap = true })
map("n", "<C-k>", "<C-w>k", { desc = "Go to Upper Window", remap = true })
map("n", "<C-l>", "<C-w>l", { desc = "Go to Right Window", remap = true })

-- Buffers
map("n", "<S-h>", "<cmd>BufferLineCyclePrev<cr>", { desc = "Prev Buffer" })
map("n", "<S-l>", "<cmd>BufferLineCycleNext<cr>", { desc = "Next Buffer" })
map("n", "[b", "<cmd>bprevious<cr>", { desc = "Prev Buffer" })
map("n", "]b", "<cmd>bnext<cr>", { desc = "Next Buffer" })
map("n", "<leader>bb", "<cmd>e #<cr>", { desc = "Switch to Other Buffer" })
map("n", "<leader>`", "<cmd>e #<cr>", { desc = "Switch to Other Buffer" })
map("n", "<leader>bd", function() Snacks.bufdelete() end, { desc = "Delete Buffer" })
map("n", "<leader>bo", function() Snacks.bufdelete.other() end, { desc = "Delete Other Buffers" })
map("n", "<leader>bD", "<cmd>:bd<cr>", { desc = "Delete Buffer and Window" })

-- Clear search with <esc>
map({ "i", "n", "s" }, "<esc>", "<cmd>noh<cr><esc>", { desc = "Escape and Clear hlsearch" })

-- Clear search, diff update and redraw
map("n", "<leader>ur", "<Cmd>nohlsearch<Bar>diffupdate<Bar>normal! <C-L><CR>", { desc = "Redraw / Clear hlsearch / Diff Update" })

-- Search
map("n", "n", "'Nn'[v:searchforward].'zv'", { expr = true, desc = "Next Search Result" })
map({ "x", "o" }, "n", "'Nn'[v:searchforward]", { expr = true, desc = "Next Search Result" })
map("n", "N", "'nN'[v:searchforward].'zv'", { expr = true, desc = "Prev Search Result" })
map({ "x", "o" }, "N", "'nN'[v:searchforward]", { expr = true, desc = "Prev Search Result" })

-- Save file
map({ "i", "x", "n", "s" }, "<C-s>", "<cmd>w<cr><esc>", { desc = "Save File" })

-- Undo break-points
map("i", ",", ",<c-g>u")
map("i", ".", ".<c-g>u")
map("i", ";", ";<c-g>u")

-- Better indenting
map("v", "<", "<gv")
map("v", ">", ">gv")

-- New file
map("n", "<leader>fn", "<cmd>enew<cr>", { desc = "New File" })

-- Diagnostics/Quickfix
map("n", "<leader>xl", "<cmd>lopen<cr>", { desc = "Location List" })
map("n", "<leader>xq", "<cmd>copen<cr>", { desc = "Quickfix List" })
map("n", "[q", function()
  if require("trouble").is_open() then
    require("trouble").prev({ skip_groups = true, jump = true })
  else
    local ok, err = pcall(vim.cmd.cprev)
    if not ok then vim.notify(err, vim.log.levels.ERROR) end
  end
end, { desc = "Previous Trouble/Quickfix Item" })
map("n", "]q", function()
  if require("trouble").is_open() then
    require("trouble").next({ skip_groups = true, jump = true })
  else
    local ok, err = pcall(vim.cmd.cnext)
    if not ok then vim.notify(err, vim.log.levels.ERROR) end
  end
end, { desc = "Next Trouble/Quickfix Item" })

-- Diagnostic navigation (Neovim 0.12+ API)
local diagnostic_goto = function(count, severity)
  severity = severity and vim.diagnostic.severity[severity] or nil
  return function()
    vim.diagnostic.jump({ count = count, float = true, severity = severity })
  end
end
map("n", "]d", diagnostic_goto(1), { desc = "Next Diagnostic" })
map("n", "[d", diagnostic_goto(-1), { desc = "Prev Diagnostic" })
map("n", "]e", diagnostic_goto(1, "ERROR"), { desc = "Next Error" })
map("n", "[e", diagnostic_goto(-1, "ERROR"), { desc = "Prev Error" })
map("n", "]w", diagnostic_goto(1, "WARN"), { desc = "Next Warning" })
map("n", "[w", diagnostic_goto(-1, "WARN"), { desc = "Prev Warning" })

-- Toggle options
map("n", "<leader>uf", function()
  vim.g.autoformat = not vim.g.autoformat
  vim.notify("Autoformat " .. (vim.g.autoformat and "enabled" or "disabled"))
end, { desc = "Toggle Auto Format (Global)" })
map("n", "<leader>us", function() vim.wo.spell = not vim.wo.spell end, { desc = "Toggle Spelling" })
map("n", "<leader>uw", function() vim.wo.wrap = not vim.wo.wrap end, { desc = "Toggle Word Wrap" })
map("n", "<leader>uL", function()
  vim.wo.relativenumber = not vim.wo.relativenumber
end, { desc = "Toggle Relative Line Numbers" })
map("n", "<leader>ul", function()
  vim.wo.number = not vim.wo.number
end, { desc = "Toggle Line Numbers" })
map("n", "<leader>ud", function()
  vim.diagnostic.enable(not vim.diagnostic.is_enabled())
  vim.notify("Diagnostics " .. (vim.diagnostic.is_enabled() and "enabled" or "disabled"))
end, { desc = "Toggle Diagnostics" })
map("n", "<leader>uc", function()
  local cl = vim.wo.conceallevel
  vim.wo.conceallevel = cl > 0 and 0 or 3
end, { desc = "Toggle Conceal" })
map("n", "<leader>uT", function()
  if vim.b.ts_highlight then
    vim.treesitter.stop()
  else
    vim.treesitter.start()
  end
end, { desc = "Toggle Treesitter Highlight" })
map("n", "<leader>ub", function()
  local bg = vim.o.background == "dark" and "light" or "dark"
  vim.o.background = bg
end, { desc = "Toggle Background" })
map("n", "<leader>uF", function()
  vim.b.autoformat = not vim.b.autoformat
  vim.notify("Autoformat (buffer) " .. (vim.b.autoformat ~= false and "enabled" or "disabled"))
end, { desc = "Toggle Auto Format (Buffer)" })
map("n", "<leader>uA", function()
  local v = vim.o.showtabline == 0 and 2 or 0
  vim.o.showtabline = v
end, { desc = "Toggle Tabline" })
map("n", "<leader>uD", function() Snacks.dim() end, { desc = "Toggle Dim" })
map("n", "<leader>ua", function() Snacks.toggle.animate():toggle() end, { desc = "Toggle Animate" })
map("n", "<leader>ug", function() Snacks.toggle.indent():toggle() end, { desc = "Toggle Indent Guides" })
map("n", "<leader>uG", function() Snacks.toggle.option("gitsigns"):toggle() end, { desc = "Toggle Git Signs" })
map("n", "<leader>uS", function() Snacks.toggle.scroll():toggle() end, { desc = "Toggle Smooth Scroll" })
map("n", "<leader>uZ", function() Snacks.toggle.zoom():toggle() end, { desc = "Toggle Zoom" })
map("n", "<leader>uz", function() Snacks.toggle.zen():toggle() end, { desc = "Toggle Zen Mode" })
map("n", "<leader>uC", function() Snacks.picker.colorschemes() end, { desc = "Colorschemes" })
map("n", "<leader>uh", function()
  vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled())
end, { desc = "Toggle Inlay Hints" })

-- Keywordprg
map("n", "<leader>K", "<cmd>norm! K<cr>", { desc = "Keywordprg" })

-- Quit
map("n", "<leader>qq", "<cmd>qa<cr>", { desc = "Quit All" })

-- Add comment above/below
map("n", "gco", "o<esc>Vcx<esc><cmd>normal gcc<cr>fxa<bs>", { desc = "Add Comment Below" })
map("n", "gcO", "O<esc>Vcx<esc><cmd>normal gcc<cr>fxa<bs>", { desc = "Add Comment Above" })

-- Highlights under cursor
map("n", "<leader>ui", vim.show_pos, { desc = "Inspect Pos" })
map("n", "<leader>uI", function() vim.treesitter.inspect_tree() end, { desc = "Inspect Tree" })

-- Windows
map("n", "<leader>w", "<c-w>", { desc = "Windows", remap = true })
map("n", "<leader>-", "<C-W>s", { desc = "Split Window Below", remap = true })
map("n", "<leader>|", "<C-W>v", { desc = "Split Window Right", remap = true })
map("n", "<leader>wd", "<C-W>c", { desc = "Delete Window", remap = true })
map("n", "<leader>wm", function() Snacks.toggle.zoom():toggle() end, { desc = "Toggle Zoom" })

-- Tabs
map("n", "<leader><tab>l", "<cmd>tablast<cr>", { desc = "Last Tab" })
map("n", "<leader><tab>o", "<cmd>tabonly<cr>", { desc = "Close Other Tabs" })
map("n", "<leader><tab>f", "<cmd>tabfirst<cr>", { desc = "First Tab" })
map("n", "<leader><tab><tab>", "<cmd>tabnew<cr>", { desc = "New Tab" })
map("n", "<leader><tab>]", "<cmd>tabnext<cr>", { desc = "Next Tab" })
map("n", "<leader><tab>[", "<cmd>tabprev<cr>", { desc = "Previous Tab" })
map("n", "<leader><tab>d", "<cmd>tabclose<cr>", { desc = "Close Tab" })

-- ===================================================================
-- Snacks Picker keymaps (replaces LazyVim's snacks integration)
-- ===================================================================
map("n", "<leader>,", function() Snacks.picker.buffers() end, { desc = "Buffers" })
map("n", "<leader>/", function() Snacks.picker.grep() end, { desc = "Grep (Root Dir)" })
map("n", "<leader>:", function() Snacks.picker.command_history() end, { desc = "Command History" })
map("n", "<leader><space>", function() Snacks.picker.files() end, { desc = "Find Files (Root Dir)" })

-- find
map("n", "<leader>fb", function() Snacks.picker.buffers() end, { desc = "Buffers" })
map("n", "<leader>fc", function() Snacks.picker.files({ cwd = vim.fn.stdpath("config") }) end, { desc = "Find Config File" })
map("n", "<leader>ff", function() Snacks.picker.files() end, { desc = "Find Files (Root Dir)" })
map("n", "<leader>fF", function() Snacks.picker.files({ cwd = vim.uv.cwd() }) end, { desc = "Find Files (cwd)" })
map("n", "<leader>fg", function() Snacks.picker.git_files() end, { desc = "Find Files (git-files)" })
map("n", "<leader>fr", function() Snacks.picker.recent({ filter = { cwd = false } }) end, { desc = "Recent" })
map("n", "<leader>fR", function() Snacks.picker.recent({ cwd = vim.uv.cwd() }) end, { desc = "Recent (cwd)" })

-- git
map({ "n", "x" }, "<leader>gB", function() Snacks.gitbrowse() end, { desc = "Git Browse (open)" })
map({ "n", "x" }, "<leader>gY", function()
  Snacks.gitbrowse({ open = function(url) vim.fn.setreg("+", url) end, notify = false })
end, { desc = "Git Browse (copy URL)" })
map("n", "<leader>gb", function() Snacks.picker.git_log_line() end, { desc = "Git Blame Line" })
map("n", "<leader>gl", function() Snacks.picker.git_log({ cwd = util.git_root() }) end, { desc = "Git Log" })
map("n", "<leader>gL", function() Snacks.picker.git_log() end, { desc = "Git Log (cwd)" })
map("n", "<leader>gf", function() Snacks.picker.git_log_file() end, { desc = "Git Current File History" })
map("n", "<leader>gs", function() Snacks.picker.git_status() end, { desc = "Git Status" })
map("n", "<leader>gS", function() Snacks.picker.git_stash() end, { desc = "Git Stash" })
map("n", "<leader>gd", function() Snacks.picker.git_diff() end, { desc = "Git Diff (Hunks)" })

-- Grep
map("n", "<leader>sb", function() Snacks.picker.lines() end, { desc = "Buffer Lines" })
map("n", "<leader>sB", function() Snacks.picker.grep_buffers() end, { desc = "Grep Open Buffers" })
map("n", "<leader>sg", function() Snacks.picker.grep() end, { desc = "Grep (Root Dir)" })
map("n", "<leader>sG", function() Snacks.picker.grep({ cwd = vim.uv.cwd() }) end, { desc = "Grep (cwd)" })
map({ "n", "x" }, "<leader>sw", function() Snacks.picker.grep_word() end, { desc = "Visual selection or word" })

-- search
map("n", "<leader>s\"", function() Snacks.picker.registers() end, { desc = "Registers" })
map("n", "<leader>sa", function() Snacks.picker.autocmds() end, { desc = "Autocmds" })
map("n", "<leader>sc", function() Snacks.picker.command_history() end, { desc = "Command History" })
map("n", "<leader>sC", function() Snacks.picker.commands() end, { desc = "Commands" })
map("n", "<leader>sd", function() Snacks.picker.diagnostics() end, { desc = "Diagnostics" })
map("n", "<leader>sD", function() Snacks.picker.diagnostics_buffer() end, { desc = "Buffer Diagnostics" })
map("n", "<leader>sh", function() Snacks.picker.help() end, { desc = "Help Pages" })
map("n", "<leader>sH", function() Snacks.picker.highlights() end, { desc = "Highlights" })
map("n", "<leader>si", function() Snacks.picker.icons() end, { desc = "Icons" })
map("n", "<leader>sj", function() Snacks.picker.jumps() end, { desc = "Jumps" })
map("n", "<leader>sk", function() Snacks.picker.keymaps() end, { desc = "Keymaps" })
map("n", "<leader>sl", function() Snacks.picker.loclist() end, { desc = "Location List" })
map("n", "<leader>sM", function() Snacks.picker.man() end, { desc = "Man Pages" })
map("n", "<leader>sm", function() Snacks.picker.marks() end, { desc = "Marks" })
map("n", "<leader>sR", function() Snacks.picker.resume() end, { desc = "Resume" })
map("n", "<leader>sq", function() Snacks.picker.qflist() end, { desc = "Quickfix List" })
map("n", "<leader>sp", function() Snacks.picker.projects() end, { desc = "Projects" })
map("n", "<leader>s/", function() Snacks.picker.search_history() end, { desc = "Search History" })
map("n", "<leader>su", function() Snacks.picker.undo() end, { desc = "Undotree" })
map("n", "<leader>fB", function() Snacks.picker.buffers({ filter = false }) end, { desc = "Buffers (all)" })
map("n", "<leader>fp", function() Snacks.picker.projects() end, { desc = "Projects" })
map({ "n", "x" }, "<leader>sW", function() Snacks.picker.grep_word({ cwd = vim.uv.cwd() }) end, { desc = "Visual selection or word (cwd)" })

-- LSP picker keymaps
map("n", "gd", function() Snacks.picker.lsp_definitions() end, { desc = "Goto Definition" })
map("n", "gD", function() Snacks.picker.lsp_declarations() end, { desc = "Goto Declaration" })
map("n", "grr", function() Snacks.picker.lsp_references() end, { nowait = true, desc = "References" })
map("n", "gri", function() Snacks.picker.lsp_implementations() end, { desc = "Goto Implementation" })
map("n", "grt", function() Snacks.picker.lsp_type_definitions() end, { desc = "Goto Type Definition" })
map("n", "<leader>ss", function() Snacks.picker.lsp_symbols() end, { desc = "LSP Symbols" })
map("n", "<leader>sS", function() Snacks.picker.lsp_workspace_symbols() end, { desc = "LSP Workspace Symbols" })

-- Snacks features
map("n", "<leader>e", function() Snacks.explorer() end, { desc = "File Explorer" })
map("n", "<leader>E", function() Snacks.explorer({ cwd = vim.uv.cwd() }) end, { desc = "File Explorer (cwd)" })
map("n", "<leader>n", function() Snacks.notifier.show_history() end, { desc = "Notification History" })
map("n", "<leader>un", function() Snacks.notifier.hide() end, { desc = "Dismiss All Notifications" })

-- Scratch buffers
map("n", "<leader>.", function() Snacks.scratch() end, { desc = "Toggle Scratch Buffer" })
map("n", "<leader>S", function() Snacks.scratch.select() end, { desc = "Select Scratch Buffer" })

-- Lazygit
map("n", "<leader>gg", function() Snacks.lazygit() end, { desc = "Lazygit (Root Dir)" })
map("n", "<leader>gG", function() Snacks.lazygit({ cwd = vim.uv.cwd() }) end, { desc = "Lazygit (cwd)" })

-- Terminal mode window navigation
map("t", "<C-h>", "<cmd>wincmd h<cr>", { desc = "Go to Left Window" })
map("t", "<C-j>", "<cmd>wincmd j<cr>", { desc = "Go to Lower Window" })
map("t", "<C-k>", "<cmd>wincmd k<cr>", { desc = "Go to Upper Window" })
map("t", "<C-l>", "<cmd>wincmd l<cr>", { desc = "Go to Right Window" })
map("t", "<C-/>", "<cmd>close<cr>", { desc = "Hide Terminal" })
map("t", "<c-_>", "<cmd>close<cr>", { desc = "which_key_ignore" })

-- ===================================================================
-- Trouble keymaps
-- ===================================================================
map("n", "<leader>xx", "<cmd>Trouble diagnostics toggle<cr>", { desc = "Diagnostics (Trouble)" })
map("n", "<leader>xX", "<cmd>Trouble diagnostics toggle filter.buf=0<cr>", { desc = "Buffer Diagnostics (Trouble)" })
map("n", "<leader>cs", "<cmd>Trouble symbols toggle<cr>", { desc = "Symbols (Trouble)" })
map("n", "<leader>cS", "<cmd>Trouble lsp toggle<cr>", { desc = "LSP references/definitions/... (Trouble)" })
map("n", "<leader>xL", "<cmd>Trouble loclist toggle<cr>", { desc = "Location List (Trouble)" })
map("n", "<leader>xQ", "<cmd>Trouble qflist toggle<cr>", { desc = "Quickfix List (Trouble)" })

-- ===================================================================
-- LSP keymaps (replaces LazyVim LSP keymaps)
-- ===================================================================
-- Delete default LSP keymaps we want to override
pcall(vim.keymap.del, "n", "grn")
pcall(vim.keymap.del, "n", "gra")

-- LSP keymaps
map("n", "<leader>cl", "<cmd>checkhealth vim.lsp<cr>", { desc = "LSP Info" })
map("n", "<leader>cm", "<cmd>Mason<cr>", { desc = "Mason" })
map("n", "<leader>cr", vim.lsp.buf.rename, { desc = "Rename" })
map({ "n", "v" }, "<leader>ca", vim.lsp.buf.code_action, { desc = "Code Action" })
map("n", "<leader>cd", vim.diagnostic.open_float, { desc = "Line Diagnostics" })
map("n", "gK", vim.lsp.buf.signature_help, { desc = "Signature Help" })
map("i", "<c-k>", vim.lsp.buf.signature_help, { desc = "Signature Help" })
map("n", "<leader>cA", function()
  vim.lsp.buf.code_action({ context = { only = { "source" }, diagnostics = {} } })
end, { desc = "Source Action" })
map({ "n", "x" }, "<leader>cc", vim.lsp.codelens.run, { desc = "Run Codelens" })
map("n", "<leader>cC", vim.lsp.codelens.refresh, { desc = "Refresh & Display Codelens" })
map("n", "<leader>cR", function() Snacks.rename.rename_file() end, { desc = "Rename File" })
map("n", "ga", "", { desc = "callHierarchy" })
map("n", "gai", function() Snacks.picker.lsp_incoming_calls() end, { desc = "Incoming Calls" })
map("n", "gao", function() Snacks.picker.lsp_outgoing_calls() end, { desc = "Outgoing Calls" })

-- Word/reference navigation (Snacks.words)
map("n", "]]", function() Snacks.words.jump(vim.v.count1) end, { desc = "Next Reference" })
map("n", "[[", function() Snacks.words.jump(-vim.v.count1) end, { desc = "Prev Reference" })
map("n", "<a-n>", function() Snacks.words.jump(vim.v.count1, true) end, { desc = "Next Reference" })
map("n", "<a-p>", function() Snacks.words.jump(-vim.v.count1, true) end, { desc = "Prev Reference" })

-- ===================================================================
-- Custom keymaps (from user config)
-- ===================================================================
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
  if char_code == 0 then return end
  if type(char_code) ~= "number" then return end
  local char = vim.fn.nr2char(char_code)
  if not char:match("^[a-zA-Z]$") then
    return vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("m" .. char, true, true, true), "n", false)
  end
  local mark = vim.fn.getpos("'" .. char)
  local buf = mark[1]
  local bufnr = vim.api.nvim_get_current_buf()
  if buf == 0 then buf = bufnr end
  local mark_row = mark[2]
  local row = vim.api.nvim_win_get_cursor(vim.api.nvim_get_current_win())[1]
  if buf == bufnr and mark_row == row then
    return vim.cmd.delmarks(char)
  end
  vim.cmd.normal({ "m" .. char, bang = true })
end

-- Move lines
set("n", "<S-j>", "<cmd>execute 'move .+' . v:count1<cr>==")
set("n", "<S-k>", "<cmd>execute 'move .-' . (v:count1 + 1)<cr>==")
set({ "v", "x" }, "<S-j>", ":<C-u>execute \"'<,'>move '>+\" . v:count1<cr>gv=gv")
set({ "v", "x" }, "<S-k>", ":<C-u>execute \"'<,'>move '<-\" . (v:count1 + 1)<cr>gv=gv")

-- Resize windows
set("n", "<S-Up>", get_resizer(true), { desc = "Increase Window Height" })
set("n", "<S-Down>", get_resizer(false), { desc = "Decrease Window Height" })
set("n", "<S-Left>", get_resizer(true, true), { desc = "Increase Window Width" })
set("n", "<S-Right>", get_resizer(false, true), { desc = "Decrease Window Width" })

-- Custom leader keymaps
set("n", "<leader>Q", "<cmd>quit<cr>", { desc = "Quit" })
set("n", "<leader>qf", "<cmd>ccl<cr>", { desc = "Quit Quickfix List" })
set("n", "<leader>o", ":update<cr> :source<cr>", { desc = "Update Source" })

-- Terminal
set("n", "<leader>ft", function()
  Snacks.terminal(vim.o.shell)
end, { desc = "Float Terminal (cwd)" })
set({ "n", "t" }, "<c-_>", function()
  Snacks.terminal(vim.o.shell, { cwd = util.root() })
end, { desc = "Float Terminal (root)" })

-- Save
set({ "n", "x", "s" }, "<leader>i", "<cmd>w<cr>", { desc = "Save File" })
set({ "n", "x", "s" }, "<leader>I", "<cmd>wall<cr>", { desc = "Save All" })
set({ "n", "x", "s" }, "<leader>X", "<cmd>xall<cr>", { desc = "Save And Quit" })

-- Toggle mark
set({ "n", "x", "s" }, "m", toggle_mark)

-- Format
set({ "n", "v" }, "<leader>cf", function()
  local name = ".prettierrc.json"
  if vim.api.nvim_get_option_value("shiftwidth", { buf = vim.api.nvim_get_current_buf() }) == 4 then
    name = ".prettierrc_tab.json"
  end
  vim.env.PRETTIERD_DEFAULT_CONFIG = vim.fn.expand("~") .. "/.config/" .. name
  require("conform").format({ timeout_ms = 3000, async = false, lsp_fallback = true })
end, { desc = "Format" })

-- Escape from insert mode
set("i", "jk", "<Esc>", { desc = "Exit insert mode" })

-- ===================================================================
-- Quickfix keymaps
-- ===================================================================
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
    local start_index, count
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
        if not entry or entry.valid ~= 1 then return end
        vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("<cr>", true, true, true), "n", false)
        vim.schedule(function()
          local win = vim.fn.bufwinid(entry.bufnr)
          if vim.api.nvim_win_is_valid(win) then
            vim.api.nvim_win_set_cursor(qfwin, pos)
          end
        end)
      end,
    },
    { from = "dd", to = remove_qf_item(true) },
  },
  [{ "n", "v" }] = {
    { from = "d", to = remove_qf_item() },
  },
}

vim.api.nvim_create_autocmd("FileType", {
  pattern = "qf",
  group = vim.api.nvim_create_augroup("qf_keymaps", { clear = true }),
  callback = function(event)
    local bufnr = event.buf
    local qfwin = vim.fn.bufwinid(bufnr)
    for mode, maps in pairs(qfkeymaps) do
      for _, m in ipairs(maps) do
        set(mode, m.from, function()
          local qflist = vim.fn.getqflist()
          local pos = vim.api.nvim_win_get_cursor(qfwin)
          m.to(qflist, qfwin, pos)
        end, { buffer = bufnr })
      end
    end
  end,
})

-- JSON snippet formatting command
vim.api.nvim_create_user_command("AddQuotes", util.format_snippet_json, { range = true })
vim.api.nvim_create_autocmd("FileType", {
  pattern = "json",
  group = vim.api.nvim_create_augroup("json_keymaps", { clear = true }),
  callback = function(event)
    set("v", '<leader>"', ":AddQuotes<cr>", { buffer = event.buf, desc = "Add Multiple Line Quotes" })
  end,
})
