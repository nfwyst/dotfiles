return {
  'JoosepAlviste/nvim-ts-context-commentstring',
  ft = TSX_COMMENT_INCLUDED_FILES,
  config = function()
    require('ts_context_commentstring').setup({
      enable_autocmd = false,
      languages = {},
    })
    local get_option = vim.filetype.get_option
    ---@diagnostic disable: duplicate-set-field
    vim.filetype.get_option = function(filetype, option)
      if option == 'commentstring' then
        return require('ts_context_commentstring.internal').calculate_commentstring()
      end
      return get_option(filetype, option)
    end
  end,
}
