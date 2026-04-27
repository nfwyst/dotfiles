--- @type vim.lsp.Config
--- vtsls: TypeScript/JavaScript LSP (via vtsls wrapping tsserver)
--- Activated in Vue projects (for @vue/typescript-plugin) and projects
--- with non-trivial baseUrl (tsgo dropped baseUrl support).
--- For all other TS/JS projects, tsgo is used for better performance.
local ts_util = require("config.ts_util")

local tsdk = ts_util.mason_tsdk()
local bun_path = vim.fn.exepath("bun")

-- Resolve @vue/typescript-plugin from Mason-installed vue-language-server.
-- This plugin enables TypeScript intellisense inside .vue <script> blocks
-- when vtsls is the TypeScript server.
local vue_plugin_path = vim.fn.stdpath("data")
  .. "/mason/packages/vue-language-server/node_modules/@vue/language-server"
local vue_plugin = vim.fn.isdirectory(vue_plugin_path) == 1 and vue_plugin_path or nil

local config = {
  npm = bun_path,
  tsdk = tsdk,
  updateImportsOnFileMove = { enabled = "always" },
  suggest = {
    completeFunctionCalls = true,
  },
  referencesCodeLens = {
    enabled = true,
    showOnAllFunctions = true,
  },
  implementationsCodeLens = {
    enabled = true,
    showOnInterfaceMethods = true,
    showOnAllClassMethods = true,
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
}

return {
  cmd = ts_util.bun_cmd(
    "vtsls",
    "node_modules/@vtsls/language-server/bin/vtsls.js",
    { "--stdio" }
  ),
  filetypes = {
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact",
    "mdx",
    "vue",
  },
  -- Use root_dir function to only start vtsls where it's actually needed.
  -- This is the complement of tsgo.lua's root_dir — they are mutually exclusive.
  root_dir = function(bufnr, cb)
    local root = ts_util.find_project_root(bufnr)
    if not root then
      return
    end
    -- Skip: Deno projects (handled by Deno LSP)
    if ts_util.is_deno_project(root) then
      return
    end
    -- Start vtsls for Vue projects OR projects with non-trivial baseUrl
    if ts_util.is_vue_project(root) or ts_util.needs_baseurl_fallback(root) then
      cb(root)
    end
    -- Otherwise: tsgo handles this project, don't start vtsls
  end,
  get_language_id = function(_, filetype)
    if filetype == "mdx" then
      return "typescriptreact"
    end
    return filetype
  end,
  on_attach = function(client, bufnr)
    if vim.bo[bufnr].filetype == "mdx" then
      local ns = vim.lsp.diagnostic.get_namespace(client.id)
      vim.diagnostic.enable(false, { bufnr = bufnr, ns_id = ns })
    end

    -- Register moveToFile refactoring command handler
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
    typescript = config,
    javascript = config,
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
        enableProjectDiagnostics = false,
      },
    },
  },
}
