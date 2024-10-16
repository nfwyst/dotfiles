local function footer()
  local handle = io.popen("fortune")
  if not handle then
    return " "
  end
  local fortune = handle:read("*a")
  handle:close()
  return fortune
end

local function init()
  local group = AUTOGROUP("_alpha_", { clear = true })
  AUTOCMD("User", {
    pattern = "AlphaReady",
    group = group,
    callback = function(event)
      ALPHA_BUF = event.buf
      SET_TIMEOUT(function()
        SET_OPT("laststatus", 0)
        SET_OPT("cursorline", true, event)
      end, 10)
      AUTOCMD("BufUnload", {
        buffer = event.buf,
        group = group,
        callback = function()
          SET_TIMEOUT(function()
            SET_OPT("laststatus", 3)
          end, 10)
        end,
      })
    end,
  })
end

local function expand_home_path(path)
  return path:gsub("^" .. HOME_PATH, "~")
end

return {
  "goolord/alpha-nvim",
  event = "VimEnter",
  dependencies = { "nvim-tree/nvim-web-devicons" },
  config = function()
    local alpha = require("alpha")
    local dashboard = require("alpha.themes.dashboard")
    local current_path = GET_WORKSPACE_PATH(nil, true)
    local git_path = GET_GIT_PATH(current_path)
    local val = {
      [[                               __                ]],
      [[  ___     ___    ___   __  __ /\_\    ___ ___    ]],
      [[ / _ `\  / __`\ / __`\/\ \/\ \\/\ \  / __` __`\  ]],
      [[/\ \/\ \/\  __//\ \_\ \ \ \_/ |\ \ \/\ \/\ \/\ \ ]],
      [[\ \_\ \_\ \____\ \____/\ \___/  \ \_\ \_\ \_\ \_\]],
      [[ \/_/\/_/\/____/\/___/  \/__/    \/_/\/_/\/_/\/_/]],
      [[]],
      " : " .. expand_home_path(current_path),
    }
    if git_path and current_path ~= git_path then
      table.insert(val, " : " .. expand_home_path(git_path))
    end
    dashboard.section.header.val = val
    dashboard.section.buttons.val = {
      dashboard.button("f", "󰱼  Find file", "<cmd>FindFiles<cr>"),
      dashboard.button("e", "  New file", "<cmd>ene <bar> startinsert<cr>"),
      dashboard.button("p", "  Find project", "<cmd>Telescope projects<cr>"),
      dashboard.button(
        "R",
        "  Recently used files global",
        "<cmd>Telescope oldfiles<cr>"
      ),
      dashboard.button(
        "r",
        "  Recently used files",
        "<cmd>Telescope oldfiles only_cwd=true<cr>"
      ),
      dashboard.button("t", "󰊄  Find text", "<cmd>FindText<cr>"),
      dashboard.button("c", "  Configuration", "<cmd>e $MYVIMRC<cr>"),
      dashboard.button("q", "󰅙  Quit Neovim", "<cmd>qa<cr>"),
    }
    dashboard.section.footer.val = footer()
    dashboard.section.footer.opts.hl = ""
    dashboard.section.header.opts.hl = "Include"
    dashboard.section.buttons.opts.hl = "Keyword"
    dashboard.config.opts.noautocmd = true
    alpha.setup(dashboard.config)
    init()
  end,
}
