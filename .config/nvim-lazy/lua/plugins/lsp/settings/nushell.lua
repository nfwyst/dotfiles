FILETYPE_TASK_MAP.nu = function()
  if b.autoformat ~= nil then
    return
  end
  b.autoformat = false
end

return {
  cmd = { "nu", "--lsp" },
  filetypes = { "nu" },
  root_dir = GIT_ROOT,
  single_file_support = true,
  mason = false,
}
