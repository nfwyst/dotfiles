-- Editor plugin configurations

-- ===================================================================
-- Which-key
-- ===================================================================
require("which-key").setup({
  preset = "classic",
  keys = {
    scroll_down = "<c-j>",
    scroll_up = "<c-k>",
  },
  plugins = {
    spelling = { suggestions = 10 },
  },
  win = {
    no_overlap = false,
    height = { max = 23 },
    border = "rounded",
    padding = { 1, 1 },
  },
  layout = {
    width = { max = 100 },
  },
  icons = {
    rules = {
      { pattern = "harpoon", icon = "󱓞 ", color = "orange" },
      { pattern = "checkmate", icon = "⊡" },
      { pattern = "rest", icon = "󱂛" },
      { pattern = "save all", icon = "" },
      { pattern = "keywordprg", icon = "" },
      { pattern = "update source", icon = "󰚰" },
    },
  },
  spec = {
    { "<leader>a", group = "ai" },
    { "<leader>b", group = "buffer" },
    { "<leader>c", group = "code" },
    { "<leader>cU", group = "utils" },
    { "<leader>cUl", group = "leet code" },
    { "<leader>d", group = "debug" },
    { "<leader>f", group = "file/find" },
    { "<leader>g", group = "git" },
    { "<leader>gc", group = "conflict" },
    { "<leader>gh", group = "hunks" },
    { "<leader>p", group = "plugins" },
    { "<leader>q", group = "quit/session" },
    { "<leader>s", group = "search" },
    { "<leader>sn", group = "noice" },
    { "<leader>u", group = "ui" },
    { "<leader>w", group = "windows" },
    { "<leader>x", group = "diagnostics/quickfix" },
    { "<leader><tab>", group = "tabs" },
    { "<leader>T", group = "Checkmate [T]odos" },
    { "<leader>ac", group = "codeCompanion" },
    { "[", group = "prev" },
    { "]", group = "next" },
    { "g", group = "goto" },
    { "gs", group = "surround" },
    { "z", group = "fold" },
  },
})

-- Utils group keymap
vim.keymap.set("n", "<leader>cUp", function()
  require("config.price").toggle()
end, { desc = "Toggle price display" })

-- ===================================================================
-- Gitsigns
-- ===================================================================
local signs = {
  add = { text = "+" },
  change = { text = "~" },
  delete = { text = "-" },
  topdelete = { text = "▔" },
  changedelete = { text = "~" },
  untracked = { text = "┆" },
}

require("gitsigns").setup({
  signs = signs,
  signs_staged = signs,
  on_attach = function(bufnr)
    local gs = package.loaded.gitsigns
    local function gmap(mode, l, r, opts)
      opts = opts or {}
      opts.buffer = bufnr
      vim.keymap.set(mode, l, r, opts)
    end
    -- Navigation
    gmap("n", "]h", function()
      if vim.wo.diff then
        vim.cmd.normal({ "]c", bang = true })
      else
        gs.nav_hunk("next")
      end
    end, { desc = "Next Hunk" })
    gmap("n", "[h", function()
      if vim.wo.diff then
        vim.cmd.normal({ "[c", bang = true })
      else
        gs.nav_hunk("prev")
      end
    end, { desc = "Prev Hunk" })
    gmap("n", "]H", function()
      gs.nav_hunk("last")
    end, { desc = "Last Hunk" })
    gmap("n", "[H", function()
      gs.nav_hunk("first")
    end, { desc = "First Hunk" })
    -- Actions
    gmap({ "n", "v" }, "<leader>ghs", ":Gitsigns stage_hunk<CR>", { desc = "Stage Hunk" })
    gmap({ "n", "v" }, "<leader>ghr", ":Gitsigns reset_hunk<CR>", { desc = "Reset Hunk" })
    gmap("n", "<leader>ghS", gs.stage_buffer, { desc = "Stage Buffer" })
    gmap("n", "<leader>ghu", gs.undo_stage_hunk, { desc = "Undo Stage Hunk" })
    gmap("n", "<leader>ghR", gs.reset_buffer, { desc = "Reset Buffer" })
    gmap("n", "<leader>ghp", gs.preview_hunk_inline, { desc = "Preview Hunk Inline" })
    gmap("n", "<leader>ghP", gs.preview_hunk, { desc = "Preview Hunk" })
    gmap("n", "<leader>ghb", function()
      gs.blame_line({ full = true })
    end, { desc = "Blame Line" })
    gmap("n", "<leader>ghB", function()
      gs.blame()
    end, { desc = "Blame Buffer" })
    gmap("n", "<leader>ghd", gs.diffthis, { desc = "Diff This" })
    gmap("n", "<leader>ghD", function()
      gs.diffthis("~")
    end, { desc = "Diff This ~" })
    -- Toggles
    gmap("n", "<leader>uB", gs.toggle_current_line_blame, { desc = "Toggle Git Blame" })
    -- Text object
    gmap({ "o", "x" }, "ih", ":<C-U>Gitsigns select_hunk<CR>", { desc = "GitSigns Select Hunk" })
  end,
})

-- ===================================================================
-- Grug-far
-- ===================================================================
vim.treesitter.language.register("markdown", "grug-far-help")

require("grug-far").setup({
  reportDuration = false,
  maxSearchMatches = 2000,
  normalModeSearch = true,
  engines = {
    ripgrep = {
      extraArgs = "--no-ignore --hidden --glob !node_modules",
    },
  },
})

vim.keymap.set("n", "<leader>sr", function()
  require("grug-far").open({ prefills = { search = vim.fn.expand("<cword>") } })
end, { desc = "Search and Replace" })

-- ===================================================================
-- Trouble
-- ===================================================================
require("trouble").setup({
  modes = {
    symbols = {
      win = { size = 50 },
      format = "{kind_icon}{symbol.name}{pos}",
    },
  },
})

-- ===================================================================
-- Flash (enhanced search/jump)
-- ===================================================================
require("flash").setup({})

vim.keymap.set({ "n", "x", "o" }, "s", function()
  require("flash").jump()
end, { desc = "Flash" })
vim.keymap.set({ "n", "o", "x" }, "S", function()
  require("flash").treesitter()
end, { desc = "Flash Treesitter" })
vim.keymap.set("o", "r", function()
  require("flash").remote()
end, { desc = "Remote Flash" })
vim.keymap.set({ "o", "x" }, "R", function()
  require("flash").treesitter_search()
end, { desc = "Treesitter Search" })
vim.keymap.set("c", "<c-s>", function()
  require("flash").toggle()
end, { desc = "Toggle Flash Search" })

-- ===================================================================
-- Todo Comments
-- ===================================================================
require("todo-comments").setup({})

vim.keymap.set("n", "]t", function()
  require("todo-comments").jump_next()
end, { desc = "Next Todo Comment" })
vim.keymap.set("n", "[t", function()
  require("todo-comments").jump_prev()
end, { desc = "Previous Todo Comment" })
vim.keymap.set("n", "<leader>xt", "<cmd>Trouble todo toggle<cr>", { desc = "Todo (Trouble)" })
vim.keymap.set(
  "n",
  "<leader>xT",
  "<cmd>Trouble todo toggle filter = {tag = {TODO,FIX,FIXME}}<cr>",
  { desc = "Todo/Fix/Fixme (Trouble)" }
)
vim.keymap.set("n", "<leader>st", function()
  Snacks.picker.todo_comments()
end, { desc = "Todo" })
vim.keymap.set("n", "<leader>sT", function()
  Snacks.picker.todo_comments({ keywords = { "TODO", "FIX", "FIXME" } })
end, { desc = "Todo/Fix/Fixme" })

-- ===================================================================
-- Resolve (git conflict resolution)
-- ===================================================================
require("resolve").setup({
  default_keymaps = false,
})

vim.keymap.set("n", "]c", "<Plug>(resolve-next)", { desc = "Next Conflict" })
vim.keymap.set("n", "[c", "<Plug>(resolve-prev)", { desc = "Previous Conflict" })
vim.keymap.set("n", "<leader>gcn", "<Plug>(resolve-next)", { desc = "Next Conflict" })
vim.keymap.set("n", "<leader>gcp", "<Plug>(resolve-prev)", { desc = "Previous Conflict" })
vim.keymap.set("n", "<leader>gco", "<Plug>(resolve-ours)", { desc = "Choose Ours" })
vim.keymap.set("n", "<leader>gct", "<Plug>(resolve-theirs)", { desc = "Choose Theirs" })
vim.keymap.set("n", "<leader>gcb", "<Plug>(resolve-both)", { desc = "Choose Both" })
vim.keymap.set("n", "<leader>gcr", "<Plug>(resolve-none)", { desc = "Remove Conflict (None)" })
vim.keymap.set("n", "<leader>gcl", "<Plug>(resolve-list)", { desc = "List Conflicts" })
