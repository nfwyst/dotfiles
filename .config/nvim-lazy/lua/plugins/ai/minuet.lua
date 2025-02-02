local function provider_factory(opt)
  local opts = {
    model = AI.model.chat,
    end_point = AI.fim.url,
    api_key = AI.api_key.name,
    name = "󱗻",
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
      provider = "openai_fim_compatible",
      cmp = {
        enable_auto_complete = false,
      },
      blink = {
        enable_auto_complete = false,
      },
      provider_options = {
        openai_fim_compatible = provider_factory(),
        openai_compatible = provider_factory({
          name = "󰈺",
          end_point = AI.endpoint_ollama .. AI.chat.pathname_ollama,
          model = "deepseek-coder-v2",
        }),
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
