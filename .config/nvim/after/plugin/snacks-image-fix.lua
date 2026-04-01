-- Upstream fix for folke/snacks.nvim#2634: re-show hidden image placements
-- when returning to a buffer. Remove this file once the fix is merged upstream.
-- See: https://github.com/KEMSHlM/snacks.nvim/commit/054e90e
--
-- Root cause: when switching away from an image buffer, placement:update()
-- calls self:hide() setting self.hidden = true.  On return, show() was never
-- called because the code path went straight to self.img:place() without
-- checking the hidden flag.
--
-- This monkey-patches M.update on the placement prototype so every instance
-- inherits the corrected behaviour.
local patched = false

local function patch()
  if patched then return end
  local ok, M = pcall(require, "snacks.image.placement")
  if not ok or type(M) ~= "table" or not M.update then return end
  patched = true

  local orig_update = M.update
  M.update = function(self, ...)
    -- When the buffer becomes visible again after being hidden (#wins went
    -- from 0 → >0), the original update() would skip re-showing because it
    -- only hides (on 0 wins) and never reverses that.  Re-show here.
    if self.hidden and self.buf and vim.api.nvim_buf_is_valid(self.buf) then
      local wins = vim.fn.win_findbuf(self.buf)
      if wins and #wins > 0 then
        self:show()
        return
      end
    end
    return orig_update(self, ...)
  end
end

-- Try immediately: snacks core is loaded by plugins/ui.lua, but the image
-- sub-module is lazy and may not exist yet.
patch()

-- Fallback: patch when the first markdown buffer is opened (which is when
-- snacks.image gets required for inline image rendering).
if not patched then
  vim.api.nvim_create_autocmd("FileType", {
    once = true,
    pattern = "markdown",
    callback = function()
      vim.defer_fn(patch, 200)
    end,
  })
end
