return {
  "nvim-neo-tree/neo-tree.nvim",
  opts = function(_, opts)
    UPDATE_HLS({
      NeoTreeIndentMarker = { fg = INDENT_HL },
      NeoTreeMessage = { link = "NeoTreeIndentMarker" },
    })

    PUSH_WHEN_NOT_EXIST(FT_HIDE_CURSOR, "neo-tree")

    -- hide left columns for file tree
    if not FILETYPE_TASK_MAP["neo-tree"] then
      FILETYPE_TASK_MAP["neo-tree"] = function(_, win)
        if WIN_VAR(win, FILETYPE_TASK_KEY) then
          return
        end
        defer(function()
          SET_OPTS(COLUMN_OPTS(false), { win = win })
          WIN_VAR(win, FILETYPE_TASK_KEY, true)
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
