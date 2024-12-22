return {
  "ibhagwan/fzf-lua",
  cmd = "FzfLua",
  opts = {
    winopts = {
      backdrop = 100,
      preview = {
        scrollbar = "border",
      },
    },
    oldfiles = {
      include_current_session = true,
    },
    previewers = {
      builtin = {
        syntax_limit_b = 1024 * 100,
      },
    },
    grep = {
      rg_glob = true,
      glob_flag = "--iglob",
      glob_separator = "%s%-%-",
    },
  },
}
