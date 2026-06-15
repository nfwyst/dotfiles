# Treesitter

nvim-treesitter is undergoing a major rewrite. As of 2025 the **main**
branch (v1.0-in-progress) and the legacy **master** branch coexist. Pin the
branch deliberately.

## main vs. master

| | master | main |
|---|---|---|
| API | `require("nvim-treesitter.configs").setup{...}` | Direct `vim.treesitter.start()` + per-feature calls |
| Installed parsers | bundled list, `ensure_installed` | Separate parser registry, `:TSInstall` |
| Highlight autostart | via `setup{ highlight = { enable = true } }` | via a `FileType` autocmd calling `vim.treesitter.start()` |
| Textobjects | plugin built-in | external `nvim-treesitter-textobjects` (main branch too) |
| Stability | rock solid, frozen | active development, some churn |

If the user's `plugins/init.lua` pins `version = "main"`, they're on main.
Otherwise master.

### master-branch setup (classic)

```lua
require("nvim-treesitter.configs").setup({
  ensure_installed = { "lua", "vim", "vimdoc", "bash", "python", "typescript", "tsx" },
  highlight = { enable = true },
  indent = { enable = true },
  incremental_selection = { enable = true },
})
```

### main-branch setup

```lua
-- install parsers
require("nvim-treesitter").install({
  "lua", "vim", "vimdoc", "bash", "python", "typescript", "tsx",
})

-- start highlight per-filetype (there's no global auto-enable)
vim.api.nvim_create_autocmd("FileType", {
  callback = function(args)
    local buf = args.buf
    local ft = vim.bo[buf].filetype
    if vim.tbl_contains({ "TelescopePrompt", "help" }, ft) then return end
    pcall(vim.treesitter.start, buf)
  end,
})
```

Main branch doesn't auto-start highlight; that's intentional. Users pick
their own filetype gate.

---

## Parser installation

- `:TSInstall <lang>` — install a parser.
- `:TSUpdate` — update all.
- `:TSInstallInfo` — list.

Parsers are compiled C libraries; requires `cc` (or `clang`) on `$PATH`. On
macOS, Xcode CLT covers it. On Linux, build-essential.

---

## Language registrations

If a filetype should use another language's parser:

```lua
vim.treesitter.language.register("bash", "zsh")
vim.treesitter.language.register("markdown", { "mdx", "checkhealth" })
```

Common real-world pairings:
- `zsh` → `bash`
- `mdx` → `markdown`
- `checkhealth` → `markdown`

---

## Textobjects (textobjects plugin)

Separate plugin: `nvim-treesitter/nvim-treesitter-textobjects`.

```lua
require("nvim-treesitter.configs").setup({        -- master branch
  textobjects = {
    select = {
      enable = true,
      keymaps = {
        ["af"] = "@function.outer",
        ["if"] = "@function.inner",
        ["ac"] = "@class.outer",
        ["ic"] = "@class.inner",
      },
    },
  },
})
```

On main branch, the textobjects module registers its own keymaps via its
own setup call.

---

## Folding via treesitter

```lua
vim.opt.foldmethod = "expr"
vim.opt.foldexpr   = "v:lua.vim.treesitter.foldexpr()"
vim.opt.foldlevel  = 99   -- don't auto-fold on open
```

If folds look weird, the parser probably doesn't provide folds queries; fall
back to `indent` or `manual`.

---

## Queries and overrides

Custom queries live under `queries/<lang>/<query>.scm` in your runtimepath.
They extend (not replace) the bundled queries. E.g. to add a highlight:

```scheme
; queries/typescript/highlights.scm
; extends
((identifier) @constant
 (#match? @constant "^[A-Z][A-Z0-9_]*$"))
```

The `; extends` comment on line 1 is required for additive behavior.

---

## Common treesitter issues

**"Highlight disappeared in file X"** — parser missing. `:InspectTree` in the
buffer; if it errors, `:TSInstall <lang>`.

**"Query error at line N"** — a parser update changed the grammar. Update the
parser (`:TSUpdate <lang>`) or remove your custom query file.

**"Can't compile parser on Apple Silicon"** — verify Xcode CLT
(`xcode-select --install`) and `/opt/homebrew/bin` in `$PATH` for LLVM's
`cc`.

**"Which branch am I on?"** — `:Lazy show nvim-treesitter` or check the
plugin-spec file; if no `version`, it's master by default.
