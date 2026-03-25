-- Colorscheme configuration
local util = require("config.util")

-- Tokyonight setup (both dark and light styles)
require("tokyonight").setup({
  style = "storm",
  light_style = "day",
  transparent = false,
  lualine_bold = true,
  on_colors = function(c)
    c.bg_statusline = c.none
  end,
  styles = {
    sidebars = "normal",
    floats = "normal",
  },
})

-- Monokai-pro (lazy loaded)
pcall(function()
  require("monokai-pro").setup({
    transparent_background = true,
    filter = "classic",
  })
end)

-- NeoSolarized (lazy loaded)
pcall(function()
  require("NeoSolarized").setup({
    transparent = true,
    terminal_colors = true,
    enable_italics = true,
  })
end)

-- Custom highlights (re-applied on every colorscheme change)
vim.api.nvim_create_autocmd("ColorScheme", {
  callback = function()
    local highlights = {
      "BufferLineBufferSelected cterm=italic gui=italic",
      "LspInlayHint cterm=italic gui=italic",
      "TabLineFill guibg=none",
    }
    for _, config in ipairs(highlights) do
      util.set_hl(config, true)
    end
  end,
})

-- macOS appearance auto-detection
local function get_macos_bg()
  local obj = vim.system({ "defaults", "read", "-g", "AppleInterfaceStyle" }, { text = true }):wait()
  return (obj.code == 0 and obj.stdout:match("Dark")) and "dark" or "light"
end

if vim.fn.has("mac") == 1 then
  -- Synchronous initial detection (before first paint)
  local appearance = get_macos_bg()
  vim.o.background = appearance
  vim.cmd.colorscheme("tokyonight")

  -- Poll for system appearance changes every 5 seconds
  -- Tracks last *system* appearance so manual <leader>ub toggles
  -- are preserved until the next actual macOS appearance change.
  local last_system_appearance = appearance
  local timer = vim.uv.new_timer()
  timer:start(5000, 5000, vim.schedule_wrap(function()
    local current = get_macos_bg()
    if current ~= last_system_appearance then
      last_system_appearance = current
      vim.o.background = current
      vim.cmd.colorscheme("tokyonight")
    end
  end))
else
  vim.cmd.colorscheme("tokyonight")
end
