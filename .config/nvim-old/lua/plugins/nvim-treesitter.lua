local function bind_ft()
  local map = {
    zsh = 'bash',
  }
  for key, value in pairs(map) do
    vim.treesitter.language.register(value, key)
  end
end

local function disable(_, bufnr)
  return IS_BIG_FILE(bufnr, 0.1)
end

return {
  'nvim-treesitter/nvim-treesitter',
  event = { 'BufReadPost', 'BufNewFile', 'CmdlineEnter' },
  cmd = {
    'TSUpdate',
    'TSUpdateSync',
    'TSInstall',
    'TSBufEnable',
    'TSBufDisable',
    'TSModuleInfo',
  },
  config = function()
    local configs = require('nvim-treesitter.configs')
    local install = require('nvim-treesitter.install')
    install.prefer_git = false
    configs.setup({
      ensure_installed = TREESITTER_ENSURE_INSTALL, -- one of "all" or a list of languages
      ignore_install = not IS_MAC and { 'nu' },
      sync_install = false,
      auto_install = true,
      illuminate = { disable = disable },
      autotag = { disable = disable },
      incremental_selection = { disable = disable },
      highlight = {
        enable = true, -- false will disable the whole extension
        disable = disable,
        additional_vim_regex_highlighting = { 'markdown' },
      },
      autopairs = { enable = true },
      indent = { enable = true, disable = disable },
    })
    bind_ft()
  end,
}
