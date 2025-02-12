local virtual_text = diagnostic.handlers.virtual_text
local show = virtual_text.show
local eslint_fixed = false

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

    if not eslint_fixed then
      if STR_CONTAINS(diagnostic.message, "eslintrc") then
        pcall(cmd.MasonInstall, "eslint_d@13.1.2")
        eslint_fixed = true
      end
    end

    if filtered then
      return false
    end

    filtered_map[st] = true

    return true
  end, diagnostics)
end

virtual_text.show = function(namespace, bufnr, diagnostics, opts)
  show(namespace, bufnr, diagnostics_filter(diagnostics, fn.bufwinid(bufnr)), opts)
end
