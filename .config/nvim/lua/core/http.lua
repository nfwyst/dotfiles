local curl = require('plenary.curl')
local json = vim.json

local http = {}

function http.request(options, on_chunk)
  local method = options.method or 'GET'
  local url = options.url
  local headers = options.headers or {}
  local body = options.body

  if type(body) == 'table' then
    body = json.encode(body)
  end

  curl.request({
    method = method,
    url = url,
    headers = headers,
    body = body,
    stream = vim.schedule_wrap(function(_, chunk)
      if not chunk then
        return
      end
      on_chunk(chunk)
    end),
  })
end

return http
