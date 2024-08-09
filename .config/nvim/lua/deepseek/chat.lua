local http = require("deepseek.http")
local config = require("deepseek.config")
local utils = require("deepseek.utils")

local M = {}
local conversation_history = {}

function M.display_response(response)
  if type(response) ~= "string" then
    response = vim.inspect(response)
  end
  local bufnr = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, vim.split(response, "\n"))
  local win_id = vim.api.nvim_open_win(bufnr, true, {
    relative = "editor",
    width = 80,
    height = 10,
    row = 2,
    col = 2,
    style = "minimal",
    border = "single",
  })
  vim.api.nvim_win_set_option(win_id, "winhl", "Normal:Normal")
end

function M.complete()
  local prompt = vim.fn.getline(".")
  local data = {
    model = config.default_model,
    messages = conversation_history,
    max_tokens = config.max_output_length.chat,
    stream = true,
  }
  http.request("/chat/completions", "POST", data, function(chunk)
    print(vim.inspect(response))
    if chunk then
      table.insert(conversation_history, { role = "assistant", content = chunk })
      vim.schedule(function()
        M.display_response(chunk)
        vim.api.nvim_buf_set_lines(chat_bufnr, -1, -1, false, { chunk })
      end)
    else
      utils.notify("Error: No response from server", "error")
    end
  end)
end

function M.start_chat()
  local current_bufnr = vim.api.nvim_get_current_buf()
  local chat_bufnr = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_name(chat_bufnr, "Copilot Chat")
  vim.api.nvim_buf_set_option(chat_bufnr, "buftype", "prompt")
  vim.fn.prompt_setprompt(chat_bufnr, "Enter your message: ")
  vim.api.nvim_buf_attach(chat_bufnr, false, {
    on_lines = function()
      local lines = vim.api.nvim_buf_get_lines(chat_bufnr, 0, -1, false)
      local prompt = table.concat(lines, "\n")
      if prompt:sub(-1) == "\n" then
        local user_input = prompt:gsub("^Enter your message: ", "")
        table.insert(conversation_history, { role = "user", content = user_input })
        M.complete()
        vim.schedule(function()
          vim.api.nvim_buf_set_lines(chat_bufnr, 0, -1, false, {})
        end)
      end
    end,
  })
  vim.api.nvim_command("vsplit")
  vim.api.nvim_win_set_buf(0, chat_bufnr)
  vim.api.nvim_command("startinsert")
end

return M
