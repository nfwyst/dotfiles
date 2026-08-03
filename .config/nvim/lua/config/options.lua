-- Options
local g_opts = {
  snacks_animate = true,
  editorconfig = true,
  transparent_enabled = true,
  autoformat = true,
  todopath = vim.fn.stdpath("data") .. "/snacks/todo/todo.md",
  loaded_perl_provider = 0,
  loaded_ruby_provider = 0,
  python3_host_prog = "/opt/homebrew/bin/python3",
  markdowns = { "markdown", "Avante", "codecompanion", "octo", "grug-far-help", "checkhealth", "mdx" },
}

for name, value in pairs(g_opts) do
  vim.g[name] = value
end

-- Suppress visual flash before colorscheme loads: transparent backgrounds prevent
-- blue MsgSeparator banner during vim.pack install and white flash on startup
for _, hl in ipairs({ "Normal", "NormalNC", "MsgArea", "MsgSeparator", "StatusLine", "StatusLineNC" }) do
  vim.api.nvim_set_hl(0, hl, { bg = "NONE", fg = "NONE" })
end

-- Calculate scrolloff
local scrolloff = math.floor(vim.api.nvim_win_get_height(vim.api.nvim_get_current_win()) / 4)
if scrolloff > 1 then
  scrolloff = scrolloff - 1
end
if scrolloff < 4 then
  scrolloff = 4
end

local opt = vim.opt

opt.autowrite = true
opt.clipboard = vim.env.SSH_TTY and "" or "unnamedplus"
opt.completeopt = "menu,menuone,noselect"
opt.conceallevel = 3
opt.confirm = true
opt.cursorline = true
opt.cursorlineopt = "both"
opt.expandtab = true
opt.fillchars = { foldopen = "▾", foldclose = "▸", fold = " ", foldsep = " ", diff = "╱", eob = " " }
opt.foldlevel = 99
opt.foldmethod = "expr"
opt.foldexpr = "v:lua.vim.treesitter.foldexpr()"
opt.formatexpr = "v:lua.require'conform'.formatexpr()"
opt.grepformat = "%f:%l:%c:%m"
opt.grepprg = "rg --vimgrep"
opt.ignorecase = true
opt.jumpoptions = "view"
opt.laststatus = 0
opt.linebreak = true
opt.list = true
opt.mouse = "a"
opt.number = true
opt.pumblend = 10
opt.pumheight = 10
opt.scrolloff = scrolloff
opt.sessionoptions = { "buffers", "curdir", "tabpages", "winsize", "help", "globals", "skiprtp", "folds" }
opt.shiftround = true
opt.shiftwidth = 2
opt.shortmess:append({ W = true, I = true, c = true, C = true })
opt.showmode = false
opt.sidescrolloff = 8
opt.signcolumn = "yes"
opt.smartcase = true
opt.smartindent = true
opt.smoothscroll = true
opt.spelllang = { "en", "cjk" }
opt.splitbelow = true
opt.splitkeep = "screen"
opt.splitright = true
opt.tabstop = 2
opt.timeoutlen = vim.g.vscode and 1000 or 300
opt.undofile = true
opt.undolevels = 10000
opt.updatetime = 200
opt.virtualedit = "block"
opt.wildmode = "longest:full,full"
opt.winminwidth = 5
opt.wrap = false
opt.foldtext = ""
opt.ruler = false

-- Disable termsync inside tmux: let tmux manage synchronized output boundaries
-- instead of Neovim, avoiding double-sync cursor ghosting artifacts.
-- See: https://github.com/zellij-org/zellij/issues/3208
if vim.env.TMUX then
  opt.termsync = false
end

-- Custom overrides
opt.softtabstop = 2
opt.numberwidth = 2
opt.listchars = "tab:▓░,trail:•,extends:»,precedes:«,nbsp:░"
opt.showcmd = false
opt.modeline = false
opt.swapfile = false

-- Filetype additions
vim.filetype.add({
  extension = {
    mdx = "mdx",
  },
  pattern = {
    ["compose.*%.ya?ml"] = "yaml.docker-compose",
    ["docker%-compose.*%.ya?ml"] = "yaml.docker-compose",
  },
})

-- Guard paste handler:
--   1. E21 fix: skip nvim_put in non-modifiable buffers (Nvim 0.12 still needs this).
--   2. Large-paste perf ("paste mode" equivalent): modern Nvim has no useful
--      `:set paste` — bracketed paste is automatic via vim.paste(). The real
--      freeze on big pastes comes from `foldmethod=expr` + treesitter foldexpr
--      recomputing folds on every inserted chunk (O(chunks) full-buffer parses).
--      So for the duration of a paste we switch to manual folds + lazyredraw and
--      restore afterwards, collapsing it to a single fold recompute at the end.
local original_paste = vim.paste
local paste_guard = nil

local function paste_guard_enter()
  if paste_guard then
    return
  end
  paste_guard = {
    foldmethod = vim.wo.foldmethod,
    lazyredraw = vim.o.lazyredraw,
  }
  vim.wo.foldmethod = "manual"
  vim.o.lazyredraw = true
end

local function paste_guard_leave()
  if not paste_guard then
    return
  end
  vim.wo.foldmethod = paste_guard.foldmethod
  vim.o.lazyredraw = paste_guard.lazyredraw
  paste_guard = nil
  vim.schedule(function()
    pcall(vim.cmd.redraw)
  end)
end

vim.paste = function(lines, phase)
  if not vim.bo.modifiable then
    return false
  end
  -- phase: -1 = single call; 1 = start; 2 = continue; 3 = end.
  if phase == 1 or phase == -1 then
    paste_guard_enter()
  end
  local ok, result = pcall(original_paste, lines, phase)
  if phase == 3 or phase == -1 or not ok then
    paste_guard_leave()
  end
  if not ok then
    error(result)
  end
  return result
end
