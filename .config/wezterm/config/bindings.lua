local wezterm = require('wezterm')
local platform = require('utils.platform')()
local backdrops = require('utils.backdrops')
local act = wezterm.action

local mod = {}
local PATH = os.getenv('PATH')
local HOME = os.getenv('HOME')
local brew_path = '/opt/homebrew/bin'
local env = {
  XDG_CONFIG_HOME = HOME .. '/.config',
  XDG_BIN_HOME = HOME .. '/.local/bin',
  XDG_DATA_HOME = HOME .. '/.local/share',
  GIT_CONFIG_GLOBAL = HOME .. '/.config/.gitconfig',
  PATH = PATH,
  SHELL = 'nu',
}

if platform.is_mac then
  mod.SUPER = 'SUPER'
  mod.SUPER_REV = 'SUPER|CTRL'
  env.PATH = brew_path .. ':' .. env.PATH
  env.DEEPSEEK_API_KEY = require('env').DEEPSEEK_API_KEY
  env.GEMINI_API_KEY = require('env').GEMINI_API_KEY
  env.HYPERBOLIC_API_KEY = require('env').HYPERBOLIC_API_KEY
  env.JIRA_API_TOKEN = require('env').JIRA_API_TOKEN
  env.GOOGLE_SEARCH_API_KEY = require('env').GOOGLE_SEARCH_API_KEY
  env.GOOGLE_SEARCH_ENGINE_ID = require('env').GOOGLE_SEARCH_ENGINE_ID
  env.TERMINAL = "wezterm"
elseif platform.is_win or platform.is_linux then
  mod.SUPER = 'ALT' -- to not conflict with Windows key shortcuts
  mod.SUPER_REV = 'ALT|CTRL'
end

-- stylua: ignore
local keys = {
   -- send c-a when press twice
   { key = ',', mods = 'LEADER', action = act.SendKey({ key = ',', mods = mod.SUPER_REV }) },
   -- misc/useful --
   { key = 'c', mods = 'LEADER', action = act.ActivateCopyMode },
   { key = 'F2', mods = 'NONE', action = act.ActivateCommandPalette },
   { key = 'F3', mods = 'NONE', action = act.ShowLauncher },
   { key = 'F4', mods = 'NONE', action = act.ShowLauncherArgs({ flags = 'FUZZY' }) },
   {
      key = 'F5',
      mods = 'NONE',
      action = act.ShowLauncherArgs({ flags = 'FUZZY|WORKSPACES' }),
   },
   { key = 'F11', mods = 'NONE',    action = act.ToggleFullScreen },
   { key = 'F12', mods = 'NONE',    action = act.ShowDebugOverlay },
   { key = 'f',   mods = mod.SUPER, action = act.Search({ CaseInSensitiveString = '' }) },
   {
      key = 'u',
      mods = mod.SUPER,
      action = wezterm.action.QuickSelectArgs({
         label = 'open url',
         patterns = {
            '\\((https?://\\S+)\\)',
            '\\[(https?://\\S+)\\]',
            '\\{(https?://\\S+)\\}',
            '<(https?://\\S+)>',
            '\\bhttps?://\\S+[)/a-zA-Z0-9-]+'
         },
         action = wezterm.action_callback(function(window, pane)
            local url = window:get_selection_text_for_pane(pane)
            wezterm.log_info('opening: ' .. url)
            wezterm.open_with(url)
         end),
      }),
   },

   -- cursor movement --
   { key = 'LeftArrow',  mods = mod.SUPER,     action = act.SendString '\x1bOH' },
   { key = 'RightArrow', mods = mod.SUPER,     action = act.SendString '\x1bOF' },
   { key = 'Backspace',  mods = mod.SUPER,     action = act.SendString '\x15' },

   -- copy/paste --
   { key = 'c',          mods = 'CTRL|SHIFT',  action = act.CopyTo('Clipboard') },
   { key = 'v',          mods = 'CTRL|SHIFT',  action = act.PasteFrom('Clipboard') },

   -- window --
   -- spawn windows
   { key = 'n',          mods = mod.SUPER,     action = act.SpawnWindow },

   -- background controls --
   {
      key = [[/]],
      mods = mod.SUPER,
      action = wezterm.action_callback(function(window)
         backdrops:random(window)
      end),
   },
   {
      key = [[,]],
      mods = mod.SUPER,
      action = wezterm.action_callback(function(window)
         backdrops:cycle_back(window)
      end),
   },
   {
      key = [[.]],
      mods = mod.SUPER,
      action = wezterm.action_callback(function(window)
         backdrops:cycle_forward(window)
      end),
   },
   {
      key = [[/]],
      mods = mod.SUPER_REV,
      action = act.InputSelector({
         title = 'Select Background',
         choices = backdrops:choices(),
         fuzzy = true,
         fuzzy_description = 'Select Background: ',
         action = wezterm.action_callback(function(window, _, idx)
            ---@diagnostic disable-next-line: param-type-mismatch
            backdrops:set_img(window, tonumber(idx))
         end),
      }),
   },

   -- key-tables --
   -- resizes fonts
   {
      key = 'f',
      mods = 'LEADER',
      action = act.ActivateKeyTable({
         name = 'resize_font',
         one_shot = false,
         timemout_miliseconds = 1000,
      }),
   },
}

-- stylua: ignore
local key_tables = {
   resize_font = {
      { key = 'k',      action = act.IncreaseFontSize },
      { key = 'j',      action = act.DecreaseFontSize },
      { key = 'r',      action = act.ResetFontSize },
      { key = 'Escape', action = 'PopKeyTable' },
      { key = 'q',      action = 'PopKeyTable' },
   },
}

local mouse_bindings = {
  -- Ctrl-click will open the link under the mouse cursor
  {
    event = { Up = { streak = 1, button = 'Left' } },
    mods = 'CTRL',
    action = act.OpenLinkAtMouseCursor,
  },
  -- no copy
  {
    event = { Up = { streak = 1, button = 'Left' } },
    mods = 'NONE',
    action = act.ExtendSelectionToMouseCursor('Cell'),
  },
  {
    event = { Down = { streak = 1, button = 'Left' } },
    mods = 'NONE',
    action = act.SelectTextAtMouseCursor('Cell'),
  },
  {
    event = { Drag = { streak = 1, button = 'Left' } },
    mods = 'NONE',
    action = act.ExtendSelectionToMouseCursor('Cell'),
  },
  -- double click select word
  {
    event = { Up = { streak = 2, button = 'Left' } },
    mods = 'NONE',
    action = act.SelectTextAtMouseCursor('Word'),
  },
  {
    event = { Down = { streak = 2, button = 'Left' } },
    mods = 'NONE',
    action = act.SelectTextAtMouseCursor('Word'),
  },
  -- click 3 times select one line
  {
    event = { Up = { streak = 3, button = 'Left' } },
    mods = 'NONE',
    action = act.SelectTextAtMouseCursor('Line'),
  },
  {
    event = { Down = { streak = 3, button = 'Left' } },
    mods = 'NONE',
    action = act.SelectTextAtMouseCursor('Line'),
  },
}

return {
  disable_default_key_bindings = true,
  disable_default_mouse_bindings = false,
  leader = { key = ',', mods = mod.SUPER_REV, timemout_miliseconds = 1000 },
  keys = keys,
  key_tables = key_tables,
  mouse_bindings = mouse_bindings,
  set_environment_variables = env,
}
