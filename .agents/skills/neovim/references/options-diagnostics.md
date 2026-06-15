# Options, diagnostics, and filetypes

Core editor behavior that doesn't belong to any plugin.

## Options (`vim.opt` / `vim.o`)

Three APIs, all equivalent for most cases:
- `vim.opt.foo = value` — Lua-friendly, supports `:append()` / `:remove()` for list-like options.
- `vim.o.foo = value` — raw string/number, simplest.
- `vim.bo.foo` (buffer) / `vim.wo.foo` (window) / `vim.go.foo` (global) — scoped access.

Use `vim.opt` when you need list/set manipulation; `vim.o` for simple scalars. Both are fine.

### Must-know options

```lua
-- Line numbers
vim.opt.number = true
vim.opt.relativenumber = true

-- Indent
vim.opt.tabstop = 2
vim.opt.shiftwidth = 2
vim.opt.expandtab = true
vim.opt.smartindent = true

-- Search
vim.opt.ignorecase = true
vim.opt.smartcase = true
vim.opt.hlsearch = true
vim.opt.incsearch = true

-- Files
vim.opt.undofile = true         -- persistent undo
vim.opt.swapfile = false
vim.opt.backup = false
vim.opt.updatetime = 250        -- faster CursorHold, swapfile write

-- Splits
vim.opt.splitright = true
vim.opt.splitbelow = true

-- Wrapping / scrolling
vim.opt.wrap = false
vim.opt.scrolloff = 8
vim.opt.sidescrolloff = 8

-- UI
vim.opt.termguicolors = true    -- 24-bit color (required for modern colorschemes)
vim.opt.signcolumn = "yes"      -- always show — avoids text shift when diagnostics appear
vim.opt.cursorline = true
vim.opt.showmode = false        -- statusline shows it
vim.opt.laststatus = 3          -- single global statusline (Neovim 0.7+)
vim.opt.pumheight = 10          -- popup menu max height
vim.opt.pumblend = 10           -- popup menu transparency

-- Clipboard
vim.opt.clipboard = "unnamedplus" -- share with system clipboard (requires xclip/pbcopy)

-- Misc
vim.opt.mouse = "a"
vim.opt.completeopt = "menu,menuone,noselect"
vim.opt.timeoutlen = 300        -- which-key shows faster
```

### `vim.opt` list/set tricks

```lua
vim.opt.listchars:append({ eol = "↴", tab = "» " })
vim.opt.shortmess:append("I") -- suppress intro message
vim.opt.path:append("**")     -- recursive :find
vim.opt.wildignore:append({ "*.o", "*.pyc", "node_modules/**" })
```

## Diagnostics

Neovim's diagnostic system is separate from LSP — any source (LSP, nvim-lint, DAP) can publish diagnostics. Configure globally with `vim.diagnostic.config()`.

### Modern config (Neovim 0.10+)

```lua
vim.diagnostic.config({
  virtual_text = {
    prefix = "●",        -- or "■", "▎", "▎"
    spacing = 4,
    source = "if_many",  -- only show source when multiple diagnostics at once
  },
  -- or use virtual_lines (0.11+) for inline below-the-line rendering:
  -- virtual_lines = { current_line = true },
  signs = {
    text = {
      [vim.diagnostic.severity.ERROR] = "",
      [vim.diagnostic.severity.WARN] = "",
      [vim.diagnostic.severity.INFO] = "",
      [vim.diagnostic.severity.HINT] = "",
    },
  },
  underline = true,
  update_in_insert = false, -- don't spam while typing
  severity_sort = true,
  float = {
    border = "rounded",
    source = true,
  },
})
```

### Navigation (Neovim 0.11+ defaults)

0.11 provides `]d` / `[d` out of the box. For finer control:

```lua
vim.keymap.set("n", "]e", function() vim.diagnostic.jump({ count = 1,  severity = vim.diagnostic.severity.ERROR }) end)
vim.keymap.set("n", "[e", function() vim.diagnostic.jump({ count = -1, severity = vim.diagnostic.severity.ERROR }) end)
vim.keymap.set("n", "<leader>e", vim.diagnostic.open_float, { desc = "Line diagnostics" })
vim.keymap.set("n", "<leader>q", vim.diagnostic.setqflist, { desc = "Diagnostics → quickfix" })
```

Note: `vim.diagnostic.goto_next / goto_prev` are deprecated in favor of `vim.diagnostic.jump({count=±1})` since 0.11.

### Toggles

```lua
vim.keymap.set("n", "<leader>td", function()
  vim.diagnostic.enable(not vim.diagnostic.is_enabled())
end, { desc = "Toggle diagnostics" })
```

## Filetype detection

Neovim uses `vim.filetype.add()` for custom patterns (0.7+):

```lua
vim.filetype.add({
  extension = {
    mdx = "markdown.mdx",
    conf = "conf",
  },
  filename = {
    ["Dockerfile.dev"] = "dockerfile",
    [".prettierrc"] = "json",
  },
  pattern = {
    ["%.env%..*"] = "sh",                -- .env.local, .env.production, etc.
    [".*/hypr/.*%.conf"] = "hyprlang",
  },
})
```

Filetype-specific options go in `after/ftplugin/<ft>.lua`:

```lua
-- after/ftplugin/gitcommit.lua
vim.opt_local.spell = true
vim.opt_local.textwidth = 72
```

This runs every time a buffer of that filetype is loaded, in the right buffer context. Much cleaner than FileType autocmds.

## Terminal

Built-in terminal (`:term`) is decent. Common improvements:

```lua
-- Exit terminal mode with Esc
vim.keymap.set("t", "<Esc><Esc>", "<C-\\><C-n>")

-- Hide line numbers in terminals
vim.api.nvim_create_autocmd("TermOpen", {
  callback = function()
    vim.opt_local.number = false
    vim.opt_local.relativenumber = false
    vim.opt_local.signcolumn = "no"
  end,
})
```

Plugins: `toggleterm.nvim`, `snacks.terminal`, `nvim-tmux-navigator` (for tmux integration).

## Colorscheme activation

```lua
vim.cmd.colorscheme("tokyonight")
-- or pcall for safety if the plugin might not be installed yet:
pcall(vim.cmd.colorscheme, "tokyonight")
```

Activate after the colorscheme plugin has loaded. With lazy.nvim, set `priority = 1000` on the colorscheme spec so it loads first.

## netrw

If the user uses netrw and wants it cleaner:

```lua
vim.g.netrw_banner = 0
vim.g.netrw_liststyle = 3  -- tree view
vim.g.netrw_winsize = 25
```

Or replace entirely with `oil.nvim` / `neo-tree` / `nvim-tree`.
