local wezterm = require('wezterm')

local nf = wezterm.nerdfonts
local M = {}

local GLYPH_SEMI_CIRCLE_LEFT = ' '
local GLYPH_SEMI_CIRCLE_RIGHT = ' '
local GLYPH_KEY_TABLE = nf.md_table_key --[[ '󱏅' ]]
local GLYPH_KEY = nf.md_key --[[ '󰌆' ]]

local colors = {
   glyph_semi_circle = {
      bg = 'rgba(0, 0, 0, 0.4)',
      fg1 = '#f7768e',
      fg2 = '#7dcfff',
      fg3 = '#bb9af7',
   },
   text = { bg1 = '#f7768e', bg2 = '#7dcfff', bg3 = '#bb9af7', fg = '#1c1b19' },
}

local __cells__ = {}

---@param text string
---@param fg string
---@param bg string
local _push = function(text, fg, bg)
   table.insert(__cells__, { Foreground = { Color = fg } })
   table.insert(__cells__, { Background = { Color = bg } })
   table.insert(__cells__, { Attribute = { Intensity = 'Bold' } })
   table.insert(__cells__, { Text = text })
end

M.setup = function()
   wezterm.on('update-right-status', function(window, _pane)
      __cells__ = {}
      local function render(text, fg, bg, icon)
         local g = colors.glyph_semi_circle
         local gbg = g.bg
         local t = colors.text
         local tfg = t.fg
         _push(GLYPH_SEMI_CIRCLE_LEFT, gbg, fg)
         if icon then
            _push(icon, tfg, bg)
         end
         _push(' ' .. text, tfg, bg)
         _push(GLYPH_SEMI_CIRCLE_RIGHT, gbg, fg)
      end
      local active_key = window:active_key_table()
      local is_leader = window:leader_is_active()
      local workspace = window:active_workspace()
      local text = colors.text
      local gy = colors.glyph_semi_circle

      if workspace then
         render('workspace: ' .. workspace, text.bg2, text.bg2)
      end

      if active_key then
         render(string.upper(active_key), gy.fg2, text.bg2, GLYPH_KEY_TABLE)
      end

      if is_leader then
         render('', gy.fg3, text.bg3, GLYPH_KEY)
      end

      window:set_left_status(wezterm.format(__cells__))
   end)
end

return M
