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
          choices = config.models,
        },
        temperature = {
          default = LLM.temperature,
        },
        num_ctx = { default = config.num_ctx },
        max_tokens = { default = config.max_tokens },
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
          adapter = "hyperbolic",
          slash_commands = {
            help = { opts = { provider = "fzf_lua" } },
          },
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
            width = 0.35,
            opts = { linebreak = false },
          },
        },
      },
      prompt_library = require("features.codecompanion-prompt-lib"),
    })
  end,
}
