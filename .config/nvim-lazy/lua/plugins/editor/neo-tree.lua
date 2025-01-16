return {
  "nvim-neo-tree/neo-tree.nvim",
  opts = function(_, opts)
    SET_HLS({
      NeoTreeIndentMarker = { fg = TRANSPARENT_INDENT_HL },
      NeoTreeMessage = { link = "NeoTreeIndentMarker" },
    })

    -- hide left columns for file tree
    if not FILETYPE_TASK_MAP["neo-tree"] then
      FILETYPE_TASK_MAP["neo-tree"] = function(_, win)
        if WIN_VAR(win, TASK_KEY) then
          return
        end
        defer(function()
          SET_OPTS(COLUMN_OPTS(false), wo[win])
          WIN_VAR(win, TASK_KEY, true)
        end, 10)
      end
    end

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
