return {
  ["<leader>w"] = { group = "Workspace" },
  ["<leader>wf"] = { group = "Find and replace" },
  ["<leader>wft"] = {
    "<cmd>lua require('spectre').toggle()<cr>",
    desc = "Toggle spectre",
  },
  ["<leader>wfu"] = {
    "<cmd>lua require('pickers.spectre').toggle()<cr>",
    desc = "Toggle spectre ui",
  },
  ["<leader>wfi"] = {
    "<cmd>ToggleSpectreCase<cr>",
    desc = "Toggle ignore case",
  },
  ["<leader>wfh"] = {
    "<cmd>ToggleSpectreHidden<cr>",
    desc = "Toggle search hidden",
  },
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
