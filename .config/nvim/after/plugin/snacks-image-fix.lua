-- Fix: images become invisible after floating windows (picker, noice, hover) close.
--
-- Root cause: floating windows overwrite terminal cells containing kitty graphics
-- placeholders (U+10EEEE). After float closes, the terminal has the placeholder
-- characters back in cells (Neovim redraws them from extmarks), but the virtual
-- placement association is stale — the terminal doesn't re-scan existing
-- placeholders for an already-active placement.
--
-- Fix: on WinClosed, delete all terminal-side placements (a=d,d=A), then force
-- snacks to re-create them (a=p,U=1) via a generation counter that invalidates
-- the state cache. The terminal re-scans visible cells for matching placeholder
-- characters and renders images. No extmark manipulation needed.
--
-- Remove this file once an upstream fix lands in folke/snacks.nvim.
-- Tracking: https://github.com/folke/snacks.nvim/issues/2634
local patched = false
local generation = 0
local augroup = vim.api.nvim_create_augroup("snacks_image_fix", { clear = true })
local debounce_timer = nil

local function refresh_images()
  -- Step 1: Delete all terminal-side image placements.
  -- terminal.request({a="d", d="A"}) encodes to ESC_Ga=d,d=A,q=2ESC\
  -- which tells the terminal to delete all virtual placements (d=A).
  local term_ok, term = pcall(require, "snacks.image.terminal")
  if term_ok and term.request then
    pcall(function() term.request({ a = "d", d = "A" }) end)
  end

  -- Step 2: Trigger placement updates on all buffers with images.
  -- The generation counter ensures update() proceeds past the state cache,
  -- re-sending a=p,U=1 commands that make the terminal re-scan for placeholders.
  local ns = vim.api.nvim_create_namespace("snacks.image")
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if vim.api.nvim_buf_is_valid(buf) and vim.api.nvim_buf_is_loaded(buf) then
      local ok, marks = pcall(vim.api.nvim_buf_get_extmarks, buf, ns, 0, -1, { limit = 1 })
      if ok and #marks > 0 then
        pcall(vim.api.nvim_exec_autocmds, "BufWinEnter", { buffer = buf })
      end
    end
  end
end

vim.api.nvim_create_autocmd("WinClosed", {
  group = augroup,
  callback = function()
    generation = generation + 1
    -- Debounce rapid float cycles (e.g. noice notifications)
    if debounce_timer then
      debounce_timer:stop()
    end
    debounce_timer = vim.defer_fn(function()
      debounce_timer = nil
      refresh_images()
    end, 50)
  end,
})

local function patch()
  if patched then return end
  local ok, M = pcall(require, "snacks.image.placement")
  if not ok or type(M) ~= "table" or not M.state then return end
  patched = true

  -- Inject generation counter into state to invalidate the deep_equal cache.
  -- placement:update() does `if vim.deep_equal(state, self._state) then return end`
  -- so bumping _generation forces it to proceed past the check and re-send
  -- the terminal.request({a="p", U=1, ...}) command + re-render the grid.
  local orig_state = M.state
  M.state = function(self, ...)
    local state = orig_state(self, ...)
    if type(state) == "table" then
      state._generation = generation
    end
    return state
  end
end

patch()
if not patched then
  vim.api.nvim_create_autocmd("FileType", {
    once = true,
    pattern = { "markdown", "image" },
    callback = function() vim.defer_fn(patch, 200) end,
  })
end
