# Neovim Troubleshooting Reference

## vtsls Memory Limit

vtsls is configured with a memory limit of `1024 * 8` (8GB). If vtsls crashes or becomes unresponsive on large projects, check memory usage. The setting is applied via the `--max-old-space-size` Node.js flag in the LSP configuration.

## Diagnostic Blacklist (hack.lua)

The file `hack.lua` monkey-patches `vim.diagnostic.set` to filter out noisy or unhelpful diagnostics by code. The following diagnostic codes are suppressed:

- **7016** — Could not find a declaration file for module
- **80001** — File is a CommonJS module; it may be converted to an ES module
- **80006** — This may be converted to an async function
- **80007** — Prefer 'as const' over literal type
- **7044** — Parameter implicitly has an 'any' type (in some contexts)
- **1149** — Related to import declaration issues

This is a global filter applied to all diagnostic producers, not per-LSP.

## blink.cmp Build Issues

blink.cmp uses a Rust fuzzy matching implementation and must be built from source:

- `prebuilt_binaries.download = false` — no prebuilt binaries are used
- After cloning or updating, `cargo build --release` must run (handled by PackChanged hook)
- If completion stops working, try manually running the cargo build:
  
- Ensure a working Rust toolchain is installed (`rustc`, `cargo`)

## Snacks Image Fix

The file `after/plugin/snacks-image-fix.lua` contains a workaround for invisible images after floating windows are closed. Without this fix, Snacks image rendering can leave ghost images or fail to display images after certain floating window interactions.

## Treesitter Auto-Start

Treesitter highlighting is enabled via a `FileType` autocmd that covers **all** languages, not just a fixed list of 20 built-in grammars. Any language with an installed grammar will automatically get treesitter highlighting when its filetype is detected.

## tsgo codeLens

The tsgo LSP codeLens handler includes a monkey-patch that:
1. Resolves reference/implementation counts from the raw codeLens data
2. Drops lenses that show 0-count (e.g., "0 references") to reduce visual noise

If codeLens values appear incorrect or missing, check the monkey-patch logic in the tsgo LSP configuration.

## Wrong LSP Server Attaching

LSP configs use `root_dir` to determine which server attaches to which buffer. The root_dir functions are designed for **mutual exclusion** — for example, vtsls and tsgo should not both attach to the same project:

- **tsgo**: activates when its specific root markers are found (e.g., a tsgo config or workspace indicator)
- **vtsls**: activates when standard TypeScript markers are found but tsgo markers are absent

If the wrong server attaches, check:
1. The root_dir callback logic for both servers
2. Whether the project has conflicting marker files
3. The async root_dir callback pattern — root_dir is resolved asynchronously, so race conditions are possible

## Colorscheme Syncing

- **In tmux**: Event-driven colorscheme detection (zero polling). Tmux focus events trigger a re-check.
- **Outside tmux**: 15-second polling interval checks for system colorscheme changes.

If the colorscheme does not update when switching system dark/light mode, verify the detection mechanism matches your terminal environment.

## General Debugging

- Run `:checkhealth` to verify plugin and tool status
- Use Snacks profiler: `<leader>dps` (startup profile), `<leader>dph` (highlight profile)
- Check `:messages` for suppressed errors
- Mason tool status: `:Mason` to see installed tools and any failures

## No lazy.nvim

This configuration does NOT use lazy.nvim. Do not suggest lazy.nvim profiling commands (`:Lazy profile`, etc.) or lazy.nvim-specific troubleshooting steps. The plugin manager is **vim.pack** (Neovim 0.12+ native).
