return {
  'milanglacier/minuet-ai.nvim',
  cmd = { 'MinuetToggleVirtualText', 'MinuetToggleCmp' },
  dependencies = {
    { 'nvim-lua/plenary.nvim' },
  },
  cond = HAS_API_KEY,
  config = function()
    require('minuet').setup({
      notify = false,
      provider = 'openai_fim_compatible',
      provider_options = {
        openai_fim_compatible = {
          model = 'deepseek-chat',
          end_point = 'https://api.deepseek.com/beta/completions',
          api_key = 'DEEPSEEK_API_KEY',
          name = '󱗻',
          stream = true,
          optional = {
            max_tokens = 256,
            stop = { '\n\n' },
          },
        },
      },
      virtualtext = {
        keymap = {
          accept = '<c-a>',
          accept_line = '<c-y>',
          prev = '<c-v>',
          next = '<c-x>',
          dismiss = '<c-s>',
        },
      },
    })
  end,
}
