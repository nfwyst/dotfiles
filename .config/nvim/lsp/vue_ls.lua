--- @type vim.lsp.Config
--- vue-language-server: Vue SFC (.vue) language support
--- Provides template type-checking, <style> intellisense, and Vue-specific features.
--- Works alongside vtsls in Vue projects (hybrid mode).
--- Note: Volar 2.x uses hybrid mode by default, so no explicit setting needed.
return {
  cmd = { "vue-language-server", "--stdio" },
  filetypes = { "vue" },
  root_markers = { "vue.config.js", "vue.config.ts", "nuxt.config.js", "nuxt.config.ts", "package.json" },
  init_options = {
    typescript = {
      -- Resolve tsdk dynamically from Mason-installed vtsls bundle.
      -- vue-language-server needs this to provide TypeScript intellisense
      -- inside <script> blocks. Falls back to empty string (server will
      -- try to locate TypeScript from the project's node_modules).
      tsdk = (function()
        local lib = "/mason/packages/vtsls/node_modules/@vtsls/language-server/node_modules/typescript/lib"
        local p = vim.fn.stdpath("data") .. lib
        if vim.fn.isdirectory(p) == 1 then
          return p
        end
        return ""
      end)(),
    },
  },
}
