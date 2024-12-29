local function get_sources(names)
  local sources = { default = names, providers = {} }
  for _, name in ipairs(names) do
    sources.providers[name] = {
      name = name,
      module = "blink.compat.source",
      score_offset = 1000,
      opts = {},
    }
  end
  return sources
end

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
    sources = get_sources({
      "obsidian",
      "obsidian_new",
      "obsidian_tags",
      "avante_commands",
      "avante_mentions",
      "avante_files",
    }),
  },
}
