return {
  "nvim-pack/nvim-spectre",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "grapp-dev/nui-components.nvim",
    dependencies = {
      "MunifTanjim/nui.nvim",
    },
  },
  config = function()
    require("spectre").setup({
      open_cmd = "noswapfile vnew",
    })
    SET_HL({
      NuiComponentsTreeNodeFocused = { link = "CursorLine" },
    })
  end,
}
