--- @type vim.lsp.Config
return {
  cmd = { "solc", "--lsp" },
  filetypes = { "solidity" },
  root_markers = { "hardhat.config.js", "hardhat.config.ts", "foundry.toml", "remappings.txt", "truffle-config.js", ".git" },
}
