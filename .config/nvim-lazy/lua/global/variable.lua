_G.api = vim.api
_G.fn = vim.fn
_G.g = vim.g
_G.keymap = vim.keymap
_G.lsp = vim.lsp
_G.levels = vim.log.levels
_G.severity = vim.diagnostic.severity
_G.snippet = vim.snippet
HOME_PATH = fn.expand("~")
CMD = api.nvim_create_autocmd
GROUP = api.nvim_create_augroup
LINUX = jit.os == "Linux"
DATA_PATH = fn.stdpath("data")
