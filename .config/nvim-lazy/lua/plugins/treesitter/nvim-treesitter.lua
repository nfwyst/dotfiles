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
      desc = "Goto " .. direction .. " function call " .. position,
    },
    [get_keymap_name("N")] = {
      query = "@conditional.outer",
      desc = "Goto " .. direction .. " conditional " .. position,
    },
    [get_keymap_name("O")] = {
      query = "@loop.outer",
      desc = "Goto " .. direction .. " loop " .. position,
    },
  }
end

local function set_keymaps()
  local rm = require("nvim-treesitter.textobjects.repeatable_move")
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

return {
  "nvim-treesitter/nvim-treesitter",
  keys = {
    { "<leader>cw", "", desc = "swap" },
    { "=", "", desc = "assignment", mode = "v" },
  },
  opts = function(_, opts)
    -- wait for setup finish
    defer(set_keymaps, 0)

    language.register("bash", "zsh")

    local opt = {
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
      },
      ignore_install = IS_LINUX and { "nu" } or nil,
      textobjects = {
        move = {
          goto_next_start = get_move_goto_config("next", "start"),
          goto_next_end = get_move_goto_config("next", "end"),
          goto_previous_start = get_move_goto_config("prev", "start"),
          goto_previous_end = get_move_goto_config("prev", "end"),
        },
        select = {
          enable = true,
          lookahead = true,
          keymaps = {
            ["=a"] = { query = "@assignment.outer", desc = "Select outer part of assignment" },
            ["=i"] = { query = "@assignment.inner", desc = "Select inner part of assignment" },
            ["=l"] = { query = "@assignment.lhs", desc = "Select left hand side of assignment" },
            ["=r"] = { query = "@assignment.rhs", desc = "Select right hand side of assignment" },
            ["am"] = { query = "@function.outer", desc = "Select outer part of method definition" },
            ["im"] = { query = "@function.inner", desc = "Select inner part of method definition" },
          },
        },
        swap = {
          enable = true,
          swap_next = {
            ["<leader>cwa"] = "@parameter.inner",
            ["<leader>cwm"] = "@function.outer",
          },
          swap_previous = {
            ["<leader>cwA"] = "@parameter.inner",
            ["<leader>cwM"] = "@function.outer",
          },
        },
      },
    }

    return merge(opts, opt)
  end,
}
