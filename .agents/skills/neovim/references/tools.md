# Tools & Commands Reference

Built-in commands, CLI tools, and debug utilities for Neovim 0.12+.

## Built-in Commands

### LSP

```vim
:lsp                       " Interactive LSP management (new in 0.12)
:checkhealth vim.lsp       " LSP health check
```

### LSP (Lua)

```lua
vim.lsp.get_clients()                -- Active clients
vim.lsp.get_clients({ bufnr = 0 })  -- Clients for current buffer
vim.lsp.buf.format({ async = true }) -- Format document
vim.lsp.buf.rename()                 -- Rename symbol
vim.lsp.buf.code_action()            -- Code actions
vim.lsp.buf.hover()                  -- Hover info
vim.lsp.buf.signature_help()         -- Signature help
vim.lsp.inlay_hint.enable(bool)      -- Toggle inlay hints
vim.lsp.codelens.run()               -- Run codelens
vim.lsp.codelens.enable(bool)        -- Toggle codelens
```

### Mason

```vim
:Mason                     " Open Mason UI
:MasonInstall <pkg>        " Install package
:MasonUninstall <pkg>      " Uninstall package
:MasonUpdate               " Update all packages
```

### vim.pack

```vim
:PlugSync                  " Custom: cleanup inactive + update all
```

```lua
vim.pack.add(specs)        -- Install + load plugins
vim.pack.update()          -- Update all
vim.pack.get()             -- List all plugins with state
vim.pack.del(names)        -- Remove plugins
```

### Treesitter

```vim
:TSInstall <lang>          " Install parser
:TSUpdate                  " Update all parsers
:TSInstallInfo             " Show installed parsers
:InspectTree               " Show syntax tree
:Inspect                   " Show highlight groups under cursor
:EditQuery                 " Edit treesitter queries (with completion)
```

### Conform (Formatting)

```vim
:ConformInfo               " Show active formatters for current buffer
```

### Snacks Picker

All picker commands are accessed via Lua:

```lua
Snacks.picker.files()              -- Find files
Snacks.picker.grep()               -- Grep
Snacks.picker.buffers()            -- Buffers
Snacks.picker.help()               -- Help pages
Snacks.picker.keymaps()            -- Keymaps
Snacks.picker.commands()           -- Commands
Snacks.picker.diagnostics()        -- Diagnostics
Snacks.picker.lsp_definitions()    -- LSP definitions
Snacks.picker.lsp_references()     -- LSP references
Snacks.picker.lsp_symbols()        -- LSP symbols
Snacks.picker.git_log()            -- Git log
Snacks.picker.git_status()         -- Git status
Snacks.picker.colorschemes()       -- Colorscheme picker
Snacks.picker.notifications()      -- Notification history
Snacks.picker.resume()             -- Resume last picker
Snacks.picker.undo()               -- Undo tree
```

### Snacks (Other)

```lua
Snacks.explorer()          -- File explorer
Snacks.lazygit()           -- Lazygit
Snacks.terminal(cmd)       -- Float terminal
Snacks.bufdelete()         -- Delete buffer safely
Snacks.notifier.show_history()  -- Show notifications
Snacks.scratch()           -- Scratch buffer
Snacks.rename.rename_file() -- Rename file
Snacks.gitbrowse()         -- Open in browser
Snacks.dim()               -- Toggle dim
Snacks.toggle.zoom()       -- Toggle zoom
Snacks.toggle.zen()        -- Toggle zen
Snacks.words.jump(count)   -- Navigate references
```

### Noice

```vim
:Noice last                " Last message
:Noice history             " Message history
:Noice all                 " All messages
:Noice dismiss             " Dismiss all
```

### Trouble

```vim
:Trouble diagnostics toggle            " Toggle diagnostics
:Trouble diagnostics toggle filter.buf=0  " Buffer diagnostics
:Trouble symbols toggle                " Toggle symbols
:Trouble lsp toggle                    " LSP references/defs
:Trouble loclist toggle                " Location list
:Trouble qflist toggle                 " Quickfix list
```

### Git

```lua
-- Gitsigns
require("gitsigns").stage_hunk()
require("gitsigns").reset_hunk()
require("gitsigns").preview_hunk_inline()
require("gitsigns").blame_line()
require("gitsigns").diffthis()
require("gitsigns").toggle_signs()
```

### Grug-far (Search & Replace)

```lua
require("grug-far").open({ prefills = { paths = vim.fn.expand("%") } })
```

### Flash (Motion)

```lua
require("flash").jump()        -- Flash jump
require("flash").treesitter()  -- Treesitter-aware jump
require("flash").remote()      -- Remote flash (operator pending)
```

### Codecompanion (AI)

```vim
:CodeCompanion             " Open AI chat
:CodeCompanionActions      " Show AI actions
:CodeCompanionChat         " Chat interface
```

## CLI Tools

### Required

| Tool | Purpose | Install |
|------|---------|---------|
| `git` | Plugin management, gitsigns | System package manager |
| `ripgrep` | Snacks grep | `brew install ripgrep` |
| `fd` | Snacks file finder | `brew install fd` |
| `cargo` | Build blink.cmp | `brew install rust` |

### Optional

| Tool | Purpose | Install |
|------|---------|---------|
| `node` | LSP servers, prettierd | `brew install node` |
| `lazygit` | Git TUI | `brew install lazygit` |
| `fortune` | Dashboard quotes | `brew install fortune` |
| `lua-language-server` | Lua LSP | Via Mason |
| `stylua` | Lua formatter | Via Mason |
| `prettierd` | JS/TS/CSS formatter | Via Mason |
| `shfmt` | Shell formatter | Via Mason |
| `eslint_d` | JS/TS linter | Via Mason |

## Debug Utilities

### Lua Debug

```lua
-- Print table contents
:lua print(vim.inspect(some_table))

-- Buffer info
:lua print(vim.api.nvim_buf_get_name(0))
:lua print(vim.bo.filetype)
:lua print(vim.bo.syntax)

-- Treesitter state
:lua print(vim.b.ts_highlight)
:lua print(vim.inspect(vim.treesitter.get_parser():lang()))
:lua print(vim.treesitter.get_node():type())

-- Check highlight queries exist
:lua print(vim.treesitter.query.get("lua", "highlights") ~= nil)

-- Loaded modules
:lua print(vim.inspect(package.loaded))

-- Reload module
:lua package.loaded["module.name"] = nil; require("module.name")
```

### LSP Debug

```lua
-- Active clients with names
:lua print(vim.inspect(vim.tbl_map(function(c) return c.name end, vim.lsp.get_clients())))

-- Client capabilities
:lua print(vim.inspect(vim.lsp.get_clients()[1].server_capabilities))

-- Diagnostics for current buffer
:lua print(vim.inspect(vim.diagnostic.get(0)))

-- Check if method supported
:lua print(vim.lsp.get_clients()[1]:supports_method("textDocument/inlayHint"))
```

### Startup Profiling

```bash
# Startup time analysis
nvim --startuptime /tmp/startup.log
sort -k2 -n -r /tmp/startup.log | head -20

# Memory usage
nvim --cmd 'lua print(collectgarbage("count"))' --cmd 'q'

# Verbose logging
nvim -V10/tmp/nvim.log
```

### Health Checks

```vim
:checkhealth              " Full system check
:checkhealth vim.lsp      " LSP only
:checkhealth vim.treesitter " Treesitter only
:checkhealth vim.deprecated " Check for deprecated usage
```

## Validation Commands

```bash
# Check Lua syntax
luacheck lua/

# Validate config loads
nvim --headless -c "lua require('config.options')" -c "q"

# Run health checks
nvim --headless -c "checkhealth" -c "qa!" 2>&1

# Profile startup
nvim --startuptime /tmp/startup.log -c "q" && cat /tmp/startup.log
```
