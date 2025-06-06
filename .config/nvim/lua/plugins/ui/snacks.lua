local header = [[
███╗   ██╗███████╗ ██████╗ ██╗   ██╗██╗███╗   ███╗
████╗  ██║██╔════╝██╔═══██╗██║   ██║██║████╗ ████║
██╔██╗ ██║█████╗  ██║   ██║██║   ██║██║██╔████╔██║
██║╚██╗██║██╔══╝  ██║   ██║╚██╗ ██╔╝██║██║╚██╔╝██║
██║ ╚████║███████╗╚██████╔╝ ╚████╔╝ ██║██║ ╚═╝ ██║
╚═╝  ╚═══╝╚══════╝ ╚═════╝   ╚═══╝  ╚═╝╚═╝     ╚═╝
]]

local function pad_str(str, length, pad_char, is_to_start)
  local len = length - #str
  if len <= 0 then
    return str
  end

  local rep_str = string.rep(pad_char, len)
  if is_to_start then
    return rep_str .. str
  end

  return str .. rep_str
end

local handle = io.popen("fortune")
local align = "center"
if handle then
  align = "left"
  header = handle:read("*a")
  handle:close()

  local max_length = 0
  local lines = split(header, "\n", { trimempty = true })
  for index, line in ipairs(lines) do
    local new_line = line:gsub("\t", "")
    lines[index] = new_line
    local len = #new_line
    if len > max_length then
      max_length = len
    end
  end

  local total_rows = #lines
  for index, line in ipairs(lines) do
    local is_author_line = index > 1 and index == total_rows
    lines[index] = pad_str(line, max_length, " ", is_author_line)
  end

  header = table.concat(lines, "\n")
end

local function on_zen(is_open)
  IS_ZEN_MODE = is_open
  SET_OPTS(COLUMN_OPTS(not is_open))
end

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

local function init()
  local dashboard = Snacks.dashboard.Dashboard
  dashboard.on("UpdatePost", scroll_to_top)
  dashboard.on("Opened", scroll_to_top)
end

local function get_image_enabled()
  local no_zellij = env.ZELLIJ ~= "0"
  local has_magick = executable("magick")

  return no_zellij and has_magick
end

local function get_new_file_key(opts)
  for _, key in ipairs(opts.dashboard.preset.keys) do
    if key.key == "n" then
      return key
    end
  end
end

local function scope_filter(bufnr)
  local buftype = OPT("buftype", { buf = bufnr })
  if not EMPTY(buftype) or not package.loaded.lualine then
    return false
  end

  local bufnrs = require("lualine.components.buffers").bufpos2nr
  if not bufnrs or not contains(bufnrs, bufnr) then
    return false
  end

  local snacks_indent = BUF_VAR(bufnr, "snacks_indent")

  return g.snacks_indent ~= false and snacks_indent ~= false
end

local hls = {
  SnacksIndent = { fg = INDENT_HL },
  SnacksDim = { fg = "#656da4" },
}

return {
  "folke/snacks.nvim",
  opts = function(_, opts)
    -- wait for setup finish
    defer(init, 0)
    PUSH_WHEN_NOT_EXIST(FT_DISABLE_DIM, "snacks_terminal")
    PUSH_WHEN_NOT_EXIST(FT_HIDE_CURSOR, "snacks_dashboard")
    UPDATE_HLS(hls)

    get_new_file_key(opts).action = NewFile
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
      indent = { scope = { enabled = true, filter = scope_filter } },
      bigfile = { size = 524288 }, -- 0.5 * 1024 * 1024
      statuscolumn = {
        left = { "mark", "sign" },
      },
      dashboard = {
        preset = { header = header },
        formats = { header = { align = align } },
      },
      lazygit = { enabled = false },
      styles = {
        notification = { wo = { wrap = true } },
        terminal = { wo = { winbar = "" } },
      },
      zen = {
        toggles = { diagnostics = false, inlay_hints = false },
        on_open = function()
          on_zen(true)
          vim.opt_local.winbar = nil
        end,
        on_close = function()
          on_zen(false)
        end,
      },
      dim = { enabled = true, animate = { enabled = true } },
      image = { enabled = get_image_enabled() },
      words = { debounce = 200 },
    }

    return merge(opts, opt)
  end,
}
