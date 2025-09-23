local util = require("config.util")

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
      },
      filesystem = {
        filtered_items = {
          never_show = {
            ".DS_Store",
          },
        },
      },
    }

    return vim.tbl_deep_extend("force", opts, opt)
  end,
}
