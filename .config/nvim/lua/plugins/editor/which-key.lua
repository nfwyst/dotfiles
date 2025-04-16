local function override_buffer_spec(spec)
  if spec.group ~= "buffer" then
    return
  end

  spec.expand = function()
    local wk_extras = require("which-key.extras")
    local bufnrs = require("lualine.components.buffers").bufpos2nr
    local index = 1
    local keys = {}
    for _, bufnr in pairs(bufnrs) do
      if index < 10 and bufnr ~= CUR_BUF() then
        local name = BUF_PATH(bufnr)
        PUSH(keys, {
          tostring(index),
          function()
            vim.api.nvim_set_current_buf(bufnr)
          end,
          desc = name,
          icon = { cat = "file", name = name },
        })
      end

      index = index + 1
    end

    return keys
  end
end

return {
  "folke/which-key.nvim",
  opts = function(_, opts)
    local opt = {
      preset = "classic",
      keys = {
        scroll_down = "<c-j>",
        scroll_up = "<c-k>",
      },
      plugins = {
        spelling = {
          suggestions = 10,
        },
      },
      win = {
        no_overlap = false,
        height = { max = 25 },
        border = "rounded",
        padding = { 1, 1 },
      },
      layout = {
        width = { max = 100 },
        spacing = 1,
      },
      icons = {
        rules = {
          { pattern = "harpoon", icon = "󱓞 ", color = "orange" },
        },
      },
    }

    local specs = opts.spec[1]
    for _, spec in ipairs(specs) do
      override_buffer_spec(spec)
    end

    return merge(opts, opt)
  end,
}
