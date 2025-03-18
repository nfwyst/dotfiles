local show_scopes = { "signs", "underline", "virtual_lines", "virtual_text" }
local no_eslint_config_msg = "Expected value but found invalid token at character 1"

local diagnostics_filter = function(diagnostics, win)
  if not api.nvim_win_is_valid(win) then
    return diagnostics
  end

  local row = WIN_CURSOR(win)[1]
  local filtered_map = {
    [severity.ERROR] = false,
    [severity.WARN] = false,
    [severity.HINT] = false,
    [severity.INFO] = false,
  }

  table.sort(diagnostics, function(cur, next)
    return math.abs(cur.lnum - row) < math.abs(next.lnum - row)
  end)

  return filter(function(diag)
    local st = diag.severity
    local filtered = filtered_map[st]
    if filtered then
      return false
    end

    if STR_CONTAINS(diag.message, no_eslint_config_msg) then
      return false
    end

    filtered_map[st] = true

    return true
  end, diagnostics)
end

for _, scope in ipairs(show_scopes) do
  local handler = diagnostic.handlers[scope]
  if not handler then
    return
  end

  local show = handler.show
  handler.show = function(namespace, bufnr, diagnostics, opts)
    ---@diagnostic disable-next-line: need-check-nil
    show(namespace, bufnr, diagnostics_filter(diagnostics, fn.bufwinid(bufnr)), opts)
  end
end

local diagnostic_cmd

local function is_fe_ft(buf)
  local filetype = OPT("filetype", { buf = buf })
  return contains(FE_FILETYPES, filetype)
end

local eslint_checked = false
local eslint_installed = IS_FILEPATH(ESLINT_BIN_PATH)
diagnostic_cmd = AUCMD("DiagnosticChanged", {
  callback = function(event)
    if not eslint_checked and eslint_installed then
      eslint_checked = true
      local version = fn.system(ESLINT_BIN_PATH .. " --version")
      if STR_CONTAINS(version, "13.1.2") then
        return api.nvim_del_autocmd(diagnostic_cmd)
      end
    end

    if not is_fe_ft(event.buf) then
      return
    end

    if not eslint_installed then
      return pcall(cmd.MasonInstall, "eslint_d")
    end

    local diagnostic = event.data.diagnostics[1]
    if not diagnostic then
      return
    end

    if STR_CONTAINS(diagnostic.message, "eslintrc") then
      pcall(cmd.MasonInstall, "eslint_d@13.1.2")
    end

    api.nvim_del_autocmd(diagnostic_cmd)
  end,
})
