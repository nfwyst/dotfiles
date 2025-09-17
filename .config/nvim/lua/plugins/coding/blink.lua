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
  local line = ctx.line:sub(1, ctx.cursor[2])
  if line:match(prefix .. "%w*$") ~= nil then
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

local SNIPPET = vim.lsp.protocol.CompletionItemKind.Snippet
local function set_snippet_item_range(ctx, item)
  local prev_line = ctx.cursor[1] - 1
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

local function update_lsp_item_score_offset(item)
  if item.client_name == "emmet_language_server" then
    item.score_offset = item.score_offset + 235
  end
end

return {
  "saghen/blink.cmp",
  event = "CmdlineEnter",
  build = "cargo build --release",
  dependencies = {
    "moyiz/blink-emoji.nvim",
    "Kaiser-Yang/blink-cmp-dictionary",
    "disrupted/blink-cmp-conventional-commits",
    "ph1losof/ecolog.nvim",
    "alexandre-abrioux/blink-cmp-npm.nvim",
  },
  keys = {
    { "<leader>c/", "<cmd>%s/\\r//g<cr>", desc = "Remove All Enter Character" },
  },
  opts = function(_, opts)
    vim.list_extend(opts.sources.default, { "conventional_commits", "npm", "ecolog", "emoji", "dictionary" })

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
          snippets = {
            min_keyword_length = 1,
            should_show_items = should_show_snippets,
            override = {
              get_trigger_characters = function()
                return { snippet_prefix }
              end,
            },
            transform_items = function(ctx, items)
              for _, item in ipairs(items) do
                set_snippet_item_range(ctx, item)
              end
              return items
            end,
            opts = {
              search_paths = { vim.fn.stdpath("config") .. "/snippets" },
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
          conventional_commits = {
            name = "Commits",
            score_offset = 25,
            module = "blink-cmp-conventional-commits",
            enabled = function()
              return vim.bo.filetype == "gitcommit"
            end,
          },
          npm = {
            name = "npm",
            module = "blink-cmp-npm",
            async = true,
            score_offset = 25,
            enabled = function()
              return vim.bo.filetype == "json"
            end,
          },
          ecolog = {
            name = "ecolog",
            score_offset = 125,
            module = "ecolog.integrations.cmp.blink_cmp",
            should_show_items = should_show_items,
          },
          lsp = {
            score_offset = 125,
            should_show_items = function(ctx)
              local filetype = vim.bo[ctx.bufnr].filetype
              -- dont show when only left bracket before cursor in styles file
              if vim.tbl_contains({ "css", "less", "scss" }, filetype) then
                local col = ctx.cursor[2]
                if "{" == ctx.line:sub(col, col) then
                  return false
                end
              end

              return not should_show_emoji(ctx)
            end,
            override = {
              get_trigger_characters = function(self)
                local trigger_characters = self:get_trigger_characters()
                vim.list_extend(trigger_characters, { snippet_prefix })
                return trigger_characters
              end,
            },
            transform_items = function(ctx, items)
              local show_snip = should_show_snippets(ctx)
              return vim.tbl_filter(function(item)
                local is_snip = item.kind == SNIPPET
                if show_snip then
                  if is_snip then
                    set_snippet_item_range(ctx, item)
                  end
                  return is_snip
                end
                update_lsp_item_score_offset(item)
                return not is_snip
              end, items)
            end,
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
