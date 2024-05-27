local wezterm = require('wezterm')
local gpu_adapters = require('utils.gpu_adapter')

return {
   animation_fps = 60,
   max_fps = 60,
   front_end = 'WebGpu',
   webgpu_power_preference = 'HighPerformance',
   webgpu_preferred_adapter = gpu_adapters:pick_best(),

   -- color scheme
   color_scheme = 'Tokyo Night',

   -- background
   background = {
      {
         source = { File = wezterm.GLOBAL.background },
         horizontal_align = 'Center',
      },
      {
         source = { Color = '#1f1f28' },
         height = '100%',
         width = '100%',
         opacity = 0.85,
      },
   },

   -- scrollbar
   enable_scroll_bar = true,

   -- cursor
   default_cursor_style = 'BlinkingBlock',
   cursor_blink_ease_in = 'Constant',
   cursor_blink_ease_out = 'Constant',
   cursor_blink_rate = 700,

   -- tab bar
   enable_tab_bar = true,
   hide_tab_bar_if_only_one_tab = false,
   use_fancy_tab_bar = false,
   tab_bar_at_bottom = false,
   tab_max_width = 25,
   show_tab_index_in_tab_bar = false,
   switch_to_last_active_tab_when_closing_tab = true,

   -- window
   window_decorations = 'RESIZE',
   window_background_opacity = 0.85,
   integrated_title_button_alignment = 'Right',
   integrated_title_button_color = 'Auto',
   initial_cols = 120,
   initial_rows = 35,
   window_padding = {
      left = 1,
      right = 1,
      top = 0,
      bottom = 0,
   },
   window_close_confirmation = 'AlwaysPrompt',
   window_frame = {
      active_titlebar_bg = '#090909',
      -- font = fonts.font,
      -- font_size = fonts.font_size,
   },
   inactive_pane_hsb = {
      saturation = 0.35,
      brightness = 0.65,
   },
}
