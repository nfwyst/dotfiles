# Keybinding Reference

Complete keybinding reference for Neovim 0.12+ configuration.

## Legend

- `<leader>` = Space
- `<localleader>` = `\`
- Modes: `n` = normal, `v` = visual, `x` = visual block, `i` = insert, `o` = operator, `t` = terminal, `c` = command, `s` = select

## Navigation

| Key | Mode | Action |
|---|---|---|
| `j` / `k` | n, x | Smart down/up (gj/gk when no count) |
| `<C-h/j/k/l>` | n | Move to window left/down/up/right |
| `<C-h/j/k/l>` | t | Move to window (terminal mode) |
| `n` / `N` | n, x, o | Next/prev search result (with zv) |

## Buffers

| Key | Mode | Action |
|---|---|---|
| `<S-h>` / `<S-l>` | n | Prev/next buffer (BufferLine) |
| `[b` / `]b` | n | Prev/next buffer (native) |
| `<leader>bb` / `` <leader>` `` | n | Switch to other buffer |
| `<leader>bd` | n | Delete buffer (Snacks) |
| `<leader>bo` | n | Delete other buffers |
| `<leader>bD` | n | Delete buffer and window |
| `<leader>bp` | n | Toggle pin (BufferLine) |
| `<leader>bP` | n | Delete non-pinned buffers |
| `<leader>br` / `<leader>bl` | n | Delete buffers right/left |
| `<leader>bj` | n | Pick buffer (BufferLine) |
| `[B` / `]B` | n | Move buffer prev/next |

## File Operations

| Key | Mode | Action |
|---|---|---|
| `<C-s>` | i, x, n, s | Save file |
| `<leader>i` | n, x, s | Save file |
| `<leader>I` | n, x, s | Save all |
| `<leader>X` | n, x, s | Save and quit all |
| `<leader>fn` | n | New file |
| `<leader>o` | n | Update and source current file |

## LSP

| Key | Mode | Action |
|---|---|---|
| `gd` | n | Go to definition (Snacks picker) |
| `gD` | n | Go to declaration (Snacks picker) |
| `grr` | n | References (Snacks picker) |
| `gri` | n | Go to implementation (Snacks picker) |
| `grt` | n | Go to type definition (Snacks picker) |
| `gk` | n | Hover (rounded border) |
| `gK` | n | Signature help |
| `<c-k>` | i | Signature help |
| `<leader>cr` | n | Rename |
| `<leader>ca` | n, v | Code action |
| `<leader>cA` | n | Source action |
| `<leader>cd` | n | Line diagnostics (float) |
| `<leader>cl` | n | LSP info (checkhealth vim.lsp) |
| `<leader>cm` | n | Mason |
| `<leader>cc` | n, x | Run codelens |
| `<leader>cC` | n | Refresh codelens |
| `<leader>cR` | n | Rename file (Snacks) |
| `gai` | n | Incoming calls |
| `gao` | n | Outgoing calls |
| `<leader>uh` | n | Toggle inlay hints |

## Diagnostics

| Key | Mode | Action |
|---|---|---|
| `]d` / `[d` | n | Next/prev diagnostic |
| `]e` / `[e` | n | Next/prev error |
| `]w` / `[w` | n | Next/prev warning |
| `[q` / `]q` | n | Prev/next trouble/quickfix item |
| `<leader>xx` | n | Diagnostics (Trouble) |
| `<leader>xX` | n | Buffer diagnostics (Trouble) |
| `<leader>cs` | n | Symbols (Trouble) |
| `<leader>cS` | n | LSP refs/defs (Trouble) |
| `<leader>xl` | n | Location list |
| `<leader>xq` | n | Quickfix list |
| `<leader>xL` | n | Location list (Trouble) |
| `<leader>xQ` | n | Quickfix list (Trouble) |

## Snacks Picker

| Key | Mode | Action |
|---|---|---|
| `<leader><space>` | n | Find files (cwd) |
| `<leader>,` | n | Buffers |
| `<leader>/` | n | Grep (cwd) |
| `<leader>:` | n | Command history |
| `<leader>ff` | n | Find files (cwd) |
| `<leader>fF` | n | Find files (root) |
| `<leader>fb` | n | Buffers |
| `<leader>fB` | n | Buffers (all, unfiltered) |
| `<leader>fc` | n | Find config file |
| `<leader>fg` | n | Git files |
| `<leader>fr` | n | Recent files |
| `<leader>fR` | n | Recent files (cwd) |
| `<leader>fp` | n | Projects |
| `<leader>sb` | n | Buffer lines |
| `<leader>sB` | n | Grep open buffers |
| `<leader>sg` | n | Grep (cwd) |
| `<leader>sG` | n | Grep (root) |
| `<leader>sw` | n, x | Grep word (cwd) |
| `<leader>sW` | n, x | Grep word (root) |
| `<leader>ss` | n | LSP symbols |
| `<leader>sS` | n | LSP workspace symbols |
| `<leader>sd` | n | Diagnostics |
| `<leader>sD` | n | Buffer diagnostics |
| `<leader>sh` | n | Help pages |
| `<leader>sH` | n | Highlights |
| `<leader>si` | n | Icons |
| `<leader>sj` | n | Jumps |
| `<leader>sk` | n | Keymaps |
| `<leader>sl` | n | Location list |
| `<leader>sm` | n | Marks |
| `<leader>sM` | n | Man pages |
| `<leader>sq` | n | Quickfix list |
| `<leader>sR` | n | Resume last picker |
| `<leader>s/` | n | Search history |
| `<leader>su` | n | Undotree |
| `<leader>s"` | n | Registers |
| `<leader>sa` | n | Autocmds |
| `<leader>sc` | n | Command history |
| `<leader>sC` | n | Commands |
| `<leader>st` | n | Todo comments |
| `<leader>sT` | n | Todo/Fix/Fixme |

### Picker Window Keys

| Key | Mode | Action |
|---|---|---|
| `<a-c>` | i, n | Toggle cwd ↔ root |
| `<c-e>` | i, n | Toggle hidden files |
| `<c-r>` | i, n | Toggle ignored files |

## Git

| Key | Mode | Action |
|---|---|---|
| `<leader>gg` | n | Lazygit (cwd) |
| `<leader>gG` | n | Lazygit (root) |
| `<leader>gb` | n | Git blame line (picker) |
| `<leader>gl` | n | Git log (cwd) |
| `<leader>gL` | n | Git log (root) |
| `<leader>gf` | n | Git current file history |
| `<leader>gs` | n | Git status |
| `<leader>gS` | n | Git stash |
| `<leader>gd` | n | Git diff hunks |
| `<leader>gD` | n | Git diff origin |
| `<leader>gB` | n, x | Git browse (open) |
| `<leader>gY` | n, x | Git browse (copy URL) |

### Gitsigns Hunks

| Key | Mode | Action |
|---|---|---|
| `]h` / `[h` | n | Next/prev hunk |
| `]H` / `[H` | n | Last/first hunk |
| `<leader>ghs` | n, v | Stage hunk |
| `<leader>ghr` | n, v | Reset hunk |
| `<leader>ghS` | n | Stage buffer |
| `<leader>ghu` | n | Undo stage hunk |
| `<leader>ghR` | n | Reset buffer |
| `<leader>ghp` | n | Preview hunk inline |
| `<leader>ghP` | n | Preview hunk |
| `<leader>ghb` | n | Blame line (full) |
| `<leader>ghB` | n | Blame buffer |
| `<leader>ghd` | n | Diff this |
| `<leader>ghD` | n | Diff this ~ |
| `ih` | o, x | Select hunk (text object) |

### Git Conflict (resolve.nvim)

| Key | Mode | Action |
|---|---|---|
| `]c` / `[c` | n | Next/prev conflict |
| `<leader>gco` | n | Choose ours |
| `<leader>gct` | n | Choose theirs |
| `<leader>gcb` | n | Choose both |
| `<leader>gcr` | n | Remove conflict (none) |
| `<leader>gcl` | n | List conflicts |

## Search & Replace

| Key | Mode | Action |
|---|---|---|
| `s` | n, x, o | Flash jump |
| `S` | n, o, x | Flash treesitter |
| `r` | o | Remote flash |
| `R` | o, x | Treesitter search |
| `<c-s>` | c | Toggle flash in search |
| `<leader>sr` | n | Search and replace (grug-far, word under cursor) |

## Format & Lint

| Key | Mode | Action |
|---|---|---|
| `<leader>cf` | n, v | Format (prettierd, config based on shiftwidth) |
| `<leader>ci` | n, v | Format with eslint_d (fix mode) |
| `<leader>cF` | n, v | Format injected languages |
| `<leader>uf` | n | Toggle auto format (global) |
| `<leader>uF` | n | Toggle auto format (buffer) |

## Toggle Options

| Key | Mode | Action |
|---|---|---|
| `<leader>us` | n | Toggle spelling |
| `<leader>uw` | n | Toggle word wrap |
| `<leader>ul` | n | Toggle line numbers |
| `<leader>uL` | n | Toggle relative numbers |
| `<leader>ud` | n | Toggle diagnostics |
| `<leader>uc` | n | Toggle conceal |
| `<leader>uT` | n | Toggle treesitter highlight |
| `<leader>ub` | n | Toggle background (dark/light) |
| `<leader>uA` | n | Toggle tabline |
| `<leader>uD` | n | Toggle dim (Snacks) |
| `<leader>ua` | n | Toggle animate (Snacks) |
| `<leader>ug` | n | Toggle indent guides |
| `<leader>uG` | n | Toggle git signs |
| `<leader>uS` | n | Toggle smooth scroll |
| `<leader>uZ` | n | Toggle zoom |
| `<leader>uz` | n | Toggle zen mode |
| `<leader>uC` | n | Colorschemes picker |
| `<leader>uv` | n | Toggle Vimade |
| `<leader>uB` | n | Toggle git blame (current line) |

## Snacks Features

| Key | Mode | Action |
|---|---|---|
| `<leader>e` | n | File explorer (cwd) |
| `<leader>E` | n | File explorer (root) |
| `<leader>n` | n | Notification history |
| `<leader>un` | n | Dismiss all notifications |
| `<leader>.` | n | Toggle scratch buffer |
| `<leader>S` | n | Select scratch buffer |
| `<leader>T.` | n | Toggle global scratch todo |
| `<leader>Tl` | n | Toggle local scratch todo |
| `]]` / `[[` | n | Next/prev reference (Snacks.words) |
| `<a-n>` / `<a-p>` | n | Next/prev reference (cross-buffer) |

## Windows & Tabs

| Key | Mode | Action |
|---|---|---|
| `<leader>w` | n | Windows prefix |
| `<leader>-` | n | Split below |
| `<leader>\|` | n | Split right |
| `<leader>wd` | n | Delete window |
| `<leader>wm` | n | Toggle zoom |
| `<S-Up/Down>` | n | Increase/decrease window height |
| `<S-Left/Right>` | n | Increase/decrease window width |
| `<leader><tab><tab>` | n | New tab |
| `<leader><tab>d` | n | Close tab |
| `<leader><tab>]` / `[` | n | Next/prev tab |
| `<leader><tab>l` / `f` / `o` | n | Last/first/close other tabs |

## Move Lines

| Key | Mode | Action |
|---|---|---|
| `<S-j>` | n | Move line down |
| `<S-k>` | n | Move line up |
| `<S-j>` / `<S-k>` | v, x | Move selection down/up |

## Terminal

| Key | Mode | Action |
|---|---|---|
| `<leader>ft` | n | Float terminal (cwd) |
| `<leader>fT` | n | Float terminal (root) |
| `<c-_>` | n, t | Float terminal (root) |
| `<C-/>` | t | Hide terminal |

## AI (CodeCompanion)

| Key | Mode | Action |
|---|---|---|
| `<leader>acs` | n, v | CodeCompanion actions |
| `<leader>act` | n, v | CodeCompanion toggle chat |
| `<leader>aca` | v | CodeCompanion add selection |
| `:cc` | c | Abbreviation for :CodeCompanion |

## LeetCode

| Key | Mode | Action |
|---|---|---|
| `<leader>cUlm` | n | Menu |
| `<leader>cUla` | n | Random |
| `<leader>cUlr` | n | Run |
| `<leader>cUls` | n | Submit |
| `<leader>cUlt` | n | List |
| `<leader>cUly` | n | Daily |

## Miscellaneous

| Key | Mode | Action |
|---|---|---|
| `<esc>` | i, n, s | Clear hlsearch |
| `<leader>ur` | n | Redraw / clear hlsearch / diff update |
| `<leader>K` | n | Keywordprg |
| `<leader>qq` | n | Quit all |
| `<leader>Q` | n | Quit window |
| `<leader>qf` | n | Close quickfix |
| `<leader>ui` | n | Inspect position |
| `<leader>uI` | n | Inspect treesitter tree |
| `gco` / `gcO` | n | Add comment below/above |
| `gC` | n | Go to treesitter context (super scope) |
| `m` | n, x, s | Toggle mark (set if unset, delete if on same line) |
| `jk` | i | Escape |
| `,` / `.` / `;` | i | Undo break-points |
| `<leader>ce` | n | Run JS/TS file (ts-worksheet, bun) |
| `<leader>cUp` | n | Toggle ETH price display |

## Quickfix Window

| Key | Mode | Action |
|---|---|---|
| `<cr>` | n | Open entry (keep qf cursor position) |
| `dd` | n | Remove entry from quickfix |
| `d` | n, v | Remove entries (supports count and visual) |

## Noice

| Key | Mode | Action |
|---|---|---|
| `<S-Enter>` | c | Redirect cmdline |
| `<leader>snl` | n | Last message |
| `<leader>snh` | n | History |
| `<leader>sna` | n | All messages |
| `<leader>snd` | n | Dismiss all |
| `<leader>snt` | n | Noice picker |
| `<c-f>` / `<c-b>` | i, n, s | Scroll forward/backward in hover |
