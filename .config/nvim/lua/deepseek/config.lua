local M = {}

local config = {
  api_key = os.getenv("DEEPSEEK_API_KEY"),
  base_url = "https://api.deepseek.com/beta",
  context_length = 128 * 1024,
  max_output_length = {
    fim = 4 * 1024,
    chat = 8 * 1024,
  },
  default_model = "deepseek-coder",
  display_mode = "split",
  win_config = {},
  session_file = vim.fn.stdpath("data") .. "/deepseek_session.json",
}

local function set(conf)
  for k, v in pairs(conf) do
    M[k] = v
  end
end

function M.setup(opts)
  set(opts)
end

set(config)

return M
