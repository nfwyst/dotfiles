local function get_prev_bufpath()
  local alt_bufnr = vim.fn.bufnr("#")
  if alt_bufnr ~= -1 then
    return GET_BUFFER_PATH(alt_bufnr)
  end
end

local mappings = {
  ["<leader>A"] = { "<cmd>Alpha<cr>", desc = "Alpha" },
  ["<leader>C"] = { "<cmd>FindTextCursor<cr>", desc = "Find text under cursor" },
  ["<leader>E"] = { "<cmd>EmmetInstall<cr>", desc = "Enable emmet" },
  ["<leader>F"] = { "<cmd>FindText<cr>", desc = "Find text" },
  ["<leader>G"] = { "<cmd>source $MYVIMRC<cr>", desc = "Reload nvim config" },
  ["<leader>H"] = { TOGGLE_INLAY_HINT, desc = "Toggle inlay hint" },
  ["<leader>'"] = {
    function()
      local bufpath = get_prev_bufpath()
      if bufpath then
        vim.cmd.edit(bufpath)
      end
    end,
    desc = "Alternate buffer",
  },
  ["<leader>I"] = { "<cmd>set modifiable<cr>", desc = "Set modifiable" },
  ["<leader>L"] = { "<cmd>Lazy<cr>", desc = "Open lazy installer" },
  ["<leader>P"] = { "<cmd>FindTextWithPath<cr>", desc = "Find text by path" },
  ["<leader>Q"] = { "<cmd>ccl<cr>", desc = "Close QuickFix" },
  ["<leader>R"] = {
    "<cmd>Telescope oldfiles<cr>",
    desc = "Recently used files global",
  },
  ["<leader>S"] = {
    "<cmd>set ignorecase!<cr>",
    desc = "Toggle case sensitive",
  },
  ["<leader>T"] = {
    "<cmd>FindTextByFileType<cr>",
    desc = "Find text by filetype",
  },
  ["<leader>U"] = { "<cmd>Telescope undo<cr>", desc = "Undo history" },
  ["<leader>X"] = {
    "<cmd>FindTextByPattern<cr>",
    desc = "Find text by filetype",
  },
  ["<leader>e"] = { "<cmd>NvimTreeToggle<cr>", desc = "File tree" },
  ["<leader>f"] = { "<cmd>FindFiles<cr>", desc = "Find files" },
  ["<leader>j"] = { "<cmd>Telescope jumplist<cr>", desc = "Jumplist" },
  ["<leader>m"] = { "<cmd>Mason<cr>", desc = "Open mason installer" },
  ["<leader>p"] = { "<cmd>Telescope projects<cr>", desc = "Projects" },
  ["<leader>q"] = { "<cmd>Quit<cr>", desc = "Force quit" },
  ["<leader>r"] = {
    "<cmd>Telescope oldfiles only_cwd=true<cr>",
    desc = "Recently used files",
  },
  ["<leader>s"] = { ":'<,'>!sort<cr>", desc = "Sort selected" },
  ["<leader>u"] = { "<cmd>nohlsearch<cr>", desc = "No highlight" },
  ["<leader>v"] = { "<cmd>ShowFilePath<cr>", desc = "Show file path" },
  ["<leader>w"] = { "<cmd>Save<cr>", desc = "Save" },
  ["<leader>x"] = { "<cmd>SaveThenQuit<cr>", desc = "Save and quit" },
  ["<leader>z"] = { "<cmd>ZenMode<cr>", desc = "Zen mode" },
  ["<leader>ot"] = { "<cmd>Outline<cr>", desc = "Toggle outline" },
}

local prefix = "keymaps.leader."
return function(wk)
  local configs = {
    mappings,
    require(prefix .. "ai_ast"),
    require(prefix .. "bookmark_buffer"),
    require(prefix .. "comment_copy"),
    require(prefix .. "debug_doc"),
    require(prefix .. "git"),
    require(prefix .. "lsp_learn"),
    require(prefix .. "note_nav_notify"),
    require(prefix .. "term_test_timer_tab"),
    require(prefix .. "workspace"),
  }
  for _, config in ipairs(configs) do
    wk.add(config)
  end
end
