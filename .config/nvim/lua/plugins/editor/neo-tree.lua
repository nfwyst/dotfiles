local util = require("config.util")

local config = { show_path = "relative" } -- "none", "relative", "absolute"

return {
  "nvim-neo-tree/neo-tree.nvim",
  opts = function(_, opts)
    util.set_hl("NeoTreeMessage gui=italic")

    local opt = {
      hide_root_node = true,
      log_level = "fatal",
      enable_diagnostics = false,
      default_component_configs = {
        indent = {
          with_expanders = false,
        },
        modified = {
          symbol = " ",
        },
        git_status = {
          symbols = {
            added = " +",
            modified = " ",
            deleted = " 󰗨",
            renamed = " 󰹳",
            untracked = " ",
            ignored = " ",
            unstaged = " 󰆻",
            staged = " 󰆺",
            conflict = " 󰆑",
          },
        },
      },
      window = {
        width = 10,
        auto_expand_width = true,
        mappings = {
          ["a"] = { "add", config = config },
          ["A"] = { "add_directory", config = config },
          ["c"] = { "copy", config = config },
          ["m"] = { "move", config = config },
        },
      },
      filesystem = {
        filtered_items = {
          never_show = { ".DS_Store", "thumbs.db" },
          always_show = { ".config" },
          always_show_by_pattern = { ".env*" },
        },
        follow_current_file = { enabled = true },
      },
      buffers = { follow_current_file = { enabled = true } },
    }

    return vim.tbl_deep_extend("force", opts, opt)
  end,
}
