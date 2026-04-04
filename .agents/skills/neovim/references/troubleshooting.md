# Troubleshooting Reference

Common issues and solutions for this Neovim configuration.

## Startup Issues

### Blank screen or no colorscheme

**Cause**: Plugins not yet installed (first launch) or colorscheme plugin failed to load.

**Fix**:
```vim
:PlugSync
```
Wait for downloads, then restart Neovim. The transparent background bootstrap in `options.lua` prevents white flash during install.

### "E5113: Error while calling lua chunk" on startup

**Cause**: One of the `safe_require()` modules has a syntax error or missing dependency.

**Fix**: Errors are deferred to `UIEnter` and shown as notifications. Read the error message carefully — it includes the module name (e.g., `plugins: ...`).

### Hit-enter prompt during plugin loading

**Cause**: `vim.pack.add()` progress messages overflow `cmdheight` before noice.nvim loads.

**Fix**: Already handled — `shortmess` is set to `"aAFOTIcC"` during `vim.pack.add()` and restored after. If still occurring, check if `vim.o.shortmess` is being reset elsewhere.

### Slow startup (>200ms)

**Diagnosis**:
```bash
nvim --startuptime /tmp/startup.log
sort -k 2 -n -r /tmp/startup.log | head -20
```

**Common causes**:
- Mason auto-install triggering on first launch (one-time, deferred 100ms)
- blink.cmp cargo build (one-time, on PackChanged)
- fortune command timeout (capped at 200ms via `vim.system`)

## LSP Issues

### No LSP attached to buffer

**Check**:
```vim
:checkhealth vim.lsp
:lua vim.print(vim.lsp.get_clients({ bufnr = 0 }))
```

**Common causes**:
1. Binary not installed: `:Mason` → search → install
2. Binary not in PATH: Check `vim.fn.stdpath("data") .. "/mason/bin"` is in PATH
3. Server not in `vim.lsp.enable()` list: Edit `lua/config/lsp.lua`
4. No root marker found: Server needs a `root_markers` file (e.g., `package.json`, `.git`)

### LSP errors in log

```vim
:lua vim.lsp.log.set_level(vim.log.levels.DEBUG)
" Reproduce, then check:
:!cat ~/.local/state/nvim/lsp.log
" Remember to disable after:
:lua vim.lsp.log.set_level(vim.log.levels.OFF)
```

### vtsls "Invalid input" or crashes

**Cause**: Memory exhaustion (large monorepo).

**Fix**: Already set `maxTsServerMemory = 32768` (32GB). If still crashing:
```lua
-- In lsp/vtsls.lua
tsserver = { maxTsServerMemory = 1024 * 64 },
```

### Vue files: no TypeScript intellisense in `<script>`

**Check**:
1. vue-language-server installed: `:Mason` → check
2. `@vue/typescript-plugin` path exists:
```vim
:lua vim.print(vim.fn.isdirectory(vim.fn.stdpath("data") .. "/mason/packages/vue-language-server/node_modules/@vue/language-server"))
```
3. Both `vue_ls` and `vtsls` attached:
```vim
:lua vim.print(vim.tbl_map(function(c) return c.name end, vim.lsp.get_clients({ bufnr = 0 })))
```

### Tailwind LSP starts but provides no completions

**Cause**: No `tailwind.config.{js,ts,cjs,mjs}` found in project root.

**Fix**: The `on_attach` auto-stops the client if no config found. Create a tailwind config or check the config file name.

### Noisy diagnostics (false positives)

**Already handled** in `hack.lua`. To add new suppressions:
```lua
-- In lua/config/hack.lua, add to black_list:
{ source = "source_name", message = "pattern" },
{ source = "source_name", codes = { 1234 } },
```

## Completion Issues

### blink.cmp: "module not found" or no fuzzy matching

**Cause**: Rust module not built.

**Fix**:
```bash
cd ~/.local/share/nvim/site/pack/core/opt/blink.cmp
cargo build --release
```

Or trigger via `:PlugSync` → PackChanged hook will rebuild.

### Completion menu not showing

**Check**:
```vim
:lua vim.print(pcall(require, "blink.cmp.fuzzy.rust"))
:lua vim.print(require("blink.cmp.config").get().sources)
```

**Causes**: LSP not attached (no LSP source), buffer too small (buffer source min_keyword_length=2), or Rust module build failure.

### Cmdline completion not working

**Check**: Only auto-shows for `:` commands. For `/`/`?` search, completion is via ghost text only.

## Treesitter Issues

### No syntax highlighting for a filetype

**Check**:
```vim
:lua vim.print(vim.b.ts_highlight)
:lua vim.print(vim.treesitter.language.get_lang(vim.bo.filetype))
:lua vim.print(vim.treesitter.query.get(vim.treesitter.language.get_lang(vim.bo.filetype), "highlights"))
```

**Causes**:
1. No parser installed: `:TSInstall <language>`
2. No highlight queries: `try_treesitter_start()` falls back to syntax highlighting
3. Language not registered: Add `vim.treesitter.language.register()` in `coding.lua`

### Nushell (nu) files: no treesitter highlighting

**Expected behavior**: Nu parser exists but has no highlight queries. `try_treesitter_start()` detects this and falls back to `vim.bo.syntax = "nu"`. If treesitter was started first (e.g., by quickfile), it's explicitly stopped.

### MDX: import/export not highlighted as code

**Check**: MDX treesitter injections rely on the custom `is-filetype?` predicate. Verify:
```vim
:lua vim.print(vim.bo.filetype)  -- Should be "mdx"
:InspectTree  -- Check injection nodes
```

## Formatting Issues

### Format on save not working

**Check**:
```vim
:lua vim.print(vim.g.autoformat)   -- Global toggle
:lua vim.print(vim.b.autoformat)   -- Buffer toggle
:lua vim.print(require("conform").list_formatters())
```

**Toggle**: `<leader>uf` (global), `<leader>uF` (buffer)

### prettierd using wrong config

**Check**: `<leader>cf` sets `PRETTIERD_DEFAULT_CONFIG` based on `shiftwidth`. If using `shiftwidth=4`, it uses `.prettierrc_tab.json`.

```vim
:lua vim.print(vim.env.PRETTIERD_DEFAULT_CONFIG)
```

### eslint_d not finding config

**Check**: `util.get_file_path()` walks up from the buffer's directory. It checks for eslint config files and also looks for `eslintConfig` in `package.json`.

```vim
:lua vim.print(require("config.util").get_file_path(require("config.constant").ESLINT, { for_eslint = true, ensure_package = true }))
```

### Tabs remain after formatting

**Already handled**: Post-save hook runs `:retab` via `format_after_save`.

## UI Issues

### Images invisible after closing floating windows

**Known issue**: Kitty graphics protocol placeholders get overwritten by float redraws. Workaround in `after/plugin/snacks-image-fix.lua` — auto-rebuilds placements on `WinClosed`.

**If still broken**: Check Snacks version for upstream fix (tracking: snacks.nvim#2634).

### Cursor ghosting in tmux

**Cause**: Double synchronized output (termsync from both Neovim and tmux).

**Already handled**: `opt.termsync = false` when `$TMUX` is set.

### Vimade dimming terminals

**Already handled**: Vimade blocklist excludes `snacks_terminal` and `opencode_terminal` filetypes and `terminal` buftype.

### Snacks explorer ENOENT errors

**Cause**: Broken symlinks in `node_modules` trigger ENOENT when Snacks explorer scans directories.

**Already handled**: Noice routes filter ENOENT notifications.

### Bufferline: multiple "index.tsx" buffers indistinguishable

**Already handled**: `name_formatter` prepends parent directory for index files: `components/index.tsx` instead of `index.tsx`.

### Which-key popup too tall

**Already handled**: `height = { max = 23 }`, `no_overlap = false`.

## Dark Mode Issues

### Theme doesn't change with system dark mode

**Inside tmux**: Requires `dark-notify` writing to `~/.local/state/theme/mode`. If file doesn't exist, falls back to 5s polling.

**Outside tmux**: Uses `defaults read -g AppleInterfaceStyle` every 5s.

**Check**:
```bash
cat ~/.local/state/theme/mode  # Should contain "dark" or "light"
```

### Transparent background not working

**Check**: `vim.g.transparent_enabled` must be `true`. Tokyonight `transparent = true` only applies in dark mode.

## Performance Issues

### Large files slow

**Already handled**: `Snacks.bigfile` disables features for large files.

### Undo file error E828

**Cause**: File path too long for undo file name on macOS (>255 chars).

**Already handled**: `undo_file_check` autocmd disables `undofile` for affected buffers.

### eslint_d consuming too much memory

**Fix**: Restart eslint_d:
```bash
eslint_d restart
```

The `ESLINT_D_PPID` is set to Neovim's PID, so eslint_d should auto-stop when Neovim exits.

## Plugin Issues

### Plugin not loading after adding to vim.pack.add()

**Steps**:
1. Restart Neovim (vim.pack installs on startup)
2. Or run `:PlugSync`
3. Check `:lua vim.print(vim.pack.get("plugin-name"))`
4. Verify plugin is in `~/.local/share/nvim/site/pack/core/opt/`

### Inactive plugin cleanup on every startup

**Expected behavior**: Deferred cleanup runs 300ms after startup. If a plugin URL changes but the old directory remains, it's cleaned up automatically.
