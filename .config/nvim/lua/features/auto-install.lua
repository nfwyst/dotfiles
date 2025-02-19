local ensure_installed = {
  ["kulala-fmt"] = "go install github.com/mistweaverco/kulala-fmt@latest",
}

-- TODO: auto install other dependencies
for cmd, install_cmd in pairs(ensure_installed) do
  local installed = executable(cmd)
  if not installed then
    NOTIFY("installing " .. cmd .. "...", levels.INFO)

    local stderr_buffer = {}
    fn.jobstart(install_cmd, {
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
