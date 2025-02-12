_G.api = vim.api
_G.fn = vim.fn
_G.g = vim.g
_G.keymap = vim.keymap
_G.lsp = vim.lsp
_G.levels = vim.log.levels
_G.diagnostic = vim.diagnostic
_G.severity = diagnostic.severity
_G.snippet = vim.snippet
_G.v = vim.v
_G.defer = vim.defer_fn
_G.schedule = vim.schedule
_G.push_list = vim.list_extend
_G.language = vim.treesitter.language
_G.fs = vim.fs
_G.uv = vim.uv
_G.filter = vim.tbl_filter
_G.map = vim.tbl_map
_G.contains = vim.tbl_contains
_G.env = vim.env
_G.o = vim.o
_G.cmd = vim.cmd
_G.filter = vim.tbl_filter
_G.islist = vim.islist
_G.NIL = vim.NIL
_G.ui = vim.ui
_G.keys = vim.tbl_keys
_G.shadow_merge = function(...)
  return vim.tbl_extend("force", ...)
end
_G.merge = function(...)
  return vim.tbl_deep_extend("force", ...)
end
_G.assign = function(dest, from)
  for key, value in pairs(from) do
    dest[key] = value
  end
  return dest
end

MEMORY_LIMIT = 75
MEMORY_USAGE = nil
HOME_PATH = fn.expand("~")
AUCMD = api.nvim_create_autocmd
CMD = api.nvim_create_user_command
GROUP = api.nvim_create_augroup
IS_LINUX = jit.os == "Linux"
DATA_PATH = fn.stdpath("data")
MAX_FILE_LENGTH = 5000
STAY_CENTER = true
ESLINT_BIN_NAME = "eslint_d"
ESLINT_BIN_PATH = DATA_PATH .. "/mason/bin/" .. ESLINT_BIN_NAME
NEED_ESLINT_FIX = false
IS_ZEN_MODE = false
HAS_WEZTERM = fn.executable("wezterm") == 1
TRANSPARENT_INDENT_HL = "#666666"
ENABLE_SCROLL_EFFECT = not IS_LINUX
IS_LAUNCH_FROM_GIT_REPO = false
FILETYPE_TASK_MAP = {}
TASK_KEY = "_TASK_DONE_"
FT_HIDE_CURSOR = {}
MARKDOWN_FILETYPE = { "markdown", "Avante", "codecompanion", "octo" }
MAX_OPEND_FILES = IS_LINUX and 3 or 7
AUTO_CLOSE_BUF_ENABLED = true
OPENAI_PATHNAME = "/v1/chat/completions"

LLM = {
  proxy = os.getenv("ALL_PROXY"),
  temperature = 0,
  timeout = 5000,
  hyperbolic = {
    origin = "https://api.hyperbolic.xyz",
    pathname = OPENAI_PATHNAME,
    fim_pathname = "/v1/completions",
    api_key = "HYPERBOLIC_API_KEY",
    max_tokens = 131072,
    num_ctx = 134144,
    model = "deepseek-ai/DeepSeek-R1",
    models = {
      "deepseek-ai/DeepSeek-R1",
      "deepseek-ai/DeepSeek-V3",
    },
  },
  deepseek = {
    origin = "https://api.deepseek.com",
    pathname = OPENAI_PATHNAME,
    fim_pathname = "/beta/completions",
    api_key = "DEEPSEEK_API_KEY",
    max_tokens = 8192,
    num_ctx = 65536,
    model = "deepseek-reasoner",
    models = {
      "deepseek-reasoner",
      "deepseek-chat",
    },
  },
  ollama = {
    origin = os.getenv("OLLAMA_API_BASE"),
    pathname = OPENAI_PATHNAME,
    api_key = "TERM",
    max_tokens = 8192,
    num_ctx = 16384,
    model = "deepseek-r1:32b",
    models = {
      "deepseek-r1:32b",
      "deepseek-coder-v2",
    },
  },
  gemini = {
    origin = "https://generativelanguage.googleapis.com/v1beta/models",
    api_key = "GEMINI_API_KEY",
    model = "gemini-2.0-pro-exp-02-05",
    models = {
      "gemini-2.0-flash",
      "gemini-2.0-pro-exp-02-05",
    },
  },
}

HAS_AI_KEY = os.getenv(LLM.hyperbolic.api_key) ~= nil
CONSTS = {
  LINT_INITED = "LINT_INITED",
  WIN_DIMED = "WIN_DIMED",
  IS_BUF_PINNED = "IS_BUF_PINNED",
  PREV_ROW = "PREV_ROW",
  PREV_COL = "PREV_COL",
}

PROMPT = [[
你是一位专业的编程导师和编程专家, 旨在帮助和指导我学习编程。
你的主要目标是帮助我在编写代码时学习编程概念、最佳实践和解决问题的技能。
请始终假设我是一个编程知识有限的初学者。
在所有互动中，请遵循以下准则：
1. 彻底但简单地解释概念，尽可能避免使用专业术语。
2. 引入新术语时，提供清晰的定义和示例。
3. 将复杂问题分解为更小、更易于管理的步骤。
4. 鼓励良好的编程习惯并解释它们为何重要。
5. 提供示例和类比来说明编程概念。
6. 保持耐心和支持，理解学习编程可能具有挑战性。
7. 对正确的实现给予表扬，对错误给予温和的纠正。
8. 纠正错误时，解释错误发生的原因以及如何修复它。
9. 在适当的时候建议进一步学习的资源。
10. 鼓励我提出问题并寻求澄清。
11. 通过引导我找到解决方案而不是总是提供直接答案来培养解决问题的能力。
12. 根据我的学习进度和学习偏好调整你的教学风格。
13. 提供代码片段来说明概念，但始终逐行解释代码。
14. 在整个代码中使用注释来帮助记录正在发生的事情。
请彻底回答我的问题，同时记住上述准则。如果问题不清楚或缺乏背景，请向我寻求澄清。
审查代码并提供反馈。如果有错误或需要改进的地方，请清楚地解释并提出更正建议。
如果代码正确，请给予表扬并解释为什么它是一个很好的实现。
按如下要求构建你的回答：
1. 将你的回复格式化为Markdown
2. 回答我的问题
3. 提供代码审查和反馈
4. 提供进一步学习或练习的建议
5. 所有非代码回复必须为中文
请记住，你的目标不仅是帮助我编写正确的代码，而且要帮助我理解基本原理并提高我的编程技能。
始终努力在你的回复中做到清晰、耐心和鼓励。
]]

ESLINT_CONFIGS = {
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.yaml",
  ".eslintrc.yml",
  ".eslintrc.json",
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  "eslint.config.mts",
  "eslint.config.cts",
  "package.json",
}
