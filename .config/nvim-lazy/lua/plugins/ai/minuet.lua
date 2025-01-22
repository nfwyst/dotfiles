return {
  "milanglacier/minuet-ai.nvim",
  cmd = { "Minuet" },
  keys = {
    {
      "<leader>am",
      "",
      desc = "Minuet",
      mode = { "n", "v" },
    },
    {
      "<leader>amt",
      "<cmd>Minuet virtualtext toggle<cr>",
      desc = "Minuet Togglee Virtual Text",
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
          model = AI.model.default,
          end_point = AI.fim.url,
          api_key = AI.api_key.name,
          name = "󱗻",
          stream = true,
          optional = {
            max_tokens = AI.max.fim_tokens,
            stop = { "\n\n" },
            top_p = 0.9,
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
