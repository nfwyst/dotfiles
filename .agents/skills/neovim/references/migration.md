# Migration notes across Neovim versions

Neovim's API has shifted meaningfully in recent releases. When helping a user, check their version first:

```bash
nvim --version | head -1
```

Then cross-reference with this file. Point out deprecations gently — users often have working configs where "deprecated but still works" is fine.

## 0.10 (released May 2024)

**New defaults you can count on:**
- LSP keymaps out of the box: `grn` (rename), `gra` (code action), `grr` (references), `gri` (implementation), `gO` (document symbols), `K` (hover), `<C-s>` in insert mode (signature help).
- `vim.hl.on_yank()` replaces `vim.highlight.on_yank()` (the older name still works, with a deprecation warning in later versions).
- Built-in commenting via `gc` / `gcc` (treesitter-aware for most languages). `numToStr/Comment.nvim` and `tpope/vim-commentary` can be removed if the user only uses them for the basics.
- Inlay hints API stable: `vim.lsp.inlay_hint.enable(true)`.

**Deprecations to watch for:**
- `vim.lsp.get_active_clients()` → `vim.lsp.get_clients()`.
- `vim.diagnostic.goto_next()` / `goto_prev()` → `vim.diagnostic.jump({ count = ±1 })`.

## 0.11 (released March 2025)

**The big one: native LSP configuration.**

- `vim.lsp.config(name, cfg)` — declare a server config.
- `vim.lsp.enable({ "lua_ls", "pyright", "gopls" })` — enable them.
- Runtime-path autodiscovery: any `lsp/<name>.lua` file anywhere on `runtimepath` that returns a table is picked up automatically. This is the "new way" to organize per-server configs.

**What this means for nvim-lspconfig users:**
- nvim-lspconfig still works perfectly — it now provides default configs via `lsp/*.lua` files on its runtimepath, consumed by the native `vim.lsp.config` system. Nothing urgent to change.
- The "classic" `require("lspconfig").lua_ls.setup({...})` is still supported. You can migrate piecemeal or not at all.
- For **new configs**, the native path is simpler: no dependency on nvim-lspconfig at all.

**Other 0.11 highlights:**
- `vim.diagnostic.config({ virtual_lines = {...} })` — render diagnostics inline below the line, not as virtual text.
- `vim.lsp.buf.hover()` and signature help get default border, window config options.
- Built-in terminal improvements.
- `vim.fs.root(0, {'markers'})` is the idiomatic root resolver.

**Common deprecation warnings:**
- Some signs-API paths changed; if the user sees warnings from `vim.fn.sign_define`, consider migrating to `vim.diagnostic.config({ signs = { text = {...} } })`.

## 0.12 (stable track as of 2026)

**Native plugin manager: `vim.pack`.**

- `vim.pack.add({ { src = "https://github.com/..." } })` — install + load.
- `vim.pack.update()` — update all managed plugins.
- `vim.pack.del({"repo"})` — remove.
- No dependency resolution, no lazy-loading, no lockfile — intentionally minimal. See `references/plugin-managers.md`.

**Who should use it:** users who want to drop lazy.nvim/packer, don't need lazy-loading, and value a zero-dependency setup. For a complex config with 50+ plugins, lazy.nvim is still more ergonomic.

**Other 0.12 changes to look for:**
- Further LSP API polish.
- Continued treesitter main-branch work (main is still opt-in via branch = "main" in plugin manager).

## Practical migration advice

- **Don't migrate without a reason.** If the user's config works, the fact that it uses deprecated APIs isn't urgent. Deprecations usually stick around for 1-2 major versions before removal.
- **Migrate at natural breakpoints.** When the user is already editing a file, sneak in a small modernization. Big rewrites are rarely worth it.
- **Prefer additive migrations.** Add a new `lsp/lua_ls.lua` and `vim.lsp.enable("lua_ls")` next to the existing `lspconfig.lua_ls.setup{}` — then delete the old one once you've verified the new path works.
- **Read the deprecation message.** Neovim's warnings usually cite the replacement API directly. `:messages` keeps them.

## Checking for API removals

When a config fails on a new Neovim version:

```vim
:checkhealth
:messages
```

Specifically look for `E` (error) and `W` (warning) entries mentioning `deprecated` or `removed`.

Also useful:

```bash
nvim --headless -c 'checkhealth' -c 'write /tmp/health.txt' -c 'qa!'
```

Get the health report without opening the UI, handy for comparing across machines or version bumps.

## Historical context (for reading older configs)

- Pre-0.7: autocmds via `:autocmd` strings in vimscript. The Lua `nvim_create_autocmd` API arrived in 0.7.
- Pre-0.8: `vim.api.nvim_set_keymap`. Superseded by `vim.keymap.set` (0.7+, mainstream by 0.8).
- Pre-0.10: LSP keymaps had to be manually defined in `on_attach`.
- Pre-0.11: nvim-lspconfig was effectively required for any LSP setup.

If you're reading a config that predates any of these, suggest modernizations, but preserve the user's structure unless they want a rewrite.
