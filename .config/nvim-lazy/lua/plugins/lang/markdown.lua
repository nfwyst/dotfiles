local ft = MARKDOWN_FILETYPE
local bufnr_aucmd_map = {}

local function reset_buf_aucmd(bufnr)
  local move_cmd = bufnr_aucmd_map[bufnr]
  if move_cmd then
    api.nvim_del_autocmd(move_cmd)
    bufnr_aucmd_map[bufnr] = nil
  end
end

local function get_cursor_fixer(bufnr, win)
  return function()
    schedule(function()
      if bufnr ~= CUR_BUF() then
        return
      end

      local pos = WIN_CURSOR(win)
      local row = pos[1]
      local col = pos[2]
      local prev_row = BUF_VAR(bufnr, CONSTS.PREV_ROW)
      local prev_col = BUF_VAR(bufnr, CONSTS.PREV_COL)

      if prev_col and prev_row ~= row then
        col = prev_col
        WIN_CURSOR(win, { row, col })
      end

      BUF_VAR(bufnr, CONSTS.PREV_ROW, row)
      BUF_VAR(bufnr, CONSTS.PREV_COL, col)
    end)
  end
end

return {
  "MeanderingProgrammer/render-markdown.nvim",
  ft = ft,
  dependencies = {
    {
      "saghen/blink.cmp",
      module = false,
      opts = function(_, opts)
        PUSH(opts.sources.default, "markdown")
        opts.sources.providers.markdown = {
          name = "RenderMarkdown",
          module = "render-markdown.integ.blink",
        }
      end,
    },
  },
  opts = function(_, opts)
    local state = require("render-markdown.state")
    local anti_conceal = { enabled = false }

    if not FILETYPE_TASK_MAP.markdown then
      FILETYPE_TASK_MAP.markdown = function(bufnr, win)
        ENABLE_CURSORLINE(bufnr, win)
        if BUF_VAR(bufnr, TASK_KEY) then
          return
        end

        reset_buf_aucmd(bufnr)

        bufnr_aucmd_map[bufnr] = AUCMD({ "CursorMovedI", "CursorMoved" }, {
          buffer = bufnr,
          callback = get_cursor_fixer(bufnr, win),
        })

        BUF_VAR(bufnr, TASK_KEY, true)
      end
    end

    SET_BUF_DEL_MAP("markdown", reset_buf_aucmd)

    local opt = {
      render_modes = { "n", "i", "no", "c", "t", "v", "V", "" },
      file_types = ft,
      latex = {
        render_modes = true,
      },
      heading = {
        sign = true,
        render_modes = true,
        icons = { "󰎥 ", "󰎨 ", "󰎫 ", "󰎲 ", "󰎯 ", "󰎴 " },
      },
      paragraph = {
        render_modes = true,
        left_margin = 2,
      },
      code = {
        sign = true,
        width = "full",
        render_modes = true,
      },
      dash = {
        render_modes = true,
      },
      bullet = {
        render_modes = true,
      },
      checkbox = {
        enabled = true,
        render_modes = true,
      },
      quote = {
        render_modes = true,
      },
      pipe_table = {
        render_modes = true,
      },
      link = {
        render_modes = true,
      },
      inline_highlight = {
        render_modes = true,
      },
      html = {
        render_modes = true,
      },
      overrides = {
        buflisted = {
          [false] = { anti_conceal = anti_conceal },
        },
        buftype = {
          nofile = { anti_conceal = anti_conceal },
        },
      },
      win_options = {
        concealcursor = {
          rendered = "nvic",
        },
      },
      on = {
        render = function(buf)
          if not OPT("modifiable", { buf = buf }) then
            return
          end

          state.get(buf).anti_conceal.enabled = true
          OPT("concealcursor", { win = fn.bufwinid(buf) }, "")
        end,
      },
    }

    return merge(opts, opt)
  end,
}
