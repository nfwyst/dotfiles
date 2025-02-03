local function provider_factory(is_local)
  local local_endpoint = AI.endpoint_ollama_v1 .. AI.chat.pathname

  local opts = {
    model = is_local and AI.model.chat_local or AI.model.chat,
    end_point = is_local and local_endpoint or AI.fim.url,
    api_key = AI.api_key.name,
    name = is_local and "󰈺" or "󱗻",
    stream = true,
    optional = {
      max_tokens = AI.max.fim_tokens,
      stop = { "\n\n" },
      top_p = 0.9,
    },
  }

  return merge(opts, opt)
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
      desc = "Minuet: Togglee Virtual Text",
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
          prev = "<c-k>",
          next = "<c-j>",
          dismiss = "<c-e>",
        },
      },
      proxy = AI.proxy,
    })
  end,
}
