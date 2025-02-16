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
    { from = "<leader>cu", to = "", opt = { desc = "utils" } },
    { from = "<s-j>", to = "<cmd>execute 'move .+' . v:count1<cr>==" },
    { from = "<s-k>", to = "<cmd>execute 'move .-' . (v:count1 + 1)<cr>==" },
    {
      from = "<leader>xc",
      to = function()
        fn.setqflist({}, "r")
      end,
      opt = {
        desc = "Clear Quickfix List",
      },
    },
    { from = "<leader>Q", to = "<cmd>quit<cr>", opt = {
      desc = "Quit",
    } },
    { from = "<leader>qf", to = "<cmd>ccl<cr>", opt = {
      desc = "Quit Quickfix List",
    } },
  },
  [{ "n", "x", "s" }] = {
    { from = "<leader>i", to = "<cmd>w<cr>", opt = { desc = "Save File" } },
    { from = "<leader>I", to = "<cmd>wall<cr>", opt = { desc = "Save All" } },
    { from = "<leader>X", to = "<cmd>xall<cr>", opt = { desc = "Save And Quit" } },
  },
  [{ "v", "x" }] = {
    { from = "<s-j>", to = ":<C-u>execute \"'<,'>move '>+\" . v:count1<cr>gv=gv" },
    { from = "<s-k>", to = ":<C-u>execute \"'<,'>move '<-\" . (v:count1 + 1)<cr>gv=gv" },
  },
  [{ "v", "x", "s", "i" }] = {
    {
      from = ",,",
      to = function()
        PRESS_KEYS("<esc>", "n")
        snippet.stop()
      end,
    },
  },
})
