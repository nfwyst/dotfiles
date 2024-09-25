return {
  settings = {
    Lua = {
      format = {
        enable = false,
      },
      diagnostics = {
        globals = { "vim" },
        disable = { "lowercase-global" },
      },
      runtime = {
        version = "LuaJIT",
      },
      workspace = {
        checkThirdParty = "Disable",
        library = {
          [os.getenv("VIMRUNTIME") .. "/lua"] = true,
          [CONFIG_PATH .. "/lua"] = true,
        },
      },
      telemetry = {
        enable = false,
      },
    },
  },
}
