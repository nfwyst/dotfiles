local dashboard = require("features.auto-toggle-dashboard")
local task = require("features.run-task-in-filetype")

local function with_parent_when_duplicated(name, bufpath, bufnr)
  local showed_map = TABLINE_TITLE_MAP[name]
  if not showed_map then
    TABLINE_TITLE_MAP[name] = { bufnr }
    return name
  end
  if not contains(showed_map, bufnr) then
    PUSH(showed_map, bufnr)
  end
  if #showed_map <= 1 then
    return name
  end
  return fs.basename(fs.dirname(bufpath)) .. "/" .. name
end

local function buffers_fmt(name, context)
  local bufnr = context.bufnr
  local win = fn.bufwinid(bufnr)
  local win_valid = api.nvim_win_is_valid(win)

  if not win_valid then
    bo[bufnr].buflisted = false
    return ""
  end

  local filetype = context.filetype
  task.on_tabline_title(win, bufnr, filetype)
  if name == "[No Name]" then
    name = filetype
  end

  local has_name = not EMPTY(name)
  local dashboard_title = dashboard.on_update_tabline_title(win, bufnr, has_name)
  if dashboard_title then
    return dashboard_title
  end

  local bufpath = context.file
  local is_file = has_name and IS_FILEPATH(bufpath)
  dashboard.on_tabline_title(win, bufnr, filetype, is_file)
  if is_file then
    name = with_parent_when_duplicated(name, bufpath, bufnr)
  end

  if EMPTY(name) then
    local title = api.nvim_win_get_config(win).title
    if not title or not title[1] or #title[1] <= 0 then
      return ""
    end
    name = title[1][1]
  end

  if filetype == "octo" and tonumber(name) then
    name = " PR:" .. name
  end

  if BUF_VAR(bufnr, CONSTS.IS_BUF_PINNED) then
    name = name .. " "
  end

  return name
end

return buffers_fmt
