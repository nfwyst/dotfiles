return {
  "echasnovski/mini.pairs",
  opts = function(_, opts)
    schedule(function()
      local pairs = require("mini.pairs")
      local original_open = pairs.open

      ---@diagnostic disable-next-line: duplicate-set-field
      pairs.open = function(pair, neigh_pattern)
        local filetype = OPT("filetype", { buf = CUR_BUF() })
        local is_markdown = contains(MARKDOWN_FILETYPE, filetype)
        local contents_before_cursor = LINE_BEFORE_CURSOR()
        local is_block = contents_before_cursor:match("^%s*``")
        local char = pair:sub(1, 1)

        local up = api.nvim_replace_termcodes("<up>", true, true, true)
        local right = api.nvim_replace_termcodes("<right>", true, true, true)
        if opts.markdown and char == "`" and is_markdown and is_block then
          return "`\n```" .. up .. right .. right
        end

        return original_open(pair, neigh_pattern)
      end
    end)

    return opts
  end,
}
