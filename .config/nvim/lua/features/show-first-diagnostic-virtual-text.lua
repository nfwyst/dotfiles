local show_scopes = { "signs", "underline", "virtual_lines", "virtual_text" }

local eslint_checked = false
local function fix_eslint(msg)
  if STR_CONTAINS(msg, "Expected value but found invalid token at character 1") then
    return true
  end

  if STR_CONTAINS(msg, "eslintrc") then
    if not eslint_checked then
      pcall(cmd.MasonInstall, "eslint_d@13.1.2")
      eslint_checked = true
    end

    return true
  end

  return false
end

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
    if filtered or fix_eslint(diag.message) then
      return false
    end

    filtered_map[st] = true

    return true
  end, diagnostics)
end

for _, scope in ipairs(show_scopes) do
  local handler = diagnostic.handlers[scope]
  if handler then
    local show = handler.show
    handler.show = function(namespace, bufnr, diagnostics, opts)
      ---@diagnostic disable-next-line: need-check-nil
      show(namespace, bufnr, diagnostics_filter(diagnostics, fn.bufwinid(bufnr)), opts)
    end
  end
end
