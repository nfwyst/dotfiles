local function init(ufo)
  SET_KEY_MAPS({
    n = {
      { lhs = "zR", rhs = ufo.openAllFolds },
      { lhs = "zM", rhs = ufo.closeAllFolds },
      { lhs = "zr", rhs = ufo.openFoldsExceptKinds },
      { lhs = "zm", rhs = ufo.closeFoldsWith },
      { lhs = "zp", rhs = ufo.peekFoldedLinesUnderCursor },
    },
  })
end

return {
  "kevinhwang91/nvim-ufo",
  keys = {
    "zR",
    "zM",
    "zr",
    "zm",
    "zp",
    "za",
    "zA",
    "zc",
    "zC",
    "zi",
    "zo",
    "zO",
    "zx",
    "zf",
  },
  dependencies = { "kevinhwang91/promise-async" },
  config = function()
    local ufo = require("ufo")
    init(ufo)
    ufo.setup({
      open_fold_hl_timeout = 400,
      close_fold_kinds_for_ft = { default = { "imports", "comment" } },
      enable_get_fold_virt_text = false,
      provider_selector = function(_, filetype, buftype)
        local is_git = filetype == "git"
        local is_nofile = buftype == "nofile"
        local filetype_invalid = INCLUDES(INVALID_FILETYPE, filetype)
        local is_git_or_python = INCLUDES({ "vim", "python" }, filetype)
        if is_git or filetype_invalid then
          return ""
        end
        if is_nofile or is_git_or_python then
          return "indent"
        end

        return function(bufnr)
          local ok, result = pcall(ufo.getFolds, bufnr, "treesitter")
          if ok then
            return result
          end
          if
            type(result) == "string" and result:match("UfoFallbackException")
          then
            return ufo.getFolds(bufnr, "indent")
          else
            return require("promise").reject(result)
          end
        end
      end,
      preview = {
        mappings = {
          scrollU = "<C-k>",
          scrollD = "<C-j>",
          jumpTop = "[",
          jumpBot = "]",
        },
        win_config = {
          winhighlight = "Normal:UfoPreviewNormal,FloatBorder:UfoPreviewBorder,CursorLine:UfoPreviewCursorLine",
          winblend = 0,
        },
      },
    })
  end,
}
