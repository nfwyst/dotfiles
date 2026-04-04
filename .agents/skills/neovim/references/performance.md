# Performance Reference

Startup optimization techniques and profiling methods.

## Current Startup Optimizations

### 1. vim.loader.enable()

Bytecode cache for Lua modules. First line in `init.lua`. Caches compiled Lua chunks in `~/.cache/nvim/luac/`.

### 2. Message Suppression During Plugin Loading

```lua
local saved_shortmess = vim.o.shortmess
vim.o.shortmess = "aAFOTIcC"
vim.pack.add({...})
vim.o.shortmess = saved_shortmess
vim.cmd("silent! redraw")
```

Prevents hit-enter prompts from vim.pack progress output before noice.nvim loads.

### 3. Transparent Background Bootstrap

Sets highlight groups to `bg=NONE, fg=NONE` before any plugin loads:

```lua
for _, hl in ipairs({ "Normal", "NormalNC", "MsgArea", "MsgSeparator", "StatusLine", "StatusLineNC" }) do
  vim.api.nvim_set_hl(0, hl, { bg = "NONE", fg = "NONE" })
end
```

Prevents blue `MsgSeparator` banner and white flash during startup.

### 4. Snacks.quickfile

Fast file open — opens the file before plugins finish loading. Enabled via `quickfile = { enabled = true }`.

### 5. Deferred Operations

| Operation | Delay | Why |
|---|---|---|
| Mason auto-install | 100ms | Don't block startup for network IO |
| Plugin cleanup | 300ms | Don't block for filesystem scanning |
| ETH price fetch | UIEnter + 0ms | Network request after first paint |
| Vimade FadeActive | 500ms | Let UI stabilize first |
| Colorscheme detection | Sync at startup | Must complete before first paint |
| Fortune header | 200ms timeout | Capped to prevent slow startup |

### 6. Resilient Module Loading

```lua
local errors = {}
local function safe_require(mod)
  local ok, err = pcall(require, mod)
  if not ok then errors[#errors + 1] = mod .. ": " .. tostring(err) end
end
```

One module's failure doesn't block the rest. Errors shown after `UIEnter`.

### 7. Disabled Built-in Plugins

`gzip`, `netrwPlugin`, `rplugin`, `tarPlugin`, `tohtml`, `tutor`, `zipPlugin` — prevents loading unused Vim plugins.

### 8. Disabled Providers

```lua
vim.g.loaded_perl_provider = 0
vim.g.loaded_ruby_provider = 0
```

### 9. blink.cmp Pre-load

```lua
pcall(require, "blink.cmp.fuzzy.rust")
```

Pre-loads the Rust module so `ensure_downloaded()` hits the cache and skips download check.

### 10. LSP Log Disabled

```lua
vim.lsp.log.set_level(vim.log.levels.OFF)
```

Prevents log file IO on every LSP message.

### 11. termsync Disabled in tmux

```lua
if vim.env.TMUX then opt.termsync = false end
```

Avoids double-synchronized output that causes cursor ghosting and potential rendering overhead.

## Profiling Methods

### Startup Time

```bash
# Basic startup time
nvim --startuptime /tmp/startup.log
sort -k 2 -n -r /tmp/startup.log | head -20

# With specific file
nvim --startuptime /tmp/startup.log some_file.ts
```

### Lua Profiling

```bash
# Profile all functions
nvim --cmd "profile start /tmp/profile.log" --cmd "profile func *" -c "qa"

# Profile specific file
nvim --cmd "profile start /tmp/profile.log" --cmd "profile file lua/plugins/ui.lua" -c "qa"
```

### Runtime Performance Check

```vim
" Check if treesitter is causing slowness
:lua vim.print(vim.b.ts_highlight)

" Check active LSP clients (too many?)
:lua vim.print(#vim.lsp.get_clients({ bufnr = 0 }))

" Check notification queue
:lua vim.print(Snacks.notifier.get_history())
```

### Memory Usage

```vim
" Lua memory
:lua vim.print(collectgarbage("count") .. " KB")

" Force garbage collection
:lua collectgarbage("collect")
```

## Startup Sequence Timing

Approximate timing for each phase (on Apple Silicon Mac):

| Phase | Time | Notes |
|---|---|---|
| vim.loader.enable() | ~1ms | Bytecode cache setup |
| config.options | ~2ms | vim.opt settings |
| config.hack | ~1ms | Diagnostic override |
| vim.pack.add() | ~5-15ms | Plugin resolution (cached) |
| Plugin configs | ~30-60ms | Colorscheme + UI + Editor + Coding + Tools |
| config.lsp | ~3ms | Diagnostics + vim.lsp.enable() |
| config.keymaps | ~5ms | All keybindings |
| config.autocmds | ~2ms | Autocommands |
| **Total** | **~50-90ms** | Without Mason install |

First launch adds ~2-5s for plugin downloads + blink.cmp cargo build.

## Large File Handling

Snacks.bigfile automatically disables expensive features for files exceeding a size threshold:
- Treesitter highlighting
- LSP attachment
- Indent guides
- Other Snacks features

## Render-Markdown Performance

render-markdown.nvim is configured to render in all modes (`render_modes = { "n", "c", "t", "i" }`). For very large markdown files, this can cause performance issues. The `anti_conceal` is disabled for non-listed buffers and nofile buftypes to reduce overhead in popup windows.

## Noice Throttling

```lua
throttle = 1000 / 120  -- 120 FPS cap
```

Prevents noice from overwhelming the rendering pipeline with rapid message updates.

## Scroll Animation Budget

```lua
scroll = {
  animate_repeat = { delay = 50, duration = { step = 2, total = 20 }, easing = "linear" },
}
```

Keeps scroll animation tight (20ms total) to feel responsive without blocking input.
