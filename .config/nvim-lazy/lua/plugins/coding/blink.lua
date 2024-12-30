return {
  "saghen/blink.cmp",
  dependencies = {
    {
      "saghen/blink.compat",
      optional = false,
    },
  },
  opts = {
    sources = {
      compat = {
        "obsidian",
        "obsidian_new",
        "obsidian_tags",
        "avante_commands",
        "avante_mentions",
        "avante_files",
      },
    },
  },
}

-- TODO: border, ghost_text, scrollbar
