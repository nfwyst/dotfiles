local key = "autoformat"

if g[key] then
  FILETYPE_TASK_MAP.nu = function(bufnr)
    if BUF_VAR(bufnr, key) ~= nil then
      return
    end

    BUF_VAR(bufnr, key, false)
  end
end

return {
  cmd = { "nu", "--lsp" },
  filetypes = { "nu" },
  root_dir = GIT_ROOT,
  single_file_support = true,
  mason = false,
}
