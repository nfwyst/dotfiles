local leader = require("keymaps.leader")
local g = require("keymaps.g")

local function format(conf)
  -- mode = { "x", "n", "o", "v" },
  local new_conf = {}
  for key, config in pairs(conf) do
    table.insert(config, 1, key)
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
    ["[["] = { desc = "Prev Matched Wrod" },
    ["]]"] = { desc = "Next Matched Word" },
    ["zp"] = { desc = "Fold Preview" },
  })
end

return {
  "folke/which-key.nvim",
  cond = not IS_VSCODE,
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
        border = "rounded", -- none, single, double, shadow
        padding = { 1, 1 }, -- extra window padding [top/bottom, right/left]
        wo = {
          winblend = 0,
        },
      },
      layout = {
        height = { min = 4, max = 25 }, -- min and max height of the columns
        width = { min = 20, max = 50 }, -- min and max width of the columns
        spacing = 3, -- spacing between columns
        align = "left", -- align columns left, center or right
      },
      show_help = true, -- show help message on the command line when the popup is visible
      triggers = {
        { "<auto>", mode = "nixsotc" },
      },
    })
  end,
}
