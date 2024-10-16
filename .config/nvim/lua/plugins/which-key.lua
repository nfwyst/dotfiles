local leader = require("keymaps.leader")
local g = require("keymaps.g")

local function key_filter(config)
  local lhs = config[1]
  local rhs = config[2]
  local exclude_fts = KEYMAP_EXCLUDE_FTS[lhs]
  if exclude_fts and #exclude_fts > 0 then
    config[2] = function(...)
      local ft = GET_FILETYPE(GET_CURRENT_BUFFER())
      local is_excluded = TABLE_CONTAINS(exclude_fts, ft)
      if is_excluded then
        LOG_INFO("keymap", "key " .. lhs .. " disabled for filetype " .. ft)
        return
      end
      if type(rhs) == "function" then
        return rhs(...)
      end
      if START_WITH(rhs, "<cmd>") then
        local command = rhs:gsub("<cmd>", ""):gsub("<cr>", "")
        return RUN_CMD(command)
      end
      FEED_KEYS(rhs, "nx")
    end
  end
end

local function format(conf)
  local new_conf = { mode = { "n", "v" } }
  for key, config in pairs(conf) do
    table.insert(config, 1, key)
    key_filter(config)
    table.insert(
      new_conf,
      MERGE_TABLE(config, {
        nowait = true,
        remap = false,
      })
    )
  end
  return new_conf
end

local function init(wk)
  SET_USER_COMMANDS({
    Save = function()
      PCALL(SAVE)
    end,
    SaveThenQuit = function()
      PCALL(SAVE_THEN_QUIT)
    end,
    Quit = function()
      PCALL(QUIT)
    end,
  })

  local add = wk.add
  wk.add = function(config, option)
    add(format(config), option)
  end

  g(wk)
  leader(wk)

  wk.add({
    ["[["] = {
      function()
        require("illuminate").goto_prev_reference(false)
      end,
      desc = "Prev Matched Wrod",
    },
    ["]]"] = {
      function()
        require("illuminate").goto_next_reference(false)
      end,
      desc = "Next Matched Word",
    },
    ["zp"] = { desc = "Fold Preview" },
  })
end

return {
  "folke/which-key.nvim",
  config = function()
    local wk = require("which-key")
    init(wk)
    wk.setup({
      plugins = {
        marks = true, -- shows a list of your marks on ' and `
        registers = true, -- shows your registers on " in NORMAL or <C-r> in INSERT mode
        spelling = {
          enabled = true, -- enabling this will show WhichKey when pressing z= to select spelling suggestions
          suggestions = 20, -- how many suggestions should be shown in the list?
        },
        -- the presets plugin, adds help for a bunch of default keybindings in Neovim
        -- No actual key bindings are created
        presets = {
          operators = true, -- adds help for operators like d, y, ... and registers them for motion / text object completion
          motions = true, -- adds help for motions
          text_objects = true, -- help for text objects triggered after entering an operator
          windows = true, -- default bindings on <c-w>
          nav = true, -- misc bindings to work with windows
          z = true, -- bindings for folds, spelling and others prefixed with z
          g = true, -- bindings for prefixed with g
        },
      },
      icons = {
        breadcrumb = "»", -- symbol used in the command line area that shows your active key combo
        separator = "➜", -- symbol used between a key and it's label
        group = "+", -- symbol prepended to a group
      },
      keys = {
        scroll_down = "<c-d>", -- binding to scroll down inside the popup
        scroll_up = "<c-u>", -- binding to scroll up inside the popup
      },
      win = {
        no_overlap = false,
        height = { min = 4, max = 25 }, -- min and max height of the columns
        border = "rounded", -- none, single, double, shadow
        padding = { 1, 1 }, -- extra window padding [top/bottom, right/left]
        wo = {
          winblend = 0,
        },
      },
      layout = {
        width = { min = 20, max = 50 }, -- min and max width of the columns
        spacing = 1, -- spacing between columns
      },
      show_help = true, -- show help message on the command line when the popup is visible
      triggers = {
        { "<auto>", mode = "nixsotc" },
      },
    })
  end,
}
