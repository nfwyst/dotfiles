local lsp = vim.lsp
local lsp_methods = lsp.protocol.Methods
local hd = lsp.handlers
local code = { 7016, 80001, 80006, 80007, 2305, 6387, 7044, 1149 }
local base_definition = hd[lsp_methods.textDocument_definition]
local base_hint = hd[lsp_methods.textDocument_inlayHint]
local base_fold = hd[lsp_methods.textDocument_foldingRange]

local hint = {
  includeInlayParameterNameHints = "all",
  includeInlayParameterNameHintsWhenArgumentMatchesName = false,
  includeInlayFunctionParameterTypeHints = true,
  includeInlayVariableTypeHints = true,
  includeInlayPropertyDeclarationTypeHints = true,
  includeInlayFunctionLikeReturnTypeHints = true,
  includeInlayEnumMemberValueHints = true,
}

local function filter_hints_result(result)
  return FILTER_TABLE(result, function(_hint)
    local label = _hint.label
    if not label then
      return false
    end
    if label:len() >= 30 then
      _hint.label = label:sub(1, 29) .. "…"
      return true
    end
    return true
  end)
end

local function inlay_hint(err, result, ctx, config)
  local client = lsp.get_client_by_id(ctx.client_id)
  if client and client.name == "typescript-tools" and result then
    result = filter_hints_result(result)
  end
  return base_hint(err, result, ctx, config)
end

local filter_react_dts = function(value)
  if value.uri then
    return string.match(value.uri, "%.d.ts") == nil
  elseif value.targetUri then
    return string.match(value.targetUri, "%.d.ts") == nil
  end
end

local function definition(err, result, method, ...)
  if vim.islist(result) and #result > 1 then
    local filtered_result = FILTER_TABLE(result, filter_react_dts)
    return base_definition(err, filtered_result, method, ...)
  end

  return base_definition(err, result, method, ...)
end

local function folding_range(err, result, ctx, config)
  if not err and result then
    for _, r in pairs(result) do
      if r.startLine == r.endLine then
        r.kind = "region"
      end
    end
  end
  return base_fold(err, result, ctx, config)
end

return {
  "pmizio/typescript-tools.nvim",
  dependencies = { "nvim-lua/plenary.nvim", "neovim/nvim-lspconfig" },
  ft = {
    "javascript",
    "typescript",
    "javascriptreact",
    "typescriptreact",
  },
  config = function()
    local api = require("typescript-tools.api")
    local opt = {
      border = "rounded",
      width = "auto",
      max_width = GET_MAX_WIDTH(),
      silent = true,
    }
    require("typescript-tools").setup({
      on_attach = function(client)
        if client.name == "typescript-tools" then
          client.server_capabilities.documentFormattingProvider = false
          client.server_capabilities.documentRangeFormattingProvider = false
        end
      end,
      handlers = {
        ["textDocument/inlayHint"] = inlay_hint,
        ["textDocument/publishDiagnostics"] = api.filter_diagnostics(code),
        ["textDocument/hover"] = lsp.with(hd.hover, opt),
        ["textDocument/signatureHelp"] = lsp.with(hd.signature_help, opt),
        ["textDocument/definition"] = definition,
        ["textDocument/foldingRange"] = folding_range,
      },
      settings = {
        separate_diagnostic_server = true,
        expose_as_code_action = "all",
        tsserver_plugins = {
          "@styled/typescript-styled-plugin",
        },
        tsserver_logs = "off",
        tsserver_format_options = {
          allowIncompleteCompletions = true,
          allowRenameOfImportPath = true,
        },
        tsserver_file_preferences = MERGE_TABLE(hint, {
          includeCompletionsForModuleExports = true,
          quotePreference = "auto",
          includeCompletionsForImportStatements = true,
          includeAutomaticOptionalChainCompletions = true,
          includeCompletionsWithClassMemberSnippets = true,
          includeCompletionsWithObjectLiteralMethodSnippets = true,
          importModuleSpecifierPreference = "shortest",
        }),
        complete_function_calls = false,
        typescript = {
          inlayHints = hint,
        },
        javascript = {
          inlayHints = hint,
        },
      },
    })
    -- FIXME: wait for tsserver fix hint issue
    -- FIXME replace tsserver with typeScript-tools
    -- TOGGLE_INLAY_HINT()
  end,
}
