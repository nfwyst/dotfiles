return {
  ['<leader>b'] = { group = 'Bookmark/Buffer' },
  ['<leader>bo'] = { group = 'Bookmark' },
  ['<leader>boa'] = { '<cmd>AddHarpoonFile<cr>', desc = 'Harpoon add file' },
  ['<leader>bob'] = {
    '<cmd>AddHarpoonBookmark<cr>',
    desc = 'Add bookmark',
  },
  ['<leader>bol'] = {
    '<cmd>ShowHarpoonBookmarks<cr>',
    desc = 'Show bookmark',
  },
  ['<leader>bom'] = {
    '<cmd>Telescope harpoon marks<cr>',
    desc = 'Harpoon marks',
  },
  ['<leader>bot'] = {
    '<cmd>ToggleHarpoonQuickMenu<cr>',
    desc = 'Harpoon toggle quick menu',
  },
  ['<leader>bu'] = { group = 'Buffer' },
  ['<leader>buc'] = { '<cmd>Bdelete<cr>', desc = 'Close Buffer' },
  ['<leader>buh'] = {
    function()
      SET_OPTS(GET_HIDE_COLUMN_OPTS(true), { buf = GET_CURRENT_BUFFER() })
    end,
    desc = 'Focus without left column',
  },
  ['<leader>bul'] = {
    '<cmd>Buffers<cr>',
    desc = 'List Buffer',
  },
}
