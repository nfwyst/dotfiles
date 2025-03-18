local lspMethodMap = {
  [LSP_METHODS.textDocument_typeDefinition] = "lsp_typedefs",
  [LSP_METHODS.textDocument_declaration] = "lsp_declarations",
  [LSP_METHODS.textDocument_references] = "lsp_references",
  [LSP_METHODS.textDocument_definition] = "lsp_definitions",
  [LSP_METHODS.textDocument_implementation] = "lsp_implementations",
}

local function fix_lsp_handlers()
  local handlers = lsp.handlers
  local fzf = package.loaded["fzf-lua"]
  if not fzf then
    return
  end

  for name, fzf_name in pairs(lspMethodMap) do
    if not handlers[name] then
      handlers[name] = fzf[fzf_name]
    end
  end
end

return {
  "nvimdev/lspsaga.nvim",
  event = "LspAttach",
  keys = {
    { "<leader>cL", "", desc = "lsp saga" },
    { "<leader>cLi", "<cmd>Lspsaga incoming_calls<cr>", desc = "Lspsaga: Incoming Calls" },
    { "<leader>cLo", "<cmd>Lspsaga outgoing_calls<cr>", desc = "Lspsaga: Outgoing Calls" },
    { "<leader>cLt", "<cmd>Lspsaga subtypes<cr>", desc = "Lspsaga: SubTypes" },
    { "<leader>cLT", "<cmd>Lspsaga supertypes<cr>", desc = "Lspsaga: SuperTypes" },
  },
  config = function()
    -- FIXME: some handler messing in nvim 0.11
    defer(fix_lsp_handlers, 10)

    require("lspsaga").setup({
      implement = {
        enable = false,
      },
      symbol_in_winbar = {
        enable = false,
      },
      lightbulb = {
        enable = false,
      },
      beacon = {
        enable = false,
      },
      ui = {
        expand = "",
        collapse = " ",
      },
    })
  end,
}
