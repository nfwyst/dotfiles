return {
  'milanglacier/minuet-ai.nvim',
  cmd = { 'MinuetToggleVirtualText', 'MinuetToggleCmp' },
  dependencies = {
    { 'nvim-lua/plenary.nvim' },
  },
  cond = HAS_API_KEY,
  config = function()
    ADD_CMP_SOURCE('minuet', { priority = 9 })
    require('minuet').setup({
      notify = false,
      provider = 'openai_fim_compatible',
      cmp = {
        enable_auto_complete = false,
      },
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
