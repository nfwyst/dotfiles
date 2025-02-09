local virtual_text = diagnostic.handlers.virtual_text
local show = virtual_text.show

local diagnostics_filter = function(diagnostics, win)
  local row = WIN_CURSOR(win)[1]
  local filtered_map = {
    [severity.ERROR] = false,
    [severity.WARN] = false,
    [severity.HINT] = false,
    [severity.INFO] = false,
  }

  table.sort(diagnostics, function(a, b)
    return math.abs(a.lnum - row) < math.abs(b.lnum - row)
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
  show(namespace, bufnr, diagnostics_filter(diagnostics, fn.bufwinid(bufnr)), opts)
end
