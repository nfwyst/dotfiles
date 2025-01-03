local left = { "mark" }

if LINUX then
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
  SET_OPTS(COLUMN_OPTS(not is_open, statuscolumn))
end

local statuscolumn = ""

return {
  "snacks.nvim",
  opts = function(_, opts)
    push_list(opts.dashboard.preset.keys, keys)
    local opt = {
      indent = {
        scope = {
          enabled = not LINUX,
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
