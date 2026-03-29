-- Plugin management using Neovim 0.12+ native vim.pack

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

  -- Completion
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
}, { confirm = false })

-- Restore shortmess and clear any pending messages
vim.o.shortmess = saved_shortmess
vim.cmd("silent! redraw")

-- Build blink.cmp after install/update
vim.api.nvim_create_autocmd("User", {
  pattern = "PackChanged",
  callback = function()
    for _, path in ipairs(vim.api.nvim_list_runtime_paths()) do
      if path:match("blink%.cmp$") then
        vim.notify("Building blink.cmp...", vim.log.levels.INFO)
        vim.system({ "cargo", "build", "--release" }, { cwd = path }, function(result)
          vim.schedule(function()
            if result.code == 0 then
              vim.notify("blink.cmp built successfully")
            else
              vim.notify("blink.cmp build failed: " .. (result.stderr or ""), vim.log.levels.ERROR)
            end
          end)
        end)
        break
      end
    end
    -- Update treesitter parsers
    pcall(vim.cmd, "TSUpdate")
  end,
})

-- Ghostty support (local plugin)
if vim.env.TERMINAL == "ghostty" then
  vim.opt.rtp:append("/Applications/Ghostty.app/Contents/Resources/vim/vimfiles")
end

-- Disable some built-in plugins
local disabled_builtins = { "gzip", "netrwPlugin", "rplugin", "tarPlugin", "tohtml", "tutor", "zipPlugin" }
for _, plugin in ipairs(disabled_builtins) do
  vim.g["loaded_" .. plugin] = 1
end

-- ===================================================================
-- Plugin auto-sync: cleanup inactive + background update check
-- ===================================================================
local pack_dir = vim.fn.stdpath("data") .. "/site/pack/core/opt"

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

-- Background update check: async git fetch to detect available updates
-- without opening any UI or blocking interaction
vim.defer_fn(function()
  local ok, all = pcall(vim.pack.get)
  if not ok or not all then
    return
  end

  local pending = 0
  local outdated = {}

  for _, plug in ipairs(all) do
    if not plug.active then
      goto continue
    end
    local dir = pack_dir .. "/" .. plug.spec.name
    if vim.fn.isdirectory(dir .. "/.git") ~= 1 then
      goto continue
    end

    pending = pending + 1
    -- git remote update + rev-parse to compare local vs remote HEAD
    vim.system({ "git", "-C", dir, "remote", "update" }, { text = true }, function()
      vim.system(
        { "git", "-C", dir, "rev-parse", "HEAD", "@{u}" },
        { text = true },
        function(result)
          if result.code == 0 and result.stdout then
            local lines = vim.split(result.stdout, "\n", { trimempty = true })
            if #lines >= 2 and lines[1] ~= lines[2] then
              table.insert(outdated, plug.spec.name)
            end
          end
          pending = pending - 1
          if pending == 0 then
            vim.schedule(function()
              if #outdated > 0 then
                vim.notify(
                  string.format(
                    " %d plugin(s) have updates: %s\nRun :PlugSync to update",
                    #outdated,
                    table.concat(outdated, ", ")
                  ),
                  vim.log.levels.INFO
                )
              end
            end)
          end
        end
      )
    end)
    ::continue::
  end
end, 2000)

-- :PlugSync command — manual trigger for vim.pack.update + cleanup
vim.api.nvim_create_user_command("PlugSync", function()
  -- Clean inactive first
  local ok, all = pcall(vim.pack.get)
  if ok and all then
    local to_remove = {}
    for _, plug in ipairs(all) do
      if not plug.active then
        table.insert(to_remove, plug.spec.name)
      end
    end
    if #to_remove > 0 then
      pcall(vim.pack.del, to_remove, { confirm = false })
      vim.notify("Cleaned up: " .. table.concat(to_remove, ", "), vim.log.levels.INFO)
    end
  end
  -- Then update
  vim.pack.update(nil, { confirm = false })
end, { desc = "Sync plugins: cleanup inactive + update active" })

-- Load plugin configurations
require("plugins.colorscheme")
require("plugins.ui")
require("plugins.editor")
require("plugins.coding")
require("plugins.tools")
