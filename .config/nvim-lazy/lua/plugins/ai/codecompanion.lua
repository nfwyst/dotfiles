local mode = { "n", "v" }
local is_default_prompt = true

return {
  "olimorris/codecompanion.nvim",
  cond = HAS_AI_KEY,
  dependencies = {
    "nvim-lua/plenary.nvim",
    "nvim-treesitter/nvim-treesitter",
    {
      "nvim-lualine/lualine.nvim",
      module = false,
      opts = function(_, opts)
        PUSH(opts.sections.lualine_x, require("features.lualine.components").codecompanion)
      end,
    },
    {
      "saghen/blink.cmp",
      module = false,
      opts = function(_, opts)
        local sources = opts.sources
        if not sources.per_filetype then
          sources.per_filetype = {}
        end
        sources.per_filetype.codecompanion = { "codecompanion" }
      end,
    },
  },
  keys = {
    { "<leader>ac", "", desc = "CodeCompanion", mode = mode },
    {
      "<leader>acc",
      function()
        return require("codecompanion").chat({ fargs = { "deepseek" } })
      end,
      "<cmd>CodeCompanionChat deepseek<CR>",
      desc = "CodeCompanion Chat",
      mode = mode,
    },
    {
      "<leader>acM",
      function()
        return require("codecompanion").actions({
          provider = { name = "default", opts = { prompt = "Select Action: " } },
        })
      end,
      desc = "CodeCompanion Actions",
      mode = mode,
    },
    {
      "<leader>acm",
      "",
      desc = "CodeCompanion Quick Actions",
      mode = mode,
    },
    { "<leader>acme", "<cmd>CodeCompanion /explain<cr>", desc = "Explain Code", mode = "v" },
    { "<leader>acmE", "<cmd>CodeCompanion /lsp<cr>", desc = "Explain The LSP Diagnostics", mode = "v" },
    { "<leader>acmf", "<cmd>CodeCompanion /fix<cr>", desc = "Fix Code", mode = "v" },
    { "<leader>acmc", "<cmd>CodeCompanion /commit<cr>", desc = "Generate Commit" },
    {
      "<leader>act",
      function()
        return require("codecompanion").toggle()
      end,
      desc = "CodeCompanion Toggle",
      mode = mode,
    },
    {
      "<leader>aca",
      function()
        return require("codecompanion").add({})
      end,
      desc = "CodeCompanion Add",
      mode = { "v" },
    },
    {
      "<leader>acT",
      function()
        is_default_prompt = not is_default_prompt
      end,
      desc = "TogglePrompt",
    },
  },
  config = function()
    local system_prompt = require("codecompanion.config").config.opts.system_prompt
    require("codecompanion").setup({
      strategies = {
        chat = {
          adapter = "deepseek",
        },
        inline = {
          adapter = "deepseek",
        },
        agent = {
          adapter = "deepseek",
        },
      },
      opts = {
        language = "Chinese",
        log_level = "ERROR",
        send_code = true,
        system_prompt = function(...)
          return is_default_prompt and system_prompt(...) or PROMPT
        end,
      },
      adapters = {
        opts = {
          allow_insecure = false,
          proxy = AI.proxy,
        },
        deepseek = function()
          return require("codecompanion.adapters").extend("openai_compatible", {
            env = {
              url = AI.endpoint,
              chat_url = AI.chat.pathname,
              api_key = AI.api_key.name,
            },
            schema = {
              model = {
                default = AI.model.default,
                choices = AI.model.list,
              },
              num_ctx = {
                default = AI.max.context,
              },
              max_tokens = {
                default = AI.max.tokens,
              },
              temperature = {
                default = AI.temperature,
              },
            },
          })
        end,
      },
      display = {
        diff = {
          enabled = true,
        },
      },
    })
  end,
}
