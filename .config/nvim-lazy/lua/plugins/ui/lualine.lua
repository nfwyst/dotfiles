local refresh_time = 200
local extensions

if IS_LINUX then
  extensions = {}
  refresh_time = 1600
end

return {
  "nvim-lualine/lualine.nvim",
  opts = function(_, opts)
    local sections = opts.sections
    AUCMD("BufDelete", {
      group = GROUP("clean_tabline_title_map_for_buf", { clear = true }),
      callback = function(event)
        CLEAN_TABLINE_TITLE_MAP(event.buf)
      end,
    })

    PUSH(sections.lualine_a, {
      "tabs",
      show_modified_status = false,
      cond = function()
        return fn.tabpagenr("$") > 1
      end,
    })

    local lualine_c = filter(function(item)
      local name = item[1]
      local is_diag = name == "diagnostics"
      if is_diag then
        assign(item, {
          update_in_insert = false,
          cond = function()
            return BUF_VAR(CUR_BUF(), CONSTS.LINT_INITED)
          end,
        })
      end
      return is_diag or name == "filetype"
    end, sections.lualine_c)

    local lualine_x = sections.lualine_x
    if IS_LINUX then
      lualine_x = filter(function(item)
        return item[1] ~= require("lazy.status").updates
      end, lualine_x)
    end

    local lualine_y = filter(function(item)
      return item[1] ~= "progress"
    end, sections.lualine_y)
    push_list(lualine_y, {
      {
        function()
          return "󱁐:" .. bo[CUR_BUF()].shiftwidth
        end,
        padding = { left = 0, right = 1 },
      },
      { "encoding", padding = { left = 0, right = 1 } },
    })

    local opt = {
      options = {
        component_separators = { left = "", right = "" },
        section_separators = { left = "", right = "" },
        ignore_focus = { "neo-tree", "Avante", "AvanteInput", "codecompanion", "snacks_terminal" },
        disabled_filetypes = { winbar = { "snacks_terminal" } },
        globalstatus = true,
        refresh = {
          statusline = refresh_time,
          tabline = refresh_time / 2,
          winbar = refresh_time,
        },
      },
      sections = {
        lualine_c = lualine_c,
        lualine_x = lualine_x,
        lualine_y = lualine_y,
        lualine_z = { require("features.lualine.progress") },
      },
      tabline = {
        lualine_a = {
          {
            "buffers",
            show_modified_status = true,
            max_length = o.columns,
            filetype_names = {
              snacks_dashboard = "dashboard",
              ["neo-tree"] = "file tree",
              AvanteInput = "avante input",
              Avante = "avante chat",
              lazy = "plugin manager",
              mason = "package manager",
            },
            component_separators = { left = " ▎", right = " ▎" },
            symbols = {
              alternate_file = "󰁯 ",
            },
            fmt = require("features.lualine.buffers-fmt"),
            icons_enabled = false,
            buffers_color = {
              active = { fg = "#ffffff", bg = "#6f95ff" },
            },
            use_mode_colors = false,
          },
        },
        lualine_x = {
          {
            function()
              local root = fs.basename(LazyVim.root.get())
              local git = fs.basename(LazyVim.root.git())
              if git == root then
                return root
              end
              return git .. "" .. root
            end,
            cond = function()
              return bo[CUR_BUF()].filetype ~= "snacks_dashboard"
            end,
            padding = { left = 1, right = 1 },
            color = { fg = "#37f499" },
          },
        },
      },
      winbar = {
        lualine_c = {
          {
            "filename",
            file_status = false,
            shorting_target = 0,
            newfile_status = false,
            cond = function()
              local listed = IS_BUF_LISTED(CUR_BUF())
              return not IS_ZEN_MODE and listed
            end,
            path = 3,
            color = { fg = "#04d1f9", bg = "NONE" },
          },
        },
      },
      extensions = extensions,
    }

    return merge(opts, opt)
  end,
}
