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

local function on_enter(event)
  local win = fn.bufwinid(event.buf)
  RUN_IN_WIN(win, function()
    SCROLL(win, "up")
  end)
end

return {
  "snacks.nvim",
  opts = function(_, opts)
    local dashboard = require("snacks.dashboard").Dashboard
    dashboard.on("UpdatePost", on_enter)
    dashboard.on("Opened", on_enter)

    SET_HLS({ SnacksIndent = { fg = TRANSPARENT_INDENT_HL } })
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
