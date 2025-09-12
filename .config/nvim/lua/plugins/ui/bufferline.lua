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
        always_show_bufferline = true,
        name_formatter = function(buf)
          local name = buf.name or ""
          local path = buf.path or ""
          if name == "" or path == "" then
            return name
          end

          local bufnr = vim.api.nvim_get_current_buf()
          if bufnr ~= buf.bufnr and name == "[No Name]" then
            return Snacks.bufdelete({ buf = buf.bufnr, force = true })
          end

          if name:match("^index$") or name:match("^index%..+") then
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
