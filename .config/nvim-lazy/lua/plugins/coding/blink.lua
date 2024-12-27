return {
  "saghen/blink.cmp",
  dependencies = {
    {
      "saghen/blink.compat",
      optional = false,
      version = "*",
    },
  },
  opts = {
    sources = {
      default = { "obsidian", "obsidian_new", "obsidian_tags" },
      providers = {
        obsidian = {
          name = "obsidian",
          module = "blink.compat.source",
        },
        obsidian_new = {
          name = "obsidian_new",
          module = "blink.compat.source",
        },
        obsidian_tags = {
          name = "obsidian_tags",
          module = "blink.compat.source",
        },
      },
    },
  },
}
