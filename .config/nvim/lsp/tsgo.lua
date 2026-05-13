--- @type vim.lsp.Config
--- tsgo: TypeScript/JavaScript LSP powered by typescript-go (TS 7.0)
--- Used for pure TS/JS/React projects (non-Vue) for maximum speed.
--- For Vue projects, vtsls is used instead (tsgo lacks Vue plugin support).
--- For projects with non-trivial baseUrl, vtsls is used (tsgo dropped baseUrl).
local ts_util = require("config.ts_util")

return {
  -- Use bun_cmd for direct path to JS wrapper (avoids mason/bin symlink).
  -- Falls back to $PATH "tsgo" if the JS entry file is missing.
  -- on_new_config below overrides this when a project-local tsgo exists.
  cmd = ts_util.bun_cmd(
    "tsgo",
    "node_modules/@typescript/native-preview/bin/tsgo.js",
    { "--lsp", "--stdio" }
  ),
  filetypes = {
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact",
  },
  -- Use root_dir function to prevent tsgo from starting in projects where
  -- vtsls should be used. This avoids the "start then kill" pattern that
  -- causes "exit code 1" errors.

  -- tsgo dev build (7.0.0-dev.20260510.1) stability workaround:
  -- After a crash/restart, tsgo may fail to detect workspace folders sent
  -- by Neovim, printing "No workspace folders detected" → "not initializing".
  -- Explicitly re-set workspace folders in on_init as a defensive measure.
  on_init = function(client, init_result)
    if not client.workspace_folders or #client.workspace_folders == 0 then
      local root = client.config.root_dir
      if root then
        client.workspace_folders = {
          {
            uri = vim.uri_from_fname(root),
            name = vim.fn.fnamemodify(root, ":t"),
          },
        }
      end
    end
  end,

  on_attach = function(client)
    local orig = client.request

    -- tsgo upstream bug (internal/ls/completions.go isValidTrigger default
    -- branch): panics on any triggerCharacter outside the 9 advertised chars
    -- (., ", ', `, /, @, <, #, space).
    --
    -- Real-world trigger: blink.cmp aggregates triggerCharacters from ALL
    -- active LSP clients on the buffer (sources/lsp/init.lua), so when
    -- emmet_language_server (or any other server on the same buffer)
    -- advertises ")", digits, ":", "^", etc., blink forwards them as
    -- triggerCharacter to tsgo too, crashing its completion handler.
    --
    -- Fix: intercept textDocument/completion in client.request and downgrade
    -- any non-whitelist triggerCharacter to a plain Invoked (triggerKind=1)
    -- request before it reaches tsgo.
    local TSGO_COMPLETION_TRIGGERS = {
      ["."] = true,
      ['"'] = true,
      ["'"] = true,
      ["`"] = true,
      ["/"] = true,
      ["@"] = true,
      ["<"] = true,
      ["#"] = true,
      [" "] = true,
    }

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
      -- Sanitize completion trigger chars before forwarding.
      if
        method == "textDocument/completion"
        and params
        and params.context
        and params.context.triggerCharacter
        and not TSGO_COMPLETION_TRIGGERS[params.context.triggerCharacter]
      then
        params.context = { triggerKind = 1 } -- Invoked
      end

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
    local root = ts_util.find_project_root(bufnr)
    if not root then
      cb(nil)
      return
    end
    -- Skip: Deno projects (handled by Deno LSP)
    if ts_util.is_deno_project(root) then
      cb(nil)
      return
    end
    -- Skip: Vue projects (need vtsls for @vue/typescript-plugin)
    if ts_util.is_vue_project(root) then
      cb(nil)
      return
    end
    -- Skip: projects with non-trivial baseUrl (tsgo dropped baseUrl support)
    if ts_util.needs_baseurl_fallback(root) then
      cb(nil)
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
    typescript = vim.tbl_deep_extend("force", ts_util.ts_common, {
      suggest = {
        completeFunctionCalls = true,
        autoImports = true,
      },
      preferences = {
        importModuleSpecifier = "shortest",
        preferTypeOnlyAutoImports = true,
      },
    }),
  },
}
