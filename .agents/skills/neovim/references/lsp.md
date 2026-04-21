# LSP Reference

## Architecture

Neovim 0.12+ native LSP — no nvim-lspconfig plugin.

- Server configs: `lsp/<server>.lua` (each returns a config table)
- Activation: `vim.lsp.config()` + `vim.lsp.enable()` in `config/lsp.lua`

### Enabled Servers

```lua
vim.lsp.enable({
  "lua_ls", "tsgo", "vtsls", "html", "cssls", "css_variables",
  "cssmodules_ls", "emmet_language_server", "tailwindcss", "taplo",
  "solc", "protols", "docker_language_server", "jsonls", "yamlls", "vue_ls",
})
```

Not present: bashls, gopls, rust_analyzer, denols, eslint.

### Global LSP Config (config/lsp.lua)

- Capabilities: `workspace.fileOperations` (didRename, willRename)
- `on_attach`: disables `semanticTokensProvider` for all servers
- Log level: `vim.lsp.log.set_level(OFF)`

---

## Shared Utilities: config/ts_util.lua

Path is `config/ts_util.lua` (NOT `lua/util/ts_util.lua`).

### Functions

| Function | Purpose |
|---|---|
| `bun_cmd(mason_pkg, js_entry, extra_args)` | Builds bun-optimized cmd array for Mason JS-based servers; caches results |
| `mason_tsdk()` | Resolves TypeScript SDK from Mason vtsls bundle at `.../mason/packages/vtsls/node_modules/@vtsls/language-server/node_modules/typescript/lib` |
| `find_project_root(bufnr)` | Two-phase root detection: tsconfig/jsconfig first, then package.json/.git |
| `is_vue_project(root)` | Checks vue config markers, package.json deps, `.vue` files in `src/` (subdirectory scan, 50 subdir limit) |
| `is_deno_project(root)` | Checks `deno.json`/`deno.jsonc` via `vim.fs.root()`; excludes hybrid projects with npm lock files |
| `needs_baseurl_fallback(root)` | Parses tsconfig/jsconfig + extends chains for non-trivial `baseUrl` (not `"."` or `"./"`) |
| `_find_baseurl_in_config(config_path, depth)` | Recursive JSONC parser with `strip_jsonc_comments` |
| `find_file_references()` | Ripgrep-based import/require finder; uses `Snacks.picker.grep` or qflist fallback |

---

## TypeScript / JavaScript Servers

### tsgo (lsp/tsgo.lua)

Primary TS/JS server using the Go-based `tsgo` binary.

- **cmd:** `tsgo --lsp --stdio`
- **filetypes:** javascript, javascriptreact, javascript.jsx, typescript, typescriptreact, typescript.tsx
- **root_dir:** Skips Deno, Vue, and baseUrl projects (async callback style)
- **on_new_config:** Prefers project-local `node_modules/.bin/tsgo` when available
- **on_attach:** Monkey-patches `client.request` to intercept `textDocument/codeLens`. Pre-resolves references/implementations counts via `textDocument/references` and `textDocument/implementation`. Drops 0-count lenses. Uses `editor.action.showReferences` command.
- **Settings** (under `typescript`):
  - `referencesCodeLens`, `implementationsCodeLens`
  - `inlayHints`: enumMemberValues, functionLikeReturnTypes, parameterNames=`"literals"`, parameterTypes, propertyDeclarationTypes, variableTypes=`false`
  - `suggest.completeFunctionCalls`
  - `preferences.importModuleSpecifier` = `"shortest"`
  - `preferTypeOnlyAutoImports`

### vtsls (lsp/vtsls.lua)

Fallback TS/JS server for Vue and baseUrl projects.

- **cmd:** `ts_util.bun_cmd("vtsls", "node_modules/@vtsls/language-server/bin/vtsls.js", {"--stdio"})`
- **filetypes:** same as tsgo + mdx, vue
- **root_dir:** Skips Deno; ONLY starts for Vue or baseUrl projects
- **get_language_id:** mdx → `typescriptreact`
- **on_attach:** Disables diagnostics for mdx buffers; registers `_typescript.moveToFileRefactoring` command handler
- **maxTsServerMemory:** `1024 * 8` (8 GB)
- **Settings:**
  - `complete_function_calls` = true
  - `vtsls.autoUseWorkspaceTsdk` = true
  - `enableMoveToFileCodeAction` = true
  - Vue plugin sourced from Mason
  - Experimental: `maxInlayHintLength` = 30, `serverSideFuzzyMatch`, `enableProjectDiagnostics` = false

### Server Selection Logic

| Project type | tsgo | vtsls |
|---|---|---|
| Plain TS/JS | Yes | No |
| Vue project | No | Yes |
| baseUrl project | No | Yes |
| Deno project | No | No |

---

## Vue

### vue_ls (lsp/vue_ls.lua)

- **cmd:** `vue-language-server --stdio`
- **filetypes:** vue
- **root_markers:** vue.config.js, vue.config.ts, nuxt.config.js, nuxt.config.ts, package.json
- **on_attach:** Disables overlapping capabilities — definitionProvider, referencesProvider, implementationProvider, typeDefinitionProvider, renameProvider
- **init_options:** `typescript.tsdk` from `mason_tsdk()`

---

## Web / CSS Servers

### html (lsp/html.lua)

- **cmd:** `vscode-html-language-server --stdio`
- **filetypes:** html, templ

### cssls (lsp/cssls.lua)

- **cmd:** `vscode-css-language-server --stdio`
- **filetypes:** css, scss, less

### css_variables (lsp/css_variables.lua)

- **cmd:** `css-variables-language-server --stdio`
- **filetypes:** css, scss

### cssmodules_ls (lsp/cssmodules_ls.lua)

- **cmd:** via `bun_cmd`
- **filetypes:** javascript, javascriptreact, typescript, typescriptreact

### emmet_language_server (lsp/emmet_language_server.lua)

- **cmd:** via `bun_cmd`
- **filetypes:** html, css, scss, less, javascriptreact, typescriptreact, svelte, vue

### tailwindcss (lsp/tailwindcss.lua)

- **cmd:** via `bun_cmd`
- **filetypes:** web languages
- **root_markers:** tailwind config files
- **on_attach:** Stops server if no tailwind config found in project

---

## Data Format Servers

### jsonls (lsp/jsonls.lua)

- **cmd:** `vscode-json-language-server --stdio`
- **filetypes:** json, jsonc
- **SchemaStore:** Yes — `util.schemastore("json")`

### yamlls (lsp/yamlls.lua)

- **cmd:** `yaml-language-server --stdio`
- **filetypes:** yaml, yaml.docker-compose
- **SchemaStore:** Yes — `util.schemastore("yaml")`
- **Settings:** `keyOrdering` = false

### taplo (lsp/taplo.lua)

- **cmd:** `taplo lsp stdio`
- **filetypes:** toml
- **Settings:** `validate` = true
- **SchemaStore:** No

---

## Other Servers

### lua_ls (lsp/lua_ls.lua)

- **cmd:** `lua-language-server`
- **filetypes:** lua
- **Settings:**
  - `workspace.checkThirdParty` = false
  - `codeLens.enable` = true
  - Hint settings enabled
  - `diagnostics.globals`: vim, require, Snacks

### solc (lsp/solc.lua)

- **cmd:** `solc --lsp`
- **filetypes:** solidity
- **root_markers:** hardhat, foundry, truffle config files

### protols (lsp/protols.lua)

- **cmd:** `protols`
- **filetypes:** proto

### docker_language_server (lsp/docker_language_server.lua)

- **cmd:** `docker-langserver --stdio`
- **filetypes:** dockerfile
