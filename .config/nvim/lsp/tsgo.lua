--- @type vim.lsp.Config
--- tsgo: TypeScript/JavaScript LSP powered by typescript-go (TS 7.0)
--- Used for pure TS/JS/React projects (non-Vue) for maximum speed.
--- For Vue projects, vtsls is used instead (tsgo lacks Vue plugin support).
--- For projects with non-trivial baseUrl, vtsls is used (tsgo dropped baseUrl).
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
  -- Use root_dir function to prevent tsgo from starting in projects where
  -- vtsls should be used. This avoids the "start then kill" pattern that
  -- causes "exit code 1" errors.
  root_dir = function(bufnr, cb)
    local root = vim.fs.root(bufnr, ts_util.root_markers)
    if not root then
      return
    end
    -- Skip: Deno projects (handled by Deno LSP)
    if ts_util.is_deno_project(root) then
      return
    end
    -- Skip: Vue projects (need vtsls for @vue/typescript-plugin)
    if ts_util.is_vue_project(root) then
      return
    end
    -- Skip: projects with non-trivial baseUrl (tsgo dropped baseUrl support)
    if ts_util.needs_baseurl_fallback(root) then
      return
    end
    cb(root)
  end,
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
