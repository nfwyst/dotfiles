local ensure_installed = {
  ["kulala-fmt"] = "go install github.com/mistweaverco/kulala-fmt@latest",
}

-- TODO: auto install other dependencies
for cmd, install_cmd in pairs(ensure_installed) do
  local installed = executable(cmd)
  if not installed then
    fn.jobstart(install_cmd, {
      on_exit = function(_, code)
        local level = levels.INFO
        local status = "success"
        if code ~= 0 then
          level = levels.ERROR
          status = "failed"
        end

        NOTIFY(cmd .. " install " .. status, level)
      end,
    })
  end
end
