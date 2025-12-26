local lib = "/mason/packages/vtsls/node_modules/@vtsls/language-server/node_modules/typescript/lib"
local tsdk_path = vim.fn.stdpath("data") .. lib
local tsdk = nil
if vim.fn.isdirectory(tsdk_path) == 1 then
  tsdk = tsdk_path
end
local bun_path = vim.fn.exepath("bun")

return {
  cmd = { "bun", "run", "--bun", "vtsls", "--stdio" },
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
