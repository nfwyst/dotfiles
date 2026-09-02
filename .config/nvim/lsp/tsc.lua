--- @type vim.lsp.Config
--- tsc: TypeScript/JavaScript LSP powered by the native TypeScript 7 compiler.
--- Default TS/JS/React server for maximum speed.
--- Vue projects use vtsls instead because TS 7 lacks Vue plugin support.
--- Note: TS 7 can still hit upstream compiler/LSP crashes;
--- keep vtsls available as Vue-only fallback, not default TS server.
local ts_util = require("config.ts_util")

local cmd = ts_util.bun_cmd("tsc", "node_modules/typescript/bin/tsc", { "--lsp", "--stdio" })

-- bun_cmd falls back to a bare $PATH "tsc" when the Mason package is missing.
-- That binary may be TypeScript <=6, whose JS tsc has no --lsp support and
-- would exit immediately on spawn. Probe the fallback version once and, if it
-- is not TS 7+, refuse to start via root_dir below (same skip pattern as the
-- Deno/Vue guards) instead of crash-looping with "exit code 1".
local path_tsc_ts7 = true
if cmd[1] == "tsc" then
  local ver = vim.system({ "tsc", "--version" }, { text = true, timeout = 5000 }):wait()
  local major = tonumber((ver.stdout or ""):match("Version%s+(%d+)"))
  path_tsc_ts7 = (major or 0) >= 7
end
local path_tsc_notified = false

return {
  -- Use bun_cmd for direct path to JS wrapper (avoids mason/bin symlink).
  -- Falls back to $PATH "tsc" if the JS entry file is missing (guarded above).
  -- before_init below overrides this when a project-local TS 7 exists.
  cmd = cmd,
  filetypes = {
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact",
  },
  workspace_required = true,
  -- Use root_dir function to prevent tsc from starting in projects where
  -- vtsls should be used. This avoids the "start then kill" pattern that
  -- causes "exit code 1" errors.

  -- tsc dev build (TS 7.0) stability workaround:
  -- After a crash/restart, the server may fail to detect workspace folders sent
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

    -- TS 7 (typescript-go) upstream bug (internal/ls/completions.go isValidTrigger default
    -- branch): panics on any triggerCharacter outside the advertised chars.
    --
    -- Real-world trigger: blink.cmp aggregates triggerCharacters from ALL
    -- active LSP clients on the buffer (sources/lsp/init.lua), so when
    -- emmet_language_server (or any other server on the same buffer)
    -- advertises ")", digits, ":", "^", etc., blink forwards them as
    -- triggerCharacter to the TS server too, crashing its completion handler.
    --
    -- Fix: intercept textDocument/completion in client.request and downgrade
    -- any non-whitelist triggerCharacter to a plain Invoked (triggerKind=1)
    -- request before it reaches the server.
    local TS_COMPLETION_TRIGGERS = {
      ["."] = true,
      ['"'] = true,
      ["'"] = true,
      ["`"] = true,
      ["/"] = true,
      ["@"] = true,
      ["<"] = true,
      ["#"] = true,
      [" "] = true,
      ["*"] = true,
    }

    -- tsc dev: codeLens/resolve returns null
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
        and not TS_COMPLETION_TRIGGERS[params.context.triggerCharacter]
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
    if not path_tsc_ts7 then
      if not path_tsc_notified then
        path_tsc_notified = true
        vim.notify("tsc LSP skipped: $PATH tsc is not TypeScript 7+", vim.log.levels.WARN)
      end
      return
    end
    local root = ts_util.find_project_root(bufnr)
    local root = ts_util.find_project_root(bufnr)
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
    cb(root)
  end,
  before_init = function(_, config)
    -- Prefer project-local TypeScript (TS 7 tsc or native-preview tsgo) for
    -- monorepo version consistency
    local root = config.root_dir
    if not root then
      return
    end

    -- Use project-local tsc only when the project pins TypeScript 7+
    -- (TypeScript <=6 ships a JS tsc that has no --lsp support).
    local ts_pkg = root .. "/node_modules/typescript/package.json"
    local ts7 = false
    if vim.uv.fs_stat(ts_pkg) then
      local ok, dec = pcall(vim.json.decode, table.concat(vim.fn.readfile(ts_pkg), "\n"))
      local major = ok and dec and dec.version and tonumber(tostring(dec.version):match("^(%d+)")) or 0
      ts7 = (major or 0) >= 7
    end
    if ts7 then
      local local_tsc = root .. "/node_modules/.bin/tsc"
      if vim.uv.fs_stat(local_tsc) then
        config.cmd = { local_tsc, "--lsp", "--stdio" }
        return
      end
    end

    -- Legacy native-preview projects still run their own tsgo binary
    local local_tsgo = root .. "/node_modules/.bin/tsgo"
    if vim.uv.fs_stat(local_tsgo) then
      config.cmd = { local_tsgo, "--lsp", "--stdio" }
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
