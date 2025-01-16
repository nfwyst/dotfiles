local left = { "mark" }

if IS_LINUX then
  left[2] = "sign"
end

local header = [[
███╗   ██╗███████╗ ██████╗ ██╗   ██╗██╗███╗   ███╗
████╗  ██║██╔════╝██╔═══██╗██║   ██║██║████╗ ████║
██╔██╗ ██║█████╗  ██║   ██║██║   ██║██║██╔████╔██║
██║╚██╗██║██╔══╝  ██║   ██║╚██╗ ██╔╝██║██║╚██╔╝██║
██║ ╚████║███████╗╚██████╔╝ ╚████╔╝ ██║██║ ╚═╝ ██║
╚═╝  ╚═══╝╚══════╝ ╚═════╝   ╚═══╝  ╚═╝╚═╝     ╚═╝
]]

local root = SHORT_HOME_PATH(LazyVim.root.get())
local root_git = SHORT_HOME_PATH(LazyVim.root.git())

local keys = {
  {
    icon = " ",
    desc = "root: " .. root,
  },
}

local has_git = root ~= root_git
if has_git then
  PUSH(keys, {
    icon = " ",
    desc = "git root: " .. root_git,
  })
end

local function on_zen(is_open, statuscolumn)
  IS_ZEN_MODE = is_open
  diagnostic.enable(not is_open)
  local opts = COLUMN_OPTS(not is_open, statuscolumn)
  -- dont show fold signs for files buffer, use snacks fold
  opts.foldcolumn = "0"
  SET_OPTS(opts)
end

local statuscolumn = ""

-- show cursor line for specific filetypes
assign(FILETYPE_TASK_MAP, {
  lazy = ENABLE_CURSORLINE,
  markdown = ENABLE_CURSORLINE,
  snacks_dashboard = ENABLE_CURSORLINE,
})

return {
  "snacks.nvim",
  opts = function(_, opts)
    SET_HLS({ SnacksIndent = { fg = TRANSPARENT_INDENT_HL } })
    push_list(opts.dashboard.preset.keys, keys)
    local opt = {
      scroll = {
        enabled = false,
      },
      indent = {
        scope = {
          enabled = not IS_LINUX,
        },
      },
      bigfile = {
        size = 524288, -- 0.5 * 1024 * 1024
      },
      statuscolumn = {
        left = left,
      },
      dashboard = {
        preset = {
          header = header,
        },
      },
      lazygit = {
        enabled = false,
      },
      styles = {
        notification = {
          wo = {
            wrap = true,
          },
        },
      },
      zen = {
        on_open = function()
          statuscolumn = o.statuscolumn
          on_zen(true)
          opt_local.winbar = nil
        end,
        on_close = function()
          on_zen(false, statuscolumn)
        end,
      },
    }
    return merge(opts, opt)
  end,
}
