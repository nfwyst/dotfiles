local fn = require("pickers.spectre.fn")
local n = require("nui-components")
local spectre_state_utils = require("spectre.state_utils")

local function replace_handler(tree, node)
  return {
    on_done = function(result)
      if result.ref then
        node.ref = result.ref
        tree:render()
      end
    end,
    on_error = function(_) end,
  }
end

local function replace_node(component, node, search_query, replace_query)
  if not node then
    return
  end

  local tree = component:get_tree()
  local has_children = node:has_children()

  if has_children then
    local child_nodes = tree:get_nodes(node:get_id())
    for _, child_node in ipairs(child_nodes) do
      replace_node(component, child_node, search_query, replace_query)
    end
    return
  end

  local replacer_creator = spectre_state_utils.get_replace_creator()
  local replacer = replacer_creator:new(
    spectre_state_utils.get_replace_engine_config(),
    replace_handler(tree, node)
  )

  local entry = node.entry

  replacer:replace({
    lnum = entry.lnum,
    col = entry.col,
    cwd = GET_GIT_PATH(),
    display_lnum = 0,
    filename = entry.filename,
    search_text = search_query:get_value(),
    replace_text = replace_query:get_value(),
  })
end

local function mappings(search_query, replace_query)
  return function(component)
    function REPLACE_ALL()
      local tree = component:get_tree()
      local nodes = tree:get_nodes()
      for _, node in ipairs(nodes) do
        replace_node(component, node, search_query, replace_query)
      end
    end
    return {
      {
        mode = { "n" },
        key = "r",
        handler = function()
          local focused_node = component:get_focused_node()
          replace_node(component, focused_node, search_query, replace_query)
        end,
      },
    }
  end
end

local function prepare_node(node, line, component)
  local _, devicons = pcall(require, "nvim-web-devicons")
  local has_children = node:has_children()

  line:append(string.rep("  ", node:get_depth() - 1))

  if has_children then
    local icon, icon_highlight = devicons.get_icon(
      node.text,
      string.match(node.text, "%a+$"),
      { default = true }
    )

    line:append(
      node:is_expanded() and " " or " ",
      component:hl_group("SpectreIcon")
    )
    line:append(icon .. " ", icon_highlight)
    line:append(node.text, component:hl_group("SpectreFileName"))

    return line
  end

  local is_replacing = #node.diff.replace > 0
  local search_highlight_group = component:hl_group(
    is_replacing and "SpectreSearchOldValue" or "SpectreSearchValue"
  )
  local default_text_highlight = component:hl_group("SpectreCodeLine")

  local _, empty_spaces = string.find(node.diff.text, "^%s*")
  local ref = node.ref

  if ref then
    line:append("✔ ", component:hl_group("SpectreReplaceSuccess"))
  end

  if #node.diff.search > 0 then
    local code_text = fn.trim(node.diff.text)

    fn.ieach(node.diff.search, function(value, index)
      local start = value[1] - empty_spaces
      local end_ = value[2] - empty_spaces

      if index == 1 then
        line:append(string.sub(code_text, 1, start), default_text_highlight)
      end

      local search_text = string.sub(code_text, start + 1, end_)
      line:append(search_text, search_highlight_group)

      local replace_diff_value = node.diff.replace[index]

      if replace_diff_value then
        local replace_text = string.sub(
          code_text,
          replace_diff_value[1] + 1 - empty_spaces,
          replace_diff_value[2] - empty_spaces
        )
        line:append(replace_text, component:hl_group("SpectreSearchNewValue"))
        end_ = replace_diff_value[2] - empty_spaces
      end

      if index == #node.diff.search then
        line:append(string.sub(code_text, end_ + 1), default_text_highlight)
      end
    end)
  end

  return line
end

local function on_select(origin_winid)
  return function(node, component)
    local tree = component:get_tree()

    if node:has_children() then
      if node:is_expanded() then
        node:collapse()
      else
        node:expand()
      end

      return tree:render()
    end

    local entry = node.entry

    if vim.api.nvim_win_is_valid(origin_winid) then
      local escaped_filename = vim.fn.fnameescape(entry.filename)

      vim.api.nvim_set_current_win(origin_winid)
      vim.cmd.normal({ "m`", bang = true })
      vim.cmd.edit(escaped_filename)
      SCROLL_TO(entry.lnum, entry.col - 1)
    end
  end
end

local function search_tree(props)
  return n.tree({
    border_style = "rounded",
    flex = 1,
    padding = {
      left = 1,
      right = 1,
    },
    hidden = props.hidden,
    data = props.data,
    mappings = mappings(props.search_query, props.replace_query),
    prepare_node = prepare_node,
    on_select = on_select(props.origin_winid),
  })
end

return search_tree
