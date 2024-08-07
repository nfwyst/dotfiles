local config = require('deepseek.config')
local fim = require('deepseek.fim')
local chat = require('deepseek.chat')

local M = {}

function M.setup(opts)
  config.setup(opts)
  vim.api.nvim_create_user_command('DeepSeekFIM', fim.complete, {})
  vim.api.nvim_create_user_command('DeepSeekChat', chat.complete, {})
end

return M
