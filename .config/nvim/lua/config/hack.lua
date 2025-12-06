-- filter some diagnostics
local set = vim.diagnostic.set
local black_list = {
  { source = "eslint_d", message = "path::String" },
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

-- FIXME: fix indent guide not work for creating new file
vim.api.nvim_create_autocmd("BufNewFile", {
  group = vim.api.nvim_create_augroup("is_new_file", { clear = true }),
  callback = function(event)
    local bufnr = event.buf
    if not vim.b[bufnr].is_new_file_fixed then
      Snacks.indent.enable()
    end
    vim.b[bufnr].is_new_file_fixed = true
  end,
})
