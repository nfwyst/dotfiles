local exclude_filetypes = { 'lazy', 'TelescopePrompt', 'TelescopeResults' }

local function create_key(key, mode, func_name, desc)
  return {
    key,
    mode = mode,
    function()
      local filetype = GET_FILETYPE(GET_CURRENT_BUFFER())
      local disable_search = INCLUDES(exclude_filetypes, filetype)
      if disable_search then
        return
      end
      require('flash')[func_name]()
    end,
    desc = desc,
  }
end

return {
  'folke/flash.nvim',
  keys = {
    create_key('s', { 'n', 'o', 'x' }, 'jump', 'Flash'),
    create_key('S', { 'n', 'o', 'x' }, 'treesitter', 'Flash Treesitter'),
    create_key('r', 'o', 'remote', 'Remote Flash'),
    create_key('R', { 'o', 'x' }, 'treesitter_search', 'Treesitter Search'),
    create_key('<c-s>', 'c', 'toggle', 'Toggle Flash Search'),
  },
  config = true,
}
