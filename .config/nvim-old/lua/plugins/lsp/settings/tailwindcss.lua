local config_files = {
  'tailwind.config.js',
  'tailwind.config.ts',
  'tailwind.config.cjs',
  'tailwind.config.mjs',
}

local function get_on_attach()
  return function(client, bufnr)
    -- only git repo go here
    local config_root = vim.fs.root(bufnr, config_files)
    if config_root then
      return
    end
    client.stop()
  end
end

return {
  include_filetypes = { 'javascriptreact', 'typescriptreact', 'svelte' },
  on_attach = get_on_attach(),
}
