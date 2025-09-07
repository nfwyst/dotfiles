local function get_by_cmdtype(search_val, cmd_val, default)
  local cmdtype = vim.fn.getcmdtype()
  if vim.tbl_contains({ "/", "?" }, cmdtype) then
    return search_val
  end

  if vim.tbl_contains({ ":", "@" }, cmdtype) then
    return cmd_val
  end

  return default
end

local cancel = { "cancel", "fallback" }

return {
  "saghen/blink.cmp",
  event = "CmdlineEnter",
  build = "cargo build --release",
  dependencies = {
    "moyiz/blink-emoji.nvim",
    "Kaiser-Yang/blink-cmp-dictionary",
  },
  keys = {
    { "<leader>c/", "<cmd>%s/\\r//g<cr>", desc = "Remove All Enter Character" },
  },
  opts = function(_, opts)
    local default_sources = opts.sources.default or {}
    default_sources[#default_sources + 1] = "emoji"
    default_sources[#default_sources + 1] = "dictionary"

    local opt = {
      completion = {
        menu = {
          border = "rounded",
          scrollbar = true,
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
        default = default_sources,
        providers = {
          emoji = {
            module = "blink-emoji",
            name = "Emoji",
            opts = {
              insert = true,
              trigger = function()
                return { ":" }
              end,
            },
          },
          dictionary = {
            score_offset = 1,
            module = "blink-cmp-dictionary",
            name = "Dict",
            max_items = 2,
            min_keyword_length = 3,
            opts = {
              dictionary_directories = { vim.fn.expand("~") .. "/.config/dictionaries" },
            },
          },
          buffer = {
            score_offset = 5,
            min_keyword_length = 3,
          },
          path = {
            score_offset = 25,
            min_keyword_length = 2,
          },
          lsp = {
            score_offset = 125,
          },
          snippets = {
            score_offset = 625,
            min_keyword_length = 2,
            opts = {
              search_paths = { vim.fn.stdpath("config") .. "/snippets" },
            },
          },
        },
      },
      cmdline = {
        enabled = true,
        keymap = {
          ["<c-l>"] = { "show", "fallback" },
          ["<c-e>"] = cancel,
          ["<c-j>"] = { "select_next", "fallback" },
          ["<c-k>"] = { "select_prev", "fallback" },
          ["<right>"] = cancel,
          ["<left>"] = cancel,
        },
        sources = function()
          return get_by_cmdtype({ "buffer" }, { "cmdline", "lsp" }, {})
        end,
        completion = {
          list = { selection = { preselect = false } },
          menu = {
            auto_show = function()
              return true
            end,
          },
          ghost_text = { enabled = true },
        },
      },
      keymap = {
        ["<c-a>"] = cancel,
        ["<c-l>"] = cancel,
        ["<c-z>"] = cancel,
        ["<c-j>"] = cancel,
        ["<c-k>"] = cancel,
      },
    }

    return vim.tbl_deep_extend("force", opts, opt)
  end,
}
