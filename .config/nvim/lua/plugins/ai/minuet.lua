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

function get_proxy_port()
  local proxy = os.getenv("http_proxy")
  if not proxy then
    return nil
  end
  local url_parts = vim.split(proxy, ":")
  local port = url_parts[3]
  return port
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
      proxy = get_proxy_port(),
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
