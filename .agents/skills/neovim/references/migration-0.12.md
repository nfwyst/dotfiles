# Neovim 0.12 Migration Reference

## Current Status

This configuration is **already running on Neovim 0.12+**. This is not a future migration plan — these are the 0.12 features currently in use.

## vim.pack (Native Package Manager)

Neovim 0.12 introduces `vim.pack`, a native package manager that replaces third-party solutions like lazy.nvim. This configuration uses `vim.pack.add()` exclusively to manage all ~35 plugins.

Key characteristics:
- All plugins load at startup (no lazy-loading DSL)
- PackChanged hooks handle post-update build steps (cargo build, TSUpdate)
- Deferred cleanup of inactive plugin directories
- `:PlugSync` command for manual synchronization

## vim.lsp.config() + vim.lsp.enable()

The 0.12 LSP API replaces the old `lspconfig` setup pattern:

- `vim.lsp.config(server_name, config_table)` — declares server configuration
- `vim.lsp.enable(server_name)` — activates the server
- Supports **async root_dir callbacks** — the root_dir function receives a callback parameter and resolves asynchronously, which is important for the vtsls/tsgo mutual exclusion logic

## Default Keymaps

Neovim 0.12 provides default LSP keymaps:
- `grn` — rename (default)
- `gra` — code action (default)
- `grr` — references (default)

This configuration **overrides** `grn` and `gra` with custom implementations. The override is done by first deleting the default mappings via `pcall(vim.keymap.del, ...)` before setting the custom ones. `grr` is left as the default.

## vim.hl.on_yank

Neovim 0.12 moved the yank highlight API:
- **Old**: `vim.highlight.on_yank()`
- **New**: `vim.hl.on_yank()`

This configuration uses the new `vim.hl.on_yank()` API.

## Treesitter Auto-Start

Neovim 0.12 treesitter integration allows automatic highlighting for all filetypes via a `FileType` autocmd. This covers every language with an installed grammar — it is not limited to a fixed list of built-in languages.

## Known Workarounds

### tsgo codeLens
The tsgo codeLens handler has a monkey-patch to resolve reference/implementation counts and drop 0-count lenses. This workaround may become unnecessary in future Neovim or tsgo releases if the codeLens protocol handling improves.

### Default Keymap Deletion
The `pcall(vim.keymap.del, ...)` pattern for removing default `grn`/`gra` mappings is a transitional workaround. If Neovim changes how default LSP keymaps are managed, this may need updating.

### Diagnostic Monkey-Patch
The `hack.lua` monkey-patch of `vim.diagnostic.set` to filter diagnostic codes is not 0.12-specific but interacts with the 0.12 diagnostic infrastructure.

## API Changes Summary

| Feature | Old API | 0.12 API |
|---------|---------|----------|
| Package management | lazy.nvim / packer | vim.pack |
| LSP setup | lspconfig.server.setup() | vim.lsp.config() + vim.lsp.enable() |
| Yank highlight | vim.highlight.on_yank() | vim.hl.on_yank() |
| LSP keymaps | manual setup only | grn/gra/grr defaults (can override) |
| Treesitter start | manual per-language | FileType autocmd for all languages |
| Root detection | synchronous | async callback pattern |
