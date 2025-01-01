return {
  "saghen/blink.cmp",
  dependencies = {
    {
      "saghen/blink.compat",
      optional = false,
      opts = function(_, opts)
        require("cmp").ConfirmBehavior = {
          Insert = "insert",
          Replace = "replace",
        }
        opts.impersonate_nvim_cmp = true
        return opts
      end,
    },
  },
  opts = function(_, opts)
    push_list(opts.sources.compat, {
      "obsidian",
      "obsidian_new",
      "obsidian_tags",
      "avante_commands",
      "avante_mentions",
      "avante_files",
    })
    return opts
  end,
}

-- TODO: border, ghost_text, scrollbar
