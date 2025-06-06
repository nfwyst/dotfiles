local function init(noice, lsp)
  SET_KEY_MAPS({
    c = {
      {
        lhs = '<c-r>',
        rhs = function()
          noice.redirect(vim.fn.getcmdline())
        end,
        opts = {
          desc = 'Redirect Cmdline',
        },
      },
    },
    [{ 'i', 'n', 's' }] = {
      {
        lhs = '<c-f>',
        rhs = function()
          if not lsp.scroll(4) then
            return '<c-f>'
          end
        end,
        opts = {
          silent = true,
          expr = true,
          desc = 'Scroll forward',
        },
      },
      {
        lhs = '<c-b>',
        rhs = function()
          if not lsp.scroll(-4) then
            return '<c-b>'
          end
        end,
        opts = {
          silent = true,
          expr = true,
          desc = 'Scroll backward',
        },
      },
    },
  })
end

local function get_size(multiple)
  local max_width = GET_MAX_WIDTH(multiple)
  local min_width = 15
  if min_width >= max_width then
    min_width = max_width - 2
  end
  min_width = min_width < 0 and 0 or min_width
  return { max_width = max_width, min_width = min_width, width = 'auto' }
end

return {
  'folke/noice.nvim',
  dependencies = {
    'MunifTanjim/nui.nvim',
    'rcarriga/nvim-notify',
  },
  config = function()
    local M = require('noice.util.call')
    function M:log() end
    local noice = require('noice')
    init(noice, require('noice.lsp'))
    noice.setup({
      health = {
        checker = false,
      },
      routes = {
        {
          filter = {
            event = 'msg_show',
            any = {
              { find = '; after #%d+' },
              { find = '; before #%d+' },
              { find = '%d fewer lines' },
              { find = '%d more lines' },
              { find = '%d+L, %d+B' },
              { find = '%d+ lines ' },
              { find = 'No lines in buffer' },
              { find = 'No information available' },
              { find = 'not found:' },
              { find = 'hit BOTTOM' },
              { find = 'hit TOP' },
              { find = 'No fold found' },
              { find = 'filetype unknown' },
            },
          },
          opts = { skip = true },
        },
        {
          filter = {
            event = 'notify',
            any = {
              { find = 'method textDocument' },
              { find = 'Invalid commentstring' },
              { find = 'Client %d quit with' },
            },
          },
          opts = { skip = true },
        },
      },
      messages = {
        view_search = false,
      },
      lsp = {
        hover = {
          silent = true,
        },
        progress = {
          enabled = false,
        },
        override = {
          ['vim.lsp.util.convert_input_to_markdown_lines'] = true,
          ['vim.lsp.util.stylize_markdown'] = true,
          ['cmp.entry.get_documentation'] = true,
        },
        signature = {
          auto_open = {
            enabled = false,
          },
        },
      },
      views = {
        hover = {
          scrollbar = false,
          border = {
            style = 'rounded',
            padding = { 0, 1 },
          },
          size = get_size(),
          position = { row = 2, col = 2 },
        },
        cmdline_popup = {
          size = get_size(4),
        },
      },
      presets = {
        bottom_search = true,
        command_palette = true,
        long_message_to_split = true,
      },
    })
  end,
}
