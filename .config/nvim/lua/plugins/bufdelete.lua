local group = AUTOGROUP("_alpha_and_bufferline_", { clear = true })

local function delete_buffers(num, bufs, bd)
  local compare = function(cur, next)
    local curtime = BUFFER_OPENED_TIME[cur] or 0
    local nexttime = BUFFER_OPENED_TIME[next] or 0
    return curtime < nexttime
  end
  QUICKSORT(bufs, 1, #bufs, compare)
  for k, buf in ipairs(bufs) do
    if k > num then
      return
    end
    vim.schedule(function()
      local is_deleted = BUFFER_OPENED_TIME[buf] == nil
      if is_deleted then
        return
      end
      bd.bufdelete(buf, false)
    end)
  end
end

local function delete_old_buffers(bufnr, bd)
  local bufs = GET_ALL_BUFFERS()
  local num_to_delete = #bufs - MAX_BUFFER_NUM
  if num_to_delete <= 0 then
    return
  end
  bufs = FILTER_TABLE(bufs, function(buf)
    local unsaved = GET_OPT("modified", { buf = buf })
    local is_current_buffer = buf == bufnr
    return not unsaved and not is_current_buffer
  end)
  delete_buffers(num_to_delete, bufs, bd)
end

local function toggle_alpha_and_close_tree(event)
  local bufnr = event.buf
  TABLE_REMOVE_BY_KEY(BUFFER_OPENED_TIME, bufnr)
  local buffer_path = GET_BUFFER_PATH(bufnr)
  local buffer_filetype = GET_FILETYPE(bufnr)
  local is_empty = buffer_path == "" and buffer_filetype == ""
  if not is_empty then
    return
  end
  local tree_ok, tree_api = pcall(require, "nvim-tree.api")
  if tree_ok then
    tree_api.tree.close()
  end
  RUN_CMD("Alpha")
  RUN_CMD(event.buf .. "bwipeout")
end

local function auto_remove_buf(bd)
  return function(event)
    local bufnr = event.buf
    AUTOCMD("BufWinEnter", {
      group = group,
      buffer = bufnr,
      callback = function()
        local is_opened = BUFFER_OPENED_TIME[bufnr] ~= nil
        BUFFER_OPENED_TIME[bufnr] = os.time()
        if is_opened then
          return
        end
        vim.schedule(function()
          PCALL(delete_old_buffers, bufnr, bd)
        end)
      end,
    })
  end
end

local function init(bd)
  SET_AUTOCMDS({
    {
      "User",
      {
        pattern = "BDeletePost*",
        group = group,
        callback = toggle_alpha_and_close_tree,
      },
    },
    {
      { "BufRead", "BufNewFile" },
      {
        group = group,
        callback = auto_remove_buf(bd),
      },
    },
  })
end

return {
  "famiu/bufdelete.nvim",
  event = "VeryLazy",
  config = function()
    init(require("bufdelete"))
  end,
}
