local kd = { kind = "auto" }

return {
  "neogitorg/neogit",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "nvim-telescope/telescope.nvim",
    "sindrets/diffview.nvim",
  },
  cmd = { "Neogit", "NeogitResetState" },
  config = function()
    require("neogit").setup({
      disable_commit_confirmation = true,
      disable_insert_on_commit = "auto",
      kind = "tab",
      commit_editor = kd,
      commit_select_view = kd,
      log_view = kd,
      reflog_view = kd,
      integrations = {
        telescope = true,
        diffview = true,
      },
      signs = {
        hunk = { "", "" },
        item = { "", "" },
        section = { "", "" },
      },
    })
  end,
}
