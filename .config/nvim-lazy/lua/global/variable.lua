_G.api = vim.api
_G.fn = vim.fn
_G.g = vim.g
HOME_PATH = fn.expand("~")
CMD = api.nvim_create_autocmd
GROUP = api.nvim_create_augroup
LINUX = jit.os == "Linux"
