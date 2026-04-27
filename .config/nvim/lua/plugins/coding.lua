-- Coding plugin configurations

-- ===================================================================
-- Treesitter
-- ===================================================================
local language_map = { zsh = "bash", checkhealth = "markdown", mdx = "markdown" }
for from, to in pairs(language_map) do
  vim.treesitter.language.register(to, from)
end

-- Custom treesitter predicate: restrict query patterns to specific filetypes.
-- Used in after/queries/markdown/injections.scm to limit tsx injection to mdx
-- files only, avoiding expensive regex evaluation on every inline node in
-- regular markdown files.
vim.treesitter.query.add_predicate("is-filetype?", function(match, pattern, source, predicate)
  if type(source) ~= "number" then return false end
  return vim.bo[source].filetype == predicate[3]
end, { force = true })


-- Treesitter auto-start for all file buffers.
-- Neovim 0.12 built-in ftplugins only call vim.treesitter.start() for ~20
-- languages; this autocmd covers the rest.
local ts_group = vim.api.nvim_create_augroup("treesitter_start", { clear = true })

local function try_treesitter_start(buf)
  if not vim.api.nvim_buf_is_valid(buf) then return end
  if vim.bo[buf].buftype ~= "" then return end
  local ft = vim.bo[buf].filetype
  if not ft or ft == "" then return end
  local lang = vim.treesitter.language.get_lang(ft)
  if not lang then return end
  -- Verify highlight queries exist. Without them treesitter sets
  -- ts_highlight=true but renders nothing, blocking syntax fallback.
  local ok, query = pcall(vim.treesitter.query.get, lang, "highlights")
  if not ok or not query then
    -- No queries available. If treesitter was already started (e.g. by
    -- Snacks quickfile), stop it and restore syntax highlighting.
    if vim.b[buf].ts_highlight then
      pcall(vim.treesitter.stop, buf)
    end
    if vim.bo[buf].syntax == "" then
      vim.bo[buf].syntax = ft
    end
    return
  end
  pcall(vim.treesitter.start, buf, lang)
end

vim.api.nvim_create_autocmd("FileType", {
  group = ts_group,
  callback = function(ev)
    try_treesitter_start(ev.buf)
  end,
})

-- Safety net: start treesitter for buffers loaded before init finished
vim.api.nvim_create_autocmd("VimEnter", {
  group = ts_group,
  once = true,
  callback = function()
    for _, buf in ipairs(vim.api.nvim_list_bufs()) do
      if vim.api.nvim_buf_is_loaded(buf) and not vim.b[buf].ts_highlight then
        try_treesitter_start(buf)
      end
    end
  end,
})

-- ===================================================================
-- Treesitter Context
-- ===================================================================
require("treesitter-context").setup({ zindex = 25 })

vim.keymap.set("n", "gC", function()
  require("treesitter-context").go_to_context()
end, { desc = "Goto Super Scope" })

-- ===================================================================
-- Blink (completion)
-- ===================================================================
local function get_by_cmdtype(search_val, cmd_val, default)
  local cmdtype = vim.fn.getcmdtype()
  if vim.list_contains({ "/", "?" }, cmdtype) then return search_val end
  if vim.list_contains({ ":", "@" }, cmdtype) then return cmd_val end
  return default
end

require("blink.cmp").setup({
  completion = {
    accept = {
      auto_brackets = { enabled = true },
    },
    menu = {
      border = "rounded",
      scrollbar = false,
      direction_priority = { "n", "s" },
      cmdline_position = function()
        local pos = vim.g.ui_cmdline_pos
        if pos then return { pos[1] + get_by_cmdtype(-1, 0, 0), pos[2] } end
        local ch = vim.o.cmdheight
        local height = (ch == 0) and 1 or ch
        return { vim.o.lines - height, 0 }
      end,
      draw = {
        treesitter = { "lsp" },
        columns = { { "label", "label_description", gap = 1 }, { "kind_icon", "kind" }, { "source_name" } },
      },
    },
    documentation = {
      auto_show = true,
      auto_show_delay_ms = 200,
      window = { border = "rounded" },
    },
  },
  signature = { window = { border = "rounded" } },
  sources = {
    default = { "lsp", "path", "snippets", "buffer" },
    per_filetype = { lua = { inherit_defaults = true, "lazydev" } },
    providers = {
      lazydev = {
        name = "LazyDev",
        module = "lazydev.integrations.blink",
        score_offset = 100,
      },
      snippets = {
        min_keyword_length = 1,
        opts = {
          search_paths = { vim.fn.stdpath("config") .. "/snippets" },
          extended_filetypes = {
            mdx = { "javascript", "javascriptreact", "typescript", "typescriptreact", "html" },
          },
        },
      },
      buffer = { min_keyword_length = 2 },
      path = {
        opts = {
          label_trailing_slash = true,
          show_hidden_files_by_default = true,
        },
      },
    },
  },
  cmdline = {
    keymap = {
      preset = "cmdline",
      ["<c-l>"] = { "show", "fallback" },
      ["<c-e>"] = { "cancel", "fallback" },
    },
    sources = {
      default = function()
        return get_by_cmdtype({ "buffer" }, { "cmdline", "lsp" }, {})
      end,
    },
    completion = {
      menu = {
        auto_show = function(ctx)
          return vim.fn.getcmdtype() == ":"
        end,
      },
      ghost_text = {
        enabled = function()
          return get_by_cmdtype(true, false, false)
        end,
      },
    },
  },
  keymap = {
    preset = "enter",
    ["<C-y>"] = { "select_and_accept" },
    ["<c-l>"] = { "show", "fallback" },
  },
  fuzzy = {
    implementation = "rust",
  },
})

vim.keymap.set("n", "<leader>c/", "<cmd>%s/\\r//g<cr>", { desc = "Remove All Enter Character" })

-- ===================================================================
-- Mini.pairs
-- ===================================================================
local pairs_config = { markdown = true }
require("mini.pairs").setup({
  modes = { insert = true, command = true, terminal = false },
  skip_next = [=[[%w%%%'%[%"%.%`%$]]=],
  skip_ts = { "string" },
  skip_unbalanced = true,
})

-- Override mini.pairs open for markdown triple backtick
local mp = require("mini.pairs")
local mp_open = mp.open
mp.open = function(pair, neigh_pattern)
  local o = pair:sub(1, 1)
  local line = vim.api.nvim_get_current_line()
  local cursor = vim.api.nvim_win_get_cursor(0)
  local before = line:sub(1, cursor[2])
  if pairs_config.markdown and o == "`" and vim.list_contains(vim.g.markdowns, vim.bo.filetype) and before:match("^%s*``") then
    return "`\n```" .. vim.api.nvim_replace_termcodes("<up>", true, true, true)
  end
  return mp_open(pair, neigh_pattern)
end

-- ===================================================================
-- Mini.ai
-- ===================================================================
local ai = require("mini.ai")
require("mini.ai").setup({
  n_lines = 500,
  custom_textobjects = {
    o = ai.gen_spec.treesitter({ -- code block
      a = { "@block.outer", "@conditional.outer", "@loop.outer" },
      i = { "@block.inner", "@conditional.inner", "@loop.inner" },
    }),
    f = ai.gen_spec.treesitter({ a = "@function.outer", i = "@function.inner" }),
    c = ai.gen_spec.treesitter({ a = "@class.outer", i = "@class.inner" }),
    t = { "<([%p%w]-)%f[^<%w][^<>]->.-</%1>", "^<.->().*()</[^/]->$" },
    d = { "%f[%d]%d+" },
    e = {
      { "%u[%l%d]+%f[^%l%d]", "%f[%S][%l%d]+%f[^%l%d]", "%f[%P][%l%d]+%f[^%l%d]", "^[%l%d]+%f[^%l%d]" },
      "^().*()$",
    },
    u = ai.gen_spec.function_call(),
    U = ai.gen_spec.function_call({ name_pattern = "[%w_]" }),
  },
})

-- ===================================================================
-- Mini.surround
-- ===================================================================
require("mini.surround").setup({
  -- Use gs prefix (consistent with which-key group defined in editor.lua)
  mappings = {
    add = "gsa",
    delete = "gsd",
    find = "gsf",
    find_left = "gsF",
    highlight = "gsh",
    replace = "gsr",
    update_n_lines = "gsn",
  },
})

-- ===================================================================
-- nvim-ts-autotag (auto close/rename HTML/JSX/Vue/Svelte tags)
-- ===================================================================
require("nvim-ts-autotag").setup({})

-- ===================================================================
-- Render Markdown
-- ===================================================================
local anti_conceal = { enabled = false }

require("render-markdown").setup({
  render_modes = { "n", "c", "t", "i" },
  preset = "none",
  file_types = vim.g.markdowns,
  completions = { blink = { enabled = false } },
  paragraph = { render_modes = true },
  document = { render_modes = true },
  indent = { enabled = false },
  dash = { render_modes = true },
  bullet = { render_modes = true },
  quote = { render_modes = true },
  pipe_table = { render_modes = true },
  link = { render_modes = true },
  inline_highlight = { render_modes = true },
  heading = {
    sign = true,
    render_modes = true,
    icons = { "󰎥 ", "󰎨 ", "󰎫 ", "󰎲 ", "󰎯 ", "󰎴 " },
  },
  code = { width = "full", render_modes = true },
  checkbox = { enabled = true, render_modes = true },
  overrides = {
    buflisted = { [false] = { anti_conceal = anti_conceal } },
    buftype = { nofile = { anti_conceal = anti_conceal } },
  },
  latex = {
    enabled = vim.fn.executable("latex2text") == 1,
    render_modes = true,
  },
  html = {
    tag = { think = { icon = "󰛨 ", highlight = "Normal" } },
    render_modes = true,
  },
  on = {
    render = function(context)
      local bufnr = context.buf
      local buflisted = vim.bo[bufnr].buflisted
      local buftype = vim.bo[bufnr].buftype
      if buflisted and buftype ~= "nofile" then return end
      local modifiable = vim.bo[bufnr].modifiable
      if not modifiable then return end
      require("render-markdown.state").get(bufnr).anti_conceal.enabled = true
    end,
  },
})

-- ===================================================================
-- Lazydev (Lua/Neovim config development support)
-- ===================================================================
pcall(function()
  require("lazydev").setup({
    library = {
      { path = "${3rd}/luv/library", words = { "vim%.uv" } },
      { path = "snacks.nvim", words = { "Snacks" } },
    },
  })
end)

-- ===================================================================
-- TS Worksheet
-- ===================================================================
vim.keymap.set("n", "<leader>ce", function()
  local bufnr = vim.api.nvim_get_current_buf()
  if vim.bo[bufnr].modified then
    vim.cmd.write()
  end
  local opt = { bufnr = bufnr }
  if not vim.diagnostic.is_enabled(opt) then
    vim.diagnostic.enable(true, opt)
  end
  vim.cmd.Tsw("rt=bun show_order=true")
end, { desc = "Run this js/ts file" })

pcall(function()
  require("ts-worksheet").setup({
    severity = vim.diagnostic.severity.INFO,
  })
end)
