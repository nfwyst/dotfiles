AUCMD("FileType", {
  group = GROUP("neotree_hide_statuscolumn", { clear = true }),
  pattern = "neo-tree",
  callback = function(event)
    defer(function()
      local win = fn.bufwinid(event.buf)
      wo[win].statuscolumn = ""
    end, 10)
  end,
})

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

-- TODO: filter, max, min width
