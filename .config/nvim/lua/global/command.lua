SET_USER_COMMANDS({
  OpenCurFile = function()
    OPEN_LINK_OR_FILE(GET_CURRENT_BUFFER_PATH())
  end,
  ShowFilePath = function()
    LOG_INFO("current file path is", GET_CURRENT_BUFFER_PATH())
  end,
  ExitInsertMode = function()
    vim.cmd.stopinsert()
    local ok, snip = pcall(require, "luasnip")
    if not ok then
      LOG_WARN("plugin missing", "luasnip is not installed...")
    else
      pcall(snip.unlink_current)
    end
  end,
})
