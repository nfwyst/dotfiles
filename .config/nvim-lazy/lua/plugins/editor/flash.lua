local exclude = {
  "Trouble",
  "lazy",
  "mason",
  "neo-tree",
  "notify",
  "snacks_dashboard",
  "snacks_notif",
  "snacks_terminal",
  "snacks_win",
  "toggleterm",
  "trouble",
}

local function get_runner(name)
  return function()
    local filetype = bo[CUR_BUF()].filetype
    local invalid = contains(exclude, filetype)
    if not invalid then
      require("flash")[name]()
    end
  end
end

local function create_key(key, mode, func_name, desc)
  return {
    key,
    mode = mode,
    get_runner(func_name),
    desc = desc,
  }
end

return {
  "folke/flash.nvim",
  keys = {
    create_key("s", { "n", "o", "x" }, "jump", "Flash"),
    create_key("S", { "n", "o", "x" }, "treesitter", "Flash Treesitter"),
    create_key("r", "o", "remote", "Remote Flash"),
    create_key("R", { "o", "x" }, "treesitter_search", "Treesitter Search"),
    create_key("<c-s>", "c", "toggle", "Toggle Flash Search"),
  },
}
