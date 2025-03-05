if [[ -f "/opt/homebrew/bin/brew" ]]; then
  # If you're using macOS, you'll want this enabled
  eval "$(/opt/homebrew/bin/brew shellenv)"
  export SSL_CERT_FILE="/etc/ssl/cert.pem"
fi

# Set the directory we want to store zinit and plugins
ZINIT_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}/zinit/zinit.git"

# Function to check if a command can be executed
function command_exists() {
  if command -v "$1" &> /dev/null; then
    return 0
  else
    return 1
  fi
}

# set proxy
function proxy () {
  export {https,http}_proxy="http://127.0.0.1:7897"
  export all_proxy="socks5://127.0.0.1:7897"
  if command_exists "npm"; then
    npm config set proxy http://127.0.0.1:7897
  fi
  export no_proxy="127.0.0.1,localhost,apple.com"
}

# init proxy
proxy

# Download Zinit, if it's not there yet
if [ ! -d "$ZINIT_HOME" ]; then
  mkdir -p "$(dirname "$ZINIT_HOME")"
  git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
fi

# Source/Load zinit
source "${ZINIT_HOME}/zinit.zsh"

# Add in zsh plugins
zinit light zsh-users/zsh-syntax-highlighting
zinit light zsh-users/zsh-completions
zinit light zsh-users/zsh-autosuggestions
zinit light trystan2k/zsh-tab-title
zinit light Aloxaf/fzf-tab

# Add in snippets
zinit snippet OMZP::git
zinit snippet OMZP::sudo
zinit snippet OMZP::archlinux
zinit snippet OMZP::aws
zinit snippet OMZP::kubectl
zinit snippet OMZP::kubectx
zinit snippet OMZP::command-not-found

# Load completions
autoload -Uz compinit && compinit

zinit cdreplay -q

# Keybindings
bindkey -e
bindkey '^p' history-search-backward
bindkey '^n' history-search-forward
bindkey '^[w' kill-region

# History
HISTSIZE=5000
HISTFILE=~/.zsh_history
SAVEHIST=$HISTSIZE
HISTDUP=erase
setopt appendhistory
setopt sharehistory
setopt hist_ignore_space
setopt hist_ignore_all_dups
setopt hist_save_no_dups
setopt hist_ignore_dups
setopt hist_find_no_dups

# Completion styling
zstyle ':completion:*' matcher-list 'm:{a-z}={A-Za-z}'
zstyle ':completion:*' list-colors "${(s.:.)LS_COLORS}"
zstyle ':completion:*' menu no
zstyle ":fzf-tab:complete:cd:*" fzf-preview "ls --color $realpath"
zstyle ":fzf-tab:complete:__zoxide_z:*" fzf-preview "ls --color $realpath"

# env variable
export ZSH_TAB_TITLE_PREFIX=" "
export GOPATH="$HOME/go"
export CARGO_HOME="$HOME/.cargo"
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_DATA_HOME="$HOME/.local/share"

export PATH="$PATH:$GOPATH/bin"
export PATH="$PATH:$CARGO_HOME/bin"
export PATH="$PATH:$HOME/.local/bin"
export PATH="$PATH:$HOME/.bun/bin"

if [[ "$(uname)" == "Linux" ]]; then
  export PKG_CONFIG_PATH="/usr/lib64/pkgconfig"
  export OPENSSL_DIR="/usr"
fi

export LANG="en_US.UTF-8"
export EDITOR="$(which nvim)"
export SHELL="$(which zsh)"
export OLLAMA_API_BASE="http://127.0.0.1:11434"
export NODE_OPTIONS="--no-warnings=ExperimentalWarning"
export PROMPT="${PROMPT}"$'\n'

# settings for qwen agent
export QWEN_AGENT_DEFAULT_MAX_INPUT_TOKENS=134144
export QWEN_AGENT_DEFAULT_MAX_REF_TOKEN=89429

# Shell integrations
source <(starship init zsh)
source <(zoxide init zsh)
eval "$(fnm env)"
if command_exists "fzf"; then
  source <(fzf --zsh)
fi

# Aliases
alias ls="ls --color"
alias vim="nvim"
alias vi="nvim"
alias c="clear"
alias e="nvim"
alias eo="NVIM_APPNAME=nvim-old nvim"
alias gc-="git checkout -"
alias ys="yarn start"
alias bs="bun start"
alias python="python3"
alias pip="python3 -m pip"
alias cat="bat"
alias find="fd"

function create_worktree() {
  local target_dir=$1
  local branch_name=$2
  if [[ ! -d "$target_dir" ]]; then
    mkdir -p "$target_dir"
  fi
  if ! git rev-parse --verify --quiet "refs/heads/$branch_name" >/dev/null 2>&1; then
    git branch "$branch_name"
  fi
  git worktree add "$target_dir" "$branch_name"
}

# unset proxy
function unproxy() {
  unset {https,http,all,no}_proxy
  npm config delete proxy --global
}

function removeDuplicatedAppIcon () {
  if [[ "$(uname)" != "Darwin" ]]; then
    return
  fi
  defaults write com.apple.dock ResetLaunchPad -bool true;
  killall Dock
}

function switch_ctrl_caps_lock() {
  if [[ "$(uname)" != "Linux" ]]; then
    return
  fi
  if [[ -f "$HOME/.xmodmap" ]] && command_exists "xmodmap"; then
    xmodmap ~/.xmodmap
  fi
}

function run_qwen_agent() {
  uv run run_server.py --llm deepseek-ai/DeepSeek-V3 --model_server https://api.hyperbolic.xyz/v1 --workstation_port 7864 --api_key "$HYPERBOLIC_API_KEY" --max_ref_token 89429
}
