local function get_path(name)
  return "plugins.which-key.registers.leader." .. name .. "-conf"
end

local register = {
  b = require(get_path("buffer")),
  g = require(get_path("git")),
  a = {
    name = "AI",
    c = require(get_path("ai.chatgpt")),
    t = require(get_path("ai.tabnine")),
    g = require(get_path("ai.gen")),
  },
  l = {
    name = "Lsp/Leetcode",
    s = require(get_path("lsp")),
    c = require(get_path("leetcode")),
  },
  W = require(get_path("workspace")),
  c = require(get_path("clipboard")),
  d = require(get_path("dap")),
  D = require(get_path("neogen")),
  t = {
    name = "Tel/Term/Todo/TS/Tree",
    s = require(get_path("telescope")),
    m = require(get_path("terminal")),
    d = require(get_path("todo")),
    t = require(get_path("treesitter")),
  },
  h = require(get_path("harpoon")),
  H = {
    function()
      vim.lsp.inlay_hint.enable(not vim.lsp.inlay_hint.is_enabled())
    end,
    "Toggle inlay hint",
  },
  i = require(get_path("noice")),
  j = { "<cmd>Telescope jumplist<cr>", "Jumplist" },
  n = {
    name = "Neorg/Neotest",
    o = require(get_path("neorg")),
    t = require(get_path("neotest")),
  },
  N = require(get_path("pomodoro")),
  v = { "<cmd>ShowFilePath<cr>", "Show file path" },
  Q = { "<cmd>ccl<cr>", "Close QuickFix" },
  A = { "<cmd>Alpha<cr>", "Alpha" },
  e = { "<cmd>NvimTreeToggle<cr>", "File tree" },
  E = { "<cmd>EmmetInstall<cr>", "Enable emmet" },
  w = { "<cmd>Save<cr>", "Save" },
  x = { "<cmd>SaveThenQuit<cr>", "Save and quit" },
  q = { "<cmd>Quit<cr>", "Force quit" },
  u = { "<cmd>nohlsearch<cr>", "No highlight" },
  f = { "<cmd>FindFiles<cr>", "Find files" },
  F = { "<cmd>FindText<cr>", "Find text" },
  T = { "<cmd>FindTextByFileType<cr>", "Find text by filetype" },
  X = { "<cmd>FindTextByPattern<cr>", "Find text by filetype" },
  C = { "<cmd>FindTextCursor<cr>", "Find text under cursor" },
  P = { "<cmd>FindTextWithPath<cr>", "Find text by path" },
  p = { "<cmd>Telescope projects<cr>", "Projects" },
  R = { "<cmd>Telescope oldfiles<cr>", "Recently used files global" },
  r = { "<cmd>Telescope oldfiles only_cwd=true<cr>", "Recently used files" },
  G = { "<cmd>source $MYVIMRC<cr>", "Reload nvim config" },
  S = { "<cmd>set ignorecase!<cr>", "Toggle case sensitive" },
  m = { "<cmd>Mason<cr>", "Open mason installer" },
  L = { "<cmd>Lazy<cr>", "Open lazy installer" },
  I = { "<cmd>set modifiable<cr>", "Set modifiable" },
  s = { ":'<,'>!sort<cr>", "Sort selected" },
  z = { "<cmd>ZenMode<cr>", "Zen mode" },
  o = {
    name = "Obsidian/init.lua/snippet/outline",
    b = require(get_path("obsidian")),
    i = { "<cmd>e $MYVIMRC<cr>", "Open init.lua" },
    s = { "<cmd>e " .. SNIPPET_PATH .. "/package.json<cr>", "Open snippets" },
    t = { "<cmd>Outline<cr>", "Toggle outline" },
  },
}

return register