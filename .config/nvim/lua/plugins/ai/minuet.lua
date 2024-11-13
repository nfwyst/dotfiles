function add_cmp_source(source, index)
  local has_cmp, cmp = pcall(require, "cmp")
  if not has_cmp then
    return
  end
  if index == nil then
    index = 1
  end
  local config = cmp.get_config()
  table.insert(config.sources, index, {
    name = source,
  })
  cmp.setup(config)
end

return {
  "milanglacier/minuet-ai.nvim",
  dependencies = {
    { "nvim-lua/plenary.nvim" },
    { "hrsh7th/nvim-cmp" },
  },
  cond = not not os.getenv("DEEPSEEK_API_KEY"),
  event = "InsertEnter",
  config = function()
    add_cmp_source("minuet", 2)
    require("minuet").setup({
      notify = "error",
      request_timeout = 5,
      provider = "openai_fim_compatible",
      provider_options = {
        openai_fim_compatible = {
          model = "deepseek-chat",
          end_point = "https://api.deepseek.com/beta/completions",
          api_key = "DEEPSEEK_API_KEY",
          name = "󱗻",
          stream = true,
          optional = {
            max_tokens = 128,
            stop = { "\n\n" },
          },
        },
      },
    })
  end,
}
