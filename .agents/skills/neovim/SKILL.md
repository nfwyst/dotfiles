# Neovim Configuration Skill

> Neovim 0.12+ native configuration — vim.pack, native LSP, Snacks UI framework

## Architecture Overview

This configuration runs on **Neovim 0.12+** and is fully migrated away from LazyVim/lazy.nvim. It uses:

- **`vim.pack`** — Neovim's built-in plugin manager (replaces lazy.nvim)
- **Native LSP** — `vim.lsp.config()` + `vim.lsp.enable()` (replaces nvim-lspconfig `setup()`)
- **Snacks.nvim** — Unified UI framework: picker, explorer, dashboard, notifier, terminal, and more
- **blink.cmp** — Fast completion engine (Rust fuzzy matching, built from source via cargo)
- **conform.nvim** — Formatting engine (replaces LSP formatting)
- **nvim-lint** — Async linting (replaces LSP-only diagnostics)

## Directory Structure

```
~/.config/nvim/
├── init.lua                    # Entry: loads options → keymaps → autocmds → lsp → plugins
├── nvim-pack-lock.json         # vim.pack lockfile (version-controlled)
├── lsp/                        # Native LSP server configs (vim.lsp.config auto-discovers)
│   ├── lua_ls.lua
│   ├── vtsls.lua
│   ├── html.lua
│   ├── cssls.lua
│   ├── css_variables.lua
│   ├── cssmodules_ls.lua
│   ├── emmet_language_server.lua
│   ├── tailwindcss.lua
│   ├── taplo.lua
│   ├── solc.lua
│   ├── protols.lua
│   ├── docker_language_server.lua
│   ├── jsonls.lua
│   └── yamlls.lua
├── lua/
│   ├── config/
│   │   ├── options.lua         # vim.opt settings, filetype additions
│   │   ├── keymaps.lua         # All keybindings (leader, LSP, picker, custom)
│   │   ├── autocmds.lua        # Autocommands (yank highlight, restore cursor, etc.)
│   │   ├── lsp.lua             # Native LSP config: diagnostics, global settings, vim.lsp.enable()
│   │   ├── util.lua            # Helpers: root detection, icons, eslint config finder
│   │   ├── constant.lua        # ESLint config file list
│   │   ├── hack.lua            # Diagnostic blacklist filter
│   │   └── price.lua           # ETH price ticker for lualine
│   └── plugins/
│       ├── init.lua            # vim.pack.add() + PackChanged hooks + PlugSync command
│       ├── colorscheme.lua     # tokyonight/monokai-pro/NeoSolarized + auto dark mode
│       ├── ui.lua              # Snacks, Noice, Lualine, Bufferline, Vimade
│       ├── editor.lua          # which-key, gitsigns, grug-far, trouble, flash, todo-comments
│       ├── coding.lua          # treesitter, blink.cmp, mini.pairs/ai/surround, ts-autotag, lazydev
│       └── tools.lua           # mason, conform, nvim-lint, codecompanion (AI), leetcode, checkmate
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
- **No lazy loading syntax**: Use `vim.schedule()` or autocmds for deferred loading

### Key Commands

| Command | Action |
|---------|--------|
| `:PlugSync` | Clean inactive plugins + update all |
| `vim.pack.update()` | Update all plugins |
| `vim.pack.get()` | List all managed plugins |

### Post-Install Hooks

```lua
-- blink.cmp: cargo build after install/update
vim.api.nvim_create_autocmd("User", {
  pattern = "PackChanged",
  callback = function(ev)
    if ev.data.spec.name == "blink.cmp" and (ev.data.kind == "install" or ev.data.kind == "update") then
      vim.system({ "cargo", "build", "--release" }, { cwd = dir })
    end
  end,
})
```

## Native LSP Setup (Neovim 0.12+)

### Architecture

```
lsp/*.lua           → Server-specific configs (auto-discovered by vim.lsp.config)
lua/config/lsp.lua  → Global settings, diagnostics, vim.lsp.enable()
```

### How Server Configs Work

Each file in `lsp/` exports a table consumed by `vim.lsp.config`:

```lua
-- lsp/lua_ls.lua
return {
  cmd = { "lua-language-server" },
  filetypes = { "lua" },
  root_markers = { ".luarc.json", ".luarc.jsonc", ".luacheckrc", ".stylua.toml", "stylua.toml" },
  settings = { Lua = { ... } },
}
```

### Enabling Servers

In `lua/config/lsp.lua`:

```lua
vim.lsp.config("*", { capabilities = { ... }, on_attach = function(client) ... end })
vim.lsp.enable({ "lua_ls", "vtsls", "html", "cssls", ... })
```

### Key Differences from Old nvim-lspconfig

| Old (nvim-lspconfig) | New (Native 0.12) |
|---|---|
| `require('lspconfig').lua_ls.setup({...})` | `lsp/lua_ls.lua` + `vim.lsp.enable('lua_ls')` |
| `lspconfig.util.root_pattern(...)` | `root_markers = { ... }` in config table |
| `:LspInfo` | `:lsp` or `:checkhealth vim.lsp` |
| `vim.lsp.get_active_clients()` | `vim.lsp.get_clients()` |
| `client.request()` | `Client:request()` |

### Diagnostics Config

```lua
vim.diagnostic.config({
  underline = false,
  virtual_lines = false,
  virtual_text = { spacing = 0, current_line = true },  -- inline on current line only
  severity_sort = true,
  signs = { text = { [ERROR] = "", [WARN] = "", ... } },
})
```

## Completion (blink.cmp)

- Built from source via `cargo build --release` (Rust fuzzy matcher)
- Main branch (latest), not stable releases
- Sources: LSP, buffer, path, snippets, lazydev
- Keybindings: `<C-space>` trigger, `<C-y>` accept, `<C-n>`/`<C-p>` navigate, `<Tab>`/`<S-Tab>` snippet jump

## Snacks.nvim Framework

Snacks provides a unified UI layer:

| Feature | Description |
|---------|-------------|
| `Snacks.picker` | File finder, grep, LSP symbols, git — replaces Telescope |
| `Snacks.explorer` | File tree sidebar — replaces neo-tree |
| `Snacks.dashboard` | Start screen with fortune |
| `Snacks.notifier` | Notification system |
| `Snacks.lazygit` | Lazygit integration |
| `Snacks.terminal` | Floating terminal |
| `Snacks.bufdelete` | Safe buffer deletion |
| `Snacks.words` | Reference navigation |
| `Snacks.dim` | Dim inactive code |
| `Snacks.scratch` | Scratch buffers |
| `Snacks.toggle` | Toggle animations, zoom, zen, indent |
| `Snacks.quickfile` | Fast file open before plugins load |
| `Snacks.bigfile` | Disable features for large files |

### Explorer Config

```lua
explorer = {
  ignored = true,       -- show gitignored files
  watch = true,         -- auto-refresh on filesystem changes
  follow_file = true,   -- auto-locate current file
  diagnostics = false,  -- no diagnostic indicators in tree
}
```

> ENOENT errors from broken symlinks (e.g., in `node_modules`) are filtered via Noice.

### Picker Config

```lua
picker = {
  hidden = true,     -- show hidden files
  ignored = true,    -- show gitignored files
  exclude = { "**/.git/*", "node_modules", "dist", ... },
}
```

## Treesitter

### Highlighting Strategy

A custom `try_treesitter_start()` function in `coding.lua` handles languages where treesitter parser exists but no highlight queries:

1. Check if `highlights.scm` queries exist via `vim.treesitter.query.get(lang, "highlights")`
2. If queries exist → `vim.treesitter.start(buf, lang)`
3. If no queries → stop treesitter if running, restore `vim.bo.syntax` fallback

This prevents Snacks quickfile from starting treesitter for unsupported languages (e.g., `nu`) which would block syntax highlighting fallback.

### Key Behavior (0.12)

- `vim.treesitter.get_parser()` returns `nil` on failure (no longer throws)
- Markdown highlighting enabled by default
- `b:ts_highlight` blocks `syntax` fallback — must explicitly stop treesitter and restore syntax

## Formatting (conform.nvim)

- Format on save via `BufWritePre` autocmd (controlled by `vim.g.autoformat` / `vim.b.autoformat`)
- Formatter selection: prettierD (JS/TS/CSS/HTML/JSON/YAML/MD), stylua (Lua), shfmt (shell)
- `<leader>cf` — manual format with prettierD config selection based on `shiftwidth`

## Linting (nvim-lint)

- Async linting via `BufWritePost` / `InsertLeave` / `BufEnter`
- ESLint (JS/TS), auto-detects config file in project root

## AI Integration (codecompanion.nvim)

- Anthropic Claude as primary adapter
- Inline assistant and chat interface

## Key Design Decisions

1. **No lazy loading framework** — vim.pack has no built-in lazy loading; use `vim.schedule()` or autocmds
2. **Semantic tokens disabled** — `on_attach` sets `semanticTokensProvider = nil` for all servers
3. **LSP log disabled** — `vim.lsp.log.set_level(vim.log.levels.OFF)`
4. **Inlay hints auto-enabled** — via `LspAttach` autocmd for supporting servers
5. **Vimade for dimming** — "duo" recipe with animation for inactive windows
6. **Global statusline** — `vim.o.laststatus = 3`
7. **Bufferline** — `index` files show `parent/index.ext` to disambiguate

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
return {
  cmd = { "server-binary" },
  filetypes = { "filetype" },
  root_markers = { "marker_file" },
  settings = {},
}

-- 2. Add to vim.lsp.enable() list in lua/config/lsp.lua
vim.lsp.enable({ ..., "server_name" })

-- 3. Install via Mason: :Mason → search → install
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
-- In lua/plugins/tools.lua, conform setup:
formatters_by_ft = {
  filetype = { "formatter_name" },
}
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
