return {
  "akinsho/bufferline.nvim",
  opts = function(_, opts)
    local offsets = opts.options.offsets or {}
    for _, offset in ipairs(offsets) do
      if offset.filetype == "neo-tree" then
        offset.text = ""
        offset.text_align = "center"
      end
    end

    local opt = {
      options = {
        diagnostics = false,
        truncate_names = false,
        max_prefix_length = 30,
        always_show_bufferline = false,
        custom_filter = function(bufnr)
          return vim.api.nvim_buf_get_name(bufnr) ~= "health://"
        end,
        name_formatter = function(bufinfo)
          local name = bufinfo.name or ""
          if name:match("^index$") or name:match("^index%..+") then
            local path = bufinfo.path or ""
            local parent = vim.fn.fnamemodify(path, ":h:t")
            if parent == "" or parent == "." then
              return name
            end
            return parent .. "/" .. name
          end

          return name
        end,
      },
    }

    return vim.tbl_deep_extend("force", opts, opt)
  end,
}
