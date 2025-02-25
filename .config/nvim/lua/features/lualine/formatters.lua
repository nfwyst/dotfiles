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

local function get_win_title(title)
  if title and title[1] then
    title = title[1][1]
    if not EMPTY(title) then
      return vim.trim(title)
    end
  end
end

local function ends_width(str, suffix)
  if not str then
    return false
  end

  if suffix == "" then
    return true
  end

  local target_len = #suffix
  return target_len <= #str and str:sub(-target_len) == suffix
end

local function load_render_markdown(name)
  if name ~= "FZF" then
    return
  end

  local wins = api.nvim_list_wins()
  for _, winid in ipairs(wins) do
    local win_info = api.nvim_win_get_config(winid)
    if not EMPTY(win_info.relative) then
      if ends_width(get_win_title(win_info.title), ".md") then
        cmd.LoadRenderMarkdown()
      end
    end
  end
end

local function buffers(name, context)
  local bufnr = context.bufnr
  local bufpath = context.file
  local filetype = context.filetype
  local win = fn.bufwinid(bufnr)
  local is_file = IS_FILEPATH(bufpath, true)
  local win_valid = api.nvim_win_is_valid(win)

  load_render_markdown(name)

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

  if not name and win_valid then
    name = get_win_title(api.nvim_win_get_config(win).title)
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
      local bufnrs = require("lualine.components.buffers").bufpos2nr
      jobs.auto_close_buf(bufnr, context, bufnrs)
      jobs.close_dashboard(bufnrs)
      jobs.update_winbar(win, bufpath, bufnrs)
    elseif not name and IS_BUF_LISTED(bufnr) then
      name = jobs.open_dashboard(win, bufnr)
    end
  elseif not name then
    OPT("buflisted", { buf = bufnr }, false)
    return ""
  end

  if not name then
    local win_info = api.nvim_win_get_config(win)
    if not EMPTY(win_info.relative) then
      return "Popup"
    end
  end

  return name or "No Name"
end

return {
  buffers = buffers,
  buffers_title_map = buffers_title_map,
}
