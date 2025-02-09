local function provider_factory(name, _provider_name)
  local config = LLM[name]
  if not config then
    return
  end

  local provider_name = _provider_name

  if not provider_name then
    provider_name = name
  end

  local endpoint
  local ok = pcall(require, "minuet.backends." .. provider_name)

  if not ok then
    provider_name = "openai_compatible"
    endpoint = config.origin .. config.pathname
  end

  if provider_name == "openai_fim_compatible" then
    endpoint = config.origin .. config.fim_pathname
  end

  return {
    model = config.models[2],
    end_point = endpoint,
    api_key = config.api_key,
    name = "󱗻",
    stream = true,
    optional = {
      max_tokens = 256,
      stop = { "\n\n" },
      top_p = 0.9,
      generationConfig = {
        maxOutputTokens = 256,
      },
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
      provider = "openai_compatible",
      n_completions = 1,
      context_window = IS_LINUX and 1024 or 4096,
      cmp = {
        enable_auto_complete = false,
      },
      blink = {
        enable_auto_complete = false,
      },
      proxy = LLM.proxy,
      provider_options = {
        openai_compatible = provider_factory("hyperbolic"),
        openai_fim_compatible = provider_factory("deepseek", "openai_fim_compatible"),
        gemini = provider_factory("gemini"),
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
    })
  end,
}
