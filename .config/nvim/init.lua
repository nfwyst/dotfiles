vim.loader.enable()

require("global")
require("core")
require("setup")

-- local http = require("core.http")
--
-- local token = ""
-- local result = ""
--
-- require("deepseek").setup({
--   api_key = token
-- })

-- http.request({
--   url = "https://api.deepseek.com/beta/completions",
--   method = "POST",
--   headers = {
--     ["Content-Type"] = "application/json",
--     ["Accept"] = "application/json",
--     ["Authorization"] = "Bearer " .. token,
--   },
--   body = {
--     model = "deepseek-coder",
--     prompt = "Once upon a time, ",
--     echo = false,
--     frequency_penalty = 0,
--     -- logprobs = 0,
--     max_tokens = 1024, -- 4096
--     presence_penalty = 0,
--     stop = nil,
--     stream = true,
--     stream_options = nil,
--     suffix = nil,
--     temperature = 1,
--     top_p = 1,
--   },
-- }, function(chunk, final_response)
--   if chunk then
--     result = result .. chunk
--     print("数据块:", result)
--   else
--     print("最终响应:", table.concat(final_response, ""))
--   end
-- end, format)
