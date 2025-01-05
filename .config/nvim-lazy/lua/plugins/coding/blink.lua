return {
  "saghen/blink.cmp",
  dependencies = { "saghen/blink.compat" },
  opts = function(_, opts)
    require("cmp").ConfirmBehavior = {
      Insert = "insert",
      Replace = "replace",
    }

    local link = { link = "FloatBorder" }
    SET_HLS({
      BlinkCmpMenuBorder = link,
      BlinkCmpDocBorder = link,
      BlinkCmpSignatureHelpBorder = link,
      Pmenu = { bg = "NONE" },
    })

    push_list(opts.sources.compat, {
      "obsidian",
      "obsidian_new",
      "obsidian_tags",
      "avante_commands",
      "avante_mentions",
      "avante_files",
    })

    PUSH(opts.sources.default, "markdown")

    local opt = {
      completion = {
        menu = {
          border = "rounded",
        },
        documentation = {
          window = {
            border = "rounded",
          },
        },
      },
      sources = {
        providers = {
          markdown = {
            name = "RenderMarkdown",
            module = "render-markdown.integ.blink",
            fallbacks = { "lsp" },
          },
        },
      },
    }

    return merge(opts, opt)
  end,
}
