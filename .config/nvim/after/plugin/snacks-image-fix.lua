-- Fix: images become invisible ("transparent") after any floating window
-- (picker, noice notification, hover, etc.) opens and closes.
--
-- Root cause: floating windows overwrite the terminal cells containing kitty
-- graphics unicode placeholders (U+10EEEE). When the float closes, Neovim
-- redraws the buffer text, but the terminal doesn't re-associate the
-- redrawn placeholder characters with the image data. The previous fix
-- (generation counter to bypass update()'s vim.deep_equal cache) was
-- insufficient because even when update() proceeds:
--   1. render_grid() reuses existing extmark IDs (self.eids) so the
--      terminal sees the same characters at the same positions and
--      doesn't re-scan them
--   2. The a=p,U=1 terminal command only creates the placement
--      association -- it doesn't force the terminal to repaint cells
--      that already contain the right placeholder characters
--
-- Nuclear fix: on WinClosed, destroy all placements via the snacks API
-- (which sends terminal delete commands, removes extmarks, and clears
-- internal tracking), then nudge each affected buffer to trigger
-- on_lines -> inline.update() -> fresh placements from scratch.
--
-- The inline.update() path works because:
--   - placement.clean(buf) calls p:close() on every placement, which
--     calls p:del() -> img:del(pid) sending a=d,d=i terminal commands
--     and deleting all extmarks from the snacks.image namespace
--   - With extmarks gone, inline:visible() returns empty
--   - inline:update() then treats every image as "new" and creates
--     fresh placements with new IDs, new extmarks, and new a=p,U=1
--     terminal commands -- the terminal sees brand-new placeholder
--     characters and renders them
--
-- Debounced to handle rapid float open/close cycles.
-- Remove this file once an upstream fix lands in folke/snacks.nvim.
-- Tracking: https://github.com/folke/snacks.nvim/issues/2634

local augroup = vim.api.nvim_create_augroup("snacks_image_fix", { clear = true })
local rebuild_timer = nil
local NS = "snacks.image" -- namespace used by snacks for image extmarks

--- Check whether a buffer has any snacks image extmarks.
---@param buf number
---@return boolean
local function has_snacks_images(buf)
  if not vim.api.nvim_buf_is_valid(buf) or not vim.api.nvim_buf_is_loaded(buf) then
    return false
  end
  local ns_id = vim.api.nvim_create_namespace(NS)
  local ok, marks = pcall(vim.api.nvim_buf_get_extmarks, buf, ns_id, 0, -1, { limit = 1 })
  return ok and #marks > 0
end

--- Destroy all image placements and trigger a full rebuild.
local function rebuild_images()
  -- Guard: snacks must be loaded
  local ok, placement = pcall(require, "snacks.image.placement")
  if not ok or type(placement) ~= "table" or type(placement.clean) ~= "function" then
    return
  end

  -- Find all buffers that currently have snacks image extmarks
  local image_bufs = {}
  for _, buf in ipairs(vim.api.nvim_list_bufs()) do
    if has_snacks_images(buf) then
      table.insert(image_bufs, buf)
    end
  end
  if #image_bufs == 0 then
    return
  end

  -- Step 1: Clean all placements via the snacks API.
  -- placement.clean(buf) iterates the internal placements table and calls
  -- p:close() on each, which:
  --   - Sends terminal delete commands (a=d,d=i) via terminal.request()
  --   - Deletes all extmarks from the buffer
  --   - Removes the placement from the internal tracking table
  --   - Sets p.closed = true
  for _, buf in ipairs(image_bufs) do
    pcall(placement.clean, buf)
  end

  -- Step 2: After a short delay (to let the terminal process the delete
  -- commands), nudge each buffer with a no-op edit. This fires the
  -- on_lines callback that inline.lua attached via nvim_buf_attach,
  -- which triggers inline:update() (debounced 100ms). Since all extmarks
  -- are gone, inline:visible() returns empty and every image is treated
  -- as new, creating fresh placements from scratch.
  vim.defer_fn(function()
    for _, buf in ipairs(image_bufs) do
      if vim.api.nvim_buf_is_valid(buf) and vim.api.nvim_buf_is_loaded(buf) then
        pcall(function()
          local was_modified = vim.bo[buf].modified
          local ul = vim.bo[buf].undolevels
          vim.bo[buf].undolevels = -1
          -- Insert and immediately remove a space at (0,0) -- invisible to the
          -- user and doesn't pollute undo history.
          vim.api.nvim_buf_set_text(buf, 0, 0, 0, 0, { " " })
          vim.api.nvim_buf_set_text(buf, 0, 0, 0, 1, { "" })
          vim.bo[buf].undolevels = ul
          vim.bo[buf].modified = was_modified
        end)
      end
    end
  end, 150)
end

vim.api.nvim_create_autocmd("WinClosed", {
  group = augroup,
  callback = function()
    -- Debounce: collapse rapid float open/close cycles (e.g. noice
    -- notifications, completion popups) into a single rebuild.
    if rebuild_timer then
      rebuild_timer:stop()
    end
    rebuild_timer = vim.defer_fn(function()
      rebuild_timer = nil
      rebuild_images()
    end, 200)
  end,
})
