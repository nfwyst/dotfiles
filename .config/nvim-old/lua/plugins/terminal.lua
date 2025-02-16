local function multi_term(idWithSize, direction)
  local id, size = string.match(idWithSize, '(%S+)%s+(%S+)')
  if not id and not size and not idWithSize then
    return
  end
  local params = string.format(
    '%dToggleTerm size=%d direction=%s',
    not id and idWithSize or id,
    not size and 80 or size,
    direction
  )
  RUN_CMD(params)
end

local function set_commands()
  SET_USER_COMMANDS({
    ToggleTerminalHorizontal = function()
      vim.ui.input(
        { prompt = 'please input the id and size for terminal: ' },
        function(idWithSize)
          if not idWithSize then
            return
          end
          multi_term(idWithSize, 'horizontal')
        end
      )
    end,
    ToggleTerminalVertical = function()
      vim.ui.input(
        { prompt = 'Please input the id and size for terminal: ' },
        function(idWithSize)
          if not idWithSize then
            return
          end
          multi_term(idWithSize, 'vertical')
        end
      )
    end,
  })
  AUTOCMD('TermOpen', {
    callback = function(event)
      local opts = { buffer = event.buf }
      local normal = [[<C-\><C-n>]]
      local function key(lhs, rhs)
        return { lhs = lhs, rhs = rhs, opts = opts }
      end
      local keymap_config = {
        key('<esc>', normal),
        key('<C-[>', normal),
        key('<C-h>', [[<C-\><C-n><C-W>h]]),
        key('<C-j>', [[<C-\><C-n><C-W>j]]),
        key('<C-k>', [[<C-\><C-n><C-W>k]]),
        key('<C-l>', [[<C-\><C-n><C-W>l]]),
      }
      SET_KEY_MAPS({ t = keymap_config })
    end,
    pattern = 'term://*',
    group = AUTOGROUP('_TermOpen_', { clear = true }),
  })
end

local function init_instance(terminal)
  Terminal = terminal.Terminal
  local function newT(cmd)
    return Terminal:new({ cmd = cmd, hidden = true })
  end

  SET_USER_COMMANDS({
    ToggleGitUi = function()
      local gitui = newT('gitui')
      gitui:toggle()
    end,
    ToggleNode = function()
      local node = newT('node')
      node:toggle()
    end,
    ToggleNcdu = function()
      local ncdu = newT('ncdu')
      ncdu:toggle()
    end,
    ToggleHtop = function()
      local htop = newT('htop')
      htop:toggle()
    end,
    TogglePython = function()
      local python = newT('python3')
      python:toggle()
    end,
  })
end

local function bind_shell()
  local shell = vim.opt.shell:get()
  if OS == 'Linux' then
    SET_OPT('shell', shell or 'zsh')
  end
  if OS == 'Windows' then
    local fallback = vim.fn.executable('pwsh') == 1 and 'pwsh' or 'powershell'
    SET_OPTS({
      shell = shell or fallback,
      shellcmdflag = '-NoLogo -NoProfile -ExecutionPolicy RemoteSigned -Command [Console]::InputEncoding=[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;',
      shellredir = '-RedirectStandardOutput %s -NoNewWindow -Wait',
      shellpipe = '2>&1 | Out-File -Encoding UTF8 %s; exit $LastExitCode',
      shellquote = '',
      shellxquote = '',
    })
  end
end

bind_shell()

local function init(terminal)
  init_instance(terminal)
  set_commands()
end

return {
  'akinsho/toggleterm.nvim',
  cmd = {
    'ToggleNode',
    'ToggleNcdu',
    'ToggleHtop',
    'TogglePython',
    'ToggleTerm',
    'ToggleTerminalHorizontal',
    'ToggleTerminalVertical',
    'ToggleGitUi',
  },
  keys = [[<c-\>]],
  config = function()
    require('toggleterm').setup({
      size = 20,
      open_mapping = [[<c-\>]],
      hide_numbers = true,
      shade_filetypes = {},
      shade_terminals = true,
      shading_factor = 2,
      start_in_insert = true,
      insert_mappings = true,
      persist_size = true,
      direction = 'float',
      close_on_exit = true,
      shell = vim.o.shell,
      highlights = {
        FloatBorder = {
          link = 'TelescopeBorder',
        },
      },
      float_opts = {
        border = 'curved',
        winblend = 0,
        width = function()
          local multiple = 0.95
          if ALPHA_BUF and BUF_VALID(ALPHA_BUF) then
            multiple = 1
          end
          return GET_MAX_WIDTH(nil, multiple)
        end,
        height = function()
          return GET_MAX_HEIGHT(nil, 0.9)
        end,
        col = 8,
      },
    })
    init(require('toggleterm.terminal'))
  end,
}
