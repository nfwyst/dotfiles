return {
  "milanglacier/minuet-ai.nvim",
  cmd = { "MinuetToggleVirtualText" },
  keys = {
    {
      "<leader>am",
      "<cmd>MinuetToggleVirtualText<cr>",
      desc = "Toggle Minuet",
      mode = { "n", "v" },
    },
  },
  dependencies = {
    { "nvim-lua/plenary.nvim" },
  },
  cond = HAS_AI_KEY,
  config = function()
    require("minuet").setup({
      notify = false,
      provider = "openai_fim_compatible",
      cmp = {
        enable_auto_complete = false,
      },
      provider_options = {
        openai_fim_compatible = {
          model = "deepseek-chat",
          end_point = "https://api.deepseek.com/beta/completions",
          api_key = "DEEPSEEK_API_KEY",
          name = "󱗻",
          stream = true,
          optional = {
            max_tokens = 256,
            stop = { "\n\n" },
          },
        },
      },
      virtualtext = {
        keymap = {
          accept = "<c-a>",
          accept_line = "<c-l>",
          prev = "<c-k>",
          next = "<c-j>",
          dismiss = "<c-e>",
        },
      },
    })
  end,
}
