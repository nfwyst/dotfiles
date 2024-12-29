local function get_buf_count(get_should_count)
  local count = 0
  for _, info in ipairs(BUF_INFO()) do
    local should_count = get_should_count(info)
    if should_count then
      count = count + 1
    end
  end
  return count
end

local function destroy_buf(bufnr)
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

  Snacks.bufdelete(bufnr)
end

local function make_get_should_count(cur_buf, is_new)
  return function(bufinfo)
    local is_file_listed = IS_FILE_BUF_LISTED(bufinfo, is_new)
    if not is_file_listed then
      return false
    end
    local bufnr = bufinfo.bufnr
    local should_count = bufnr == cur_buf or bufinfo.changed == 1
    if not should_count then
      destroy_buf(bufnr)
    end
    return should_count
  end
end

local function set_winbar(bufnr, is_new)
  local get_should_count = make_get_should_count(bufnr, is_new)
  local buf_count = get_buf_count(get_should_count)

  if bufnr ~= CUR_BUF() then
    return
  end

  local bufpath = BUF_PATH(bufnr)
  local title = "%#WinBar1#%m"
    .. "%#WinBar2#("
    .. buf_count
    .. ") "
    .. "%#WinBar1#"
    .. SHORT_HOME_PATH(bufpath)
    .. "%*%=%#WinBar2#"
  opt_local.winbar = title
end

AUCMD({
  -- "BufWinEnter",
  "BufAdd",
  "BufNewFile",
}, {
  group = GROUP("WinbarUpdate", { clear = true }),
  callback = function(event)
    local bufnr = event.buf
    local is_new = event.event == "BufNewFile"
    if IS_FILE_BUF_LISTED(bufnr, is_new) then
      defer(function()
        set_winbar(bufnr, is_new)
      end, 100)
    end
  end,
})
