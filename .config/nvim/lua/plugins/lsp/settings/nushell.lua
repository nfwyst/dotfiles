return {
  cmd = { "nu", "--lsp" },
  filetypes = { "nu" },
  root_dir = function()
    local source = vim.api.nvim_get_current_buf()
    local root = vim.fs.root(source, ".git")

    if root then
      return root
    end

    local cwd = vim.uv.cwd()

    if not cwd then
      return
    end

    return vim.fs.root(cwd, ".git")
  end,
  single_file_support = true,
  mason = false,
}
