local function init(config)
  local default_prompt = '你是一位出色的编程专家。'
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
  USER_COMMAND('TogglePrompt', setup_prompt)
  setup_prompt(PROMPT)
end

local build = IS_MAC and 'make' or 'make BUILD_FROM_SOURCE=true'

return {
  'yetone/avante.nvim',
  cond = HAS_API_KEY,
  cmd = { 'TogglePrompt' },
  build = build,
  dependencies = {
    'stevearc/dressing.nvim',
    'nvim-lua/plenary.nvim',
    'MunifTanjim/nui.nvim',
    'nvim-tree/nvim-web-devicons',
  },
  config = function()
    local config = require('avante.config')
    local providers = require('avante.providers')
    local api_key_name = 'DEEPSEEK_API_KEY'
    local token = os.getenv(api_key_name) or ''
    require('avante').setup({
      provider = 'deepseek',
      vendors = {
        deepseek = {
          endpoint = 'https://api.deepseek.com/beta/chat/completions',
          model = 'deepseek-chat',
          api_key_name = api_key_name,
          parse_curl_args = function(opts, code_opts)
            return {
              url = opts.endpoint,
              headers = {
                ['Accept'] = 'application/json',
                ['Content-Type'] = 'application/json',
                ['Authorization'] = 'Bearer ' .. token,
              },
              body = {
                model = opts.model,
                messages = providers.openai.parse_messages(code_opts),
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
        auto_suggestions = false,
        auto_set_highlight_group = true,
        auto_apply_diff_after_generation = false,
        auto_set_keymaps = false,
        support_paste_from_clipboard = false,
        minimize_diff = true,
      },
      windows = {
        height = 100,
        input = { prefix = '➜ ' },
        sidebar_header = {
          enabled = false,
        },
        ask = {
          start_insert = false,
        },
      },
      mappings = {
        diff = {
          ours = 'co',
          theirs = 'ct',
          all_theirs = 'ca',
          both = 'cb',
          cursor = 'cc',
          next = ']x',
          prev = '[x',
        },
        jump = {
          next = ']]',
          prev = '[[',
        },
        submit = {
          normal = '<cr>',
          insert = '<C-s>',
        },
      },
      hints = {
        enabled = false,
      },
      repo_map = {
        ignore_patterns = {
          '%.git',
          '%.worktree',
          '__pycache__',
          'node_modules',
          '__tests__',
          'e2e-tests',
          '%.github',
          '%.husky',
          '%.vscode',
          'fonts',
          '%.ttf',
          'images',
          'img',
          '%.png',
          '%.gif',
          '%.zip',
          '%.jar',
          '%.min.js',
          '%.svg',
          '%lock.json',
          'docker',
          '%.platform',
          '%.htaccess',
          '%.storybook',
          'dist',
          '%.lock',
          'locales',
        },
      },
    })
    init(config)
  end,
}
