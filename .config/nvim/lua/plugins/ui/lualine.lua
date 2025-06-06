local toggle_buffer_pin = require("features.lualine.toggle-buffer-pin")
local formatters = require("features.lualine.formatters")
local buffers_title_map = formatters.buffers_title_map

local function clean_buffers_title_map(bufnr)
  local bufpath = BUF_PATH(bufnr)
  if not IS_FILEPATH(bufpath, true) then
    return
  end

  local bufname = fs.basename(bufpath)
  local showed_map = buffers_title_map[bufname]

  if not showed_map then
    return
  end

  buffers_title_map[bufname] = filter(function(buf)
    return buf ~= bufnr
  end, showed_map)

  if #buffers_title_map[bufname] < 1 then
    buffers_title_map[bufname] = nil
  end
end

return {
  "nvim-lualine/lualine.nvim",
  keys = toggle_buffer_pin.keys,
  opts = function(_, opts)
    local components = require("features.lualine.components")
    local sections = opts.sections

    ADD_BUF_DEL_CALLBACK("lualine", function(bufnr)
      clean_buffers_title_map(bufnr)
    end)

    local tabs_name = "tabs"
    PUSH_WHEN_NOT_EXIST(sections.lualine_a, {
      tabs_name,
      show_modified_status = false,
      cond = function()
        return fn.tabpagenr("$") > 1
      end,
    }, function(v)
      return v[1] == tabs_name
    end)

    local lualine_c = filter(function(item)
      local name = item[1]
      local is_diag = name == "diagnostics"
      if is_diag then
        assign(item, {
          update_in_insert = false,
          cond = function()
            return diagnostic.is_enabled({ bufnr = CUR_BUF() })
          end,
        })
      end
      return is_diag or name == "filetype"
    end, sections.lualine_c)

    local lualine_x = sections.lualine_x

    local lualine_y = filter(function(item)
      return item[1] ~= "progress"
    end, sections.lualine_y)
    push_list(lualine_y, {
      {
        function()
          return "󱁐:" .. OPT("shiftwidth", { buf = CUR_BUF() })
        end,
        padding = { left = 0, right = 1 },
      },
      { "encoding", padding = { left = 0, right = 1 } },
      components.memory,
    })

    local opt = {
      options = {
        component_separators = { left = "", right = "" },
        section_separators = { left = "", right = "" },
        ignore_focus = { "neo-tree", "Avante", "AvanteInput", "codecompanion", "snacks_terminal" },
        disabled_filetypes = { statusline = {} },
        globalstatus = true,
      },
      sections = {
        lualine_c = lualine_c,
        lualine_x = lualine_x,
        lualine_y = lualine_y,
        lualine_z = { components.progress },
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
            fmt = formatters.buffers,
            icons_enabled = false,
            buffers_color = {
              active = { fg = "#ffffff", bg = "#6f95ff" },
            },
            use_mode_colors = false,
          },
        },
        lualine_x = { components.root_path_guide },
      },
    }

    return merge(opts, opt)
  end,
}
