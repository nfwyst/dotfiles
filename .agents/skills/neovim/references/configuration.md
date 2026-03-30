# Configuration Reference

Detailed reference for Neovim 0.12+ configuration structure and options.

## Startup Sequence

```
init.lua
├── require("config.options")     # vim.opt settings, filetype additions
├── require("config.keymaps")     # All keybindings
├── require("config.autocmds")    # Autocommands
├── require("config.lsp")         # Native LSP: diagnostics, vim.lsp.enable()
└── require("plugins")            # vim.pack.add() + plugin configs
    ├── require("plugins.colorscheme")
    ├── require("plugins.ui")        # Snacks, Noice, Lualine, Bufferline, Vimade
    ├── require("plugins.editor")    # which-key, gitsigns, trouble, flash, etc.
    ├── require("plugins.coding")    # treesitter, blink.cmp, mini.*, lazydev
    └── require("plugins.tools")     # mason, conform, nvim-lint, AI, etc.
```

## Plugin Management (vim.pack)

### init.lua (plugins/init.lua)

```lua
-- Suppress messages during plugin loading
local saved_shortmess = vim.o.shortmess
vim.o.shortmess = "aAFOTIcC"

vim.pack.add({
  "https://github.com/folke/snacks.nvim",
  { src = "https://github.com/nvim-treesitter/nvim-treesitter", version = "main" },
  -- ... all plugins
})

vim.o.shortmess = saved_shortmess
vim.cmd("silent! redraw")
```

### vim.pack API

```lua
vim.pack.add(specs, opts?)        -- Install + load plugins
vim.pack.update(names?, opts?)    -- Update plugins (default: all)
vim.pack.del(names, opts?)        -- Remove plugins
vim.pack.get(names?, opts?)       -- Query plugin state

-- Spec format
{ src = "https://github.com/user/repo", version = "main" }
-- or shorthand:
"https://github.com/user/repo"
```

### Lockfile

- Path: `~/.config/nvim/nvim-pack-lock.json`
- Tracks exact commit hashes for all plugins
- Version-controlled for reproducible installs
- `vim.pack.update({ target = "lockfile" })` to restore lockfile state

### Plugin Events

```lua
vim.api.nvim_create_autocmd("User", {
  pattern = "PackChanged",
  callback = function(ev)
    local name = ev.data.spec.name    -- plugin name
    local kind = ev.data.kind         -- "install" | "update" | "delete"
    local active = ev.data.active     -- boolean
    local path = ev.data.path         -- install path
  end,
})
```

### PlugSync Command

Custom command that combines cleanup + update:

```vim
:PlugSync    " Remove inactive plugins, then update all
```

### Automatic Cleanup

On every startup (deferred 300ms), inactive plugins (no longer in `vim.pack.add()`) are auto-removed.

## Core Options (config/options.lua)

### Key Settings

```lua
vim.g.mapleader = " "
vim.g.maplocalleader = "\\"
vim.g.autoformat = true               -- Global autoformat toggle

vim.opt.clipboard = "unscheduled"     -- Lazy clipboard (0.12+)
vim.opt.completeopt = "menu,menuone,noselect"
vim.opt.conceallevel = 2
vim.opt.confirm = true
vim.opt.cursorline = true
vim.opt.expandtab = true
vim.opt.fillchars = { foldopen = "", foldclose = "", fold = " ", foldsep = " ", diff = "╱", eob = " " }
vim.opt.ignorecase = true
vim.opt.inccommand = "nosplit"
vim.opt.jumpoptions = "view"
vim.opt.laststatus = 3                -- Global statusline
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.scrolloff = 4
vim.opt.sessionoptions = { "buffers", "curdir", "tabpages", "winsize", "help", "globals", "skiprtp", "folds" }
vim.opt.shiftround = true
vim.opt.shiftwidth = 2
vim.opt.shortmess:append({ W = true, I = true, c = true, C = true })
vim.opt.showmode = false
vim.opt.sidescrolloff = 8
vim.opt.signcolumn = "yes"
vim.opt.smartcase = true
vim.opt.smartindent = true
vim.opt.splitbelow = true
vim.opt.splitright = true
vim.opt.tabstop = 2
vim.opt.termguicolors = true
vim.opt.timeoutlen = 300
vim.opt.undofile = true
vim.opt.undolevels = 10000
vim.opt.updatetime = 200
vim.opt.virtualedit = "block"
vim.opt.wildmode = "longest:full,full"
vim.opt.winminwidth = 5
vim.opt.wrap = false
```

### Custom Filetypes

```lua
vim.filetype.add({
  extension = { nu = "nu", mdx = "mdx", typ = "typst" },
  pattern = { ["%.env%.[%w_.-]+"] = "sh" },
})
```

### Paste Guard

Large paste operations (>10,000 lines) trigger confirmation prompt.

## Autocommands (config/autocmds.lua)

| Event | Purpose |
|-------|---------|
| `FocusGained`, `TermClose`, `TermLeave` | Auto-check for file changes |
| `TextYankPost` | Highlight yanked text |
| `VimResized` | Equalize window splits |
| `BufReadPost` | Restore last cursor position |
| `FileType` (help, qf, ...) | Close with `q` for transient buffers |
| `FileType` (gitcommit, markdown) | Enable spell + wrap |
| `BufWritePre` | Auto-create parent directories |
| `BufWritePre` | Retab on save (optional, filetype-specific) |

## Utility Functions (config/util.lua)

### Root Detection

```lua
local util = require("config.util")
util.root()          -- Returns project root (git root or cwd)
util.git_root()      -- Returns git root specifically
```

### Icons

```lua
util.icons.diagnostics  -- { Error = " ", Warn = " ", Info = " ", Hint = "󰌶 " }
util.icons.git          -- { added = " ", modified = " ", removed = " " }
```

### ESLint Config Finder

```lua
util.find_eslint_config(startpath)  -- Walks up to find .eslintrc.*, eslint.config.*, etc.
```

## Colorscheme (plugins/colorscheme.lua)

### Auto Dark Mode (macOS)

```lua
-- Reads macOS appearance on startup
-- Sets vim.o.background = "dark" or "light"
-- Default colorscheme: tokyonight
```

### Available Colorschemes

- **tokyonight** (default) — with transparent background
- **monokai-pro** — "spectrum" filter
- **NeoSolarized** — for light mode
