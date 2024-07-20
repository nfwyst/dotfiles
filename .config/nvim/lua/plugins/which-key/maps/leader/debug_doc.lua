return {
  ["<leader>d"] = { group = "Debuger/Doc" },
  ["<leader>de"] = { group = "Debuger" },
  ["<leader>deB"] = {
    "<cmd>SetBreakPointCondition<cr>",
    desc = "Set breakpoint condition",
  },
  ["<leader>deC"] = { "<cmd>DapUiClose<cr>", desc = "Dap UI Close" },
  ["<leader>deE"] = { "<cmd>DapCloseRepl<cr>", desc = "Close repl" },
  ["<leader>deJ"] = { "<cmd>DebugJest<cr>", desc = "Debug jest" },
  ["<leader>deO"] = { "<cmd>DapUiOpen<cr>", desc = "Dap UI Open" },
  ["<leader>deR"] = { "<cmd>ClearBreakpoints<cr>", desc = "Clear breakpoint" },
  ["<leader>deb"] = { "<cmd>DapToggleBreakpoint<cr>", desc = "Set breakpoint" },
  ["<leader>dec"] = { "<cmd>DapContinue<cr>", desc = "Continue" },
  ["<leader>dee"] = {
    "<cmd>SetExceptionBreakpoints<cr>",
    desc = "Debug set exception breakpoint",
  },
  ["<leader>def"] = { "<cmd>Telescope dap frames<cr>", desc = "Dap frames" },
  ["<leader>deh"] = { "<cmd>DapUiHover<cr>", desc = "Dap UI Widgets Hover" },
  ["<leader>dei"] = { "<cmd>DapStepInto<cr>", desc = "Step Into" },
  ["<leader>dej"] = { "<cmd>DapDown<cr>zz", desc = "Dap down" },
  ["<leader>dek"] = { "<cmd>DapUp<cr>zz", desc = "Dap Up" },
  ["<leader>del"] = {
    "<cmd>Telescope dap list_breakpoints<cr>",
    desc = "List breakpoints",
  },
  ["<leader>den"] = { "<cmd>DebugNode<cr>", desc = "Debug node" },
  ["<leader>deo"] = { "<cmd>DapStepOut<cr>", desc = "Step out" },
  ["<leader>der"] = { "<cmd>DapOpenRepl<cr><c-w>l", desc = "Open repl" },
  ["<leader>des"] = { "<cmd>DapUiScopes<cr>", desc = "Dap UI Widgets Scopes" },
  ["<leader>det"] = { "<cmd>DapTerminate<cr>", desc = "Terminate" },
  ["<leader>deu"] = { "<cmd>DapRuntoCursor<cr>", desc = "Run to cursor" },
  ["<leader>dev"] = { "<cmd>DapStepOver<cr>", desc = "Step Over" },
  ["<leader>do"] = { group = "Doc" },
  ["<leader>doF"] = { "<cmd>Neogen file<cr>", desc = "File Doc" },
  ["<leader>doc"] = { "<cmd>Neogen class<cr>", desc = "Class Doc" },
  ["<leader>dof"] = { "<cmd>Neogen func<cr>", desc = "Func Doc" },
  ["<leader>dot"] = { "<cmd>Neogen type<cr>", desc = "Type Doc" },
}
