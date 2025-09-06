return {
  "milanglacier/minuet-ai.nvim",
  dependencies = { "nvim-lua/plenary.nvim" },
  config = function()
    require("minuet").setup({
      notify = "error",
      blink = { enable_auto_complete = false },
      provider = "openai_fim_compatible",
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
          -- accept whole completion
          accept = "<A-A>",
          -- accept one line
          accept_line = "<A-a>",
          -- accept n lines (prompts for number)
          accept_n_lines = "<A-z>",
          -- Cycle to prev completion item, or manually invoke completion
          prev = "<A-[>",
          -- Cycle to next completion item, or manually invoke completion
          next = "<A-]>",
          dismiss = "<A-e>",
        },
        show_on_completion_menu = false,
      },
    })
  end,
}
