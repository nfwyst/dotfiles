return {
  'hrsh7th/cmp-buffer',
  event = 'InsertEnter',
  dependencies = {
    { 'hrsh7th/nvim-cmp' },
  },
  config = function()
    ADD_CMP_SOURCE('buffer', { priority = 5 })
  end,
}
