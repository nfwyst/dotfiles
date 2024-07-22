return {
  ["<leader>g"] = { group = "Git" },
  ["<leader>gF"] = { "<cmd>FindRepoFiles<cr>", desc = "Find repo files" },
  ["<leader>gO"] = {
    "<cmd>Telescope git_status<cr>",
    desc = "Open changed file",
  },
  ["<leader>gR"] = {
    "<cmd>lua require 'gitsigns'.reset_buffer()<cr>",
    desc = "Reset buffer",
  },
  ["<leader>gT"] = { "<cmd>NeogitResetState<cr>", desc = "NeogitResetState" },
  ["<leader>ga"] = {
    "<cmd>DiffviewFileHistory<cr>",
    desc = "Diffview all file history",
  },
  ["<leader>gb"] = {
    "<cmd>Telescope git_branches<cr>",
    desc = "Checkout branch",
  },
  ["<leader>gc"] = { "<cmd>DiffviewClose<cr>", desc = "Close diffview" },
  ["<leader>gd"] = { "<cmd>Gitsigns diffthis HEAD<cr>", desc = "Diff head" },
  ["<leader>ge"] = { "<cmd>DiffviewRefresh<cr>", desc = "Diffview refresh" },
  ["<leader>gf"] = {
    "<cmd>DiffviewFocusFiles<cr>",
    desc = "Diffview focus files",
  },
  ["<leader>gg"] = { "<cmd>Neogit<cr>", desc = "Neogit" },
  ["<leader>gh"] = { "<cmd>FindIgnoredFiles<cr>", desc = "Find ignored files" },
  ["<leader>gi"] = {
    "<cmd>Telescope git_commits<cr>",
    desc = "Checkout commit",
  },
  ["<leader>gj"] = {
    "<cmd>lua require 'gitsigns'.next_hunk()<cr>",
    desc = "Next hunk",
  },
  ["<leader>gk"] = {
    "<cmd>lua require 'gitsigns'.prev_hunk()<cr>",
    desc = "Prev hunk",
  },
  ["<leader>gl"] = {
    "<cmd>lua require 'gitsigns'.blame_line()<cr>",
    desc = "Blame",
  },
  ["<leader>go"] = { "<cmd>DiffviewOpen<cr>", desc = "Open diffview" },
  ["<leader>gp"] = {
    "<cmd>lua require 'gitsigns'.preview_hunk()<cr>",
    desc = "Preview hunk",
  },
  ["<leader>gr"] = {
    "<cmd>lua require 'gitsigns'.reset_hunk()<cr>",
    desc = "Reset hunk",
  },
  ["<leader>gs"] = {
    "<cmd>lua require 'gitsigns'.stage_hunk()<cr>",
    desc = "Stage hunk",
  },
  ["<leader>gt"] = {
    "<cmd>DiffviewToggleFiles<cr>",
    desc = "Diffview toggle files",
  },
  ["<leader>gu"] = {
    "<cmd>lua require 'gitsigns'.undo_stage_hunk()<cr>",
    desc = "Undo stage hunk",
  },
  ["<leader>gy"] = {
    "<cmd>DiffviewFileHistory %<cr>",
    desc = "Diffview current file history",
  },
  ["<leader>gz"] = { "<cmd>ToggleLazygit<cr>", desc = "Lazygit" },
}
