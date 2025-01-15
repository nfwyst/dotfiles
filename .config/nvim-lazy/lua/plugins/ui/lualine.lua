local progress = {
  function()
    local current_line = fn.line(".")
    local total_lines = fn.line("$")
    local chars = {
      "██",
      "▇▇",
      "▆▆",
      "▅▅",
      "▄▄",
      "▃▃",
      "▂▂",
      "▁▁",
      "  ",
    }
    local line_ratio = current_line / total_lines
    local index = math.ceil(line_ratio * #chars)
    return chars[index]
  end,
  padding = 0,
}

local refresh_time = 100
local extensions

if IS_LINUX then
  extensions = {}
  refresh_time = 1000
end

local function format_duplicated_title(title, filepath, bufnr)
  if not IS_FILEPATH(filepath) then
    return title
  end
  local showed_map = TABLINE_TITLE_MAP[title]
  if not showed_map then
    TABLINE_TITLE_MAP[title] = { bufnr }
    return title
  end
  if not contains(showed_map, bufnr) then
    PUSH(showed_map, bufnr)
  end
  if #showed_map <= 1 then
    return title
  end
  return fs.basename(fs.dirname(filepath)) .. "/" .. title
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
        ignore_focus = { "neo-tree", "Avante", "AvanteInput", "codecompanion" },
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
        lualine_z = { progress },
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
            fmt = function(name, context)
              local bufnr = context.bufnr
              local ft = context.filetype
              local title = not EMPTY(name) and name
              local filetype = not EMPTY(ft) and ft
              local title_invalid = not title or title == "[No Name]"

              if title_invalid then
                title = filetype or ""
                if not filetype then
                  bo[bufnr].buflisted = false
                end
                if EMPTY(title) then
                  return title
                end
              else
                title = format_duplicated_title(title, context.file, bufnr)
              end

              if filetype == "octo" and tonumber(title) then
                title = " PR:" .. title
              end

              local pinned_icon = ""
              if BUF_VAR(bufnr, CONSTS.IS_BUF_PINNED) then
                pinned_icon = " "
              end
              return title .. pinned_icon
            end,
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
