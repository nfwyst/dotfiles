local function init(obsidian)
  KEY_MAP('n', 'gf', function()
    if obsidian.util.cursor_on_markdown_link() then
      return '<cmd>ObsidianFollowLink<cr>'
    else
      return 'gf'
    end
  end, { expr = true })
end

function create_dir(dir_path, confirm)
  local choice = 1
  if confirm then
    local msg = "The folder '" .. dir_path .. "' does not exist. Create it?"
    choice = vim.fn.confirm(msg, '&Yes\n&No', 1)
  end
  if choice ~= 1 then
    return
  end
  local ok, Path = pcall(require, 'plenary.path')
  if not ok then
    return
  end
  Path:new(dir_path):mkdir({ parents = true, mode = 493 })
  return true
end

local function is_in_fs(path)
  local is_file_in_fs = IS_FILE_IN_FS(path)
  local is_dir_in_fs = IS_DIR_IN_FS(path)
  return is_file_in_fs or is_dir_in_fs
end

local function init_path(path)
  if not is_in_fs(path) then
    return create_dir(path, true)
  end
  return true
end

local function path_getter()
  return GET_GIT_ROOT() or GET_WORKING_DIR()
end

return {
  'epwalsh/obsidian.nvim',
  dependencies = { 'nvim-lua/plenary.nvim' },
  ft = 'markdown',
  config = function()
    local obsidian = require('obsidian')
    local work_path = OBSIDIAN_WORK_DIR
    local personal_path = OBSIDIAN_DIR
    if not init_path(work_path) then
      work_path = HOME_PATH .. '/Documents'
    end
    if not init_path(personal_path) then
      personal_path = HOME_PATH
    end
    obsidian.setup({
      workspaces = {
        { name = 'work', path = work_path },
        { name = 'personal', path = personal_path },
        {
          name = 'no-vault',
          path = path_getter,
          overrides = {
            log_level = OFF,
            notes_subdir = vim.NIL,
            new_notes_location = 'current_dir',
            daily_notes = {
              folder = vim.NIL,
            },
            templates = {
              subdir = vim.NIL,
            },
            disable_frontmatter = true,
          },
        },
      },
      completion = {
        min_chars = 2,
        nvim_cmp = true,
      },
      log_level = OFF,
      daily_notes = {
        folder = 'dailies',
      },
      templates = {
        subdir = 'templates',
        -- a map for custom variables, the key should be the variable and the value a function
        substitutions = {
          yesterday = function()
            return os.date('%Y-%m-%d', os.time() - 86400)
          end,
        },
      },
      ui = {
        enable = false,
      },
    })
    init(obsidian)
  end,
}
