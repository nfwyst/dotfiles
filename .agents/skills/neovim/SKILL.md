---
name: neovim
description: Comprehensive guide for this Neovim 0.12+ configuration - a modular, performance-optimized Lua-based IDE using native vim.pack and vim.lsp APIs. Use when configuring plugins, adding keybindings, setting up LSP servers, debugging, or extending the configuration. Covers vim.pack.add(), vim.lsp.config/enable, 35+ plugins across 6 categories, Snacks.nvim ecosystem, and AI integrations.
---

# Neovim 0.12+ Configuration Skill

A comprehensive guide for working with this Neovim 0.12+ configuration using native APIs (`vim.pack`, `vim.lsp.config`) migrated from LazyVim.

## Quick Reference

| Metric | Value |
|--------|-------|
| Neovim Version | 0.12+ |
| Plugin Manager | `vim.pack` (native) |
| Total Plugins | ~35 |
| LSP System | Native `vim.lsp.config` + `vim.lsp.enable` |
| Leader Key | `<Space>` |
| Local Leader | `\` |

## Architecture Overview

```
~/.config/nvim/
├── init.lua                  # Entry point with resilient loader
├── lsp/                      # LSP server configs (0.12+ native convention)
│   ├── lua_ls.lua
│   ├── vtsls.lua
│   ├── html.lua
│   └── ... (12 servers)
├── lua/
│   ├── config/               # Core configuration (8 modules)
│   │   ├── options.lua       # Vim options & globals
│   │   ├── keymaps.lua       # Key bindings (600+ lines)
│   │   ├── autocmds.lua      # Autocommands
│   │   ├── lsp.lua           # Native LSP setup
│   │   ├── hack.lua          # Workarounds & patches
│   │   ├── util.lua          # Utility functions
│   │   ├── constant.lua      # Constants
│   │   └── price.lua         # Custom statusline component
│   └── plugins/              # Plugin configs (6 categories)
│       ├── init.lua          # vim.pack.add() plugin list
│       ├── colorscheme.lua   # Theme management
│       ├── ui.lua            # UI (snacks, lualine, bufferline)
│       ├── editor.lua        # Editor (which-key, gitsigns, flash)
│       ├── coding.lua        # Coding (treesitter, blink, mini)
│       └── tools.lua         # Tools (mason, conform, lint, AI)
├── snippets/                 # Custom snippets
├── nvim-pack-lock.json       # Plugin version lock
└── README.md
```

## Plugin Management (vim.pack)

### Adding a New Plugin

Edit `lua/plugins/init.lua` and add to the `vim.pack.add()` table:

```lua
vim.pack.add({
  -- Existing plugins...

  -- Simple plugin
  "https://github.com/author/plugin-name",

  -- With version/tag
  { src = "https://github.com/author/plugin-name", version = "v1.0.0" },

  -- With specific branch
  { src = "https://github.com/author/plugin-name", version = "main" },
}, { confirm = false })
```

### Post-Install Hooks (PackChanged)

Use `User PackChanged` autocommand for build steps:

```lua
-- Example: Build blink.cmp after install
vim.api.nvim_create_autocmd("User", {
  pattern = "PackChanged",
  callback = function()
    -- Find plugin path and run build command
    for _, path in ipairs(vim.api.nvim_list_runtime_paths()) do
      if path:match("plugin%-name$") then
        vim.system({ "make" }, { cwd = path }, function(result)
          -- Handle result
        end)
        break
      end
    end
  end,
})
```

### Native Plugin Commands

| Command | Description |
|---------|-------------|
| `:packadd {name}` | Load an optional plugin |
| `:packloadall` | Load all plugins |
| Check lock file | `nvim-pack-lock.json` |

## LSP Configuration (Native 0.12+)

### LSP Architecture

```
lsp/*.lua (server configs)
    ↓
vim.lsp.config() - register configs
    ↓
vim.lsp.enable() - enable servers
    ↓
LspAttach autocmd - buffer-specific setup
```

### Adding an LSP Server

1. **Create config file** in `lsp/{server_name}.lua`:

```lua
--- @type vim.lsp.Config
return {
  cmd = { "server-executable", "--args" },
  filetypes = { "lua", "javascript" },
  root_markers = { ".git", "package.json" },
  settings = {
    -- Server-specific settings
  },
}
```

2. **Enable in** `lua/config/lsp.lua`:

```lua
vim.lsp.enable({
  -- existing servers...
  "your_new_server",  -- Add here (matches lsp/{name}.lua)
})
```

### Global LSP Settings

```lua
-- In lua/config/lsp.lua
vim.lsp.config("*", {
  capabilities = {
    workspace = {
      fileOperations = {
        didRename = true,
        willRename = true,
      },
    },
  },
  on_attach = function(client, bufnr)
    -- Global on_attach logic
  end,
})
```

### Key LSP Keybindings

| Key | Action |
|-----|--------|
| `gd` | Goto Definition (Snacks picker) |
| `gD` | Goto Declaration |
| `grr` | References |
| `gri` | Implementation |
| `grt` | Type Definition |
| `<leader>ss` | Document Symbols |
| `<leader>sS` | Workspace Symbols |
| `<leader>cr` | Rename |
| `<leader>ca` | Code Action |
| `gK` | Signature Help |
| `<c-k>` | Signature Help (insert) |
| `<leader>cd` | Line Diagnostics |
| `<leader>uh` | Toggle Inlay Hints |

### Diagnostics (Neovim 0.12+ API)

```lua
-- Configure in lua/config/lsp.lua
vim.diagnostic.config({
  underline = false,
  virtual_lines = false,
  virtual_text = { spacing = 0, current_line = true },
  float = {
    focusable = true,
    style = "minimal",
    border = "rounded",
    source = true,
  },
})

-- Navigation (Neovim 0.12+ native)
vim.diagnostic.jump({ count = 1, float = true })  -- Next diagnostic
```

## Snacks.nvim (Core UI Framework)

This configuration uses `folke/snacks.nvim` as the central UI framework.

### Enabled Modules

| Module | Purpose |
|--------|---------|
| `animate` | Smooth animations (120fps) |
| `bigfile` | Handle large files efficiently |
| `dashboard` | Startup dashboard |
| `dim` | Dim inactive windows |
| `explorer` | File explorer |
| `image` | Image viewer |
| `indent` | Indent guides |
| `input` | Enhanced input dialogs |
| `lazygit` | Git UI integration |
| `notifier` | Notification system |
| `picker` | Fuzzy finder (replaces telescope) |
| `quickfile` | Quick file operations |
| `rename` | LSP rename helper |
| `scratch` | Scratch buffers |
| `scroll` | Smooth scrolling |
| `statuscolumn` | Enhanced status column |
| `terminal` | Terminal integration |
| `words` | Word/ reference navigation |
| `zen` | Zen mode |
| `zoom` | Window zoom |

### Snacks Picker Keybindings

| Key | Action |
|-----|--------|
| `<leader><space>` | Find Files |
| `<leader>/` | Grep |
| `<leader>,` | Buffers |
| `<leader>:` | Command History |
| `<leader>fb` | Find Buffers |
| `<leader>ff` | Find Files (cwd) |
| `<leader>fF` | Find Files (root) |
| `<leader>fg` | Git Files |
| `<leader>fr` | Recent Files |
| `<leader>sg` | Grep (cwd) |
| `<leader>sG` | Grep (root) |
| `<leader>sw` | Grep Word |
| `gd` | LSP Definitions |
| `grr` | LSP References |
| `<leader>e` | File Explorer |

## Keybinding Structure

### Adding Keybindings

```lua
-- In lua/config/keymaps.lua
local map = vim.keymap.set

-- Simple mapping
map("n", "<leader>xx", "<cmd>Command<cr>", { desc = "Description" })

-- Function mapping
map("n", "<leader>xx", function()
  -- Your logic
end, { desc = "Description" })

-- Multiple modes
map({ "n", "v" }, "<leader>xx", action, { desc = "Description" })
```

### Which-Key Groups

```lua
-- In lua/plugins/editor.lua which-key spec
spec = {
  { "<leader>a", group = "ai" },
  { "<leader>b", group = "buffer" },
  { "<leader>c", group = "code" },
  { "<leader>f", group = "file/find" },
  { "<leader>g", group = "git" },
  { "<leader>s", group = "search" },
  { "<leader>u", group = "ui" },
}
```

## Plugin Categories

### Dependencies (3)
- `plenary.nvim` - Lua utilities
- `nui.nvim` - UI components
- `nvim-web-devicons` - File icons

### Colorschemes (3)
- `tokyonight.nvim` - Primary theme (storm/day)
- `monokai-pro.nvim` - Alternative
- `NeoSolarized.nvim` - Alternative

### UI (6)
- `snacks.nvim` - Core UI framework
- `lualine.nvim` - Statusline
- `bufferline.nvim` - Buffer tabs
- `noice.nvim` - UI enhancements
- `vimade` - Inactive window dimming
- `which-key.nvim` - Keybinding helper

### Editor (6)
- `flash.nvim` - Enhanced search/jump
- `gitsigns.nvim` - Git decorations
- `grug-far.nvim` - Find and replace
- `trouble.nvim` - Diagnostics list
- `todo-comments.nvim` - Todo highlighting
- `conflict.nvim` - Git conflict resolution

### Coding (7)
- `nvim-treesitter` - Syntax parsing
- `nvim-treesitter-context` - Sticky context
- `blink.cmp` - Completion engine
- `friendly-snippets` - Snippet collection
- `mini.pairs` - Auto-pairs
- `mini.ai` - Text objects
- `render-markdown.nvim` - Markdown preview

### Tools (10)
- `mason.nvim` - LSP/DAP installer
- `conform.nvim` - Formatting
- `nvim-lint` - Linting
- `codecompanion.nvim` - AI chat
- `leetcode.nvim` - LeetCode integration
- `checkmate.nvim` - Todo management
- `ts-worksheet-neovim` - TypeScript execution
- `uv.nvim` - Python UV integration
- `SchemaStore.nvim` - JSON schemas
- `lazydev.nvim` - Lua development

## Common Tasks

### Adding an Autocommand

```lua
-- In lua/config/autocmds.lua
vim.api.nvim_create_autocmd("FileType", {
  pattern = { "markdown", "text" },
  callback = function()
    vim.opt_local.wrap = true
    vim.opt_local.spell = true
  end,
})
```

### Adding Vim Options

```lua
-- In lua/config/options.lua
vim.opt.your_option = value
-- Or for global vars
vim.g.your_global = value
```

### Creating a Utility Function

```lua
-- In lua/config/util.lua
local M = {}

M.your_function = function(args)
  -- Implementation
end

return M
-- Usage: require("config.util").your_function(args)
```

### Adding Custom Snippets

Place snippet files in `snippets/` directory (VSCode format).

## Colorscheme & Theme

### Auto Theme Detection (macOS)

The configuration automatically detects macOS appearance:
- Uses `defaults read -g AppleInterfaceStyle` for detection
- Watches `~/.local/state/theme/mode` when in tmux (dark-notify)
- Falls back to polling every 5s outside tmux

### Manual Theme Toggle

```vim
:lua vim.o.background = "dark"  " or "light"
```

### Available Themes

| Command | Theme |
|---------|-------|
| `:colorscheme tokyonight` | Tokyo Night (default) |
| `:colorscheme monokai-pro` | Monokai Pro |
| `:colorscheme NeoSolarized` | Solarized |

## Formatting & Linting

### Conform (Formatting)

```lua
-- In lua/plugins/tools.lua
require("conform").setup({
  formatters_by_ft = {
    javascript = { "prettierd" },
    typescript = { "prettierd" },
    lua = { "stylua" },
    -- Add your filetype
  },
})
```

### Nvim-lint (Linting)

```lua
-- In lua/plugins/tools.lua
require("lint").linters_by_ft = {
  javascript = { "eslint_d" },
  typescript = { "eslint_d" },
}
```

## AI Integration

### CodeCompanion

Configured for DeepSeek API with custom system prompts.

| Key | Action |
|-----|--------|
| `<leader>acs` | Open Actions |
| `<leader>act` | Toggle Chat |
| `<leader>aca` | Add Selection to Chat |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Plugin not loading | Check `nvim-pack-lock.json`, restart nvim |
| LSP not starting | Check `:checkhealth vim.lsp`, verify server installed |
| Icons missing | Install a Nerd Font |
| Blink.cmp not working | Run `:packadd blink.cmp`, check build output |
| Treesitter errors | Run `:TSUpdate` |
| Keybinding conflicts | `:verbose map <key>` |

### Health Check

```vim
:checkhealth
```

### Debug Mode

```lua
-- Temporarily add to init.lua or relevant file
vim.lsp.log.set_level(vim.log.levels.DEBUG)
-- Or for plugins
log_level = vim.log.levels.DEBUG
```

## Resources

- [Neovim 0.12 Documentation](https://neovim.io/doc/)
- [vim.pack API](https://neovim.io/doc/user/lua.html#vim.pack)
- [vim.lsp.config](https://neovim.io/doc/user/lsp.html#vim.lsp.config())
- [Snacks.nvim](https://github.com/folke/snacks.nvim)
- [Blink.cmp](https://github.com/Saghen/blink.cmp)
