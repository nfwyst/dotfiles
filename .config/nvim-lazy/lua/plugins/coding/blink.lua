local trigger_text = ";"

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

local function shouldnt_show_snippets()
  return not should_show_snippets()
end

local cmdline
if not LINUX then
  cmdline = function()
    local type = fn.getcmdtype()
    if type == "/" or type == "?" then
      return { "buffer" }
    end
    if type == ":" then
      return { "cmdline" }
    end
    return {}
  end
end

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
          cmdline_position = function()
            local pos = g.ui_cmdline_pos
            if pos ~= nil then
              return { pos[1], pos[2] }
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
      },
      sources = {
        providers = {
          markdown = {
            name = "RenderMarkdown",
            module = "render-markdown.integ.blink",
          },
          lsp = {
            should_show_items = shouldnt_show_snippets,
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
          },
          path = {
            should_show_items = shouldnt_show_snippets,
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
            min_keyword_length = 4,
            max_items = 3,
            should_show_items = shouldnt_show_snippets,
          },
          cmdline = {
            enabled = not LINUX,
          },
        },
        cmdline = cmdline,
      },
    }

    return merge(opts, opt)
  end,
}
