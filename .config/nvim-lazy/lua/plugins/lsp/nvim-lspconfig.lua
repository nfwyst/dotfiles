local lsp_servers = {
  "jsonls",
  "lua_ls",
  "ts_ls",
  "cssls",
  "html",
  "yamlls",
  "tailwindcss",
  "marksman",
  "svelte",
  "bashls",
  "taplo",
  "vtsls",
}

if not IS_LINUX then
  PUSH(lsp_servers, "gopls")
end

local function get_servers()
  local servers = {}
  for _, name in ipairs(lsp_servers) do
    local path = "plugins.lsp.settings." .. name
    local ok, settings = pcall(require, path)
    servers[name] = ok and settings or {}
  end
  return servers
end

local function override()
  local windows = require("lspconfig.ui.windows")
  windows.default_options.border = "rounded"

  local keys = require("lazyvim.plugins.lsp.keymaps").get()
  push_list(keys, {
    { "K", false },
    { "<c-k>", false, mode = "i" },
    {
      "gk",
      function()
        return lsp.buf.hover()
      end,
      desc = "Hover",
    },
  })
end

local virtual_text = {
  spacing = 4,
  source = "if_many",
  prefix = "",
  suffix = "",
  format = function(diagnostic)
    return "● " .. diagnostic.message
  end,
}
if IS_LINUX then
  virtual_text = nil
end

local ui_opt = {
  border = "rounded",
  width = "auto",
  silent = true,
  max_width = GET_MAX_WIDTH(),
}

lsp.set_log_level(levels.OFF)

return {
  "neovim/nvim-lspconfig",
  dependencies = {
    {
      "nvim-lualine/lualine.nvim",
      module = false,
      opts = function(_, opts)
        PUSH(opts.sections.lualine_b, {
          function()
            local clients = lsp.get_clients({ bufnr = CUR_BUF() })
            local names = {}
            for _, client in pairs(clients) do
              PUSH(names, client.name)
            end
            local result = table.concat(names, "•")
            if result == "" then
              return ""
            end
            local prefix = IS_LAUNCH_FROM_GIT_REPO and "" or " "
            return prefix .. "󱓞 " .. result
          end,
          padding = { left = 0, right = 1 },
        })
      end,
    },
  },
  opts = function(_, opts)
    override()

    local icons = LazyVim.config.icons.diagnostics
    local md = lsp.protocol.Methods
    local hl = lsp.handlers

    hl[md.textDocument_hover] = lsp.with(hl.hover, ui_opt)
    hl[md.textDocument_signatureHelp] = lsp.with(hl.signature_help, ui_opt)

    local opt = {
      servers = get_servers(),
      diagnostics = {
        underline = false,
        update_in_insert = false,
        virtual_text = virtual_text or false,
        severity_sort = true,
        float = {
          focusable = false,
          style = "minimal",
          border = "rounded",
          source = "always",
        },
        signs = {
          text = {
            [severity.ERROR] = icons.Error,
            [severity.WARN] = icons.Warn,
            [severity.HINT] = icons.Hint,
            [severity.INFO] = icons.Info,
          },
        },
      },
      inlay_hints = {
        enabled = false,
      },
      codelens = {
        enabled = false,
      },
      setup = {
        tailwindcss = function(_, tw_opts)
          local tw = LazyVim.lsp.get_raw_config("tailwindcss")
          tw_opts.filetypes = tw_opts.filetypes or {}
          push_list(tw_opts.filetypes, tw.default_config.filetypes)

          tw_opts.filetypes = EXCLUDE_LIST(tw_opts.filetypes, tw_opts.filetypes_exclude)

          push_list(tw_opts.filetypes, tw_opts.filetypes_include or {})
        end,
        vtsls = function()
          return true
        end,
        ts_ls = function()
          return true
        end,
      },
    }

    return merge(opts, opt)
  end,
}
