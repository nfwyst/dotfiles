return {
  "JoosepAlviste/nvim-ts-context-commentstring",
  ft = TSX_COMMENT_INCLUDED_FILES,
  config = function()
    ---@diagnostic disable: missing-fields
    require("ts_context_commentstring").setup({
      enable_autocmd = false,
      languages = {},
    })
    local get_option = vim.filetype.get_option
    -- rewrite neovim comment for tsx/jsx
    ---@diagnostic disable: duplicate-set-field
    vim.filetype.get_option = function(filetype, option)
      return option == "commentstring"
          and require("ts_context_commentstring.internal").calculate_commentstring()
        or get_option(filetype, option)
    end
  end,
}
