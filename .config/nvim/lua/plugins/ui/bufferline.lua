local function restore_position(bufnr)
  local ft = GET_FILETYPE(bufnr)
  local last_known_line = vim.api.nvim_buf_get_mark(bufnr, '"')[1]
  if
    not (ft:match("commit") and ft:match("rebase"))
    and last_known_line > 1
    and last_known_line <= vim.api.nvim_buf_line_count(bufnr)
  then
    FEED_KEYS([[g`"]], "nx")
  end
end

local function delete_buffers(num, buffers)
  local compare = function(cur, next)
    local curtime = BUFFER_OPENED_TIME[cur.id] or 0
    local nexttime = BUFFER_OPENED_TIME[next.id] or 0
    return curtime < nexttime
  end
  QUICKSORT(buffers, 1, #buffers, compare)
  for k, v in ipairs(buffers) do
    if k > num then
      return
    end
    vim.schedule(function()
      local is_deleted = BUFFER_OPENED_TIME[v.id] == nil
      if is_deleted then
        return
      end
      require("bufdelete").bufdelete(v.id, false)
    end)
  end
end

local function delete_old_buffers(bufferline, bufnr)
  local buffers = bufferline.get_elements().elements
  local num_to_delete = #buffers - MAX_BUFFER_NUM
  if num_to_delete <= 0 then
    return
  end
  buffers = FILTER_TABLE(buffers, function(buffer)
    local buf = buffer.id
    local unsaved = GET_OPT("modified", { buf = buf })
    local is_current_buffer = buf == bufnr
    return not unsaved and not is_current_buffer
  end)
  delete_buffers(num_to_delete, buffers)
end

local function init(bufferline)
  local group = AUTOGROUP("_alpha_and_bufferline_", { clear = true })
  SET_AUTOCMDS({
    {
      "BufReadPost",
      {
        group = group,
        callback = function(event)
          AUTOCMD("BufWinEnter", {
            group = group,
            once = true,
            buffer = event.buf,
            callback = function()
              restore_position(event.buf)
            end,
          })
        end,
      },
    },
    {
      { "BufRead", "BufNewFile" },
      {
        group = group,
        callback = function(event)
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
                PCALL(delete_old_buffers, bufferline, bufnr)
              end)
            end,
          })
        end,
      },
    },
    {
      "User",
      {
        pattern = "BDeletePost*",
        group = group,
        callback = function(event)
          local bufnr = event.buf
          local buffer_path = GET_BUFFER_PATH(bufnr)
          local buffer_filetype = GET_OPT("filetype", { buf = bufnr })
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
        end,
      },
    },
  })
end

local function get_buf_hl(no_underline, color)
  local hl = {
    fg = color or GET_COLOR().aqua,
    bold = true,
  }
  if no_underline then
    hl.underline = false
  end
  return hl
end

return {
  "akinsho/bufferline.nvim",
  event = "VeryLazy",
  dependencies = { "nvim-tree/nvim-web-devicons" },
  config = function()
    local bufferline = require("bufferline")
    bufferline.setup({
      options = {
        close_command = "Bdelete",
        right_mouse_command = "Bdelete",
        show_buffer_close_icons = false,
        show_close_icon = false,
        separator_style = "thin",
        truncate_names = true,
        auto_toggle_bufferline = true,
        style_preset = bufferline.style_preset.no_italic,
        offsets = {
          {
            filetype = "NvimTree",
            text = GET_PROJECT_NAME(),
            highlight = "Directory",
            separator = true,
          },
        },
      },
      highlights = {
        background = {
          fg = "#aab2c0",
        },
        buffer_visible = get_buf_hl(false, "#ef8f8f"),
        buffer_selected = get_buf_hl(false, "#ef8f8f"),
        tab_selected = {
          fg = "#ffffff",
          bg = "#268bd2",
        },
        tab = {
          fg = "#268bd2",
          bg = "#cccccc",
        },
        duplicate_selected = get_buf_hl(true),
        duplicate_visible = get_buf_hl(true),
        duplicate = get_buf_hl(true, "#a9b2c0"),
      },
    })
    init(bufferline)
  end,
}
