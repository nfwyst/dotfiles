# Keymaps and autocmds

The two primary ways Neovim configs bind behavior to user input and events. Reading a config's keymap/autocmd surface tells you a lot about its philosophy.

## vim.keymap.set

The modern API. Replaces `vim.api.nvim_set_keymap` and Vim-script `:map`.

```lua
vim.keymap.set(mode, lhs, rhs, opts)
```

- `mode`: `"n"`, `"i"`, `"v"`, `"x"`, `"t"`, `"c"`, or a list like `{"n", "v"}`. `""` means normal+visual+operator-pending.
- `rhs`: a string (vim command), or a Lua function (preferred when behavior is non-trivial).
- `opts`: `{ desc = "...", silent = true, noremap = true, expr = false, buffer = bufnr }`.

**`desc` matters**: which-key, Telescope's keymap picker, `:map`, and `:checkhealth` all surface it. Always give a human description.

**Buffer-local**: pass `buffer = 0` (current buffer) or `buffer = bufnr`. Essential for LSP on-attach bindings so they don't leak into non-LSP buffers.

## Common patterns

### Leader key setup

Set leaders **before** any plugin loads so plugin-defined mappings respect them:

```lua
vim.g.mapleader = " "
vim.g.maplocalleader = "\\"
```

### Escape alternatives

```lua
vim.keymap.set("i", "jk", "<Esc>", { desc = "Exit insert mode" })
vim.keymap.set("t", "<Esc><Esc>", "<C-\\><C-n>", { desc = "Exit terminal mode" })
```

### Better defaults

```lua
-- Keep cursor centered on half-page jumps
vim.keymap.set("n", "<C-d>", "<C-d>zz")
vim.keymap.set("n", "<C-u>", "<C-u>zz")

-- Keep search result centered
vim.keymap.set("n", "n", "nzzzv")
vim.keymap.set("n", "N", "Nzzzv")

-- Move selection up/down in visual mode
vim.keymap.set("v", "J", ":m '>+1<CR>gv=gv")
vim.keymap.set("v", "K", ":m '<-2<CR>gv=gv")

-- Yank to system clipboard with leader
vim.keymap.set({ "n", "v" }, "<leader>y", '"+y', { desc = "Yank to clipboard" })
```

### Window / buffer navigation

```lua
vim.keymap.set("n", "<C-h>", "<C-w>h")
vim.keymap.set("n", "<C-j>", "<C-w>j")
vim.keymap.set("n", "<C-k>", "<C-w>k")
vim.keymap.set("n", "<C-l>", "<C-w>l")

vim.keymap.set("n", "]b", ":bnext<CR>", { desc = "Next buffer" })
vim.keymap.set("n", "[b", ":bprevious<CR>", { desc = "Previous buffer" })
```

## Removing / overriding

- `vim.keymap.del(mode, lhs, { buffer = bufnr })` — remove.
- Setting a new mapping on the same lhs replaces the old one (unless `expr` or `callback` make it additive).
- To disable a default mapping: `vim.keymap.set("n", "Q", "<Nop>")`.

Neovim 0.10 shipped new default mappings on `gr*` (LSP: `grn` rename, `gra` code action, `grr` references, `gri` implementation, `gO` document symbols). If a user's config overrides `gr` as a general prefix, it may break these. Point it out if relevant.

## Autocmds

```lua
vim.api.nvim_create_autocmd(event, {
  group = vim.api.nvim_create_augroup("name", { clear = true }),
  pattern = "*.lua",          -- or a table of patterns
  callback = function(args)   -- preferred; args has buf, file, match, etc.
    -- ...
  end,
  -- or: command = ":normal! gg",
  desc = "Human-readable description",
})
```

**Always use a group.** Without one, reloading the config duplicates autocmds. The `{ clear = true }` idiom ensures re-sourcing is idempotent.

### Common autocmds

**Highlight on yank** (now built into Neovim 0.10+ as `vim.hl.on_yank`, but often wrapped in an autocmd):

```lua
vim.api.nvim_create_autocmd("TextYankPost", {
  group = vim.api.nvim_create_augroup("highlight-yank", { clear = true }),
  callback = function() vim.hl.on_yank({ timeout = 200 }) end,
})
```

**Restore cursor position:**

```lua
vim.api.nvim_create_autocmd("BufReadPost", {
  callback = function(args)
    local mark = vim.api.nvim_buf_get_mark(args.buf, '"')
    local line_count = vim.api.nvim_buf_line_count(args.buf)
    if mark[1] > 0 and mark[1] <= line_count then
      pcall(vim.api.nvim_win_set_cursor, 0, mark)
    end
  end,
})
```

**Filetype-specific settings** (prefer `after/ftplugin/<ft>.lua` for this — it's cleaner than an autocmd, runs in the right buffer context, and is discoverable):

```lua
-- after/ftplugin/lua.lua
vim.opt_local.shiftwidth = 2
vim.opt_local.tabstop = 2
```

**Auto-create parent directories on save:**

```lua
vim.api.nvim_create_autocmd("BufWritePre", {
  callback = function(args)
    if args.match:match("^%w%w+://") then return end -- skip URLs
    local dir = vim.fn.fnamemodify(args.file, ":p:h")
    vim.fn.mkdir(dir, "p")
  end,
})
```

## which-key integration

If the user has `which-key.nvim` installed, bindings with a `desc` are automatically grouped by prefix (e.g., all `<leader>f*` show under an "f" group). Adding groups:

```lua
require("which-key").add({
  { "<leader>f", group = "find / format" },
  { "<leader>g", group = "git" },
  { "<leader>l", group = "lsp" },
})
```

## Tips for reading a config

- Look in `lua/**/keymaps.lua`, `lua/**/autocmds.lua`, or wherever the user centralized them.
- Search for `vim.keymap.set(` and `nvim_create_autocmd(` — covers ~all bindings.
- Plugin specs often define their own keys (lazy.nvim's `keys = {}`, snacks.nvim's `keymaps = {}`). Grep for `keys =` as well.
