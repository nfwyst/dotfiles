return {
  "bngarren/checkmate.nvim",
  ft = { "markdown", "Avante", "codecompanion", "octo", "grug-far-help", "checkhealth" },
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
