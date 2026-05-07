
-- Work around snacks.dashboard firing both BufDelete and BufWipeout for the same buffer.
-- Upstream callback deletes its augroup twice in that path, which can raise E367.
local nvim_del_augroup_by_id = vim.api.nvim_del_augroup_by_id
vim.api.nvim_del_augroup_by_id = function(id)
  local ok, err = pcall(nvim_del_augroup_by_id, id)
  if ok then
    return
  end
  if type(err) == "string" and err:find("E367: No such group", 1, true) then
    return
  end
  error(err, 2)
end

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
  -- 7044: Parameter implicitly has an 'any' type (noisy in JS files)
  -- 1149: File appears to be a binary file
  { source = "ts", message = "File is a CommonJS module" },
  { source = "ts", codes = { 7016, 80001, 80006, 80007, 7044, 1149 } },
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
