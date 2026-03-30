-- UI plugin configurations
local util = require("config.util")

-- ===================================================================
-- Snacks
-- ===================================================================
local header = [[
███╗   ██╗███████╗ ██████╗ ██╗   ██╗██╗███╗   ███╗
████╗  ██║██╔════╝██╔═══██╗██║   ██║██║████╗ ████║
██╔██╗ ██║█████╗  ██║   ██║██║   ██║██║██╔████╔██║
██║╚██╗██║██╔══╝  ██║   ██║╚██╗ ██╔╝██║██║╚██╔╝██║
██║ ╚████║███████╗╚██████╔╝ ╚████╔╝ ██║██║ ╚═╝ ██║
╚═╝  ╚═══╝╚══════╝ ╚═════╝   ╚═══╝  ╚═╝╚═╝     ╚═╝
]]

local function pad_str(str, length, pad_char, is_to_start)
  local len = length - #str
  if len <= 0 then
    return str
  end
  local rep_str = string.rep(pad_char, len)
  if is_to_start then
    return rep_str .. str
  end
  return str .. rep_str
end

local align = "center"
local handle = io.popen("fortune")
if handle then
  align = "left"
  header = handle:read("*a")
  handle:close()
  local max_length = 0
  local lines = vim.split(header, "\n", { trimempty = true })
  for index, line in ipairs(lines) do
    local new_line = line:gsub("\t", "")
    lines[index] = new_line
    if #new_line > max_length then
      max_length = #new_line
    end
  end
  local total_rows = #lines
  for index, line in ipairs(lines) do
    local is_author_line = index > 1 and index == total_rows
    lines[index] = pad_str(line, max_length, " ", is_author_line)
  end
  header = table.concat(lines, "\n")
end

local exclude = {
  "**/.git/*",
  "node_modules",
  "dist",
  "log",
  ".vscode",
  ".DS_Store",
  "thumbs.db",
}

local function gen_get_todo(global)
  return function()
    local todopath = vim.g.todopath
    if not global then
      todopath = util.git_root() .. "/.todo.md"
    end
    local root = vim.fs.dirname(todopath)
    if vim.fn.filereadable(todopath) == 0 then
      vim.fn.mkdir(root, "p")
    end
    Snacks.scratch.open({ ft = "markdown", file = todopath })
  end
end

require("snacks").setup({
  dashboard = {
    preset = { header = header },
    formats = { header = { align = align } },
    sections = {
      { section = "header" },
      { section = "keys", gap = 1, padding = 1 },
      -- startup section removed: requires lazy.nvim (we use vim.pack)
    },
  },
  animate = { enabled = vim.g.snacks_animate, fps = 120 },
  scope = { debounce = 45 },
  bigfile = { enabled = true },
  quickfile = { enabled = true },
  scroll = { enabled = true },
  indent = { enabled = true },
  input = { enabled = true },
  notifier = { enabled = true },
  statuscolumn = { enabled = true },
  words = { enabled = true },
  lazygit = { enabled = true },
  styles = {
    notification = { wo = { wrap = true } },
    terminal = { wo = { winbar = "" }, border = "rounded" },
    scratch = { width = 0.88, height = 0.88 },
  },
  dim = { enabled = true },
  image = { enabled = true },
  picker = {
    hidden = true,
    ignored = true,
    exclude = exclude,
    actions = {
      toggle_cwd = function(p)
        local root = vim.fs.normalize(require("config.util").root())
        local cwd = vim.fs.normalize(vim.uv.cwd() or ".")
        local current = p:cwd()
        p:set_cwd(current == root and cwd or root)
        p:find()
      end,
    },
    icons = {
      git = {
        added = " + ",
        modified = "  ",
        deleted = " 󰗨 ",
        renamed = " 󰹳 ",
        untracked = "  ",
        ignored = "  ",
        staged = " 󰆺 ",
        unmerged = " 󰆑 ",
      },
    },
    layout = {
      preset = "vertical",
      layout = { width = 0.88, height = 0.88 },
    },
    formatters = { file = { truncate = 160 } },
    sources = {
      files = { hidden = true, ignored = true, exclude = exclude },
      explorer = {
        follow_file = true,
        diagnostics = false,
        title = "",
        layout = {
          hidden = { "input" },
          auto_hide = { "input" },
          layout = { width = 50, position = "right" },
        },
        win = {
          list = {
            keys = {
              ["/"] = { "toggle_input", mode = { "n" } },
            },
          },
          input = {
            keys = {
              ["<Esc>"] = { "toggle_input", mode = { "n", "i" } },
            },
          },
        },
      },
    },
    win = {
      input = {
        keys = {
          ["<a-c>"] = { "toggle_cwd", mode = { "i", "n" } },
          ["<c-e>"] = { "toggle_hidden", mode = { "i", "n" } },
          ["<c-r>"] = { "toggle_ignored", mode = { "i", "n" } },
        },
      },
      list = {
        keys = {
          ["<c-e>"] = "toggle_hidden",
          ["<c-r>"] = "toggle_ignored",
        },
      },
    },
  },
})

-- Set statuscolumn after snacks is loaded (must not be in options.lua,
-- otherwise first-launch vim.pack install triggers redraw before snacks exists)
vim.opt.statuscolumn = [[%!v:lua.require'snacks.statuscolumn'.get()]]

-- Snacks keymaps for todos
vim.keymap.set("n", "<leader>T", "", { desc = "Checkmate [T]odos" })
vim.keymap.set("n", "<leader>T.", gen_get_todo(true), { desc = "Toggle Scratch Todo" })
vim.keymap.set("n", "<leader>Tl", gen_get_todo(false), { desc = "Toggle Local Scratch Todo" })

-- ===================================================================
-- Noice
-- ===================================================================
require("noice").setup({
  lsp = {
    override = {
      ["vim.lsp.util.convert_input_to_markdown_lines"] = true,
      ["vim.lsp.util.stylize_markdown"] = true,
      ["cmp.entry.get_documentation"] = true,
    },
  },
  presets = {
    bottom_search = true,
    command_palette = true,
    long_message_to_split = true,
  },
  routes = {
    {
      filter = {
        event = "msg_show",
        any = {
          { find = "; after #%d+" },
          { find = "; before #%d+" },
          { find = "%d fewer lines" },
          { find = "%d more lines" },
          { find = "%d+L, %d+B" },
          { find = "%d+ lines " },
          { find = "Installed %d+/%d+ languages" },
          { find = "Parser not available for language" },
          { find = "Pattern not found:" },
          { find = "E211: File" },
          { find = "Check log for errors:" },
        },
      },
    },
    {
      filter = {
        event = "notify",
        any = {
          { find = "No information available" },
          { find = "This command may require a client extension" },
          { find = "vim/shared.lua:0: invalid" },
          { find = "watch.watch: ENOENT: no such file or directory" },
          { find = "shared.lua:0" },
        },
      },
    },
  },
  views = {
    hover = {
      scrollbar = true,
      border = { style = "rounded", padding = { 0, 1 } },
      size = { width = "auto", max_width = vim.o.columns - 4 },
      position = { row = 2, col = 2 },
    },
    cmdline_popup = {
      size = { width = "auto", max_width = vim.o.columns - 4 },
    },
  },
  messages = { view_search = false },
  throttle = 1000 / 120,
})

-- Noice keymaps
vim.keymap.set("c", "<S-Enter>", function()
  require("noice").redirect(vim.fn.getcmdline())
end, { desc = "Redirect Cmdline" })
vim.keymap.set("n", "<leader>snl", function()
  require("noice").cmd("last")
end, { desc = "Noice Last Message" })
vim.keymap.set("n", "<leader>snh", function()
  require("noice").cmd("history")
end, { desc = "Noice History" })
vim.keymap.set("n", "<leader>sna", function()
  require("noice").cmd("all")
end, { desc = "Noice All" })
vim.keymap.set("n", "<leader>snd", function()
  require("noice").cmd("dismiss")
end, { desc = "Dismiss All" })
vim.keymap.set("n", "<leader>snt", function()
  if Snacks and Snacks.picker then
    Snacks.picker.notifications()
  else
    require("noice").cmd("history")
  end
end, { desc = "Noice Picker" })
vim.keymap.set({ "i", "n", "s" }, "<c-f>", function()
  if not require("noice.lsp").scroll(4) then
    return "<c-f>"
  end
end, { silent = true, expr = true, desc = "Scroll Forward" })
vim.keymap.set({ "i", "n", "s" }, "<c-b>", function()
  if not require("noice.lsp").scroll(-4) then
    return "<c-b>"
  end
end, { silent = true, expr = true, desc = "Scroll Backward" })

-- ===================================================================
-- Lualine
-- ===================================================================
local icons = util.icons

local function lsp_names()
  local clients = vim.lsp.get_clients({ bufnr = vim.api.nvim_get_current_buf() })
  local names = {}
  for _, client in pairs(clients) do
    names[#names + 1] = client.name:match("([^_]+)")
  end
  return names
end

local function lsp_info()
  local names = lsp_names()
  local result = table.concat(names, "•")
  if result == "" then
    return ""
  end
  return "󱓞 " .. result
end

local function file_cond()
  if vim.bo.buftype == "nofile" then
    return false
  end
  local bufname = vim.api.nvim_buf_get_name(vim.api.nvim_get_current_buf())
  return string.match(bufname, "^/.*[%a]+$") ~= nil
end

local function root_dir_component()
  local root = util.root()
  if not root then
    return ""
  end
  return " " .. vim.fn.fnamemodify(root, ":t")
end

local filename = {
  "filename",
  file_status = false,
  newfile_status = true,
  path = 3,
  shorting_target = 0,
  symbols = { modified = "", readonly = "󰌾", unnamed = "[No Name]", newfile = "[New]" },
  color = function()
    local hl = vim.api.nvim_get_hl(0, { name = "Special" })
    return { fg = hl.fg and string.format("#%06x", hl.fg), italic = true }
  end,
  cond = file_cond,
  padding = 0,
}

vim.o.laststatus = 3
require("lualine").setup({
  options = {
    theme = "auto",
    ignore_focus = { "neo-tree", "Avante", "AvanteInput", "codecompanion" },
    component_separators = { left = " ▎", right = " ▎" },
  },
  sections = {
    lualine_a = { "mode" },
    lualine_b = {
      {
        "branch",
        fmt = function(branch)
          if not branch or branch == "" then
            return ""
          end
          if vim.g.prev_git_branch and vim.g.prev_git_branch ~= branch then
            vim.schedule(function()
              local clients = vim.lsp.get_clients()
              if #clients > 0 then
                for _, client in ipairs(clients) do
                  client:stop()
                end
                vim.cmd("doautocmd FileType")
                vim.notify("LSP servers restarted")
              end
            end)
          end
          vim.g.prev_git_branch = branch
          return branch
        end,
      },
    },
    lualine_c = {
      { root_dir_component, padding = { left = 0, right = 0 } },
      { lsp_info, padding = 0 },
      {
        "diagnostics",
        update_in_insert = false,
        cond = function()
          return vim.diagnostic.is_enabled({ bufnr = vim.api.nvim_get_current_buf() })
        end,
        symbols = {
          error = icons.diagnostics.Error,
          warn = icons.diagnostics.Warn,
          info = icons.diagnostics.Info,
          hint = icons.diagnostics.Hint,
        },
        padding = 0,
      },
    },
    lualine_x = {
      {
        require("config.price").get_display_text,
        color = function()
          local normal = vim.api.nvim_get_hl(0, { name = "Normal" })
          local bg = normal.bg
          if not bg then
            bg = vim.o.background == "dark" and 0x24283b or 0xe1e2e7
          end
          local contrast = vim.o.background == "dark" and 0xFFFFFF or 0x000000
          local r = math.floor(math.floor(bg / 65536) * 0.8 + math.floor(contrast / 65536) * 0.2)
          local g = math.floor(math.floor(bg / 256) % 256 * 0.8 + math.floor(contrast / 256) % 256 * 0.2)
          local b = math.floor(bg % 256 * 0.8 + contrast % 256 * 0.2)
          return { fg = string.format("#%02x%02x%02x", r, g, b) }
        end,
        padding = { left = 0, right = 1 },
      },
    },
    lualine_y = {
      { "filetype", colored = false, icon_only = false, padding = 0 },
      {
        "selectioncount",
        fmt = function(val)
          return "󰆐 " .. val .. " selected"
        end,
        cond = function()
          local mode = vim.api.nvim_get_mode().mode
          return vim.list_contains({ "v", "V", "\x16" }, mode)
        end,
        padding = 0,
      },
      {
        function()
          return "󱁐:" .. vim.api.nvim_get_option_value("shiftwidth", { buf = vim.api.nvim_get_current_buf() })
        end,
        padding = 0,
      },
      { "encoding", padding = { left = 0, right = 1 } },
    },
    lualine_z = {
      { "progress", separator = " ", padding = { left = 1, right = 0 } },
      { "location", padding = { left = 0, right = 1 } },
    },
  },
  winbar = {
    lualine_c = {
      filename,
      {
        function()
          local search_info = vim.fn.searchcount()
          local content = vim.fn.getreg("/")
          content = content:gsub("\\[<>V]", "")
          if search_info.total == 0 then
            return " " .. content .. ": no result"
          end
          return " " .. content .. ": " .. search_info.current .. "󰿟" .. search_info.total
        end,
        cond = function()
          return vim.v.hlsearch > 0 and file_cond()
        end,
        color = function()
          local hl = vim.api.nvim_get_hl(0, { name = "Constant" })
          return { fg = hl.fg and string.format("#%06x", hl.fg) }
        end,
        padding = 0,
      },
    },
  },
  inactive_winbar = {
    lualine_c = { filename },
  },
})

-- ===================================================================
-- Bufferline
-- ===================================================================
-- Bufferline keymaps
vim.keymap.set("n", "<leader>bp", "<cmd>BufferLineTogglePin<cr>", { desc = "Toggle Pin" })
vim.keymap.set("n", "<leader>bP", "<cmd>BufferLineGroupClose ungrouped<cr>", { desc = "Delete Non-Pinned Buffers" })
vim.keymap.set("n", "<leader>br", "<cmd>BufferLineCloseRight<cr>", { desc = "Delete Buffers to the Right" })
vim.keymap.set("n", "<leader>bl", "<cmd>BufferLineCloseLeft<cr>", { desc = "Delete Buffers to the Left" })
vim.keymap.set("n", "<leader>bj", "<cmd>BufferLinePick<cr>", { desc = "Pick Buffer" })
vim.keymap.set("n", "[B", "<cmd>BufferLineMovePrev<cr>", { desc = "Move buffer prev" })
vim.keymap.set("n", "]B", "<cmd>BufferLineMoveNext<cr>", { desc = "Move buffer next" })

require("bufferline").setup({
  options = {
    diagnostics = false,
    show_buffer_icons = false,
    always_show_bufferline = false,
    truncate_names = false,
    max_prefix_length = 30,
    -- offsets = { { filetype = "snacks_layout_box" } },
    name_formatter = function(bufinfo)
      local name = bufinfo.name or ""
      if name:match("^index$") or name:match("^index%..+") then
        local path = bufinfo.path or ""
        local parent = vim.fn.fnamemodify(path, ":h:t")
        if parent == "" or parent == "." then
          return name
        end
        return parent .. "/" .. name
      end
      return name
    end,
  },
})

-- ===================================================================
-- Vimade
-- ===================================================================
require("vimade").setup({
  fadelevel = 0.7,
  recipe = { "duo", { animate = true } },
  tint = function()
    local is_dark = vim.o.background == "dark"
    local rgb = is_dark and { 255, 255, 255 } or { 0, 0, 0 }
    return {
      bg = { rgb = rgb, intensity = 0.2 },
      fg = { rgb = rgb, intensity = 0.2 },
    }
  end,
  blocklist = {
    custom = {
      buf_opts = {
        filetype = { "snacks_terminal", "opencode_terminal" },
        buftype = { "terminal" },
      },
    },
  },
})

vim.defer_fn(function()
  pcall(vim.cmd.VimadeFadeActive)
end, 500)


vim.keymap.set("n", "<leader>uv", "<cmd>VimadeToggle<cr>", { desc = "Vimade: Toggle" })
