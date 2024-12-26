local function get_buffer_count(on_travel)
  local count = 0
  for _, info in ipairs(BUF_INFO()) do
    local should_count = on_travel(info)
    if should_count then
      count = count + 1
    end
  end
  return count
end

local function buf_has_references(bufinfo)
  local bufnr = bufinfo.bufnr
  if #bufinfo.windows then
    return true
  end

  if fn.bufnr("#") == bufnr then
    return true
  end

  local qf_lists = fn.getqflist()
  for _, item in ipairs(qf_lists) do
    if item.bufnr == bufnr then
      return true
    end
  end

  local jumplist = fn.getjumplist()
  for _, jump in ipairs(jumplist[1]) do
    if jump.bufnr == bufnr then
      return true
    end
  end

  for _, win in ipairs(api.nvim_list_wins()) do
    local loc_list = fn.getloclist(win)
    for _, item in ipairs(loc_list) do
      if item.bufnr == bufnr then
        return true
      end
    end
  end

  return false
end

local function destroy_buffer(bufnr)
  local method = "textDocument/didClose"
  local text_document_identifier = lsp.util.make_text_document_params(bufnr)
  local params = { textDocument = text_document_identifier }

  local clients = lsp.get_clients({ bufnr = bufnr })
  for _, client in ipairs(clients) do
    if client.supports_method(method) then
      client.notify(method, params)
    end
    lsp.buf_detach_client(bufnr, client.id)
  end

  api.nvim_buf_delete(bufnr, { force = true })
end

local function set_winbar(bufnr, is_new)
  local function on_travel(bufinfo)
    local should_travel = is_new or IS_FILE_BUF_LISTED(bufinfo)
    if not should_travel then
      return false
    end
    local buf = bufinfo.bufnr
    local is_cur_buf = buf == bufnr
    local is_changed = bo[buf].modified
    local has_refs = buf_has_references(bufinfo)
    local should_count = is_cur_buf or is_changed or has_refs
    if should_count then
      return should_count
    end
    destroy_buffer(buf)
  end

  local bufpath = BUF_PATH(bufnr)
  local title = "%#WinBar1#%m"
    .. "%#WinBar2#("
    .. get_buffer_count(on_travel)
    .. ") "
    .. "%#WinBar1#"
    .. SHORT_HOME_PATH(bufpath)
    .. "%*%=%#WinBar2#"
  opt_local.winbar = title
end

AUCMD({ "BufWinEnter", "BufNewFile" }, {
  group = GROUP("WinbarUpdate", { clear = true }),
  callback = function(event)
    local bufnr = event.buf
    local is_new = event.event == "BufNewFile"
    if IS_FILE_BUF_LISTED(bufnr, is_new) then
      set_winbar(bufnr, is_new)
    end
  end,
})
