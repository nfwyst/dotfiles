# Neovim Tools Reference

## Mason ensure_installed

Actual list of tools installed via Mason:

### Language Servers
- lua-language-server
- vtsls
- tsgo
- html-lsp
- css-lsp
- css-variables-language-server
- emmet-language-server
- tailwindcss-language-server
- json-lsp
- yaml-language-server
- vue-language-server
- taplo (TOML)

### CLI / Build Tools
- ast-grep
- tectonic (LaTeX)
- tree-sitter-cli
- uv (Python)

### Linters
- eslint_d
- vale

### Formatters
- beautysh
- prettierd
- kulala-fmt
- mmdc (Mermaid)
- nginx-config-formatter
- sqruff

### NOT installed (do not suggest these)
- bash-language-server
- deno
- eslint-lsp
- gopls
- rust-analyzer
- prettier (prettierd is used instead)
- goimports
- gofumpt
- shfmt (installed externally, not via Mason)
- isort
- black
- flake8
- golangci-lint

## Conform Formatters

Formatter assignments by filetype:

| Filetype | Formatters |
|----------|-----------|
| javascript, typescript, javascriptreact, typescriptreact, svelte | prettierd (or eslint_d in fix mode) |
| css, scss, less, html, json, jsonc, yaml, graphql | prettierd |
| markdown | prettierd, markdownlint-cli2, markdown-toc |
| mdx | prettierd (or eslint_d in fix mode) |
| lua | stylua |
| sh | shfmt |
| zsh | beautysh (with dynamic shiftwidth detection) |
| toml | taplo |
| http | kulala-fmt |
| nginx | nginxfmt |
| sql | sqruff |
| _ (fallback) | trim_whitespace |

### Format on Save
- **Enabled** by default (controlled by `util.autoformat_enabled`)
- Timeout: 3000ms
- `lsp_format = "fallback"` — uses LSP formatting if no conform formatter matches

### Format after Save
- Runs `retab` to convert tabs to spaces after each save

## nvim-lint Linters

| Filetype | Linter |
|----------|--------|
| javascript, typescript, javascriptreact, typescriptreact, svelte | eslint_d |
| sh | bash |
| zsh | zsh |
| markdown | vale |

### NOT configured (do not suggest these)
- golangci-lint
- flake8

## External Tool Dependencies

Tools expected to be available on the system PATH (not managed by Mason):

- **ripgrep** (`rg`) — used by pickers and grep
- **fd** — file finder
- **git** — version control
- **lazygit** — terminal UI for git (used via snacks.lazygit)
- **bun** — used to run LSP servers via `ts_util.bun_cmd()`
- **node** — Node.js runtime
- **fzf** — fuzzy finder
- **curl** — HTTP client
- **fortune** — optional, used for dashboard quotes
