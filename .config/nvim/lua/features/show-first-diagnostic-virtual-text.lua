local virtual_text = diagnostic.handlers.virtual_text
local show = virtual_text.show

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

  return filter(function(diagnostic)
    local st = diagnostic.severity
    local filtered = filtered_map[st]
    if filtered then
      return false
    end

    filtered_map[st] = true

    return true
  end, diagnostics)
end

virtual_text.show = function(namespace, bufnr, diagnostics, opts)
  ---@diagnostic disable-next-line: need-check-nil
  show(namespace, bufnr, diagnostics_filter(diagnostics, fn.bufwinid(bufnr)), opts)
end

local diagnostic_cmd

local function is_fe_ft(buf)
  local filetype = OPT("filetype", { buf = buf })
  return contains({
    "javascript",
    "typescript",
    "javascriptreact",
    "typescriptreact",
  }, filetype)
end

local eslint_checked = false
diagnostic_cmd = AUCMD("DiagnosticChanged", {
  callback = function(event)
    local diagnostic = event.data.diagnostics[1]
    if not diagnostic then
      return
    end

    if STR_CONTAINS(diagnostic.message, "eslintrc") then
      pcall(cmd.MasonInstall, "eslint_d@13.1.2")
      api.nvim_del_autocmd(diagnostic_cmd)
    elseif is_fe_ft(event.buf) then
      api.nvim_del_autocmd(diagnostic_cmd)
    end

    if not eslint_checked then
      local version = fn.system(ESLINT_BIN_PATH .. " --version")
      if STR_CONTAINS(version, "13.1.2") then
        api.nvim_del_autocmd(diagnostic_cmd)
      end
      eslint_checked = true
    end
  end,
})
