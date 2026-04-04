# Neovim 0.12 Migration Reference

Breaking changes and new APIs in Neovim 0.12+ that this configuration uses.

## vim.pack (Native Plugin Manager)

Replaces lazy.nvim entirely.

### API

```lua
vim.pack.add(specs, opts?)        -- Install + load plugins
vim.pack.update(names?, opts?)    -- Update plugins (default: all)
vim.pack.get()                    -- List all managed plugins
vim.pack.del(names, opts?)        -- Remove plugins
```

### Spec Format

```lua
vim.pack.add({
  "https://github.com/user/repo",                           -- Short form
  { src = "https://github.com/user/repo", version = "main" }, -- Pin to branch
})
```

### Key Differences from lazy.nvim

| Feature | lazy.nvim | vim.pack |
|---|---|---|
| Lazy loading | Built-in (event, cmd, ft, keys) | Manual (autocmds, vim.schedule) |
| Lockfile | lazy-lock.json | nvim-pack-lock.json |
| Install location | ~/.local/share/nvim/lazy/ | ~/.local/share/nvim/site/pack/core/opt/ |
| Post-install hooks | `build = "..."` | `PackChanged` user event |
| UI | `:Lazy` | None (custom :PlugSync) |
| Startup stats | `:Lazy profile` | `--startuptime` |
| Plugin spec | Lua table with lazy keys | URL string or {src, version} |

### Migration Pattern

```lua
-- OLD (lazy.nvim)
{ "folke/snacks.nvim", event = "VeryLazy", config = function() ... end }

-- NEW (vim.pack)
vim.pack.add({ "https://github.com/folke/snacks.nvim" })
-- Config in separate file, loaded via require()
-- Deferred loading via vim.defer_fn() or autocmd
```

## Native LSP (vim.lsp.config + vim.lsp.enable)

Replaces nvim-lspconfig plugin.

### API Changes

| Old (nvim-lspconfig) | New (Neovim 0.12) |
|---|---|
| `require('lspconfig').server.setup({...})` | `lsp/server.lua` file + `vim.lsp.enable('server')` |
| `lspconfig.util.root_pattern(...)` | `root_markers = { ... }` |
| `capabilities` (from cmp-nvim-lsp) | `vim.lsp.config("*", { capabilities = ... })` |
| `:LspInfo` | `:checkhealth vim.lsp` |
| `vim.lsp.get_active_clients()` | `vim.lsp.get_clients()` |
| `client.request()` | `Client:request()` |
| `vim.lsp.buf.formatting()` | Use conform.nvim |

### Server Config Format

```lua
-- lsp/server_name.lua
--- @type vim.lsp.Config
return {
  cmd = { "binary-name", "--stdio" },
  filetypes = { "ft1", "ft2" },
  root_markers = { "marker1", "marker2" },
  settings = {},
  init_options = {},
  on_attach = function(client, bufnr) end,
}
```

### Auto-Discovery

Neovim auto-discovers `lsp/*.lua` files. No need to explicitly call `vim.lsp.config()` for individual servers — just place the file and call `vim.lsp.enable("name")`.

## Treesitter Changes

### Parser Loading

```lua
-- OLD: vim.treesitter.get_parser() throws on failure
-- NEW: Returns nil on failure (no more pcall needed for checking)
local parser = vim.treesitter.get_parser(bufnr, lang)
if not parser then return end
```

### Language Registration

```lua
-- Register language alias
vim.treesitter.language.register("bash", "zsh")
vim.treesitter.language.register("markdown", { "checkhealth", "mdx" })
```

### Custom Predicates

```lua
-- Add custom query predicate
vim.treesitter.query.add_predicate("is-filetype?", function(match, pattern, source, predicate)
  return vim.bo[source].filetype == predicate[3]
end, { force = true })
```

### Built-in ftplugin Coverage

Neovim 0.12 built-in ftplugins call `vim.treesitter.start()` for ~20 languages. This config adds a `FileType` autocmd to cover all remaining languages with highlight queries.

### ts_highlight Flag

When treesitter is active, `vim.b.ts_highlight = true`. This **blocks** traditional `syntax` highlighting. To restore syntax:

```lua
vim.treesitter.stop(buf)
vim.bo[buf].syntax = ft
```

## Diagnostic API

### New Jump API

```lua
-- OLD
vim.diagnostic.goto_next({ severity = ... })

-- NEW
vim.diagnostic.jump({ count = 1, severity = ... })
vim.diagnostic.jump({ count = -1, severity = ... })
```

### Enable/Disable

```lua
-- Toggle all diagnostics
vim.diagnostic.enable(not vim.diagnostic.is_enabled())

-- Per-buffer, per-namespace
vim.diagnostic.enable(false, { bufnr = bufnr, ns_id = ns })
```

## Inlay Hints

```lua
-- Enable
vim.lsp.inlay_hint.enable(true, { bufnr = bufnr })

-- Toggle
vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled())

-- Check
vim.lsp.inlay_hint.is_enabled()
```

## vim.uv (replaces vim.loop)

```lua
-- OLD
vim.loop.fs_stat(path)
vim.loop.new_timer()

-- NEW
vim.uv.fs_stat(path)
vim.uv.new_timer()
vim.uv.cwd()
```

## vim.hl (replaces vim.highlight)

```lua
-- OLD
vim.highlight.on_yank()

-- NEW (with backward compat)
(vim.hl or vim.highlight).on_yank()
```

## vim.system

```lua
-- Async external command (replaces io.popen/jobstart for simple cases)
vim.system({ "fortune" }, { text = true, timeout = 200 }):wait()
vim.system({ "curl", "-s", url }, { timeout = 10000 }, function(result)
  if result.code == 0 then ... end
end)
```

## Key Breaking Changes Summary

1. **No lazy loading in vim.pack** — use manual deferred patterns
2. **LSP configs as files** — `lsp/*.lua` instead of `lspconfig.setup()`
3. **root_markers replaces root_pattern** — simpler table, no function
4. **vim.treesitter.get_parser() returns nil** — no longer throws
5. **vim.diagnostic.jump() replaces goto_next/goto_prev** — count-based API
6. **vim.uv replaces vim.loop** — same libuv bindings, new namespace
7. **Semantic tokens need manual disable** — no lspconfig `on_init` hook
8. **vim.pack.add needs full URLs** — not short `user/repo` format
