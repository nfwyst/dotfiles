--- @type vim.lsp.Config
local ts_util = require("config.ts_util")

-- cssmodules-language-server returns bare absolute paths in Location.uri
-- for cross-file `.less`/`.module.css` jumps (LSP spec violation).
-- Neovim's vim.uri.uri_to_fname asserts `scheme:` prefix and crashes the
-- snacks picker (which consumes raw result via vim.lsp.util.locations_to_items).
-- Workaround: wrap client.request and normalize Location[].uri /
-- LocationLink[].targetUri back to proper file:// URIs before handler runs.
local LOCATION_METHODS = {
  ["textDocument/definition"] = true,
  ["textDocument/declaration"] = true,
  ["textDocument/typeDefinition"] = true,
  ["textDocument/implementation"] = true,
  ["textDocument/references"] = true,
}

local function normalize_uri(s)
  if type(s) ~= "string" or s == "" then
    return s
  end
  -- Already has scheme (file:, untitled:, jdt:, ...)
  if s:match("^%a[%w+.%-]*:") then
    return s
  end
  -- Bare absolute POSIX path → file:// URI
  if s:sub(1, 1) == "/" then
    return vim.uri_from_fname(s)
  end
  return s
end

local function normalize_location(loc)
  if type(loc) ~= "table" then
    return
  end
  if loc.uri then
    loc.uri = normalize_uri(loc.uri)
  end
  if loc.targetUri then
    loc.targetUri = normalize_uri(loc.targetUri)
  end
end

local function normalize_result(result)
  if type(result) ~= "table" then
    return
  end
  if result.uri or result.targetUri then
    normalize_location(result)
  else
    for _, loc in ipairs(result) do
      normalize_location(loc)
    end
  end
end

return {
  cmd = ts_util.bun_cmd(
    "cssmodules-language-server",
    "node_modules/cssmodules-language-server/lib/cli.js"
  ),
  filetypes = { "javascript", "javascriptreact", "typescript", "typescriptreact" },
  root_markers = { "package.json", ".git" },
  on_attach = function(client)
    local orig = client.request
    client.request = function(self, method, params, handler, bufnr)
      if not LOCATION_METHODS[method] then
        return orig(self, method, params, handler, bufnr)
      end
      return orig(self, method, params, function(err, result, ctx)
        if not err then
          normalize_result(result)
        end
        if handler then
          handler(err, result, ctx)
        end
      end, bufnr)
    end
  end,
}
