--- @type vim.lsp.Config
--- tsgo: TypeScript/JavaScript LSP powered by typescript-go (TS 7.0)
--- Used for pure TS/JS/React projects (non-Vue) for maximum speed.
--- For Vue projects, vtsls is used instead (tsgo lacks Vue plugin support).
local ts_util = require("config.ts_util")

-- Prefer project-local tsgo (monorepo version consistency)
local function get_cmd(dispatched_bufnr)
  local root = vim.fs.root(dispatched_bufnr, ts_util.root_markers)
  if root then
    local local_bin = root .. "/node_modules/.bin/tsgo"
    if vim.uv.fs_stat(local_bin) then
      return { local_bin, "--lsp", "--stdio" }
    end
  end
  return { "tsgo", "--lsp", "--stdio" }
end

return {
  cmd = get_cmd,
  filetypes = {
    "javascript",
    "javascriptreact",
    "javascript.jsx",
    "typescript",
    "typescriptreact",
    "typescript.tsx",
  },
  root_markers = ts_util.root_markers,
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
