-- Fix: images become invisible after floating windows (picker, noice, hover) close.
--
-- Root cause: floating windows overwrite terminal cells containing kitty graphics
-- unicode placeholders (U+10EEEE). After the float closes, Neovim redraws the
-- buffer but the terminal doesn't re-render existing placeholder characters as
-- images. Re-sending the virtual placement command (a=p,U=1) alone is insufficient
-- because render_grid() reuses extmark IDs (in-place update) — the terminal never
-- sees "newly painted" placeholder characters.
--
-- Fix: destroy all placements via Snacks.image.placement.clean() (sends terminal
-- delete commands, clears extmarks, removes internal tracking), then trigger a
-- full rebuild via buffer nudge (on_lines → inline.update → fresh placements).
-- New placements have no cached state, so the full render path executes: fresh
-- terminal commands (a=p,U=1) + fresh extmarks with placeholder characters.
--
-- Remove this file once an upstream fix lands in folke/snacks.nvim.
-- Tracking: https://github.com/folke/snacks.nvim/issues/2634
local augroup = vim.api.nvim_create_augroup("snacks_image_fix", { clear = true })
local debounce_timer = nil
local ns = vim.api.nvim_create_namespace("snacks.image")

local function nudge(buf)
  if not vim.api.nvim_buf_is_valid(buf) then return end
  local ok_m, was_modified = pcall(function() return vim.bo[buf].modified end)
  local ok_u, ul = pcall(function() return vim.bo[buf].undolevels end)
  if not ok_m or not ok_u then return end
  vim.bo[buf].undolevels = -1
  pcall(function()
    vim.api.nvim_buf_set_text(buf, 0, 0, 0, 0, { " " })
    vim.api.nvim_buf_set_text(buf, 0, 0, 0, 1, { "" })
  end)
  vim.bo[buf].undolevels = ul
  vim.bo[buf].modified = was_modified
end

local function rebuild()
  -- Collect buffers with snacks image extmarks
  local bufs = {}
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if vim.api.nvim_buf_is_valid(buf) and vim.api.nvim_buf_is_loaded(buf) then
      local ok, marks = pcall(vim.api.nvim_buf_get_extmarks, buf, ns, 0, -1, { limit = 1 })
      if ok and #marks > 0 then
        bufs[#bufs + 1] = buf
      end
    end
  end
  if #bufs == 0 then return end

  -- Step 1: Destroy all placements (terminal delete + clear extmarks + remove tracking)
  for _, buf in ipairs(bufs) do
    pcall(function() Snacks.image.placement.clean(buf) end)
  end

  -- Step 2: Nudge buffers to trigger on_lines → inline.update → fresh placements
  -- Small delay so terminal processes the delete commands before new ones arrive
  vim.defer_fn(function()
    for _, buf in ipairs(bufs) do
      nudge(buf)
    end
  end, 50)
end

vim.api.nvim_create_autocmd("WinClosed", {
  group = augroup,
  callback = function()
    -- Debounce: coalesce rapid float open/close cycles (e.g., noice notifications)
    if debounce_timer then
      debounce_timer:stop()
    end
    debounce_timer = vim.defer_fn(function()
      debounce_timer = nil
      rebuild()
    end, 50)
  end,
})
