# Performance Reference

Startup optimization, profiling, and performance tuning.

## Startup Architecture

```
nvim launch
├── vim.pack.add()         " Plugin download/load (blocking)
│   └── shortmess hack    " Suppress messages during load
├── config.options         " vim.opt settings
├── config.keymaps         " Keybindings
├── config.autocmds        " Autocommands
├── config.lsp             " LSP config + vim.lsp.enable()
└── plugins/*              " Plugin setup() calls
    ├── colorscheme        " Theme (synchronous, needed first)
    ├── ui                 " Snacks, Noice, Lualine, Bufferline, Vimade
    ├── editor             " which-key, gitsigns, trouble, flash
    ├── coding             " treesitter, blink.cmp, mini.*
    └── tools              " mason, conform, nvim-lint
```

### Deferred Operations

| Operation | Mechanism | Delay |
|-----------|-----------|-------|
| Plugin cleanup | `vim.defer_fn` | 300ms |
| VimadeFadeActive | `vim.defer_fn` | 500ms |
| Treesitter start (VimEnter) | autocmd | After UI ready |
| blink.cmp cargo build | `vim.system` async | PackChanged event |

## Profiling

### Startup Time

```bash
# Detailed startup profiling
nvim --startuptime /tmp/startup.log
sort -k2 -n -r /tmp/startup.log | head -20

# Quick check
nvim --startuptime /dev/stderr -c "q" 2>&1 | tail -1
```

### Runtime Profiling

```lua
-- Memory usage
:lua print(string.format("%.1f MB", collectgarbage("count") / 1024))

-- Force GC
:lua collectgarbage("collect")

-- Check loaded modules count
:lua local n = 0; for _ in pairs(package.loaded) do n = n + 1 end; print(n .. " modules loaded")
```

### Plugin Load Impact

```lua
-- Check which plugins are active
:lua for _, p in ipairs(vim.pack.get()) do print(p.spec.name, p.active and "active" or "inactive") end
```

## Optimization Techniques

### Message Suppression During Load

```lua
-- Prevent hit-enter prompt during vim.pack operations
local saved_shortmess = vim.o.shortmess
vim.o.shortmess = "aAFOTIcC"
vim.pack.add({ ... })
vim.o.shortmess = saved_shortmess
vim.cmd("silent! redraw")
```

### Snacks Quickfile

`Snacks.quickfile` runs early (before plugins fully load) to start treesitter for directly opened files. This provides instant highlighting but requires the `try_treesitter_start()` guard for languages without queries.

### Snacks Bigfile

`Snacks.bigfile` automatically disables expensive features (treesitter, LSP, etc.) for large files.

### Treesitter Query Caching

`vim.treesitter.query.get()` caches queries internally. The `try_treesitter_start()` function uses this to efficiently check if highlight queries exist.

### Clipboard

```lua
vim.opt.clipboard = "unscheduled"  -- Lazy clipboard initialization (0.12+)
```

### Disabled Built-in Plugins

```lua
local disabled = { "gzip", "netrwPlugin", "rplugin", "tarPlugin", "tohtml", "tutor", "zipPlugin" }
for _, plugin in ipairs(disabled) do
  vim.g["loaded_" .. plugin] = 1
end
```

## Large File Handling

Snacks bigfile automatically handles large files. Manual thresholds:

```lua
-- Treesitter disable for large files
highlight = {
  disable = function(lang, buf)
    local max_filesize = 100 * 1024  -- 100KB
    local ok, stats = pcall(vim.uv.fs_stat, vim.api.nvim_buf_get_name(buf))
    return ok and stats and stats.size > max_filesize
  end,
}
```

## LSP Performance

### Semantic Tokens Disabled

```lua
on_attach = function(client)
  client.server_capabilities.semanticTokensProvider = nil
end
```

This avoids the overhead of semantic token processing. Treesitter provides sufficient highlighting.

### LSP Log Disabled

```lua
vim.lsp.log.set_level(vim.log.levels.OFF)
```

### Viewport-Only Semantic Tokens (0.12)

If semantic tokens were enabled, 0.12 supports `textDocument/semanticTokens/range` which only requests tokens for the visible viewport, significantly reducing payload.

## Explorer Performance

### Filesystem Watcher

With `watch = true`, the explorer registers `uv.fs_event` watchers on open directories. ENOENT errors from broken symlinks are filtered via Noice.

### Diagnostics Disabled in Explorer

```lua
explorer = { diagnostics = false }
```

This avoids unnecessary diagnostic computation for the file tree.

## Monitoring

```lua
-- Watch memory over time
:lua vim.defer_fn(function() print(string.format("%.1f MB", collectgarbage("count") / 1024)) end, 5000)

-- Check LSP response time
:lua local start = vim.uv.hrtime(); vim.lsp.buf.hover(); print(string.format("%.1fms", (vim.uv.hrtime() - start) / 1e6))
```
