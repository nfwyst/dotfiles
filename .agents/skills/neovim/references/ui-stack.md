# UI stack

Optional plugins that shape how Neovim looks and feels. None of these are required — a config can be pure defaults and still be great. But when they're present, knowing their conventions saves time.

## Statuslines

| Plugin | Notes |
|---|---|
| `lualine.nvim` | The dominant choice. Component-based, themes follow colorscheme. |
| `mini.statusline` | Minimal, part of mini.nvim. Good for low-clutter setups. |
| `heirline.nvim` | Most powerful & flexible; steeper learning curve. |
| Built-in `statusline` | Configured via `vim.o.statusline`; fine for no-plugin setups. |

**lualine shape:**

```lua
require("lualine").setup({
  options = {
    theme = "auto", -- follows colorscheme
    section_separators = "", component_separators = "",
    globalstatus = true, -- one statusline for all windows (Neovim 0.7+)
  },
  sections = {
    lualine_a = { "mode" },
    lualine_b = { "branch", "diff", "diagnostics" },
    lualine_c = { { "filename", path = 1 } },
    lualine_x = { "encoding", "fileformat", "filetype" },
    lualine_y = { "progress" },
    lualine_z = { "location" },
  },
})
```

## Bufferlines / tablines

| Plugin | Notes |
|---|---|
| `bufferline.nvim` | Shows buffers as tabs with close buttons; lots of config. |
| `barbar.nvim` | Similar, different UX. |
| `tabby.nvim` | Uses Vim's native tabs rather than buffers. |

A philosophical note: Neovim's native concept is **buffers (invisible) + windows (viewports) + tabs (window layouts)**. Most bufferline plugins pretend buffers are tabs — familiar to VSCode users but not how core Vim thinks. Both are valid. Don't rewrite if the user has a working one.

## Pickers / fuzzy finders

| Plugin | Notes |
|---|---|
| `telescope.nvim` | The long-standing default. Lua-based, extensible. |
| `fzf-lua` | Fastest; uses fzf binary as backend. |
| `snacks.picker` (part of `snacks.nvim`) | Newer, minimal, increasingly popular. |
| `mini.pick` | Tiny, part of mini.nvim. |

Typical pickers a config binds: files, live grep, buffers, help, LSP symbols, git.

**Telescope example:**

```lua
local builtin = require("telescope.builtin")
vim.keymap.set("n", "<leader>ff", builtin.find_files, { desc = "Find files" })
vim.keymap.set("n", "<leader>fg", builtin.live_grep, { desc = "Live grep" })
vim.keymap.set("n", "<leader>fb", builtin.buffers, { desc = "Buffers" })
vim.keymap.set("n", "<leader>fh", builtin.help_tags, { desc = "Help" })
```

## File explorers

| Plugin | Notes |
|---|---|
| `neo-tree.nvim` | Tree view; multiple sources (files, buffers, git). |
| `nvim-tree.lua` | Classic tree sidebar. |
| `oil.nvim` | Edit filesystem as a buffer — unique, loved by many. |
| `mini.files` | Column-based browser, clean. |
| `snacks.explorer` | File explorer mode for snacks.picker. |
| Built-in `netrw` | Always available; press `-` or `:Ex`. |

`oil.nvim` is worth knowing specifically: you open a directory as a buffer, edit filenames/delete lines, `:w` applies changes. Very intuitive for bulk rename.

## Notifications / messages / cmdline

The native `:messages` and `cmdline` are functional but dated. Common replacements:

- `noice.nvim` — redirects messages to floating notifications; replaces cmdline with a centered popup. Beautiful but has edge cases with plugins that interact with cmdline.
- `nvim-notify` — notification popup system (noice uses it under the hood).
- `snacks.notifier` — snacks.nvim's built-in alternative to nvim-notify.
- `fidget.nvim` — shows LSP progress in the corner; pairs with anything.

## Dashboards / start screens

- `snacks.dashboard` (part of snacks.nvim)
- `alpha-nvim`
- `dashboard-nvim`
- `mini.starter`

Optional; many users skip them.

## Colorschemes

Popular ones the user might have:
- `catppuccin/nvim`, `folke/tokyonight.nvim`, `rose-pine/neovim`, `rebelot/kanagawa.nvim`, `ellisonleao/gruvbox.nvim`, `navarasu/onedark.nvim`, `sainnhe/everforest`.

Activation is just `vim.cmd.colorscheme("name")` after the plugin loads. Treesitter-aware themes give richer highlighting than legacy ones.

## Icons

- `nvim-web-devicons` — the older standard; requires a Nerd Font.
- `mini.icons` — newer alternative, part of mini.nvim.

Many UI plugins auto-detect either. If icons show as `?` boxes, the user's terminal font isn't a Nerd Font — that's the fix, not a plugin issue.

## snacks.nvim

folke's meta-plugin that bundles dashboard, notifier, picker, explorer, terminal, git, scratch buffers, and more under one config. If a user has it, their UI is probably 70% snacks. Common modules:

```lua
require("snacks").setup({
  bigfile = { enabled = true },    -- disable heavy stuff for huge files
  dashboard = { enabled = true },
  notifier = { enabled = true },
  picker = { enabled = true },
  explorer = { enabled = true },
  indent = { enabled = true },     -- indent guides
  input = { enabled = true },      -- prettier vim.ui.input
  quickfile = { enabled = true },  -- load small files before plugins
  scope = { enabled = true },      -- scope visualizer
  scroll = { enabled = true },     -- smooth scrolling
  statuscolumn = { enabled = true },
  words = { enabled = true },      -- highlight word-under-cursor references
})
```

Not all modules are enabled by default; check the user's spec for what they've turned on.

## which-key

`folke/which-key.nvim` shows pending-keymap hints. Purely visual — doesn't change behavior, just surfaces `desc` entries when you pause after a prefix. Modern config uses `add()`:

```lua
require("which-key").add({
  { "<leader>f", group = "find" },
  { "<leader>g", group = "git" },
})
```

## General advice when helping with UI

- UI is taste. Don't suggest swapping lualine for heirline unless the user asks.
- When debugging "the bar looks wrong" issues, check: colorscheme loaded before/after statusline plugin, icons plugin installed, Nerd Font configured in terminal.
- If the user wants a minimal, fast config, point them toward mini.nvim modules or native features rather than adding more plugins.
