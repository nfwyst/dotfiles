local style = { padding = 0 }
local preview_size = 0.5
local blend = 3
local size = { width = style, height = style }
local layout_config = MERGE_TABLE(size, { preview_cutoff = 0 })
local dropdown_config = { layout_config = layout_config, winblend = blend }

local function flash(prompt_bufnr)
  if not IS_PACKAGE_LOADED("flash") then
    return
  end
  require("flash").jump({
    pattern = "^",
    label = { after = { 0, 0 } },
    search = {
      mode = "search",
      exclude = {
        function(win)
          return vim.bo[vim.api.nvim_win_get_buf(win)].filetype
            ~= "TelescopeResults"
        end,
      },
    },
    action = function(match)
      local picker =
        require("telescope.actions.state").get_current_picker(prompt_bufnr)
      picker:set_selection(match.pos[1] - 1)
    end,
  })
end

local function get_symbols(on_done)
  vim.ui.select(
    LSP_SYMBOLS,
    { prompt = "select symbols type to filter" },
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
    winblend = blend,
    layout_config = MERGE_TABLE(layout_config, {
      preview_width = preview_size,
      height = 0.6,
    }),
  })
  theme.cwd = WORKSPACE_PATH
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
  local theme = themes.get_dropdown(dropdown_config)
  theme.cwd = WORKSPACE_PATH
  if config ~= nil then
    theme = MERGE_TABLE(theme, config)
  end
  builtin.find_files(theme)
end

local function init(builtin, themes)
  SET_USER_COMMANDS({
    FindText = function()
      find_text(builtin, themes, nil, false)
    end,
    FindTextCursor = function()
      find_text(builtin, themes, nil, true)
    end,
    FindTextByFileType = function()
      vim.ui.input({ prompt = "Enter file type to search:" }, function(type)
        if not type then
          return
        end
        find_text(builtin, themes, nil, false, { type_filter = type })
      end)
    end,
    FindTextByPattern = function()
      vim.ui.input({ prompt = "Enter pattern to search:" }, function(pattern)
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
      local theme = themes.get_dropdown(dropdown_config)
      theme.cwd = WORKSPACE_PATH
      builtin.git_files(theme)
    end,
    FindTextWithPath = function()
      vim.ui.input({ prompt = "Enter search dir path:" }, function(path)
        if not path then
          return
        end
        find_text(builtin, themes, path)
      end)
    end,
    SetWorkspacePathGlobal = SET_WORKSPACE_PATH_GLOBAL,
    SetWorkspacePathLocal = function()
      WORKSPACE_PATH = vim.loop.cwd() or ""
      LOG_INFO("changing workspace path", "new path: " .. WORKSPACE_PATH)
    end,
    SetWorkspacePathCustom = function()
      vim.ui.input({ prompt = "input path: " }, function(path)
        if not path then
          return
        end
        if IS_ABSOLUTE_PATH(path) then
          WORKSPACE_PATH = path
          LOG_INFO("changing workspace path", "new path: " .. WORKSPACE_PATH)
          return
        end
        local relativePath = vim.loop.cwd()
        WORKSPACE_PATH = string.format(
          "%s" .. OS_SEP .. "%s",
          relativePath,
          FORMAT_PATH_BY_OS(path)
        )
        LOG_INFO("changing workspace path", "new path: " .. WORKSPACE_PATH)
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
    ["<c-q>"] = act.send_selected_to_qflist + act.open_qflist,
    ["<cr>"] = act.select_default,
    ["<c-x>"] = act.select_horizontal,
    ["<c-v>"] = act.select_vertical,
    ["<c-t>"] = act.select_tab,
    ["<c-u>"] = act.preview_scrolling_up,
    ["<c-d>"] = act.preview_scrolling_down,
    ["<c-h>"] = act.preview_scrolling_left,
    ["<c-l>"] = act.preview_scrolling_right,
    ["<tab>"] = act.toggle_selection + act.move_selection_worse,
    ["<s-tab>"] = act.toggle_selection + act.move_selection_better,
    ["<c-a>"] = act.send_to_qflist + act.open_qflist,
    ["<c-g>"] = act.complete_tag,
  }
end

return {
  "nvim-telescope/telescope.nvim",
  cond = not IS_VSCODE,
  cmd = {
    "FindText",
    "FindTextByFileType",
    "FindTextByPattern",
    "FindTextCursor",
    "FindFiles",
    "FindIgnoredFiles",
    "FindRepoFiles",
    "FindTextWithPath",
    "Telescope",
    "SetWorkspacePathGlobal",
    "SetWorkspacePathLocal",
    "SetWorkspacePathCustom",
    "DocumentSymbols",
    "WorkspaceSymbols",
  },
  dependencies = { "nvim-lua/plenary.nvim" },
  config = function()
    local telescope = require("telescope")
    local act = require("telescope.actions")
    init(require("telescope.builtin"), require("telescope.themes"))
    telescope.setup({
      defaults = {
        path_display = { "truncate" },
        layout_strategy = "vertical",
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
            ["<c-k>"] = act.move_selection_previous,
            ["<c-j>"] = act.move_selection_next,
            ["<c-c>"] = act.close,
            ["<c-s>"] = flash,
            ["<c-n>"] = act.cycle_history_next,
            ["<c-p>"] = act.cycle_history_prev,
          }),
          n = MERGE_TABLE(get_maps(act), {
            ["k"] = act.move_selection_previous,
            ["j"] = act.move_selection_next,
            ["q"] = act.close,
            s = flash,
            ["M"] = act.move_to_middle,
            ["gg"] = act.move_to_top,
            ["G"] = act.move_to_bottom,
            ["?"] = act.which_key,
          }),
        },
        prompt_prefix = " ",
        selection_caret = " ",
        set_env = { ["COLORTERM"] = "truecolor" },
        wrap_results = true,
        preview = { filesize_limit = 5 },
        file_ignore_patterns = TELESCOPE_IGNORE_PATTERNS,
      },
      pickers = {
        planets = { show_pluto = true, show_moon = true },
        find_files = { hidden = true },
        buffers = {
          theme = "dropdown",
          initial_mode = "normal",
          mappings = {
            i = {
              ["<c-d>"] = act.delete_buffer,
            },
            n = {
              ["dd"] = act.delete_buffer,
            },
          },
        },
      },
    })
  end,
}
