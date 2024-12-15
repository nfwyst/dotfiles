local function footer()
  local handle = io.popen('fortune')
  if not handle then
    return ' '
  end
  local fortune = handle:read('*a')
  handle:close()
  return fortune
end

local function init()
  local group = AUTOGROUP('_alpha_', { clear = true })
  AUTOCMD('User', {
    pattern = 'AlphaReady',
    group = group,
    callback = function(event)
      ALPHA_BUF = event.buf
      SET_TIMEOUT(function()
        ENABLE_CURSORLINE({ buf = ALPHA_BUF }, true)
      end, 10)
    end,
  })
end

return {
  'goolord/alpha-nvim',
  event = 'VimEnter',
  dependencies = { 'nvim-tree/nvim-web-devicons' },
  config = function()
    local alpha = require('alpha')
    local dashboard = require('alpha.themes.dashboard')
    local working_dir = GET_WORKING_DIR()
    local project_root = GET_PROJECT_ROOT(working_dir, true) or working_dir
    local git_root = GET_GIT_ROOT(project_root)
    local val = {
      [[                               __                ]],
      [[  ___     ___    ___   __  __ /\_\    ___ ___    ]],
      [[ / _ `\  / __`\ / __`\/\ \/\ \\/\ \  / __` __`\  ]],
      [[/\ \/\ \/\  __//\ \_\ \ \ \_/ |\ \ \/\ \/\ \/\ \ ]],
      [[\ \_\ \_\ \____\ \____/\ \___/  \ \_\ \_\ \_\ \_\]],
      [[ \/_/\/_/\/____/\/___/  \/__/    \/_/\/_/\/_/\/_/]],
      [[]],
      ' : ' .. SHORT_HOME_PATH(project_root),
    }
    if git_root and project_root ~= git_root then
      table.insert(val, ' : ' .. SHORT_HOME_PATH(git_root))
    end
    dashboard.section.header.val = val
    dashboard.section.buttons.val = {
      dashboard.button('f', '󰱼  Find file', '<cmd>FindFiles<cr>'),
      dashboard.button(
        'e',
        '  New file',
        '<cmd>lua NEW_FILE(true, true)<cr>'
      ),
      dashboard.button(
        'R',
        '  Recently used files global',
        '<cmd>Telescope oldfiles<cr>'
      ),
      dashboard.button(
        'r',
        '  Recently used files',
        '<cmd>Telescope oldfiles only_cwd=true<cr>'
      ),
      dashboard.button('t', '󰊄  Find text', '<cmd>FindText<cr>'),
      dashboard.button('c', '  Configuration', '<cmd>e $MYVIMRC<cr>'),
      dashboard.button('q', '󰅙  Quit Neovim', '<cmd>qa<cr>'),
    }
    dashboard.section.footer.val = footer()
    dashboard.section.footer.opts.hl = ''
    dashboard.section.header.opts.hl = 'Include'
    dashboard.section.buttons.opts.hl = 'Keyword'
    dashboard.config.opts.noautocmd = true
    alpha.setup(dashboard.config)
    init()
  end,
}
