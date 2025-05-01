local ensure_installed = {
  latex2text = {
    installer = "uv",
    params = "pip install pylatexenc --system --break-system-packages",
  },
  grpcurl = {
    installer = "brew",
    params = "install grpcurl",
  },
  bun = {
    installer = "brew",
    params = "install oven-sh/bun/bun",
  },
  mmdc = {
    installer = "bun",
    params = "install -g @mermaid-js/mermaid-cli",
  },
  websocat = {
    installer = "brew",
    params = "install websocat",
  },
  ["tree-sitter"] = {
    installer = "brew",
    params = "install tree-sitter",
  },
  ["chrome-headless-shell"] = {
    installer = "bun",
    params = "x puppeteer browsers install chrome-headless-shell",
    when = function()
      return not IS_DIRPATH(HOME_PATH .. "/.cache/puppeteer/chrome-headless-shell")
    end,
  },
}

local function install(cmd, opt)
  local installed = executable(cmd)
  if installed then
    return
  end

  local when = opt.when
  if when and not when() then
    return
  end

  local installer = opt.installer
  if not executable(installer) then
    return
  end

  NOTIFY("installing " .. cmd .. "...", levels.INFO)

  local stderr_buffer = {}
  fn.jobstart(installer .. " " .. opt.params, {
    on_stderr = function(_, data)
      for _, line in ipairs(data) do
        if not EMPTY(line) then
          PUSH(stderr_buffer, line)
        end
      end
    end,

    on_exit = function(_, code)
      local level = levels.INFO
      local status = "success"
      local details = ""
      if code ~= 0 then
        level = levels.ERROR
        status = "failed"
        details = "\n" .. table.concat(stderr_buffer, "\n")
      end

      if opt.post_install then
        opt.post_install()
      end

      NOTIFY(cmd .. " install " .. status .. details, level)
    end,
  })
end

for cmd, opt in pairs(ensure_installed) do
  install(cmd, opt)
end
