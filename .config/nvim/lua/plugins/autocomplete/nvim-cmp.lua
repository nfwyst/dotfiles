local disable_fuzzy = true

local function get_onjump(step, cmp, luasnip)
  return function(fallback)
    if cmp.visible() then
      if step < 0 then
        return cmp.select_prev_item()
      end
      return cmp.select_next_item()
    end
    if luasnip.jumpable(step) then
      return luasnip.jump(step)
    end
    return fallback()
  end
end

return {
  'hrsh7th/nvim-cmp',
  event = 'InsertEnter',
  dependencies = {
    'onsails/lspkind.nvim',
    { 'L3MON4D3/LuaSnip', build = 'make install_jsregexp' },
    'saadparwaiz1/cmp_luasnip',
    'rafamadriz/friendly-snippets',
  },
  config = function()
    local cmp = require('cmp')
    local luasnip = require('luasnip')
    luasnip.log.set_loglevel('error')
    local lspkind = require('lspkind')
    local snip_loader = require('luasnip.loaders.from_vscode')
    snip_loader.lazy_load()
    snip_loader.lazy_load({ paths = { SNIPPET_PATH } })
    local border = MERGE_TABLE(cmp.config.window.bordered(), {
      scrollbar = false,
      col_offset = 1,
    })
    cmp.setup({
      enabled = function()
        return FILETYPE_VALID(GET_CURRENT_BUFFER())
      end,
      snippet = {
        expand = function(args)
          luasnip.lsp_expand(args.body) -- For `luasnip` users.
        end,
      },
      mapping = cmp.mapping.preset.insert({
        ['<c-p>'] = cmp.mapping.select_prev_item(),
        ['<c-n>'] = cmp.mapping.select_next_item(),
        ['<c-b>'] = cmp.mapping(cmp.mapping.scroll_docs(-1), { 'i', 'c' }),
        ['<c-f>'] = cmp.mapping(cmp.mapping.scroll_docs(1), { 'i', 'c' }),
        ['<c-c>'] = cmp.mapping(cmp.mapping.complete(), { 'i', 'c' }),
        ['<c-y>'] = cmp.config.disable, -- Specify `cmp.config.disable` if you want to remove the default `<c-y>` mapping.
        ['<c-e>'] = cmp.mapping({
          i = cmp.mapping.abort(),
          c = cmp.mapping.close(),
        }),
        ['<cr>'] = cmp.mapping(function(fallback)
          -- use the internal non-blocking call to check if cmp is visible to work with minuet
          if cmp.core.view:visible() then
            return cmp.confirm({ select = true })
          end
          fallback()
        end),
        ['<tab>'] = cmp.mapping(get_onjump(1, cmp, luasnip), { 's', 'i' }),
        ['<s-tab>'] = cmp.mapping(get_onjump(-1, cmp, luasnip), { 's', 'i' }),
      }),
      formatting = {
        expandable_indicator = true,
        fields = { 'abbr', 'kind', 'menu' },
        format = lspkind.cmp_format({
          maxwidth = 50,
          ellipsis_char = '...',
        }),
      },
      matching = {
        disallow_fuzzy_matching = disable_fuzzy,
        disallow_fullfuzzy_matching = disable_fuzzy,
        disallow_partial_fuzzy_matching = disable_fuzzy,
        disallow_prefix_unmatching = disable_fuzzy,
      },
      performance = {
        fetching_timeout = 2000,
      },
      sources = cmp.config.sources({
        { name = 'luasnip', max_item_count = 3, priority = 8 },
      }),
      window = {
        completion = border,
        documentation = border,
      },
      experimental = {
        ghost_text = false,
        native_menu = false,
      },
    })
  end,
}
