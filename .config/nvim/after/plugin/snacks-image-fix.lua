-- Fix: re-render image placements after floating windows close.
--
-- Root cause: snacks.image placement:update() caches logical state (position,
-- size, window list) in self._state and skips re-rendering when
-- vim.deep_equal(state, self._state) returns true. But after a floating window
-- (e.g. snacks picker) covers and then closes over the buffer, the terminal's
-- kitty graphics placeholders (U+10EEEE) are visually wiped — the terminal
-- needs the `a=p,U=1` escape sequence re-sent to re-associate placeholders
-- with image data. Since the logical state hasn't changed, update() returns
-- early and never re-sends the command.
--
-- Fix: monkey-patch placement:state() to include a generation counter that
-- increments on every WinClosed event, forcing vim.deep_equal to fail and
-- update() to proceed with the full render path.
--
-- Remove this file once an upstream fix lands in folke/snacks.nvim.
-- Tracking: https://github.com/folke/snacks.nvim/issues/2634
local patched = false
local generation = 0

vim.api.nvim_create_autocmd("WinClosed", {
  group = vim.api.nvim_create_augroup("snacks_image_generation", { clear = true }),
  callback = function()
    generation = generation + 1
  end,
})

local function patch()
  if patched then return end
  local ok, M = pcall(require, "snacks.image.placement")
  if not ok or type(M) ~= "table" or not M.state then return end
  patched = true

  local orig_state = M.state
  M.state = function(self, ...)
    local state = orig_state(self, ...)
    if type(state) == "table" then
      state._generation = generation
    end
    return state
  end
end

-- Try immediately (snacks may already be loaded)
patch()

-- Fallback: patch when first markdown/image file opens
if not patched then
  vim.api.nvim_create_autocmd("FileType", {
    once = true,
    pattern = { "markdown", "image" },
    callback = function()
      vim.defer_fn(patch, 200)
    end,
  })
end
