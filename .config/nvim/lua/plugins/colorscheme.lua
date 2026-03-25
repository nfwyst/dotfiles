-- Colorscheme configuration
local util = require("config.util")

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

-- Apply tokyonight with mode-specific settings
local function apply_theme(mode)
  local is_dark = mode == "dark"

  require("tokyonight").setup({
    style = "storm",
    light_style = "day",
    transparent = is_dark,
    lualine_bold = true,
    on_colors = function(c)
      c.bg_statusline = c.none
    end,
    styles = {
      sidebars = is_dark and "transparent" or "normal",
      floats = is_dark and "transparent" or "normal",
    },
  })

  vim.o.background = mode
  vim.cmd.colorscheme("tokyonight")
end

-- Custom highlights (re-applied on every colorscheme change)
vim.api.nvim_create_autocmd("ColorScheme", {
  callback = function()
    local is_dark = vim.o.background == "dark"

    local highlights = {
      "BufferLineBufferSelected cterm=italic gui=italic",
      "LspInlayHint cterm=italic gui=italic",
      "TabLineFill guibg=none",
    }

    if is_dark then
      vim.list_extend(highlights, {
        "LspInlayHint guibg=#0e1018",
        "CursorLine guibg=#3e4365",
        "BlinkCmpGhostText guibg=#222539",
        "SnacksPickerInputBorder guifg=#3e4365",
        "SnacksPickerInputTitle guifg=#589ed7",
      })
    end

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

-- Parse dark-notify state file to determine mode
local function parse_dark_notify_mode(path)
  local ok, lines = pcall(vim.fn.readfile, path)
  if not ok then return nil end
  for _, line in ipairs(lines) do
    if line:match("light") then return "light" end
    if line:match("dark") then return "dark" end
  end
  return nil
end

if vim.fn.has("mac") == 1 then
  -- Synchronous initial detection (before first paint)
  local appearance = get_macos_bg()
  apply_theme(appearance)

  local state_file = vim.fn.expand("~/.local/state/tmux/tmux-dark-notify-theme.conf")

  if vim.env.TMUX and vim.uv.fs_stat(state_file) then
    -- Event-driven: watch dark-notify state file (kqueue, zero polling)
    local function watch()
      if not vim.uv.fs_stat(state_file) then
        vim.defer_fn(watch, 1000)
        return
      end
      local handle = vim.uv.new_fs_event()
      handle:start(state_file, {}, vim.schedule_wrap(function(err)
        handle:stop()
        handle:close()
        if not err then
          local mode = parse_dark_notify_mode(state_file)
          if mode then
            apply_theme(mode)
          end
        end
        -- Brief delay before re-watching to handle atomic file replacement
        vim.defer_fn(watch, 100)
      end))
    end
    watch()
  else
    -- Fallback: poll every 5s (outside tmux or dark-notify not installed)
    local last_system_appearance = appearance
    local timer = vim.uv.new_timer()
    timer:start(5000, 5000, vim.schedule_wrap(function()
      local current = get_macos_bg()
      if current ~= last_system_appearance then
        last_system_appearance = current
        apply_theme(current)
      end
    end))
  end
else
  apply_theme("dark")
end
