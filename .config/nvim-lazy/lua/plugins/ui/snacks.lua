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

return {
  "snacks.nvim",
  opts = function(_, opts)
    push_list(opts.dashboard.preset.keys, {
      {
        icon = " ",
        desc = "root: " .. root,
      },
      {
        icon = " ",
        desc = "git root: " .. root_git,
      },
    })
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
    }
    return merge(opts, opt)
  end,
}
