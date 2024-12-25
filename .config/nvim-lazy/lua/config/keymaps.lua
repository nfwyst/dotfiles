local function paste()
  local content = fn.getreg('"')
  local end_with_new_line = content:sub(-1) == "\n"
  local only_one_new_line = not content:sub(1, -2):find("\n")
  local is_copy_line = end_with_new_line and only_one_new_line

  if is_copy_line then
    local win = CUR_WIN()
    local row, col = unpack(WIN_CURSOR(win))
    cmd.put()
    return WIN_CURSOR(win, { row + 1, col })
  end

  PRESS_KEYS("p", "n")
end

MAPS({
  n = {
    { from = "p", to = paste },
    { from = "<s-j>", to = "<cmd>execute 'move .+' . v:count1<cr>==" },
    { from = "<s-k>", to = "<cmd>execute 'move .-' . (v:count1 + 1)<cr>==" },
    {
      from = "<leader>ct",
      to = function()
        SET_TAB(2, true)
      end,
      opt = {
        desc = "Fix Tab Level",
      },
    },
  },
  [{ "v", "x" }] = {
    { from = "<s-j>", to = ":<C-u>execute \"'<,'>move '>+\" . v:count1<cr>gv=gv" },
    { from = "<s-k>", to = ":<C-u>execute \"'<,'>move '<-\" . (v:count1 + 1)<cr>gv=gv" },
  },
  i = {
    {
      from = "jk",
      to = function()
        cmd.stopinsert()
        snippet.stop()
      end,
    },
    { from = "<c-h>", to = "<Left>" },
    { from = "<c-l>", to = "<Right>" },
    { from = "<c-j>", to = "<Down>" },
    { from = "<c-k>", to = "<Up>" },
  },
})
