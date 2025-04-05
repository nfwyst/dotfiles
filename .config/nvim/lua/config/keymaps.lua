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

local function get_resizer(is_increase, is_vertical)
  return function()
    local win = CUR_WIN()
    local key = CONSTS.RESIZE_MANULLY
    if not WIN_VAR(win, key) then
      WIN_VAR(win, key, true)
    end

    local delta = is_increase and "+2" or "-2"
    local command = "resize " .. delta
    if is_vertical then
      command = "vertical " .. command
    end

    cmd(command)
  end
end

local function toggle_mark()
  local char_code = fn.getchar()
  if char_code == 0 then
    return
  end

  local char = fn.nr2char(char_code)
  if not char:match("^[a-zA-Z]$") then
    return PRESS_KEYS("m" .. char, "n")
  end

  local mark = fn.getpos("'" .. char)
  local buf = mark[1]
  local bufnr = CUR_BUF()
  if buf == 0 then
    buf = bufnr
  end

  local mark_row = mark[2]
  local row = WIN_CURSOR(CUR_WIN())[1]
  if buf == bufnr and mark_row == row then
    return cmd.delmarks(char)
  end

  cmd.normal({ "m" .. char, bang = true })
end

local keymaps = {
  n = {
    { from = "p", to = paste },
    { from = "<c-d>", to = "<c-d>zz" },
    { from = "<c-u>", to = "<c-u>zz" },
    { from = "<c-f>", to = "<c-f>zz" },
    { from = "<c-b>", to = "<c-b>zz" },
    { from = "<leader>cu", to = "", opt = { desc = "utils" } },
    { from = "<leader>fn", to = NewFile, opt = { desc = "New File" } },
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
    {
      from = "<leader>uH",
      to = function()
        IS_SYNTAX_OFF = not IS_SYNTAX_OFF
        SET_SCOPE_DIM()
      end,
      opt = {
        desc = "Toggle Syntax Highlight",
      },
    },
    { from = "<leader>Q", to = "<cmd>quit<cr>", opt = {
      desc = "Quit",
    } },
    { from = "<leader>qf", to = "<cmd>ccl<cr>", opt = {
      desc = "Quit Quickfix List",
    } },
    { from = "<s-up>", to = get_resizer(true), opt = { desc = "Increase Window Height" } },
    { from = "<s-down>", to = get_resizer(false), opt = { desc = "Decrease Window Height" } },
    { from = "<s-left>", to = get_resizer(true, true), opt = { desc = "Increase Window Width" } },
    { from = "<s-right>", to = get_resizer(false, true), opt = { desc = "Decrease Window Width" } },
  },
  [{ "n", "x", "s" }] = {
    { from = "<leader>i", to = "<cmd>w<cr>", opt = { desc = "Save File" } },
    { from = "<leader>I", to = "<cmd>wall<cr>", opt = { desc = "Save All" } },
    { from = "<leader>X", to = "<cmd>xall<cr>", opt = { desc = "Save And Quit" } },
    { from = "m", to = toggle_mark },
  },
  [{ "v", "x" }] = {
    { from = "<s-j>", to = ":<C-u>execute \"'<,'>move '>+\" . v:count1<cr>gv=gv" },
    { from = "<s-k>", to = ":<C-u>execute \"'<,'>move '<-\" . (v:count1 + 1)<cr>gv=gv" },
  },
  [{ "v", "x", "s", "i" }] = {
    {
      from = ";;",
      to = function()
        PRESS_KEYS("<esc>", "n")
        snippet.stop()
      end,
    },
  },
}

function SET_KEYMAPS()
  MAPS(keymaps)
end
