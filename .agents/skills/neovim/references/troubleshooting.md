# Troubleshooting Guide

Common issues and solutions for Neovim 0.12+ native configuration.

## Quick Diagnostics

```vim
:checkhealth              " Full system check
:checkhealth vim.lsp      " LSP status
:checkhealth vim.deprecated " Deprecated API usage
:lsp                      " Interactive LSP management
:Mason                    " Installed tools
:messages                 " Recent messages/errors
:ConformInfo              " Active formatters
```

---

## Startup Issues

### Neovim Won't Start

```bash
# Start with minimal config
nvim --clean

# Start without plugins
nvim -u NONE

# Check for errors
nvim --startuptime /tmp/startup.log
cat /tmp/startup.log | grep -i error

# Verbose mode
nvim -V10/tmp/nvim.log
cat /tmp/nvim.log | grep -i error
```

### Plugin Installation Fails

```bash
# Clear plugin cache
rm -rf ~/.local/share/nvim/site/pack/core/opt/

# Remove lockfile
rm ~/.config/nvim/nvim-pack-lock.json

# Check network
curl -I https://github.com

# Reinstall
nvim  # vim.pack.add() will re-download
```

### Slow Startup

```bash
nvim --startuptime /tmp/startup.log -c "q"
sort -k2 -n -r /tmp/startup.log | head -20
```

Check for:
- Heavy plugin setup in `require()` calls (not deferred)
- Large number of treesitter parsers
- Slow LSP server startup
- Slow `fortune` command in dashboard

---

## Syntax Highlighting Issues

### No Highlighting on Direct File Open

**Root cause**: Snacks quickfile starts treesitter before plugins load. For languages where parser exists but no `highlights.scm` queries (e.g., `nu`), treesitter sets `b:ts_highlight=true` and clears `syntax=""`, blocking vim syntax fallback.

**Solution** (already implemented in `coding.lua`):

```lua
-- try_treesitter_start() validates queries exist before starting
local ok, query = pcall(vim.treesitter.query.get, lang, "highlights")
if not ok or not query then
  -- Stop treesitter if running without queries
  if vim.b[buf].ts_highlight then
    pcall(vim.treesitter.stop, buf)
  end
  -- Restore syntax fallback
  if vim.bo[buf].syntax == "" then
    vim.bo[buf].syntax = ft
  end
  return
end
```

**Diagnostic steps:**

```lua
-- Check treesitter state for current buffer
:lua print("ft=" .. vim.bo.filetype .. " ts_hl=" .. tostring(vim.b.ts_highlight) .. " syntax=" .. vim.bo.syntax)

-- Check if highlight queries exist
:lua local lang = vim.treesitter.language.get_lang(vim.bo.filetype); print(lang, vim.treesitter.query.get(lang, "highlights") ~= nil)
```

### Key Behaviors (0.12)

- `vim.treesitter.get_parser()` returns `nil` (doesn't throw)
- `b:ts_highlight = true` blocks `syntax` fallback
- `vim.treesitter.start()` succeeds even without queries (creates highlighter, renders nothing)
- Markdown highlighting is enabled by default in 0.12

---

## LSP Issues

### LSP Not Starting

```vim
:lsp                   " Check status
:checkhealth vim.lsp   " Health check
```

**Common causes:**
1. Server binary not installed → `:Mason` → install
2. Server not in `vim.lsp.enable()` list → add to `config/lsp.lua`
3. Missing `lsp/<name>.lua` config → create config file
4. `root_markers` not found → add appropriate markers
5. Mason bin not in PATH → check `config/lsp.lua` PATH setup

### LSP Not Attaching to Buffer

```lua
-- Check filetype
:set filetype?

-- Check if filetype matches server config
:lua print(vim.inspect(vim.lsp.get_configs()))

-- Check root detection
:lua print(vim.inspect(vim.fs.root(0, {".git", "package.json"})))
```

### Completions Not Working

1. Check blink.cmp is loaded:
   ```lua
   :lua print(package.loaded["blink.cmp"] ~= nil)
   ```

2. Check LSP is attached:
   ```lua
   :lua print(vim.inspect(vim.tbl_map(function(c) return c.name end, vim.lsp.get_clients({ bufnr = 0 }))))
   ```

3. Manual trigger: `<C-space>` in insert mode

4. Check blink.cmp fuzzy (Rust):
   ```bash
   ls ~/.local/share/nvim/site/pack/core/opt/blink.cmp/target/release/
   # Should contain libblink_cmp_fuzzy.dylib or .so
   ```

5. Rebuild if missing:
   ```bash
   cd ~/.local/share/nvim/site/pack/core/opt/blink.cmp
   cargo build --release
   ```

### Formatting Not Working

```vim
:ConformInfo       " Check active formatters
```

**Common causes:**
1. Formatter not installed → `:Mason` → install
2. `vim.g.autoformat = false` → `<leader>uf` to toggle
3. `vim.b.autoformat = false` → `<leader>uF` to toggle
4. Formatter binary not in PATH → check Mason bin dir
5. Wrong prettierD config → check `PRETTIERD_DEFAULT_CONFIG`

### Diagnostics Not Showing

```lua
-- Check if diagnostics exist
:lua print(vim.inspect(vim.diagnostic.get(0)))

-- Check if enabled
:lua print(vim.diagnostic.is_enabled())

-- Toggle diagnostics
-- <leader>ud
```

---

## Snacks Explorer Issues

### ENOENT Errors

**Symptom**: `watch.watch: ENOENT: no such file or directory` notifications

**Cause**: Broken symlinks in `node_modules` cause `uv.fs_event` watcher to fail.

**Solution**: Filtered via Noice notify route:
```lua
{ find = "ENOENT" }
```

The watcher handles the failure gracefully (closes handle, returns). Only the notification needed suppressing.

### Explorer Not Auto-Refreshing

Check `watch = true` in explorer config:
```lua
explorer = { watch = true, ... }
```

### follow_file Not Working for gitignored Dirs

Ensure `ignored = true` in explorer config. With `ignored = false`, gitignored directories aren't entered into the tree, so `follow_file` can't locate files inside them.

---

## Plugin Issues

### Plugin Not Loading

```lua
-- Check if plugin is active
:lua for _, p in ipairs(vim.pack.get()) do if p.spec.name == "plugin-name" then print(vim.inspect(p)) end end
```

**Solutions:**
1. Run `:PlugSync` to install missing plugins
2. Check plugin URL in `plugins/init.lua`
3. Check lockfile integrity

### blink.cmp Build Fails

```bash
# Check Rust/Cargo is available
cargo --version

# Manual rebuild
cd ~/.local/share/nvim/site/pack/core/opt/blink.cmp
cargo build --release
```

### Treesitter Parser Issues

```vim
:TSInstallInfo          " Check installed parsers
:TSUpdate               " Update all parsers
:TSInstall! <lang>      " Force reinstall specific parser
```

---

## UI Issues

### Icons Not Displaying

1. Install a Nerd Font: `brew install --cask font-jetbrains-mono-nerd-font`
2. Configure terminal to use the Nerd Font
3. Verify: `:lua print("")` should show a folder icon

### Colors Wrong

```lua
-- Check termguicolors
:set termguicolors?

-- Check colorscheme
:colorscheme

-- Check terminal
echo $TERM  -- Should be xterm-256color or similar
```

### Noice Issues

```vim
:Noice dismiss       " Dismiss all messages
:Noice disable       " Temporarily disable
:Noice enable        " Re-enable
```

### Vimade Issues

```vim
:VimadeToggle        " Toggle vimade
:VimadeFadeActive    " Manually trigger fade
```

If Vimade causes issues with specific plugins:
```lua
-- Add to blocklist in ui.lua
blocklist = { custom = { buf_opts = { filetype = { "problematic_ft" } } } }
```

---

## Deprecated API Warnings

### `opts.float is deprecated`

**Source**: `vim.diagnostic.jump({ float = true })` in keymaps

**Fix**: Remove `float = true` — replaced by `on_jump` callback in 0.12

### `vim.lsp.get_active_clients()`

**Fix**: Replace with `vim.lsp.get_clients()`

### `vim.loop`

**Fix**: Replace with `vim.uv`

### Check All Deprecations

```vim
:checkhealth vim.deprecated
```

---

## Performance Issues

### High Memory

```lua
:lua print(collectgarbage("count") .. " KB")
:lua collectgarbage("collect")
```

### Input Lag

1. Check LSP response time
2. Reduce `updatetime` (currently 200ms)
3. Check treesitter for very large files (Snacks bigfile should handle this)
4. Disable animations: `<leader>ua`

---

## Reset & Recovery

### Full Reset

```bash
# Backup
mv ~/.config/nvim ~/.config/nvim.bak
mv ~/.local/share/nvim ~/.local/share/nvim.bak
mv ~/.local/state/nvim ~/.local/state/nvim.bak
mv ~/.cache/nvim ~/.cache/nvim.bak

# Restore from dotfiles
# git clone <repo> → copy .config/nvim/
nvim  # Plugins auto-install via vim.pack
```

### Clear Plugin Cache Only

```bash
rm -rf ~/.local/share/nvim/site/pack/core/opt/
rm ~/.config/nvim/nvim-pack-lock.json
nvim  # Re-downloads everything
```

### Quick Troubleshoot

```bash
nvim --clean        # No config
nvim -u NONE        # No init.lua
```
