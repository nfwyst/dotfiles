local actions = require("telescope.actions")
local action_state = require("telescope.actions.state")
local pickers = require("telescope.pickers")
local finders = require("telescope.finders")
local theme = require("telescope.themes")
local conf = require("telescope.config").values

local model = {
  model = "deepseek-coder",
  top_p = 1,
  max_tokens = 8192,
  num_ctx = 131072,
  stream = true,
}

local function mask_api_key(key)
  return key:sub(1, 3) .. string.rep("*", #key - 6) .. key:sub(-3)
end

local function inspect_plugin(plugin, params)
  local bufnr = vim.api.nvim_create_buf(false, true)
  local copy = vim.deepcopy(plugin)
  copy.config.openai_api_key = mask_api_key(copy.config.openai_api_key or "")
  local plugin_info = string.format("Plugin structure:\n%s", vim.inspect(copy))
  local params_info = string.format("Command params:\n%s", vim.inspect(params))
  local lines = vim.split(plugin_info .. "\n" .. params_info, "\n")
  vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, lines)
  vim.api.nvim_win_set_buf(0, bufnr)
end

local function inspect_log(plugin, _)
  local log_file = plugin.config.log_file
  local buffer = plugin.helpers.get_buffer(log_file)
  if not buffer then
    vim.cmd("e " .. log_file)
  else
    vim.cmd("buffer " .. buffer)
  end
end

local function implement(gp, params)
  local template = "Having following from {{filename}}:\n\n"
    .. "```{{filetype}}\n{{selection}}\n```\n\n"
    .. "Please rewrite this according to the contained instructions."
    .. "\n\nRespond exclusively with the snippet that should replace the selection above."
  gp.Prompt(
    params,
    gp.Target.rewrite,
    gp.get_command_agent(),
    template,
    nil, -- command will run directly without any prompting for user input
    nil -- no predefined instructions (e.g. speech-to-text from Whisper)
  )
end

local function buffer_chat_new(gp, _)
  vim.api.nvim_command("%" .. gp.config.cmd_prefix .. "ChatNew")
end

local function translate(gp, params)
  local chat_system_prompt =
    "You are a Translator, please translate between English and Chinese."
  gp.cmd.ChatNew(params, chat_system_prompt)
end

local function unit_tests(gp, params)
  local template = "I have the following code from {{filename}}:\n\n"
    .. "```{{filetype}}\n{{selection}}\n```\n\n"
    .. "Please respond by writing table driven unit tests for the code above."
  local agent = gp.get_command_agent()
  gp.Prompt(params, gp.Target.enew, agent, template)
end

local function explain(gp, params)
  local template = "I have the following code from {{filename}}:\n\n"
    .. "```{{filetype}}\n{{selection}}\n```\n\n"
    .. "Please respond by explaining the code above."
  local agent = gp.get_chat_agent()
  gp.Prompt(params, gp.Target.popup, agent, template)
end

local function code_review(gp, params)
  local template = "I have the following code from {{filename}}:\n\n"
    .. "```{{filetype}}\n{{selection}}\n```\n\n"
    .. "Please analyze for code smells and suggest improvements."
  local agent = gp.get_chat_agent()
  gp.Prompt(params, gp.Target.enew("markdown"), agent, template)
end

local hooks = {
  InspectPlugin = {
    desc = "provides a detailed inspection of the plugin state",
    selection = false,
    fn = inspect_plugin,
  },
  InspectLog = {
    desc = "for checking the log file",
    selection = false,
    fn = inspect_log,
  },
  Implement = {
    desc = "rewrites the provided selection/range based on comments in it",
    selection = true,
    fn = implement,
  },
  BufferChatNew = {
    desc = "opens new chat with the entire current buffer as a context",
    selection = false,
    fn = buffer_chat_new,
  },
  Translate = {
    desc = "translate the provided selection/range",
    selection = true,
    fn = translate,
  },
  UnitTests = {
    desc = "write unit test for the provided selection/range code",
    selection = true,
    fn = unit_tests,
  },
  Explain = {
    desc = "explaining the provided selection/range code",
    selection = true,
    fn = explain,
  },
  CodeReview = {
    desc = "review the provided selection/range code",
    selection = true,
    fn = code_review,
  },
}

local function select_agent(gp)
  local buf = vim.api.nvim_get_current_buf()
  local file_name = vim.api.nvim_buf_get_name(buf)
  local is_chat = gp.not_chat(buf, file_name) == nil

  local opts = theme.get_dropdown({
    winblend = 10,
    previewer = false,
  })
  local results = is_chat and gp._chat_agents or gp._command_agents
  pickers
    .new(opts, {
      prompt_title = "Models",
      finder = finders.new_table({
        results = results,
      }),
      sorter = conf.generic_sorter(opts),
      attach_mappings = function(prompt_bufnr)
        actions.select_default:replace(function()
          local selection = action_state.get_selected_entry()
          actions.close(prompt_bufnr)
          gp.cmd.Agent({ args = selection[1] })
        end)
        return true
      end,
    })
    :find()
end

local function pick_command(mode)
  local command_names = {}
  for name, cmd in pairs(hooks) do
    if mode == "v" or (mode == "n" and not cmd.selection) then
      table.insert(command_names, name .. " - " .. cmd.desc)
    end
  end

  pickers
    .new({}, {
      prompt_title = "Select Command",
      finder = finders.new_table({
        results = command_names,
      }),
      sorter = conf.generic_sorter({}),
      attach_mappings = function(prompt_bufnr, _)
        actions.select_default:replace(function()
          actions.close(prompt_bufnr)
          local selection = action_state.get_selected_entry()
          local command = selection[1]:match("^(%S+)")
          if mode == "v" then
            command = ":<C-u>'<,'>Gp" .. command .. "<CR>"
          else
            command = ":Gp" .. command .. "<CR>"
          end

          vim.api.nvim_feedkeys(
            vim.api.nvim_replace_termcodes(command, true, false, true),
            "c",
            true
          )
        end)
        return true
      end,
    })
    :find()
end

local function init(gp)
  SET_USER_COMMANDS({
    GpPickCommand = function()
      pick_command(vim.fn.mode())
    end,
    GpSelectAgent = function()
      select_agent(gp)
    end,
  })
end

return {
  "robitx/gp.nvim",
  event = "VeryLazy",
  config = function()
    local _hooks = {}
    for k, v in pairs(hooks) do
      _hooks[k] = v.fn
    end
    local gp = require("gp")
    gp.setup({
      whisper = { disable = true },
      image = { disable = true },
      chat_assistant_prefix = { "🗨:" },
      providers = {
        openai = {
          endpoint = "https://api.deepseek.com/beta/chat/completions",
          secret = os.getenv("DEEPSEEK_API_KEY"),
        },
      },
      default_chat_agent = model.model,
      agents = {
        {
          name = "ChatGPT4o",
          disable = true,
        },
        {
          name = "ChatGPT4o-mini",
          disable = true,
        },
        {
          name = "ChatCopilot",
          disable = true,
        },
        {
          name = "ChatGemini",
          disable = true,
        },
        {
          name = "ChatPerplexityLlama3.1-8B",
          disable = true,
        },
        {
          name = "ChatClaude-3-5-Sonnet",
          disable = true,
        },
        {
          name = "ChatClaude-3-Haiku",
          disable = true,
        },
        {
          name = "ChatOllamaLlama3.1-8B",
          disable = true,
        },
        {
          name = "ChatLMStudio",
          disable = true,
        },
        {
          name = "CodeGPT4o",
          disable = true,
        },
        {
          name = "CodeGPT4o-mini",
          disable = true,
        },
        {
          name = "CodeCopilot",
          disable = true,
        },
        {
          name = "CodeGemini",
          disable = true,
        },
        {
          name = "CodePerplexityLlama3.1-8B",
          disable = true,
        },
        {
          name = "CodeClaude-3-5-Sonnet",
          disable = true,
        },
        {
          name = "CodeClaude-3-Haiku",
          disable = true,
        },
        {
          name = "CodeOllamaLlama3.1-8B",
          disable = true,
        },
        {
          provider = "openai",
          name = "chat",
          chat = true,
          command = false,
          model = MERGE_TABLE(
            model,
            { model = "deepseek-chat", temperature = 1.2 }
          ),
          system_prompt = gp.defaults.chat_system_prompt,
        },
        {
          provider = "openai",
          name = "coder-chat",
          chat = true,
          command = false,
          model = MERGE_TABLE(model, { temperature = 1 }),
          system_prompt = gp.defaults.chat_system_prompt,
        },
        {
          provider = "openai",
          name = "coder",
          chat = false,
          command = true,
          model = MERGE_TABLE(model, { temperature = 0.8 }),
          system_prompt = gp.defaults.code_system_prompt,
        },
      },
      hooks = _hooks,
    })
    init(gp)
  end,
}
