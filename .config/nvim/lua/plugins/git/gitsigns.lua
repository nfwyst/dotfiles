return {
  'lewis6991/gitsigns.nvim',
  cond = HAS_GIT_ROOT,
  event = { 'BufReadPre', 'BufNewFile' },
  opts = {
    signs = {
      add = { text = '+' },
      change = { text = '~' },
      delete = { text = '-' },
      topdelete = { text = '▔' },
      changedelete = { text = '~' },
      untracked = { text = '┆' },
    },
    max_file_length = MAX_FILE_LENGTH,
    update_debounce = 500,
    preview_config = {
      border = 'rounded',
    },
  },
}
