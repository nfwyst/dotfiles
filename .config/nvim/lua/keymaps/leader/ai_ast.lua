function focus_avante_input()
  SET_TIMEOUT(function()
    local is_open = require("avante").get():is_open()
    if not is_open then
      return
    end
    FOCUS_TO_FILETYPE("AvanteInput")
  end, 150)
end

return {
  ["<leader>a"] = { group = "AI/AST" },
  ["<leader>ai"] = { group = "AI" },
  ["<leader>as"] = { group = "AST" },
  ["<leader>aig"] = { group = "GPT prompt" },
  ["<leader>aia"] = { group = "Avante" },
  ["<leader>aiaa"] = {
    function()
      require("avante.api").ask()
      focus_avante_input()
    end,
    desc = "avante: ask",
  },
  ["<leader>aiae"] = {
    function()
      require("avante.api").edit()
    end,
    desc = "avante: edit",
  },
  ["<leader>aiar"] = {
    function()
      require("avante.api").refresh()
    end,
    desc = "avante: refresh",
  },
  ["<leader>aiat"] = {
    function()
      require("avante").toggle()
      focus_avante_input()
    end,
    desc = "avante: toggle default",
  },
  ["<leader>aiad"] = {
    function()
      require("avante").debug()
    end,
    desc = "avante: toggle debug",
  },
  ["<leader>aiah"] = {
    function()
      require("avante").hint()
    end,
    desc = "avante: toggle hint",
  },
  ["<leader>aias"] = {
    function()
      require("avante").suggestion()
    end,
    desc = "avante: toggle suggestion",
  },
  ["<leader>aiaT"] = { "<cmd>TogglePrompt<cr>", desc = "Toggle system prompt" },
  ["<leader>aigc"] = { "<cmd>GpPickCommand<cr>", desc = "GPT select command" },
  ["<leader>aiga"] = { "<cmd>GpSelectAgent<cr>", desc = "GPT select agent" },
  ["<leader>asc"] = { "<cmd>TSContextToggle<cr>", desc = "Toggle code context" },
  ["<leader>ase"] = { "<cmd>EditQuery<cr>", desc = "Show live query editor" },
  ["<leader>ash"] = {
    "<cmd>Inspect<cr>",
    desc = "Highlight groups under the cursor",
  },
  ["<leader>ass"] = { "<cmd>TSUpdateSync<cr>", desc = "Update language sync" },
  ["<leader>ast"] = { "<cmd>InspectTree<cr>", desc = "Show syntax tree" },
  ["<leader>asu"] = { "<cmd>TSUpdate<cr>", desc = "Update language" },
}
