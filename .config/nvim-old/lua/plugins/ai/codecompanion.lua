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

local strategy = { adapter = "deepseek", model = "deepseek-reasoner", opts = { system_prompt = get_prompt } }

return {
  "olimorris/codecompanion.nvim",
  dependencies = {
    "nvim-lua/plenary.nvim",
    "nvim-treesitter/nvim-treesitter",
  },
  keys = {
    { "<leader>ac", "", desc = "codeCompanion" },
    { "<leader>acs", "<cmd>CodeCompanionActions<cr>", mode = { "n", "v" }, desc = "CodeCompanion: Open Actions" },
    { "<leader>act", "<cmd>CodeCompanionChat Toggle<cr>", mode = { "n", "v" }, desc = "CodeCompanion: Toggle" },
    { "<leader>aca", "<cmd>CodeCompanionChat Add<cr>", mode = "v", desc = "CodeCompanion: Add Selected Content" },
  },
  opts = {
    opts = { log_level = "OFF" },
    strategies = { chat = strategy, inline = strategy, cmd = strategy },
    adapters = {
      http = {
        deepseek = function()
          return require("codecompanion.adapters").extend("deepseek", {
            env = { api_key = "DEEPSEEK_API_KEY" },
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
  },
  init = function()
    vim.cmd([[cab cc CodeCompanion]])
  end,
}
