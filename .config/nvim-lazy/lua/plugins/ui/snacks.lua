local left = { "mark" }

if LINUX then
  left[2] = "sign"
end

return {
  "snacks.nvim",
  opts = {
    bigfile = {
      size = 524288, -- 0.5 * 1024 * 1024
    },
    statuscolumn = {
      left = left,
    },
  },
}
