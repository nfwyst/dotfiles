return {
  'hrsh7th/cmp-path',
  event = 'InsertEnter',
  dependencies = {
    { 'hrsh7th/nvim-cmp' },
  },
  config = function()
    ADD_CMP_SOURCE('path', { priority = 10 })
  end,
}
