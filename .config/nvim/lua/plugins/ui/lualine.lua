local function lsp_info()
  local clients = vim.lsp.get_clients({ bufnr = vim.api.nvim_get_current_buf() })
  local names = {}
  for _, client in pairs(clients) do
    names[#names + 1] = client.name:match("([^_]+)")
  end
  local result = table.concat(names, "•")
  if result == "" then
    return ""
  end
  return "󱓞 " .. result
end

return {
  "nvim-lualine/lualine.nvim",
  dependencies = { "folke/noice.nvim" },
  opts = function(_, opts)
    local icons = LazyVim.config.icons

    local opt = {
      options = {
        ignore_focus = { "neo-tree", "Avante", "AvanteInput", "codecompanion" },
        globalstatus = true,
        component_separators = { left = " ▎", right = " ▎" },
      },
      sections = {
        lualine_a = {
          "mode",
        },
        lualine_b = {
          "branch",
          {
            "tabs",
            cond = function()
              return vim.fn.tabpagenr("$") > 1
            end,
          },
        },
        lualine_c = {
          LazyVim.lualine.root_dir(),
          lsp_info,
          {
            "diagnostics",
            update_in_insert = false,
            cond = function()
              return vim.diagnostic.is_enabled({ bufnr = vim.api.nvim_get_current_buf() })
            end,
            symbols = {
              error = icons.diagnostics.Error,
              warn = icons.diagnostics.Warn,
              info = icons.diagnostics.Info,
              hint = icons.diagnostics.Hint,
            },
          },
          { "filetype", colored = false, icon_only = false, padding = { left = 1, right = 1 } },
          {
            function()
              if not package.loaded.nomodoro then
                return " 🍅"
              end

              return require("nomodoro").status()
            end,
            color = function()
              local color = {}
              if vim.o.background == "dark" then
                color.fg = "#04d1f9"
              end

              return color
            end,
            padding = { left = 0, right = 1 },
          },
        },
        lualine_y = {
          {
            function()
              return "󱁐:" .. vim.api.nvim_get_option_value("shiftwidth", { buf = vim.api.nvim_get_current_buf() })
            end,
            padding = { left = 0, right = 0 },
          },
          { "encoding", padding = { left = 0, right = 1 } },
        },
        lualine_z = {
          { "progress", separator = " ", padding = { left = 1, right = 0 } },
          { "location", padding = { left = 0, right = 1 } },
        },
      },
      winbar = {
        lualine_c = {
          {
            "filename",
            file_status = false,
            newfile_status = true,
            path = 3,
            shorting_target = 0,
            symbols = {
              modified = "",
              readonly = "󰌾",
              unnamed = "[No Name]",
              newfile = "[New]",
            },
            color = {
              fg = "#04d1f9",
            },
            cond = function()
              local bufname = vim.api.nvim_buf_get_name(vim.api.nvim_get_current_buf())
              local matched = string.match(bufname, "^/.*[%a]+$")
              if not matched then
                return false
              end

              return true
            end,
            padding = { left = 0, right = 0 },
          },
          {
            function()
              ---@diagnostic disable-next-line: undefined-field
              local searchcount = require("noice").api.status.search.get()
              local current, total = searchcount:match("%[(%d+)/(%d+)%]")
              return " " .. current .. "󰿟" .. total
            end,
            ---@diagnostic disable-next-line: undefined-field
            cond = require("noice").api.status.search.has,
            color = { fg = "#ff9e64" },
            padding = { left = 1, right = 0 },
          },
        },
      },
    }

    return vim.tbl_deep_extend("force", opts, opt)
  end,
}
