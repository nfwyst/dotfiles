local mode = { "n", "v" }
local is_default_prompt = true

local function actions()
  return require("codecompanion").actions({
    provider = { name = "default", opts = { prompt = "Select Action: " } },
  })
end

local function toggle_prompt()
  is_default_prompt = not is_default_prompt
end

local function adapter_factory(model, adapter, opt)
  opt = opt or {}
  adapter = adapter or "deepseek"

  local adapters = require("codecompanion.adapters")
  local opts = {
    env = {
      url = AI.endpoint,
      chat_url = AI.chat.pathname,
      api_key = AI.api_key.name,
    },
    schema = {
      model = {
        default = model,
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
  }

  return function()
    return adapters.extend(adapter, merge(opts, opt))
  end
end

return {
  "olimorris/codecompanion.nvim",
  cond = HAS_AI_KEY,
  cmd = { "CodeCompanion", "CodeCompanionChat" },
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
  init = function()
    cmd.cab("cc CodeCompanion")
    cmd.cab("ccc CodeCompanionChat")
  end,
  keys = {
    { "<leader>ac", "", desc = "CodeCompanion", mode = mode },
    { "<leader>acc", "<cmd>CodeCompanionChat Toggle<CR>", desc = "CodeCompanion: Toggle Chat", mode = mode },
    { "<leader>aca", "<cmd>CodeCompanionChat Add<cr>", desc = "CodeCompanion: Add Code Snip To Chat", mode = "v" },
    { "<leader>aco", actions, desc = "CodeCompanion: Open Actions Menu", mode = mode },
    { "<leader>aci", "<cmd>CodeCompanion<cr>", desc = "CodeCompanion: Inline Prompt", mode = mode },
    { "<leader>acb", "<cmd>CodeCompanion /buffer<cr>", desc = "CodeCompanion: Chat With Buffer" },
    { "<leader>acd", "<cmd>CodeCompanion /doc<cr>", desc = "CodeCompanion: Gen Documentation", mode = "v" },
    { "<leader>acm", "<cmd>CodeCompanion /scommit<cr>", desc = "CodeCompanion: Commit Staged Message" },
    { "<leader>acg", "<cmd>CodeCompanion /commit<cr>", desc = "CodeCompanion: Commit Message" },
    { "<leader>ace", "<cmd>CodeCompanion /explain<cr>", desc = "CodeCompanion: Explain Code", mode = "v" },
    { "<leader>acl", "<cmd>CodeCompanion /lsp<cr>", desc = "CodeCompanion: Explain LSP Diagnostics", mode = mode },
    { "<leader>acf", "<cmd>CodeCompanion /fix<cr>", desc = "CodeCompanion: Fix Code", mode = "v" },
    { "<leader>acp", "<cmd>CodeCompanion /pr<cr>", desc = "CodeCompanion: PR Message" },
    { "<leader>acr", "<cmd>CodeCompanion /refactor<cr>", desc = "CodeCompanion: Refactor Code Snip", mode = "v" },
    { "<leader>acs", "<cmd>CodeCompanion /spell<cr>", desc = "CodeCompanion: Check Spell", mode = "v" },
    { "<leader>acu", "<cmd>CodeCompanion /tests<cr>", desc = "CodeCompanion: Write Tests For Code Snip", mode = "v" },
    { "<leader>acv", "<cmd>CodeCompanion /review<cr>", desc = "CodeCompanion: Review Code Snip", mode = "v" },
    { "<leader>acn", "<cmd>CodeCompanion /naming<cr>", desc = "CodeCompanion: Better Naming", mode = "v" },
    { "<leader>act", toggle_prompt, desc = "CodeCompanion: TogglePrompt" },
  },
  config = function()
    -- hide left columns for code companion sidebar
    if not FILETYPE_TASK_MAP.codecompanion then
      FILETYPE_TASK_MAP.codecompanion = function(_, win)
        if WIN_VAR(win, TASK_KEY) then
          return
        end
        defer(function()
          SET_OPTS(COLUMN_OPTS(false), { win = win })
          WIN_VAR(win, TASK_KEY, true)
        end, 10)
      end
    end

    local system_prompt = require("codecompanion.config").config.opts.system_prompt

    require("codecompanion").setup({
      strategies = {
        chat = {
          adapter = "deepseek",
          keymaps = {
            clear = {
              modes = {
                n = "gX",
              },
            },
            system_prompt = {
              modes = {
                n = "gS",
              },
            },
            completion = {
              modes = {
                i = "<C-m>",
              },
            },
            codeblock = {
              modes = {
                n = "gC",
              },
            },
          },
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
        deepseek = adapter_factory(AI.model.thinking),
        deepseek_chat = adapter_factory(AI.model.chat),
        deepseek_ollama = adapter_factory(AI.model.thinking, "ollama", {
          schema = {
            model = { default = "deepseek-r1:32b" },
          },
          env = {
            url = AI.endpoint_ollama,
          },
        }),
      },
      display = {
        diff = {
          enabled = true,
        },
        chat = {
          window = {
            width = 0.3,
          },
        },
      },
      prompt_library = require("features.codecompanion-prompt-lib"),
    })
  end,
}
