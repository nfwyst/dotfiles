local disable_fuzzy = true

return {
  "hrsh7th/nvim-cmp",
  event = "InsertEnter",
  dependencies = {
    "onsails/lspkind.nvim",
    { "L3MON4D3/LuaSnip", build = "make install_jsregexp" },
    "saadparwaiz1/cmp_luasnip",
    "rafamadriz/friendly-snippets",
  },
  config = function()
    local cmp = require("cmp")
    local luasnip = require("luasnip")
    luasnip.log.set_loglevel("error")
    local lspkind = require("lspkind")
    local snip_loader = require("luasnip.loaders.from_vscode")
    snip_loader.lazy_load()
    snip_loader.lazy_load({ paths = { SNIPPET_PATH } })
    local border = MERGE_TABLE(cmp.config.window.bordered(), {
      scrollbar = false,
      col_offset = 1,
    })
    cmp.setup({
      enabled = function()
        return not TABLE_CONTAINS(INVALID_FILETYPE, vim.bo.filetype)
      end,
      snippet = {
        expand = function(args)
          luasnip.lsp_expand(args.body) -- For `luasnip` users.
        end,
      },
      mapping = cmp.mapping.preset.insert({
        ["<C-p>"] = cmp.mapping.select_prev_item(),
        ["<C-n>"] = cmp.mapping.select_next_item(),
        ["<C-b>"] = cmp.mapping(cmp.mapping.scroll_docs(-1), { "i", "c" }),
        ["<C-f>"] = cmp.mapping(cmp.mapping.scroll_docs(1), { "i", "c" }),
        ["<C-c>"] = cmp.mapping(cmp.mapping.complete(), { "i", "c" }),
        ["<C-y>"] = cmp.config.disable, -- Specify `cmp.config.disable` if you want to remove the default `<C-y>` mapping.
        ["<C-e>"] = cmp.mapping({
          i = cmp.mapping.abort(),
          c = cmp.mapping.close(),
        }),
        ["<CR>"] = cmp.mapping(function(fallback)
          -- use the internal non-blocking call to check if cmp is visible to work with minuet
          if cmp.core.view:visible() then
            return cmp.confirm({ select = true })
          end
          fallback()
        end),
        ["<Tab>"] = cmp.mapping(function(fallback)
          if cmp.visible() then
            cmp.select_next_item()
          elseif luasnip.jumpable(1) then
            luasnip.jump(1)
          else
            fallback()
          end
        end, { "s", "i" }),
        ["<S-Tab>"] = cmp.mapping(function(fallback)
          if cmp.visible() then
            cmp.select_prev_item()
          elseif luasnip.jumpable(-1) then
            luasnip.jump(-1)
          else
            fallback()
          end
        end, { "s", "i" }),
      }),
      formatting = {
        expandable_indicator = true,
        fields = { "abbr", "kind", "menu" },
        format = lspkind.cmp_format({
          maxwidth = 50,
          ellipsis_char = "...",
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
        { name = "luasnip", max_item_count = 3 },
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
