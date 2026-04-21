# Neovim Configuration Skill

> **Version 2.1.0** | 2026-04-21

## Overview

This skill documents a Neovim 0.12+ configuration located at `~/dotfiles/.config/nvim`. The setup uses **vim.pack** (Neovim's native package manager) for plugin management and the built-in LSP client for language intelligence. The config entry point is `init.lua`, which loads modules via a `safe_require` pattern in this order: options → hack → plugins → lsp → keymaps → autocmds.

Key characteristics:
- **Plugin manager**: vim.pack (native) — not lazy.nvim
- **Completion**: blink.cmp with Rust fuzzy matching built from source
- **Dual TypeScript LSP**: tsgo (Go-native, fast) and vtsls (Node-based, Vue/baseUrl support), mutually exclusive via root_dir guards
- **Diagnostic filtering**: hack.lua monkey-patches `vim.diagnostic.set` to blacklist specific TS error codes and eslint_d message patterns
- **Dark mode detection**: macOS dark mode with event-driven fs_event watch (tmux state file) or 15-second polling fallback
- **Colorschemes**: tokyonight, monokai-pro, NeoSolarized

## Quick Reference

| Area | Details |
|---|---|
| Neovim version | 0.12+ |
| Plugin manager | vim.pack (native) |
| Config entry | init.lua → safe_require: options → hack → plugins → lsp → keymaps → autocmds |
| Completion | blink.cmp (Rust fuzzy, built from source) |
| Formatter engine | conform.nvim |
| Linter engine | nvim-lint |
| TS LSP (fast) | tsgo — Go-native TypeScript server |
| TS LSP (compat) | vtsls — Node-based, Vue/baseUrl support, 8 GB memory limit |
| File explorer | snacks.nvim explorer |
| Fuzzy finder | snacks.nvim picker |
| Git UI | lazygit (via snacks.nvim) |
| Statusline | lualine.nvim |
| Bufferline | bufferline.nvim |
| Notifications | noice.nvim + snacks.nvim notifier |
| Disabled built-ins | netrwPlugin, rplugin, tohtml, tutor |

## Directory Structure

```
~/.config/nvim/
├── init.lua                          # Entry point (safe_require chain)
├── lua/
│   ├── config/
│   │   ├── options.lua               # Vim options
│   │   ├── keymaps.lua               # Key mappings
│   │   ├── autocmds.lua              # Autocommands (formatoptions override, etc.)
│   │   ├── lsp.lua                   # LSP client config, server enable list, handlers
│   │   ├── hack.lua                  # Diagnostic blacklist, monkey-patches
│   │   ├── util.lua                  # General utilities
│   │   ├── ts_util.lua               # TS utilities: bun_cmd, mason_tsdk, find_project_root, etc.
│   │   ├── constant.lua              # Constants
│   │   └── price.lua                 # Price-related config
│   └── plugins/
│       ├── init.lua                  # Plugin declarations (vim.pack.add calls)
│       ├── coding.lua                # Coding plugins (blink.cmp, snippets, etc.)
│       ├── colorscheme.lua           # Colorscheme setup + dark mode detection
│       ├── editor.lua                # Editor plugins (flash, trouble, grug-far, etc.)
│       ├── tools.lua                 # Tool plugins (mason, conform, nvim-lint, etc.)
│       └── ui.lua                    # UI plugins (lualine, bufferline, noice, snacks, etc.)
├── lsp/                              # Native LSP server configs (one file per server)
│   ├── css_variables.lua
│   ├── cssls.lua
│   ├── cssmodules_ls.lua
│   ├── docker_language_server.lua
│   ├── emmet_language_server.lua
│   ├── html.lua
│   ├── jsonls.lua
│   ├── lua_ls.lua
│   ├── protols.lua
│   ├── solc.lua
│   ├── tailwindcss.lua
│   ├── taplo.lua
│   ├── tsgo.lua
│   ├── vtsls.lua
│   ├── vue_ls.lua
│   └── yamlls.lua
└── after/
    └── plugin/
        └── snacks-image-fix.lua      # Workaround: images invisible after floating windows close
```

## Configuration Loading Order

1. **options.lua** — Vim options and settings
2. **hack.lua** — Monkey-patches (diagnostic blacklist for TS codes 7016, 80001, 80006, 80007, 7044, 1149; eslint_d pattern filters)
3. **plugins/** — Plugin declarations and configuration via vim.pack
4. **lsp.lua** — LSP server enable list, handlers (`editor.action.showReferences` → Trouble qflist)
5. **keymaps.lua** — Key mappings
6. **autocmds.lua** — Autocommands (`formatoptions` override to `"jcroqlnt"` after ftplugins, treesitter auto-start for all file buffers via `FileType`, etc.)

## Enabled LSP Servers

These servers are enabled in `lsp.lua` and have corresponding config files in `lsp/`:

| Server | Language / Purpose |
|---|---|
| lua_ls | Lua |
| tsgo | TypeScript/JavaScript (Go-native, fast) |
| vtsls | TypeScript/JavaScript (Node-based, Vue/baseUrl compat) |
| html | HTML |
| cssls | CSS |
| css_variables | CSS custom properties |
| cssmodules_ls | CSS Modules |
| emmet_language_server | Emmet expansions |
| tailwindcss | Tailwind CSS |
| taplo | TOML |
| solc | Solidity |
| protols | Protocol Buffers |
| docker_language_server | Dockerfiles |
| jsonls | JSON (with SchemaStore) |
| yamlls | YAML (with SchemaStore) |
| vue_ls | Vue |

**Not enabled**: bashls, gopls, rust_analyzer, denols, eslint — none of these have `lsp/*.lua` config files.

## TypeScript Server Selection

tsgo and vtsls are **mutually exclusive** via `root_dir` guards:

| Server | When active | Strengths |
|---|---|---|
| **tsgo** | Default for non-Vue, non-baseUrl projects | Fast (Go-native), codeLens support (with workaround) |
| **vtsls** | Vue projects or projects needing baseUrl resolution | Full Vue support, moveToFileRefactoring command, 8 GB maxTsServerMemory |

Selection logic uses helpers from `ts_util.lua`:
- `is_vue_project()` — detects Vue projects
- `is_deno_project()` — detects Deno projects (excluded from both)
- `needs_baseurl_fallback()` — detects tsconfig baseUrl usage
- `bun_cmd()` — resolves Bun-compatible command paths
- `mason_tsdk()` — locates Mason-installed TypeScript SDK
- `find_project_root()` — finds project root directory

### Server-specific behaviors

- **tsgo on_attach**: Monkey-patches `client.request` to intercept `textDocument/codeLens` and pre-resolve references/implementations counts.
- **vtsls on_attach**: Registers `_typescript.moveToFileRefactoring` command handler. maxTsServerMemory = `1024 * 8` (8 GB).
- **vue_ls on_attach**: Disables overlapping capabilities (definitionProvider, referencesProvider, implementationProvider, typeDefinitionProvider, renameProvider) to avoid conflicts with tsgo/vtsls.

## Key Mappings

| Mapping | Mode | Action |
|---|---|---|
| `gR` | n | File References (ts_util.find_file_references, ripgrep-based) |
| `gD` | n | Goto Source Definition (tsgo: custom/sourceDefinition, vtsls: typescript.goToSourceDefinition) |
| `<leader>cM` | n | Add Missing Imports |
| `<leader>co` | n | Organize Imports |
| `<leader>cD` | n | Fix All Diagnostics |
| `<leader>c/` | n | Remove All Carriage Returns (`%s/\r//g`) |
| `S-j` / `S-k` | v, x | Move lines down / up (visual mode ONLY, not normal) |
| `jk` | i | Escape from insert mode |

**Not configured**: jj escape, `<Esc><Esc>` terminal escape, `<A-j>`/`<A-k>` line movement.

## Formatters (conform.nvim)

| Formatter | File types |
|---|---|
| prettierd | Web languages (JS, TS, HTML, CSS, JSON, etc.) |
| eslint_d | JS/TS (fix mode) |
| stylua | Lua |
| shfmt | Shell |
| beautysh | Zsh |
| taplo | TOML |
| kulala-fmt | HTTP |
| nginxfmt | Nginx |
| sqruff | SQL |

## Linters (nvim-lint)

| Linter | File types |
|---|---|
| eslint_d | JavaScript, TypeScript |
| bash | Shell |
| zsh | Zsh |
| vale | Markdown |

## Schema Support

- **jsonls**: JSON schemas via SchemaStore.nvim
- **yamlls**: YAML schemas via SchemaStore.nvim
- **taplo**: Does NOT use SchemaStore

## Plugins (vim.pack.add)

nui, plenary, nvim-web-devicons, SchemaStore, tokyonight, monokai-pro, NeoSolarized, nvim-treesitter (main branch), treesitter-context, blink.cmp, friendly-snippets, which-key, gitsigns, resolve.nvim, grug-far, trouble, flash, todo-comments, lualine, bufferline, noice, snacks, vimade, mini.pairs, mini.ai, mini.surround, nvim-ts-autotag, lazydev, render-markdown, mason, conform, nvim-lint, codecompanion, leetcode, checkmate, ts-worksheet, uv.nvim

### Snacks.nvim Features

dashboard, animate, scope, bigfile, quickfile, scroll, indent, input, notifier, statuscolumn, words, lazygit, dim, image (enabled), explorer, picker

### Mason ensure_installed

lua-language-server, vtsls, tsgo, html-lsp, css-lsp, css-variables-language-server, emmet-language-server, tailwindcss-language-server, taplo, ast-grep, tectonic, tree-sitter-cli, eslint_d, beautysh, prettierd, vale, kulala-fmt, mmdc, nginx-config-formatter, uv, sqruff, json-lsp, yaml-language-server, vue-language-server

## Treesitter

- Auto-start for all file buffers via `FileType` autocmd
- Custom `is-filetype?` predicate
- Language registrations: zsh → bash, checkhealth → markdown, mdx → markdown

## Detailed References

| File | Purpose |
|---|---|
| [init.lua](~/dotfiles/.config/nvim/init.lua) | Entry point, safe_require chain |
| [lua/config/options.lua](~/dotfiles/.config/nvim/lua/config/options.lua) | Vim options |
| [lua/config/hack.lua](~/dotfiles/.config/nvim/lua/config/hack.lua) | Diagnostic blacklist, monkey-patches |
| [lua/config/lsp.lua](~/dotfiles/.config/nvim/lua/config/lsp.lua) | LSP enable list, handlers, showReferences → Trouble |
| [lua/config/keymaps.lua](~/dotfiles/.config/nvim/lua/config/keymaps.lua) | Key mappings |
| [lua/config/autocmds.lua](~/dotfiles/.config/nvim/lua/config/autocmds.lua) | Autocommands, formatoptions override |
| [lua/config/ts_util.lua](~/dotfiles/.config/nvim/lua/config/ts_util.lua) | TS utilities (bun_cmd, mason_tsdk, find_project_root, etc.) |
| [lua/config/util.lua](~/dotfiles/.config/nvim/lua/config/util.lua) | General utilities |
| [lua/config/constant.lua](~/dotfiles/.config/nvim/lua/config/constant.lua) | Constants |
| [lua/plugins/init.lua](~/dotfiles/.config/nvim/lua/plugins/init.lua) | Plugin declarations |
| [lua/plugins/coding.lua](~/dotfiles/.config/nvim/lua/plugins/coding.lua) | Coding plugins |
| [lua/plugins/colorscheme.lua](~/dotfiles/.config/nvim/lua/plugins/colorscheme.lua) | Colorscheme + dark mode detection |
| [lua/plugins/editor.lua](~/dotfiles/.config/nvim/lua/plugins/editor.lua) | Editor plugins |
| [lua/plugins/tools.lua](~/dotfiles/.config/nvim/lua/plugins/tools.lua) | Tool plugins (mason, conform, nvim-lint) |
| [lua/plugins/ui.lua](~/dotfiles/.config/nvim/lua/plugins/ui.lua) | UI plugins (lualine, bufferline, noice, snacks) |
| [lsp/tsgo.lua](~/dotfiles/.config/nvim/lsp/tsgo.lua) | tsgo server config + codeLens workaround |
| [lsp/vtsls.lua](~/dotfiles/.config/nvim/lsp/vtsls.lua) | vtsls server config + moveToFileRefactoring |
| [lsp/vue_ls.lua](~/dotfiles/.config/nvim/lsp/vue_ls.lua) | Vue LS config + capability disabling |
| [after/plugin/snacks-image-fix.lua](~/dotfiles/.config/nvim/after/plugin/snacks-image-fix.lua) | Image visibility fix after floating windows |
