-- filter some diagnostics
local set = vim.diagnostic.set
local black_list = {
  { source = "eslint_d", message = "Definition for rule" },
  { source = "eslint_d", message = "Could not find config file" },
  { source = "eslint_d", message = "File ignored" },
  { source = "ts", message = "File is a CommonJS module" },
}
vim.diagnostic.set = function(ns, bufnr, diagnostics, opts)
  local results = vim.tbl_filter(function(diagnostic)
    for _, black_item in ipairs(black_list) do
      if string.match(diagnostic.message, black_item.message) and diagnostic.source == black_item.source then
        return false
      end
    end
    return true
  end, diagnostics)
  set(ns, bufnr, results, opts)
end

-- FIXME: fix goto next/prev diagnostic window flashed by
local next = vim.diagnostic.goto_next
local prev = vim.diagnostic.goto_prev
vim.diagnostic.goto_next = function(opt)
  ---@diagnostic disable-next-line: inject-field
  opt.float = false
  next(opt)
end
vim.diagnostic.goto_prev = function(opt)
  ---@diagnostic disable-next-line: inject-field
  opt.float = false
  prev(opt)
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
