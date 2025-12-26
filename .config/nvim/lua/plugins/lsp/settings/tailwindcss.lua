local config_files = {
  "tailwind.config.js",
  "tailwind.config.ts",
  "tailwind.config.cjs",
  "tailwind.config.mjs",
}

return {
  cmd = { "bun", "run", "--bun", "tailwindcss-language-server", "--stdio" },
  on_attach = function(client, bufnr)
    -- only git repo go here
    local config_root = vim.fs.root(bufnr, config_files)
    if config_root then
      return
    end
    client.stop()
  end,
}
