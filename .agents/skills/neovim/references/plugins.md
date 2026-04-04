# Plugins Reference

Complete plugin list with descriptions and configuration locations.

## Dependencies

| Plugin | Purpose | Config |
|---|---|---|
| [nui.nvim](https://github.com/MunifTanjim/nui.nvim) | UI component library (used by noice) | — |
| [plenary.nvim](https://github.com/nvim-lua/plenary.nvim) | Lua utility library | — |
| [nvim-web-devicons](https://github.com/nvim-tree/nvim-web-devicons) | File type icons | — |
| [SchemaStore.nvim](https://github.com/b0o/SchemaStore.nvim) | JSON/YAML/TOML schemas | Used in jsonls, yamlls, taplo |

## Colorschemes

| Plugin | Purpose | Config |
|---|---|---|
| [tokyonight.nvim](https://github.com/folke/tokyonight.nvim) | Primary theme (storm dark, day light) | `plugins/colorscheme.lua` |
| [monokai-pro.nvim](https://github.com/loctvl842/monokai-pro.nvim) | Alternate theme (classic filter) | `plugins/colorscheme.lua` |
| [NeoSolarized.nvim](https://github.com/Tsuzat/NeoSolarized.nvim) | Alternate theme | `plugins/colorscheme.lua` |

## Treesitter

| Plugin | Purpose | Config |
|---|---|---|
| [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter) | Syntax highlighting, text objects | `plugins/coding.lua` (main branch) |
| [nvim-treesitter-context](https://github.com/nvim-treesitter/nvim-treesitter-context) | Sticky function/class context header | `plugins/coding.lua` |

## Completion

| Plugin | Purpose | Config |
|---|---|---|
| [blink.cmp](https://github.com/saghen/blink.cmp) | Fast completion (Rust fuzzy) | `plugins/coding.lua` |
| [friendly-snippets](https://github.com/rafamadriz/friendly-snippets) | Snippet collection | — |

## Editor

| Plugin | Purpose | Config |
|---|---|---|
| [which-key.nvim](https://github.com/folke/which-key.nvim) | Keymap hints | `plugins/editor.lua` |
| [gitsigns.nvim](https://github.com/lewis6991/gitsigns.nvim) | Git signs, hunk operations, blame | `plugins/editor.lua` |
| [resolve.nvim](https://github.com/spacedentist/resolve.nvim) | Git conflict resolution | `plugins/editor.lua` |
| [grug-far.nvim](https://github.com/MagicDuck/grug-far.nvim) | Search and replace (ripgrep) | `plugins/editor.lua` |
| [trouble.nvim](https://github.com/folke/trouble.nvim) | Diagnostics/quickfix panel | `plugins/editor.lua` |
| [flash.nvim](https://github.com/folke/flash.nvim) | Enhanced search/jump | `plugins/editor.lua` |
| [todo-comments.nvim](https://github.com/folke/todo-comments.nvim) | TODO/FIX/FIXME highlighting | `plugins/editor.lua` |

## UI

| Plugin | Purpose | Config |
|---|---|---|
| [snacks.nvim](https://github.com/folke/snacks.nvim) | Unified UI framework | `plugins/ui.lua` |
| [noice.nvim](https://github.com/folke/noice.nvim) | Command line, messages, notifications | `plugins/ui.lua` |
| [lualine.nvim](https://github.com/nvim-lualine/lualine.nvim) | Statusline/winbar | `plugins/ui.lua` |
| [bufferline.nvim](https://github.com/akinsho/bufferline.nvim) | Buffer tabs | `plugins/ui.lua` |
| [vimade](https://github.com/tadaa/vimade) | Dim inactive windows | `plugins/ui.lua` |

## Coding

| Plugin | Purpose | Config |
|---|---|---|
| [mini.pairs](https://github.com/nvim-mini/mini.pairs) | Auto-pairs (with markdown backtick override) | `plugins/coding.lua` |
| [mini.ai](https://github.com/nvim-mini/mini.ai) | Enhanced text objects | `plugins/coding.lua` |
| [mini.surround](https://github.com/nvim-mini/mini.surround) | Surround operations (gs prefix) | `plugins/coding.lua` |
| [nvim-ts-autotag](https://github.com/windwp/nvim-ts-autotag) | Auto close/rename HTML/JSX tags | `plugins/coding.lua` |
| [render-markdown.nvim](https://github.com/MeanderingProgrammer/render-markdown.nvim) | Markdown rendering (all modes) | `plugins/coding.lua` |
| [lazydev.nvim](https://github.com/folke/lazydev.nvim) | Lua/Neovim dev support | `plugins/coding.lua` |

## Tools

| Plugin | Purpose | Config |
|---|---|---|
| [mason.nvim](https://github.com/mason-org/mason.nvim) | LSP/tool binary manager | `plugins/tools.lua` |
| [conform.nvim](https://github.com/stevearc/conform.nvim) | Formatting engine | `plugins/tools.lua` |
| [nvim-lint](https://github.com/mfussenegger/nvim-lint) | Async linting | `plugins/tools.lua` |
| [codecompanion.nvim](https://github.com/olimorris/codecompanion.nvim) | AI assistant (DeepSeek Reasoner) | `plugins/tools.lua` |
| [leetcode.nvim](https://github.com/kawre/leetcode.nvim) | LeetCode (CN, TypeScript) | `plugins/tools.lua` |
| [checkmate.nvim](https://github.com/bngarren/checkmate.nvim) | Todo checkboxes in markdown | `plugins/tools.lua` |
| [ts-worksheet-neovim](https://github.com/typed-rocks/ts-worksheet-neovim) | Run JS/TS inline (bun runtime) | `plugins/tools.lua` |
| [uv.nvim](https://github.com/benomahony/uv.nvim) | Python uv integration | `plugins/tools.lua` |

## Plugin Count

**Total: 35 plugins** (4 deps + 3 colorschemes + 2 treesitter + 2 completion + 7 editor + 5 UI + 6 coding + 8 tools - 2 overlap = 35 unique)
