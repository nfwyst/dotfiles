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
  uv.fs_open("/proc/meminfo", "r", 438, function(error, fd)
    if error then
      return
    end

    uv.fs_fstat(fd, function(err, stat)
      if err or not stat then
        return uv.fs_close(fd)
      end

      uv.fs_read(fd, stat.size, 0, function(e, data)
        uv.fs_close(fd)
        if e or not data then
          return
        end

        local total = tonumber(data:match("MemTotal:%s+(%d+)"))
        local available = tonumber(data:match("MemAvailable:%s+(%d+)"))

        if not total or not available then
          return
        end

        callback(math.floor(((total - available) / total) * 100))
      end)
    end)
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

      if not free or not inactive or not speculative then
        return
      end

      local available = (free + inactive + speculative) * page_size
      callback(math.floor(((total - available) / total) * 100))
    end)
  end)
end

local function get_memory_usage_percent(callback)
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
  get_memory_usage_percent(function(percent)
    -- vim.print(percent)

    if percent >= 80 then
      if not notified then
        local msg = string.format("Warning: High memory usage (%.2f%%)", percent)
        NOTIFY(msg, levels.WARN)
        notified = true
      end
    end
  end)
end

uv.new_timer():start(0, 5000, check_memory)
