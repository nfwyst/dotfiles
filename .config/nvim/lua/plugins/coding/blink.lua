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

local snippet_prefix = ";"
local emoji_prefix = ":"
local function should_show(ctx, prefix)
  -- dont show in command line mode
  if ctx.mode == "cmdline" then
    return false
  end

  -- fix trigger state loss
  local is_prefix_match = ctx.line:match(prefix .. "%w*$") ~= nil
  if is_prefix_match then
    return true
  end

  local trigger = ctx.trigger
  -- show when triggered by trigger character
  return trigger.initial_character == prefix and trigger.initial_kind == "trigger_character"
end

local function should_show_snippets(ctx)
  if not should_show(ctx, snippet_prefix) then
    return false
  end

  -- show when not in snippets completion mode
  return not require("blink.cmp").snippet_active()
end

local function should_show_emoji(ctx)
  return should_show(ctx, emoji_prefix)
end

local function should_show_items(ctx)
  return not should_show_snippets(ctx) and not should_show_emoji(ctx)
end

local function emoji_trigger()
  return { emoji_prefix }
end

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
            min_keyword_length = 1,
            override = { get_trigger_characters = emoji_trigger },
            opts = {
              insert = true,
              trigger = emoji_trigger,
            },
          },
          dictionary = {
            score_offset = 1,
            module = "blink-cmp-dictionary",
            name = "Dict",
            max_items = 2,
            min_keyword_length = 3,
            should_show_items = should_show_items,
            opts = {
              dictionary_directories = { vim.fn.expand("~") .. "/.config/dictionaries" },
            },
          },
          buffer = {
            score_offset = 5,
            min_keyword_length = 2,
            should_show_items = should_show_items,
          },
          path = {
            score_offset = 25,
            fallbacks = { "snippets", "buffer" },
            opts = {
              label_trailing_slash = true,
              show_hidden_files_by_default = true,
            },
          },
          lsp = {
            score_offset = 125,
            should_show_items = should_show_items,
          },
          snippets = {
            score_offset = 625,
            min_keyword_length = 2,
            should_show_items = should_show_snippets,
            override = {
              get_trigger_characters = function()
                return { snippet_prefix }
              end,
            },
            transform_items = function(ctx, items)
              local prev_line = ctx.cursor[1] - 1
              for _, item in ipairs(items) do
                if not item.trigger_text_modified then
                  item.trigger_text_modified = true
                  item.textEdit = {
                    newText = item.insertText or item.label,
                    range = {
                      start = { line = prev_line, character = ctx.bounds.start_col - 2 },
                      ["end"] = { line = prev_line, character = ctx.cursor[2] },
                    },
                  }
                end
              end
              return items
            end,
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
