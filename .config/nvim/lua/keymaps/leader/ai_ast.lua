local run_avante = function(use_api, name, subname)
  local api
  local avante

  return function()
    if use_api and not api then
      api = require("avante.api")
    end
    if not use_api and not avante then
      avante = require("avante")
    end
    if use_api then
      api[name]()
      return
    end
    local fn = avante[name]
    if subname then
      fn = fn[subname]
    end
    fn()
  end
end

return {
  ["<leader>a"] = { group = "AI/AST" },
  ["<leader>ai"] = { group = "AI" },
  ["<leader>as"] = { group = "AST" },
  ["<leader>aig"] = { group = "GPT prompt" },
  ["<leader>aia"] = { group = "Avante" },
  ["<leader>aiaa"] = {
    run_avante(true, "ask"),
    desc = "avante: ask",
  },
  ["<leader>aiae"] = {
    run_avante(true, "edit"),
    desc = "avante: edit",
  },
  ["<leader>aiar"] = {
    run_avante(true, "refresh"),
    desc = "avante: refresh",
  },
  ["<leader>aiat"] = {
    run_avante(false, "toggle"),
    desc = "avante: toggle",
  },
  ["<leader>aiah"] = {
    run_avante(false, "toggle", "hint"),
    desc = "avante: toggle hint",
  },
  ["<leader>aiad"] = {
    run_avante(false, "toggle", "debug"),
    desc = "avante: toggle debug",
  },
  ["<leader>aias"] = {
    run_avante(false, "toggle", "suggestion"),
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
