# Tools Reference

Built-in commands, CLI tools, and debug utilities.

## User Commands

| Command | Source | Action |
|---|---|---|
| `:PlugSync` | plugins/init.lua | Clean inactive plugins + update all |
| `:AddQuotes` | config/keymaps.lua | Convert selected lines to JSON snippet format (visual mode) |
| `:Tsw rt=bun show_order=true` | ts-worksheet | Run current JS/TS file with bun, show execution order |
| `:Mason` | mason.nvim | Open Mason UI (install/update LSP servers and tools) |
| `:Leet` | leetcode.nvim | Open LeetCode menu |

## Neovim Built-in Commands

| Command | Action |
|---|---|
| `:checkhealth vim.lsp` | LSP server status and diagnostics |
| `:checkhealth` | Full health check |
| `:lsp` | Quick LSP info |
| `:Inspect` | Show highlight groups under cursor |
| `:InspectTree` | Show treesitter tree |

## Debug Tools

### LSP Debugging

```vim
" Check active LSP clients for current buffer
:lua vim.print(vim.lsp.get_clients({ bufnr = 0 }))

" Check LSP capabilities
:lua vim.print(vim.lsp.get_clients()[1].server_capabilities)

" Enable LSP logging (disabled by default)
:lua vim.lsp.log.set_level(vim.log.levels.DEBUG)
" Log location: ~/.local/state/nvim/lsp.log

" Check if server supports a method
:lua vim.print(vim.lsp.get_clients()[1]:supports_method("textDocument/inlayHint"))

" Force-restart all LSP clients
:lua for _, client in pairs(vim.lsp.get_clients()) do client:stop() end
" Then reopen the file
```

### Treesitter Debugging

```vim
" Check if treesitter is active
:lua vim.print(vim.b.ts_highlight)

" Check available parsers
:lua vim.print(vim.treesitter.language.get_lang(vim.bo.filetype))

" Check highlight queries
:lua vim.print(vim.treesitter.query.get("typescript", "highlights"))

" Inspect tree
:InspectTree
" or
:lua vim.treesitter.inspect_tree()

" Force-restart treesitter
:lua vim.treesitter.stop() vim.treesitter.start()
```

### Diagnostic Debugging

```vim
" List all diagnostics for current buffer
:lua vim.print(vim.diagnostic.get(0))

" Check diagnostic namespaces
:lua vim.print(vim.diagnostic.get_namespaces())

" Check if diagnostics are enabled
:lua vim.print(vim.diagnostic.is_enabled({ bufnr = 0 }))
```

### Plugin Debugging

```vim
" List all managed plugins
:lua vim.print(vim.pack.get())

" Check if a plugin is loaded
:lua vim.print(vim.pack.get("snacks.nvim"))

" Check plugin install location
" ~/.local/share/nvim/site/pack/core/opt/

" Force-update a specific plugin
:lua vim.pack.update("snacks.nvim")
```

### Completion Debugging (blink.cmp)

```vim
" Check if Rust module is loaded
:lua vim.print(pcall(require, "blink.cmp.fuzzy.rust"))

" Check completion sources
:lua vim.print(require("blink.cmp.config").get().sources)
```

### Formatter Debugging

```vim
" Check which formatters would run
:lua vim.print(require("conform").list_formatters())

" Check formatter config
:lua vim.print(require("conform").get_formatter_info("prettierd"))

" Manual format with logging
:lua require("conform").format({ timeout_ms = 3000, lsp_fallback = true })

" Check autoformat state
:lua vim.print(vim.g.autoformat, vim.b.autoformat)
```

### Linter Debugging

```vim
" Check which linters are configured
:lua vim.print(require("lint").linters_by_ft)

" Manually trigger lint
:lua require("lint").try_lint()

" Check eslint_d status
:!eslint_d --status
```

## External CLI Tools

Tools installed via Mason and used by this configuration:

| Tool | Purpose | Used By |
|---|---|---|
| `eslint_d` | Fast ESLint daemon | nvim-lint, conform (fix mode) |
| `prettierd` | Fast Prettier daemon | conform |
| `stylua` | Lua formatter | conform |
| `shfmt` | Shell formatter | conform |
| `beautysh` | Zsh/Bash formatter | conform |
| `taplo` | TOML formatter + LSP | conform, lsp |
| `vale` | Prose linter | nvim-lint |
| `kulala-fmt` | HTTP file formatter | conform |
| `nginxfmt` | Nginx config formatter | conform |
| `sqruff` | SQL formatter | conform |
| `ast-grep` | Structural search/replace | Manual use |
| `tectonic` | LaTeX engine | render-markdown |
| `tree-sitter-cli` | Parser management | TSInstall |
| `mmdc` | Mermaid diagram renderer | Manual use |
| `uv` | Python package manager | uv.nvim |

## File Paths

| Path | Content |
|---|---|
| `~/.config/nvim/` | Configuration root |
| `~/.local/share/nvim/site/pack/core/opt/` | vim.pack plugins |
| `~/.local/share/nvim/mason/` | Mason root |
| `~/.local/share/nvim/mason/bin/` | Mason-installed binaries |
| `~/.local/state/nvim/lsp.log` | LSP log (when enabled) |
| `~/.local/share/nvim/snacks/todo/todo.md` | Global todo file |
| `~/.config/.prettierrc.json` | Prettier config (2-space) |
| `~/.config/.prettierrc_tab.json` | Prettier config (4-space/tab) |

## Startup Profiling

```bash
# Startup time report
nvim --startuptime /tmp/nvim-startup.log
cat /tmp/nvim-startup.log | sort -k 2 -n -r | head -20

# Profile specific module
nvim --cmd "profile start /tmp/profile.log" --cmd "profile func *" -c "qa"
```

## Environment Variables

| Variable | Purpose | Used In |
|---|---|---|
| `TERMINAL` | Ghostty detection | plugins/init.lua |
| `TMUX` | tmux detection (termsync disable) | config/options.lua |
| `SSH_TTY` | SSH detection (clipboard disable) | config/options.lua |
| `ESLINT_D_PPID` | eslint_d lifecycle management | plugins/tools.lua |
| `PRETTIERD_DEFAULT_CONFIG` | Prettier config path override | config/keymaps.lua |
| `DEEPSEEK_API_KEY` | DeepSeek API key | plugins/tools.lua |
