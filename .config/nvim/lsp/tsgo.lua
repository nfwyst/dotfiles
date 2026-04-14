--- @type vim.lsp.Config
--- tsgo: TypeScript/JavaScript LSP powered by typescript-go (TS 7.0)
--- Used for pure TS/JS/React projects (non-Vue) for maximum speed.
--- For Vue projects, vtsls is used instead (tsgo lacks Vue plugin support).
--- For projects with non-trivial baseUrl, vtsls is used (tsgo dropped baseUrl).
local ts_util = require("config.ts_util")

return {
  cmd = { "tsgo", "--lsp", "--stdio" },
  filetypes = {
    "javascript",
    "javascriptreact",
    "javascript.jsx",
    "typescript",
    "typescriptreact",
    "typescript.tsx",
  },
  -- Use root_dir function to prevent tsgo from starting in projects where
  -- vtsls should be used. This avoids the "start then kill" pattern that
  -- causes "exit code 1" errors.
  on_attach = function(client)
    local orig = client.request

    -- tsgo dev: codeLens/resolve returns null
    -- Workaround: pre-resolve via references/implementation, drop 0-count
    local KINDS = {
      references = { "textDocument/references", "references", { context = { includeDeclaration = false } } },
      implementations = { "textDocument/implementation", "implementations" },
    }

    local function resolve(lens, bufnr, on_result)
      local spec = lens.data and KINDS[lens.data.kind]
      if not spec then
        return on_result(lens)
      end
      local params = vim.tbl_extend("force", {
        textDocument = { uri = lens.data.uri },
        position = lens.range.start,
      }, spec[3] or {})
      orig(client, spec[1], params, function(_, result)
        local locs = type(result) == "table" and result or {}
        if #locs == 0 then
          return on_result(nil)
        end
        lens.command = {
          title = #locs .. " " .. spec[2],
          command = "editor.action.showReferences",
          arguments = { lens.data.uri, lens.range.start, locs },
        }
        on_result(lens)
      end, bufnr)
    end

    client.request = function(self, method, params, handler, bufnr)
      if method ~= "textDocument/codeLens" then
        return orig(self, method, params, handler, bufnr)
      end
      return orig(self, method, params, function(err, result, ctx)
        if err or not result or #result == 0 then
          if handler then
            handler(err, result, ctx)
          end
          return
        end
        local pending, filtered = #result, {}
        for _, lens in ipairs(result) do
          resolve(lens, bufnr, function(resolved)
            if resolved then
              table.insert(filtered, resolved)
            end
            pending = pending - 1
            if pending == 0 and handler then
              handler(nil, filtered, ctx)
            end
          end)
        end
      end, bufnr)
    end
  end,
  root_dir = function(bufnr, cb)
    local root = vim.fs.root(bufnr, ts_util.root_markers)
    if not root then
      return
    end
    -- Skip: Deno projects (handled by Deno LSP)
    if ts_util.is_deno_project(root) then
      return
    end
    -- Skip: Vue projects (need vtsls for @vue/typescript-plugin)
    if ts_util.is_vue_project(root) then
      return
    end
    -- Skip: projects with non-trivial baseUrl (tsgo dropped baseUrl support)
    if ts_util.needs_baseurl_fallback(root) then
      return
    end
    cb(root)
  end,
  on_new_config = function(new_config, root_dir)
    -- Prefer project-local tsgo for monorepo version consistency
    local local_bin = root_dir .. "/node_modules/.bin/tsgo"
    if vim.uv.fs_stat(local_bin) then
      new_config.cmd = { local_bin, "--lsp", "--stdio" }
    end
  end,
  settings = {
    typescript = {
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
        parameterNames = {
          enabled = "literals",
          suppressWhenArgumentMatchesName = true,
        },
        parameterTypes = { enabled = true },
        propertyDeclarationTypes = { enabled = true },
        variableTypes = { enabled = false },
      },
      suggest = {
        completeFunctionCalls = true,
        autoImports = true,
      },
      preferences = {
        importModuleSpecifier = "shortest",
        preferTypeOnlyAutoImports = true,
      },
    },
  },
}
