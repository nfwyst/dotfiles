local mode = { "n", "v" }
local prompt

local function actions()
  return require("codecompanion").actions({
    provider = { name = "default", opts = { prompt = "Select Action: " } },
  })
end

local function change_prompt()
  SELECT_PROMPT(function(selected_prompt)
    prompt = selected_prompt
  end)
end

local function adapter_factory(name)
  local config = LLM[name]
  if not config then
    return
  end

  local url
  local chat_url
  local require_base = "codecompanion.adapters"
  local adapters = require(require_base)
  local adapter_name = name
  local ok = pcall(require, require_base .. "." .. adapter_name)

  if not ok then
    adapter_name = "openai_compatible"
    url = config.origin
    chat_url = config.pathname
  end

  local models = {}
  for _, model in ipairs(config.models) do
    if contains(REASONABLE_MODELS, model) then
      models[model] = { opts = { can_reason = true } }
    else
      PUSH(models, model)
    end
  end

  return function()
    return adapters.extend(adapter_name, {
      name = name,
      env = {
        api_key = config.api_key,
        url = url,
        chat_url = chat_url,
      },
      schema = {
        model = {
          default = config.model,
          choices = models,
        },
        temperature = {
          order = 2,
          mapping = "parameters.options",
          type = "number",
          optional = true,
          default = LLM.temperature,
          desc = "What sampling temperature to use, between 0 and 2. Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic. We generally recommend altering this or top_p but not both.",
          validate = function(n)
            return n >= 0 and n <= 2, "Must be between 0 and 2"
          end,
        },
        num_ctx = {
          order = 3,
          mapping = "parameters.options",
          type = "number",
          optional = true,
          default = config.num_ctx,
          desc = "The maximum number of tokens that the language model can consider at once. This determines the size of the input context window, allowing the model to take into account longer text passages for generating responses. Adjusting this value can affect the model's performance and memory usage.",
          validate = function(n)
            return n > 0, "Must be a positive number"
          end,
        },
        max_tokens = {
          order = 4,
          mapping = "parameters",
          type = "integer",
          optional = true,
          default = config.max_tokens,
          desc = "The maximum number of tokens to generate in the chat completion. The total length of input tokens and generated tokens is limited by the model's context length.",
          validate = function(n)
            return n > 0, "Must be greater than 0"
          end,
        },
      },
    })
  end
end

return {
  "olimorris/codecompanion.nvim",
  cond = HAS_AI_KEY,
  cmd = { "CodeCompanion", "CodeCompanionChat" },
  dependencies = {
    "nvim-lua/plenary.nvim",
    "nvim-treesitter/nvim-treesitter",
    "saghen/blink.cmp",
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
    { "<leader>acm", "<cmd>CodeCompanion /staged-commit<cr>", desc = "CodeCompanion: Commit Staged Message" },
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
    { "<leader>act", change_prompt, desc = "CodeCompanion: Change Prompt" },
  },
  config = function()
    ADD_LUALINE_COMPONENT("lualine_x", require("features.lualine.components").codecompanion)

    -- hide left columns for code companion sidebar
    if not FILETYPE_TASK_MAP.codecompanion then
      FILETYPE_TASK_MAP.codecompanion = function(_, win)
        if WIN_VAR(win, FILETYPE_TASK_KEY) then
          return
        end
        defer(function()
          SET_OPTS(COLUMN_OPTS(false), { win = win })
          WIN_VAR(win, FILETYPE_TASK_KEY, true)
        end, 10)
      end
    end

    local system_prompt = require("codecompanion.config").config.opts.system_prompt
    require("codecompanion").setup({
      strategies = {
        chat = {
          adapter = "hyperbolic",
          keymaps = {
            clear = { modes = { n = "gX" } },
            system_prompt = { modes = { n = "gS" } },
            completion = { modes = { i = "<C-m>" } },
            codeblock = { modes = { n = "gC" } },
          },
        },
        inline = { adapter = "hyperbolic" },
        agent = { adapter = "hyperbolic" },
      },
      opts = {
        language = "Chinese",
        log_level = "ERROR",
        send_code = true,
        system_prompt = function(...)
          return prompt or system_prompt(...)
        end,
      },
      adapters = {
        opts = {
          allow_insecure = false,
          proxy = LLM.proxy,
          show_defaults = false,
        },
        hyperbolic = adapter_factory("hyperbolic"),
        deepseek = adapter_factory("deepseek"),
        gemini = adapter_factory("gemini"),
        ollama = adapter_factory("ollama"),
      },
      display = {
        diff = { enabled = true },
        chat = {
          window = {
            width = FILETYPE_SIZE_MAP.codecompanion.width,
            opts = { linebreak = false },
          },
        },
      },
      prompt_library = require("features.codecompanion-prompt-lib"),
    })
  end,
}
