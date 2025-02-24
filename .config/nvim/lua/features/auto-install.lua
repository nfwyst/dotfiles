local ensure_installed = {
  ["kulala-fmt"] = {
    installer = "go",
    params = "install github.com/mistweaverco/kulala-fmt@latest",
  },
  ["sg"] = {
    installer = "cargo",
    params = "install ast-grep --locked",
  },
  ["latex2text"] = {
    installer = "uv",
    params = "pip install pylatexenc --system --break-system-packages",
  },
}

for cmd, opt in pairs(ensure_installed) do
  local installed = executable(cmd)
  local installer = opt.installer
  if not installed and executable(installer) then
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

        NOTIFY(cmd .. " install " .. status .. details, level)
      end,
    })
  end
end
