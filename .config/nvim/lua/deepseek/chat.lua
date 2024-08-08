local http = require("deepseek.http")
local config = require("deepseek.config")

local M = {}

function M.complete()
  local prompt = vim.fn.getline(".")
  local data = {
    model = config.config.default_model,
    messages = {
      { role = "user", content = prompt },
    },
    max_tokens = config.config.max_output_length.chat,
  }
  http.request("/chat/completions", "POST", data, function(chunk)
    if chunk then
      print(chunk)
    end
  end)
end

return M
