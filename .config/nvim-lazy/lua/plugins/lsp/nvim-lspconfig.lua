return {
  "neovim/nvim-lspconfig",
  opts = function()
    local keys = require("lazyvim.plugins.lsp.keymaps").get()
    assign(keys, {
      { "K", false },
      { "<c-k>", false, mode = "i" },
      {
        "gk",
        function()
          return vim.lsp.buf.hover()
        end,
        desc = "Hover",
      },
    })
  end,
}
