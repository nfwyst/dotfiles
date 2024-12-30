local progress = {
  function()
    local current_line = fn.line(".")
    local total_lines = fn.line("$")
    local chars = {
      "  ",
      "▁▁",
      "▂▂",
      "▃▃",
      "▄▄",
      "▅▅",
      "▆▆",
      "▇▇",
      "██",
    }
    local line_ratio = current_line / total_lines
    local index = math.ceil(line_ratio * #chars)
    return chars[index]
  end,
  padding = 0,
}

local lsps = function()
  local clients = lsp.get_clients({ bufnr = CUR_BUF() })
  local names = {}
  for _, client in pairs(clients) do
    PUSH(names, client.name)
  end
  local result = table.concat(names, "•")
  if result == "" then
    return ""
  end
  return "󱓞 " .. result
end

return {
  "nvim-lualine/lualine.nvim",
  opts = function(_, opts)
    local icons = LazyVim.config.icons
    local opt = {
      options = {
        component_separators = { left = "", right = "" },
        section_separators = { left = "", right = "" },
        ignore_focus = { "neo-tree" },
      },
      sections = {
        lualine_a = {
          "mode",
          {
            "tabs",
            use_mode_colors = true,
            show_modified_status = false,
            cond = function()
              return fn.tabpagenr("$") > 1
            end,
          },
        },
        lualine_b = { "branch", lsps },
        lualine_c = {
          {
            function()
              return require("nomodoro").status()
            end,
            cond = function()
              return package.loaded["nomodoro"]
            end,
            color = { fg = "#dc322f" },
            padding = { left = 0, right = 1 },
          },
          LazyVim.lualine.root_dir(),
          {
            "diagnostics",
            symbols = {
              error = icons.diagnostics.Error,
              warn = icons.diagnostics.Warn,
              info = icons.diagnostics.Info,
              hint = icons.diagnostics.Hint,
            },
            update_in_insert = false,
            cond = function()
              return BUF_VAR(CUR_BUF(), CONSTANTS.LINT_INITED)
            end,
          },
          { "filetype", icon_only = true, separator = "", padding = { left = 1, right = 0 } },
        },
        lualine_x = {
          Snacks.profiler.status(),
          {
            function()
              return require("noice").api.status.command.get()
            end,
            cond = function()
              return package.loaded["noice"] and require("noice").api.status.command.has()
            end,
            color = function()
              return { fg = Snacks.util.color("Statement") }
            end,
          },
          {
            function()
              return require("noice").api.status.mode.get()
            end,
            cond = function()
              return package.loaded["noice"] and require("noice").api.status.mode.has()
            end,
            color = function()
              return { fg = Snacks.util.color("Constant") }
            end,
          },
          {
            function()
              return "  " .. require("dap").status()
            end,
            cond = function()
              return package.loaded["dap"] and require("dap").status() ~= ""
            end,
            color = function()
              return { fg = Snacks.util.color("Debug") }
            end,
          },
          {
            require("lazy.status").updates,
            cond = function()
              if LINUX then
                return false
              end
              return require("lazy.status").has_updates()
            end,
            color = function()
              return { fg = Snacks.util.color("Special") }
            end,
          },
          {
            "diff",
            symbols = {
              added = icons.git.added,
              modified = icons.git.modified,
              removed = icons.git.removed,
            },
            source = function()
              local gitsigns = vim.b.gitsigns_status_dict
              if gitsigns then
                return {
                  added = gitsigns.added,
                  modified = gitsigns.changed,
                  removed = gitsigns.removed,
                }
              end
            end,
          },
        },
        lualine_y = {
          {
            function()
              return "󱁐:" .. bo[CUR_BUF()].shiftwidth
            end,
          },
          { "encoding", padding = { left = 0, right = 1 } },
          { "location", padding = { left = 0, right = 1 } },
        },
        lualine_z = { progress },
      },
      extensions = { "lazy", "fzf" },
    }

    return merge(opts, opt)
  end,
}
