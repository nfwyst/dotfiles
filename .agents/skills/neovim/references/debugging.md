# Debugging a Neovim config

When something's wrong — a plugin won't load, the LSP is silent, startup is slow — a short list of tools covers 90% of cases.

## First stop: `:checkhealth`

```vim
:checkhealth           " everything
:checkhealth nvim      " core
:checkhealth lsp       " LSP clients / configs
:checkhealth vim.treesitter
:checkhealth mason
:checkhealth <plugin>  " many plugins register health checks
```

Read the output carefully — it surfaces missing binaries, deprecated APIs, misconfigured providers, missing parsers. Start here every time.

## LSP debugging

### Is the server attached?

```vim
:LspInfo          " nvim-lspconfig command (legacy but still useful)
:lua =vim.lsp.get_clients()
:lua =vim.lsp.get_clients({ bufnr = 0 })  " clients on this buffer
```

If the server isn't attached:
1. Is the binary on `$PATH`? Run `which <server>` in your shell.
2. Did `root_dir` resolve? Servers usually don't attach if no project root is found. Check with `:lua =vim.fs.root(0, {'package.json', '.git'})`.
3. Is the filetype correct? `:set ft?`. Filetype mismatches are a common silent failure.
4. Is the server gated by a `root_dir` callback that returned nil? (Common with dual-server setups for one language.)

### Server running but not working

```vim
:LspLog            " opens the log file
:lua vim.lsp.set_log_level("debug")  " increase verbosity, reproduce, then read :LspLog
```

Things to look for: initialization errors, capability negotiation, workspace folders, unresponsive `textDocument/*` requests.

### Capabilities

```vim
:lua =vim.lsp.get_clients({bufnr=0})[1].server_capabilities
```

If a feature (hover, rename, format) doesn't work, check whether the server actually advertises it.

## Plugin not loading

1. `:Lazy` (or equivalent) — check that the plugin is listed and has no errors.
2. For lazy.nvim: `:Lazy profile` shows what loaded when. If a plugin is meant to lazy-load on an event/command that never fires, it'll just sit there.
3. `:lua =package.loaded["plugin-name"]` — returns the module if it's loaded, `nil` if not.
4. `:messages` — past error messages.
5. `:Notifications` (if `noice.nvim` or `snacks.notifier` is installed) — persistent notification history.

## Lua errors

- `:messages` — last errors.
- `vim.print(obj)` or `=obj` in `:lua` — pretty-print tables. Replaces the need for `vim.inspect()`.
- `:lua require("mod")` and watch for errors reloading.
- For a clean reload during iteration:
  ```lua
  package.loaded["mymodule"] = nil
  require("mymodule")
  ```

## Startup profiling

### Built-in

```bash
nvim --startuptime /tmp/start.log
```

Open the log; big numbers are slow steps. This tells you file-load time, not runtime overhead.

### lazy.nvim profile

```vim
:Lazy profile
```

Shows per-plugin load time with a threshold slider. Best tool for hunting plugin-induced slowdowns.

### Runtime profiling

```vim
:profile start /tmp/profile.log
:profile func *
:profile file *
" ... do the slow thing ...
:profile pause
:noautocmd qa!
```

Then read `/tmp/profile.log`. Heavy — only for specific "action X is slow" investigations.

## Common problem patterns

**"Icons show as `?`"** — terminal isn't using a Nerd Font. Fix the terminal, not the plugin.

**"Treesitter highlighting gone for filetype X"** — parser not installed (`:TSInstall x`) or main branch users need `vim.treesitter.start()` enabled. See `references/treesitter.md`.

**"Clipboard doesn't work"** — `vim.opt.clipboard = "unnamedplus"` requires an external provider: `xclip`, `xsel`, `wl-clipboard`, or `pbcopy` (macOS, built-in). `:checkhealth provider` tells you which are available.

**"Python/Node/Ruby provider warnings in checkhealth"** — these only matter if you use Python/Node/Ruby plugins (rare today). Silence with `vim.g.loaded_python3_provider = 0` etc. if you don't need them.

**"Config works on one machine, not another"** — differences in: Neovim version (`nvim --version`), plugin versions (lockfile committed?), installed binaries, terminal, locale, shell.

**"Mysterious lag when typing"** — `updatetime` too high, `CursorHold` autocmd doing expensive work, `incsearch` with huge files, or a lagging LSP. Try `:set eventignore=CursorHold,CursorMoved` temporarily to isolate.

## Bisecting

Comment out half the plugin list, restart, see if issue persists. Binary search. Crude but effective when you can't pinpoint the culprit.

With lazy.nvim: `enabled = false` on a spec disables it for the session.

## Safe config editing

- Keep a git commit before any big refactor. `cd ~/.config/nvim && git diff` after each iteration.
- Use `:source %` to reload the current Lua file (some changes need a full restart — options, pack setup, etc.).
- `nvim -u NORC` starts with no user config — handy for reproducing "is this Neovim or my config?"
- `nvim --clean` is even stricter: no config, no plugins, no rtp.

## Version-specific oddities

When the user reports something that works in the docs but not for them, first check:

```bash
nvim --version | head -1
```

Some APIs moved between 0.10 and 0.11, and 0.12 brings vim.pack. See `references/migration.md`.
