# LSP Stack Reference

Native Neovim 0.12+ LSP configuration with blink.cmp completion and conform.nvim formatting.

## Architecture

```
vim.lsp.config("*", global_opts)   → Global LSP settings for all servers
lsp/<server>.lua                    → Per-server configs (auto-discovered)
vim.lsp.enable({ list })           → Activate servers
lua/config/lsp.lua                 → Diagnostics, global config, enable list
lua/plugins/coding.lua             → blink.cmp completion
lua/plugins/tools.lua              → Mason, conform (formatting), nvim-lint (linting)
```

## Native LSP Setup

### Global Config

```lua
-- lua/config/lsp.lua
vim.lsp.config("*", {
  capabilities = {
    workspace = {
      fileOperations = { didRename = true, willRename = true },
    },
  },
  on_attach = function(client)
    client.server_capabilities.semanticTokensProvider = nil  -- Disable semantic tokens
  end,
})

vim.lsp.log.set_level(vim.log.levels.OFF)
```

### Server Config Files

Each `lsp/<name>.lua` returns a config table:

```lua
-- lsp/lua_ls.lua
return {
  cmd = { "lua-language-server" },
  filetypes = { "lua" },
  root_markers = { ".luarc.json", ".luarc.jsonc", ".luacheckrc", ".stylua.toml" },
  settings = {
    Lua = {
      runtime = { version = "LuaJIT" },
      workspace = { checkThirdParty = false, library = { ... } },
    },
  },
}
```

### Enabled Servers

```lua
vim.lsp.enable({
  "lua_ls", "vtsls", "html", "cssls", "css_variables", "cssmodules_ls",
  "emmet_language_server", "tailwindcss", "taplo", "solc", "protols",
  "docker_language_server", "jsonls", "yamlls",
})
```

### Key vim.lsp API (0.12)

```lua
vim.lsp.config(name, opts)       -- Register/merge config (auto-discovers lsp/*.lua)
vim.lsp.config("*", opts)        -- Global defaults for all servers
vim.lsp.enable(names)            -- Start/stop clients as needed
vim.lsp.is_enabled(name)         -- Check if config is enabled (new in 0.12)
vim.lsp.get_configs(filter?)     -- Get all configs (new in 0.12)
vim.lsp.get_clients(filter?)     -- Get active clients (replaces get_active_clients)

-- Client methods (0.11+ style)
Client:request(method, params)   -- Send LSP request
Client:supports_method(method)   -- Check capability
Client:stop(force?)              -- Stop client (force = timeout before SIGKILL)
Client:is_stopped()              -- Check if stopped
Client:exec_cmd(command)         -- Execute LSP command

-- Built-in command
:lsp                             -- Interactive LSP management (new in 0.12)
```

### Inlay Hints

Auto-enabled for supporting servers via `LspAttach`:

```lua
vim.api.nvim_create_autocmd("LspAttach", {
  callback = function(event)
    local client = vim.lsp.get_client_by_id(event.data.client_id)
    if client and client:supports_method("textDocument/inlayHint") then
      vim.lsp.inlay_hint.enable(true, { bufnr = event.buf })
    end
  end,
})
```

## Diagnostics

### Configuration

```lua
vim.diagnostic.config({
  underline = false,
  virtual_lines = false,
  virtual_text = { spacing = 0, current_line = true },  -- Show on current line only
  float = { focusable = true, style = "minimal", border = "rounded", source = true },
  severity_sort = true,
  signs = {
    text = {
      [vim.diagnostic.severity.ERROR] = "",
      [vim.diagnostic.severity.WARN] = "",
      [vim.diagnostic.severity.INFO] = "",
      [vim.diagnostic.severity.HINT] = "󰌶",
    },
  },
})
```

### Diagnostic API (0.12)

```lua
vim.diagnostic.jump({ count = 1, severity = ... })   -- Jump (replaces goto_next/prev)
vim.diagnostic.enable(bool)                            -- Toggle diagnostics
vim.diagnostic.is_enabled()                            -- Check state
vim.diagnostic.get(bufnr, opts)                        -- Get diagnostics
vim.diagnostic.open_float()                            -- Float at cursor
vim.diagnostic.status()                                -- Status description (new in 0.12)

-- REMOVED in 0.12:
-- vim.diagnostic.disable()        → use vim.diagnostic.enable(false)
-- vim.diagnostic.is_disabled()    → use not vim.diagnostic.is_enabled()
-- vim.diagnostic.goto_next/prev   → use vim.diagnostic.jump()
```

### Diagnostic Blacklist (config/hack.lua)

Custom filter that removes diagnostics from specific sources/codes (e.g., noisy ESLint rules).

## Completion (blink.cmp)

### Setup

- **Fuzzy engine**: Rust (compiled from source via `cargo build --release`)
- **Branch**: `main` (latest features)
- **No Lua fallback**: Rust-only fuzzy matching

### Sources (priority order)

1. **lazydev** — Neovim Lua API completions
2. **lsp** — Language server completions
3. **path** — File path completions
4. **snippets** — friendly-snippets
5. **buffer** — Buffer word completions

### Key Bindings (insert mode)

| Key | Action |
|-----|--------|
| `<C-space>` | Trigger completion |
| `<C-y>` | Accept completion |
| `<C-n>` / `<C-p>` | Navigate items |
| `<C-b>` / `<C-f>` | Scroll docs |
| `<Tab>` | Snippet: jump forward |
| `<S-Tab>` | Snippet: jump backward |

### Configuration Highlights

```lua
require("blink.cmp").setup({
  keymap = { preset = "default" },
  completion = {
    accept = { auto_brackets = { enabled = true } },
    menu = { border = "rounded", draw = { treesitter = { "lsp" } } },
    documentation = { auto_show = true, auto_show_delay_ms = 200, window = { border = "rounded" } },
  },
  sources = {
    default = { "lazydev", "lsp", "path", "snippets", "buffer" },
    providers = { lazydev = { name = "LazyDev", module = "lazydev.integrations.blink", score_offset = 100 } },
  },
})
```

## Formatting (conform.nvim)

### Format on Save

```lua
vim.api.nvim_create_autocmd("BufWritePre", {
  callback = function(args)
    if vim.g.autoformat and vim.b[args.buf].autoformat ~= false then
      require("conform").format({ bufnr = args.buf, timeout_ms = 3000 })
    end
  end,
})
```

### Formatters by Filetype

| Filetype | Formatter |
|----------|-----------|
| lua | `stylua` |
| javascript, typescript, jsx, tsx | `prettierd` |
| html, css, scss, less | `prettierd` |
| json, jsonc, yaml | `prettierd` |
| markdown, mdx | `prettierd` |
| sh, bash, zsh | `shfmt` |

### Manual Format

`<leader>cf` — Formats with prettierD config selection:
- `shiftwidth == 4` → `~/.config/.prettierrc_tab.json`
- Otherwise → `~/.config/.prettierrc.json`

### Toggles

- `<leader>uf` — Toggle autoformat globally (`vim.g.autoformat`)
- `<leader>uF` — Toggle autoformat for current buffer (`vim.b.autoformat`)

## Linting (nvim-lint)

### Trigger Events

Linting runs on: `BufWritePost`, `InsertLeave`, `BufEnter`

### Linters by Filetype

| Filetype | Linter |
|----------|--------|
| javascript, typescript, jsx, tsx | ESLint (auto-detects config) |

### ESLint Config Detection

`config/util.lua` has `find_eslint_config()` that walks up the directory tree looking for any ESLint config file (`.eslintrc.*`, `eslint.config.*`, etc., defined in `config/constant.lua`).

## Mason (Package Manager)

Mason manages LSP servers, formatters, and linters:

```vim
:Mason              " Open Mason UI
:MasonInstall <pkg> " Install package
```

Mason's bin directory is prepended to `PATH` in `config/lsp.lua`:

```lua
local mason_bin = vim.fn.stdpath("data") .. "/mason/bin"
vim.env.PATH = mason_bin .. ":" .. vim.env.PATH
```

## Troubleshooting LSP

```vim
:lsp                              " Interactive LSP management (0.12)
:checkhealth vim.lsp              " LSP health check
:lua print(vim.inspect(vim.lsp.get_clients()))    " List active clients
:lua print(vim.inspect(vim.diagnostic.get(0)))    " Buffer diagnostics

" Check if server is attached to current buffer
:lua print(vim.inspect(vim.tbl_map(function(c) return c.name end, vim.lsp.get_clients({ bufnr = 0 }))))
```
