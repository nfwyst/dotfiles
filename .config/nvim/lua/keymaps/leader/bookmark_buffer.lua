return {
  ["<leader>b"] = { group = "Bookmark/Buffer" },
  ["<leader>bo"] = { group = "Bookmark" },
  ["<leader>boa"] = { "<cmd>AddHarpoonFile<cr>", desc = "Harpoon add file" },
  ["<leader>bom"] = {
    "<cmd>Telescope harpoon marks<cr>",
    desc = "Harpoon marks",
  },
  ["<leader>bot"] = {
    "<cmd>ToggleHarpoonQuickMenu<cr>",
    desc = "Harpoon toggle quick menu",
  },
  ["<leader>bu"] = { group = "Buffer" },
  ["<leader>buc"] = { "<cmd>Bdelete<cr>", desc = "Close Buffer" },
  ["<leader>bul"] = {
    "<cmd>lua require('telescope.builtin').buffers(require('telescope.themes').get_dropdown{previewer = false})<cr>",
    desc = "List Buffer",
  },
}
