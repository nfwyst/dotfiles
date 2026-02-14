local function get_by_cmdtype(search_val, cmd_val, default)
  local cmdtype = vim.fn.getcmdtype()
  if vim.list_contains({ "/", "?" }, cmdtype) then
    return search_val
  end

  if vim.list_contains({ ":", "@" }, cmdtype) then
    return cmd_val
  end

  return default
end

return {
  "saghen/blink.cmp",
  build = "cargo build --release",
  keys = {
    { "<leader>c/", "<cmd>%s/\\r//g<cr>", desc = "Remove All Enter Character" },
  },
  opts = function(_, opts)
    -- vim.list_extend(opts.sources.default, { "minuet" })

    local opt = {
      completion = {
        menu = {
          border = "rounded",
          scrollbar = false,
          direction_priority = { "n", "s" },
          cmdline_position = function()
            local pos = vim.g.ui_cmdline_pos
            if pos then
              return { pos[1] + get_by_cmdtype(-1, 0, 0), pos[2] }
            end
            local ch = vim.o.cmdheight
            local height = (ch == 0) and 1 or ch
            return { vim.o.lines - height, 0 }
          end,
          draw = {
            columns = { { "label", "label_description", gap = 1 }, { "kind_icon", "kind" }, { "source_name" } },
          },
        },
        documentation = { window = { border = "rounded" } },
      },
      signature = { window = { border = "rounded" } },
      sources = {
        providers = {
          -- minuet = {
          --   name = "minuet",
          --   module = "minuet.blink",
          --   async = true,
          --   timeout_ms = 3000,
          --   score_offset = 100,
          -- },
          snippets = {
            min_keyword_length = 1,
            opts = {
              search_paths = { vim.fn.stdpath("config") .. "/snippets" },
            },
          },
          buffer = {
            min_keyword_length = 2,
          },
          path = {
            opts = {
              label_trailing_slash = true,
              show_hidden_files_by_default = true,
            },
          },
        },
      },
      cmdline = {
        keymap = {
          ["<c-l>"] = { "show", "fallback" },
          ["<c-e>"] = { "cancel", "fallback" },
        },
        sources = function()
          return get_by_cmdtype({ "buffer" }, { "cmdline", "lsp" }, {})
        end,
        completion = {
          ghost_text = {
            enabled = function()
              return get_by_cmdtype(true, false, false)
            end,
          },
        },
      },
      keymap = { ["<c-l>"] = { "show", "fallback" } },
      fuzzy = {
        implementation = "rust",
        prebuilt_binaries = { ignore_version_mismatch = false },
      },
    }

    return vim.tbl_deep_extend("force", opts, opt)
  end,
}
