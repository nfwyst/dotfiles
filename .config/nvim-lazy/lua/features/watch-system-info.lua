local function run_command(cmd, args, callback)
  local stdout = uv.new_pipe(false)
  if not stdout then
    return
  end

  local output_chunks = {}

  args = { args = args, stdio = { nil, stdout, nil } }

  local handle
  handle = uv.spawn(cmd, args, function(code)
    handle:close()
    stdout:close()

    if code == 0 then
      callback(table.concat(output_chunks))
    end
  end)

  uv.read_start(stdout, function(err, data)
    if err then
      return
    end

    if data then
      table.insert(output_chunks, data)
    end
  end)
end

local function get_linux_memory_usage(callback)
  run_command("free", { "-b" }, function(output)
    local total, available = output:match("Mem:%s+(%d+)%s+%d+%s+%d+%s+%d+%s+%d+%s+(%d+)")
    total = tonumber(total)
    available = tonumber(available)

    if total and available then
      callback(math.floor(((total - available) / total) * 100))
    end
  end)
end

local function get_mac_memory_usage(callback)
  run_command("sysctl", { "-n", "hw.memsize" }, function(total)
    total = tonumber(total)
    if not total then
      return
    end

    run_command("vm_stat", {}, function(vm_stat)
      local page_size = tonumber(vm_stat:match("page size of (%d+) bytes"))
      if not page_size then
        return
      end

      local function parse_stat(key)
        return tonumber(vm_stat:match(key .. ":.-%s(%d+)%."))
      end

      local free = parse_stat("Pages free")
      local inactive = parse_stat("Pages inactive")
      local speculative = parse_stat("Pages speculative")

      if free and inactive and speculative then
        local available = (free + inactive + speculative) * page_size
        callback(math.floor(((total - available) / total) * 100))
      end
    end)
  end)
end

local function get_memory_usage(callback)
  local os_name = jit.os

  if os_name == "Linux" then
    get_linux_memory_usage(callback)
  end

  if os_name == "OSX" then
    get_mac_memory_usage(callback)
  end
end

local notified = false
local function check_memory()
  get_memory_usage(function(usage)
    MEMORY_USAGE = usage

    if MEMORY_USAGE >= MEMORY_LIMIT then
      if not notified then
        local msg = string.format("Warning: High memory usage (%.2f%%)", usage)
        NOTIFY(msg, levels.WARN)
        notified = true
      end
    end
  end)
end

uv.new_timer():start(0, 5000, check_memory)
