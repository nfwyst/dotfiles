return {
  "bngarren/checkmate.nvim",
  ft = vim.g.markdowns,
  opts = {
    files = {
      "*.md",
      "todo",
      "TODO",
      "*.todo",
    },
    todo_states = {
      unchecked = {
        marker = "[ ]",
      },
      checked = {
        marker = "[x]",
      },
    },
  },
}
