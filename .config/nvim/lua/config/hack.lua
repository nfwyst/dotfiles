-- Filter noisy diagnostics from eslint_d and TypeScript.
-- Codes and patterns are defined here for easy maintenance.
local set = vim.diagnostic.set

local black_list = {
  -- eslint_d: suppress noisy messages
  { source = "eslint_d", message = "path::String" },
  { source = "eslint_d", message = "projectService" },
  -- TypeScript: suppress informational/noisy diagnostics
  -- 7016: Could not find a declaration file for module
  -- 80001: File is a CommonJS module; it may be converted to an ES module
  -- 80006: This may be converted to an async function
  -- 80007: 'await' has no effect on this expression
  -- 2305: Module has no exported member (often false positive with re-exports)
  -- 6387: Argument of type 'X | undefined' is not assignable (overly strict)
  -- 7044: Parameter implicitly has an 'any' type (noisy in JS files)
  -- 1149: File appears to be a binary file
  { source = "ts", message = "File is a CommonJS module" },
  { source = "ts", codes = { 7016, 80001, 80006, 80007, 2305, 6387, 7044, 1149 } },
}

vim.diagnostic.set = function(ns, bufnr, diagnostics, opts)
  local results = vim.tbl_filter(function(diagnostic)
    for _, black_item in ipairs(black_list) do
      if diagnostic.source == black_item.source then
        if black_item.message and string.match(diagnostic.message, black_item.message) then
          return false
        end
        if black_item.codes and vim.list_contains(black_item.codes, diagnostic.code) then
          return false
        end
      end
    end
    return true
  end, diagnostics)
  set(ns, bufnr, results, opts)
end
