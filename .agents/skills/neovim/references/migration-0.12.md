# Neovim 0.12 Migration Reference

Breaking changes, deprecations, and new features in Neovim 0.12 (compared to 0.11).

## Breaking Changes

### LSP

| Change | Details |
|--------|---------|
| JSON null → `vim.NIL` | LSP messages now use `vim.NIL` for JSON `"null"` (was `nil`). Missing fields remain `nil`. |
| `vim.lsp.semantic_tokens.start/stop()` | Renamed to `vim.lsp.semantic_tokens.enable(true/false)` |
| Signature help parameter handling | Values < 0 or out of range now treated as `nil` |

### Diagnostics

| Change | Details |
|--------|---------|
| `vim.diagnostic.disable()` | **Removed** — use `vim.diagnostic.enable(false)` |
| `vim.diagnostic.is_disabled()` | **Removed** — use `not vim.diagnostic.is_enabled()` |
| Legacy `enable()` signature | **Removed** — old `vim.diagnostic.enable(buf, namespace)` no longer works |
| `:sign-define` for diagnostics | **Removed** — must use `vim.diagnostic.config({ signs = { ... } })` |

### Treesitter

| Change | Details |
|--------|---------|
| `vim.treesitter.get_parser()` | Returns `nil` on failure (no longer throws error) |
| `Query:iter_matches()` "all" option | **Removed** (was transition aid from 0.11) |
| `treesitter-directive-offset!` | Sets `metadata[capture_id].offset` instead of `.range` |

### Lua

| Change | Details |
|--------|---------|
| `vim.diff` | **Renamed** to `vim.text.diff()` |

### Options

| Change | Details |
|--------|---------|
| `'shelltemp'` | Defaults to `false` (was `true`) |

### Editor

| Change | Details |
|--------|---------|
| `i_CTRL-R` | Inserts registers **literally** (like paste), not as user input |

### Plugins

| Change | Details |
|--------|---------|
| "shellmenu" plugin | **Removed** |
| `package-tohtml` | Now opt-in: `:packadd nvim.tohtml` required |

## Deprecated APIs (0.12)

### LSP

| Deprecated | Replacement |
|---|---|
| `vim.lsp.stop_client()` | `Client:stop()` |
| `vim.lsp.client_is_stopped()` | `vim.lsp.get_client_by_id()` |
| `vim.lsp.set_log_level()` | `vim.lsp.log.set_level()` |
| `vim.lsp.get_log_path()` | `vim.lsp.log.get_filename()` |
| `vim.lsp.get_buffers_by_client_id()` | `client.attached_buffers` |
| `vim.lsp.codelens.refresh()` | `vim.lsp.codelens.enable(true)` |
| `vim.lsp.codelens.clear()` | `vim.lsp.codelens.enable(false)` |
| `vim.lsp.util.stylize_markdown()` | `vim.treesitter.start()` + `conceallevel=2` |

### Diagnostics

| Deprecated | Replacement |
|---|---|
| `"float"` in `vim.diagnostic.JumpOpts` | Use `on_jump` callback instead |

### Lua

| Deprecated | Replacement |
|---|---|
| `"buffer"` in `vim.keymap.set/del` opts | Renamed to `"buf"` |

### Still Deprecated from 0.11

| Deprecated | Replacement |
|---|---|
| `vim.lsp.start_client()` | `vim.lsp.start()` |
| `vim.lsp.get_active_clients()` | `vim.lsp.get_clients()` |
| `vim.lsp.buf.execute_command` | `Client:exec_cmd()` |
| `vim.diagnostic.goto_next/prev` | `vim.diagnostic.jump()` |
| `vim.highlight` | `vim.hl` |
| `vim.loop` | `vim.uv` |
| `vim.tbl_flatten()` | `Iter:flatten()` |
| `vim.tbl_islist()` | `vim.islist()` |

## New Features (0.12)

### vim.pack (Built-in Plugin Manager)

```lua
vim.pack.add(specs, opts?)       -- Install + load
vim.pack.update(names?, opts?)   -- Update (all or specific)
vim.pack.del(names, opts?)       -- Remove
vim.pack.get(names?, opts?)      -- Query state
```

- Lockfile: `nvim-pack-lock.json`
- Events: `PackChangedPre`, `PackChanged`
- Storage: `site/pack/core/opt/`

### LSP Enhancements

```lua
vim.lsp.enable(names)             -- Start/stop/detach as needed
vim.lsp.is_enabled(name)          -- Check if enabled
vim.lsp.get_configs(filter?)      -- Get all configs
vim.lsp.buf.workspace_diagnostics() -- Workspace diagnostics
vim.lsp.inline_completion.enable() -- Inline completion support

-- Code lenses reimplemented as virtual lines
-- vim.lsp.buf.rename() now highlights symbol with LspReferenceTarget
-- Code action filter receives client_id: filter = function(action, client_id)
-- New default keymaps: grt (type definition), grx (codelens run)
```

### Treesitter

- Markdown highlighting enabled by **default**
- `LanguageTree:parse()` accepts list of ranges
- `:EditQuery` gained tab-completion and works with injected languages
- Visual mode incremental selection: `v_an` (outward), `v_in` (inward), `v_]n`/`v_[n` (navigate)

### New Lua APIs

```lua
vim.net.request()                  -- HTTP fetch/download
vim.text.diff()                    -- Diff (renamed from vim.diff)
vim.list.unique(list)              -- Deduplicate list
vim.list.bisect(list)              -- Binary search
vim.fs.ext(path)                   -- Get file extension
vim.version.intersect(a, b)        -- Version range intersection
vim.json.encode(val, { indent = 2, sort_keys = true })  -- Pretty JSON
vim.json.decode(str, { skip_comments = true })           -- JSON with comments
Iter:unique()                      -- Deduplicate iterators
Iter:peek()                        -- Works for all iterator types
```

### Editor Improvements

```vim
:iput              " Like :put but adjusts indent
:retab -indentonly " Only change leading whitespace
:uniq              " Deduplicate text
:wall ++p          " Auto-create parent directories
:restart           " Restart Nvim, reattach UI
:DiffTool          " Compare directories/files (new bundled plugin)
:Undotree          " Visual undo tree (new bundled plugin)
```

### New Options

| Option | Purpose |
|--------|---------|
| `'pumborder'` | Popup menu border |
| `'pummaxwidth'` | Popup menu max width |
| `'winborder'` | Window border style |
| `'autocomplete'` | Enable ins-autocompletion |
| `'maxsearchcount'` | Max for `searchcount()` |

### New Highlights

| Highlight | Purpose |
|-----------|---------|
| `DiffTextAdd` | Added text within changed line |
| `SnippetTabstopActive` | Active snippet tabstop |
| `PmenuBorder` | Popup menu border |

### New Events

| Event | Purpose |
|-------|---------|
| `CmdlineLeavePre` | Before leaving command line |
| `MarkSet` | After setting a mark |
| `SessionLoadPre` | Before loading session |
| `TabClosedPre` | Before closing tabpage |
| `Progress` | Progress messages via `nvim_echo()` |

### Performance Improvements

- `vim.glob.to_lpeg()` ~50% faster
- `i_CTRL-R` literal insert: 10x speedup
- `textDocument/semanticTokens/range` — viewport-only tokens
- `:packadd` no longer invalidates Lua package path cache

## Migration Checklist (0.11 → 0.12)

- [ ] Replace `vim.diff()` → `vim.text.diff()`
- [ ] Replace `vim.diagnostic.disable()` → `vim.diagnostic.enable(false)`
- [ ] Replace `vim.diagnostic.is_disabled()` → `not vim.diagnostic.is_enabled()`
- [ ] Replace `vim.lsp.semantic_tokens.start/stop()` → `enable(true/false)`
- [ ] Update any `vim.diagnostic.enable(buf, ns)` → `vim.diagnostic.enable(true, { bufnr = buf })`
- [ ] Replace `:sign-define` for diagnostics → `vim.diagnostic.config({ signs = ... })`
- [ ] Handle `vim.treesitter.get_parser()` returning `nil`
- [ ] Replace `float` in `vim.diagnostic.jump()` → use `on_jump` callback
- [ ] Check `'shelltemp'` default change if using shell commands
- [ ] Test `i_CTRL-R` behavior with literal register insert
