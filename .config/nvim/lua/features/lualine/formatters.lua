local jobs = require("features.lualine.jobs")
local buffers_title_map = {}

local function with_parent_when_duplicated(name, bufpath, bufnr)
  local showed_map = buffers_title_map[name]
  if not showed_map then
    buffers_title_map[name] = { bufnr }
    return name
  end

  PUSH_WHEN_NOT_EXIST(showed_map, bufnr)

  if #showed_map <= 1 then
    return name
  end
  return fs.basename(fs.dirname(bufpath)) .. "/" .. name
end

local function buffers(name, context)
  local bufnr = context.bufnr
  local bufpath = context.file
  local filetype = context.filetype
  local win = fn.bufwinid(bufnr)
  local is_file = IS_FILEPATH(bufpath, true)
  local win_valid = api.nvim_win_is_valid(win)

  if filetype == "snacks_terminal" then
    name = " terminal"
  end

  if name == "[No Name]" or EMPTY(name) then
    name = nil
  end

  if not name and not EMPTY(filetype) then
    name = filetype
  end

  if is_file then
    name = with_parent_when_duplicated(name, bufpath, bufnr)
  end

  local win_info
  local is_win_float
  if win_valid then
    win_info = api.nvim_win_get_config(win)
    is_win_float = not EMPTY(win_info.relative)
  end

  if not name and win_info then
    local title = win_info.title
    if title and title[1] then
      title = vim.trim(title[1][1] or "")
      if not EMPTY(title) then
        name = title
      end
    end
  end

  if name and filetype == "octo" and tonumber(name) then
    name = " PR:" .. name
  end

  if name and BUF_VAR(bufnr, CONSTS.BUF_PINNED) then
    name = name .. " "
  end

  if win_valid then
    local is_dashboard = filetype == "snacks_dashboard"
    jobs.run_filetype_task(win, bufnr, filetype)
    if context.current then
      jobs.sync_syntax_off()
    end

    if is_dashboard then
      jobs.set_dashboard_win_buf(win, bufnr)
    elseif is_file then
      local bufnrs = require("lualine.components.buffers").bufpos2nr
      jobs.auto_close_buf(bufnr, context, bufnrs)
      jobs.close_dashboard(bufnrs)
      if not is_win_float then
        jobs.update_winbar(win, bufpath, bufnrs)
      end
    elseif not name and IS_BUF_LISTED(bufnr) then
      if not BUF_VAR(bufnr, CONSTS.NEW_FILE) then
        name = jobs.open_dashboard(win, bufnr)
      end
    end
  elseif not name then
    OPT("buflisted", { buf = bufnr }, false)
    return ""
  end

  if not name and is_win_float then
    return "Popup"
  end

  return name or "No Name"
end

return {
  buffers = buffers,
  buffers_title_map = buffers_title_map,
}
