local curl = require("plenary.curl")
local json = vim.json

local http = {}

function http.request(options, on_chunk)
  local method = options.method or "GET"
  local url = options.url
  local headers = options.headers or {}
  local body = options.body

  -- 确保 body 是 JSON 字符串
  if type(body) == "table" then
    body = json.encode(body)
  end

  curl.request({
    method = method,
    url = url,
    headers = headers,
    body = body,
    stream = vim.schedule_wrap(function(_, chunk)
      if chunk then
        -- 去掉 "data: " 前缀
        local json_chunk = chunk:match("^data: (%b{})")
        if json_chunk and json_chunk ~= "[DONE]" then
          local ok, chunk_table = pcall(json.decode, json_chunk)
          if not ok then
            LOG_ERROR("core.http: decode error", json_chunk)
            return
          end
          on_chunk(chunk_table)
        end
      end
    end),
  })
end

return http
