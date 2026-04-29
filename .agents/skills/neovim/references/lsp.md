# LSP Configuration

Neovim has two parallel ways to configure LSP servers in 2025+. Pick based on
what the user's config already does; don't mix unless asked.

## Path A — Native (0.11+, recommended for new configs)

Since 0.11, Neovim exposes `vim.lsp.config()` and `vim.lsp.enable()` with an
implicit loader: any file under a `lsp/` directory in `runtimepath` whose
name matches an enabled server is auto-loaded and merged into the config.

```
~/.config/nvim/
├── lsp/
│   ├── lua_ls.lua      -- returns { cmd = {...}, root_markers = {...}, settings = {...} }
│   ├── tsgo.lua
│   └── jsonls.lua
└── lua/config/lsp.lua  -- vim.lsp.enable({ "lua_ls", "tsgo", "jsonls" })
```

Each `lsp/<name>.lua` returns a plain table. Example:

```lua
-- lsp/lua_ls.lua
return {
  cmd = { "lua-language-server" },
  filetypes = { "lua" },
  root_markers = { ".luarc.json", ".luarc.jsonc", ".git" },
  settings = {
    Lua = {
      workspace = { checkThirdParty = false },
      telemetry = { enable = false },
    },
  },
}
```

Activation, anywhere in your startup (typical: `lua/config/lsp.lua`):

```lua
vim.lsp.enable({ "lua_ls", "tsgo", "jsonls" })
```

Global defaults (capabilities, on_attach) go via `vim.lsp.config("*", {...})`:

```lua
vim.lsp.config("*", {
  capabilities = vim.tbl_deep_extend("force",
    vim.lsp.protocol.make_client_capabilities(),
    require("blink.cmp").get_lsp_capabilities()),
  on_attach = function(client, bufnr)
    -- buffer-local keymaps, disable semanticTokens, etc.
  end,
})
```

### When to prefer this path
- Neovim 0.11+ only.
- You don't need nvim-lspconfig's ~200 preset server configs, or you're happy
  writing each `lsp/<name>.lua` yourself.
- You want fewer dependencies.

---

## Path B — nvim-lspconfig (classic)

`neovim/nvim-lspconfig` ships curated defaults for most servers. Call
`.setup{}` per server:

```lua
local lspconfig = require("lspconfig")
local caps = require("blink.cmp").get_lsp_capabilities()

lspconfig.lua_ls.setup({
  capabilities = caps,
  settings = { Lua = { workspace = { checkThirdParty = false } } },
})
lspconfig.tsserver.setup({ capabilities = caps })
```

Starting with Neovim 0.11 / nvim-lspconfig's newer versions, setup internally
uses `vim.lsp.config` + `vim.lsp.enable`, so the two paths coexist. If the
user is on an older version, stick to `.setup{}`.

---

## Common tasks

### Add a new server

**Native path:**
1. Create `lsp/<server>.lua` returning `{ cmd, filetypes, root_markers, settings }`.
2. Add the server name to the `vim.lsp.enable({...})` list.
3. Install the server binary (Mason, system package manager, or npm global).

**Classic path:**
1. Check `:h lspconfig-all` for a preset.
2. Call `lspconfig.<name>.setup({ capabilities, settings })`.
3. Install the binary.

### Root directory

`root_dir` / `root_markers` controls where the server starts. Two mental
models:
- **Marker-based** (native, simpler): `root_markers = { "package.json", ".git" }`.
- **Callback-based** (lspconfig, flexible): `root_dir = function(fname) ... end`.

For gating one server vs. another on the same filetype (e.g. `tsgo` vs.
`vtsls` vs. `denols`), use a callback that returns `nil` to decline the
buffer — a `nil` root means the server doesn't start for that file.

### Capabilities and completion

Completion plugins provide extra capabilities (snippet support,
resolveSupport, etc.). Always merge them in:

```lua
-- blink.cmp
local caps = require("blink.cmp").get_lsp_capabilities()

-- nvim-cmp
local caps = require("cmp_nvim_lsp").default_capabilities()
```

Pass `caps` into every `.setup{}` call (classic) or into `vim.lsp.config("*")`
(native).

### on_attach and keymaps

As of 0.10+ many classic LSP keymaps have Neovim built-in defaults:

| Default key | Action |
|---|---|
| `grn` | `vim.lsp.buf.rename` |
| `gra` | `vim.lsp.buf.code_action` |
| `grr` | `vim.lsp.buf.references` |
| `gri` | `vim.lsp.buf.implementation` |
| `gO` | `vim.lsp.buf.document_symbol` |
| `K` | `vim.lsp.buf.hover` (already default for years) |
| `<C-s>` (insert) | `vim.lsp.buf.signature_help` |

If the user wants the old `gd`/`gr`/`gi` style, they set those explicitly in
`on_attach` or a `LspAttach` autocmd.

```lua
vim.api.nvim_create_autocmd("LspAttach", {
  callback = function(args)
    local bufnr = args.buf
    vim.keymap.set("n", "gd", vim.lsp.buf.definition, { buffer = bufnr, desc = "Go to definition" })
  end,
})
```

### Diagnostics

Configured via `vim.diagnostic.config`:

```lua
vim.diagnostic.config({
  virtual_text = { prefix = "●" },
  signs = true,
  underline = true,
  severity_sort = true,
  float = { border = "rounded", source = true },
})
```

Filtering specific diagnostic codes (e.g. suppress TS 7016 "Could not find
declaration file"): the cleanest place is a `LspAttach` autocmd that
post-filters the handler, or a wrapper around `vim.diagnostic.set`.

### Format on save

Don't use `vim.lsp.buf.format` if you have a dedicated formatter engine;
prefer conform.nvim — see `formatting-linting.md`.

If you do use LSP formatting:

```lua
vim.api.nvim_create_autocmd("BufWritePre", {
  callback = function() vim.lsp.buf.format({ async = false }) end,
})
```

---

## Debugging LSP

- `:LspInfo` / `:checkhealth vim.lsp` — is the server attached? What root?
- `:LspLog` — opens the log file. Set level with
  `vim.lsp.set_log_level("debug")` (noisy).
- Server not starting: check `cmd[1]` is on `$PATH` inside Neovim's env, not
  just your shell's. `:lua =vim.env.PATH`.
- Attaches to wrong root: check `root_markers` or `root_dir`.
- Multiple servers for one filetype: verify `root_dir` callbacks return
  `nil` for the server that should decline.

---

## Mixing servers for one language (e.g. TypeScript)

Common real-world case: `tsgo` (fast, Go-native) for plain TS, `vtsls` for
Vue projects or baseUrl-heavy tsconfigs, `denols` for Deno. Keep them
mutually exclusive via `root_dir`:

```lua
-- lsp/tsgo.lua (sketch)
return {
  cmd = { "tsgo", "--lsp", "--stdio" },
  filetypes = { "typescript", "typescriptreact", "javascript", "javascriptreact" },
  root_dir = function(bufnr, on_dir)
    local root = vim.fs.root(bufnr, { "tsconfig.json", "package.json", ".git" })
    if not root then return end
    if is_deno_project(root) or is_vue_project(root) or needs_baseurl(root) then return end
    on_dir(root)
  end,
}
```

Put the shared detection helpers in `lua/config/ts_util.lua` and require
from each `lsp/<name>.lua`.
