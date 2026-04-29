# Formatting and linting

Formatting and linting live outside the LSP protocol for most tools today. Three common frameworks for wiring them in:

| Tool | What it does | When to use |
|---|---|---|
| `conform.nvim` | Format-runner: calls external formatters on save / command | The modern default for formatting |
| `nvim-lint` | Lint-runner: calls linters and surfaces diagnostics | Pairs naturally with conform |
| `none-ls.nvim` (formerly null-ls) | Shims formatters/linters into the LSP protocol | Legacy setups; avoid for new configs |

A separate concern is **installation** — `mason.nvim` + `mason-tool-installer` can install formatters and linters system-independently if the user doesn't want to manage them globally.

## conform.nvim

Pattern: declare `formatters_by_ft`, optionally set `format_on_save`.

```lua
require("conform").setup({
  formatters_by_ft = {
    lua = { "stylua" },
    python = { "ruff_format", "ruff_organize_imports" },
    javascript = { "prettierd", "prettier", stop_after_first = true },
    typescript = { "prettierd", "prettier", stop_after_first = true },
    go = { "goimports", "gofmt" },
    rust = { "rustfmt", lsp_format = "fallback" },
    sh = { "shfmt" },
    ["_"] = { "trim_whitespace" }, -- fallback for any filetype
  },
  format_on_save = function(bufnr)
    -- Disable format-on-save for some filetypes or per-buffer opt-out.
    if vim.b[bufnr].disable_autoformat or vim.g.disable_autoformat then
      return
    end
    return { timeout_ms = 500, lsp_format = "fallback" }
  end,
})
```

**Key options:**
- `stop_after_first = true` — try formatters in order, use the first that exists (good for "prettierd OR prettier").
- `lsp_format = "fallback"` — use LSP formatting when no conform formatter is configured for the filetype.
- `lsp_format = "first" | "last" | "prefer"` — interleave with LSP formatters.

**Toggle commands:** A common UX is a command to disable format-on-save per buffer or globally:

```lua
vim.api.nvim_create_user_command("FormatDisable", function(args)
  if args.bang then vim.b.disable_autoformat = true else vim.g.disable_autoformat = true end
end, { bang = true })
vim.api.nvim_create_user_command("FormatEnable", function()
  vim.b.disable_autoformat = false
  vim.g.disable_autoformat = false
end, {})
```

**Manual format keymap:**

```lua
vim.keymap.set({ "n", "v" }, "<leader>f", function()
  require("conform").format({ async = true, lsp_format = "fallback" })
end, { desc = "Format buffer" })
```

## nvim-lint

Pattern: declare `linters_by_ft`, then call `try_lint()` on the events you care about (usually `BufWritePost`, `BufReadPost`, `InsertLeave`).

```lua
local lint = require("lint")
lint.linters_by_ft = {
  python = { "ruff" },
  javascript = { "eslint_d" },
  typescript = { "eslint_d" },
  sh = { "shellcheck" },
  markdown = { "markdownlint" },
}

vim.api.nvim_create_autocmd({ "BufWritePost", "BufReadPost", "InsertLeave" }, {
  callback = function() require("lint").try_lint() end,
})
```

**Customizing a linter:** Override or extend `lint.linters.<name>` — e.g., add flags, change the parser. See `:h lint-custom-linters`.

## LSP vs. external formatter

Some language servers format (e.g., `gopls`, `rust-analyzer`, `lua_ls`) and some don't. Decide per language:

- **LSP-only**: Set `vim.lsp.buf.format()` on save. Simplest, but limited.
- **External-only**: Use conform; set `server.capabilities.documentFormattingProvider = false` on the LSP to disable its formatter and avoid conflicts.
- **External + LSP fallback**: conform with `lsp_format = "fallback"`. Pragmatic default.

## Organizing imports

Some servers expose this as a code action (e.g., `source.organizeImports`). You can wire it into format-on-save:

```lua
vim.api.nvim_create_autocmd("BufWritePre", {
  callback = function()
    vim.lsp.buf.code_action({
      context = { only = { "source.organizeImports" }, diagnostics = {} },
      apply = true,
    })
  end,
})
```

For Python with ruff, `conform`'s `ruff_organize_imports` formatter handles it and is simpler.

## Common pitfalls

- **Formatter not found**: conform expects the binary on `$PATH`. If the user installed it via Mason, ensure `~/.local/share/nvim/mason/bin` is on `$PATH` — Mason adds it automatically when loaded, but only after Mason is loaded. Load Mason before conform runs, or install the tool globally.
- **Double formatting**: happens when both LSP and conform format on save. Disable one side.
- **`eslint_d` stale daemon**: kill it with `pkill eslint_d` if ESLint results look stuck after upgrading rules.
- **Prettier slow**: switch to `prettierd` — same rules, much faster.
- **Ruff replaces black + isort + flake8**: if the user has all four configured, consolidate.

## none-ls (legacy)

Only touch none-ls if the user already uses it. Modern equivalent:
- `null_ls.builtins.formatting.*` → use conform
- `null_ls.builtins.diagnostics.*` → use nvim-lint
- `null_ls.builtins.code_actions.*` → keep via none-ls, or migrate to a dedicated plugin

Suggest migration only when the user asks; don't rewrite a working none-ls setup unprompted.
