# Neovim Keybindings Reference

Complete reference of all keybindings defined in the Neovim configuration.
Leader key is `<Space>`.

## General

| Key | Mode | Action |
|-----|------|--------|
| `j` / `k` | n, x | Better up/down (gj/gk, respects wrapped lines) |
| `<Esc>` | i, n, s | Clear hlsearch |
| `<C-s>` | i, x, n, s | Save file |
| `,` / `.` / `;` | i | Undo break-points (start new undo sequence) |
| `jk` | i | Escape insert mode |

## Window Navigation

| Key | Mode | Action |
|-----|------|--------|
| `<C-h>` | n | Go to left window |
| `<C-j>` | n | Go to lower window |
| `<C-k>` | n | Go to upper window |
| `<C-l>` | n | Go to right window |
| `<C-h>` | t | Go to left window (terminal) |
| `<C-j>` | t | Go to lower window (terminal) |
| `<C-k>` | t | Go to upper window (terminal) |
| `<C-l>` | t | Go to right window (terminal) |

## Buffer Navigation

| Key | Mode | Action |
|-----|------|--------|
| `<S-h>` | n | Previous buffer (BufferLineCyclePrev) |
| `<S-l>` | n | Next buffer (BufferLineCycleNext) |
| `[b` / `]b` | n | Previous / next buffer |
| `[B` / `]B` | n | Move buffer prev / next (bufferline) |
| `<leader>bb` | n | Switch to other buffer (`#`) |

## Buffer Management

| Key | Mode | Action |
|-----|------|--------|
| `<leader>bd` | n | Delete buffer (Snacks.bufdelete) |
| `<leader>bo` | n | Delete other buffers |
| `<leader>bD` | n | Delete buffer and window |
| `<leader>bp` | n | Toggle pin (bufferline) |
| `<leader>bP` | n | Delete non-pinned buffers (bufferline) |
| `<leader>br` | n | Close buffers to the right (bufferline) |
| `<leader>bl` | n | Close buffers to the left (bufferline) |
| `<leader>bj` | n | Pick buffer (bufferline) |

## Editing

| Key | Mode | Action |
|-----|------|--------|
| `<S-j>` / `<S-k>` | v, x | Move lines down / up |
| `<` / `>` | v | Better indenting (stay in visual mode) |

## Search & Replace

| Key | Mode | Action |
|-----|------|--------|
| `n` / `N` | n | Next / prev search result (centered, open folds with zv) |
| `<leader>ur` | n | Redraw / clear hlsearch / diff update |
| `<leader>sr` | n | Search and replace with grug-far (word under cursor) |

## Diagnostics

| Key | Mode | Action |
|-----|------|--------|
| `]d` / `[d` | n | Next / prev diagnostic |
| `]e` / `[e` | n | Next / prev error |
| `]w` / `[w` | n | Next / prev warning |
| `<leader>cd` | n | Line diagnostics (open_float) |

## File

| Key | Mode | Action |
|-----|------|--------|
| `<leader>fn` | n | New file |
| `<leader>xl` | n | Location list |
| `<leader>xq` | n | Quickfix list |
| `[q` / `]q` | n | Previous / next trouble/quickfix item |

## Toggle Options (`<leader>u`)

| Key | Mode | Action |
|-----|------|--------|
| `<leader>uf` | n | Toggle autoformat (global) |
| `<leader>uF` | n | Toggle autoformat (buffer) |
| `<leader>us` | n | Toggle spelling |
| `<leader>uw` | n | Toggle word wrap |
| `<leader>uL` | n | Toggle relative line numbers |
| `<leader>ul` | n | Toggle line numbers |
| `<leader>ud` | n | Toggle diagnostics |
| `<leader>uc` | n | Toggle conceal level |
| `<leader>uT` | n | Toggle treesitter highlight |
| `<leader>ub` | n | Toggle background (dark/light) |
| `<leader>uA` | n | Toggle tabline |
| `<leader>uD` | n | Toggle dim (Snacks) |
| `<leader>ua` | n | Toggle animate (Snacks) |
| `<leader>ug` | n | Toggle indent guides (Snacks) |
| `<leader>uG` | n | Toggle git signs |
| `<leader>uS` | n | Toggle smooth scroll (Snacks) |
| `<leader>uZ` | n | Toggle zoom (Snacks) |
| `<leader>uz` | n | Toggle zen mode (Snacks) |
| `<leader>uC` | n | Colorscheme picker (Snacks) |
| `<leader>uh` | n | Toggle inlay hints |
| `<leader>un` | n | Dismiss notifications |
| `<leader>uv` | n | Vimade toggle |
| `<leader>ui` | n | Inspect position |
| `<leader>uI` | n | Inspect tree |
| `<leader>uB` | n | Toggle git blame (gitsigns) |

## Windows & Tabs

| Key | Mode | Action |
|-----|------|--------|
| `<leader>w` | n | Windows (proxy to `<C-w>`) |
| `<leader>-` | n | Split window below |
| `<leader>\|` | n | Split window right |
| `<leader>wd` | n | Delete window |
| `<S-Up>` | n | Increase window height |
| `<S-Down>` | n | Decrease window height |
| `<S-Left>` | n | Decrease window width |
| `<S-Right>` | n | Increase window width |
| `<leader><tab>l` | n | Last tab |
| `<leader><tab>o` | n | Close other tabs |
| `<leader><tab>f` | n | First tab |
| `<leader><tab><tab>` | n | New tab |
| `<leader><tab>]` | n | Next tab |
| `<leader><tab>[` | n | Previous tab |
| `<leader><tab>d` | n | Close tab |

## Snacks Picker — General

| Key | Mode | Action |
|-----|------|--------|
| `<leader>,` | n | Buffers |
| `<leader>/` | n | Grep (cwd) |
| `<leader>:` | n | Command history |
| `<leader><space>` | n | Find files (cwd) |

## Snacks Picker — Files

| Key | Mode | Action |
|-----|------|--------|
| `<leader>fc` | n | Find config file |
| `<leader>ff` | n | Find files (cwd) |
| `<leader>fF` | n | Find files (root) |
| `<leader>fg` | n | Git files |
| `<leader>fr` | n | Recent files |
| `<leader>fR` | n | Recent files (cwd) |
| `<leader>fB` | n | Buffers (all) |
| `<leader>fp` | n | Projects |

## Snacks Picker — Search

| Key | Mode | Action |
|-----|------|--------|
| `<leader>sb` | n | Buffer lines |
| `<leader>sB` | n | Grep open buffers |
| `<leader>sg` | n | Grep (cwd) |
| `<leader>sG` | n | Grep (root) |
| `<leader>sw` | n | Visual selection or word (cwd) |
| `<leader>sW` | n | Visual selection or word (root) |
| `<leader>s"` | n | Registers |
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
| `<leader>sM` | n | Man pages |
| `<leader>sm` | n | Marks |
| `<leader>sR` | n | Resume |
| `<leader>sq` | n | Quickfix list |
| `<leader>s/` | n | Search history |
| `<leader>su` | n | Undo tree |
| `<leader>st` | n | Todo comments |
| `<leader>sT` | n | Todo / Fix / Fixme |

## LSP

| Key | Mode | Action |
|-----|------|--------|
| `gd` | n | Goto definition (Snacks picker) |
| `gD` | n | Goto source definition (tsgo / vtsls) |
| `grr` | n | References (Snacks picker) |
| `gri` | n | Implementation (Snacks picker) |
| `grt` | n | Type definition (Snacks picker) |
| `gR` | n | File references (ts_util / ripgrep) |
| `gk` | n | Hover (rounded border) |
| `gK` | n | Signature help (rounded border) |
| `<C-k>` | i | Signature help |
| `<leader>ca` | n, v | Code action |
| `<leader>cA` | n | Source action |
| `<leader>cr` | n | Rename |
| `<leader>cl` | n | Lsp info (checkhealth vim.lsp) |
| `<leader>cm` | n | Mason |
| `<leader>cM` | n | Add missing imports (TS) |
| `<leader>co` | n | Organize imports |
| `<leader>cD` | n | Fix all diagnostics (TS) |
| `<leader>c/` | n | Remove all carriage returns (`\r`) |
| `<leader>cc` | n, x | Run codelens |
| `<leader>cR` | n | Rename file (Snacks) |
| `<leader>cf` | n, v | Format (conform with prettierrc) |
| `<leader>cF` | n, v | Format injected languages |
| `<leader>ci` | n, v | Format with ESLint |
| `<leader>ce` | n | Run TS file (ts-worksheet) |
| `<leader>ss` | n | LSP symbols |
| `<leader>sS` | n | LSP workspace symbols |
| `ga` | n | Call hierarchy prefix |
| `gai` | n | Incoming calls |
| `gao` | n | Outgoing calls |
| `gC` | n | Goto super scope (treesitter-context) |

## Git

| Key | Mode | Action |
|-----|------|--------|
| `<leader>gg` | n | Lazygit (cwd) |
| `<leader>gG` | n | Lazygit (root) |
| `<leader>gb` | n | Git blame line (Snacks picker git_log_line) |
| `<leader>gl` | n | Git log (cwd) |
| `<leader>gL` | n | Git log (root) |
| `<leader>gf` | n | Git current file history |
| `<leader>gs` | n | Git status |
| `<leader>gS` | n | Git stash |
| `<leader>gd` | n | Git diff (hunks) |
| `<leader>gD` | n | Git diff (origin) |
| `<leader>gB` | n, x | Git browse (open) |
| `<leader>gY` | n, x | Git browse (copy URL) |

## Git Hunks (gitsigns)

| Key | Mode | Action |
|-----|------|--------|
| `]h` / `[h` | n | Next / prev hunk |
| `]H` / `[H` | n | Last / first hunk |
| `<leader>ghs` | n, v | Stage hunk |
| `<leader>ghr` | n, v | Reset hunk |
| `<leader>ghS` | n | Stage buffer |
| `<leader>ghu` | n | Undo stage hunk |
| `<leader>ghR` | n | Reset buffer |
| `<leader>ghp` | n | Preview hunk inline |
| `<leader>ghP` | n | Preview hunk |
| `<leader>ghb` | n | Blame line |
| `<leader>ghB` | n | Blame buffer |
| `<leader>ghd` | n | Diff this |
| `<leader>ghD` | n | Diff this ~ |
| `ih` | o, x | Select hunk (textobject) |

## Git Conflict (resolve.nvim)

| Key | Mode | Action |
|-----|------|--------|
| `]c` / `[c` | n | Next / prev conflict |
| `<leader>gcn` | n | Next conflict |
| `<leader>gcp` | n | Previous conflict |
| `<leader>gco` | n | Choose ours |
| `<leader>gct` | n | Choose theirs |
| `<leader>gcb` | n | Choose both |
| `<leader>gcr` | n | Choose none |
| `<leader>gcl` | n | Conflict list |

## Trouble

| Key | Mode | Action |
|-----|------|--------|
| `<leader>xx` | n | Diagnostics toggle |
| `<leader>xX` | n | Buffer diagnostics toggle |
| `<leader>cs` | n | Symbols toggle |
| `<leader>cS` | n | LSP toggle |
| `<leader>xL` | n | Location list toggle |
| `<leader>xQ` | n | Quickfix list toggle |
| `<leader>xt` | n | Todo (Trouble) |
| `<leader>xT` | n | Todo / Fix / Fixme (Trouble) |

## Snacks Utilities

| Key | Mode | Action |
|-----|------|--------|
| `<leader>e` | n | File explorer (cwd) |
| `<leader>E` | n | File explorer (root) |
| `<leader>n` | n | Notification history |
| `<leader>.` | n | Toggle scratch buffer |
| `<leader>S` | n | Select scratch buffer |
| `]]` / `[[` | n | Next / prev reference (Snacks.words) |
| `<A-n>` / `<A-p>` | n | Next / prev reference (cycle) |
| `<leader>T.` | n | Toggle scratch todo (global) |
| `<leader>Tl` | n | Toggle local scratch todo |

## Terminal

| Key | Mode | Action |
|-----|------|--------|
| `<leader>ft` | n | Float terminal (cwd) |
| `<leader>fT` | n | Float terminal (root) |
| `<C-_>` | n, t | Float terminal (root) |
| `<C-/>` | t | Hide terminal |

## Save & Quit

| Key | Mode | Action |
|-----|------|--------|
| `<leader>i` | n | Save file |
| `<leader>I` | n | Save all |
| `<leader>X` | n | Save and quit |
| `<leader>Q` | n | Quit |
| `<leader>qq` | n | Quit all |
| `<leader>qf` | n | Quit quickfix list |
| `<leader>o` | n | Update (source current file) |
| `<leader>K` | n | Keywordprg |

## Mini.surround

| Key | Mode | Action |
|-----|------|--------|
| `gsa` | n | Add surrounding |
| `gsd` | n | Delete surrounding |
| `gsf` | n | Find surrounding (right) |
| `gsF` | n | Find surrounding (left) |
| `gsh` | n | Highlight surrounding |
| `gsr` | n | Replace surrounding |
| `gsn` | n | Update `n` lines for surrounding |

## Flash

| Key | Mode | Action |
|-----|------|--------|
| `s` | n, x, o | Flash jump |
| `S` | n, o, x | Flash treesitter |
| `r` | o | Remote flash |
| `R` | o, x | Treesitter search |
| `<C-s>` | c | Toggle flash search |

## Noice

| Key | Mode | Action |
|-----|------|--------|
| `<S-Enter>` | c | Redirect cmdline |
| `<leader>snl` | n | Noice last message |
| `<leader>snh` | n | Noice history |
| `<leader>sna` | n | Noice all |
| `<leader>snd` | n | Noice dismiss all |
| `<leader>snt` | n | Noice picker |
| `<C-f>` | i, n, s | Scroll forward (noice) |
| `<C-b>` | i, n, s | Scroll backward (noice) |

## Marks & Miscellaneous

| Key | Mode | Action |
|-----|------|--------|
| `m` | n, x, s | Toggle mark (custom function) |
| `<leader>"` | v (json ft) | Add quotes (AddQuotes) |
| `<leader>cUp` | n | Toggle price display |

## Quickfix Overrides

| Key | Mode | Action |
|-----|------|--------|
| `dd` | n (qf) | Remove quickfix item |
| `d` | v (qf) | Remove selected quickfix items |
| `<CR>` | n (qf) | Jump to quickfix entry |

## CodeCompanion

| Key | Mode | Action |
|-----|------|--------|
| `<leader>acs` | n | CodeCompanion actions |
| `<leader>act` | n | CodeCompanion toggle |
| `<leader>aca` | v | Add selected to CodeCompanion |

## Leetcode

| Key | Mode | Action |
|-----|------|--------|
| `<leader>cUlm` | n | Leetcode menu |
| `<leader>cUla` | n | Leetcode all questions |
| `<leader>cUlc` | n | Leetcode console |
| `<leader>cUld` | n | Leetcode daily |
| `<leader>cUlh` | n | Leetcode description |
| `<leader>cUli` | n | Leetcode info |
| `<leader>cUll` | n | Leetcode language |
| `<leader>cUlq` | n | Leetcode question |
| `<leader>cUlr` | n | Leetcode run |
| `<leader>cUls` | n | Leetcode submit |
| `<leader>cUlt` | n | Leetcode test |
| `<leader>cUly` | n | Leetcode yank |
