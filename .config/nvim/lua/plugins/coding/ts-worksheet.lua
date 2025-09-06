return {
  "typed-rocks/ts-worksheet-neovim",
  keys = {
    {
      "<leader>ce",
      function()
        local bufnr = vim.api.nvim_get_current_buf()
        if vim.api.nvim_get_option_value("modified", { buf = bufnr }) then
          vim.cmd.write()
        end

        local opt = { bufnr = bufnr }
        if not vim.diagnostic.is_enabled(opt) then
          vim.diagnostic.enable(true, opt)
        end

        -- //? only show specified line output
        -- //ts-worksheet auto run when save file
        vim.cmd.Tsw("rt=bun show_order=true")
      end,
      ft = {
        "javascript",
        "typescript",
        "javascriptreact",
        "typescriptreact",
      },
      desc = "Run this js/ts file",
    },
  },
  opts = {
    severity = vim.diagnostic.severity.INFO,
  },
}
