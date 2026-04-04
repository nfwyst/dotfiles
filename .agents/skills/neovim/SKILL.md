---
name: neovim
description: Neovim 0.12+ native configuration — vim.pack, native LSP, Snacks UI, blink.cmp, conform, nvim-lint
version: 2.0.0
---

# Neovim Configuration Skill

> Neovim 0.12+ native configuration — vim.pack, native LSP, Snacks UI framework

## Architecture Overview

This configuration runs on **Neovim 0.12+** and is fully migrated away from LazyVim/lazy.nvim. It uses:

- **`vim.pack`** — Neovim's built-in plugin manager (replaces lazy.nvim)
- **Native LSP** — `vim.lsp.config()` + `vim.lsp.enable()` (replaces nvim-lspconfig)
- **Snacks.nvim** — Unified UI framework: picker, explorer, dashboard, notifier, terminal, image, and more
- **blink.cmp** — Fast completion engine (Rust fuzzy matching, built from source via cargo)
- **conform.nvim** — Formatting engine with eslint_d / prettierd / stylua
- **nvim-lint** — Async linting (eslint_d, vale, bash, zsh)

## Directory Structure

```
~/.config/nvim/
├── init.lua                    # Entry: options → hack → plugins → lsp → keymaps → autocmds
├── nvim-pack-lock.json         # vim.pack lockfile (version-controlled)
├── stylua.toml                 # Lua formatter config
├── lsp/                        # Native LSP server configs (auto-discovered by vim.lsp.config)
│   ├── lua_ls.lua              # Lua Language Server
│   ├── vtsls.lua               # TypeScript/JavaScript (+ Vue Hybrid Mode plugin)
│   ├── vue_ls.lua              # Vue Language Server (Volar)
│   ├── html.lua                # HTML
│   ├── cssls.lua               # CSS/SCSS/Less
│   ├── css_variables.lua       # CSS Variables
│   ├── cssmodules_ls.lua       # CSS Modules (runs via bun)
│   ├── emmet_language_server.lua # Emmet (runs via bun)
│   ├── tailwindcss.lua         # Tailwind CSS (runs via bun, auto-stops without config)
│   ├── taplo.lua               # TOML (with SchemaStore)
│   ├── jsonls.lua              # JSON/JSONC (with SchemaStore)
│   ├── yamlls.lua              # YAML (with SchemaStore)
│   ├── solc.lua                # Solidity
│   ├── protols.lua             # Protocol Buffers
│   └── docker_language_server.lua # Dockerfile
├── lua/
│   ├── config/
│   │   ├── options.lua         # vim.opt settings, filetype additions, paste guard
│   │   ├── keymaps.lua         # All keybindings (leader, LSP, picker, quickfix, custom)
│   │   ├── autocmds.lua        # Autocommands (yank highlight, restore cursor, undo guard, etc.)
│   │   ├── lsp.lua             # Native LSP: Mason PATH, diagnostics, vim.lsp.enable(), inlay hints
│   │   ├── util.lua            # Helpers: root detection, icons, eslint config finder
│   │   ├── constant.lua        # ESLint config file list
│   │   ├── hack.lua            # Diagnostic blacklist filter (suppresses noisy TS/eslint_d codes)
│   │   └── price.lua           # ETH price ticker for lualine (Binance/CoinGecko/Kraken)
│   └── plugins/
│       ├── init.lua            # vim.pack.add() + PackChanged hooks + PlugSync + cleanup
│       ├── colorscheme.lua     # tokyonight/monokai-pro/NeoSolarized + macOS auto dark mode
│       ├── ui.lua              # Snacks, Noice, Lualine, Bufferline, Vimade
│       ├── editor.lua          # which-key, gitsigns, resolve.nvim, grug-far, trouble, flash, todo-comments
│       ├── coding.lua          # treesitter, blink.cmp, mini.pairs/ai/surround, ts-autotag, render-markdown, lazydev
│       └── tools.lua           # mason, conform, nvim-lint, codecompanion (AI), leetcode, checkmate, uv.nvim, ts-worksheet
├── after/
│   ├── plugin/
│   │   └── snacks-image-fix.lua  # Fix: images invisible after floating windows close
│   └── queries/markdown/
│       └── injections.scm        # MDX: inject tsx for import/export/JSX in markdown
└── snippets/                     # Custom VSCode-format snippets
    ├── antd.json
    ├── arco.json
    ├── arco-business.json
    ├── hook.json
    ├── node.json
    ├── react.json
    └── package.json
```

## Plugin Management (vim.pack)

### How It Works

Plugins are declared in `lua/plugins/init.lua` via `vim.pack.add()`:

```lua
vim.pack.add({
  "https://github.com/folke/snacks.nvim",
  { src = "https://github.com/nvim-treesitter/nvim-treesitter", version = "main" },
  -- ...
})
```

- **Lockfile**: `nvim-pack-lock.json` — tracks exact commits, version-controlled
- **Install location**: `~/.local/share/nvim/site/pack/core/opt/`
- **Events**: `PackChangedPre` / `PackChanged` — used for post-install hooks
- **No lazy loading syntax**: Use `vim.schedule()` / `vim.defer_fn()` or autocmds for deferred loading
- **Message suppression**: `shortmess = "aAFOTIcC"` during `vim.pack.add()` to prevent hit-enter prompt before noice loads

### Post-Install Hooks (PackChanged)

```lua
-- blink.cmp: cargo build after install/update
if name == "blink.cmp" and (kind == "install" or kind == "update") then
  vim.system({ "cargo", "build", "--release" }, { cwd = dir })
end
-- treesitter: TSUpdate after install/update
if name == "nvim-treesitter" and (kind == "install" or kind == "update") then
  vim.cmd("TSUpdate")
end
```

### Treesitter Runtime Bridge

The main branch stores queries at `runtime/queries/{lang}/`. Neovim expects `{rtp}/queries/{lang}/`. Solved by prepending treesitter's `runtime/` to rtp:

```lua
local ts_runtime = vim.fn.stdpath("data") .. "/site/pack/core/opt/nvim-treesitter/runtime"
if vim.uv.fs_stat(ts_runtime) then vim.opt.rtp:prepend(ts_runtime) end
```

### Startup Cleanup

On every startup (deferred 300ms), inactive plugins are cleaned up via `vim.pack.del()`. No network IO.

### Disabled Built-ins

`gzip`, `netrwPlugin`, `rplugin`, `tarPlugin`, `tohtml`, `tutor`, `zipPlugin`

### Ghostty Terminal Support

```lua
if vim.env.TERMINAL == "ghostty" then
  vim.opt.rtp:append("/Applications/Ghostty.app/Contents/Resources/vim/vimfiles")
end
```

### Key Commands

| Command | Action |
|---|---|
| `:PlugSync` | Clean inactive plugins + update all |
| `vim.pack.update()` | Update all plugins |
| `vim.pack.get()` | List all managed plugins |

## Native LSP Setup (Neovim 0.12+)

### Architecture

```
lsp/*.lua           → Server-specific configs (auto-discovered by vim.lsp.config)
lua/config/lsp.lua  → Mason PATH, diagnostics, global settings, vim.lsp.enable()
```

### How Server Configs Work

Each file in `lsp/` exports a `vim.lsp.Config` table:

```lua
--- @type vim.lsp.Config
return {
  cmd = { "lua-language-server" },
  filetypes = { "lua" },
  root_markers = { ".luarc.jsonc", ".stylua.toml", ".git" },
  settings = { Lua = { ... } },
}
```

### Mason Integration (Standalone)

No mason-lspconfig bridge. Mason only manages binary installation. PATH is prepended manually:

```lua
local mason_bin = vim.fn.stdpath("data") .. "/mason/bin"
vim.env.PATH = mason_bin .. ":" .. vim.env.PATH
```

Auto-install via deferred `mason-registry` refresh (100ms after startup).

### Enabled Servers

```lua
vim.lsp.enable({
  "lua_ls", "vtsls", "html", "cssls", "css_variables", "cssmodules_ls",
  "emmet_language_server", "tailwindcss", "taplo", "solc", "protols",
  "docker_language_server", "jsonls", "yamlls", "vue_ls",
})
```

### Global LSP Settings

- **Semantic tokens disabled**: `on_attach` sets `semanticTokensProvider = nil` for all servers
- **LSP log disabled**: `vim.lsp.log.set_level(vim.log.levels.OFF)`
- **Inlay hints auto-enabled**: `LspAttach` autocmd enables for supporting servers
- **File operations**: `workspace.fileOperations.didRename/willRename` enabled

### Vue Hybrid Mode

- **vue_ls** (Volar) — handles `<template>` and `<style>` intellisense
- **vtsls** with `@vue/typescript-plugin` — handles `<script>` TypeScript in `.vue` files
- Both resolve tsdk from Mason-installed vtsls bundle
- `vue_plugin_path` resolved from `mason/packages/vue-language-server/node_modules/@vue/language-server`
- vtsls includes `"vue"` in its filetypes list

### Diagnostics Config

```lua
vim.diagnostic.config({
  underline = false,
  virtual_lines = false,
  virtual_text = { spacing = 0, current_line = true },
  severity_sort = true,
  signs = { text = { [ERROR] = "", [WARN] = "", [INFO] = "", [HINT] = "󰌶" } },
})
```

### Diagnostic Blacklist (hack.lua)

Suppresses noisy diagnostics via `vim.diagnostic.set` override:

| Source | Suppressed |
|---|---|
| `eslint_d` | Messages matching `path::String` or `projectService` |
| `ts` | `File is a CommonJS module` |
| `ts` | Codes: 7016, 80001, 80006, 80007, 2305, 6387, 7044, 1149 |

### Key Differences from nvim-lspconfig

| Old (nvim-lspconfig) | New (Native 0.12) |
|---|---|
| `require('lspconfig').lua_ls.setup({...})` | `lsp/lua_ls.lua` + `vim.lsp.enable('lua_ls')` |
| `lspconfig.util.root_pattern(...)` | `root_markers = { ... }` |
| `:LspInfo` | `:checkhealth vim.lsp` |
| `vim.lsp.get_active_clients()` | `vim.lsp.get_clients()` |
| `client.request()` | `Client:request()` |

## Completion (blink.cmp)

- Built from source via `cargo build --release` (Rust fuzzy matcher, `download = false`)
- Sources: LSP, path, snippets, buffer, lazydev (for Lua)
- Keybindings: `<C-space>` / `<C-l>` show, `<CR>` accept (enter preset), `<C-y>` select+accept, `<C-n>`/`<C-p>` navigate, `<Tab>`/`<S-Tab>` snippet jump
- Cmdline completion: auto-show for `:` commands, ghost text for `/`/`?` search
- Cmdline position integrates with Noice (`vim.g.ui_cmdline_pos`)
- Custom snippets from `~/.config/nvim/snippets/` (react, antd, arco, node, hooks)
- MDX snippets extend JS/TS/HTML filetypes

## Snacks.nvim Framework

Snacks provides a unified UI layer. Requires `needs_setup = true` modules to call `require("snacks").setup()`.

| Module | Description |
|---|---|
| `Snacks.picker` | File finder, grep, LSP symbols, git — replaces Telescope |
| `Snacks.explorer` | File tree sidebar (right side, width 50) — replaces neo-tree |
| `Snacks.dashboard` | Start screen with fortune |
| `Snacks.notifier` | Notification system |
| `Snacks.lazygit` | Lazygit integration |
| `Snacks.terminal` | Floating terminal (rounded border) |
| `Snacks.bufdelete` | Safe buffer deletion |
| `Snacks.words` | Reference navigation |
| `Snacks.dim` | Dim inactive code |
| `Snacks.scratch` | Scratch buffers (used for todo lists) |
| `Snacks.toggle` | Toggle animations, zoom, zen, indent, scroll |
| `Snacks.quickfile` | Fast file open before plugins load |
| `Snacks.bigfile` | Disable features for large files |
| `Snacks.image` | Kitty graphics protocol image rendering |
| `Snacks.input` | Enhanced input UI |
| `Snacks.statuscolumn` | Custom status column |
| `Snacks.scope` | Scope detection (debounce 45ms) |
| `Snacks.scroll` | Smooth scroll with animation |
| `Snacks.rename` | File rename with LSP |

### Explorer Config

```lua
explorer = {
  replace_netrw = true,  -- nvim . opens explorer instead of blank buffer
}
-- In picker.sources.explorer:
layout = { hidden = { "input" }, auto_hide = { "input" }, layout = { width = 50, position = "right" } }
-- Keys: "/" toggle input in normal mode, "<Esc>" toggle input in both modes
```

### Picker Config

```lua
picker = {
  hidden = true,     -- show hidden files
  ignored = true,    -- show gitignored files
  exclude = { "**/.git/*", "node_modules", "dist", "log", ".vscode", ".DS_Store", "thumbs.db" },
  layout = { preset = "vertical", layout = { width = 0.88, height = 0.88 } },
  -- <a-c> toggle cwd/root, <c-e> toggle hidden, <c-r> toggle ignored
}
```

### Image Fix (after/plugin/snacks-image-fix.lua)

Workaround for images becoming invisible after floating windows (picker, noice, hover) close. On `WinClosed`, debounces then: cleans all placements → nudges buffers to trigger fresh re-render. Tracking: [snacks.nvim#2634](https://github.com/folke/snacks.nvim/issues/2634).

## Treesitter

### Setup Strategy

A custom `try_treesitter_start()` function in `coding.lua` runs on every `FileType` event:

1. Check if `highlights.scm` queries exist via `vim.treesitter.query.get(lang, "highlights")`
2. If queries exist → `vim.treesitter.start(buf, lang)`
3. If no queries → stop treesitter if running, restore `vim.bo.syntax` fallback

Safety net: `VimEnter` autocmd catches buffers loaded before init finished.

### Language Registration

```lua
vim.treesitter.language.register("bash", "zsh")
vim.treesitter.language.register("markdown", { "checkhealth", "mdx" })
```

### Custom Predicate: `is-filetype?`

Used in `after/queries/markdown/injections.scm` to restrict tsx injection to mdx files only:

```scm
((inline) @injection.content
 (#is-filetype? @injection.content "mdx")
 (#match? @injection.content "^\\s*(import|export)\\s")
 (#set! injection.language "tsx"))
```

### Treesitter Context

`treesitter-context` with `zindex = 25`. Keymap: `gC` → go to context (super scope).

## Colorscheme & Dark Mode

### Theme Stack

1. **tokyonight** (primary) — storm style dark, day style light
2. **monokai-pro** (alternate) — classic filter, transparent
3. **NeoSolarized** (alternate) — transparent, italics

### macOS Auto Dark Mode

Two strategies based on environment:

| Condition | Strategy |
|---|---|
| Inside tmux + `~/.local/state/theme/mode` exists | **File watch** (kqueue via `vim.uv.new_fs_event`) — zero polling, reacts to dark-notify |
| Outside tmux or no state file | **Polling** every 5s via `defaults read -g AppleInterfaceStyle` |

### Custom Highlights (re-applied on every ColorScheme event)

- `BufferLineBufferSelected` / `LspInlayHint`: italic
- `TabLineFill`: transparent background
- Dark mode only: `CursorLine`, `BlinkCmpGhostText`, `SnacksPickerInputBorder/Title` custom colors

## Formatting (conform.nvim)

- **Format on save** via `BufWritePre` (controlled by `vim.g.autoformat` / `vim.b.autoformat`)
- **Post-save retab**: converts tabs to spaces after format
- **Fix mode toggle**: `<leader>ci` runs eslint_d fix, `<leader>cf` runs prettierd format
- **Prettierrc selection**: `shiftwidth == 4` → `.prettierrc_tab.json`, else `.prettierrc.json`
- **Injected formatting**: `<leader>cF` formats injected languages

| Filetype | Formatter |
|---|---|
| JS/TS/JSX/TSX/Svelte | prettierd (format) / eslint_d (fix) |
| CSS/SCSS/Less/HTML/JSON/YAML/GraphQL | prettierd |
| Markdown | prettierd + markdownlint-cli2 + markdown-toc |
| MDX | prettierd / eslint_d |
| Lua | stylua |
| Shell | shfmt |
| Zsh | beautysh |
| TOML | taplo |
| HTTP | kulala-fmt |
| Nginx | nginxfmt |
| SQL | sqruff |
| Nu | (none) |

## Linting (nvim-lint)

- Async linting via `BufWritePost` / `BufReadPost` / `InsertLeave`
- `ESLINT_D_PPID` set to Neovim PID for eslint_d lifecycle
- eslint_d config auto-detected via `util.get_file_path()` (walks up to find config, checks `package.json` for `eslintConfig` field)

| Filetype | Linter |
|---|---|
| JS/TS/JSX/TSX/Svelte | eslint_d |
| Shell | bash |
| Zsh | zsh |
| Markdown | vale |

## AI Integration (codecompanion.nvim)

- **Primary adapter**: DeepSeek Reasoner (`deepseek-reasoner`)
- **System prompt**: 全能写作专家 (covers academic, technical, business, creative writing)
- **Keymaps**: `<leader>acs` actions, `<leader>act` toggle chat, `<leader>aca` add selection
- **Abbreviation**: `:cc` → `:CodeCompanion`

## Lualine Statusline

Global statusline (`laststatus = 3`) with:

| Section | Content |
|---|---|
| `lualine_a` | Mode |
| `lualine_b` | Branch |
| `lualine_c` | Root dir (`util.root()`) + LSP names + Diagnostics |
| `lualine_x` | ETH price ticker (Binance/CoinGecko/Kraken, 6s refresh) |
| `lualine_y` | Filetype + Selection count + Shiftwidth + Encoding |
| `lualine_z` | Progress + Location |

**Winbar**: Filename (path=3, italic) + Search count indicator

### ETH Price Ticker (config/price.lua)

- Rotates between 3 API endpoints (Binance, CoinGecko, Kraken)
- Random User-Agent rotation
- Deferred setup: network requests start after `UIEnter`
- Toggle: `<leader>cUp`

## Additional Plugins

### Editor

| Plugin | Purpose |
|---|---|
| **which-key** | Keymap hints (classic preset, rounded border) |
| **gitsigns** | Git signs, hunk navigation/stage/reset, blame |
| **resolve.nvim** | Git conflict resolution (ours/theirs/both/none) |
| **grug-far** | Search and replace (ripgrep, `--no-ignore --hidden`) |
| **trouble** | Diagnostics/quickfix/symbols panel |
| **flash** | Enhanced search/jump (`s`=jump, `S`=treesitter) |
| **todo-comments** | TODO/FIX/FIXME highlighting and search |

### Coding

| Plugin | Purpose |
|---|---|
| **mini.pairs** | Auto-pairs (markdown triple backtick override) |
| **mini.ai** | Enhanced text objects (function, class, block, tag, word parts) |
| **mini.surround** | Surround operations (`gs` prefix) |
| **nvim-ts-autotag** | Auto close/rename HTML/JSX/Vue/Svelte tags |
| **render-markdown** | Markdown rendering in all modes (headings, code, checkboxes, latex, HTML think tags) |
| **lazydev** | Lua/Neovim development support (luv, snacks.nvim libraries) |
| **ts-worksheet** | Run JS/TS files inline (`<leader>ce`, runtime=bun) |

### Tools

| Plugin | Purpose |
|---|---|
| **mason** | LSP/tool binary manager (standalone, no bridge) |
| **conform** | Format engine |
| **nvim-lint** | Lint engine |
| **codecompanion** | AI assistant (DeepSeek Reasoner) |
| **leetcode** | LeetCode integration (TypeScript, CN site, snacks-picker) |
| **checkmate** | Todo list in markdown files |
| **uv.nvim** | Python uv integration (`<leader>cUu` prefix) |

### UI

| Plugin | Purpose |
|---|---|
| **vimade** | Dim inactive windows (duo recipe with animation, terminals excluded) |
| **noice** | Command line UI, message routing, LSP hover/signature override |
| **bufferline** | Buffer tabs (index files show `parent/index.ext`) |

## Key Design Decisions

1. **No lazy loading framework** — vim.pack has no built-in lazy loading; use `vim.schedule()` / `vim.defer_fn()` or autocmds
2. **Semantic tokens disabled** — `on_attach` sets `semanticTokensProvider = nil` for all servers
3. **LSP log disabled** — `vim.lsp.log.set_level(vim.log.levels.OFF)`
4. **Inlay hints auto-enabled** — via `LspAttach` autocmd for supporting servers
5. **termsync disabled in tmux** — prevents double-sync cursor ghosting
6. **Diagnostic blacklist** — `hack.lua` filters noisy TS/eslint_d diagnostics via `vim.diagnostic.set` override
7. **Paste guard** — custom `vim.paste` skips `nvim_put` in non-modifiable buffers (E21 fix)
8. **Undo file guard** — disables `undofile` for buffers with path > 255 chars (E828 on macOS)
9. **Global statusline** — `vim.o.laststatus = 3`
10. **Bufferline disambiguation** — `index` files show `parent/index.ext`
11. **Vimade terminal blocklist** — `snacks_terminal`, `opencode_terminal` excluded from dimming
12. **blink.cmp from source** — `download = false`, build via cargo for Rust fuzzy matching
13. **Resilient init** — `safe_require()` wrapper defers errors to `UIEnter` so one module's failure doesn't block others

## Common Tasks

### Add a New Plugin

```lua
-- 1. Add URL to vim.pack.add() in lua/plugins/init.lua
vim.pack.add({
  -- ...existing...
  "https://github.com/author/plugin-name",
})

-- 2. Add config in appropriate lua/plugins/*.lua file
-- 3. Run :PlugSync or restart Neovim
```

### Add a New LSP Server

```lua
-- 1. Create lsp/<server_name>.lua
--- @type vim.lsp.Config
return {
  cmd = { "server-binary" },
  filetypes = { "filetype" },
  root_markers = { "marker_file" },
  settings = {},
}

-- 2. Add to vim.lsp.enable() list in lua/config/lsp.lua
-- 3. Add binary name to Mason ensure_installed in lua/plugins/tools.lua
```

### Add a Keybinding

```lua
-- In lua/config/keymaps.lua
vim.keymap.set("n", "<leader>xx", function()
  -- action
end, { desc = "Description" })
```

### Add a Formatter

```lua
-- In lua/plugins/tools.lua, conform formatters_by_ft:
formatters_by_ft = {
  filetype = { "formatter_name" },
}
```

### Add a Linter

```lua
-- In lua/plugins/tools.lua, lint linters_by_ft:
linters_by_ft = {
  filetype = { "linter_name" },
}
```

## Mason ensure_installed

```
lua-language-server, vtsls, html-lsp, css-lsp, css-variables-language-server,
emmet-language-server, tailwindcss-language-server, taplo, ast-grep, tectonic,
tree-sitter-cli, eslint_d, beautysh, prettierd, vale, kulala-fmt, mmdc,
nginx-config-formatter, uv, sqruff, json-lsp, yaml-language-server,
vue-language-server
```

## References

- [configuration.md](references/configuration.md) — Startup sequence, options, autocommands
- [keybindings.md](references/keybindings.md) — Complete keybinding reference
- [lsp.md](references/lsp.md) — LSP stack, completion, formatting, diagnostics
- [plugins.md](references/plugins.md) — All plugins with descriptions
- [migration-0.12.md](references/migration-0.12.md) — Neovim 0.12 breaking changes and new APIs
- [tools.md](references/tools.md) — Built-in commands, CLI tools, debug utilities
- [troubleshooting.md](references/troubleshooting.md) — Common issues and solutions
- [performance.md](references/performance.md) — Startup optimization, profiling
