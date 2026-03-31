--- @type vim.lsp.Config
local lib = "/mason/packages/vtsls/node_modules/@vtsls/language-server/node_modules/typescript/lib"
local tsdk_path = vim.fn.stdpath("data") .. lib
local tsdk = nil
if vim.fn.isdirectory(tsdk_path) == 1 then
  tsdk = tsdk_path
end
local bun_path = vim.fn.exepath("bun")

return {
  cmd = { "bun", "run", "--bun", "vtsls", "--stdio" },
  filetypes = { "javascript", "javascriptreact", "javascript.jsx", "typescript", "typescriptreact", "typescript.tsx", "mdx" },
  root_markers = { "tsconfig.json", "package.json", "jsconfig.json", ".git" },
  settings = {
    typescript = {
      npm = bun_path,
      tsdk = tsdk,
      tsserver = { maxTsServerMemory = 1024 * 32, nodePath = bun_path },
    },
    vtsls = {
      typescript = { globalTsdk = tsdk },
      tsserver = {
        globalPlugins = {
          {
            name = "@mdx-js/typescript-plugin",
            location = vim.fn.stdpath("data")
              .. "/mason/packages/vtsls/node_modules/@mdx-js/typescript-plugin",
            languages = { "mdx" },
            enableForWorkspaceTypeScriptVersions = true,
          },
        },
      },
      experimental = {
        maxInlayHintLength = 25,
        completion = { enableServerSideFuzzyMatch = true },
        enableProjectDiagnostics = true,
      },
    },
  },
}
