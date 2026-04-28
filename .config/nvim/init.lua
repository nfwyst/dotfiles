-- Neovim 0.12+ Configuration
-- Migrated from LazyVim to native features
vim.loader.enable()

-- Leader keys (must be set before plugins)
vim.g.mapleader = " "
vim.g.maplocalleader = "\\"

-- Resilient module loader: one module's failure won't block the rest.
-- Errors are deferred to after UI init so they're always visible.
local errors = {}
local function safe_require(mod)
  local ok, err = pcall(require, mod)
  if not ok then
    errors[#errors + 1] = mod .. ": " .. tostring(err)
  end
end

-- Load configuration (order matters: options → plugins → lsp → keymaps)
safe_require("config.options")
safe_require("config.hack")
safe_require("plugins")
safe_require("config.lsp")
safe_require("config.keymaps")
safe_require("config.autocmds")

-- Report any loading errors after UI is ready
if #errors > 0 then
  vim.api.nvim_create_autocmd("UIEnter", {
    once = true,
    callback = function()
      for _, err in ipairs(errors) do
        vim.notify("[init] " .. err, vim.log.levels.ERROR)
      end
      errors = {}
    end,
  })
end
