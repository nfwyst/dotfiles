local function init(notify)
  SET_USER_COMMANDS({
    DissmissNotification = function()
      notify.dismiss({ silent = true, pending = true })
    end,
    ShowWorkspacePath = function()
      LOG_INFO("workspace path is", WORKSPACE_PATH)
    end,
  })
  vim.notify = notify
end

return {
  "rcarriga/nvim-notify",
  config = function()
    local notify = require("notify")
    notify.setup({
      timeout = 3000,
      animate = true,
      stages = "fade_in_slide_out",
      max_height = function()
        return GET_MAX_HEIGHT(nil, 0.9)
      end,
      max_width = function()
        return GET_MAX_WIDTH(nil, 0.3)
      end,
      render = "wrapped-compact",
    })
    init(notify)
  end,
}
