# Keybinding Reference

Complete keybinding reference matching the actual configuration.

> Leader key: `<Space>` | Local leader: `\`

## Navigation

| Key | Mode | Action |
|-----|------|--------|
| `j` / `k` | n, x | Smart down/up (respects wrapped lines) |
| `<C-h/j/k/l>` | n | Move to left/lower/upper/right window |
| `<C-h/j/k/l>` | t | Window navigation from terminal |
| `<S-h>` / `<S-l>` | n | Previous / Next buffer (bufferline) |
| `[b` / `]b` | n | Previous / Next buffer |
| `n` / `N` | n, x, o | Next / Previous search result (with `zv`) |

## Buffers

| Key | Mode | Action |
|-----|------|--------|
| `<leader>bb` | n | Switch to alternate buffer |
| `` <leader>` `` | n | Switch to alternate buffer |
| `<leader>bd` | n | Delete buffer (Snacks) |
| `<leader>bo` | n | Delete other buffers |
| `<leader>bD` | n | Delete buffer and window |
| `<leader>bp` | n | Toggle pin |
| `<leader>bP` | n | Delete non-pinned buffers |
| `<leader>br` | n | Delete buffers to the right |
| `<leader>bl` | n | Delete buffers to the left |
| `<leader>bj` | n | Pick buffer |
| `[B` / `]B` | n | Move buffer prev / next |

## File / Find (Snacks Picker)

| Key | Mode | Action |
|-----|------|--------|
| `<leader><space>` | n | Find files (cwd) |
| `<leader>ff` | n | Find files (cwd) |
| `<leader>fF` | n | Find files (root dir) |
| `<leader>fb` | n | Buffers |
| `<leader>fB` | n | Buffers (all) |
| `<leader>fc` | n | Find config file |
| `<leader>fg` | n | Find files (git) |
| `<leader>fn` | n | New file |
| `<leader>fr` | n | Recent files |
| `<leader>fR` | n | Recent files (cwd) |
| `<leader>fp` | n | Projects |
| `<leader>ft` | n | Float terminal (cwd) |
| `<leader>fT` | n | Float terminal (root) |

### Picker Key Overrides (inside picker)

| Key | Mode | Action |
|-----|------|--------|
| `<A-c>` | i, n | Toggle cwd (root ↔ cwd) |
| `<C-e>` | i, n | Toggle hidden files |
| `<C-r>` | i, n | Toggle ignored files |

## Search / Grep

| Key | Mode | Action |
|-----|------|--------|
| `<leader>/` | n | Grep (cwd) |
| `<leader>sg` | n | Grep (cwd) |
| `<leader>sG` | n | Grep (root dir) |
| `<leader>sb` | n | Buffer lines |
| `<leader>sB` | n | Grep open buffers |
| `<leader>sw` | n, x | Grep word / visual selection (cwd) |
| `<leader>sW` | n, x | Grep word / visual selection (root) |
| `<leader>s/` | n | Search history |

## Search (Misc)

| Key | Mode | Action |
|-----|------|--------|
| `<leader>:` | n | Command history |
| `<leader>,` | n | Buffers |
| `<leader>sa` | n | Autocmds |
| `<leader>sc` | n | Command history |
| `<leader>sC` | n | Commands |
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
| `<leader>su` | n | Undotree |
| `<leader>s"` | n | Registers |
| `<leader>ss` | n | LSP symbols |
| `<leader>sS` | n | LSP workspace symbols |

## LSP

| Key | Mode | Action |
|-----|------|--------|
| `gd` | n | Goto definition (Snacks picker) |
| `gD` | n | Goto declaration |
| `grr` | n | References |
| `gri` | n | Goto implementation |
| `grt` | n | Goto type definition |
| `gk` | n | Hover (rounded border) |
| `gK` | n | Signature help |
| `<C-k>` | i | Signature help |
| `<leader>cr` | n | Rename |
| `<leader>ca` | n, v | Code action |
| `<leader>cA` | n | Source action |
| `<leader>cd` | n | Line diagnostics (float) |
| `<leader>cc` | n, x | Run codelens |
| `<leader>cC` | n | Refresh codelens |
| `<leader>cf` | n, v | Format |
| `<leader>cR` | n | Rename file |
| `<leader>cl` | n | LSP health check |
| `<leader>cm` | n | Mason |
| `gai` | n | Incoming calls |
| `gao` | n | Outgoing calls |
| `]]` / `[[` | n | Next / Previous reference (Snacks.words) |

## Diagnostics

| Key | Mode | Action |
|-----|------|--------|
| `]d` / `[d` | n | Next / Previous diagnostic |
| `]e` / `[e` | n | Next / Previous error |
| `]w` / `[w` | n | Next / Previous warning |

## Git

| Key | Mode | Action |
|-----|------|--------|
| `<leader>gg` | n | Lazygit (cwd) |
| `<leader>gG` | n | Lazygit (root) |
| `<leader>gb` | n | Git blame line |
| `<leader>gl` | n | Git log (cwd) |
| `<leader>gL` | n | Git log (root) |
| `<leader>gf` | n | Git current file history |
| `<leader>gs` | n | Git status |
| `<leader>gS` | n | Git stash |
| `<leader>gd` | n | Git diff (hunks) |
| `<leader>gD` | n | Git diff (origin) |
| `<leader>gB` | n, x | Git browse (open) |
| `<leader>gY` | n, x | Git browse (copy URL) |

### Gitsigns (buffer)

| Key | Mode | Action |
|-----|------|--------|
| `]h` / `[h` | n | Next / Previous hunk |
| `<leader>ghs` | n, v | Stage hunk |
| `<leader>ghr` | n, v | Reset hunk |
| `<leader>ghS` | n | Stage buffer |
| `<leader>ghu` | n | Undo stage hunk |
| `<leader>ghR` | n | Reset buffer |
| `<leader>ghp` | n | Preview hunk inline |
| `<leader>ghb` | n | Blame line |
| `<leader>ghB` | n | Blame buffer |
| `<leader>ghd` | n | Diff this |
| `<leader>ghD` | n | Diff this (~) |
| `ih` | o, x | Select hunk (text object) |

## Trouble

| Key | Mode | Action |
|-----|------|--------|
| `<leader>xx` | n | Diagnostics (Trouble) |
| `<leader>xX` | n | Buffer diagnostics (Trouble) |
| `<leader>cs` | n | Symbols (Trouble) |
| `<leader>cS` | n | LSP references/definitions (Trouble) |
| `<leader>xL` | n | Location list (Trouble) |
| `<leader>xQ` | n | Quickfix list (Trouble) |
| `<leader>xl` | n | Location list (native) |
| `<leader>xq` | n | Quickfix list (native) |
| `[q` / `]q` | n | Previous / Next trouble/quickfix item |

## Toggles

| Key | Mode | Action |
|-----|------|--------|
| `<leader>uf` | n | Toggle auto format (global) |
| `<leader>uF` | n | Toggle auto format (buffer) |
| `<leader>us` | n | Toggle spelling |
| `<leader>uw` | n | Toggle word wrap |
| `<leader>uL` | n | Toggle relative line numbers |
| `<leader>ul` | n | Toggle line numbers |
| `<leader>ud` | n | Toggle diagnostics |
| `<leader>uc` | n | Toggle conceal level |
| `<leader>uT` | n | Toggle treesitter highlight |
| `<leader>ub` | n | Toggle background (dark/light) |
| `<leader>uh` | n | Toggle inlay hints |
| `<leader>uA` | n | Toggle tabline |
| `<leader>uC` | n | Colorscheme picker |
| `<leader>uD` | n | Toggle dim |
| `<leader>ua` | n | Toggle animate |
| `<leader>ug` | n | Toggle indent guides |
| `<leader>uG` | n | Toggle git signs |
| `<leader>uS` | n | Toggle smooth scroll |
| `<leader>uz` | n | Toggle zen mode |
| `<leader>uZ` | n | Toggle zoom |
| `<leader>uv` | n | Toggle vimade |

## Editing

| Key | Mode | Action |
|-----|------|--------|
| `<S-j>` / `<S-k>` | n, v, x | Move lines down / up |
| `<` / `>` | v | Indent / Dedent (stay in visual) |
| `gco` / `gcO` | n | Add comment below / above |
| `m` | n, x, s | Toggle mark (set or delete) |
| `jk` | i | Exit insert mode |
| `,` / `.` / `;` | i | Undo break-points |

## Windows / Tabs

| Key | Mode | Action |
|-----|------|--------|
| `<leader>w` | n | Window prefix |
| `<leader>-` | n | Split window below |
| `<leader>\|` | n | Split window right |
| `<leader>wd` | n | Delete window |
| `<leader>wm` | n | Toggle zoom |
| `<S-Up/Down>` | n | Resize window height |
| `<S-Left/Right>` | n | Resize window width |
| `<leader><tab><tab>` | n | New tab |
| `<leader><tab>d` | n | Close tab |
| `<leader><tab>]` / `[` | n | Next / Previous tab |
| `<leader><tab>l` / `f` / `o` | n | Last / First / Close other tabs |

## Explorer

| Key | Mode | Action |
|-----|------|--------|
| `<leader>e` | n | File explorer (cwd) |
| `<leader>E` | n | File explorer (root) |
| `/` | n (in explorer) | Toggle search input |
| `<Esc>` | n, i (in input) | Toggle search input |

## Misc

| Key | Mode | Action |
|-----|------|--------|
| `<C-s>` | i, x, n, s | Save file |
| `<leader>i` | n, x, s | Save file |
| `<leader>I` | n, x, s | Save all |
| `<leader>X` | n, x, s | Save and quit all |
| `<leader>Q` | n | Quit |
| `<leader>qq` | n | Quit all |
| `<leader>K` | n | Keywordprg |
| `<leader>o` | n | Update and source |
| `<leader>ur` | n | Redraw / Clear hlsearch |
| `<leader>ui` | n | Inspect position |
| `<leader>uI` | n | Inspect tree |
| `<leader>.` | n | Scratch buffer |
| `<leader>S` | n | Select scratch buffer |
| `<leader>n` | n | Notification history |
| `<leader>un` | n | Dismiss all notifications |
| `<leader>qf` | n | Close quickfix list |
| `<c-_>` | n, t | Float terminal (root) |

## Flash (Motion)

| Key | Mode | Action |
|-----|------|--------|
| `s` | n, x, o | Flash jump |
| `S` | n, x, o | Flash treesitter |
| `r` | o | Remote flash |
| `R` | o, x | Treesitter search |

## Noice

| Key | Mode | Action |
|-----|------|--------|
| `<S-Enter>` | c | Redirect cmdline |
| `<leader>snl` | n | Last message |
| `<leader>snh` | n | History |
| `<leader>sna` | n | All messages |
| `<leader>snd` | n | Dismiss all |
| `<leader>snt` | n | Notification picker |
| `<C-f>` / `<C-b>` | i, n, s | Scroll forward / backward (LSP docs) |

## Quickfix (in qf buffer)

| Key | Mode | Action |
|-----|------|--------|
| `<CR>` | n | Open and keep cursor position |
| `dd` | n | Remove quickfix item |
| `d` | n, v | Remove selected items |

## Todos (Checkmate)

| Key | Mode | Action |
|-----|------|--------|
| `<leader>T.` | n | Toggle global scratch todo |
| `<leader>Tl` | n | Toggle local scratch todo |
