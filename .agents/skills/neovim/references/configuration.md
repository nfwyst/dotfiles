# Configuration Reference

Detailed reference for Neovim 0.12+ configuration structure and options.

## Startup Sequence

```
init.lua
├── vim.loader.enable()             # Bytecode cache
├── vim.g.mapleader = " "           # Leader keys (before plugins)
├── vim.g.maplocalleader = "\\"
├── safe_require("config.options")  # vim.opt settings, filetype additions
├── safe_require("config.hack")     # Diagnostic blacklist filter
├── safe_require("plugins")         # vim.pack.add() + plugin configs
│   ├── vim.pack.add({...})         # Install/load plugins
│   ├── treesitter runtime bridge   # Prepend ts runtime to rtp
│   ├── PackChanged hooks           # blink.cmp cargo build, TSUpdate
│   ├── Ghostty rtp support         # If TERMINAL == "ghostty"
│   ├── Disabled built-ins          # gzip, netrwPlugin, etc.
│   ├── Deferred cleanup            # Remove inactive plugins (300ms)
│   ├── :PlugSync command           # Manual cleanup + update
│   └── Plugin configs              # colorscheme → ui → editor → coding → tools
├── safe_require("config.lsp")      # Mason PATH, diagnostics, vim.lsp.enable()
├── safe_require("config.keymaps")  # All keybindings
└── safe_require("config.autocmds") # Autocommands
```

`safe_require()` defers errors to `UIEnter` so one module's failure doesn't block the rest.

## Options (config/options.lua)

### Global Variables

| Variable | Value | Purpose |
|---|---|---|
| `snacks_animate` | `true` | Enable Snacks animations |
| `editorconfig` | `true` | Respect .editorconfig |
| `transparent_enabled` | `true` | Transparent background |
| `autoformat` | `true` | Format on save |
| `todopath` | `stdpath("data")/snacks/todo/todo.md` | Global todo file |
| `loaded_perl_provider` | `0` | Disable Perl provider |
| `loaded_ruby_provider` | `0` | Disable Ruby provider |
| `python3_host_prog` | `/opt/homebrew/bin/python3` | Python 3 path |
| `markdowns` | `{"markdown","Avante","codecompanion",...}` | Markdown-like filetypes |
| `markdown_recommended_style` | `0` | Disable recommended markdown style |

### Key Options

| Option | Value | Notes |
|---|---|---|
| `clipboard` | `unnamedplus` (not over SSH) | System clipboard |
| `scrolloff` | Dynamic (window_height/4, min 4) | Calculated at startup |
| `shiftwidth`/`tabstop`/`softtabstop` | `2` | 2-space indent |
| `expandtab` | `true` | Spaces not tabs |
| `conceallevel` | `3` | Full conceal |
| `laststatus` | `0` (set to `3` after Snacks loads) | Global statusline |
| `showtabline` | `0` | Hidden by default |
| `formatexpr` | `conform.formatexpr()` | Use conform for gq |
| `grepprg` | `rg --vimgrep` | Ripgrep |
| `smoothscroll` | `true` | Smooth scroll |
| `undofile` | `true` | Persistent undo |
| `updatetime` | `200` | Faster CursorHold |
| `timeoutlen` | `300` | Key sequence timeout |
| `swapfile` | `false` | No swap files |
| `modeline` | `false` | Disabled for security |
| `termsync` | `false` (in tmux only) | Prevent double-sync ghosting |

### Filetype Additions

```lua
vim.filetype.add({
  extension = { mdx = "mdx" },
  pattern = {
    ["compose.*%.ya?ml"] = "yaml.docker-compose",
    ["docker%-compose.*%.ya?ml"] = "yaml.docker-compose",
  },
})
```

### Paste Guard

Custom `vim.paste` override: returns `false` for non-modifiable buffers to prevent E21.

### Transparent Background Bootstrap

Before colorscheme loads, sets `Normal`, `NormalNC`, `MsgArea`, `MsgSeparator`, `StatusLine`, `StatusLineNC` to `bg=NONE, fg=NONE` to suppress visual flash during startup.

## Autocommands (config/autocmds.lua)

| Event | Group | Purpose |
|---|---|---|
| `FocusGained`, `TermClose`, `TermLeave` | checktime | Auto-reload changed files |
| `TextYankPost` | highlight_yank | Flash yanked text |
| `VimResized` | resize_splits | Equalize splits on resize |
| `BufReadPost` | last_loc | Restore cursor position |
| `FileType` (qf, help, etc.) | close_with_q | Close with `q` key |
| `FileType` (man) | man_unlisted | Mark man pages as unlisted |
| `FileType` (text, markdown, etc.) | wrap_spell | Enable wrap + spell |
| `FileType` (json, jsonc, json5) | json_conceal | Set conceallevel=0 |
| `BufWritePre` | auto_create_dir | Auto-create parent dirs |
| `FileType` (markdowns) | markdown_linebreak | Disable linebreak |
| `BufReadPre`, `BufNewFile` | undo_file_check | Disable undofile for long paths (>255 chars, E828 on macOS) |
| `BufNewFile` | new_file_indent | Fix Snacks indent guide for new files |

## Utility Functions (config/util.lua)

| Function | Purpose |
|---|---|
| `M.root()` | Find root via `.git` or `lua` marker, fallback `vim.uv.cwd()` |
| `M.git_root()` | Find root via `.git` only |
| `M.has_eslint_config(path)` | Check if package.json has `eslintConfig` field |
| `M.get_file_path(filenames, opts)` | Walk upward to find config file, supports `for_eslint` and `ensure_package` |
| `M.format_snippet_json(args)` | Convert selected lines to JSON snippet format (`:AddQuotes`) |
| `M.set_hl(hl, delay)` | Set highlight, optionally deferred |
| `M.icons` | Diagnostic and git icons |

## Diagnostic Blacklist (config/hack.lua)

Overrides `vim.diagnostic.set` to filter noisy diagnostics:

| Source | Filter |
|---|---|
| `eslint_d` | Messages matching `path::String` |
| `eslint_d` | Messages matching `projectService` |
| `ts` | `File is a CommonJS module` |
| `ts` | Codes: 7016 (no type declaration), 80001 (convert to ES module), 80006, 80007, 2305, 6387, 7044, 1149 |

## ETH Price Ticker (config/price.lua)

Rotates between 3 API endpoints with randomized User-Agent:

1. **Binance**: `/api/v3/ticker/price?symbol=ETHUSDT`
2. **CoinGecko**: `/api/v3/simple/price?ids=ethereum&vs_currencies=usd`
3. **Kraken**: `/0/public/Ticker?pair=ETHUSD`

- Refresh interval: 6000ms
- Timeout: 10000ms
- Deferred setup: starts after `UIEnter` to avoid blocking startup
- Display: `Ξ {price}` in lualine_x
- Toggle: `<leader>cUp`
