# Neovim Performance Reference

## Plugin Manager: vim.pack

This configuration uses **vim.pack** (Neovim 0.12+ native package manager), NOT lazy.nvim. There is no lazy-loading in the traditional sense. All plugins are loaded at startup via `vim.pack.add()`, but their Lua configurations are deferred.

## Startup Optimizations

### vim.loader.enable()
Called at the top of `init.lua`. Enables the Neovim module loader cache, which significantly speeds up `require()` calls by caching module bytecode.

### shortmess Suppression
`shortmess` flags are temporarily adjusted during plugin loading to suppress noisy messages during startup.

### laststatus = 0 During Startup
`laststatus` is set to 0 at startup to avoid statusline rendering overhead. It is set to 3 (global statusline) after Snacks initializes.

### Disabled Built-ins
Only 4 built-in plugins are disabled to reduce startup overhead:
1. `netrwPlugin` — replaced by snacks.explorer
2. `rplugin` — remote plugin support
3. `tohtml` — HTML export
4. `tutor` — built-in tutorial

### Deferred Mason Installation
Mason package installation is deferred via `vim.defer_fn` with a 100ms delay, so it does not block startup.

### Deferred Plugin Cleanup
Inactive/unused plugin directories are cleaned up via `vim.defer_fn` with a 300ms delay after startup.

## Runtime Performance

### vtsls Memory Limit
vtsls is configured with `--max-old-space-size=8192` (1024 * 8 = 8GB) to handle large TypeScript projects without OOM crashes.

### bun for LSP Servers
LSP servers are run via bun where possible, using `ts_util.bun_cmd()`. Bun starts faster than Node.js for LSP processes.

### blink.cmp Rust Fuzzy Matching
The completion engine uses a Rust-based fuzzy matcher compiled from source (`cargo build --release`). This is significantly faster than Lua-based fuzzy matching for large completion lists.

### Snacks bigfile
`snacks.bigfile` automatically disables expensive features (treesitter highlighting, LSP, etc.) when opening large files.

### Treesitter Main Branch
Uses the main branch of nvim-treesitter with a runtime bridge. The main branch has performance improvements over tagged releases.

### Colorscheme Syncing
- **In tmux**: Event-driven (zero polling) — uses tmux focus events to detect system colorscheme changes
- **Outside tmux**: 15-second polling interval as fallback

## Profiling Tools

### :checkhealth
Built-in health check command. Verifies plugin status, tool availability, and configuration correctness.

### Snacks Profiler
- `<leader>dps` — Startup profile
- `<leader>dph` — Highlight profile

These are the available profiling tools. Do NOT suggest lazy.nvim profiling (`:Lazy profile`) as lazy.nvim is not used.

## Format on Save
- Timeout: 3000ms
- `lsp_format = "fallback"` — falls back to LSP if no conform formatter matches
- `retab` runs after save to convert tabs to spaces
