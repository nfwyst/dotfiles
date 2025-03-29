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
  "nushell",
  "gopls",
  "pylyzer",
}
local disabled_lsp_servers = {
  "vtsls",
  "pyright",
}

local function override(servers)
  local windows = require("lspconfig.ui.windows")
  windows.default_options.border = "rounded"
  for _, name in ipairs(lsp_servers) do
    local path = "plugins.lsp.settings." .. name
    local ok, settings = pcall(require, path)
    if not ok or not settings then
      settings = {}
    end

    servers[name] = merge(servers[name] or {}, settings)
  end

  for _, name in ipairs(disabled_lsp_servers) do
    servers[name] = nil
  end

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

lsp.set_log_level(levels.OFF)
local lualine_lsp = {
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
}

return {
  "neovim/nvim-lspconfig",
  opts = function(_, opts)
    ADD_LUALINE_COMPONENT("lualine_b", lualine_lsp)
    override(opts.servers)
    local icons = LazyVim.config.icons.diagnostics
    local opt = {
      diagnostics = {
        underline = false,
        update_in_insert = false,
        virtual_text = false,
        virtual_lines = false,
        severity_sort = true,
        float = {
          focusable = true,
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
