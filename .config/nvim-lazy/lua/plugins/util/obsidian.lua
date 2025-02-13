local function set_keymaps(obsidian)
  MAP("n", "gf", function()
    if obsidian.util.cursor_on_markdown_link() then
      return "<cmd>ObsidianFollowLink<cr>"
    else
      return "gf"
    end
  end, { expr = true })
end

local function create_dir(dir_path, confirm)
  local choice = 1
  if confirm then
    local msg = "The folder '" .. dir_path .. "' does not exist. Create it?"
    choice = fn.confirm(msg, "&Yes\n&No", 1)
  end
  if choice ~= 1 then
    return
  end
  local ok, Path = pcall(require, "plenary.path")
  if not ok then
    return
  end
  Path:new(dir_path):mkdir({ parents = true, mode = 493 })
  return true
end

local function init_path(dirpath)
  if not IS_DIRPATH(dirpath) then
    return create_dir(dirpath, true)
  end
  return true
end

local function path_getter()
  return GIT_ROOT() or uv.cwd()
end

return {
  "epwalsh/obsidian.nvim",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "saghen/blink.cmp",
  },
  ft = "markdown",
  config = function()
    ADD_BLINK_COMPAT_SOURCES({
      "obsidian",
      "obsidian_new",
      "obsidian_tags",
    })

    local obsidian = require("obsidian")
    local work_path = HOME_PATH .. "/Documents/Obsidian/work"
    local personal_path = HOME_PATH .. "/Documents/Obsidian/personal"
    if not init_path(work_path) then
      work_path = HOME_PATH .. "/Documents"
    end

    if not init_path(personal_path) then
      personal_path = HOME_PATH
    end

    obsidian.setup({
      workspaces = {
        { name = "work", path = work_path },
        { name = "personal", path = personal_path },
        {
          name = "no-vault",
          path = path_getter,
          overrides = {
            log_level = levels.OFF,
            notes_subdir = NIL,
            new_notes_location = "current_dir",
            daily_notes = {
              folder = NIL,
            },
            templates = {
              subdir = NIL,
            },
            disable_frontmatter = true,
          },
        },
      },
      completion = {
        min_chars = 2,
        nvim_cmp = false,
      },
      log_level = levels.OFF,
      daily_notes = {
        folder = "dailies",
      },
      templates = {
        subdir = "templates",
        -- a map for custom variables, the key should be the variable and the value a function
        substitutions = {
          yesterday = function()
            return os.date("%Y-%m-%d", os.time() - 86400)
          end,
        },
      },
      ui = {
        enable = false,
      },
    })

    set_keymaps(obsidian)
  end,
}
