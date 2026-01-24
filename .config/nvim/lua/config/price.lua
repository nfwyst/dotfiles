local M = {}

local cache = {
  price = nil,
  timestamp = 0,
  last_api_index = 0,
  enabled = true,
}

local config = {
  refresh_interval = 60000,
  timeout = 10000,
}

local timer_id = nil

local api_endpoints = {
  {
    url = vim.base64.decode("aHR0cHM6Ly9hcGkuYmluYW5jZS5jb20vYXBpL3YzL3RpY2tlci9wcmljZT9zeW1ib2w9RVRIVVNEVA=="),
    parser = function(body)
      local ok, data = pcall(vim.json.decode, body)
      if ok and data then
        return tonumber(data.price)
      end
    end,
  },
  {
    url = vim.base64.decode(
      "aHR0cHM6Ly9hcGkuY29pbmdlY2tvLmNvbS9hcGkvdjMvc2ltcGxlL3ByaWNlP2lkcz1ldGhlcmV1bSZ2c19jdXJyZW5jaWVzPXVzZA=="
    ),
    parser = function(body)
      local ok, data = pcall(vim.json.decode, body)
      if ok and data and data.ereum then
        return tonumber(data.ereum.usd)
      end
    end,
  },
  {
    url = vim.base64.decode("aHR0cHM6Ly9hcGkua3Jha2VuLmNvbS8wL3B1YmxpYy9UaWNrZXI/cGFpcj1FVEhVU0Q="),
    parser = function(body)
      local ok, data = pcall(vim.json.decode, body)
      if ok and data and data.result then
        local first_key = next(data.result)
        if first_key and data.result[first_key] then
          return tonumber(data.result[first_key].c[1])
        end
      end
    end,
  },
}

local user_agents = {
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
}

local function update_cache(price)
  if price then
    cache.price = price
    cache.timestamp = vim.loop.hrtime() / 1e6
  end
end

local function format_price(price)
  return price and string.format("Ξ %.2f", price) or ""
end

local function fetch_price(callback)
  cache.last_api_index = (cache.last_api_index % #api_endpoints) + 1
  local api = api_endpoints[cache.last_api_index]
  local user_agent = user_agents[math.random(#user_agents)]

  local function on_result(result)
    if result.code == 0 then
      local price = api.parser(result.stdout)
      if price then
        update_cache(price)
        callback(price)
        return
      elseif result.stderr and result.stderr ~= "" then
        vim.notify(" price API error: " .. result.stderr, vim.log.levels.WARN)
      end
    end
    callback(nil)
  end

  local args = {
    "-s",
    "-L",
    "-m",
    tostring(config.timeout / 1000),
    "-H",
    string.format("User-Agent: %s", user_agent),
    api.url,
  }

  vim.system({ "curl", unpack(args) }, { timeout = config.timeout }, on_result)
end

function M.get_price(callback)
  local now = vim.loop.hrtime() / 1e6

  if cache.price and (now - cache.timestamp) < config.refresh_interval then
    callback(cache.price)
    return
  end

  fetch_price(callback)
end

function M.refresh_price(callback)
  fetch_price(callback)
end

function M.get_display_text()
  if not cache.enabled then
    return ""
  end
  return format_price(cache.price)
end

function M.set_refresh_interval(interval)
  config.refresh_interval = interval
  if timer_id then
    M.stop()
    M.setup()
  end
end

function M.toggle()
  cache.enabled = not cache.enabled
  vim.notify("Price display " .. (cache.enabled and "enabled" or "disabled"))
end

function M.stop()
  if timer_id then
    vim.fn.timer_stop(timer_id)
    timer_id = nil
  end
end

function M.setup()
  fetch_price(update_cache)

  local refresh = function()
    fetch_price(update_cache)
  end

  timer_id = vim.fn.timer_start(config.refresh_interval, refresh, { ["repeat"] = -1 })
end

M.setup()

return M
