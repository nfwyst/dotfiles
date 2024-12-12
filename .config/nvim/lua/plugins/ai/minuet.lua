return {
  'milanglacier/minuet-ai.nvim',
  dependencies = {
    { 'nvim-lua/plenary.nvim' },
    { 'hrsh7th/nvim-cmp' },
  },
  cond = HAS_API_KEY,
  event = 'InsertEnter',
  config = function()
    ADD_CMP_SOURCE('minuet', { priority = 9, max_item_count = 1 })
    require('minuet').setup({
      notify = 'error',
      n_completions = 1,
      provider = 'openai_fim_compatible',
      provider_options = {
        openai_fim_compatible = {
          model = 'deepseek-chat',
          end_point = 'https://api.deepseek.com/beta/completions',
          api_key = 'DEEPSEEK_API_KEY',
          name = '󱗻',
          stream = true,
          optional = {
            max_tokens = 128,
            stop = { '\n' },
          },
        },
      },
    })
  end,
}
