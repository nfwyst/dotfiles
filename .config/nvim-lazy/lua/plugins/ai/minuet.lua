local function provider_factory(is_ollama)
  local local_endpoint = AI.endpoint_ollama_v1 .. AI.chat.pathname

  return {
    model = is_ollama and AI.model.chat_ollama or AI.model.chat,
    end_point = is_ollama and local_endpoint or AI.fim.url,
    api_key = is_ollama and AI.api_key.name_ollama or AI.api_key.name,
    name = is_ollama and "󰈺" or "󱗻",
    stream = true,
    optional = {
      max_tokens = AI.max.fim_tokens,
      stop = { "\n\n" },
      top_p = 0.9,
    },
  }
end

local provider_names = { "openai_fim_compatible", "openai_compatible" }

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
      desc = "Minuet: Toggle Virtual Text",
      mode = { "n", "v" },
    },
    {
      "<leader>amp",
      function()
        REQUEST_USER_SELECT(provider_names, "select provider: ", function(name)
          cmd("Minuet change_provider " .. name)
        end)
      end,
      desc = "Minuet: Switch Provider",
    },
  },
  dependencies = {
    { "nvim-lua/plenary.nvim" },
  },
  cond = HAS_AI_KEY,
  config = function()
    require("minuet").setup({
      notify = "error",
      request_timeout = 5,
      provider = "openai_fim_compatible",
      n_completions = 1,
      context_window = IS_LINUX and 1024 or 4096,
      cmp = {
        enable_auto_complete = false,
      },
      blink = {
        enable_auto_complete = false,
      },
      provider_options = {
        openai_fim_compatible = provider_factory(),
        openai_compatible = provider_factory(true),
      },
      virtualtext = {
        keymap = {
          accept = "<c-a>",
          accept_line = "<c-l>",
          accept_n_lines = "<c-z>",
          prev = "<c-k>",
          next = "<c-j>",
          dismiss = "<c-e>",
        },
        show_on_completion_menu = false,
      },
      proxy = AI.proxy,
    })
  end,
}
