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

return {
  "snacks.nvim",
  opts = function(_, opts)
    push_list(opts.dashboard.preset.keys, keys)
    local opt = {
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
        on_open = function(win)
          diagnostic.enable(false, { bufnr = win.buf })
          SET_OPTS({
            number = false,
            relativenumber = false,
            statuscolumn = "",
          }, wo[win.win])
        end,
      },
    }
    return merge(opts, opt)
  end,
}
