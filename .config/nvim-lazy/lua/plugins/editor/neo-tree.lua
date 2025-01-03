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
  opts = function(_, opts)
    SET_HLS({ NeoTreeIndentMarker = { fg = TRANSPARENT_INDENT_HL } })

    local opt = {
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
    }

    return merge(opts, opt)
  end,
}

-- TODO: filter, max, min width
