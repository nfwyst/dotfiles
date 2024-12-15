return {
  settings = {
    Lua = {
      format = {
        enable = false,
      },
      diagnostics = {
        globals = { 'vim', 'require' },
        disable = { 'lowercase-global' },
      },
      runtime = {
        version = 'LuaJIT',
      },
      workspace = {
        checkThirdParty = 'Disable',
        library = {
          [os.getenv('VIMRUNTIME') .. '/lua'] = true,
          [CONFIG_PATH .. '/lua'] = true,
        },
      },
      telemetry = {
        enable = false,
      },
    },
  },
}
