return {
  settings = {
    Lua = {
      workspace = {
        checkThirdParty = false,
      },
      diagnostics = {
        globals = {},
        disable = {},
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
      telemetry = {
        enable = false,
      },
    },
  },
}
