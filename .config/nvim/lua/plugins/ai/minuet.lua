return {
  "milanglacier/minuet-ai.nvim",
  dependencies = { "nvim-lua/plenary.nvim" },
  opts = {
    notify = "error",
    blink = { enable_auto_complete = false },
    provider = "openai_fim_compatible",
    context_window = 48000,
    context_ratio = 0.5,
    throttle = 600,
    debounce = 200,
    request_timeout = 8,
    add_single_line_entry = false,
    n_completions = 10,
    after_cursor_filter_length = 3,
    before_cursor_filter_length = 1,
    provider_options = {
      openai_fim_compatible = {
        model = "deepseek-chat",
        end_point = "https://api.deepseek.com/beta/completions",
        api_key = "DEEPSEEK_API_KEY",
        name = "󱗻",
        stream = true,
        template = {
          prompt = function(context_before_cursor, _, _)
            local utils = require("minuet.utils")
            local language = utils.add_language_comment()
            local tab = utils.add_tab_comment()
            local long_completion_hint = "\n-- Generate longer, more complete code completions with multiple lines\n"
            context_before_cursor = language .. "\n" .. tab .. long_completion_hint .. "\n" .. context_before_cursor
            return context_before_cursor
          end,
          suffix = function(_, context_after_cursor, _)
            return context_after_cursor
          end,
        },
        optional = {
          max_tokens = 4096,
          top_p = 0.99,
          temperature = 0.9,
          stop = { "\n\n\n\n" },
        },
      },
    },
    virtualtext = {
      keymap = {
        -- accept whole completion
        accept = "<A-a>",
        -- accept one line
        accept_line = "<A-l>",
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
  },
}
