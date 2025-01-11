local function switch_prompt(config)
  return function()
    local default_prompt = "你是一位出色的编程专家。"
    local prompt = default_prompt
    local msg = "prompt set to default"
    if config.options.system_prompt == default_prompt then
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
  config.override({ system_prompt = PROMPT })
end

local mode = { "n", "v" }

return {
  "yetone/avante.nvim",
  cond = HAS_AI_KEY,
  build = "make BUILD_FROM_SOURCE=true",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "MunifTanjim/nui.nvim",
  },
  keys = {
    { "<leader>a", "", desc = "+ai", mode = mode },
    {
      "<leader>aa",
      function()
        GET_USER_INPUT("question", function(question)
          cmd("AvanteAsk " .. question)
        end)
      end,
      desc = "AvanteAsk",
    },
    { "<leader>aB", "<cmd>AvanteBuild<cr>", desc = "AvanteBuild" },
    { "<leader>ac", "<cmd>AvanteChat<cr>", desc = "AvanteChat" },
    { "<leader>aH", "<cmd>AvanteClear history<cr>", desc = "AvanteClear" },
    { "<leader>aM", "<cmd>AvanteClear memory<cr>", desc = "AvanteClear memory" },
    { "<leader>aC", "<cmd>AvanteClear cache<cr>", desc = "AvanteClear cache" },
    { "<leader>ae", "<cmd>AvanteEdit<cr>", desc = "AvanteEdit", mode = mode },
    { "<leader>ar", "<cmd>AvanteRefresh<cr>", desc = "AvanteRefresh" },
    { "<leader>aR", "<cmd>AvanteShowRepoMap<cr>", desc = "AvanteShowRepoMap" },
    { "<leader>aP", "<cmd>AvanteSwitchFileSelectorProvider<cr>", desc = "AvanteSwitchFileSelectorProvider" },
    { "<leader>ap", "<cmd>AvanteSwitchProvider<cr>", desc = "AvanteSwitchProvider" },
    { "<leader>at", "<cmd>AvanteToggle<cr>", desc = "AvanteToggle" },
    {
      "<leader>ah",
      function()
        require("avante").toggle.hint()
      end,
      desc = "Avante: Toggle Hint",
    },
    {
      "<leader>ad",
      function()
        require("avante").toggle.debug()
      end,
      desc = "Avante: Toggle Debug",
    },
    {
      "<leader>as",
      function()
        require("avante").toggle.suggestion()
      end,
      desc = "Avante: Toggle Suggestion",
    },
    {
      "<leader>aT",
      "<cmd>TogglePrompt<cr>",
      desc = "TogglePrompt",
    },
  },
  config = function()
    -- hide left columns for avante sidebar
    AUCMD("FileType", {
      group = GROUP("hide_left_columns_for_avante", { clear = true }),
      pattern = { "Avante", "AvanteInput" },
      callback = function(event)
        local bufnr = event.buf
        defer(function()
          local win = fn.bufwinid(bufnr)
          local opts = COLUMN_OPTS(false)
          local is_input = event.match == "AvanteInput"
          if is_input then
            opts.signcolumn = "yes"
            pcall(keymap.del, "i", "<tab>", { buffer = bufnr })
          end
          SET_OPTS(opts, wo[win])
        end, 30)
      end,
    })

    local config = require("avante.config")
    local providers = require("avante.providers")
    local api_key_name = "DEEPSEEK_API_KEY"
    local token = os.getenv(api_key_name) or ""

    require("avante").setup({
      provider = "openai",
      openai = {
        endpoint = "https://api.deepseek.com/v1",
        model = "deepseek-chat",
        timeout = 30000,
        api_key_name = api_key_name,
        temperature = 0.1,
        max_tokens = 8192,
        allow_insecure = false,
        ["local"] = false,
      },
      vendors = {
        deepseek = {
          endpoint = "https://api.deepseek.com/chat/completions",
          model = "deepseek-chat",
          api_key_name = api_key_name,
          parse_curl_args = function(opts, code_opts)
            return {
              url = opts.endpoint,
              headers = {
                ["Accept"] = "application/json",
                ["Content-Type"] = "application/json",
                ["Authorization"] = "Bearer " .. token,
              },
              body = {
                model = opts.model,
                messages = providers.openai.parse_messages(code_opts),
                temperature = 0.1,
                max_tokens = 8192,
                stream = true,
              },
            }
          end,
          parse_response_data = function(...)
            return providers.openai.parse_response(...)
          end,
        },
      },
      behaviour = {
        auto_suggestions = false,
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
          add_current = "<leader>ab",
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
