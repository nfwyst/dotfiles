return {
  "hrsh7th/cmp-nvim-lua",
  event = "InsertEnter",
  ft = "lua",
  dependencies = {
    { "hrsh7th/nvim-cmp" },
  },
  config = function()
    ADD_CMP_SOURCE("nvim_lua")
  end,
}
