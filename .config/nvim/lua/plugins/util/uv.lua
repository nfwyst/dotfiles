return {
  "benomahony/uv.nvim",
  cond = vim.fn.executable("uv") == 1 and vim.fn.executable("python3") == 1,
  ft = "python",
  opts = {
    keymaps = {
      prefix = "<leader>cUu",
    },
    execution = {
      run_command = "uv run python3",
      notification_timeout = 10000,
    },
  },
}
