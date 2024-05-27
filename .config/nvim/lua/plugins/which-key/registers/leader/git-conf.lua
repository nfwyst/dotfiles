return {
	name = "Git",
	z = { "<cmd>ToggleLazygit<cr>", "Lazygit" },
	g = { "<cmd>Neogit<cr>", "Neogit" },
	T = { "<cmd>NeogitResetState<cr>", "NeogitResetState" },
	j = { "<cmd>lua require 'gitsigns'.next_hunk()<cr>", "Next hunk" },
	k = { "<cmd>lua require 'gitsigns'.prev_hunk()<cr>", "Prev hunk" },
	l = { "<cmd>lua require 'gitsigns'.blame_line()<cr>", "Blame" },
	p = { "<cmd>lua require 'gitsigns'.preview_hunk()<cr>", "Preview hunk" },
	r = { "<cmd>lua require 'gitsigns'.reset_hunk()<cr>", "Reset hunk" },
	R = { "<cmd>lua require 'gitsigns'.reset_buffer()<cr>", "Reset buffer" },
	s = { "<cmd>lua require 'gitsigns'.stage_hunk()<cr>", "Stage hunk" },
	u = { "<cmd>lua require 'gitsigns'.undo_stage_hunk()<cr>", "Undo stage hunk" },
	O = { "<cmd>Telescope git_status<cr>", "Open changed file" },
	b = { "<cmd>Telescope git_branches<cr>", "Checkout branch" },
	i = { "<cmd>Telescope git_commits<cr>", "Checkout commit" },
	d = { "<cmd>Gitsigns diffthis HEAD<cr>", "Diff head" },
	F = { "<cmd>FindFilesWithGit<cr>", "Find git files" },
	h = { "<cmd>FindGitHiddenFiles<cr>", "Find hidden files" },
	o = { "<cmd>DiffviewOpen<cr>", "Open diffview" },
	c = { "<cmd>DiffviewClose<cr>", "Close diffview" },
	t = { "<cmd>DiffviewToggleFiles<cr>", "Diffview toggle files" },
	f = { "<cmd>DiffviewFocusFiles<cr>", "Diffview focus files" },
	e = { "<cmd>DiffviewRefresh<cr>", "Diffview refresh" },
	y = { "<cmd>DiffviewFileHistory %<cr>", "Diffview current file history" },
	a = { "<cmd>DiffviewFileHistory<cr>", "Diffview all file history" },
}
