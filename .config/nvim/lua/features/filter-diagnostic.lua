local eslint_checked = false
local function is_eslint_issue(msg)
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

  return filter(function(diag)
    if is_eslint_issue(diag.message) then
      return false
    end

    return true
  end, diagnostics)
end

local signs_handler = diagnostic.handlers.signs
if signs_handler then
  local origin_show = signs_handler.show
  signs_handler.show = function(namespace, bufnr, diagnostics, opts)
    local filtered_diagnostics = diagnostics_filter(diagnostics, fn.bufwinid(bufnr))
    if origin_show then
      origin_show(namespace, bufnr, filtered_diagnostics, opts)
    end
  end
end
