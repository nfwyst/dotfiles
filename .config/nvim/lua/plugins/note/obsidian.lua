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
  cond = not IS_VSCODE_OR_LEET_CODE,
  dependencies = { "nvim-lua/plenary.nvim" },
  ft = "markdown",
  config = function()
    local obsidian = require("obsidian")
    obsidian.setup({
      workspaces = {
        { name = "work", path = OBSIDIAN_WORK_DIR },
        { name = "personal", path = OBSIDIAN_DIR },
        {
          name = "no-vault",
          path = function()
            return assert(vim.fn.getcwd())
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
    })
    init(obsidian)
  end,
}
