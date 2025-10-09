local util = require("config.util")
local constant = require("config.constant")
local eslintd = { "eslint_d" }

vim.env.ESLINT_D_PPID = vim.fn.getpid()

return {
  "mfussenegger/nvim-lint",
  opts = function(_, opts)
    local eslinter = require("lint").linters.eslint_d
    vim.list_extend(eslinter.args, {
      "--config",
      function()
        return util.get_file_path(constant.ESLINT, { for_eslint = true, ensure_package = true })
      end,
    })

    local opt = {
      linters_by_ft = {
        javascript = eslintd,
        typescript = eslintd,
        typescriptreact = eslintd,
        javascriptreact = eslintd,
        svelte = eslintd,
        sh = { "bash" },
        zsh = { "zsh" },
        markdown = { "vale" },
      },
    }

    return vim.tbl_deep_extend("force", opts, opt)
  end,
}
