local function journal(name)
  return function()
    RUN_CMD("Neorg workspace notes")
    RUN_CMD("Neorg journal " .. name)
  end
end

return {
  ["<leader>n"] = { group = "Note/Nav/Notify" },
  ["<leader>nt"] = { group = "Note" },
  ["<leader>ntn"] = { group = "Neorg" },
  ["<leader>ntnC"] = {
    "<cmd>Neorg keybind norg ore.qol.todo_items.todo.task_cycle<cr>",
    desc = "Cycle task",
  },
  ["<leader>ntnM"] = {
    journal("tomorrow"),
    desc = "Journal tomorrow",
  },
  ["<leader>ntnT"] = {
    journal("today"),
    desc = "Journal today",
  },
  ["<leader>ntnY"] = {
    journal("yesterday"),
    desc = "Journal yesterday",
  },
  ["<leader>ntnc"] = {
    "<cmd>Neorg toggle-concealer<cr>",
    desc = "Toggle concealer",
  },
  ["<leader>ntne"] = {
    "<cmd>Neorg export to-file<cr>",
    desc = "Export markdown",
  },
  ["<leader>ntni"] = {
    "<cmd>Neorg inject-metadata<cr>",
    desc = "Inject metadata",
  },
  ["<leader>ntnl"] = { group = "Neorg list" },
  ["<leader>ntnli"] = { desc = "Invert list" },
  ["<leader>ntnlt"] = { desc = "Toggle list type" },
  ["<leader>ntnm"] = { group = "Neorg mode" },
  ["<leader>ntnmh"] = {
    "<cmd>Neorg mode traverse-heading<cr>",
    desc = "Enter heading traversal mode",
  },
  ["<leader>ntnmn"] = { "<cmd>Neorg mode norg<cr>", desc = "Enter norg mode" },
  ["<leader>ntnn"] = {
    "<cmd>Neorg keybind norg ore.dirman.new.note<cr>",
    desc = "Create new note",
  },
  ["<leader>ntno"] = {
    "<cmd>Neorg toc split<cr>",
    desc = "Open a table of contents",
  },
  ["<leader>ntns"] = {
    "<cmd>Neorg generate-workspace-summary",
    desc = "Generate workspace summary",
  },
  ["<leader>ntnt"] = { group = "Neorg task motions" },
  ["<leader>ntnta"] = { desc = "Mark as ambigous" },
  ["<leader>ntntc"] = { desc = "Mark as cancelled" },
  ["<leader>ntntd"] = { desc = "Mark as done" },
  ["<leader>ntnth"] = { desc = "Mark as hold" },
  ["<leader>ntnti"] = { desc = "Mark as important" },
  ["<leader>ntntp"] = { desc = "Mark as pending" },
  ["<leader>ntntr"] = { desc = "Mark as recurring" },
  ["<leader>ntntu"] = { desc = "Mark as undone" },
  ["<leader>ntnv"] = {
    "<cmd>Neorg keybind norg ore.esupports.hop.hop-link vsplit<cr>",
    desc = "Jump to link(vertical split)",
  },
  ["<leader>nto"] = { group = "Obsidian" },
  ["<leader>ntoc"] = {
    "<cmd>ObsidianLinkNew<cr>",
    desc = "Create note and link",
  },
  ["<leader>ntod"] = {
    "<cmd>ObsidianYesterday<cr>",
    desc = "Daily note for yesterday",
  },
  ["<leader>ntof"] = {
    "<cmd>ObsidianFollowLink<cr>",
    desc = "Follow note under cursor",
  },
  ["<leader>ntoi"] = { "<cmd>ObsidianTemplate<cr>", desc = "Insert template" },
  ["<leader>ntol"] = { "<cmd>ObsidianLink<cr>", desc = "Link to a note" },
  ["<leader>nton"] = { "<cmd>ObsidianNew<cr>", desc = "New note" },
  ["<leader>ntoo"] = { "<cmd>ObsidianOpen<cr>", desc = "Open in obsidian" },
  ["<leader>ntoq"] = { "<cmd>ObsidianQuickSwitch<cr>", desc = "Quickly switch" },
  ["<leader>ntor"] = { "<cmd>ObsidianBacklinks<cr>", desc = "References list" },
  ["<leader>ntos"] = { "<cmd>ObsidianSearch<cr>", desc = "Search for notes" },
  ["<leader>ntot"] = { "<cmd>ObsidianToday<cr>", desc = "Daily note" },
  ["<leader>ntow"] = { "<cmd>ObsidianWorkspace<cr>", desc = "Switch workspace" },
  ["<leader>na"] = { group = "Nav" },
  ["<leader>nab"] = { "<cmd>Telescope resume<cr>", desc = "Resume" },
  ["<leader>nac"] = { "<cmd>Telescope commands<cr>", desc = "Commands" },
  ["<leader>nah"] = { "<cmd>Telescope help_tags<cr>", desc = "Find Help" },
  ["<leader>nak"] = { "<cmd>Telescope keymaps<cr>", desc = "Keymaps" },
  ["<leader>nam"] = { "<cmd>Telescope man_pages<cr>", desc = "Man Pages" },
  ["<leader>nar"] = { "<cmd>Telescope registers<cr>", desc = "Registers" },
  ["<leader>nas"] = { "<cmd>Telescope colorscheme<cr>", desc = "Colorscheme" },
  ["<leader>nai"] = { "<cmd>e $MYVIMRC<cr>", desc = "Open init.lua" },
  ["<leader>naS"] = {
    "<cmd>e /Users/malisheng/.config/nvim/snippets/package.json<cr>",
    desc = "Open snippets",
  },
  ["<leader>nao"] = { "<cmd>Outline<cr>", desc = "Toggle outline" },
  ["<leader>no"] = { group = "Notification" },
  ["<leader>noD"] = { "<cmd>NoiceDisable<cr>", desc = "Noice Disable" },
  ["<leader>noE"] = { "<cmd>NoiceEnable<cr>", desc = "Noice Enable" },
  ["<leader>noa"] = { "<cmd>NoiceDismiss<cr>", desc = "Noice Dismiss all" },
  ["<leader>nod"] = {
    "<cmd>DissmissNotification<cr>",
    desc = "Dismiss notifications",
  },
  ["<leader>noe"] = { "<cmd>NoiceErrors<cr>", desc = "Noice errors" },
  ["<leader>noh"] = { "<cmd>NoiceHistory<cr>", desc = "Noice history" },
  ["<leader>nol"] = { "<cmd>NoiceLast<cr>", desc = "Noice last message" },
  ["<leader>non"] = { "<cmd>Notifications<cr>", desc = "Show notifications" },
  ["<leader>nos"] = { "<cmd>NoiceStats<cr>", desc = "Noice stats" },
  ["<leader>not"] = {
    "<cmd>NoiceTelescope<cr>",
    desc = "Noice telescope history",
  },
}
