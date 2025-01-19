local trigger_text = ";"
local emoji_enabled = not IS_LINUX

local function line_before_cursor()
  local cursor = WIN_CURSOR(CUR_WIN())
  local col = cursor[2]
  local cur_line = api.nvim_get_current_line()
  local contents_before_cursor = cur_line:sub(1, col)
  return contents_before_cursor, cursor
end

local function should_show_snippets()
  local contents_before_cursor = line_before_cursor()
  local trigger_pattern = trigger_text .. "%w*$"
  return contents_before_cursor:match(trigger_pattern) ~= nil
end

local function should_show_emoji()
  return line_before_cursor():match(":%w*$") ~= nil
end

local function shouldnt_show_snippets_emoji()
  local no_snip = not should_show_snippets()
  if emoji_enabled then
    return no_snip and not should_show_emoji()
  end
  return no_snip
end

local function get_by_cmdtype(search_val, cmd_val, default)
  local type = fn.getcmdtype()
  if type == "/" or type == "?" then
    return search_val
  end
  if type == ":" then
    return cmd_val
  end
  return default
end

return {
  "saghen/blink.cmp",
  dependencies = {
    "saghen/blink.compat",
    { "moyiz/blink-emoji.nvim", cond = emoji_enabled },
    "Kaiser-Yang/blink-cmp-dictionary",
  },
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

    PUSH(opts.sources.default, "dictionary")
    if emoji_enabled then
      PUSH(opts.sources.default, "emoji")
      opts.sources.providers.emoji = {
        module = "blink-emoji",
        name = "Emoji",
        score_offset = 15,
        opts = { insert = true },
      }
    end

    local opt = {
      completion = {
        menu = {
          border = "rounded",
          auto_show = function(ctx)
            if not IS_LINUX or ctx.mode ~= "cmdline" then
              return true
            end
            return get_by_cmdtype(false, false, true)
          end,
          cmdline_position = function()
            local pos = g.ui_cmdline_pos
            if pos then
              return { pos[1] + get_by_cmdtype(-1, 0, 0), pos[2] }
            end
            local ch = o.cmdheight
            local height = (ch == 0) and 1 or ch
            return { o.lines - height, 0 }
          end,
        },
        documentation = {
          window = {
            border = "rounded",
          },
        },
        list = {
          selection = {
            preselect = function(ctx)
              return ctx.mode ~= "cmdline"
            end,
            auto_insert = true,
          },
        },
      },
      sources = {
        per_filetype = {},
        providers = {
          lsp = {
            should_show_items = shouldnt_show_snippets_emoji,
            transform_items = function(ctx, items)
              local is_cl = ctx.mode == "cmdline"
              return filter(function(item)
                local st = item.sortText or ""
                local is_sn = item.kind == lsp.protocol.CompletionItemKind.Snippet
                item.sortText = is_sn and "0000" .. st or "9999" .. st
                return not is_cl or not is_sn
              end, items)
            end,
            score_offset = 90,
          },
          snippets = {
            min_keyword_length = 1,
            max_items = 3,
            -- only show snippets items if trigger_text is prefix
            should_show_items = should_show_snippets,
            transform_items = function(_, items)
              local contents_before_cursor, cursor = line_before_cursor()
              local row = cursor[1]
              local col = cursor[2]
              local trigger_pattern = trigger_text .. "[^" .. trigger_text .. "]*$"
              local trigger_pos = contents_before_cursor:find(trigger_pattern)
              if not trigger_pos then
                return items
              end

              local line = row - 1
              local range = {
                start = { line = line, character = trigger_pos - 1 },
                ["end"] = { line = line, character = col },
              }
              for _, item in ipairs(items) do
                item.textEdit = {
                  newText = item.insertText or item.label,
                  range = range,
                }
              end
              -- reload snippets source
              schedule(function()
                require("blink.cmp").reload("snippets")
              end)

              return items
            end,
            score_offset = 85,
          },
          path = {
            should_show_items = shouldnt_show_snippets_emoji,
            fallbacks = { "snippets", "buffer" },
            opts = {
              trailing_slash = false,
              label_trailing_slash = true,
              get_cwd = function(context)
                return fs.dirname(BUF_PATH(context.bufnr))
              end,
              show_hidden_files_by_default = true,
            },
            score_offset = 25,
          },
          dictionary = {
            should_show_items = shouldnt_show_snippets_emoji,
            module = "blink-cmp-dictionary",
            name = "Dict",
            max_items = 2,
            min_keyword_length = 3,
            opts = {
              dictionary_directories = { HOME_PATH .. "/dotfiles/.config/dictionaries" },
              separate_output = function(output)
                local items = {}
                for line in output:gmatch("[^\r\n]+") do
                  table.insert(items, {
                    label = line,
                    insert_text = line,
                    documentation = nil,
                  })
                end
                return items
              end,
            },
            score_offset = 20,
          },
          buffer = {
            min_keyword_length = 3,
            max_items = 3,
            should_show_items = shouldnt_show_snippets_emoji,
            score_offset = 15,
          },
          cmdline = {
            enabled = true,
          },
        },
        cmdline = function()
          return get_by_cmdtype({ "buffer" }, { "cmdline", "lsp" }, {})
        end,
      },
      keymap = {
        cmdline = {
          ["<c-l>"] = { "show", "fallback" },
          ["<c-e>"] = { "hide", "fallback" },
          ["<c-j>"] = { "select_next", "fallback" },
          ["<c-k>"] = { "select_prev", "fallback" },
        },
      },
      snippets = {
        preset = "default",
      },
    }

    return merge(opts, opt)
  end,
}
