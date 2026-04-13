--- @type vim.lsp.Config
--- vtsls: TypeScript/JavaScript LSP (via vtsls wrapping tsserver)
--- Only activated in Vue projects where @vue/typescript-plugin is needed.
--- For non-Vue projects, tsgo is used instead for better performance.
local lib = "/mason/packages/vtsls/node_modules/@vtsls/language-server/node_modules/typescript/lib"
local tsdk_path = vim.fn.stdpath("data") .. lib
local tsdk = nil
if vim.fn.isdirectory(tsdk_path) == 1 then
  tsdk = tsdk_path
end
local bun_path = vim.fn.exepath("bun")

-- Resolve @vue/typescript-plugin from Mason-installed vue-language-server.
-- This plugin enables TypeScript intellisense inside .vue <script> blocks
-- when vtsls is the TypeScript server.
local vue_plugin_path = vim.fn.stdpath("data")
  .. "/mason/packages/vue-language-server/node_modules/@vue/language-server"
local vue_plugin = nil
if vim.fn.isdirectory(vue_plugin_path) == 1 then
  vue_plugin = vue_plugin_path
end

return {
  cmd = { "bun", "run", "--bun", "vtsls", "--stdio" },
  filetypes = {
    "javascript",
    "javascriptreact",
    "javascript.jsx",
    "typescript",
    "typescriptreact",
    "typescript.tsx",
    "mdx",
    "vue",
  },
  root_markers = { "tsconfig.json", "package.json", "jsconfig.json", ".git" },
  get_language_id = function(_, filetype)
    -- Tell vtsls to treat MDX as native TSX so tsserver provides completions
    -- without relying on @mdx-js/typescript-plugin (which has a completion bug).
    if filetype == "mdx" then
      return "typescriptreact"
    end
    return filetype
  end,
  on_attach = function(client, bufnr)
    if vim.bo[bufnr].filetype == "mdx" then
      -- MDX contains markdown prose that generates false positive TS parse
      -- errors when treated as TSX. Suppress vtsls diagnostics for MDX.
      local ns = vim.lsp.diagnostic.get_namespace(client.id)
      vim.diagnostic.enable(false, { bufnr = bufnr, ns_id = ns })
    end

    -- Register moveToFile refactoring command handler (from LazyVim vtsls extra)
    client.commands = client.commands or {}
    if not client.commands["_typescript.moveToFileRefactoring"] then
      client.commands["_typescript.moveToFileRefactoring"] = function(command, ctx)
        ---@type string, string, lsp.Range
        local action, uri, range = unpack(command.arguments)

        local function move(newf)
          client:request("workspace/executeCommand", {
            command = command.command,
            arguments = { action, uri, range, newf },
          })
        end

        local fname = vim.uri_to_fname(uri)
        client:request("workspace/executeCommand", {
          command = "typescript.tsserverRequest",
          arguments = {
            "getMoveToRefactoringFileSuggestions",
            {
              file = fname,
              startLine = range.start.line + 1,
              startOffset = range.start.character + 1,
              endLine = range["end"].line + 1,
              endOffset = range["end"].character + 1,
            },
          },
        }, function(_, result)
          ---@type string[]
          local files = result.body.files
          table.insert(files, 1, "Enter new path...")
          vim.ui.select(files, {
            prompt = "Select move destination:",
            format_item = function(f)
              return vim.fn.fnamemodify(f, ":~:.")
            end,
          }, function(f)
            if f and f:find("^Enter new path") then
              vim.ui.input({
                prompt = "Enter move destination:",
                default = vim.fn.fnamemodify(fname, ":h") .. "/",
                completion = "file",
              }, function(newf)
                return newf and move(newf)
              end)
            elseif f then
              move(f)
            end
          end)
        end)
      end
    end
  end,
  settings = {
    complete_function_calls = true,
    typescript = {
      npm = bun_path,
      tsdk = tsdk,
      updateImportsOnFileMove = { enabled = "always" },
      suggest = {
        completeFunctionCalls = true,
      },
      inlayHints = {
        enumMemberValues = { enabled = true },
        functionLikeReturnTypes = { enabled = true },
        parameterNames = { enabled = "literals" },
        parameterTypes = { enabled = true },
        propertyDeclarationTypes = { enabled = true },
        variableTypes = { enabled = false },
      },
      tsserver = {
        maxTsServerMemory = 1024 * 8,
        nodePath = bun_path,
      },
    },
    vtsls = {
      typescript = { globalTsdk = tsdk },
      enableMoveToFileCodeAction = true,
      autoUseWorkspaceTsdk = true,
      tsserver = {
        globalPlugins = vue_plugin and {
          {
            name = "@vue/typescript-plugin",
            location = vue_plugin,
            languages = { "vue" },
            configNamespace = "typescript",
            enableForWorkspaceTypeScriptVersions = true,
          },
        } or {},
      },
      experimental = {
        maxInlayHintLength = 30,
        completion = {
          enableServerSideFuzzyMatch = true,
        },
        -- Disabled for Vue projects to improve performance.
        -- Vue projects are typically large and project diagnostics
        -- cause significant slowdowns with @vue/typescript-plugin.
        enableProjectDiagnostics = false,
      },
    },
  },
}
