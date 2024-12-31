local methods = lsp.protocol.Methods
local handlers = lsp.handlers

local function filter_hints_result(result)
  return filter(function(_hint)
    local label = _hint.label
    if not label then
      return false
    end
    if label:len() >= 30 then
      _hint.label = label:sub(1, 29) .. "…"
      return true
    end
    return true
  end, result)
end

local function inlay_hint(err, result, ctx, config)
  local client = lsp.get_client_by_id(ctx.client_id)
  if client and client.name == "typescript-tools" and result then
    result = filter_hints_result(result)
  end
  local base_hint = handlers[methods.textDocument_inlayHint]
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
  local base_definition = handlers[methods.textDocument_definition]
  if islist(result) and #result > 1 then
    local filtered_result = filter(filter_react_dts, result)
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
  local base_fold = handlers[methods.textDocument_foldingRange]
  return base_fold(err, result, ctx, config)
end

local hint = {
  includeInlayParameterNameHints = "all",
  includeInlayParameterNameHintsWhenArgumentMatchesName = false,
  includeInlayFunctionParameterTypeHints = true,
  includeInlayVariableTypeHints = true,
  includeInlayPropertyDeclarationTypeHints = true,
  includeInlayFunctionLikeReturnTypeHints = true,
  includeInlayEnumMemberValueHints = true,
}

local function set_keymaps(bufnr)
  local function get_opt(desc)
    return { desc = desc, buffer = bufnr }
  end

  MAPS({
    n = {
      {
        from = "<leader>ci",
        to = function()
          NEED_ESLINT_FIX = true
          require("conform").format({
            timeout_ms = 1000,
            async = true,
          })
        end,
        opt = get_opt("Fixes All Fixable Errors By Eslint"),
      },
      {
        from = "<leader>ct",
        to = "",
        opt = get_opt("Typescript Tools"),
      },
      {
        from = "<leader>cto",
        to = "<cmd>TSToolsOrganizeImports<cr>",
        opt = get_opt("Sorts And Removes Unused Imports"),
      },
      {
        from = "<leader>cts",
        to = "<cmd>TSToolsSortImports<cr>",
        opt = get_opt("Sorts Imports"),
      },
      {
        from = "<leader>ctr",
        to = "<cmd>TSToolsRemoveUnusedImports<cr>",
        opt = get_opt("Removes Unused Imports"),
      },
      {
        from = "<leader>ctR",
        to = "<cmd>TSToolsRemoveUnused<cr>",
        opt = get_opt("Removes All Unused Statements"),
      },
      {
        from = "<leader>cta",
        to = "<cmd>TSToolsAddMissingImports<cr>",
        opt = get_opt("Adds Imports For All Statements"),
      },
      {
        from = "<leader>ctF",
        to = "<cmd>TSToolsFixAll<cr>",
        opt = get_opt("Fixes All Fixable Errors"),
      },
      {
        from = "<leader>ctg",
        to = "<cmd>TSToolsGoToSourceDefinition<cr>",
        opt = get_opt("Goes To Source Definition"),
      },
      {
        from = "<leader>ctm",
        to = "<cmd>TSToolsRenameFile<cr>",
        opt = get_opt("Rename Current File And Apply Changes"),
      },
      {
        from = "<leader>ctf",
        to = "<cmd>TSToolsFileReferences<cr>",
        opt = get_opt("Find Files That Reference The Current File"),
      },
    },
  })
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
    require("typescript-tools").setup({
      on_attach = function(client, bufnr)
        set_keymaps(bufnr)
        local cap = client.server_capabilities
        if client.name ~= "typescript-tools" then
          return
        end
        cap.documentFormattingProvider = false
        cap.documentRangeFormattingProvider = false
      end,
      handlers = {
        ["textDocument/inlayHint"] = inlay_hint,
        ["textDocument/publishDiagnostics"] = api.filter_diagnostics({
          7016,
          80001,
          80006,
          80007,
          2305,
          6387,
          7044,
          1149,
        }),
        ["textDocument/definition"] = definition,
        ["textDocument/foldingRange"] = folding_range,
      },
      settings = {
        expose_as_code_action = "all",
        tsserver_plugins = {
          "@styled/typescript-styled-plugin",
        },
        tsserver_logs = "off",
        tsserver_format_options = {
          allowIncompleteCompletions = true,
          allowRenameOfImportPath = true,
        },
        tsserver_file_preferences = merge(hint, {
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
  end,
}
