return {
  ["<leader>t"] = { group = "Terminal/Test/Timer/Tab" },
  ["<leader>tm"] = { group = "Terminal" },
  ["<leader>tmH"] = {
    "<cmd>ToggleTerminalHorizontal<cr>",
    desc = "Open Horizontal with id and size",
  },
  ["<leader>tmV"] = {
    "<cmd>ToggleTerminalVertical<cr>",
    desc = "Open Vertical with id and size",
  },
  ["<leader>tmf"] = {
    "<cmd>ToggleTerm direction=float<cr>",
    desc = "Open Float",
  },
  ["<leader>tmh"] = {
    "<cmd>ToggleTerm size=10 direction=horizontal<cr>",
    desc = "Open Horizontal",
  },
  ["<leader>tmn"] = { "<cmd>ToggleNode<cr>", desc = "Open Node" },
  ["<leader>tmp"] = { "<cmd>TogglePython<cr>", desc = "Open Python" },
  ["<leader>tmt"] = { "<cmd>ToggleHtop<cr>", desc = "Open Htop" },
  ["<leader>tmu"] = { "<cmd>ToggleNcdu<cr>", desc = "Open NCDU" },
  ["<leader>tmv"] = {
    "<cmd>ToggleTerm size=80 direction=vertical<cr>",
    desc = "Open Vertical",
  },
  ["<leader>te"] = { group = "Test" },
  ["<leader>ter"] = {
    function()
      require("neotest").run.run()
    end,
    desc = "Test Run",
  },
  ["<leader>tes"] = {
    function()
      require("neotest").run.stop()
    end,
    desc = "Test Stop",
  },
  ["<leader>teo"] = {
    function()
      require("neotest").output.open()
    end,
    desc = "Test Open",
  },
  ["<leader>teO"] = {
    function()
      require("neotest").output.open({ enter = true })
    end,
    desc = "Test Open Enter",
  },
  ["<leader>teS"] = {
    function()
      require("neotest").summary.toggle()
    end,
    desc = "Test Toggle Summary",
  },
  ["<leader>tef"] = {
    function()
      require("neotest").run.run(vim.fn.expand("%"))
    end,
    desc = "Test Run File",
  },
  ["<leader>tep"] = {
    function()
      require("neotest").jump.prev({ status = "failed" })
    end,
    desc = "Test Prev Failed",
    { noremap = false },
  },
  ["<leader>ten"] = {
    function()
      require("neotest").jump.next({ status = "failed" })
    end,
    desc = "Test Next Failed",
    { noremap = false },
  },
  ["<leader>tej"] = {
    function()
      require("neotest").run.run({ jestCommand = "jest --watch ", suite = true })
    end,
    desc = "Test Run jest Watch",
  },
  ["<leader>tev"] = {
    function()
      require("neotest").run.run({
        vitestCommand = "vitest --watch",
        suite = true,
      })
    end,
    desc = "Test Run Vitest Watch",
  },
  ["<leader>teV"] = {
    function()
      require("neotest").run.run({
        vim.fn.expand("%"),
        vitestCommand = "vitest --watch",
        suite = true,
      })
    end,
    desc = "Test Run Vitest File Watch",
  },
  ["<leader>ti"] = { group = "Timer" },
  ["<leader>tii"] = {
    function()
      vim.ui.input({ prompt = "Enter minutes: " }, function(minutes)
        if not minutes then
          LOG_ERROR("no time", "run failed")
        else
          vim.cmd("NomoTimer" .. minutes)
        end
      end)
    end,
    desc = "Timer input",
  },
  ["<leader>tim"] = { "<cmd>NomoMenu<cr>", desc = "Timer Menu" },
  ["<leader>ta"] = { group = "Tab" },
  ["<leader>tap"] = { "<cmd>tabprevious<cr>", desc = "Prev Tab" },
  ["<leader>tan"] = { "<cmd>tabNext<cr>", desc = "Next Tab" },
  ["<leader>tac"] = { "<cmd>tabclose<cr>", desc = "Close Tab" },
}
