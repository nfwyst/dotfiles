DATA_PATH = vim.fn.stdpath("data")
CONFIG_PATH = vim.fn.stdpath("config")
HOME_PATH = vim.fn.expand("~")
AUTOCMD = vim.api.nvim_create_autocmd
AUTOGROUP = vim.api.nvim_create_augroup
IS_LEETING = false
HAS_API_KEY = not not os.getenv("DEEPSEEK_API_KEY")
SCHEME_BACKGROUND = "dark"
MAX_FILE_LENGTH = 5000
OS = jit.os
IS_MAC = OS == "OSX"
DEFAULT_COLORSCHEME = "tokyonight"
MAX_BUFFER_NUM = 7
BUFFER_OPENED_TIME = {}
VERSION = vim.version()
CURSOR_HILIGHT_OPTS = {
  Cursor = { bg = "#5f87af", ctermbg = 67, blend = 0 },
  iCursor = { bg = "#ffffaf", ctermbg = 229 },
  rCursor = { bg = "#d70000", ctermbg = 124 },
}

--- Manual open debug from command line
if DAP_DEBUG_ENABLED == nil then
  DAP_DEBUG_ENABLED = false
end

function GEN_PATH(path)
  return vim.fn.fnamemodify(path, ":p")
end

OBSIDIAN_DIR = GEN_PATH(HOME_PATH .. "/Documents/Obsidian/personal")
OBSIDIAN_WORK_DIR = GEN_PATH(HOME_PATH .. "/Documents/Obsidian/work")
LAZY_PATH = DATA_PATH .. GEN_PATH("/lazy/lazy.nvim")
SNIPPET_PATH = CONFIG_PATH .. GEN_PATH("/snippets")

TSX_COMMENT_INCLUDED_FILES = {
  "javascriptreact",
  "typescriptreact",
  "javascript",
  "typescript",
}

LSP_SERVERS = {
  "jsonls",
  "lua_ls",
  "ts_ls",
  "cssls",
  "gopls",
  "html",
  "yamlls",
  "tailwindcss",
  "marksman",
  "svelte",
  "bashls",
}

INVALID_CURSORLINE_FILETYPE = {
  "TelescopePrompt",
  "DressingInput",
  "DressingSelect",
  "toggleterm",
  "noice",
  "notify",
  "WhichKey",
  "Avante",
  "AvanteInput",
  "",
  nil,
}

INVALID_FILETYPE = {
  "NvimTree",
  "alpha",
  "qf",
  "help",
  "man",
  "lspinfo",
  "gitcommit",
  "TelescopePrompt",
  "DressingInput",
  "DressingSelect",
  "grug-far",
  "Trouble",
  "toggleterm",
  "lazy",
  "noice",
  "notify",
  "NeogitStatus",
  "NeogitCommitMessage",
  "NeogitLogView",
  "NeogitCommitView",
  "DiffviewFiles",
  "DiffviewFileHistory",
  "mason",
  "WhichKey",
  "TelescopeResults",
  "Avante",
  "harpoon",
  "",
  nil,
}

TREESITTER_ENSURE_INSTALL = {
  "markdown",
  "markdown_inline",
  "bash",
  "html",
  "json",
  "jsdoc",
  "jsonc",
  "javascript",
  "typescript",
  "tsx",
  "css",
  "scss",
  "regex",
  "yaml",
  "go",
  "lua",
  "svelte",
  "latex",
}

TELESCOPE_IGNORE_PATTERNS = {
  "^.git/",
  "^.dart_tool/",
  "^.github/",
  "^.gradle/",
  "^.idea/",
  "^.settings/",
  "^.vscode/",
  "^.umi/",
  "^.cache/",
  "^.husky/",
  "^.vale/",
  "^smalljre_*/*",
  "^build/*",
  "^lib/*",
  "^env/*",
  "^vendor/*",
  "^dist/*",
  "^temp/*",
  "^gradle/*",
  "^target/*",
  "^node_modules/*",
  "^__snapshots__/*",
  "^__pycache__/*",
  "%.webp",
  "%.lock",
  "%-lock.yaml",
  "%-lock.json",
  "%.sqlite3",
  "%.ipynb",
  "%.jpg",
  "%.jpeg",
  "%.png",
  "%.svg",
  "%.otf",
  "%.ttf",
  "%.pdb",
  "%.dll",
  "%.class",
  "%.exe",
  "%.map",
  "%.cache",
  "%.ico",
  "%.pdf",
  "%.dylib",
  "%.jar",
  "%.docx",
  "%.min.js",
}

PROJECT_PATTERNS = {
  "_darcs",
  ".hg",
  ".bzr",
  ".svn",
  "Makefile",
  "webpack.*js",
  "node_modules",
  "stylua.toml",
  "tsconfig.json",
  ".git",
}

LSP_SYMBOLS = {
  "All",
  "Text",
  "Method",
  "Function",
  "Constructor",
  "Field",
  "Variable",
  "Class",
  "Interface",
  "Module",
  "Property",
  "Unit",
  "Value",
  "Enum",
  "Keyword",
  "Snippet",
  "Color",
  "File",
  "Reference",
  "Folder",
  "EnumMember",
  "Constant",
  "Struct",
  "Event",
  "Operator",
  "TypeParameter",
}

KEYMAP_EXCLUDE_FTS = {
  ["<c-o>"] = { "qf" },
  ["<c-i>"] = { "qf" },
  ["<leader>f"] = { "qf" },
  ["<leader>F"] = { "qf" },
  ["<leader>r"] = { "qf" },
  ["<leader>R"] = { "qf" },
}

local function defaulter(f, default_opts)
  default_opts = default_opts or {}
  return {
    new = function(options)
      local conf = require("telescope.config").values
      if conf.preview == false and not options.preview then
        return false
      end
      options.preview = type(options.preview) ~= "table" and {}
        or options.preview
      if type(conf.preview) == "table" then
        for k, v in pairs(conf.preview) do
          options.preview[k] = vim.F.if_nil(options.preview[k], v)
        end
      end
      return f(options)
    end,
    __call = function()
      local ok, err = pcall(f(default_opts))
      if not ok then
        error(debug.traceback(err))
      end
    end,
  }
end

function highlight_row(bufnr, row)
  vim.api.nvim_buf_add_highlight(bufnr, -1, "CursorLine", row - 1, 0, -1)
end

PREVIEWER = defaulter(function(options)
  local previewers = require("telescope.previewers")
  local from_entry = require("telescope.from_entry")
  local conf = require("telescope.config").values
  return previewers.new_buffer_previewer({
    define_preview = function(self, entry)
      local winid = self.state.winid
      local bufnr = self.state.bufnr
      local parsed_entry = entry
      local row = nil
      if options.entry_parser then
        parsed_entry, row = options.entry_parser(entry)
      end
      local filepath = from_entry.path(parsed_entry, true, false)
      if filepath == nil or filepath == "" then
        return
      end
      conf.buffer_previewer_maker(filepath, bufnr, {
        bufname = self.state.bufname,
        winid = winid,
        preview = options.preview,
        file_encoding = options.file_encoding,
      })
      if not row then
        return
      end
      SET_TIMEOUT(function()
        highlight_row(bufnr, row)
        local win_height = GET_VIEWPORT_HEIGHT(winid)
        row = row - 1 - math.floor(win_height / 2)
        if row <= 0 then
          return
        end
        vim.api.nvim_win_call(winid, function()
          vim.cmd.normal({ row .. "", bang = true })
        end)
      end, 50)
    end,
  })
end, {})

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
请记住，你的目标不仅是帮助我编写正确的代码，而且要帮助我理解基本原理并提高我的编程技能。
始终努力在你的回复中做到清晰、耐心和鼓励。
]]

ESLINT_CONFIG_NAMES = {
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
