SET_OPTS({
  completeopt = { "menu", "menuone", "noselect" },
})

local function get_sources(cmp, names)
  local sources = {}
  for _, name in ipairs(names) do
    table.insert(sources, { name = name, max_item_count = 10 })
  end
  return cmp.config.sources(sources)
end

return {
  "hrsh7th/nvim-cmp",
  cond = not IS_VSCODE,
  event = "InsertEnter",
  dependencies = {
    "hrsh7th/cmp-buffer",
    "hrsh7th/cmp-path",
    "hrsh7th/cmp-nvim-lua",
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
        ["<C-k>"] = cmp.mapping.select_prev_item(),
        ["<C-j>"] = cmp.mapping.select_next_item(),
        ["<C-b>"] = cmp.mapping(cmp.mapping.scroll_docs(-1), { "i", "c" }),
        ["<C-f>"] = cmp.mapping(cmp.mapping.scroll_docs(1), { "i", "c" }),
        ["<C-l>"] = cmp.mapping(cmp.mapping.complete(), { "i", "c" }),
        ["<C-y>"] = cmp.config.disable, -- Specify `cmp.config.disable` if you want to remove the default `<C-y>` mapping.
        ["<C-e>"] = cmp.mapping({
          i = cmp.mapping.abort(),
          c = cmp.mapping.close(),
        }),
        -- Accept currently selected item. If none selected, `select` first item.
        -- Set `select` to `false` to only confirm explicitly selected items.
        ["<CR>"] = cmp.mapping.confirm({
          select = true,
        }),
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
      sources = get_sources(cmp, {
        "neorg",
        "luasnip",
        "nvim_lsp",
        "nvim_lua",
        "buffer",
        "path",
        "lazydev",
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
