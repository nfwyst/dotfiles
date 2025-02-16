<!--toc:start-->

- [💤 perfect-neovim-config](#💤-perfect-neovim-config)
- [Requirements](#requirements)
- [Optional dependencies](#optional-dependencies)
- [Install](#install)
- [Use](#use)
- [Features](#features)
- [Nerd Font](#nerd-font)
- [Vscode integration](#vscode-integration)
- [Custom snippets](#custom-snippets)
  - [create snippets template](#create-snippets-template)
- [find and replace all](#find-and-replace-all)
<!--toc:end-->

# 💤 perfect-neovim-config

make neovim as a perfect ide for development

# Requirements

1. nodejs
2. neovim 0.9+
3. gitui -- awesome ui for git
4. ncdu -- list file by size
5. htop -- an interactive process viewer
6. python3
7. gzip
8. wget
9. rust
10. tree-sitter -- for parser generator
11. sed -- for formatter to use
12. ripgrep -- for telescope to work
13. go
14. delta -- syntax highlighted git pager for git status previews
15. magick -- show image

# Optional dependencies

1. prettier -- js/ts formatter
2. black -- python formatter
3. stylua -- lua formatter
4. clang_format -- c/c++ formatter
5. eslint -- js/ts diagnostic
6. fortune -- show a random quotation from a collection of quotes in alpha dashboard
7. shfmt -- sehll formater `go install mvdan.cc/sh/v3/cmd/shfmt@latest`, then set environment variable for go path bin folder
8. shellcheck -- shell linter
9. beautysh -- zshell formater
10. zsh -- a shell with some useful plugins
11. xclip -- clipboard tool for linux
12. fd -- for telescope compatibility

# Install

```shell
git clone https://github.com/nfwyst/perfect-neovim-config.git ~/.config/nvim
```

# Use

0. run `:checkhealth` in command mode to check nvim enviroment is ok, you can install missing dependencies by check it
1. run `:Lazy install` in command mode to install all plugins
2. run `:LspInstallInfo` in command mode to install language server protocol manually, it give us language specific completion and diagnostic
3. run `:TSInstall` in command mode to install treesitter, it give us a tons of context syntax highlight support, indent, folds, etc...

# Features

1. file Explorer
2. file/symbol/command/help/register search
3. completion, diagnostic, format
4. git integrates
5. debug
6. navigation
7. toggle terminal in vim
8. outline viewer
9. window/buffer/tab control
10. marks, text objects
11. find and replace all
12. folds, spelling etc...
13. nerd font
14. vscode integration

# Nerd Font

a font that has a collection of icons builtin, you can install the prebuild 0xProto font, or download from
[0xProto](https://github.com/ryanoasis/nerd-fonts/releases)

# Vscode integration

The config file can work with vscode, and the `VSCode Neovim` plugin is required.
there are some suggested plugins:

- Apc Customize UI++
- VSCode Animations

# Custom snippets

if you want to use your own code snippets, you can create it under snippets folder,
the language tell snippet engine what language to use the snippets specified by path

## create snippets template

you can create your code template, for example in javascript.json:

```json
{
  "setImmediate": {
    "prefix": "sim",
    "body": "setImmediate(() => {\n\t${0}\n})"
  }
}
```

# find and replace all

you can find and replace all with telescope and quickfix list, here is the steps:

1. press ctrl+q add the search result to the quickfix list above telescope view
2. enter `:cfdo %s/old/new/g | update | bd`, update will write the buffer to disk after replace finished.

# reading pdf

> use uv manage python package, convert pdf to markdown by docling. build rag with ell-ai agent

```sh
brew install uv
uv init
uv python install 3.11
uv add --dev ruff # linter and formatter for python
uv add docling # convert a pdf into markdown through a web link
uv add ell-ai # agent
uv run docling url # convert pdf
uv run chat.py
uv run input.md output.md
```

# edit and review gitHub issues and pull requests

```sh
gh auth login --scopes read:project
# then login with token without github credentials
```
