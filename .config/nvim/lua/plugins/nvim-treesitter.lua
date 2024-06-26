local function bind_ft()
  local map = {
    zsh = "bash",
  }
  for key, value in pairs(map) do
    vim.treesitter.language.register(value, key)
  end
end

return {
  "nvim-treesitter/nvim-treesitter",
  cond = not IS_VSCODE,
  event = { "BufReadPost", "BufNewFile", "CmdlineEnter" },
  cmd = {
    "TSUpdate",
    "TSUpdateSync",
    "TSInstall",
    "TSBufEnable",
    "TSBufDisable",
    "TSModuleInfo",
  },
  dependencies = {
    "nushell/tree-sitter-nu",
  },
  config = function()
    local configs = require("nvim-treesitter.configs")
    local install = require("nvim-treesitter.install")
    install.prefer_git = false
    configs.setup({
      ensure_installed = TREESITTER_ENSURE_INSTALL, -- one of "all" or a list of languages
      sync_install = false,
      auto_install = true,
      highlight = {
        enable = true, -- false will disable the whole extension
        additional_vim_regex_highlighting = { "markdown" },
      },
      autopairs = {
        enable = true,
      },
      indent = { enable = true },
    })
    bind_ft()
  end,
}
