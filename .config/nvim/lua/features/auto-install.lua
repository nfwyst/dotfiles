local ensure_installed = {
  latex2text = {
    installer = "uv",
    params_mac = "pip install pylatexenc --system --break-system-packages",
    params_linux = "pip install pylatexenc",
  },
  grpcurl = {
    installer = "go",
    params = "install github.com/fullstorydev/grpcurl/cmd/grpcurl@latest",
  },
  bun = {
    installer = "curl",
    params = "-fsSL https://bun.sh/install | bash",
  },
  mmdc = {
    installer = "bun",
    params = "install -g @mermaid-js/mermaid-cli",
  },
  websocat = {
    installer = "cargo",
    params = "install websocat",
  },
}

for cmd, opt in pairs(ensure_installed) do
  local installed = executable(cmd)
  local installer = opt.installer
  if not installed and executable(installer) then
    NOTIFY("installing " .. cmd .. "...", levels.INFO)

    local stderr_buffer = {}
    local params = opt.params
    if not params then
      if IS_LINUX then
        params = opt.params_linux
      else
        params = opt.params_mac
      end

      if not params then
        return
      end
    end

    fn.jobstart(installer .. " " .. params, {
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
end
