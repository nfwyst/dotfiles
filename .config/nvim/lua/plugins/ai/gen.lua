return {
  "David-Kunz/gen.nvim",
  cond = not IS_VSCODE_OR_LEET_CODE,
  cmd = "Gen",
  config = function()
    require("gen").setup({
      model = "deepseek-coder-v2:16b-lite-instruct-q8_0", -- The default model to use.
      quit_map = "q", -- set keymap for close the response window
      retry_map = "<c-r>", -- set keymap to re-send the current prompt
      display_mode = "float", -- The display mode. Can be "float" or "split".
    })
  end,
}
