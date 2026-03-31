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
  get_language_id = function(bufnr, filetype)
    -- Tell vtsls to treat MDX as native TSX so tsserver provides completions
    -- without relying on @mdx-js/typescript-plugin (which has a completion bug:
    -- "reduce of empty array with no initial value" from its acorn parser).
    if filetype == "mdx" then return "typescriptreact" end
    return filetype
  end,
  on_attach = function(client, bufnr)
    if vim.bo[bufnr].filetype == "mdx" then
      -- MDX contains markdown prose that generates false positive TS parse
      -- errors when treated as TSX. Suppress vtsls diagnostics for MDX.
      local ns = vim.lsp.diagnostic.get_namespace(client.id)
      vim.diagnostic.enable(false, { bufnr = bufnr, ns_id = ns })
    end
  end,
  settings = {
    typescript = {
      npm = bun_path,
      tsdk = tsdk,
      tsserver = { maxTsServerMemory = 1024 * 32, nodePath = bun_path },
    },
    vtsls = {
      typescript = { globalTsdk = tsdk },
      experimental = {
        maxInlayHintLength = 25,
        completion = { enableServerSideFuzzyMatch = true },
        enableProjectDiagnostics = true,
      },
    },
  },
}
