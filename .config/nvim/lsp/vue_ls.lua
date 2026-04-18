--- @type vim.lsp.Config
--- vue-language-server: Vue SFC (.vue) language support
--- Provides template type-checking, <style> intellisense, and Vue-specific features.
--- Works alongside vtsls in Vue projects (hybrid mode).
--- Note: Volar 2.x uses hybrid mode by default, so no explicit setting needed.
local ts_util = require("config.ts_util")

return {
  cmd = { "vue-language-server", "--stdio" },
  filetypes = { "vue" },
  root_markers = { "vue.config.js", "vue.config.ts", "nuxt.config.js", "nuxt.config.ts", "package.json" },
  -- In hybrid mode (Volar 2.x default), vtsls handles TS features via
  -- @vue/typescript-plugin. Disable vue_ls capabilities that overlap with
  -- vtsls to prevent duplicate/slow responses in Snacks picker LSP sources.
  on_attach = function(client)
    -- Let vtsls handle these — vue_ls responses are slower and redundant
    client.server_capabilities.definitionProvider = false
    client.server_capabilities.referencesProvider = false
    client.server_capabilities.implementationProvider = false
    client.server_capabilities.typeDefinitionProvider = false
    client.server_capabilities.renameProvider = false
  end,
  init_options = {
    typescript = {
      tsdk = ts_util.mason_tsdk() or "",
    },
  },
}
