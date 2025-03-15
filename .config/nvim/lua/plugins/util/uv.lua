return {
  "benomahony/uv.nvim",
  cond = executable("uv") and executable("python3"),
  ft = "python",
  opts = {
    keymaps = {
      prefix = "<leader>cuu",
    },
    execution = {
      run_command = "uv run python3",
      notification_timeout = 10000,
    },
  },
}
