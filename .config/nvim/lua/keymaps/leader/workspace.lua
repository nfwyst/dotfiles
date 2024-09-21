return {
  ["<leader>w"] = { group = "Workspace" },
  ["<leader>wc"] = { "<cmd>SetWorkspacePathCustom<cr>", desc = "Custom path" },
  ["<leader>wg"] = {
    "<cmd>SetWorkspacePathGlobal<cr>",
    desc = "Path to global",
  },
  ["<leader>wl"] = {
    "<cmd>SetWorkspacePathLocal<cr>",
    desc = "Path to local",
  },
  ["<leader>wp"] = {
    "<cmd>ShowWorkspacePath<cr>",
    desc = "Preview workspace path",
  },
  ["<leader>wS"] = { "<cmd>wa!<cr>", desc = "Save all content" },
  ["<leader>wd"] = {
    function()
      require("telescope.builtin").diagnostics({ root_dir = GET_GIT_PATH() })
    end,
    desc = "Workspace Diagnostics",
  },
  ["<leader>ws"] = { "<cmd>WorkspaceSymbols<cr>", desc = "Workspace Symbols" },
}
