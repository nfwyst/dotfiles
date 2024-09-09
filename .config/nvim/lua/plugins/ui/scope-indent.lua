local function is_exclude(path, patterns)
  for _, pattern in ipairs(patterns) do
    if string.match(path, pattern) then
      return true
    end
  end
  return false
end

local function build_pattern(str)
  return "^" .. str:gsub("%.", "%%."):gsub("%*", ".*") .. "$"
end

local function check_project_for_tabs(dir)
  local stack = { dir }
  local ignore_pattern = { "node_modules", build_pattern("*.ttf") }
  while #stack > 0 do
    local current_dir = table.remove(stack)
    local files = GET_FILES_FROM_PATH(current_dir, 10)
    for _, file in ipairs(files) do
      local filepath = current_dir .. "/" .. file
      if file:sub(1, 1) ~= "." then
        if not is_exclude(filepath, ignore_pattern) then
          local attr = vim.uv.fs_stat(filepath)
          if attr then
            if attr.type == "directory" then
              table.insert(stack, filepath)
            elseif attr.type == "file" then
              if IS_INDENT_WITH_TAB({ filepath = filepath }) then
                return true
              end
            end
          end
        end
      end
    end
  end

  return false
end

local disabled = false

return {
  "nvimdev/indentmini.nvim",
  event = "VimEnter",
  config = function()
    if disabled then
      return
    end
    if check_project_for_tabs(".") then
      disabled = true
      return
    end
    require("indentmini").setup({
      char = "│",
      exclude = { "markdown" },
      minlevel = 1,
      only_current = false,
    })
  end,
}
