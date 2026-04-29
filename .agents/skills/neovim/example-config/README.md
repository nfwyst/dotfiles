# Example configuration: a real-world opinionated setup

This skill is deliberately generic, but abstract principles are easier to apply when you've seen at least one concrete instance. A real Neovim configuration you can treat as a concrete example lives at:

```
~/dotfiles/.config/nvim/
```

It is **not** the only valid structure, nor a template to replicate. Think of it as a data point. When a user says "help me organize my config" or "is my setup reasonable", browse theirs first, then look at this example for a second opinion.

## What this example demonstrates

A Neovim 0.12+ configuration targeting a user who:
- Wants a modern, near-bleeding-edge stack.
- Prefers native Neovim features over large abstraction layers.
- Accepts some assembly in exchange for a config they fully understand.

### Concrete choices it makes

| Concern | Choice | Rationale (as hinted by the config) |
|---|---|---|
| Plugin manager | `vim.pack` (native 0.12+) | No external dependency; `vim.pack.add({...})` in `lua/plugins/init.lua` |
| Resilience | `safe_require` wrapper in `init.lua` | One broken module doesn't block the rest |
| Fail-fast git | `GIT_HTTP_LOW_SPEED_LIMIT/TIME` env | Avoid 75s hangs on unreachable remotes during plugin ops |
| LSP | Native `vim.lsp.config` + `lsp/<server>.lua` files | No nvim-lspconfig dependency |
| LSP organization | One file per server under `lsp/` | Discoverable via runtimepath autodiscovery |
| TypeScript | Dual servers (`tsgo.lua` + `vtsls.lua`) with root_dir gating | Try fast native tsgo, fall back to vtsls |
| Completion | `blink.cmp` + `blink.lib` + `friendly-snippets` | Rust-backed fuzzy; zero Node dependency |
| Treesitter | `nvim-treesitter` main branch | Future-proof; new architecture |
| UI | snacks.nvim, noice.nvim, which-key.nvim, lualine | Modern opinionated stack |
| Colorschemes | Tokyonight + Monokai Pro + NeoSolarized | Multiple to rotate between |

### Directory layout

```
~/dotfiles/.config/nvim/
├── init.lua                    # Entry; sets leaders, safe_require chain
├── lsp/                        # One file per server (native LSP path)
│   ├── lua_ls.lua
│   ├── tsgo.lua
│   ├── vtsls.lua
│   └── ...
├── lua/
│   ├── config/
│   │   ├── options.lua         # vim.opt.* settings
│   │   ├── keymaps.lua         # vim.keymap.set(...)
│   │   ├── autocmds.lua        # nvim_create_autocmd groups
│   │   ├── lsp.lua             # shared on_attach, capabilities, enable list
│   │   ├── hack.lua            # environment-specific patches
│   │   └── util.lua, ts_util.lua, ...
│   ├── plugins/
│   │   ├── init.lua            # vim.pack.add({...}) master list
│   │   ├── coding.lua          # blink.cmp, treesitter, conform, ...
│   │   ├── editor.lua          # gitsigns, which-key, ...
│   │   ├── tools.lua           # terminal, pickers, ...
│   │   ├── ui.lua              # lualine, noice, snacks, ...
│   │   └── colorscheme.lua
│   └── health_override/        # Custom :checkhealth entries
├── after/
│   ├── plugin/                 # Loaded after runtime plugins
│   └── queries/markdown/       # Treesitter query extensions
├── snippets/                   # User-defined snippets
├── stylua.toml                 # Lua formatter config
└── nvim-pack-lock.json         # vim.pack's lockfile
```

## How to use this example when helping a user

1. **Don't assume a user's config looks like this.** Most don't. Different users pick lazy.nvim, Lua-organized-by-feature vs. by-plugin, nvim-cmp instead of blink, etc.
2. **Do use it to ground abstract advice.** When a reference file says "look for `vim.pack.add` or `lazy.setup` in the plugin entrypoint", this config has `vim.pack.add` in `lua/plugins/init.lua` — a concrete file you can look at.
3. **Copy idioms, not structure.** The `safe_require` wrapper in `init.lua`, the `GIT_HTTP_LOW_SPEED_LIMIT` env trick, the `root_dir`-gated dual-TypeScript setup, the `lsp/<server>.lua` per-server split — these are idioms worth adapting. The overall folder layout is just one valid shape.
4. **Defer to the user's config.** When they say "add X", follow their existing conventions — even if this example would do it differently.

## When this example is genuinely useful

- User asks for a `vim.pack`-based starter → point them at `init.lua` + `lua/plugins/init.lua`.
- User wants to migrate from nvim-lspconfig to native LSP → `lsp/*.lua` + `lua/config/lsp.lua` is a working reference.
- User asks how to run two LSP servers for one language without conflicts → `lsp/tsgo.lua` + `lsp/vtsls.lua` use `root_dir` callbacks for mutual exclusion.
- User wants treesitter main branch → `lua/plugins/init.lua` shows the `version = "main"` spec syntax.

## When to ignore this example

- User already has a working config — don't impose this layout.
- User wants lazy.nvim — this example uses vim.pack; reach for `references/plugin-managers.md` instead.
- User wants a minimal starter — this config is feature-rich; minimal starters look very different (see `kickstart.nvim` or `mini.nvim` base setups).

## One last thing

The example exists for **you**, the assistant, to form concrete intuitions. The user you're helping may never have seen it. Translate insights from this config into generic recommendations that fit their world, not reproductions of this world.
