local trigger_text = ";"
local emoji_enabled = not IS_LINUX

local function line_before_cursor()
  local cursor = WIN_CURSOR(CUR_WIN())
  local col = cursor[2]
  local cur_line = api.nvim_get_current_line()
  local contents_before_cursor = cur_line:sub(1, col)
  return contents_before_cursor, cursor
end

local function should_show_snip(ctx)
  if ctx.mode == "cmdline" then
    return false
  end
  local contents_before_cursor = line_before_cursor()
  local trigger_pattern = trigger_text .. "%w*$"
  return contents_before_cursor:match(trigger_pattern) ~= nil
end

local function should_show_emoji()
  return line_before_cursor():match(":%w*$") ~= nil
end

local function shouldnt_show_emoji()
  return not should_show_emoji()
end

local function shouldnt_show_snippets_emoji(ctx)
  local isnt_snip_mode = not should_show_snip(ctx)

  if emoji_enabled then
    return isnt_snip_mode and shouldnt_show_emoji()
  end

  return isnt_snip_mode
end

local function get_snip_range(ctx)
  if not should_show_snip(ctx) then
    return
  end

  local contents_before_cursor, cursor = line_before_cursor()
  local row = cursor[1]
  local col = cursor[2]
  local trigger_pattern = trigger_text .. "[^" .. trigger_text .. "]*$"
  local trigger_pos = contents_before_cursor:find(trigger_pattern)

  if not trigger_pos then
    return
  end

  -- reload snippets source
  schedule(function()
    require("blink.cmp").reload("snippets")
  end)

  local line = row - 1
  return {
    start = { line = line, character = trigger_pos - 1 },
    ["end"] = { line = line, character = col },
  }
end

local function transform_snip_items(ctx, items)
  local range = get_snip_range(ctx)

  if not range then
    return items
  end

  return map(function(item)
    item.textEdit = {
      newText = item.insertText or item.label,
      range = range,
    }
    return item
  end, items)
end

local function transform_lsp_items(ctx, items)
  local range = get_snip_range(ctx)

  return filter(function(item)
    local is_snip = item.kind == lsp.protocol.CompletionItemKind.Snippet

    if range then
      assign(item, {
        sortText = "0000" .. (item.sortText or ""),
        textEdit = {
          newText = item.insertText or item.label,
          range = range,
        },
      })
      return is_snip
    end

    return not is_snip
  end, items)
end

local function get_by_cmdtype(search_val, cmd_val, default)
  local cmdtype = fn.getcmdtype()
  if cmdtype == "/" or cmdtype == "?" then
    return search_val
  end
  if cmdtype == ":" then
    return cmd_val
  end
  return default
end

return {
  "saghen/blink.cmp",
  event = "CmdlineEnter",
  dependencies = {
    "saghen/blink.compat",
    { "moyiz/blink-emoji.nvim", cond = emoji_enabled },
    "Kaiser-Yang/blink-cmp-dictionary",
  },
  keys = {
    { "<leader>c/", "<cmd>%s/\\r//g<cr>", desc = "Remove All Enter Character" },
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
      enabled = function()
        return not contains({ "neo-tree", "neo-tree-popup" }, OPT("filetype", { buf = CUR_BUF() }))
      end,
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
          draw = {
            columns = { { "label", "label_description", gap = 1 }, { "kind_icon", "kind" }, { "source_name" } },
          },
        },
        documentation = { window = { border = "rounded" } },
        list = {
          selection = {
            preselect = function(ctx)
              return ctx.mode ~= "cmdline"
            end,
            auto_insert = true,
          },
        },
        trigger = { prefetch_on_insert = false },
      },
      signature = { window = { border = "rounded" } },
      sources = {
        per_filetype = {},
        providers = {
          lsp = {
            should_show_items = shouldnt_show_emoji,
            transform_items = transform_lsp_items,
            score_offset = 90,
          },
          snippets = {
            min_keyword_length = 1,
            max_items = 3,
            -- only show snippets items if trigger_text is prefix
            should_show_items = should_show_snip,
            transform_items = transform_snip_items,
            score_offset = 85,
            opts = {
              search_paths = { fn.stdpath("config") .. "/snippets" },
            },
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
        ["<c-a>"] = { "cancel", "fallback" },
        ["<c-l>"] = { "cancel", "fallback" },
        ["<c-z>"] = { "cancel", "fallback" },
        ["<c-j>"] = { "cancel", "fallback" },
        ["<c-k>"] = { "cancel", "fallback" },
      },
      snippets = {
        preset = "default",
      },
    }

    return merge(opts, opt)
  end,
}
