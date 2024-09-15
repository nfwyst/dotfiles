DATA_PATH = vim.fn.stdpath("data")
CONFIG_PATH = vim.fn.stdpath("config")
HOME_PATH = vim.fn.expand("~")
AUTOCMD = vim.api.nvim_create_autocmd
AUTOGROUP = vim.api.nvim_create_augroup
WORKSPACE_PATH = vim.uv.cwd()
SCHEME_BACKGROUND = "dark"
MAX_FILE_LENGTH = 5000
MAX_FILE_SIZE = 0.125 -- MiB
HAS_OPENAI_KEY = vim.env.OPENAI_API_KEY ~= nil
BIGFILES = {}
OS = jit.os
IS_MAC = OS == "OSX"
DEFAULT_COLORSCHEME = "tokyonight"
MAX_BUFFER_NUM = 6
BUFFER_OPENED_TIME = {}
LSP_DOC_WIDTH = 60
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

--- Manual mode doesn't automatically change root directory
if MANUAL_MODE == nil then
  MANUAL_MODE = false
end

function GEN_PATH(path)
  return vim.fn.fnamemodify(path, ":p")
end

NOTE_DIR = GEN_PATH(HOME_PATH .. "/Documents/notes")
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
  "cssls",
  "gopls",
  "html",
  "yamlls",
  "tailwindcss",
  "marksman",
  "svelte",
  "bashls",
}

INVALID_FILETYPE = {
  "NvimTree",
  "alpha",
  "dashboard",
  "qf",
  "help",
  "man",
  "lspinfo",
  "gitcommit",
  "TelescopePrompt",
  "DressingInput",
  "DressingSelect",
  "spectre_panel",
  "startify",
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
  "Outline",
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

BUFFER_SCOPE_OPTIONS = {
  "tabstop",
  "shiftwidth",
  "softtabstop",
  "buflisted",
}

KEYMAP_EXCLUDE_FTS = {
  ["<c-o>"] = { "qf" },
  ["<c-i>"] = { "qf" },
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
      if row == nil then
        return
      end
      SET_TIMEOUT(function()
        HIGHLIGHT_ROW(bufnr, row)
        local win_height = GET_VIEWPORT_HEIGHT(winid)
        row = row - 1 - math.floor(win_height / 2)
        if row <= 0 then
          return
        end
        vim.api.nvim_win_call(winid, function()
          vim.cmd([[normal! ]] .. row .. [[]])
        end)
      end, 20)
    end,
  })
end, {})
