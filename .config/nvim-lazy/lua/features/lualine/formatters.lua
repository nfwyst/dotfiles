local jobs = require("features.lualine.jobs")
local buffers_title_map = {}

local function with_parent_when_duplicated(name, bufpath, bufnr)
  local showed_map = buffers_title_map[name]
  if not showed_map then
    buffers_title_map[name] = { bufnr }
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

local function buffers(name, context)
  local bufnr = context.bufnr
  local bufpath = context.file
  local filetype = context.filetype
  local win = fn.bufwinid(bufnr)
  local is_file = IS_FILEPATH(bufpath)
  local win_valid = api.nvim_win_is_valid(win)

  if name == "[No Name]" or EMPTY(name) then
    name = nil
  end

  if not name and not EMPTY(filetype) then
    name = filetype
  end

  if is_file then
    name = with_parent_when_duplicated(name, bufpath, bufnr)
  end

  if not name and win_valid then
    local title = api.nvim_win_get_config(win).title
    if title and title[1] and not EMPTY(title[1][1]) then
      name = title[1][1]
    end
  end

  if name and filetype == "octo" and tonumber(name) then
    name = " PR:" .. name
  end

  if name and BUF_VAR(bufnr, CONSTS.IS_BUF_PINNED) then
    name = name .. " "
  end

  if win_valid then
    local is_dashboard = filetype == "snacks_dashboard"

    jobs.run_filetype_task(win, bufnr, filetype)

    if is_dashboard then
      jobs.set_dashboard_win_buf(win, bufnr)
    elseif is_file then
      jobs.close_dashboard()
    elseif not name and IS_BUF_LISTED(bufnr) then
      name = jobs.open_dashboard(win, bufnr)
    end
  elseif not name then
    bo[bufnr].buflisted = false
    return ""
  end

  return name or "[No Name]"
end

return {
  buffers = buffers,
  buffers_title_map = buffers_title_map,
}
