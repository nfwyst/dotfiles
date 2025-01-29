local virtual_text = diagnostic.handlers.virtual_text
local show = virtual_text.show

local diagnostics_filter = function(diagnostics)
  local filtered_map = {
    [severity.ERROR] = false,
    [severity.WARN] = false,
    [severity.HINT] = false,
    [severity.INFO] = false,
  }

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
  show(namespace, bufnr, diagnostics_filter(diagnostics), opts)
end
