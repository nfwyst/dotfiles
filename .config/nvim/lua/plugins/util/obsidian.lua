local function set_keymaps(obsidian)
  MAP("n", "gf", function()
    if obsidian.util.cursor_on_markdown_link() then
      return "<cmd>ObsidianFollowLink<cr>"
    else
      return "gf"
    end
  end, { expr = true })
end

local function create_dir(dirpath, confirm)
  if IS_DIRPATH(dirpath) then
    return true
  end

  local choice = 1
  if confirm then
    local msg = "The folder '" .. dirpath .. "' does not exist. Create it?"
    choice = fn.confirm(msg, "&Yes\n&No", 1)
  end

  if choice ~= 1 then
    return
  end

  local ok = pcall(fn.mkdir, dirpath, "p")
  if ok then
    return IS_DIRPATH(dirpath)
  end

  return true
end

local function path_getter()
  return GIT_ROOT() or uv.cwd()
end

return {
  "obsidian-nvim/obsidian.nvim",
  ft = "markdown",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "saghen/blink.cmp",
  },
  keys = {
    { "<leader>cuo", "", desc = "obsidian" },
    { "<leader>cuoc", "<cmd>ObsidianLinkNew<cr>", desc = "Obsidian: Link To New" },
    { "<leader>cuoy", "<cmd>ObsidianYesterday<cr>", desc = "Obsidian: Yesterday Note" },
    { "<leader>cuoe", "<cmd>ObsidianTemplate<cr>", desc = "Obsidian: Insert template" },
    { "<leader>cuol", "<cmd>ObsidianLink<cr>", desc = "Obsidian: Link To" },
    { "<leader>cuon", "<cmd>ObsidianNew<cr>", desc = "Obsidian: New" },
    { "<leader>cuox", "<cmd>ObsidianOpen<cr>", desc = "Obsidian: Open In App" },
    { "<leader>cuoq", "<cmd>ObsidianQuickSwitch<cr>", desc = "Obsidian: Quick Switch" },
    { "<leader>cuob", "<cmd>ObsidianBacklinks<cr>", desc = "Obsidian: Back Links" },
    { "<leader>cuos", "<cmd>ObsidianSearch<cr>", desc = "Obsidian: Search" },
    { "<leader>cuot", "<cmd>ObsidianToday<cr>", desc = "Obsidian: Today Note" },
    { "<leader>cuow", "<cmd>ObsidianWorkspace<cr>", desc = "Obsidian: Workspace" },
  },
  config = function()
    ADD_BLINK_COMPAT_SOURCES({
      default = true,
      filetypes = { "markdown" },
      ids = {
        "obsidian",
        "obsidian_new",
        "obsidian_tags",
      },
    })

    local obsidian = require("obsidian")
    local work_path = HOME_PATH .. "/Documents/Obsidian/work"
    local personal_path = HOME_PATH .. "/Documents/Obsidian/personal"
    if not create_dir(work_path, true) then
      work_path = HOME_PATH .. "/Documents"
    end

    if not create_dir(personal_path, true) then
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
