-- Plugin management using Neovim 0.12+ native vim.pack

-- Fail fast on unreachable git remotes so one dead host cannot block
-- vim.pack.update / :checkhealth for 75s (libcurl default).
-- Abort any fetch that sees <1KB/s for >5s.
vim.env.GIT_HTTP_LOW_SPEED_LIMIT = vim.env.GIT_HTTP_LOW_SPEED_LIMIT or "1000"
vim.env.GIT_HTTP_LOW_SPEED_TIME  = vim.env.GIT_HTTP_LOW_SPEED_TIME  or "5"


-- Suppress messages during plugin loading to prevent hit-enter prompt.
-- vim.pack's progress reporting and lock_read can produce output that
-- overflows cmdheight before noice.nvim is loaded to handle messages.
local saved_shortmess = vim.o.shortmess
vim.o.shortmess = "aAFOTIcC"

vim.pack.add({
  -- Dependencies
  "https://github.com/MunifTanjim/nui.nvim",
  "https://github.com/nvim-lua/plenary.nvim",
  "https://github.com/nvim-tree/nvim-web-devicons",
  "https://github.com/b0o/SchemaStore.nvim",

  -- Colorschemes
  "https://github.com/folke/tokyonight.nvim",
  "https://github.com/loctvl842/monokai-pro.nvim",
  "https://github.com/Tsuzat/NeoSolarized.nvim",

  -- Treesitter
  { src = "https://github.com/nvim-treesitter/nvim-treesitter", version = "main" },
  "https://github.com/nvim-treesitter/nvim-treesitter-context",

  -- Completion (blink.cmp v2 requires blink.lib)
  "https://github.com/saghen/blink.lib",
  "https://github.com/saghen/blink.cmp",
  "https://github.com/rafamadriz/friendly-snippets",

  -- Editor
  "https://github.com/folke/which-key.nvim",
  "https://github.com/lewis6991/gitsigns.nvim",
  "https://github.com/spacedentist/resolve.nvim",
  "https://github.com/MagicDuck/grug-far.nvim",
  "https://github.com/folke/trouble.nvim",
  "https://github.com/folke/flash.nvim",
  "https://github.com/folke/todo-comments.nvim",

  -- UI
  "https://github.com/nvim-lualine/lualine.nvim",
  "https://github.com/akinsho/bufferline.nvim",
  "https://github.com/folke/noice.nvim",
  "https://github.com/folke/snacks.nvim",
  "https://github.com/tadaa/vimade",

  -- Coding
  "https://github.com/nvim-mini/mini.pairs",
  "https://github.com/nvim-mini/mini.ai",
  "https://github.com/nvim-mini/mini.surround",
  "https://github.com/windwp/nvim-ts-autotag",
  "https://github.com/folke/lazydev.nvim",

  -- Lang
  "https://github.com/MeanderingProgrammer/render-markdown.nvim",

  -- Tools
  "https://github.com/mason-org/mason.nvim",
  "https://github.com/stevearc/conform.nvim",
  "https://github.com/mfussenegger/nvim-lint",

  -- AI
  "https://github.com/olimorris/codecompanion.nvim",

  -- Util
  "https://github.com/kawre/leetcode.nvim",
  "https://github.com/bngarren/checkmate.nvim",
  "https://github.com/typed-rocks/ts-worksheet-neovim",
  "https://github.com/benomahony/uv.nvim",
})

-- Restore shortmess
vim.o.shortmess = saved_shortmess

-- Override vim.pack health check with async/parallel version
pcall(require, "health_override.pack")

-- Bridge nvim-treesitter main-branch query layout to Neovim's rtp lookup.
-- The main branch stores queries at runtime/queries/{lang}/ but Neovim
-- expects {rtp}/queries/{lang}/. TSInstall symlinks shared dirs (ecma,
-- html_tags, jsx) but skips per-language ones (tsx, typescript, etc.).
-- Prepending runtime/ to rtp makes all queries discoverable directly.
local ts_runtime = vim.fn.stdpath("data") .. "/site/pack/core/opt/nvim-treesitter/runtime"
if vim.uv.fs_stat(ts_runtime) then
  vim.opt.rtp:prepend(ts_runtime)
end

-- =============================================================
-- PackChanged hooks: build steps + real-time PlugSync feedback
-- NOTE: PackChanged is a native event (not User); pattern is plugin path.
-- =============================================================
local plug_sync = { active = false, results = {}, started_at = 0 }

local function sync_notify(msg, level)
  vim.notify(msg, level or vim.log.levels.INFO, { title = "PlugSync" })
end

vim.api.nvim_create_autocmd("PackChangedPre", {
  group = vim.api.nvim_create_augroup("plug_sync_pre", { clear = true }),
  callback = function(ev)
    if not plug_sync.active then return end
    local d = ev.data or {}
    local name = d.spec and d.spec.name or "?"
    sync_notify(string.format("[%s] %s ...", d.kind or "?", name))
  end,
})

vim.api.nvim_create_autocmd("PackChanged", {
  group = vim.api.nvim_create_augroup("pack_changed", { clear = true }),
  callback = function(ev)
    local d = ev.data or {}
    local name = d.spec and d.spec.name or "?"
    local kind = d.kind or "?"

    -- Build blink.cmp native fuzzy library via official v2 API.
    -- cmp.build() handles cargo build + mv to stdpath('data')/site/lib/
    -- libblink_cmp_fuzzy.<ext>.<commit-hash7> automatically.
    if name == "blink.cmp" and (kind == "install" or kind == "update") then
      sync_notify("Building blink.cmp native library...")
      vim.schedule(function()
        local ok, cmp = pcall(require, "blink.cmp")
        if not ok then
          pcall(vim.cmd.packadd, "blink.cmp")
          ok, cmp = pcall(require, "blink.cmp")
        end
        if not ok then
          sync_notify("blink.cmp require failed: " .. tostring(cmp), vim.log.levels.ERROR)
          return
        end
        local task_ok, task = pcall(cmp.build, { force = true })
        if not task_ok then
          sync_notify("blink.cmp build dispatch failed: " .. tostring(task), vim.log.levels.ERROR)
          return
        end
        task
          :map(function() sync_notify("blink.cmp built successfully") end)
          :catch(function(err)
            sync_notify("blink.cmp build failed: " .. tostring(err), vim.log.levels.ERROR)
          end)
      end)
    end

    -- Update treesitter parsers
    if name == "nvim-treesitter" and (kind == "install" or kind == "update") then
      if not d.active then pcall(vim.cmd.packadd, "nvim-treesitter") end
      pcall(vim.cmd, "TSUpdate")
    end

    if plug_sync.active then
      plug_sync.results[name] = { kind = kind, ok = true }
      sync_notify(string.format("[%s] %s ✓", kind, name))
    end
  end,
})

-- Ghostty support (local plugin)
if vim.env.TERMINAL == "ghostty" then
  vim.opt.rtp:append("/Applications/Ghostty.app/Contents/Resources/vim/vimfiles")
end

-- Disable some built-in plugins
local disabled_builtins = { "netrwPlugin", "rplugin", "tohtml", "tutor" }
for _, plugin in ipairs(disabled_builtins) do
  vim.g["loaded_" .. plugin] = 1
end

-- Cleanup inactive plugins (fast, no network IO, safe on every startup)
vim.defer_fn(function()
  local ok, all = pcall(vim.pack.get)
  if not ok or not all then
    return
  end
  local to_remove = {}
  for _, plug in ipairs(all) do
    if not plug.active then
      table.insert(to_remove, plug.spec.name)
    end
  end
  if #to_remove > 0 then
    pcall(vim.pack.del, to_remove, { confirm = false })
    vim.notify("Cleaned up inactive plugins: " .. table.concat(to_remove, ", "), vim.log.levels.INFO)
  end
end, 300)

-- :PlugSync — cleanup inactive + async parallel fetch + offline update
-- Why this shape:
--   vim.pack.update(nil, { force = true }) internally runs async.run(joined):wait(),
--   which is a busy vim.wait() blocking the UI until every `git fetch` finishes.
--   We bypass this by fetching in parallel via vim.system (libuv, non-blocking),
--   emitting per-plugin progress as each job returns, then calling
--   vim.pack.update(..., { offline = true }) to do only local checkout + fire
--   PackChanged events — effectively instant, no second network phase.
vim.api.nvim_create_user_command("PlugSync", function()
  plug_sync.active = true
  plug_sync.results = {}
  plug_sync.started_at = vim.uv.hrtime()
  sync_notify("Starting plugin sync...")

  -- 1) Cleanup inactive plugins
  local ok_all, all = pcall(vim.pack.get)
  if ok_all and all then
    local to_remove = {}
    for _, plug in ipairs(all) do
      if not plug.active then
        table.insert(to_remove, plug.spec.name)
      end
    end
    if #to_remove > 0 then
      pcall(vim.pack.del, to_remove, { confirm = false })
      sync_notify("Cleaned up: " .. table.concat(to_remove, ", "))
    end
  end

  -- 2) Collect active plugins that have a git repo
  local _, plugs = pcall(vim.pack.get)
  local active_plugs = {}
  for _, p in ipairs(plugs or {}) do
    if p.active and p.path and vim.fn.isdirectory(p.path .. "/.git") == 1 then
      table.insert(active_plugs, p)
    end
  end
  local total = #active_plugs
  if total == 0 then
    sync_notify("No plugins to sync")
    plug_sync.active = false
    return
  end

  local done_count = 0
  local pending = total

  local function finish()
    local upd_ok, upd_err = pcall(vim.pack.update, nil, { force = true, offline = true })

    vim.schedule(function()
      local counts = { install = 0, update = 0, delete = 0 }
      local names  = { install = {}, update = {}, delete = {} }
      for n, r in pairs(plug_sync.results) do
        counts[r.kind] = (counts[r.kind] or 0) + 1
        table.insert(names[r.kind] or {}, n)
      end
      local elapsed = (vim.uv.hrtime() - plug_sync.started_at) / 1e9
      local lines = {
        string.format("Sync finished in %.1fs", elapsed),
        string.format("  install: %d  update: %d  delete: %d",
          counts.install, counts.update, counts.delete),
      }
      if #names.update > 0 then
        table.insert(lines, "  updated: " .. table.concat(names.update, ", "))
      end
      if #names.install > 0 then
        table.insert(lines, "  installed: " .. table.concat(names.install, ", "))
      end
      if not upd_ok then
        table.insert(lines, "ERROR: " .. tostring(upd_err))
        sync_notify(table.concat(lines, "\n"), vim.log.levels.ERROR)
      else
        sync_notify(table.concat(lines, "\n"))
      end
      plug_sync.active = false
    end)
  end

  -- 3) Parallel async git fetch — UI stays responsive
  for _, p in ipairs(active_plugs) do
    local name = p.spec.name
    vim.system(
      { "git", "fetch", "--quiet", "--tags", "--force",
        "--recurse-submodules=yes", "origin" },
      { cwd = p.path, text = true },
      function(res)
        vim.schedule(function()
          done_count = done_count + 1
          if res.code == 0 then
            sync_notify(string.format("[fetch %d/%d] %s", done_count, total, name))
          else
            local err = (res.stderr or ""):gsub("\n+$", "")
            sync_notify(
              string.format("[fetch %d/%d] %s FAILED: %s", done_count, total, name, err),
              vim.log.levels.WARN
            )
          end
          pending = pending - 1
          if pending == 0 then
            sync_notify(string.format("Fetched %d/%d, applying updates...", done_count, total))
            finish()
          end
        end)
      end
    )
  end
end, { desc = "Sync plugins: async fetch + offline update (non-blocking)" })

-- which-key: <leader>p plugin group
vim.keymap.set("n", "<leader>ps", "<cmd>PlugSync<cr>", { desc = "Plugin: Sync (update + cleanup)" })
vim.keymap.set("n", "<leader>pl", function()
  local ok, all = pcall(vim.pack.get)
  if not ok then return end
  local lines = {}
  for _, p in ipairs(all) do
    table.insert(lines, string.format("%s %s", p.active and "●" or "○", p.spec.name))
  end
  sync_notify(table.concat(lines, "\n"))
end, { desc = "Plugin: List status" })

-- Load plugin configurations
require("plugins.colorscheme")
require("plugins.ui")
require("plugins.editor")
require("plugins.coding")
require("plugins.tools")
