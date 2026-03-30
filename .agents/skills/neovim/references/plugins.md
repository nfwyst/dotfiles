# Plugin Reference

All plugins in the current configuration, organized by category.

## Dependencies

| Plugin | Purpose |
|--------|---------|
| [nui.nvim](https://github.com/MunifTanjim/nui.nvim) | UI component library (used by Noice) |
| [plenary.nvim](https://github.com/nvim-lua/plenary.nvim) | Lua utility library |
| [nvim-web-devicons](https://github.com/nvim-tree/nvim-web-devicons) | File type icons |
| [SchemaStore.nvim](https://github.com/b0o/SchemaStore.nvim) | JSON/YAML schema catalog |

## Colorschemes

| Plugin | Purpose |
|--------|---------|
| [tokyonight.nvim](https://github.com/folke/tokyonight.nvim) | Default colorscheme (transparent bg) |
| [monokai-pro.nvim](https://github.com/loctvl842/monokai-pro.nvim) | "spectrum" filter |
| [NeoSolarized.nvim](https://github.com/Tsuzat/NeoSolarized.nvim) | Light mode option |

## Treesitter

| Plugin | Purpose |
|--------|---------|
| [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter) | Syntax highlighting, text objects (`main` branch) |
| [nvim-treesitter-context](https://github.com/nvim-treesitter/nvim-treesitter-context) | Sticky function/class context |

## Completion

| Plugin | Purpose |
|--------|---------|
| [blink.cmp](https://github.com/saghen/blink.cmp) | Fast completion (Rust fuzzy, built from source) |
| [friendly-snippets](https://github.com/rafamadriz/friendly-snippets) | Snippet collection |

## Editor

| Plugin | Purpose |
|--------|---------|
| [which-key.nvim](https://github.com/folke/which-key.nvim) | Keybinding hints |
| [gitsigns.nvim](https://github.com/lewis6991/gitsigns.nvim) | Git gutter signs, hunk actions |
| [resolve.nvim](https://github.com/spacedentist/resolve.nvim) | Symlink resolution |
| [grug-far.nvim](https://github.com/MagicDuck/grug-far.nvim) | Find and replace across files |
| [trouble.nvim](https://github.com/folke/trouble.nvim) | Diagnostics, references, quickfix UI |
| [flash.nvim](https://github.com/folke/flash.nvim) | Navigation / motion |
| [todo-comments.nvim](https://github.com/folke/todo-comments.nvim) | TODO/FIXME/HACK highlighting |

## UI

| Plugin | Purpose |
|--------|---------|
| [snacks.nvim](https://github.com/folke/snacks.nvim) | Unified UI: picker, explorer, dashboard, notifier, terminal, dim, scroll, etc. |
| [lualine.nvim](https://github.com/nvim-lualine/lualine.nvim) | Statusline + winbar |
| [bufferline.nvim](https://github.com/akinsho/bufferline.nvim) | Buffer tab bar |
| [noice.nvim](https://github.com/folke/noice.nvim) | Messages, cmdline, notifications UI |
| [vimade](https://github.com/tadaa/vimade) | Dim inactive windows ("duo" recipe) |

## Coding

| Plugin | Purpose |
|--------|---------|
| [mini.pairs](https://github.com/nvim-mini/mini.pairs) | Auto-close brackets |
| [mini.ai](https://github.com/nvim-mini/mini.ai) | Enhanced text objects |
| [mini.surround](https://github.com/nvim-mini/mini.surround) | Surround operations |
| [nvim-ts-autotag](https://github.com/windwp/nvim-ts-autotag) | Auto-close/rename HTML tags |
| [lazydev.nvim](https://github.com/folke/lazydev.nvim) | Neovim Lua API completions |

## Language

| Plugin | Purpose |
|--------|---------|
| [render-markdown.nvim](https://github.com/MeanderingProgrammer/render-markdown.nvim) | Markdown rendering |

## Tools

| Plugin | Purpose |
|--------|---------|
| [mason.nvim](https://github.com/mason-org/mason.nvim) | LSP/formatter/linter installer |
| [conform.nvim](https://github.com/stevearc/conform.nvim) | Formatting engine |
| [nvim-lint](https://github.com/mfussenegger/nvim-lint) | Async linting (ESLint) |
| [codecompanion.nvim](https://github.com/olimorris/codecompanion.nvim) | AI assistant (Anthropic Claude) |
| [leetcode.nvim](https://github.com/kawre/leetcode.nvim) | LeetCode integration |
| [checkmate.nvim](https://github.com/bngarren/checkmate.nvim) | Todo/checklist management |
| [ts-worksheet-neovim](https://github.com/typed-rocks/ts-worksheet-neovim) | TypeScript worksheet |
| [uv.nvim](https://github.com/benomahony/uv.nvim) | Python uv integration |

## Notable Absences (vs. LazyVim)

These plugins are **NOT used** in this config:

| Not Used | Replaced By |
|----------|-------------|
| lazy.nvim | `vim.pack` (built-in) |
| nvim-lspconfig `setup()` | `lsp/*.lua` + `vim.lsp.enable()` (native) |
| telescope.nvim | `Snacks.picker` |
| neo-tree.nvim | `Snacks.explorer` |
| nvim-cmp | `blink.cmp` |
| nvim-notify | `Snacks.notifier` |
| toggleterm.nvim | `Snacks.terminal` |
| indent-blankline.nvim | `Snacks.indent` |
| dashboard-nvim | `Snacks.dashboard` |
| fugitive.vim | `Snacks.lazygit` + `gitsigns.nvim` |
