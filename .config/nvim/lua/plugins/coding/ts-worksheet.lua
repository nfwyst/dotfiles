return {
  "typed-rocks/ts-worksheet-neovim",
  cond = not IS_LINUX,
  keys = {
    {
      "<leader>ce",
      function()
        local bufnr = CUR_BUF()
        if OPT("modified", { buf = bufnr }) then
          cmd.write()
        end

        local opt = { bufnr = bufnr }
        if not diagnostic.is_enabled(opt) then
          diagnostic.enable(true, opt)
        end

        -- //? only show specified line output
        -- //ts-worksheet auto run when save file
        cmd.Tsw("rt=bun show_order=true")
      end,
      ft = FE_FILETYPES,
      desc = "Run this js/ts file",
    },
  },
  opts = {
    severity = severity.INFO,
  },
}
