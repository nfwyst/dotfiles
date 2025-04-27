local function set_keymaps(obsidian)
  MAP("n", "gf", function()
    if obsidian.util.cursor_on_markdown_link() then
      return "<cmd>Obsidian follow_link<cr>"
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

local function input(command, title)
  return function()
    REQUEST_USER_INPUT(title, function(result)
      if not EMPTY(result) then
        command = command .. " " .. result
      end

      cmd.Obsidian("Obsidian" .. " " .. command)
    end)
  end
end

local function choice(command, title, choices)
  return function()
    REQUEST_USER_SELECT(choices, title, function(result)
      cmd.Obsidian("Obsidian" .. " " .. command .. " " .. result)
    end)
  end
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
    {
      "<leader>cuox",
      input("open", "The query used to resolve the note to open in app"),
      desc = "Obsidian: Open In App",
    },
    { "<leader>cuon", input("new", "The title of the new note"), desc = "Obsidian: New Note" },
    { "<leader>cuoq", "<cmd>Obsidian quick_switch<cr>", desc = "Obsidian: Search In Vault" },
    {
      "<leader>cuof",
      choice("follow_link", "Opening note in a vertical or horizontal split", { "vsplit", "hsplit" }),
      desc = "Obsidian: Open Note Under The Cursor",
    },
    { "<leader>cuob", "<cmd>Obsidian backlinks<cr>", desc = "Obsidian: Show Back Links" },
    { "<leader>cuot", input("tags", "The tag name"), desc = "Obsidian: Show Tags Occurrences" },
    { "<leader>cuod", "<cmd>Obsidian today<cr>", desc = "Obsidian: Today Note" },
    { "<leader>cuoy", "<cmd>Obsidian yesterday<cr>", desc = "Obsidian: Yesterday Note" },
    { "<leader>cuoT", "<cmd>Obsidian tomorrow<cr>", desc = "Obsidian: Tomorrow Note" },
    { "<leader>cuoD", input("dailies", "The offsets: from n days ago until m"), desc = "Obsidian: Search Dailies" },
    { "<leader>cuoe", input("template", "The template name to insert"), desc = "Obsidian: Insert template" },
    {
      "<leader>cuos",
      input("search", "The query used to resolve the note to open or create"),
      desc = "Obsidian: Search Or Create",
    },
    {
      "<leader>cuol",
      input("link", "The query used to resolve the note to link to selection"),
      desc = "Obsidian: Link Selection To Note",
    },
    {
      "<leader>cuoc",
      input("linknew", "The title of the new note to link selection"),
      desc = "Obsidian: Link Selection To New Note",
    },
    { "<leader>cuoL", "<cmd>Obsidian links<cr>", desc = "Obsidian: Show Buffer Links" },
    {
      "<leader>cuoa",
      input("extract_note", "The title of the new note to extract"),
      desc = "Obsidian: Extract Selection To New Note",
    },
    {
      "<leader>cuow",
      input("workspace", "The name of the workspace to switch"),
      desc = "Obsidian: To Another Workspace",
    },
    { "<leader>cuop", input("paste_img", "The name of the image"), desc = "Obsidian: Paste Image" },
    {
      "<leader>cuor",
      input("rename", "The new name to rename the note of the current buffer or reference under the cursor"),
      desc = "Obsidian: Rename Note",
    },
    {
      "<leader>cuom",
      input("new_from_template", "The title to create a new note from a template in the templates folder"),
      desc = "Obsidian: New Note From Template",
    },
    { "<leader>cuoo", "<cmd>Obsidian toc<cr>", desc = "Obsidian: Show Toc In Float Window" },
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
      picker = {
        name = "fzf-lua",
      },
    })

    set_keymaps(obsidian)
  end,
}
