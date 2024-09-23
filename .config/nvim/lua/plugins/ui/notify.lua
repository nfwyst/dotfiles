local function init(notify)
  if MANUAL_MODE then
    LOG_INFO(
      "project.nvim is in manual mode",
      "manual mode, project root will not detect automatically"
    )
  end
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
        return math.floor(GET_EDITOR_HEIGHT() * 0.9)
      end,
      max_width = function()
        return math.floor(GET_EDITOR_WIDTH() * 0.3)
      end,
      render = "wrapped-default",
    })
    init(notify)
  end,
}
