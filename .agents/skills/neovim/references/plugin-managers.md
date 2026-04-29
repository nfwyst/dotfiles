# Plugin Managers

Neovim's plugin-manager choice shapes the whole config: how plugins are
declared, when they load, and how lockfiles work. Identify the one in use
**before** suggesting any plugin-related change.

## Signals to identify which manager

| File / call | Manager |
|---|---|
| `vim.pack.add({...})` | **vim.pack** (native, 0.12+) |
| `require("lazy").setup(...)`, `lazy-lock.json` | **lazy.nvim** |
| `require("packer").startup(...)`, `plugin/packer_compiled.lua` | **packer.nvim** (archived, still widespread) |
| `require("pckr").add(...)` | **pckr.nvim** (packer successor) |
| `call plug#begin(...)` | **vim-plug** |
| Manual `git clone` into `pack/*/start/` or `pack/*/opt/` | Native `:packadd` (pre-vim.pack) |

---

## vim.pack (Neovim 0.12+ native)

Built in. No external dependency. Eager-loading by default — every entry in
`vim.pack.add` is cloned (if missing) and sourced at startup.

```lua
vim.pack.add({
  "https://github.com/folke/tokyonight.nvim",
  { src = "https://github.com/nvim-treesitter/nvim-treesitter", version = "main" },
})
```

Key properties:
- Plugins live under `vim.fn.stdpath("data") .. "/site/pack/core/opt/"`.
- A lockfile is written to `stdpath("data") .. "/nvim-pack-lock.json"`.
- Branches/tags via `version = "main"` or `version = vim.version.range(">=1.0")`.
- Update with `:h vim.pack.update`.
- Remove with `:h vim.pack.del`.
- No declarative lazy-loading. If you want deferred loading, wrap `require` in
  an autocmd or `vim.defer_fn`.

Guarding against slow network / dead remotes is worth doing in `init.lua`
*before* the first `vim.pack.add`:

```lua
vim.env.GIT_HTTP_LOW_SPEED_LIMIT = "1000"
vim.env.GIT_HTTP_LOW_SPEED_TIME  = "5"
```

This makes a stalled clone fail in ~5 s instead of libcurl's default 75 s.

---

## lazy.nvim

The dominant choice in the wider Neovim community. Declarative, lazy-loading
by events/keys/cmd/ft, automatic lockfile (`lazy-lock.json`), UI for
update/install/profile.

Typical layout:

```
~/.config/nvim/
├── init.lua                 # bootstraps lazy, then require("config.lazy")
└── lua/
    └── plugins/             # one file per domain; each returns a table
        ├── lsp.lua          -- returns { "neovim/nvim-lspconfig", config = ... }
        ├── ui.lua
        └── ...
```

Each `lua/plugins/*.lua` returns a spec table; lazy.nvim discovers them via
`spec = { { import = "plugins" } }` in the bootstrap.

Lazy-load triggers (in order of preference):
- `event = "VeryLazy"` — fires after UI startup.
- `ft = { "rust" }` — load on filetype.
- `keys = { { "<leader>xx", ... } }` — load on keypress.
- `cmd = "Telescope"` — load on `:Telescope ...`.
- `dependencies = {...}` — load before this plugin.

Don't `lazy = true` a colorscheme you use at startup — it'll flash.

---

## packer.nvim

Archived (2023) but still alive in thousands of configs. If the user is on
packer, don't volunteer a migration; just work within it.

```lua
require("packer").startup(function(use)
  use "wbthomason/packer.nvim"
  use { "nvim-treesitter/nvim-treesitter", run = ":TSUpdate" }
end)
```

Notable packer-isms:
- `:PackerCompile` must run after edits to regenerate
  `plugin/packer_compiled.lua`.
- `run = ...` → post-install hook.
- `requires = ...` → dependencies.

If the user complains about packer breakage, the usual culprit is a stale
`packer_compiled.lua` — delete it and `:PackerSync`.

---

## pckr.nvim

Spiritual successor to packer, by the same community. API is close to
packer's. Used by a minority; worth recognizing but rarely the default.

---

## Adding a plugin (framework-agnostic recipe)

1. Read the user's plugin file(s) to see the existing style — one-liner
   URLs? Tables with `config = function() ... end`? Imports? Match it.
2. Add the new plugin entry.
3. If the plugin needs setup, call its `.setup{}` in the same place other
   plugins are configured (the user's `plugins/*.lua` file, or a block next
   to the spec in lazy.nvim).
4. For lazy.nvim, pick the tightest reasonable lazy-load trigger.
5. For vim.pack, remember loading is eager — if you want delay, defer
   `require` yourself.
6. Restart Neovim (`:qa` + relaunch) — some managers don't pick up new
   entries from `:source $MYVIMRC` alone.

---

## Removing a plugin

- **vim.pack:** delete the entry, then `:lua vim.pack.del({"plugin-name"})`
  or wait for next sync.
- **lazy.nvim:** delete the spec, run `:Lazy clean`.
- **packer:** delete the `use` line, run `:PackerClean`.

Always also search the config for leftover `require("plugin-name")` calls.
