return {
  "neovim/nvim-lspconfig",
  opts = function()
    local keys = require("lazyvim.plugins.lsp.keymaps").get()
    keys[#keys + 1] = { "K", false }
    keys[#keys + 1] = { "<c-k>", false, mode = "i" }
    keys[#keys + 1] = {
      "gk",
      function()
        return vim.lsp.buf.hover()
      end,
      desc = "Hover",
    }
  end,
}
