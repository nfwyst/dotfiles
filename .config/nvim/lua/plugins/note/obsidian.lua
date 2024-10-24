local function init(obsidian)
  KEY_MAP("n", "gf", function()
    if obsidian.util.cursor_on_markdown_link() then
      return "<cmd>ObsidianFollowLink<cr>"
    else
      return "gf"
    end
  end, { expr = true })
end

return {
  "epwalsh/obsidian.nvim",
  dependencies = { "nvim-lua/plenary.nvim" },
  ft = "markdown",
  config = function()
    local obsidian = require("obsidian")
    local work_path = OBSIDIAN_WORK_DIR
    local personal_path = OBSIDIAN_DIR
    if not IS_FILE_PATH(work_path, true) then
      LOG_WARN("obsidian path not exists", work_path)
      work_path = HOME_PATH .. "/Documents"
    end
    if not IS_FILE_PATH(personal_path, true) then
      LOG_WARN("obsidian path not exists", personal_path)
      personal_path = HOME_PATH
    end

    obsidian.setup({
      workspaces = {
        { name = "work", path = work_path },
        { name = "personal", path = personal_path },
        {
          name = "no-vault",
          path = function()
            return GET_GIT_PATH() or CWD()
          end,
          overrides = {
            log_level = vim.log.levels.OFF,
            notes_subdir = vim.NIL,
            new_notes_location = "current_dir",
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
      log_level = vim.log.levels.OFF,
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
    init(obsidian)
  end,
}
