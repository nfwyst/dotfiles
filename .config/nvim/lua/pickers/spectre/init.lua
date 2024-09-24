local engine = require("pickers.spectre.engine")
local state = require("spectre.state")
local fn = require("pickers.spectre.fn")
local n = require("nui-components")
local search_tree = require("pickers.spectre.components.search_tree")

local M = {}

function M.toggle()
  if M.renderer then
    return M.renderer:focus()
  end

  local win_width = vim.api.nvim_win_get_width(0)
  local win_height = vim.api.nvim_win_get_height(0)
  local width = 46
  local height = win_height

  local renderer = n.create_renderer({
    width = width,
    height = height,
    relative = "editor",
    position = {
      row = 0,
      col = win_width - width,
    },
  })

  local signal = n.create_signal({
    search_query = "",
    replace_query = "",
    search_paths = {},
    is_replace_field_visible = false,
    is_case_insensitive_checked = state.options["ignore-case"] or false,
    is_hidden_checked = state.options["hidden"] or false,
    search_info = "",
    search_results = {},
  })

  local subscription = signal:observe(function(prev, curr)
    local diff = fn.isome({
      "search_query",
      "is_case_insensitive_checked",
      "is_hidden_checked",
      "search_paths",
    }, function(key)
      return not vim.deep_equal(prev[key], curr[key])
    end)

    state.options["ignore-case"] = curr.is_case_insensitive_checked
    state.options["hidden"] = curr.is_hidden_checked

    if diff then
      if #curr.search_query > 2 then
        engine.search(curr, signal)
      else
        signal.search_info = ""
        signal.search_results = {}
      end
    end

    if
      not (prev.replace_query == curr.replace_query)
      and #curr.search_query > 2
    then
      signal.search_results = engine.process(curr)
    end
  end)

  renderer:add_mappings({
    {
      mode = { "n", "i" },
      key = "q",
      handler = function()
        renderer:close()
      end,
    },
  })

  renderer:on_unmount(function()
    subscription:unsubscribe()
    M.renderer = nil
    M.signal = nil
  end)

  M.renderer = renderer
  M.signal = signal

  local body = n.rows(n.columns(n.rows(
    n.columns(
      { size = 3 },
      n.text_input({
        autofocus = true,
        flex = 1,
        max_lines = 1,
        border_label = "Search",
        value = signal.search_query,
        on_change = fn.debounce(function(value)
          signal.search_query = value
        end, 400),
      }),
      n.checkbox({
        padding = {
          left = 1,
        },
        default_sign = "󰬵",
        checked_sign = "󰬶",
        border_style = "rounded",
        value = signal.is_case_insensitive_checked,
        on_change = function(is_checked)
          signal.is_case_insensitive_checked = is_checked
          TIP("ignore-case: " .. tostring(is_checked))
        end,
      }),
      n.checkbox({
        padding = {
          left = 1,
        },
        default_sign = "󰊢",
        checked_sign = "",
        border_style = "rounded",
        value = signal.is_hidden_checked,
        on_change = function(is_checked)
          signal.is_hidden_checked = is_checked
          TIP("hidden: " .. tostring(is_checked))
        end,
      }),
      n.checkbox({
        padding = {
          left = 1,
        },
        default_sign = "",
        checked_sign = "",
        border_style = "rounded",
        value = signal.is_replace_field_visible,
        on_change = function(is_checked)
          signal.is_replace_field_visible = is_checked
          if is_checked then
            local replace_component =
              renderer:get_component_by_id("replace_query")

            renderer:schedule(function()
              replace_component:focus()
            end)
          end
        end,
      })
    ),
    n.text_input({
      size = 1,
      max_lines = 1,
      id = "replace_query",
      border_label = "Replace",
      value = signal.replace_query,
      on_change = fn.debounce(function(value)
        signal.replace_query = value
      end, 400),
      hidden = signal.is_replace_field_visible:map(function(value)
        return not value
      end),
    }),
    n.columns(
      {
        size = 3,
      },
      n.text_input({
        size = 1,
        max_lines = 1,
        flex = 1,
        border_label = "Files to include",
        value = signal.search_paths:map(function(paths)
          return table.concat(paths, ",")
        end),
        on_change = fn.debounce(function(value)
          signal.search_paths = fn.ireject(
            fn.imap(vim.split(value, ","), fn.trim),
            function(path)
              return path == ""
            end
          )
        end, 400),
      }),
      n.button({
        label = "󰬲",
        padding = {
          left = 1,
          right = 1,
        },
        border_style = "rounded",
        on_press = function()
          REPLACE_ALL()
        end,
      })
    ),
    n.rows(
      {
        flex = 0,
        ---@diagnostic disable-next-line: undefined-field
        hidden = signal.search_info:map(function(value)
          return value == ""
        end),
      },
      n.paragraph({
        lines = signal.search_info,
        padding = {
          left = 1,
          right = 1,
        },
      })
    ),
    search_tree({
      search_query = signal.search_query,
      replace_query = signal.replace_query,
      data = signal.search_results,
      origin_winid = renderer:get_origin_winid(),
      hidden = signal.search_results:map(function(value)
        return #value == 0
      end),
    })
  )))

  renderer:render(body)
end

return M
