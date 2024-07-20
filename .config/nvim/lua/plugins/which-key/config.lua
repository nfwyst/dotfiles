local leader_conf = require("plugins.which-key.registers.leader")
local g_conf = require("plugins.which-key.registers.g-conf")
local comment_conf = require("plugins.which-key.registers.comment-conf")
local fold_conf = require("plugins.which-key.registers.fold-conf")
local ilconf = require("plugins.which-key.registers.illuminate-conf")

local options = {
  mode = "n", -- normal mode
  buffer = nil, -- Global mappings. Specify a buffer number for buffer local mappings
  silent = true, -- use `silent` when creating keymaps
  noremap = true, -- use `noremap` when creating keymaps
  nowait = true, -- use `nowait` when creating keymaps
}

local other = {
  [">."] = "Neorg promote no recursively",
  ["<,"] = "Neorg demote no recursively",
  [">t"] = { "<cmd>tabNext<cr>", "Next tab" },
  ["<t"] = { "<cmd>tabprevious<cr>", "Previous tab" },
  [">x"] = { "<cmd>tabclose<cr>", "Close tab" },
}

local registers = {
  {
    leader_conf,
    MERGE_TABLE(options, { prefix = "<leader>", mode = { "n", "v" } }),
  },
  { g_conf, MERGE_TABLE(options, { prefix = "g" }) },
  { comment_conf, options },
  { fold_conf, options },
  { ilconf, options },
  { other, options },
}

local function init()
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
end

return {
  "folke/which-key.nvim",
  cond = not IS_VSCODE,
  keys = {
    { "<leader>", mode = WHICHKEY_MODE },
    { "<c-w>", mode = WHICHKEY_MODE },
    { "g", mode = WHICHKEY_MODE },
    { "]", mode = WHICHKEY_MODE },
    { "[", mode = WHICHKEY_MODE },
    { "y", mode = WHICHKEY_MODE },
    { "'", mode = WHICHKEY_MODE },
    { "z", mode = WHICHKEY_MODE },
    { '"', mode = WHICHKEY_MODE },
    { "`", mode = WHICHKEY_MODE },
    { "c", mode = WHICHKEY_MODE },
    { "v", mode = WHICHKEY_MODE },
    { "d", mode = WHICHKEY_MODE },
    { "!", mode = WHICHKEY_MODE },
    { ">", mode = WHICHKEY_MODE },
    { "<", mode = WHICHKEY_MODE },
  },
  config = function()
    local which_key = require("which-key")
    for _, item in ipairs(registers) do
      which_key.register(item[1], item[2])
    end
    init()

    which_key.setup({
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
      triggers = "auto", -- automatically setup triggers
    })
  end,
}
