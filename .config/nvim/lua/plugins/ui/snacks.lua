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
  snacks_dashboard = ENABLE_CURSORLINE,
  markdown = ENABLE_CURSORLINE,
})

local function scroll_to_top(event)
  local buf = event.buf
  local win = fn.bufwinid(buf)
  if win == CUR_WIN() and OPT("filetype", { buf = buf }) == "snacks_dashboard" then
    RUN_IN_WIN(win, function()
      SCROLL(win, "up")
    end)
  end
end

local function set_events()
  local dashboard = Snacks.dashboard.Dashboard
  dashboard.on("UpdatePost", scroll_to_top)
  dashboard.on("Opened", scroll_to_top)
end

local function get_image_enabled()
  local no_linux = not IS_LINUX
  local no_zellij = env.ZELLIJ ~= "0"
  local has_magick = executable("magick")

  return no_linux and no_zellij and has_magick
end

return {
  "snacks.nvim",
  opts = function(_, opts)
    -- wait for setup finish
    defer(set_events, 0)

    PUSH(FT_HIDE_CURSOR, "snacks_dashboard")

    if not FILETYPE_TASK_MAP.snacks_terminal then
      FILETYPE_TASK_MAP.snacks_terminal = function(bufnr)
        if BUF_VAR(bufnr, TASK_KEY) then
          return
        end

        cmd.VimadeBufDisable()
        BUF_VAR(bufnr, TASK_KEY, true)
      end
    end

    SET_HLS({ SnacksIndent = { fg = TRANSPARENT_INDENT_HL } })

    local opt = {
      scroll = {
        enabled = true,
        filter = function(bufnr)
          return EMPTY(api.nvim_win_get_config(fn.bufwinid(bufnr)).relative)
            and g.snacks_scroll ~= false
            and BUF_VAR(bufnr, "snacks_scroll") ~= false
            and OPT("buftype", { buf = bufnr }) ~= "terminal"
        end,
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
        left = IS_LINUX and { "sign" } or { "mark", "sign" },
        refresh = IS_LINUX and 200 or 100,
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
        terminal = {
          wo = {
            winbar = "",
          },
        },
      },
      zen = {
        on_open = function()
          statuscolumn = o.statuscolumn
          on_zen(true)
          vim.opt_local.winbar = nil
        end,
        on_close = function()
          on_zen(false, statuscolumn)
        end,
      },
      image = {
        enabled = get_image_enabled(),
      },
    }
    return merge(opts, opt)
  end,
}
