---
name: neovim
description: |
  Expert guidance for working on any user's Neovim configuration — writing Lua
  config, wiring up plugins, configuring LSP servers, setting up completion,
  formatters, linters, treesitter, keymaps, autocmds, and diagnosing startup
  or runtime issues. Covers modern Neovim 0.10+ practices across the major
  plugin managers (vim.pack, lazy.nvim, packer, pckr) and the two LSP paths
  (native `vim.lsp.config` / `vim.lsp.enable` vs. nvim-lspconfig).

  Use whenever the user asks anything Neovim-related: "fix my nvim config",
  "add a new LSP", "why is my completion broken", "migrate from packer to
  lazy", "convert my config to 0.11 native LSP", "add a formatter on save",
  "my treesitter highlights aren't working", "debug slow startup", "how do I
  remap X", "what does this lua snippet do", keybinding tweaks, plugin
  selection, colorscheme issues. Trigger on: neovim, nvim, init.lua, vim.pack,
  lazy.nvim, nvim-lspconfig, blink.cmp, nvim-cmp, conform, nvim-lint, mason,
  treesitter, LSP, keymaps, autocmd, formatter, linter, colorscheme, and any
  file under `~/.config/nvim/` or `~/dotfiles/.config/nvim/`.
---

# Neovim Configuration Assistant

A skill for helping users work on **their own** Neovim configurations. Covers
the patterns, plugin choices, and debugging moves you'll reach for most often
on modern Neovim (0.10+).

This skill is intentionally configuration-agnostic. The user's repo on disk is
the source of truth — read it first, *then* advise. A concrete example config
ships under `example-config/` for cases where you want to see one full working
setup.

---

## How to approach a Neovim task

Neovim configurations are deeply personal and the ecosystem has several
competing "right answers" (lazy.nvim vs. vim.pack, blink.cmp vs. nvim-cmp,
native LSP vs. nvim-lspconfig). Before changing anything:

1. **Locate the config root.** Usually `~/.config/nvim/`, often a symlink into
   a dotfiles repo. Check both. Read `init.lua` (or `init.vim`) first — it
   reveals the load order and which subsystems are in play.

2. **Identify the plugin manager.** This determines how plugins are added and
   whether load order is lazy or eager. Quick signals:
   - `vim.pack.add({...})` → native vim.pack (0.12+)
   - `require("lazy").setup(...)` or a `lazy-lock.json` → lazy.nvim
   - `require("packer").startup(...)` → packer.nvim
   - `require("pckr").add(...)` → pckr.nvim
   - `plug#begin` → vim-plug (rare in Lua-first configs)

3. **Identify the LSP path.** Modern configs split into two camps:
   - **Native** (0.11+): per-server files in `lsp/<name>.lua` returning a
     config table, activated via `vim.lsp.enable({...})` in a central place.
     No nvim-lspconfig dependency.
   - **Classic**: `require("lspconfig").<server>.setup({...})` via
     nvim-lspconfig. Still widespread.
   See `references/lsp.md`.

4. **Read before you write.** Users usually have a reason for their current
   structure. Respect it. If their config uses `safe_require` or some
   bespoke loader, keep using it. If they split plugins across
   `lua/plugins/*.lua`, add new plugins to the same style, not a new style.

5. **Prefer minimal edits.** A three-line change to a working config beats a
   rewrite. Neovim configs accumulate muscle memory; surprise costs the user.

---

## Where to look in a typical config

```
~/.config/nvim/
├── init.lua                 # entry: sets leader, requires submodules
├── lua/
│   ├── config/              # non-plugin: options, keymaps, autocmds, lsp glue
│   └── plugins/             # plugin specs (one file per domain is common)
├── lsp/                     # native LSP config (one file per server) — 0.11+
├── after/                   # late-loaded overrides (runs after plugin loads)
│   ├── ftplugin/            # per-filetype tweaks
│   └── plugin/              # per-plugin late patches
├── snippets/                # user snippets (friendly-snippets-compatible)
└── spell/                   # spell files
```

Not every config has every directory. Absence is signal too: no `lsp/`
usually means classic nvim-lspconfig; no `after/` means no late overrides.

---

## Reference index

Read the file matching the user's task. Don't preload everything.

| If the task is about… | Read |
|---|---|
| Adding/removing plugins, choosing a plugin manager, lazy-loading | `references/plugin-managers.md` |
| Adding or configuring an LSP server, native vs. lspconfig, root_dir | `references/lsp.md` |
| Completion engine setup, sources, keymaps | `references/completion.md` |
| Treesitter parsers, highlight, textobjects, main vs. master | `references/treesitter.md` |
| Formatters on save, linters, conform/nvim-lint/none-ls | `references/formatting-linting.md` |
| Keymaps, `<leader>`, `vim.keymap.set`, `which-key`, autocmds | `references/keymaps-autocmds.md` |
| Statusline, bufferline, notifications, file explorer, picker | `references/ui-stack.md` |
| Options, diagnostics config, colorscheme, filetype | `references/options-diagnostics.md` |
| Startup is slow, a plugin broke, `:checkhealth`, LSP won't attach | `references/debugging.md` |
| Migrating from 0.10 → 0.11 → 0.12, deprecation warnings | `references/migration.md` |
| A full working 0.12+ config to imitate | `example-config/README.md` |

---

## Working style

- **Prefer the user's existing idioms.** If they wrap requires in
  `safe_require`, use it. If they use `vim.keymap.set` with table `desc`,
  match that. Don't introduce `lazy.nvim` patterns into a `vim.pack` config.
- **Small diffs win.** Edit in place; avoid wholesale file rewrites unless
  explicitly asked.
- **Surface the "why".** When you suggest a plugin or option, briefly say why
  (one line). Users keep configs for years; they deserve to know.
- **Check for deprecations before writing 0.12+ APIs.** See
  `references/migration.md`. Common traps: `vim.tbl_islist` →
  `vim.islist`, `vim.validate` signature change,
  `vim.treesitter.query.get` → `get_query`,
  `vim.lsp.buf_get_clients` → `vim.lsp.get_clients`.
- **Don't invent keybindings silently.** If suggesting a mapping, point out
  if it collides with common defaults or the user's existing map.
- **Respect ecosystem splits.** Don't tell a `blink.cmp` user to add an
  `nvim-cmp` source, or an `nvim-lspconfig` user to rewrite against native
  LSP, unless they asked.

---

## Example configuration

The `example-config/` directory is a pointer to a concrete, fully-working
Neovim 0.12+ setup you can refer to when you need to see how a full stack
fits together — plugin manager choice (vim.pack), native LSP with per-server
files, blink.cmp, snacks.nvim, conform + nvim-lint, and dual TypeScript
servers (tsgo + vtsls) with root-directory gating.

Treat it as *one* opinionated example, not the ground truth. When helping a
user, their config is the ground truth.

See `example-config/README.md` for the pointer and highlights.

---

## Quick mental model: what lives where

For fast orientation when dropped into an unfamiliar config:

- **Options** (`vim.opt.*`, `vim.g.*`) — usually in `lua/config/options.lua`.
  Sets tab width, relative numbers, clipboard, etc.
- **Keymaps** (`vim.keymap.set`) — `lua/config/keymaps.lua` or scattered
  inside plugin specs.
- **Autocmds** (`vim.api.nvim_create_autocmd`) — `lua/config/autocmds.lua`.
  Common ones: highlight yank, restore cursor position, trim whitespace.
- **LSP server activation** — either `lua/config/lsp.lua` with
  `vim.lsp.enable(...)`, or inside a plugin spec that sets up
  nvim-lspconfig.
- **Plugin specs** — `lua/plugins/*.lua` (lazy.nvim convention) or one big
  `lua/plugins/init.lua` (vim.pack convention).
- **Per-server LSP configs** — `lsp/<name>.lua` for native, or inline
  `lspconfig[name].setup{}` for classic.
- **Filetype overrides** — `after/ftplugin/<ft>.lua`.

---

## When the user asks "is my config good?"

Resist the urge to rewrite. Instead:

1. Run (or ask them to run) `:checkhealth` and `:Lazy profile` /
   `nvim --startuptime /tmp/nvim.log` to get data.
2. Read `references/debugging.md` for what a healthy startup looks like.
3. Point out concrete wins (a deprecated API here, a missing `desc =` on a
   keymap there) rather than style preferences.
