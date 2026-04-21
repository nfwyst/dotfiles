# Configuration Reference

This document describes the Neovim configuration structure, covering options,
autocommands, diagnostics, LSP settings, colorscheme synchronization, and
statusline behavior.

---

## Options (`config/options.lua`)

### Global Variables

| Variable | Value |
|---|---|
| `snacks_animate` | `true` |
| `editorconfig` | `true` |
| `transparent_enabled` | `true` |
| `autoformat` | `true` |
| `todopath` | `vim.fn.stdpath("data") .. "/snacks/todo/todo.md"` |
| `loaded_perl_provider` | `0` (disabled) |
| `loaded_ruby_provider` | `0` (disabled) |
| `python3_host_prog` | `"/opt/homebrew/bin/python3"` |
| `markdowns` | `{"markdown", "Avante", "codecompanion", "octo", "grug-far-help", "checkhealth", "mdx"}` |

### Transparent Background Bootstrap

Sets the following highlight groups to `bg=NONE fg=NONE` at startup:

- `Normal`
- `NormalNC`
- `MsgArea`
- `MsgSeparator`
- `StatusLine`
- `StatusLineNC`

### Editor Options

| Option | Value | Notes |
|---|---|---|
| `scrolloff` | dynamic | `math.max(4, math.floor(vim.o.lines / 4) - 1)` |
| `conceallevel` | `3` | |
| `spelllang` | `{"en", "cjk"}` | |
| `softtabstop` | `2` | |
| `numberwidth` | `2` | |
| `listchars` | `"tab:▓░,trail:•,extends:»,precedes:«,nbsp:░"` | |
| `showcmd` | `false` | |
| `modeline` | `false` | |
| `swapfile` | `false` | |
| `ruler` | `false` | |
| `foldtext` | `""` (empty string) | |
| `showtabline` | `0` | |
| `cursorlineopt` | `"both"` | |
| `laststatus` | `0` | Hidden during startup; changed to `3` after snacks loads |
| `formatexpr` | `"v:lua.require'conform'.formatexpr()"` | |

`inccommand` is **not** set (removed from config).

### Tmux-Specific

When running inside tmux, `termsync` is set to `false`.

### Filetype Additions

- The `mdx` extension is recognized.
- Docker Compose YAML patterns are registered.

### Paste Guard

`nvim_put` is skipped in non-modifiable buffers to avoid the `E21` error.

---

## Autocommands (`config/autocmds.lua`)

| Autocmd | Event(s) | Description |
|---|---|---|
| `checktime` | `FocusGained`, `TermClose`, `TermLeave` | Checks if files changed outside Neovim |
| `highlight_yank` | `TextYankPost` | Highlights yanked text via `vim.hl.on_yank()` |
| `resize_splits` | `VimResized` | Equalizes splits on terminal resize |
| `last_loc` | `BufReadPost` | Restores last cursor position (excludes `gitcommit`) |
| `close_with_q` | `FileType` | Maps `q` to close for specific filetypes (see below) |
| `man_unlisted` | `FileType` | Sets man pages as unlisted buffers |
| `wrap_spell` | `FileType` | Enables wrap for text, plaintex, typst, gitcommit, markdown; enables spell for all **except** markdown |
| `json_conceal` | `FileType` | Sets `conceallevel=0` for `json`, `jsonc`, `json5` |
| `auto_create_dir` | `BufWritePre` | Creates parent directories before writing a file |
| `markdown_linebreak` | `FileType` | Sets `linebreak=false` for all `markdowns` filetypes |
| `undo_file_check` | — | Disables `undofile` for paths where the filename exceeds 255 chars (macOS `E828` fix) |
| `new_file_indent` | — | Fixes snacks indent guide rendering for new files |
| `formatoptions` | `FileType` | Overrides formatoptions to `"jcroqlnt"` after ftplugins run |

### `close_with_q` Filetypes

`checkhealth`, `dbout`, `gitsigns.blame`, `grug-far`, `help`, `lspinfo`,
`neotest-*`, `notify`, `qf`, `snacks_win`, `startuptime`

---

## Diagnostics (`config/lsp.lua`)

### Display Settings

```lua
{
  underline = false,
  virtual_lines = false,
  virtual_text = {
    spacing = 0,
    current_line = true,
  },
  float = {
    focusable = true,
    style = "minimal",
    border = "rounded",
    source = true,
  },
  severity_sort = true,
}
```

### Diagnostic Signs

| Severity | Icon |
|---|---|
| ERROR |  |
| WARN |  |
| INFO |  |
| HINT | 󰌶 |

---

## Diagnostic Blacklist (`config/hack.lua`)

A monkey-patch on `vim.diagnostic.set` filters out noisy diagnostics.

### eslint_d

Suppressed message patterns:

- `"path::String"`
- `"projectService"`

### TypeScript

Suppressed diagnostic codes: `7016`, `80001`, `80006`, `80007`, `7044`, `1149`

Suppressed message pattern: `"File is a CommonJS module"`

---

## Global LSP Settings (`config/lsp.lua`)

- **Capabilities**: Advertises `workspace.fileOperations` support (`didRename`,
  `willRename`).
- **on_attach**: Disables `semanticTokensProvider` for all servers.
- **Log level**: Set to `OFF`.
- **showReferences handler**: The `editor.action.showReferences` handler is
  redirected to Trouble's qflist.

---

## Colorscheme Synchronization (`plugins/colorscheme.lua`)

The colorscheme is **tokyonight** with mode-specific transparent settings.

### Detection Methods

| Environment | Method |
|---|---|
| macOS initial | Synchronous detection via `defaults read -g AppleInterfaceStyle` |
| Inside tmux | Event-driven `fs_event` watch on `~/.local/state/theme/mode` |
| Outside tmux | 15-second polling fallback |

### Custom Highlights

Applied via a `ColorScheme` autocmd after the theme loads.

---

## Statusline

- `laststatus` is set to `0` in `config/options.lua` to hide the statusline
  during startup.
- After snacks loads (in `plugins/ui.lua`), `laststatus` is changed to `3`
  (global statusline).
- `statuscolumn` is also configured after snacks loads.
