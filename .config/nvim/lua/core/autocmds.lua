local group = AUTOGROUP('_general_settings_', { clear = true })
local fn = vim.fn
local v = vim.v

local function remove_qf_normal()
  local start_index = fn.line('.')
  local count = v.count > 0 and v.count or 1
  return start_index, count
end

local function remove_qf_visual()
  local v_start_idx = fn.line('v')
  local v_end_idx = fn.line('.')

  local start_index = math.min(v_start_idx, v_end_idx)
  local count = math.abs(v_end_idx - v_start_idx) + 1
  FEED_KEYS('<esc>', 'x')
  return start_index, count
end

local function remove_qf_item(is_normal)
  return function()
    local start_index
    local count
    if is_normal then
      start_index, count = remove_qf_normal()
    else
      start_index, count = remove_qf_visual()
    end
    local qflist = fn.getqflist()

    for _ = 1, count, 1 do
      table.remove(qflist, start_index)
    end

    fn.setqflist(qflist, 'r')
    fn.cursor(start_index, 1)
  end
end

function is_empty_line(line)
  line = line:gsub('[\r\n]+$', '')
  return line == '' or line:match('^%s*$')
end

function get_lines_from_file(file, num)
  local lines = {}
  for _ = 1, num do
    local line = file:read('*l')
    if not line then
      return lines
    end
    table.insert(lines, line)
  end
  return lines
end

function lines_tab_more_than_space(lines)
  local tab_num = 0
  local space_num = 0
  for _, line in ipairs(lines) do
    local empty = is_empty_line(line)
    local start_with_tab = line:match('^\t')
    if not empty and start_with_tab then
      tab_num = tab_num + 1
    end
    if not empty and not start_with_tab and line:match('^%s') then
      space_num = space_num + 1
    end
  end
  return tab_num > space_num
end

function get_lines_from_buf(bufnr, line_num)
  return vim.api.nvim_buf_get_lines(bufnr, 0, line_num, false)
end

local function is_indent_with_tab(params)
  local filepath = params.filepath
  local line_num = 50
  if filepath then
    local file = io.open(filepath, 'r')
    if not file then
      return false
    end
    local lines = get_lines_from_file(file, line_num)
    local is_tab_indent = lines_tab_more_than_space(lines)
    file:close()
    return is_tab_indent
  end
  local bufnr = params.buf
  if not bufnr then
    bufnr = GET_CURRENT_BUFFER()
  end
  local lines = get_lines_from_buf(bufnr, line_num)
  return lines_tab_more_than_space(lines)
end

local function restore_position(bufnr)
  local ft = GET_FILETYPE(bufnr)
  if ft == 'gitcommit' then
    return
  end
  local last_known_line = vim.api.nvim_buf_get_mark(bufnr, '"')[1]
  if
    not (ft:match('commit') and ft:match('rebase'))
    and last_known_line > 1
    and last_known_line <= vim.api.nvim_buf_line_count(bufnr)
  then
    FEED_KEYS([[g`"]], 'nx')
  end
end

local function set_grug_far_fold_width(bufnr, filetype)
  if filetype ~= 'grug-far' then
    return
  end
  SET_TIMEOUT(function()
    SET_OPT('foldcolumn', '2', { buf = bufnr })
  end, 10)
end

local function get_markdown_options(event)
  local not_avante = 'Avante' ~= event.match
  local opts = {
    wrap = true,
    tabstop = 2,
    softtabstop = 2,
    shiftwidth = 2,
  }
  if not_avante and not IS_GPT_PROMPT_CHAT(event.buf) then
    return opts
  end
  return MERGE_TABLE(opts, GET_HIDE_COLUMN_OPTS(true))
end

local filetype_to_runner = {
  [{
    'qf',
    'help',
    'man',
    'notify',
    'lspinfo',
    'DressingInput',
    'DressingSelect',
    'DiffviewFileHistory',
    'grug-far',
    'neotest-output',
  }] = DEBOUNCE(function(event)
    local bufnr = event.buf
    set_grug_far_fold_width(bufnr, event.file)
    BIND_QUIT(bufnr)
  end, { delay = 2000 }),
  [{ 'help', 'gitconfig' }] = DEBOUNCE(function(event)
    SET_OPT('list', false, event)
  end),
  qf = DEBOUNCE(function(event)
    local opt = {
      buflisted = false,
      relativenumber = false,
    }
    SET_OPTS(opt, event)
    opt = { buffer = event.buf }
    KEY_MAP('n', 'dd', remove_qf_item(true), opt)
    KEY_MAP('x', 'd', remove_qf_item(), opt)
  end),
  [{
    'lazy',
    'DressingInput',
    'DressingSelect',
  }] = DEBOUNCE(function(event)
    SET_TIMEOUT(function()
      SET_OPT('wrap', true, event)
      if IS_CURSOR_HIDE() then
        SHOW_CURSOR()
      end
      if event.match == 'lazy' then
        ENABLE_CURSORLINE(event, true)
      end
    end, 10)
  end),
  [{
    'markdown',
    'gitcommit',
    'NeogitCommitMessage',
    'Avante',
  }] = DEBOUNCE(function(event)
    SET_TIMEOUT(function()
      SET_OPTS(get_markdown_options(event), event)
    end, 100)
  end),
  ['Neogit*'] = DEBOUNCE(function(event)
    SET_OPT('foldcolumn', '0', event)
  end),
}

local function close_alpha_when_open_file(bufnr)
  local buffer_path = GET_BUFFER_PATH(bufnr)
  local is_file = IS_FILE_PATH(buffer_path)
  local is_help = GET_FILETYPE(bufnr) == 'help'
  if is_help or not ALPHA_BUF or not is_file then
    return
  end
  SET_TIMEOUT(function()
    if not BUF_VALID(ALPHA_BUF) then
      ALPHA_BUF = nil
      return
    end
    vim.api.nvim_buf_call(ALPHA_BUF, function()
      vim.cmd('Alpha')
      ALPHA_BUF = nil
    end)
  end, 10)
end

local function dim_current_buffer()
  RUN_CMD('VimadeFadeActive', true)
end

local function check_avante_md_syntax(filetype, bufnr)
  if filetype ~= 'Avante' then
    return
  end
  local opt = { win = GET_FIRST_WINDOW_BY_BUF(bufnr) }
  SET_OPT('modifiable', true, opt)
  vim.cmd.startinsert()
  SET_TIMEOUT(function()
    vim.cmd.stopinsert()
    SET_OPT('modifiable', false, opt)
  end)
  return true
end

local function check_alpha_cursor_visible(filetype, bufnr)
  if filetype ~= 'alpha' then
    return
  end
  ENABLE_CURSORLINE({ buf = bufnr }, true)
  return true
end

local function is_valid_filetype(bufnr)
  return bufnr and FILETYPE_VALID(bufnr)
end

local function is_valid_file(bufnr, current_path, is_new_file)
  local current_is_file = IS_FILE_PATH(current_path)
  local is_file = is_new_file or current_is_file
  local is_chat_file = IS_GPT_PROMPT_CHAT(bufnr)
  return is_file and not is_chat_file
end

local function get_extra_msg()
  if IS_LEETING then
    return ''
  end
  return vim.fn.systemlist('hostname')[1]
end

local function get_winbar(new_file_bufnr, current_path, extra)
  return '%#WinBar1#%m '
    .. '%#WinBar2#('
    .. #GET_ALL_BUFFERS(true, new_file_bufnr)
    .. ') '
    .. '%#WinBar1#'
    .. SHORT_HOME_PATH(current_path)
    .. '%*%=%#WinBar2#'
    .. extra
end

local function set_winbar_for_all_window(wins, winbar)
  return function()
    for _, win in ipairs(wins) do
      local opt = { win = win }
      ENABLE_CURSORLINE(opt, true)
      SET_OPT('winbar', winbar, opt)
    end
  end
end

local function delay_set_winbar(is_new_file, current_path, bufnr)
  local extra = string.lower(get_extra_msg())
  local new_file_bufnr
  if is_new_file then
    new_file_bufnr = bufnr
  end
  local wins = GET_WINDOWS_BY_BUF(bufnr)
  local winbar = get_winbar(new_file_bufnr, current_path, extra)
  SET_TIMEOUT(set_winbar_for_all_window(wins, winbar), 10)
end

local function update_winbar(event)
  local bufnr = event.buf

  dim_current_buffer()

  local filetype = GET_FILETYPE(bufnr)
  local is_avante = check_avante_md_syntax(filetype, bufnr)
  local is_alpha = check_alpha_cursor_visible(filetype, bufnr)
  if is_alpha or is_avante then
    return
  end

  if not is_valid_filetype(bufnr) then
    return
  end

  local is_new_file = event.event == 'BufNewFile'
  local current_path = GET_BUFFER_PATH(bufnr)
  if not is_valid_file(bufnr, current_path, is_new_file) then
    return
  end

  delay_set_winbar(is_new_file, current_path, bufnr)

  BAR_PATH = current_path
end

SET_HL({
  WinBar1 = { fg = '#04d1f9', bg = '#1E2030' },
  WinBar2 = { fg = '#37f499', bg = '#1E2030' },
})

SET_AUTOCMDS({
  {
    'FileType',
    {
      pattern = vim.iter(vim.tbl_keys(filetype_to_runner)):flatten(1):totable(),
      group = group,
      callback = function(event)
        local filetype = GET_FILETYPE(event.buf)
        for filetypes, runner in pairs(filetype_to_runner) do
          local matched = STRING_PATTERN_MATCHED(filetype, filetypes)
          if matched then
            runner(event)
          end
        end
      end,
    },
  },
  {
    'TextYankPost',
    {
      callback = function()
        pcall(vim.highlight.on_yank, { higroup = 'Visual', timeout = 200 })
      end,
      group = group,
    },
  },
  {
    { 'BufEnter', 'BufWinEnter', 'BufNewFile' },
    {
      group = group,
      callback = DEBOUNCE(update_winbar, {
        omitter = function(_, key)
          return key == 'event'
        end,
      }),
    },
  },
  {
    'VimResized',
    {
      command = 'silent!tabdo wincmd =',
      group = AUTOGROUP('_auto_resize_', { clear = true }),
    },
  },
  {
    'BufReadPost',
    {
      group = AUTOGROUP('_indent_tab_', { clear = true }),
      callback = function(event)
        local bufnr = event.buf
        restore_position(bufnr)
        SET_TIMEOUT(function()
          vim.cmd('normal! zz')
        end)
        local expandtab = true
        local width = 2
        if is_indent_with_tab(event) then
          expandtab = false
          width = 4
        end
        vim.bo.expandtab = expandtab
        vim.bo.tabstop = width
        vim.bo.softtabstop = width
        vim.bo.shiftwidth = width
        close_alpha_when_open_file(bufnr)
      end,
    },
  },
  {
    'InsertEnter',
    {
      group = group,
      callback = function(event)
        SET_OPT('cursorline', false, event)
      end,
    },
  },
  {
    'InsertLeave',
    {
      group = group,
      callback = ENABLE_CURSORLINE,
    },
  },
})
