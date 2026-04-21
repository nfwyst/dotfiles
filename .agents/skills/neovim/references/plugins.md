# Neovim Plugin Reference

## Plugin Manager

**vim.pack** — Neovim 0.12+ native package manager. NOT lazy.nvim.

All plugins are loaded via `vim.pack.add()` calls in `plugins/init.lua`. There is no lazy-loading in the traditional sense; all plugins load at startup, but their configurations are deferred.

## Plugin List (~35 total)

### Dependencies
- **nui.nvim** — UI component library
- **plenary.nvim** — Lua utility functions
- **nvim-web-devicons** — File type icons
- **SchemaStore.nvim** — JSON/YAML schema catalog

### Colorschemes (only 3)
- **tokyonight.nvim**
- **monokai-pro.nvim**
- **NeoSolarized.nvim**

NOT included: catppuccin, rose-pine, kanagawa, or any others.

### Treesitter
- **nvim-treesitter** (main branch) — syntax highlighting, textobjects
- **nvim-treesitter-context** — sticky function/class context at top of buffer

### Completion
- **blink.cmp** — Completion engine with Rust fuzzy matching, built from source via cargo
- **friendly-snippets** — Snippet collection

### Editor
- **which-key** — Keybinding hints popup
- **gitsigns** — Git gutter signs and hunk actions
- **resolve.nvim** — Merge conflict resolution
- **grug-far** — Find and replace across files
- **trouble** — Diagnostics list
- **flash** — Motion/jump plugin
- **todo-comments** — Highlight and search TODO/FIXME/etc

### UI
- **lualine** — Statusline
- **bufferline** — Buffer/tab line
- **noice** — UI for messages, cmdline, popupmenu
- **snacks.nvim** — Swiss-army-knife utility plugin
- **vimade** — Dim inactive windows

### Coding
- **mini.pairs** — Auto-pair brackets/quotes
- **mini.ai** — Enhanced textobjects
- **mini.surround** — Surround operations
- **nvim-ts-autotag** — Auto close/rename HTML tags
- **lazydev** — Lua dev environment for Neovim config
- **ts-worksheet-neovim** — TypeScript scratch evaluation

### Language
- **render-markdown.nvim** — Render markdown in-buffer

### Tools
- **mason.nvim** — External tool installer
- **conform.nvim** — Formatter manager
- **nvim-lint** — Linter manager

### AI
- **codecompanion.nvim** — AI code assistant

### Utilities
- **leetcode.nvim** — LeetCode integration
- **checkmate.nvim** — Markdown checkbox management
- **uv.nvim** — Python uv integration

## PackChanged Hooks

- **blink.cmp**: runs `cargo build --release` after update
- **nvim-treesitter**: runs `:TSUpdate` after update

## Ghostty Support

Ghostty terminal is supported via an additional runtime path entry.

## Disabled Built-ins

Only 4 built-in plugins are disabled:
1. `netrwPlugin`
2. `rplugin`
3. `tohtml`
4. `tutor`

## Cleanup

- Deferred cleanup of inactive/unused plugin directories
- `:PlugSync` command available for manual sync

## blink.cmp Details

- **Fuzzy matching**: Rust implementation (`prebuilt_binaries.download = false`, built from source)
- **Sources**: lsp, path, snippets, buffer; Lua filetypes add lazydev source
- **Keymap preset**: `enter`
  - `C-y` = select_and_accept
  - `C-l` = show completions
- **Cmdline**: `auto_show` enabled for `:` commands; `ghost_text` for search
- **Completion menu**: rounded border, no scrollbar

## Snacks Features

dashboard, animate, scope, bigfile, quickfile, scroll, indent, input, notifier, statuscolumn, words, lazygit, dim, image (enabled), explorer (replace_netrw), picker

## Other Coding Plugin Details

- **treesitter-context**: Sticky context lines at top of buffer
- **mini.pairs**: Includes markdown triple-backtick override
- **mini.ai**: Custom textobjects:
  - `o` = block
  - `f` = function
  - `c` = class
  - `t` = tag
  - `d` = digit
  - `e` = word
  - `u`/`U` = function_call
- **mini.surround**: Uses `gs` prefix (not default `s`)
- **nvim-ts-autotag**: Auto close/rename HTML-like tags
- **render-markdown**: Render modes: n (normal), c (command), t (terminal), i (insert)
- **lazydev**: Configured with snacks and luv library paths
- **ts-worksheet**: TypeScript scratch evaluation in buffer
