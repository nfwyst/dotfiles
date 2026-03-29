return {
  "nvim-mini/mini.pairs",
  opts = function(_, opts)
    local pairs = require("mini.pairs")
    local open = pairs.open
    pairs.open = function(pair, neigh_pattern)
      local o = pair:sub(1, 1)
      local line = vim.api.nvim_get_current_line()
      local cursor = vim.api.nvim_win_get_cursor(0)
      local before = line:sub(1, cursor[2])
      if
        opts.markdown
        and o == "`"
        and vim.list_contains(vim.g.markdowns, vim.bo.filetype)
        and before:match("^%s*``")
      then
        return "`\n```" .. vim.api.nvim_replace_termcodes("<up>", true, true, true)
      end

      return open(pair, neigh_pattern)
    end

    return opts
  end,
}
