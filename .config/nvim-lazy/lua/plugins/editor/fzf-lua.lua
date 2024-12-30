return {
  "ibhagwan/fzf-lua",
  cmd = "FzfLua",
  opts = function(_, opts)
    local acts = require("fzf-lua.actions")
    local actions = {
      ["ctrl-i"] = { acts.toggle_ignore },
      ["ctrl-h"] = { acts.toggle_hidden },
      ["alt-i"] = false,
      ["alt-h"] = false,
      ["ctrl-g"] = false,
    }

    local opt = {
      winopts = {
        backdrop = 100,
        preview = {
          scrollbar = false,
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
