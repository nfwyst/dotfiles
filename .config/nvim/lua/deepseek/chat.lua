local http = require("deepseek.http")
local config = require("deepseek.config")
local utils = require("deepseek.utils")

local M = {}
local conversation_history = {}

function M.display_response(response)
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
    model = config.config.default_model,
    messages = conversation_history,
    max_tokens = config.config.max_output_length.chat,
  }
  http.request("/chat/completions", "POST", data, function(chunk)
    if chunk then
      table.insert(conversation_history, { role = "assistant", content = chunk })
      M.display_response(chunk)
    else
      utils.notify("Error: No response from server", "error")
    end
  end)
end

function M.start_chat()
  local bufnr = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_name(bufnr, "Copilot Chat")
  vim.api.nvim_buf_set_option(bufnr, "buftype", "prompt")
  vim.fn.prompt_setprompt(bufnr, "Enter your message: ")
  vim.api.nvim_buf_attach(bufnr, false, {
    on_lines = function()
      local lines = vim.api.nvim_buf_get_lines(bufnr, 0, -1, false)
      local prompt = table.concat(lines, "\n")
      if prompt:sub(-1) == "\n" then
        table.insert(conversation_history, { role = "user", content = prompt })
        M.complete()
        vim.api.nvim_buf_set_lines(bufnr, 0, -1, false, {})
      end
    end,
  })
  vim.api.nvim_win_set_buf(0, bufnr)
end

return M
