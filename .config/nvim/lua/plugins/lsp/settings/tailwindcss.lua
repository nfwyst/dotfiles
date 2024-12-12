local config_files = {
  'tailwind.config.js',
  'tailwind.config.ts',
  'tailwind.config.cjs',
  'tailwind.config.mjs',
}

local function get_on_attach()
  local cache = {}
  return function(client)
    -- only git repo go here
    local from = GET_WORKSPACE_PATH()
    local to = GET_GIT_PATH()
    local key = from .. ':' .. to

    local should_stop = cache[key]
    if should_stop then
      return client.stop()
    end

    cache[key] = not LOOKUP_FILE_PATH(config_files, from, to)
    if cache[key] then
      client.stop()
    end
  end
end

return {
  include_filetypes = { 'javascriptreact', 'typescriptreact', 'svelte' },
  on_attach = get_on_attach(),
}
