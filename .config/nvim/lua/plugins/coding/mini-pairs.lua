local function move_cursor_to_block_end(win, row)
  local trigger_text = "```"
  local bufnr = api.nvim_win_get_buf(win)
  local cur_line = BUF_LINES(bufnr, row, row - 1)[1]
  local trigger_pattern = trigger_text .. "[^" .. trigger_text .. "]*$"
  local trigger_pos = cur_line:find(trigger_pattern)

  if not trigger_pos then
    return
  end

  WIN_CURSOR(win, { row, trigger_pos + 2 })
end

return {
  "echasnovski/mini.pairs",
  opts = function(_, opts)
    defer(function()
      local pairs = require("mini.pairs")
      local original_open = pairs.open

      ---@diagnostic disable-next-line: duplicate-set-field
      pairs.open = function(pair, neigh_pattern)
        local filetype = OPT("filetype", { buf = CUR_BUF() })
        local is_markdown = contains(MARKDOWN_FILETYPES, filetype)
        local win = CUR_WIN()
        local contents_before_cursor, pos = LINE_BEFORE_CURSOR({ win = win })
        local is_block = contents_before_cursor:match("^%s*``")
        local char = pair:sub(1, 1)

        if opts.markdown and char == "`" and is_markdown and is_block then
          defer(function()
            if win == CUR_WIN() then
              move_cursor_to_block_end(win, pos[1])
            end
          end, 5)

          return "`\n```" .. GET_KEYS_CODE("<up>")
        end

        return original_open(pair, neigh_pattern)
      end
    end, 5)

    return opts
  end,
}
