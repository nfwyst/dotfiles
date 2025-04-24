local function get_move_goto_config(direction, position)
  local prefix = direction == "next" and "]" or "["
  local get_keymap_name = function(name)
    if position == "start" then
      name = string.lower(name)
    end

    return prefix .. name
  end

  return {
    [get_keymap_name("L")] = {
      query = "@call.outer",
      desc = "Goto " .. direction .. " Function Call " .. position,
    },
    [get_keymap_name("N")] = {
      query = "@conditional.outer",
      desc = "Goto " .. direction .. " Conditional " .. position,
    },
    [get_keymap_name("O")] = {
      query = "@loop.outer",
      desc = "Goto " .. direction .. " Loop " .. position,
    },
    [get_keymap_name("Z")] = {
      query = "@fold",
      query_group = "folds",
      desc = "Goto " .. direction .. " Fold " .. position,
    },
  }
end

local function set_keymaps()
  local ok, rm = pcall(require, "nvim-treesitter.textobjects.repeatable_move")
  if not ok then
    return
  end

  MAPS({
    [{ "n", "x", "o" }] = {
      { from = ";", to = rm.repeat_last_move },
      { from = ",", to = rm.repeat_last_move_opposite },
      { from = "f", to = rm.builtin_f_expr, opt = { expr = true } },
      { from = "F", to = rm.builtin_F_expr, opt = { expr = true } },
      { from = "t", to = rm.builtin_t_expr, opt = { expr = true } },
      { from = "T", to = rm.builtin_T_expr, opt = { expr = true } },
    },
  })
end

local language_map = {
  zsh = "bash",
  checkhealth = "markdown",
}
for from, to in pairs(language_map) do
  language.register(to, from)
end

return {
  "nvim-treesitter/nvim-treesitter",
  keys = {
    { "<leader>cw", "", desc = "swap" },
    { "=", "", desc = "assignment", mode = "v" },
  },
  opts = function(_, opts)
    -- wait for setup finish
    defer(set_keymaps, 0)

    local opt = {
      highlight = { enable = not IS_SYNTAX_OFF },
      auto_install = executable("tree-sitter"),
      ensure_installed = {
        "css",
        "scss",
        "go",
        "svelte",
        "latex",
        "bash",
        "diff",
        "html",
        "javascript",
        "jsdoc",
        "json",
        "jsonc",
        "json5",
        "lua",
        "luadoc",
        "luap",
        "markdown",
        "markdown_inline",
        "printf",
        "python",
        "query",
        "regex",
        "toml",
        "tsx",
        "typescript",
        "vim",
        "vimdoc",
        "xml",
        "yaml",
        "git_config",
        "http",
        "typst",
        "vue",
        "norg",
        "solidity",
        "kdl",
      },
      ignore_install = nil,
      textobjects = {
        move = {
          enable = true,
          set_jumps = true,
          goto_next_start = get_move_goto_config("next", "start"),
          goto_next_end = get_move_goto_config("next", "end"),
          goto_previous_start = get_move_goto_config("prev", "start"),
          goto_previous_end = get_move_goto_config("prev", "end"),
        },
        select = {
          enable = true,
          lookahead = true,
          keymaps = {
            ["=a"] = { query = "@assignment.outer", desc = "Select Assignment Outer" },
            ["=i"] = { query = "@assignment.inner", desc = "Select Assignment Inner" },
            ["=l"] = { query = "@assignment.lhs", desc = "Select Assignment Left Side" },
            ["=r"] = { query = "@assignment.rhs", desc = "Select Assignment Right Side" },
            [";a"] = { query = "@property.outer", desc = "Select Object Property Outer" },
            [";i"] = { query = "@property.inner", desc = "Select Object Property Inner" },
            [";l"] = { query = "@property.lhs", desc = "Select Object Property Left" },
            [";r"] = { query = "@property.rhs", desc = "Select Object property Right" },
          },
        },
        swap = {
          enable = true,
          swap_next = {
            ["<leader>cwa"] = "@parameter.inner",
            ["<leader>cwf"] = "@function.outer",
            ["<leader>cwp"] = "@property.outer",
          },
          swap_previous = {
            ["<leader>cwA"] = "@parameter.inner",
            ["<leader>cwF"] = "@function.outer",
            ["<leader>cwP"] = "@property.outer",
          },
        },
      },
    }

    return merge(opts, opt)
  end,
}
