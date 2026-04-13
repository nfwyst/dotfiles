--- @type vim.lsp.Config
--- tsgo: TypeScript/JavaScript LSP powered by typescript-go (TS 7.0)
--- Used for pure TS/JS/React projects (non-Vue) for maximum speed.
--- For Vue projects, vtsls is used instead (tsgo lacks Vue plugin support).
local ts_util = require("config.ts_util")

return {
  cmd = { "tsgo", "--lsp", "--stdio" },
  filetypes = {
    "javascript",
    "javascriptreact",
    "javascript.jsx",
    "typescript",
    "typescriptreact",
    "typescript.tsx",
  },
  root_markers = ts_util.root_markers,
  on_new_config = function(new_config, root_dir)
    -- Prefer project-local tsgo for monorepo version consistency
    local local_bin = root_dir .. "/node_modules/.bin/tsgo"
    if vim.uv.fs_stat(local_bin) then
      new_config.cmd = { local_bin, "--lsp", "--stdio" }
    end
  end,
  settings = {
    typescript = {
      inlayHints = {
        enumMemberValues = { enabled = true },
        functionLikeReturnTypes = { enabled = true },
        parameterNames = {
          enabled = "literals",
          suppressWhenArgumentMatchesName = true,
        },
        parameterTypes = { enabled = true },
        propertyDeclarationTypes = { enabled = true },
        variableTypes = { enabled = false },
      },
      suggest = {
        completeFunctionCalls = true,
        autoImports = true,
      },
      preferences = {
        importModuleSpecifier = "shortest",
        preferTypeOnlyAutoImports = true,
      },
    },
  },
}
