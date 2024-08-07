local curl = require("plenary.curl")
local utils = require("deepseek.utils")
local json = vim.json

local http = {}

function http.request(options, format_chunk_table)
  local method = options.method or "GET"
  local url = options.url
  local headers = options.headers or {}
  local body = options.body

  -- 确保 body 是 JSON 字符串
  if type(body) == "table" then
    body = json.encode(body)
  end

  local response_body = {}
  -- local final_response_sent = false

  utils.reset()
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
          local chunk_table = json.decode(json_chunk)
          if format_chunk_table then
            chunk_table = format_chunk_table(chunk_table)
          end
          table.insert(response_body, chunk_table)
          utils.process_response(chunk_table) -- 流式输出
        end
      end
    end),
    -- callback = function()
    --   if not final_response_sent then
    --     final_response_sent = true
    --     utils.process_response(nil, response_body)  -- 最终响应
    --   end
    -- end
  })
end

return http
