--- @type vim.lsp.Config
return {
  cmd = { "lua-language-server" },
  filetypes = { "lua" },
  root_markers = { ".luarc.jsonc", ".luacheckrc", ".stylua.toml", "stylua.toml", ".git" },
  settings = {
    Lua = {
      workspace = {
        checkThirdParty = false,
      },
      codeLens = {
        enable = true,
      },
      completion = {
        callSnippet = "Replace",
      },
      doc = {
        privateName = { "^_" },
      },
      hint = {
        enable = true,
        setType = false,
        paramType = true,
        paramName = "Disable",
        semicolon = "Disable",
        arrayIndex = "Disable",
      },
      diagnostics = {
        globals = { "vim", "require", "Snacks" },
        disable = { "duplicate-set-field" },
      },
      telemetry = { enable = false },
    },
  },
}
