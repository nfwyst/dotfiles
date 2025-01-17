local function on_tabline_title(win, bufnr, filetype)
  local task = FILETYPE_TASK_MAP[filetype]
  if not task then
    return
  end
  defer(function()
    if win == CUR_WIN() then
      task(bufnr, win)
    end
  end, 0)
end

return {
  on_tabline_title = on_tabline_title,
}
