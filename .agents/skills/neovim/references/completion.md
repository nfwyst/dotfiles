# Completion Engines

Two engines dominate modern Neovim: **blink.cmp** and **nvim-cmp**. They are
not mix-and-match — pick one per config.

## blink.cmp

Rust-powered fuzzy matcher, new-ish (2024), faster than nvim-cmp on large
completion sets, opinionated defaults. Requires `blink.lib` for the v2 line.

Minimal setup:

```lua
require("blink.cmp").setup({
  keymap = { preset = "default" },   -- or "super-tab", "enter"
  sources = {
    default = { "lsp", "path", "snippets", "buffer" },
  },
  completion = {
    accept = { auto_brackets = { enabled = true } },
    menu = { border = "rounded" },
    documentation = { auto_show = true, auto_show_delay_ms = 200 },
  },
  fuzzy = { implementation = "prefer_rust_with_warnings" },
})
```

Key points:
- The Rust fuzzy backend is built from source via `cargo` on first install.
  If the user sees "Rust fuzzy not available", they need `rustup` + `cargo`
  on `$PATH`, or to set `implementation = "lua"` as fallback.
- LSP capabilities: `require("blink.cmp").get_lsp_capabilities()` — merge
  into every LSP setup.
- Snippets: set `snippets.preset = "luasnip"` if using LuaSnip, otherwise
  the bundled snippet expander works with `friendly-snippets`.

Keymap presets:
- `default` — `<C-y>` accept, `<C-n>/<C-p>` select, `<C-space>` open, `<Tab>`
  does nothing special.
- `super-tab` — `<Tab>` accepts / expands / selects next (VS Code-like).
- `enter` — `<CR>` accepts. Use with care; collides with newline.

---

## nvim-cmp

Mature (2021+), modular source system, the default recommendation until
blink.cmp arrived. Still perfectly fine.

```lua
local cmp = require("cmp")
cmp.setup({
  snippet = {
    expand = function(args) require("luasnip").lsp_expand(args.body) end,
  },
  mapping = cmp.mapping.preset.insert({
    ["<C-Space>"] = cmp.mapping.complete(),
    ["<CR>"] = cmp.mapping.confirm({ select = true }),
    ["<Tab>"] = cmp.mapping.select_next_item(),
    ["<S-Tab>"] = cmp.mapping.select_prev_item(),
  }),
  sources = cmp.config.sources({
    { name = "nvim_lsp" },
    { name = "luasnip" },
    { name = "path" },
    { name = "buffer" },
  }),
})
```

Each source is a separate plugin:
- `hrsh7th/cmp-nvim-lsp` (LSP)
- `hrsh7th/cmp-buffer`
- `hrsh7th/cmp-path`
- `saadparwaiz1/cmp_luasnip`
- `hrsh7th/cmp-cmdline` (for `:` and `/` cmdline completion)

LSP capabilities: `require("cmp_nvim_lsp").default_capabilities()`.

---

## Choosing between them

| If… | Pick |
|---|---|
| Starting a new config today | blink.cmp (faster, less boilerplate) |
| Already on nvim-cmp and everything works | Don't migrate |
| Need a very custom source ecosystem | nvim-cmp (more community sources) |
| Want minimal deps | blink.cmp |
| On Neovim ≤ 0.9 | nvim-cmp (blink.cmp targets 0.10+) |

---

## Snippets

- **friendly-snippets** — community snippet collection, VS Code format.
  Works with both engines.
- **LuaSnip** — Lua-native snippet runtime; most powerful.
- **vim-vsnip** — older, declining use.
- Built-in snippet support (0.10+): `vim.snippet.expand`,
  `vim.snippet.active`, `vim.snippet.jump`. blink.cmp can use this directly.

---

## Common completion problems

**"My completion is super slow"** — usually the buffer source scanning a
huge file. Limit:

```lua
-- blink.cmp
sources = {
  providers = {
    buffer = { opts = { get_bufnrs = function() return {} end } }, -- only current
  },
}
```

**"No LSP items appear"** — capabilities not passed to the LSP server.
Re-check every `.setup{}` includes merged capabilities.

**"Completion fires during comments/strings"** — treesitter-aware
completion requires `trigger.show_on_blocked_trigger_characters` (blink.cmp)
or source filtering (nvim-cmp) tuned.

**"`<Tab>` feels laggy"** — super-tab presets wait to disambiguate with
snippet expansion; consider the `default` preset instead.

---

## AI completion (copilot, codeium, supermaven)

These plug in as additional sources (or as separate virtual-text engines).
Don't enable two AI completions at once — they fight for rendering and
produce flicker.
