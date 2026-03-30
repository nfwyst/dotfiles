-- Tools plugin configurations
local util = require("config.util")
local constant = require("config.constant")

-- ===================================================================
-- Mason
-- ===================================================================
require("mason").setup({
  log_level = vim.log.levels.OFF,
  ensure_installed = {
    "lua-language-server",
    "vtsls",
    "html-lsp",
    "css-lsp",
    "css-variables-language-server",
    "emmet-language-server",
    "tailwindcss-language-server",
    "taplo",
    "ast-grep",
    "tectonic",
    "tree-sitter-cli",
    "eslint_d",
    "beautysh",
    "prettierd",
    "vale",
    "kulala-fmt",
    "mmdc",
    "nginx-config-formatter",
    "uv",
    "sqruff",
    "json-lsp",
    "yaml-language-server",
  },
  ui = {
    border = "rounded",
    height = 0.7,
    icons = {
      package_installed = "✓",
      package_pending = "◍",
      package_uninstalled = "✗",
    },
  },
})

-- Auto-install mason packages (deferred to avoid blocking startup)
vim.defer_fn(function()
  local mr = require("mason-registry")
  mr.refresh(function()
    local opts = require("mason.settings").current
    for _, name in ipairs(opts.ensure_installed or {}) do
      local pkg = mr.get_package(name)
      if not pkg:is_installed() then
        pkg:install()
      end
    end
  end)
end, 100)

-- ===================================================================
-- Conform (formatting)
-- ===================================================================
local fixer = { "eslint_d" }
local formatter = { "prettierd" }
local md_formatter = { "prettierd", "markdownlint-cli2", "markdown-toc" }
local is_fix_mode = false

local function fix_or_format()
  if is_fix_mode then return fixer end
  return formatter
end

require("conform").setup({
  log_level = vim.log.levels.OFF,
  default_format_opts = { stop_after_first = false },
  formatters_by_ft = {
    javascript = fix_or_format,
    typescript = fix_or_format,
    javascriptreact = fix_or_format,
    typescriptreact = fix_or_format,
    svelte = fix_or_format,
    css = formatter,
    scss = formatter,
    less = formatter,
    html = formatter,
    json = formatter,
    jsonc = formatter,
    yaml = formatter,
    graphql = formatter,
    ["markdown"] = md_formatter,
    ["markdown.mdx"] = md_formatter,
    nu = {},
    sh = { "shfmt" },
    zsh = { "beautysh" },
    lua = { "stylua" },
    toml = { "taplo" },
    http = { "kulala-fmt" },
    nginx = { "nginxfmt" },
    sql = { "sqruff" },
    ["_"] = { "trim_whitespace" },
  },
  formatters = {
    beautysh = function()
      local shiftwidth = vim.api.nvim_get_option_value("shiftwidth", { buf = vim.api.nvim_get_current_buf() })
      return {
        command = "beautysh",
        args = { "-i", tostring(shiftwidth), "$FILENAME" },
        stdin = false,
      }
    end,

  },
  format_on_save = function(bufnr)
    if vim.b[bufnr].autoformat == false then return end
    if vim.b[bufnr].autoformat == nil and not vim.g.autoformat then return end
    return { timeout_ms = 3000, lsp_fallback = true }
  end,
  format_after_save = function(bufnr)
    if vim.b[bufnr].autoformat == false then return end
    if vim.b[bufnr].autoformat == nil and not vim.g.autoformat then return end
    -- retab: convert tabs to spaces according to buffer settings
    vim.api.nvim_buf_call(bufnr, function()
      vim.cmd.retab()
    end)
  end,
})

vim.keymap.set({ "n", "v" }, "<leader>ci", function()
  is_fix_mode = true
  require("conform").format({ timeout_ms = 3000, async = true }, function()
    is_fix_mode = false
  end)
end, { desc = "Format With Eslint" })

vim.keymap.set({ "n", "v" }, "<leader>cF", function()
  local name = ".prettierrc.json"
  if vim.api.nvim_get_option_value("shiftwidth", { buf = vim.api.nvim_get_current_buf() }) == 4 then
    name = ".prettierrc_tab.json"
  end
  vim.env.PRETTIERD_DEFAULT_CONFIG = vim.fn.expand("~") .. "/.config/" .. name
  require("conform").format({ formatters = { "injected" }, timeout_ms = 3000 })
end, { desc = "Format Injected Langs" })

-- ===================================================================
-- Nvim-lint
-- ===================================================================
local eslintd = { "eslint_d" }
vim.env.ESLINT_D_PPID = vim.fn.getpid()

require("lint").linters.eslint_d.args = vim.list_extend(require("lint").linters.eslint_d.args or {}, {
  "--config",
  function()
    return util.get_file_path(constant.ESLINT, { for_eslint = true, ensure_package = true })
  end,
})

require("lint").linters_by_ft = {
  javascript = eslintd,
  typescript = eslintd,
  typescriptreact = eslintd,
  javascriptreact = eslintd,
  svelte = eslintd,
  sh = { "bash" },
  zsh = { "zsh" },
  markdown = { "vale" },
}

-- Auto-lint on events
vim.api.nvim_create_autocmd({ "BufWritePost", "BufReadPost", "InsertLeave" }, {
  group = vim.api.nvim_create_augroup("nvim_lint", { clear = true }),
  callback = function()
    require("lint").try_lint()
  end,
})

-- ===================================================================
-- CodeCompanion (AI)
-- ===================================================================
local function get_prompt()
  return [[
    你是一位全能写作专家，精通各类专业写作场景，能够根据文本类型自动调整写作策略。

    ## 专业领域覆盖

    ### 学术写作
    - **学术论文**：研究论文、综述文章、学位论文
    - **期刊投稿**：符合不同期刊格式要求的稿件
    - **学术报告**：会议报告、学术演讲
    - **文献综述**：系统性文献分析和总结

    ### 技术写作
    - **技术文档**：API文档、用户手册、技术规范
    - **开发文档**：代码注释、架构说明、部署指南
    - **技术报告**：项目报告、技术评估、可行性分析
    - **操作手册**：步骤说明、故障排除、最佳实践

    ### 商业写作
    - **商业报告**：市场分析、商业计划、财务报告
    - **商务邮件**：正式邮件、商务函件、合作提案
    - **营销文案**：产品介绍、广告文案、宣传材料
    - **演示文稿**：PPT内容、演讲稿、会议纪要

    ### 创意写作
    - **文学创作**：小说、散文、诗歌
    - **内容创作**：博客文章、社交媒体内容
    - **剧本写作**：影视剧本、戏剧剧本
    - **新闻写作**：新闻报道、特写文章

    ## 写作原则

    ### 通用原则
    1. **结构清晰**：明确的引言-主体-结论结构
    2. **语言精准**：准确、专业的词汇和表达
    3. **逻辑严谨**：论点之间清晰的逻辑关系
    4. **风格一致**：全文风格和语调的一致性
    5. **读者导向**：考虑目标读者的背景和需求

    ### 类型特定原则
    - **学术写作**：客观严谨、引用规范、术语准确
    - **技术写作**：步骤清晰、示例实用、术语一致
    - **商业写作**：目标明确、说服力强、行动导向
    - **创意写作**：情感丰富、想象力强、语言优美

    ## 服务内容

    ### 文本分析
    - 分析文本结构和语言问题
    - 识别逻辑漏洞和表达不清之处
    - 评估目标读者适应性

    ### 改进建议
    - 提供具体的修改建议
    - 解释每处修改的理由
    - 保持原文核心信息和意图

    ### 润色优化
    - 提升语言流畅性和专业性
    - 优化句子结构和段落衔接
    - 确保符合写作规范和语法规则

    ## 工作流程
    1. **类型识别**：自动识别文本类型和写作目的
    2. **问题诊断**：分析文本的结构、逻辑、语言问题
    3. **策略制定**：根据文本类型制定相应的改进策略
    4. **具体修改**：提供详细的修改建议和示例
    5. **质量检查**：确保修改后的文本符合专业标准

    请充分发挥你的推理能力，根据用户提供的文本，自动识别其类型并应用相应的专业写作策略。
  ]]
end

local cc_strategy = { adapter = "deepseek", model = "deepseek-reasoner", opts = { system_prompt = get_prompt } }

require("codecompanion").setup({
  opts = { log_level = "OFF" },
  strategies = { chat = cc_strategy, inline = cc_strategy, cmd = cc_strategy },
  adapters = {
    http = {
      deepseek = function()
        return require("codecompanion.adapters").extend("deepseek", {
          env = { api_key = "cmd:echo $DEEPSEEK_API_KEY" },
          schema = {
            model = {
              default = "deepseek-reasoner",
              choices = {
                ["deepseek-reasoner"] = {
                  formatted_name = "DeepSeek Reasoner",
                  opts = { can_reason = true, can_use_tools = false },
                },
              },
            },
            max_tokens = { default = 8192 },
            temperature = { default = 0.7 },
            top_p = { default = 0.9 },
            frequency_penalty = { default = 0.1 },
            presence_penalty = { default = 0.1 },
          },
        })
      end,
    },
  },
})

vim.cmd([[cab cc CodeCompanion]])

vim.keymap.set("n", "<leader>ac", "", { desc = "codeCompanion" })
vim.keymap.set({ "n", "v" }, "<leader>acs", "<cmd>CodeCompanionActions<cr>", { desc = "CodeCompanion: Open Actions" })
vim.keymap.set({ "n", "v" }, "<leader>act", "<cmd>CodeCompanionChat Toggle<cr>", { desc = "CodeCompanion: Toggle" })
vim.keymap.set("v", "<leader>aca", "<cmd>CodeCompanionChat Add<cr>", { desc = "CodeCompanion: Add Selected Content" })

-- ===================================================================
-- Leetcode
-- ===================================================================
pcall(function()
  require("leetcode").setup({
    lang = "typescript",
    logging = false,
    picker = "snacks-picker",
    cn = { enabled = true },
    plugins = { non_standalone = true },
  })
end)

vim.keymap.set("n", "<leader>cUl", "", { desc = "leet code" })
vim.keymap.set("n", "<leader>cUlm", "<cmd>Leet<cr>", { desc = "Leet Code: Menu" })
vim.keymap.set("n", "<leader>cUla", "<cmd>Leet random<cr>", { desc = "Leet Code: Random" })
vim.keymap.set("n", "<leader>cUlc", "<cmd>Leet console<cr>", { desc = "Leet Code: Console" })
vim.keymap.set("n", "<leader>cUld", "<cmd>Leet desc<cr>", { desc = "Leet Code: Description" })
vim.keymap.set("n", "<leader>cUlh", "<cmd>Leet hints<cr>", { desc = "Leet Code: Hints" })
vim.keymap.set("n", "<leader>cUli", "<cmd>Leet info<cr>", { desc = "Leet Code: Info" })
vim.keymap.set("n", "<leader>cUll", "<cmd>Leet lang<cr>", { desc = "Leet Code: Language" })
vim.keymap.set("n", "<leader>cUlq", "<cmd>Leet tabs<cr>", { desc = "Leet Code: Tabs" })
vim.keymap.set("n", "<leader>cUlr", "<cmd>Leet run<cr>", { desc = "Leet Code: Run" })
vim.keymap.set("n", "<leader>cUls", "<cmd>Leet submit<cr>", { desc = "Leet Code: Submit" })
vim.keymap.set("n", "<leader>cUlt", "<cmd>Leet list<cr>", { desc = "Leet Code: List" })
vim.keymap.set("n", "<leader>cUly", "<cmd>Leet daily<cr>", { desc = "Leet Code: Daily" })

-- ===================================================================
-- Checkmate (Todo)
-- ===================================================================
require("checkmate").setup({
  files = { "*.md", "todo", "TODO", "*.todo" },
  todo_states = {
    unchecked = { marker = "[ ]" },
    checked = { marker = "[x]" },
  },
})

-- ===================================================================
-- UV.nvim (Python)
-- ===================================================================
if vim.fn.executable("uv") == 1 and vim.fn.executable("python3") == 1 then
  pcall(function()
    require("uv").setup({
      keymaps = { prefix = "<leader>cUu" },
      execution = {
        run_command = "uv run python3",
        notification_timeout = 10000,
      },
    })
  end)
end

