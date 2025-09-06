return {
  "nvim-neo-tree/neo-tree.nvim",
  opts = {
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
  },
}
