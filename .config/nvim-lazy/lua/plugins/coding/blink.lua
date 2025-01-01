return {
  "saghen/blink.cmp",
  dependencies = {
    {
      "saghen/blink.compat",
      optional = false,
      opts = function(_, opts)
        require("cmp").ConfirmBehavior = {
          Insert = "insert",
          Replace = "replace",
        }
        opts.impersonate_nvim_cmp = true
        return opts
      end,
    },
  },
  opts = function(_, opts)
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
    }

    return merge(opts, opt)
  end,
}
