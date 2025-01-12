return {
  "ibhagwan/fzf-lua",
  cmd = "FzfLua",
  opts = function(_, opts)
    local acts = require("fzf-lua").actions
    local actions = {
      ["ctrl-i"] = { acts.toggle_ignore },
      ["ctrl-h"] = { acts.toggle_hidden },
      ["alt-i"] = false,
      ["alt-h"] = false,
      ["ctrl-g"] = false,
    }

    local opt = {
      fzf_colors = {
        ["gutter"] = "-1",
      },
      winopts = {
        backdrop = 100,
        height = 0.9,
        width = 0.9,
        preview = {
          scrollbar = false,
          layout = "vertical",
        },
      },
      oldfiles = {
        include_current_session = true,
      },
      previewers = {
        builtin = {
          syntax_limit_b = 102400,
        },
      },
      files = {
        actions = actions,
      },
      grep = {
        rg_glob = true,
        actions = actions,
      },
    }
    return merge(opts, opt)
  end,
}
