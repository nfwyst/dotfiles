return {
  "bngarren/checkmate.nvim",
  ft = "markdown",
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
