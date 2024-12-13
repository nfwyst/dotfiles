local wezterm = require('wezterm')
local platform = require('utils.platform')

local font = '0xProto Nerd Font'
local font_size = platform().is_mac and 16 or 14

return {
  font = wezterm.font(font, {
    weight = 'Bold',
    italic = true,
  }),
  font_size = font_size,
  line_height = 1.1,

  --ref: https://wezfurlong.org/wezterm/config/lua/config/freetype_pcf_long_family_names.html#why-doesnt-wezterm-use-the-distro-freetype-or-match-its-configuration
  freetype_load_target = 'Normal', ---@type 'Normal'|'Light'|'Mono'|'HorizontalLcd'
  freetype_render_target = 'Normal', ---@type 'Normal'|'Light'|'Mono'|'HorizontalLcd'
}
