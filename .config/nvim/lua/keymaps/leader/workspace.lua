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
  ["<leader>W"] = { group = "Workspace" },
  ["<leader>Wf"] = {
    open_grug_far,
    desc = "Search and replace",
  },
  ["<leader>Wc"] = { "<cmd>SetWorkspacePathCustom<cr>", desc = "Custom path" },
  ["<leader>Wg"] = {
    "<cmd>SetWorkspacePathGlobal<cr>",
    desc = "Path to global",
  },
  ["<leader>Wl"] = {
    "<cmd>SetWorkspacePathLocal<cr>",
    desc = "Path to local",
  },
  ["<leader>Wp"] = {
    "<cmd>ShowWorkspacePath<cr>",
    desc = "Preview workspace path",
  },
  ["<leader>WS"] = { "<cmd>wa!<cr>", desc = "Save all content" },
  ["<leader>Wd"] = {
    function()
      require("telescope.builtin").diagnostics({ root_dir = GET_GIT_PATH() })
    end,
    desc = "Workspace Diagnostics",
  },
  ["<leader>Ws"] = { "<cmd>WorkspaceSymbols<cr>", desc = "Workspace Symbols" },
}
