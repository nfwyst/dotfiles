return {
  "tadaa/vimade",
  cond = not IS_SYNTAX_OFF,
  event = "VeryLazy",
  config = function()
    for _, filetype in ipairs(FT_DISABLE_DIM) do
      if not FILETYPE_TASK_MAP[filetype] then
        local prev_syntax_off = IS_SYNTAX_OFF
        FILETYPE_TASK_MAP[filetype] = function(bufnr)
          if prev_syntax_off ~= IS_SYNTAX_OFF then
            BUF_VAR(bufnr, FILETYPE_TASK_KEY, false)
            prev_syntax_off = IS_SYNTAX_OFF
          end

          if BUF_VAR(bufnr, FILETYPE_TASK_KEY) then
            return
          end

          if IS_SYNTAX_OFF then
            cmd.VimadeBufEnable()
          else
            cmd.VimadeBufDisable()
          end

          BUF_VAR(bufnr, FILETYPE_TASK_KEY, true)
        end
      end
    end

    require("vimade").setup({
      fadelevel = 0.7,
      recipe = { "duo", { animate = true } },
      tint = {
        bg = { rgb = { 255, 255, 255 }, intensity = 0.1 },
        fg = { rgb = { 255, 255, 255 }, intensity = 0.1 },
      },
    })
  end,
}
