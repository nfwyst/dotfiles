local http = require("deepseek.http")
local config = require("deepseek.config")

local M = {}

-- 格式化函数
local function format(chunk_table)
  return chunk_table.choices[1].text
end

function M.complete()
  vim.ui.input({ prompt = "Enter prompt: " }, function(prompt)
    if not prompt then
      return
    end

    local data = {
      model = config.default_model,
      prompt = prompt,
      max_tokens = config.max_output_length.fim,
      stream = true,
    }

    http.request("/completions", "POST", vim.json.encode(data), format)
  end)
end

return M
