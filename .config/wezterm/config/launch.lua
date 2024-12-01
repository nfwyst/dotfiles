local platform = require('utils.platform')()

local options = {
  default_prog = {},
  launch_menu = {},
}

if platform.is_win then
  options.default_prog = { 'pwsh' }
  options.launch_menu = {
    { label = 'PowerShell Core', args = { 'pwsh' } },
    { label = 'PowerShell Desktop', args = { 'powershell' } },
    { label = 'Command Prompt', args = { 'cmd' } },
    { label = 'Nushell', args = { 'nu' } },
    {
      label = 'Git Bash',
      args = { 'C:\\Users\\kevin\\scoop\\apps\\git\\current\\bin\\bash.exe' },
    },
  }
else
  options.default_prog = { 'zellij' }
  options.launch_menu = {
    { label = 'Nushell', args = { 'nu', '-l' } },
    { label = 'Zsh', args = { 'zsh', '-l' } },
    { label = 'Bash', args = { 'bash', '-l' } },
  }
end

return options
