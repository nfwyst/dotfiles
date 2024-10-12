local image = {
  "HakonHarnes/img-clip.nvim",
  event = "VeryLazy",
  enabled = false,
  opts = {
    default = {
      embed_image_as_base64 = false,
      prompt_for_file_name = false,
      drag_and_drop = {
        insert_mode = true,
      },
      use_absolute_path = true,
    },
  },
}

local function init(config)
  local default_prompt = "你是一位出色的编程专家。"
  local function setup_prompt(custom)
    local prompt = default_prompt
    if config.options.system_prompt == default_prompt then
      prompt = PROMPT
    else
      prompt = default_prompt
    end
    config.override({
      system_prompt = custom or prompt,
    })
  end
  USER_COMMAND("TogglePrompt", setup_prompt)
  setup_prompt(PROMPT)
end

local build = IS_MAC and "make" or "make BUILD_FROM_SOURCE=true"

return {
  "yetone/avante.nvim",
  cmd = { "TogglePrompt" },
  build = build,
  dependencies = {
    "stevearc/dressing.nvim",
    "nvim-lua/plenary.nvim",
    "MunifTanjim/nui.nvim",
    "nvim-tree/nvim-web-devicons",
    image,
  },
  config = function()
    local config = require("avante.config")
    local providers = require("avante.providers")
    local api_key_name = "DEEPSEEK_API_KEY"
    local token = os.getenv(api_key_name) or ""
    require("avante").setup({
      provider = "deepseek",
      vendors = {
        deepseek = {
          endpoint = "https://api.deepseek.com/beta/chat/completions",
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
                messages = providers.openai.parse_message(code_opts),
                temperature = 0,
                max_tokens = 8192,
                stream = true,
              },
            }
          end,
          parse_response_data = function(data_stream, event_state, opts)
            providers.openai.parse_response(data_stream, event_state, opts)
          end,
        },
      },
      behaviour = {
        auto_suggestions = IS_MAC,
        auto_set_highlight_group = true,
        auto_apply_diff_after_generation = false,
        auto_set_keymaps = false,
        support_paste_from_clipboard = false,
      },
      windows = {
        height = 100,
        input = { prefix = "➜ " },
      },
      mappings = {
        diff = {
          ours = "co",
          theirs = "ct",
          all_theirs = "ca",
          both = "cb",
          cursor = "cc",
          next = "]x",
          prev = "[x",
        },
        suggestion = {
          accept = "<M-l>",
          next = "<M-]>",
          prev = "<M-[>",
          dismiss = "<C-]>",
        },
        jump = {
          next = "]]",
          prev = "[[",
        },
        submit = {
          normal = "<cr>",
          insert = "<C-s>",
        },
      },
      hints = {
        enabled = false,
      },
    })
    init(config)
  end,
}
