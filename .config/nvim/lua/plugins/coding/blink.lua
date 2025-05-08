local trigger_text = ";"

local function should_show_snip(ctx)
  if ctx.mode == "cmdline" then
    return false
  end

  local prefix = LINE_BEFORE_CURSOR(ctx)
  if not prefix then
    return false
  end

  local trigger_pattern = trigger_text .. "%w*$"
  return prefix:find(trigger_pattern)
end

local function should_show_emoji(ctx)
  local prefix = LINE_BEFORE_CURSOR(ctx)
  if not prefix then
    return false
  end

  return prefix:match(":%w*$") ~= nil
end

local function shouldnt_show_emoji(ctx)
  return not should_show_emoji(ctx)
end

local function should_show_lsp(ctx)
  if OPT("filetype", { buf = ctx.bufnr }) == "lua" then
    return true
  end

  return shouldnt_show_emoji(ctx)
end

local function shouldnt_show_snippets_emoji(ctx)
  local isnt_snip_mode = not should_show_snip(ctx)

  return isnt_snip_mode and shouldnt_show_emoji(ctx)
end

local function get_snip_range(ctx)
  if not should_show_snip(ctx) then
    return
  end

  local prefix = LINE_BEFORE_CURSOR(ctx)
  if not prefix then
    return
  end

  local trigger_pattern = trigger_text .. "[^" .. trigger_text .. "]*$"
  local trigger_pos = prefix:find(trigger_pattern)
  if not trigger_pos then
    return
  end

  -- reload snippets source
  schedule(function()
    require("blink.cmp").reload("snippets")
  end)

  local bounds = ctx.bounds
  local line = bounds.line_number - 1

  return {
    start = { line = line, character = trigger_pos - 1 },
    ["end"] = { line = line, character = bounds.start_col },
  }
end

local function transform_snip_items(ctx, items)
  local range = get_snip_range(ctx)

  if not range then
    return items
  end

  if snippet.active() then
    -- stop prev snippet session
    snippet.stop()
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
  if contains({ "/", "?" }, cmdtype) then
    return search_val
  end

  if contains({ ":", "@" }, cmdtype) then
    return cmd_val
  end

  return default
end

local cancel = { "cancel", "fallback" }

local function add_emoji()
  ADD_BLINK_SOURCE({
    id = "emoji",
    config = {
      name = "Emoji",
      module = "blink-emoji",
      opts = { insert = true },
    },
  })
end

local function add_dictionary()
  ADD_BLINK_SOURCE({
    id = "dictionary",
    config = {
      should_show_items = shouldnt_show_snippets_emoji,
      module = "blink-cmp-dictionary",
      name = "Dict",
      max_items = 2,
      min_keyword_length = 3,
      score_offset = -10,
      opts = {
        dictionary_directories = { HOME_PATH .. "/.config/dictionaries" },
        separate_output = function(output)
          local items = {}
          for line in output:gmatch("[^\r\n]+") do
            PUSH(items, line)
          end

          return items
        end,
      },
    },
  })
end

return {
  "saghen/blink.cmp",
  event = "CmdlineEnter",
  build = "cargo build --release",
  dependencies = {
    "saghen/blink.compat",
    "moyiz/blink-emoji.nvim",
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
    UPDATE_HLS({
      BlinkCmpMenuBorder = link,
      BlinkCmpDocBorder = link,
      BlinkCmpSignatureHelpBorder = link,
      Pmenu = { bg = "NONE" },
    })

    schedule(function()
      add_dictionary()
      add_emoji()
    end)

    local ignored = { "neo-tree", "neo-tree-popup", "typr", "snacks_picker_input" }
    local opt = {
      enabled = function()
        return not contains(ignored, OPT("filetype", { buf = CUR_BUF() }))
      end,
      completion = {
        menu = {
          border = "rounded",
          scrollbar = false,
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
        trigger = { prefetch_on_insert = false },
        accept = { dot_repeat = false },
      },
      signature = { window = { border = "rounded" } },
      sources = {
        providers = {
          lsp = {
            should_show_items = should_show_lsp,
            transform_items = transform_lsp_items,
          },
          snippets = {
            min_keyword_length = 1,
            max_items = 3,
            -- only show snippets items if trigger_text is prefix
            should_show_items = should_show_snip,
            transform_items = transform_snip_items,
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
          },
          buffer = {
            min_keyword_length = 3,
            max_items = 3,
            should_show_items = shouldnt_show_snippets_emoji,
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
          ghost_text = { enabled = false },
        },
      },
      keymap = {
        ["<c-a>"] = cancel,
        ["<c-l>"] = cancel,
        ["<c-z>"] = cancel,
        ["<c-j>"] = cancel,
        ["<c-k>"] = cancel,
      },
      snippets = { preset = "default" },
    }

    return merge(opts, opt)
  end,
}
