local config_files = {
  "tailwind.config.js",
  "tailwind.config.ts",
  "tailwind.config.cjs",
  "tailwind.config.mjs",
}

local function no_tailwind_config(from, to)
  return not LOOKUP_FILE_PATH(config_files, from, to)
end

local function get_on_attach()
  local cache = {}
  return function(client)
    local from = GET_WORKSPACE_PATH()
    local to = GET_GIT_PATH()

    local key = from .. ":" .. to

    local result = cache[key]
    if result ~= nil then
      if result then
        client.stop()
      end
      return
    end

    local should_stop = no_tailwind_config(from, to)
    cache[key] = should_stop
    if should_stop then
      client.stop()
    end
  end
end

return {
  include_filetypes = { "javascriptreact", "typescriptreact", "svelte" },
  on_attach = get_on_attach(),
}
