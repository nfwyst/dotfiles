local function switch_prompt(config)
  return function()
    local default_prompt = "你是一位出色的编程专家。"
    local prompt = default_prompt
    local msg = "prompt set to default"
    if config._options.system_prompt == default_prompt then
      msg = "prompt set to expert"
      prompt = PROMPT
    else
      prompt = default_prompt
    end
    config.override({ system_prompt = prompt })
    NOTIFY(msg, levels.INFO)
  end
end

local function init(config)
  CMD("TogglePrompt", switch_prompt(config), { desc = "Toggle Prompt" })
end

local mode = { "n", "v" }

local function hide_response_columns(_, win)
  if WIN_VAR(win, TASK_KEY) then
    return
  end
  defer(function()
    SET_OPTS(COLUMN_OPTS(false), { win = win })
    WIN_VAR(win, TASK_KEY, true)
  end, 30)
end

local function hide_input_columns(bufnr, win)
  if WIN_VAR(win, TASK_KEY) then
    return
  end
  defer(function()
    local opts = COLUMN_OPTS(false)
    opts.signcolumn = "yes"
    pcall(keymap.del, "i", "<tab>", { buffer = bufnr })
    SET_OPTS(opts, { win = win })
    WIN_VAR(win, TASK_KEY, true)
  end, 30)
end

local function vendor_factory(name)
  local config = LLM[name]
  if not config then
    return
  end

  local endpoint = config.origin
  local vendor_name = name
  local ok = pcall(require, "avante.providers." .. vendor_name)

  if not ok then
    vendor_name = "openai"
  end

  if config.pathname == OPENAI_PATHNAME then
    endpoint = endpoint .. "/v1"
  end

  return {
    __inherited_from = vendor_name,
    model = config.model,
    api_key_name = config.api_key,
    endpoint = endpoint,
    temperature = LLM.temperature,
    max_tokens = config.max_tokens,
    num_ctx = config.num_ctx,
    proxy = LLM.proxy,
    allow_insecure = false,
    timeout = LLM.timeout,
    disable_tools = false,
  }
end

local vendors = {
  hyperbolic = vendor_factory("hyperbolic"),
  deepseek = vendor_factory("deepseek"),
  gemini = vendor_factory("gemini"),
  ollama = vendor_factory("ollama"),
}
local vendor_names = keys(vendors)

return {
  "yetone/avante.nvim",
  cond = HAS_AI_KEY,
  build = "make BUILD_FROM_SOURCE=true",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "MunifTanjim/nui.nvim",
    {
      "saghen/blink.cmp",
      module = false,
      opts = function(_, opts)
        push_list(opts.sources.compat, {
          "avante_commands",
          "avante_mentions",
          "avante_files",
        })
      end,
    },
  },
  keys = {
    { "<leader>a", "", desc = "ai", mode = mode },
    { "<leader>aa", "", desc = "Avante", mode = mode },
    {
      "<leader>aaa",
      function()
        REQUEST_USER_INPUT("question", function(question)
          cmd("AvanteAsk " .. question)
        end)
      end,
      desc = "Avante: Ask AI About Code",
    },
    { "<leader>aaB", "<cmd>AvanteBuild<cr>", desc = "Avante: Build Dependencies" },
    { "<leader>aac", "<cmd>AvanteChat<cr>", desc = "Avante: Start Chat" },
    { "<leader>aaH", "<cmd>AvanteClear history<cr>", desc = "Avante: Clear History" },
    { "<leader>aaM", "<cmd>AvanteClear memory<cr>", desc = "Avante: Clear Memory" },
    { "<leader>aaC", "<cmd>AvanteClear cache<cr>", desc = "Avante: Clear Cache" },
    { "<leader>aae", "<cmd>AvanteEdit<cr>", desc = "Avante: Edit The Selected Code", mode = mode },
    { "<leader>aaf", "<cmd>AvanteFocus<cr>", desc = "Avante: Switch Focus To/From The Sidebar" },
    { "<leader>aar", "<cmd>AvanteRefresh<cr>", desc = "Avante: Refresh All Window" },
    { "<leader>aaR", "<cmd>AvanteShowRepoMap<cr>", desc = "Avante: Show Repo Map" },
    { "<leader>aat", "<cmd>AvanteToggle<cr>", desc = "Avante: Toggle The Sidebar" },
    {
      "<leader>aap",
      function()
        REQUEST_USER_SELECT(vendor_names, "select provider: ", function(name)
          cmd("AvanteSwitchProvider " .. name)
        end)
      end,
      desc = "Avante: Switch AI Provider",
    },
    {
      "<leader>aah",
      function()
        require("avante").toggle.hint()
      end,
      desc = "Avante: Toggle Hint",
    },
    {
      "<leader>aad",
      function()
        require("avante").toggle.debug()
      end,
      desc = "Avante: Toggle Debug",
    },
    {
      "<leader>aas",
      function()
        require("avante").toggle.suggestion()
      end,
      desc = "Avante: Toggle Suggestion",
    },
    {
      "<leader>aaT",
      "<cmd>TogglePrompt<cr>",
      desc = "Avante: TogglePrompt",
    },
  },
  config = function()
    -- hide left columns for avante sidebar
    if not FILETYPE_TASK_MAP.Avante then
      assign(FILETYPE_TASK_MAP, {
        Avante = hide_response_columns,
        AvanteInput = hide_input_columns,
      })
    end

    local config = require("avante.config")

    require("avante").setup({
      provider = "hyperbolic",
      vendors = vendors,
      web_search_engine = {
        provider = "tavily",
        providers = {
          tavily = {
            api_key_name = "TAVILY_API_KEY",
          },
          serpapi = {
            api_key_name = "SERPAPI_API_KEY",
          },
        },
      },
      behaviour = {
        auto_suggestions = false,
        auto_suggestions_respect_ignore = true,
        auto_set_highlight_group = true,
        auto_apply_diff_after_generation = false,
        auto_set_keymaps = false,
        support_paste_from_clipboard = false,
        minimize_diff = true,
      },
      windows = {
        height = 100,
        input = { prefix = "➜ " },
        sidebar_header = {
          enabled = false,
        },
        ask = {
          start_insert = false,
        },
      },
      mappings = {
        files = {
          add_current = "<leader>aab",
        },
      },
      hints = {
        enabled = false,
      },
      repo_map = {
        ignore_patterns = {
          "%.git",
          "%.worktree",
          "__pycache__",
          "node_modules",
          "__tests__",
          "e2e-tests",
          "%.github",
          "%.husky",
          "%.vscode",
          "fonts",
          "%.ttf",
          "images",
          "img",
          "%.png",
          "%.gif",
          "%.zip",
          "%.jar",
          "%.min.js",
          "%.svg",
          "%lock.json",
          "docker",
          "%.platform",
          "%.htaccess",
          "%.storybook",
          "dist",
          "%.lock",
          "locales",
        },
      },
      file_selector = {
        provider = "fzf",
        provider_opts = {},
      },
    })

    init(config)
  end,
}
