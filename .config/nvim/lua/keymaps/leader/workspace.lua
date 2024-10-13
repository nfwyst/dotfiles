function get_buffer_extension()
  local ext
  if vim.bo.buftype == "" then
    ext = vim.fn.expand("%:e")
  end
  if not ext or ext == "" then
    return nil
  end
  return "*." .. ext
end

local function open_grug_far()
  require("grug-far").open({
    -- prefills = {
    --   filesFilter = get_buffer_extension(),
    -- },
  })
end

return {
  ["<leader>w"] = { group = "Workspace" },
  ["<leader>wf"] = {
    open_grug_far,
    desc = "Search and replace",
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
