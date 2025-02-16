local config_files = {
  "tailwind.config.js",
  "tailwind.config.ts",
  "tailwind.config.cjs",
  "tailwind.config.mjs",
}

return {
  filetypes_exclude = { "markdown" },
  filetypes_include = {},
  on_attach = function(client, bufnr)
    -- only git repo go here
    local config_root = fs.root(bufnr, config_files)
    if config_root then
      return
    end
    client.stop()
  end,
}
