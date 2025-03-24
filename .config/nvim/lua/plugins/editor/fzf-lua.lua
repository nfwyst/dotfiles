IS_REALTIME_SYMBOLS = false

local layout = {
  preview = "main",
  layout = {
    backdrop = false,
    row = 1,
    width = 0.2,
    min_width = 50,
    height = 0.2,
    min_height = 8,
    border = "rounded",
    box = "vertical",
    { win = "input", height = 1, border = "bottom", title = "{title} {live} {flags}", title_pos = "center" },
    { win = "list", border = "hpad" },
    { win = "preview", title = "{preview}", border = "rounded" },
  },
}

return {
  "ibhagwan/fzf-lua",
  cmd = "FzfLua",
  keys = {
    {
      "<leader>ss",
      function()
        IS_REALTIME_SYMBOLS = true
        OPT("winbar", { win = CUR_WIN() }, "")
        Snacks.picker.lsp_symbols({
          layout = layout,
          on_close = function()
            IS_REALTIME_SYMBOLS = false
          end,
        })
      end,
      desc = "Goto Symbol",
    },
  },
  opts = function(_, opts)
    local acts = require("fzf-lua").actions
    local actions = {
      ["ctrl-g"] = { acts.toggle_ignore },
      ["ctrl-h"] = { acts.toggle_hidden },
      ["alt-i"] = false,
      ["alt-h"] = false,
    }

    local opt = {
      keymap = {
        fzf = {
          ["ctrl-q"] = "select+accept",
          ["ctrl-a"] = "select-all+accept",
          ["tab"] = "toggle+down",
          ["shift-tab"] = "up+toggle",
        },
      },
      fzf_colors = {
        ["gutter"] = "-1",
      },
      winopts = {
        backdrop = 100,
        height = 0.9,
        width = 0.9,
        zindex = 100,
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
        silent = true,
        actions = actions,
      },
      lsp = {
        async_or_timeout = IS_LINUX and 30000 or 5000,
      },
    }
    return merge(opts, opt)
  end,
}
