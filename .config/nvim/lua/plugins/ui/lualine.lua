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

local filename = {
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
    gui = "italic",
  },
  cond = function()
    local bufname = vim.api.nvim_buf_get_name(vim.api.nvim_get_current_buf())
    local matched = string.match(bufname, "^/.*[%a]+$")
    if not matched then
      return false
    end

    return true
  end,
  padding = 0,
}

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
        lualine_a = { "mode" },
        lualine_b = { "branch" },
        lualine_c = {
          LazyVim.lualine.root_dir(),
          { lsp_info, padding = 0 },
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
            padding = 0,
          },
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
            padding = 0,
          },
        },
        lualine_y = {
          { "filetype", colored = false, icon_only = false, padding = 0 },
          {
            "selectioncount",
            fmt = function(val)
              return "󰆐 " .. val .. " selected"
            end,
            cond = function()
              local mode = vim.api.nvim_get_mode().mode
              return vim.list_contains({ "v", "V", "\x16" }, mode)
            end,
            padding = 0,
          },
          {
            function()
              return "󱁐:" .. vim.api.nvim_get_option_value("shiftwidth", { buf = vim.api.nvim_get_current_buf() })
            end,
            padding = 0,
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
          filename,
          {
            function()
              local search_info = vim.fn.searchcount()
              local content = vim.fn.getreg("/")
              if search_info.total == 0 then
                return " " .. content .. ": no result"
              end
              return " " .. content .. ": " .. search_info.current .. "󰿟" .. search_info.total
            end,
            cond = function()
              return vim.v.hlsearch > 0
            end,
            color = { fg = "#ff9e64" },
            padding = 0,
          },
        },
      },
      inactive_winbar = {
        lualine_c = { filename },
      },
    }

    return vim.tbl_deep_extend("force", opts, opt)
  end,
}
