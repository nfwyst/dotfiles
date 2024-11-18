local diagnostics = {
  "diagnostics",
  sources = { "nvim_diagnostic" },
  sections = { "error", "warn" },
  symbols = { error = " ", warn = " " },
  colored = false,
  update_in_insert = false,
  always_visible = true,
  cond = function()
    return vim.diagnostic.is_enabled()
  end,
}

local show_on_width = function(width)
  if not width then
    width = 80
  end
  return GET_EDITOR_WIDTH() > width
end

local diff = {
  "diff",
  colored = true,
  symbols = { added = " ", modified = " ", removed = " " }, -- changes diff symbols
  cond = show_on_width,
}

local mode = {
  "mode",
  fmt = function(str)
    return str
  end,
  padding = { right = 0, left = 1 },
}

local filetype = {
  "filetype",
  icons_enabled = false,
  icon = nil,
}

local branch = {
  "branch",
  icons_enabled = true,
  icon = "",
}

local location = {
  "location",
  padding = 1,
}

-- cool function for progress
local progress = {
  function()
    local current_line = vim.fn.line(".")
    local total_lines = vim.fn.line("$")
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

local spaces = function()
  local width = GET_EDITOR_WIDTH()
  if width < 56 then
    return ""
  end
  return "space:" .. GET_OPT("shiftwidth", { buf = GET_CURRENT_BUFFER() })
end

local noice_mode = {
  function()
    return require("noice").api.status.mode.get()
  end,
  cond = function()
    return require("noice").api.status.mode.has()
  end,
  color = { fg = "#ffffff" },
}

local lsps = function()
  local clients = vim.lsp.get_clients({ bufnr = GET_CURRENT_BUFFER() })
  local width = GET_EDITOR_WIDTH()
  if next(clients) == nil or width < 66 then
    return ""
  end

  local c = {}
  for _, client in pairs(clients) do
    table.insert(c, client.name)
  end
  return "󱓞 " .. table.concat(c, "•")
end

local debugger = {
  function()
    return "  " .. require("dap").status()
  end,
  cond = function()
    return IS_PACKAGE_LOADED("dap") and require("dap").status() ~= ""
  end,
  color = { fg = "#ff9e64" },
}

local timer = {
  function()
    return require("nomodoro").status()
  end,
  cond = function()
    return IS_PACKAGE_LOADED("nomodoro")
  end,
  color = { fg = GET_COLOR().red },
  padding = { left = 0, right = 1 },
}

local fileformat = {
  function()
    if IS_MAC then
      return ""
    end
    local format = vim.bo.fileformat
    if format == "dos" then
      return ""
    end
    if format == "unix" then
      return ""
    end
    return format
  end,
  cond = show_on_width,
}

return {
  "nvim-lualine/lualine.nvim",
  dependencies = { "nvim-tree/nvim-web-devicons" },
  event = "VeryLazy",
  config = function()
    local lualine = require("lualine")
    local lazy_status = require("lazy.status")
    lualine.setup({
      options = {
        icons_enabled = true,
        theme = DEFAULT_COLORSCHEME or "auto",
        component_separators = { left = "", right = "" },
        section_separators = { left = "", right = "" },
        disabled_filetypes = { "dashboard" },
        ignore_focus = { "NvimTree" },
        globalstatus = true,
      },
      sections = {
        lualine_a = {
          mode,
          noice_mode,
          branch,
          {
            "tabs",
            use_mode_colors = true,
          },
        },
        lualine_b = {
          diagnostics,
          filetype,
          lsps,
          "searchcount",
        },
        lualine_c = { timer },
        lualine_x = {
          {
            lazy_status.updates,
            cond = lazy_status.has_updates,
            color = { fg = "#ff9e64" },
          },
        },
        lualine_y = {
          diff,
          debugger,
          spaces,
          { cond = show_on_width, "encoding" },
          fileformat,
          location,
        },
        lualine_z = { progress },
      },
    })
  end,
}
