local style = { padding = 0 }
local preview_size = 0.5
local layout_config = MERGE_TABLE(
  { width = style, height = style },
  { preview_cutoff = 0 }
)

local function flash(prompt_bufnr)
  if not IS_PACKAGE_LOADED('flash') then
    return
  end
  require('flash').jump({
    pattern = '^',
    label = { after = { 0, 0 } },
    search = {
      mode = 'search',
      exclude = {
        function(win)
          return IS_FILETYPE('TelescopeResults', { win = win })
        end,
      },
    },
    action = function(match)
      local picker =
        require('telescope.actions.state').get_current_picker(prompt_bufnr)
      picker:set_selection(match.pos[1] - 1)
    end,
  })
end

local function get_symbols(on_done)
  vim.ui.select(
    LSP_SYMBOLS,
    { prompt = 'select symbols type to filter' },
    function(symbol)
      if not symbol then
        return
      end
      local symbols = { symbol }
      if symbol == LSP_SYMBOLS[1] then
        symbols = nil
      end
      on_done(symbols)
    end
  )
end

local function find_text(builtin, themes, path, undercursor, extra)
  local theme = themes.get_ivy({
    layout_config = MERGE_TABLE(layout_config, {
      preview_width = preview_size,
      height = 0.6,
    }),
  })
  if path then
    theme.search_dir = path
  end
  if undercursor then
    builtin.grep_string(MERGE_TABLE(theme, extra or {}))
    return
  end
  builtin.live_grep(MERGE_TABLE(theme, extra or {}))
end

local function find_files(builtin, themes, config)
  local theme = themes.get_dropdown({ layout_config = layout_config })
  if config ~= nil then
    theme = MERGE_TABLE(theme, config)
  end
  theme.find_command = {
    'fd',
    '--type',
    'f',
    '--color',
    'never',
    '--exclude',
    '.git',
    '--exclude',
    'node_modules',
  }
  builtin.find_files(theme)
end

local function init(builtin, themes)
  SET_HL({ TelescopePromptBorder = { link = 'TelescopeBorder' } })
  SET_USER_COMMANDS({
    FindText = function()
      find_text(builtin, themes, nil, false)
    end,
    Buffers = builtin.buffers,
    FindTextCursor = function()
      find_text(builtin, themes, nil, true)
    end,
    FindTextByFileType = function()
      vim.ui.input({ prompt = 'Enter file type to search:' }, function(type)
        if not type then
          return
        end
        find_text(builtin, themes, nil, false, { type_filter = type })
      end)
    end,
    FindTextByPattern = function()
      vim.ui.input({ prompt = 'Enter pattern to search:' }, function(pattern)
        if not pattern then
          return
        end
        find_text(builtin, themes, nil, false, { glob_pattern = pattern })
      end)
    end,
    FindFiles = function()
      find_files(builtin, themes)
    end,
    FindIgnoredFiles = function()
      find_files(builtin, themes, { no_ignore = true })
    end,
    FindRepoFiles = function()
      local theme = themes.get_dropdown({ layout_config = layout_config })
      builtin.git_files(theme)
    end,
    FindTextWithPath = function()
      vim.ui.input({ prompt = 'Enter search dir path:' }, function(path)
        if not path then
          return
        end
        find_text(builtin, themes, path)
      end)
    end,
    DocumentSymbols = function()
      get_symbols(function(symbols)
        builtin.lsp_document_symbols({ symbols = symbols })
      end)
    end,
    WorkspaceSymbols = function()
      get_symbols(function(symbols)
        builtin.lsp_dynamic_workspace_symbols({ symbols = symbols })
      end)
    end,
  })
end

local function get_maps(act)
  return {
    ['<c-q>'] = function(...)
      act.send_selected_to_qflist(...)
      vim.cmd.copen()
    end,
    ['<cr>'] = act.select_default,
    ['<c-x>'] = act.select_horizontal,
    ['<c-v>'] = act.select_vertical,
    ['<c-t>'] = act.select_tab,
    ['<c-u>'] = act.preview_scrolling_up,
    ['<c-d>'] = act.preview_scrolling_down,
    ['<c-h>'] = act.preview_scrolling_left,
    ['<c-l>'] = act.preview_scrolling_right,
    ['<tab>'] = act.toggle_selection + act.move_selection_worse,
    ['<s-tab>'] = act.toggle_selection + act.move_selection_better,
    ['<c-a>'] = function(...)
      act.smart_send_to_qflist(...)
      vim.cmd.copen()
    end,
    ['<c-g>'] = act.complete_tag,
  }
end

local history = {
  limit = 10,
}

return {
  'nvim-telescope/telescope.nvim',
  cmd = {
    'FindText',
    'FindTextByFileType',
    'FindTextByPattern',
    'FindTextCursor',
    'FindFiles',
    'FindIgnoredFiles',
    'FindRepoFiles',
    'FindTextWithPath',
    'Telescope',
    'DocumentSymbols',
    'WorkspaceSymbols',
  },
  dependencies = {
    'nvim-lua/plenary.nvim',
    { 'nvim-telescope/telescope-fzf-native.nvim', build = 'make' },
  },
  config = function()
    local telescope = require('telescope')
    local act = require('telescope.actions')
    local builtin = require('telescope.builtin')
    local themes = require('telescope.themes')
    telescope.setup({
      defaults = {
        history = IS_MAC and history or false,
        path_display = {
          filename_first = {
            reverse_directories = true,
          },
        },
        layout_strategy = 'vertical',
        layout_config = {
          horizontal = MERGE_TABLE(layout_config, {
            preview_width = preview_size,
          }),
          vertical = MERGE_TABLE(layout_config, {
            preview_height = preview_size,
          }),
        },
        mappings = {
          i = MERGE_TABLE(get_maps(act), {
            ['<c-k>'] = act.move_selection_previous,
            ['<c-j>'] = act.move_selection_next,
            ['<c-c>'] = act.close,
            ['<c-s>'] = flash,
            ['<c-n>'] = act.cycle_history_next,
            ['<c-p>'] = act.cycle_history_prev,
          }),
          n = MERGE_TABLE(get_maps(act), {
            ['k'] = act.move_selection_previous,
            ['j'] = act.move_selection_next,
            ['q'] = act.close,
            s = flash,
            ['M'] = act.move_to_middle,
            ['gg'] = act.move_to_top,
            ['G'] = act.move_to_bottom,
            ['?'] = act.which_key,
          }),
        },
        prompt_prefix = ' ',
        selection_caret = ' ',
        set_env = { ['COLORTERM'] = 'truecolor' },
        wrap_results = true,
        preview = { filesize_limit = 5 },
        file_ignore_patterns = TELESCOPE_IGNORE_PATTERNS,
      },
      pickers = {
        find_files = { hidden = true },
        buffers = {
          theme = 'dropdown',
          layout_strategy = 'vertical',
          layout_config = MERGE_TABLE(layout_config, {
            preview_height = preview_size,
            prompt_position = 'top',
          }),
          initial_mode = 'normal',
          sort_mru = true,
          sort_lastused = true,
          mappings = {
            i = {
              ['<c-d>'] = act.delete_buffer,
            },
            n = {
              ['dd'] = act.delete_buffer,
            },
          },
        },
      },
      extensions = {
        fzf = {
          fuzzy = true,
          override_generic_sorter = true,
          override_file_sorter = true,
          case_mode = 'smart_case',
        },
        undo = {
          side_by_side = true,
          layout_strategy = 'vertical',
          layout_config = {
            preview_height = 0.7,
            height = 0.999,
          },
          saved_only = true,
        },
      },
    })
    init(builtin, themes)

    telescope.load_extension('fzf')
  end,
}
