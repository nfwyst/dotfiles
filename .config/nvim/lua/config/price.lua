local M = {}

local cache = {
  price = nil,
  timestamp = 0,
  last_api_index = 0,
  enabled = true,
}

local config = {
  refresh_interval = 6000,
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
      if ok and data and data.ethereum then
        return tonumber(data.ethereum.usd)
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
    cache.timestamp = vim.uv.hrtime() / 1e6
  end
end

local function format_price(price)
  return price and string.format("Ξ %.2f", price) or ""
end

-- Prefer vim.net.request (Neovim 0.12+ built-in async HTTP GET).
-- Falls back to vim.system+curl on older runtimes for safety.
local has_net = vim.net and type(vim.net.request) == "function"

local function fetch_price(callback)
  cache.last_api_index = (cache.last_api_index % #api_endpoints) + 1
  local api = api_endpoints[cache.last_api_index]
  local user_agent = user_agents[math.random(#user_agents)]

  local done = false
  local function finish(price)
    if done then return end
    done = true
    callback(price)
  end

  if has_net then
    local job = vim.net.request(
      api.url,
      {
        retry = 0, -- we rotate endpoints ourselves; built-in retry would slow rotation
        headers = { ["User-Agent"] = user_agent },
      },
      function(err, res)
        if err or not res then
          return finish(nil)
        end
        local price = api.parser(res.body)
        if price then
          update_cache(price)
          return finish(price)
        end
        finish(nil)
      end
    )
    -- Enforce request timeout (vim.net.request has no native timeout option).
    vim.defer_fn(function()
      if not done and job then
        pcall(job.close, job)
        finish(nil)
      end
    end, config.timeout)
    return
  end

  -- Legacy fallback
  local args = {
    "-s", "-L", "-m", tostring(config.timeout / 1000),
    "-H", string.format("User-Agent: %s", user_agent),
    api.url,
  }
  vim.system({ "curl", unpack(args) }, { timeout = config.timeout }, function(result)
    if result.code == 0 then
      local price = api.parser(result.stdout)
      if price then
        update_cache(price)
        return finish(price)
      end
    end
    finish(nil)
  end)
end

function M.get_price(callback)
  local now = vim.uv.hrtime() / 1e6
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
    timer_id:stop()
    timer_id:close()
    timer_id = nil
  end
end

function M.setup()
  fetch_price(update_cache)
  timer_id = vim.uv.new_timer()
  timer_id:start(config.refresh_interval, config.refresh_interval, vim.schedule_wrap(function()
    fetch_price(update_cache)
  end))
end

-- Defer network requests + timer until after UI is ready.
-- price.lua is required at startup via lualine, but the ticker
-- doesn't need to run until after the first paint.
vim.api.nvim_create_autocmd("UIEnter", {
  once = true,
  callback = function()
    vim.defer_fn(M.setup, 0)
  end,
})

return M
