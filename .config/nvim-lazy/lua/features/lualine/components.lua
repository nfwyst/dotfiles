local codecompanion = require("lualine.component"):extend()
codecompanion.processing = false
codecompanion.spinner_index = 1

local spinner_symbols = {
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
}
local spinner_symbols_len = 10
local group = GROUP("codecompanion_hooks", { clear = true })

-- Initializer
function codecompanion:init(options)
  codecompanion.super.init(self, options)

  AUCMD({ "User" }, {
    pattern = "CodeCompanionRequest*",
    group = group,
    callback = function(event)
      local name = event.match
      if name == "CodeCompanionRequestStarted" then
        self.processing = true
      elseif name == "CodeCompanionRequestFinished" then
        self.processing = false
      end
    end,
  })
end

-- Function that runs every time statusline is updated
function codecompanion:update_status()
  if self.processing then
    self.spinner_index = (self.spinner_index % spinner_symbols_len) + 1
    return spinner_symbols[self.spinner_index]
  else
    return " "
  end
end

local progress = {
  function()
    local current_line = fn.line(".")
    local total_lines = fn.line("$")
    local chars = {
      "██",
      "▇▇",
      "▆▆",
      "▅▅",
      "▄▄",
      "▃▃",
      "▂▂",
      "▁▁",
      "  ",
    }
    local line_ratio = current_line / total_lines
    local index = math.ceil(line_ratio * #chars)
    return chars[index]
  end,
  padding = 0,
}

local root_path_guide = {
  function()
    local root = fs.basename(LazyVim.root.get())
    local git = fs.basename(LazyVim.root.git())
    if git == root then
      return root
    end
    return root .. "" .. git
  end,
  padding = { left = 1, right = 1 },
  color = { fg = "#37f499" },
}

return {
  codecompanion = codecompanion,
  progress = progress,
  root_path_guide = root_path_guide,
}
