return function(wk)
  wk.add({
    ["gC"] = { "<cmd>GoToContext<cr>", desc = "Jump to upper context" },
    ["gD"] = {
      "<cmd>Telescope lsp_definitions<cr>",
      desc = "Go to telescope definitions",
    },
    ["gF"] = {
      "<cmd>TSToolsFileReferences<cr>",
      desc = "Go to file references(TS)",
    },
    ["gI"] = {
      "<cmd>lua vim.lsp.buf.implementation()<cr>",
      desc = "Go to implementation",
    },
    ["gL"] = {
      "<cmd>lua vim.lsp.buf.references()<cr>",
      desc = "Go to references list",
    },
    ["gR"] = {
      "<cmd>Telescope lsp_references<cr>",
      desc = "Go to telescope references",
    },
    ["gS"] = {
      "<cmd>lua vim.lsp.buf.signature_help()<cr>",
      desc = "Show signature help",
    },
    ["gX"] = {
      "<cmd>OpenCurFile<cr>",
      desc = "Open current file with default app",
    },
    ["ga"] = {
      "<cmd>lua vim.lsp.buf.declaration()<cr>",
      desc = "Go to declaration",
    },
    ["gb"] = { "<c-t>", desc = "Go back" },
    ["gd"] = {
      "<cmd>lua vim.lsp.buf.definition()<cr>",
      desc = "Go to definition",
    },
    ["gh"] = { "<cmd>lua vim.lsp.buf.hover()<cr>", desc = "Show hover info" },
    ["gj"] = {
      "<cmd>lua vim.diagnostic.goto_next()<cr>",
      desc = "Go to next diagnostic",
    },
    ["gk"] = {
      "<cmd>lua vim.diagnostic.goto_prev()<cr>",
      desc = "Go to prev diagnostic",
    },
    ["gl"] = {
      '<cmd>lua vim.diagnostic.open_float({ border = "rounded", focusable = true })<cr>',
      desc = "Show diagnostic",
    },
    ["go"] = { "<c-o>", desc = "Jump back" },
    ["gs"] = {
      "<cmd>TSToolsGoToSourceDefinition<cr>",
      desc = "Go to source(TS)",
    },
    ["gw"] = { "<c-i>", desc = "Jump forward" },
    ["gr"] = { group = "Refactor" },
    ["gra"] = {
      "<cmd>lua vim.lsp.buf.code_action()<cr>",
      desc = "Show code action",
    },
    ["grn"] = { "<cmd>TSToolsRenameFile<cr>", desc = "Rename file(TS)" },
    ["grr"] = {
      "<cmd>lua vim.lsp.buf.rename()<cr>",
      desc = "Rename identifier",
    },
    ["grs"] = { "<cmd>TSToolsSortImports<cr>", desc = "Sort imports(TS)" },
  })
end
