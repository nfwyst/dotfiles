# LSP Reference

Complete LSP stack documentation for Neovim 0.12+ native configuration.

## Architecture

```
lsp/*.lua             → Server-specific configs (auto-discovered by vim.lsp.config)
lua/config/lsp.lua    → Mason PATH, diagnostics, global settings, vim.lsp.enable()
lua/config/hack.lua   → Diagnostic blacklist (vim.diagnostic.set override)
lua/plugins/tools.lua → Mason setup, conform (formatting), nvim-lint (linting)
lua/plugins/coding.lua → blink.cmp (completion), lazydev (Lua dev)
```

## Enabled Servers

| Server | Filetypes | Binary | Notes |
|---|---|---|---|
| `lua_ls` | lua | lua-language-server | Workspace checkThirdParty=false, callSnippet=Replace |
| `vtsls` | js/ts/jsx/tsx/mdx/vue | bun run vtsls | 32GB memory limit, @vue/typescript-plugin for Hybrid Mode |
| `vue_ls` | vue | vue-language-server | Volar, resolves tsdk from Mason vtsls bundle |
| `html` | html, templ | vscode-html-language-server | |
| `cssls` | css, scss, less | vscode-css-language-server | |
| `css_variables` | css, scss | css-variables-language-server | |
| `cssmodules_ls` | js/ts/jsx/tsx | bun run cssmodules-language-server | |
| `emmet_language_server` | html/css/scss/less/jsx/tsx/svelte/vue | bun run emmet-language-server | |
| `tailwindcss` | html/css/scss/js/ts/jsx/tsx/svelte/vue | bun run tailwindcss-language-server | Auto-stops if no tailwind config found |
| `taplo` | toml | taplo | SchemaStore integration |
| `jsonls` | json, jsonc | vscode-json-language-server | SchemaStore integration |
| `yamlls` | yaml, yaml.docker-compose | yaml-language-server | SchemaStore, keyOrdering=false |
| `solc` | solidity | solc | Root: hardhat.config/foundry.toml |
| `protols` | proto | protols | |
| `docker_language_server` | dockerfile | docker-langserver | |

## Vue Hybrid Mode

Two servers cooperate for Vue files:

1. **vue_ls** (Volar) — handles `<template>` semantics and `<style>` CSS intellisense
2. **vtsls** with `@vue/typescript-plugin` — handles `<script>` TypeScript in `.vue` files

### Configuration Details

**vtsls** includes `"vue"` in its filetypes and loads the Vue plugin:

```lua
tsserver = {
  globalPlugins = {
    {
      name = "@vue/typescript-plugin",
      location = vim.fn.stdpath("data") .. "/mason/packages/vue-language-server/node_modules/@vue/language-server",
      languages = { "vue" },
      configNamespace = "typescript",
      enableForWorkspaceTypeScriptVersions = true,
    },
  },
},
```

**vue_ls** resolves tsdk from Mason's vtsls bundle:

```lua
init_options = {
  typescript = {
    tsdk = vim.fn.stdpath("data") .. "/mason/packages/vtsls/node_modules/@vtsls/language-server/node_modules/typescript/lib",
  },
},
```

## vtsls Special Features

### MDX Support

- MDX files get `get_language_id = "typescriptreact"` so tsserver provides completions
- Diagnostics are disabled for MDX buffers (false positives from TS treating prose as code)

### Bun Integration

```lua
typescript = {
  npm = bun_path,           -- Use bun for npm resolution
  tsserver = { nodePath = bun_path },  -- Use bun as Node runtime
},
```

## Global LSP Settings

Applied to all servers via `vim.lsp.config("*", ...)`:

```lua
capabilities = {
  workspace = {
    fileOperations = { didRename = true, willRename = true },
  },
},
on_attach = function(client)
  client.server_capabilities.semanticTokensProvider = nil  -- Disable semantic tokens
end,
```

- **Log level**: OFF (`vim.lsp.log.set_level(vim.log.levels.OFF)`)
- **Inlay hints**: Auto-enabled via `LspAttach` for servers supporting `textDocument/inlayHint`

## Diagnostics

### Configuration

```lua
vim.diagnostic.config({
  underline = false,
  virtual_lines = false,
  virtual_text = { spacing = 0, current_line = true },
  float = { focusable = true, style = "minimal", border = "rounded", source = true },
  severity_sort = true,
  signs = {
    text = { [ERROR] = "", [WARN] = "", [INFO] = "", [HINT] = "󰌶" },
  },
})
```

### Blacklist (hack.lua)

Intercepts `vim.diagnostic.set` to filter noisy diagnostics before display:

| Source | Filter Type | Pattern/Codes |
|---|---|---|
| eslint_d | message | `path::String` |
| eslint_d | message | `projectService` |
| ts | message | `File is a CommonJS module` |
| ts | codes | 7016, 80001, 80006, 80007, 2305, 6387, 7044, 1149 |

## Completion (blink.cmp)

### Sources

| Source | Priority | Min Keyword | Notes |
|---|---|---|---|
| LSP | default | default | Primary |
| path | default | default | Show hidden files, trailing slash |
| snippets | default | 1 | Custom snippets from `~/.config/nvim/snippets/` |
| buffer | default | 2 | |
| lazydev | 100 (Lua only) | default | `lazydev.integrations.blink` module |

### Snippet Extensions

MDX files inherit snippets from: javascript, javascriptreact, typescript, typescriptreact, html.

### Fuzzy Matching

- Implementation: Rust (`blink.cmp.fuzzy.rust`)
- Built from source via `cargo build --release` (PackChanged hook)
- `download = false`, `ignore_version_mismatch = true`

### Cmdline

- Auto-show for `:` commands
- Ghost text for `/` and `?` search
- Position integrates with Noice via `vim.g.ui_cmdline_pos`
- Preset: `cmdline` with `<c-l>` show, `<c-e>` cancel

### Menu

- Direction priority: north, south
- Treesitter highlighting for LSP items
- Columns: label + description | kind icon + kind | source name
- Rounded border, no scrollbar

## Formatting (conform.nvim)

### Formatter Selection Logic

| Mode | Triggered By | Formatters |
|---|---|---|
| Format (default) | `<leader>cf`, auto-save | prettierd |
| Fix | `<leader>ci` | eslint_d |
| Injected | `<leader>cF` | injected languages |

### Prettierrc Selection

Based on current buffer's `shiftwidth`:
- `shiftwidth == 4` → `~/.config/.prettierrc_tab.json`
- Otherwise → `~/.config/.prettierrc.json`

### Formatters by Filetype

| Filetype | Formatters |
|---|---|
| JS/TS/JSX/TSX/Svelte | prettierd (format) or eslint_d (fix) |
| CSS/SCSS/Less/HTML/JSON/JSONC/YAML/GraphQL | prettierd |
| Markdown | prettierd + markdownlint-cli2 + markdown-toc |
| MDX | prettierd or eslint_d |
| Lua | stylua |
| Shell | shfmt |
| Zsh | beautysh (indent based on shiftwidth) |
| TOML | taplo |
| HTTP | kulala-fmt |
| Nginx | nginxfmt |
| SQL | sqruff |
| Nu | (none — explicitly empty) |
| Other | trim_whitespace |

### Post-Save Hook

After formatting, runs `retab` to convert tabs to spaces.

## Linting (nvim-lint)

### Configuration

- `ESLINT_D_PPID` set to Neovim PID (lifecycle management)
- eslint_d `--config` argument uses `util.get_file_path()` to auto-detect config
- Config search walks up directory tree, checks `package.json` for `eslintConfig` field

### Linters by Filetype

| Filetype | Linters |
|---|---|
| JS/TS/JSX/TSX/Svelte | eslint_d |
| Shell | bash |
| Zsh | zsh |
| Markdown | vale |

### Lint Events

`BufWritePost`, `BufReadPost`, `InsertLeave`

## Mason

### Standalone Setup (No Bridge)

Mason only installs binaries. No mason-lspconfig or mason-nvim-lint bridge.

- PATH prepended manually in `config/lsp.lua`
- Auto-install via deferred `mason-registry` refresh (100ms)
- UI: rounded border, 0.7 height

### ensure_installed

```
lua-language-server, vtsls, html-lsp, css-lsp, css-variables-language-server,
emmet-language-server, tailwindcss-language-server, taplo, ast-grep, tectonic,
tree-sitter-cli, eslint_d, beautysh, prettierd, vale, kulala-fmt, mmdc,
nginx-config-formatter, uv, sqruff, json-lsp, yaml-language-server,
vue-language-server
```

## SchemaStore Integration

Three servers use `SchemaStore.nvim` for schema validation:

| Server | Schemas |
|---|---|
| jsonls | `require("schemastore").json.schemas()` |
| yamlls | `require("schemastore").yaml.schemas()` |
| taplo | `require("schemastore").json.schemas()` (TOML) |

All wrapped in `pcall` for resilience.

## Tailwind Auto-Stop

Tailwindcss LSP has custom `on_attach` that stops the client if no tailwind config file is found in the buffer's root:

```lua
on_attach = function(client, bufnr)
  local config_root = vim.fs.root(bufnr, config_files)
  if not config_root then client:stop() end
end,
```

Config files checked: `tailwind.config.{js,ts,cjs,mjs}`
