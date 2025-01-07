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
  local opts = COLUMN_OPTS(not is_open, statuscolumn)
  -- dont show fold signs for files buffer, use snacks fold
  opts.foldcolumn = "0"
  SET_OPTS(opts)
end

local statuscolumn = ""

-- hack fix
local function remove_noname_buf(match)
  if match ~= "SnacksDashboardUpdatePost" then
    return
  end
  local infos = BUF_INFO()
  for _, info in ipairs(infos) do
    local loaded = info.loaded
    local listed = info.listed

    local bufnr = info.bufnr
    local filetype = bo[bufnr].filetype
    local buftype = bo[bufnr].buftype
    local empty = EMPTY(filetype) and EMPTY(buftype) and EMPTY(info.name)

    local invalid = loaded and listed and empty
    if invalid then
      Snacks.bufdelete({ buf = info.bufnr, force = false })
    end
  end
end

return {
  "snacks.nvim",
  opts = function(_, opts)
    SET_HLS({ SnacksIndent = { fg = TRANSPARENT_INDENT_HL } })

    -- show cursor line when dashboard opened
    AUCMD("User", {
      pattern = "SnacksDashboard*",
      group = GROUP("cursor_line_for_dashboard", { clear = true }),
      callback = function(event)
        local match = event.match
        if match == "SnacksDashboardClosed" then
          return
        end

        defer(function()
          ENABLE_CURSORLINE(event.buf)
          remove_noname_buf(match)
        end, 10)
      end,
    })

    push_list(opts.dashboard.preset.keys, keys)
    local opt = {
      scroll = {
        enabled = false,
      },
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
