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

local refresh_time = 1000

return {
  "nvim-lualine/lualine.nvim",
  opts = function(_, opts)
    local icons = LazyVim.config.icons
    local opt = {
      options = {
        always_show_tabline = true,
        component_separators = { left = "", right = "" },
        section_separators = { left = "", right = "" },
        ignore_focus = { "neo-tree" },
        refresh = {
          statusline = refresh_time,
          tabline = refresh_time / 2,
          winbar = refresh_time,
        },
      },
      sections = {
        lualine_a = {
          "mode",
          {
            "tabs",
            show_modified_status = false,
            cond = function()
              return fn.tabpagenr("$") > 1
            end,
          },
        },
        lualine_b = {
          "branch",
          {
            lsps,
            padding = { left = 0, right = 1 },
          },
        },
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
              local gitsigns = b.gitsigns_status_dict
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
      tabline = {
        lualine_a = {
          {
            "buffers",
            show_modified_status = true,
            max_length = o.columns,
            filetype_names = {
              snacks_dashboard = "dashboard",
              ["neo-tree"] = "file tree",
            },
            symbols = {
              alternate_file = "",
            },
          },
        },
        lualine_x = {
          {
            function()
              local root = fs.basename(LazyVim.root.get())
              local git = fs.basename(LazyVim.root.git())
              if git == root then
                return root
              end
              return git .. "" .. root
            end,
            cond = function()
              return bo[CUR_BUF()].filetype ~= "snacks_dashboard"
            end,
            padding = { left = 1, right = 1 },
            color = { fg = "#37f499" },
          },
        },
      },
      winbar = {
        lualine_c = {
          {
            "filename",
            file_status = false,
            shorting_target = 0,
            newfile_status = false,
            cond = function()
              local listed = IS_BUF_LISTED(CUR_BUF())
              return not IS_ZEN_MODE and listed
            end,
            path = 3,
            color = { fg = "#04d1f9", bg = "NONE" },
          },
        },
      },
      extensions = LINUX and {} or { "lazy", "fzf" },
    }

    return merge(opts, opt)
  end,
}
