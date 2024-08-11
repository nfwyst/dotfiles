local http = require("deepseek.http")
local config = require("deepseek.config")
local utils = require("deepseek.utils")

local M = {}
local conversation_history = {}

function M.display_response(response, chat_bufnr)
  local content = response.choices[1].delta.content
  if type(content) ~= "string" then
    content = vim.inspect(content)
  end
  if vim.api.nvim_buf_is_valid(chat_bufnr) then
    vim.api.nvim_buf_set_lines(chat_bufnr, -1, -1, false, vim.split(content, "\n"))
  else
    utils.notify("Error: Invalid buffer number", "error")
  end
end

function M.start_chat()
  local prompt = vim.fn.getline(".")
  local data = {
    model = config.default_model,
    messages = conversation_history,
    max_tokens = config.max_output_length.chat,
    stream = true,
  }
  http.request("/chat/completions", "POST", data, function(chunk)
    if chunk then
      table.insert(conversation_history, { role = "assistant", content = chunk })
      vim.schedule(function()
        M.display_response(chunk, chat_bufnr)
      end)
    else
      utils.notify("Error: No response from server", "error")
    end
  end)
end

function M.start_chat()
function M.start_chat()
  local current_bufnr = vim.api.nvim_get_current_buf()
  local chat_bufnr = vim.api.nvim_create_buf(false, true)
  local input_bufnr = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_name(chat_bufnr, "DeepSeek Chat")
  vim.api.nvim_buf_set_option(chat_bufnr, "buftype", "nofile")
  vim.api.nvim_buf_set_option(input_bufnr, "buftype", "prompt")
  vim.api.nvim_buf_set_option(input_bufnr, "filetype", "markdown")
  vim.fn.prompt_setprompt(input_bufnr, "Enter your message: ")

  vim.api.nvim_buf_attach(input_bufnr, false, {
    on_lines = function()
      local lines = vim.api.nvim_buf_get_lines(input_bufnr, 0, -1, false)
      local prompt = table.concat(lines, "\n")
      if prompt:sub(-1) == "\n" then
        local user_input = prompt:gsub("^Enter your message: ", "")
        table.insert(conversation_history, { role = "user", content = user_input })
        M.complete(chat_bufnr)
        vim.schedule(function()
          if vim.api.nvim_buf_is_valid(input_bufnr) then
            vim.api.nvim_buf_set_lines(input_bufnr, 0, -1, false, {})
          else
            utils.notify("Error: Invalid buffer number", "error")
          end
        end)
      end
    end,
  })

  vim.api.nvim_command("vsplit")
  vim.api.nvim_win_set_buf(0, chat_bufnr)
  vim.api.nvim_command("split")
  vim.api.nvim_win_set_buf(0, input_bufnr)
  vim.api.nvim_command("startinsert")
end

return M
