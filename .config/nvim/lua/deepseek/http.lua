local http = require("core.http")
local config = require("deepseek.config")

local M = {}

function M.request(url, method, data, format)
  http.request({
    url = config.base_url .. url,
    method = method,
    headers = {
      ["Content-Type"] = "application/json",
      ["Accept"] = "application/json",
      ["Authorization"] = "Bearer " .. config.api_key,
    },
    body = data,
  }, format)
end

return M
