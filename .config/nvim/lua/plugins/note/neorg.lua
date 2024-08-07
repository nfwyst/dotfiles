return {
  "nvim-neorg/neorg",
  cond = not IS_VSCODE_OR_LEET_CODE and not IS_LINUX,
  ft = "norg",
  cmd = "Neorg",
  config = function()
    require("neorg").setup({
      logger = {
        level = "fatal",
        use_file = false,
        use_console = false,
      },
      load = {
        ["core.defaults"] = {},
        ["core.concealer"] = {},
        ["core.summary"] = {},
        ["core.export"] = {},
        ["core.export.markdown"] = {},
        ["core.completion"] = {
          config = { engine = "nvim-cmp" },
        },
        ["core.dirman"] = {
          config = {
            default_workspace = "notes",
            workspaces = {
              notes = NOTE_DIR,
            },
          },
        },
        ["core.presenter"] = {
          config = {
            zen_mode = "zen-mode",
          },
        },
        ["core.keybinds"] = {
          config = {
            default_keybinds = true,
            neorg_leader = "<leader>n",
            hook = function(keybinds)
              local leader_keys = {
                "nn",
                "id",
              }
              local all_leader_keys = {
                "mn",
                "mh",
                "gO",
              }
              local keys = {
                "<c-space>",
                "<cr>",
                "gF",
                "<m-cr>",
              }
              for _, key in ipairs(all_leader_keys) do
                keybinds.unmap("all", "n", keybinds.leader .. key)
              end
              for _, key in ipairs(leader_keys) do
                keybinds.unmap("norg", "n", keybinds.leader .. key)
              end
              for _, key in ipairs(keys) do
                keybinds.unmap("norg", "n", key)
              end
            end,
          },
        },
      },
    })
  end,
}
