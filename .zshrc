if [[ -f "/opt/homebrew/bin/brew" ]] then
  # If you're using macOS, you'll want this enabled
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# Set the directory we want to store zinit and plugins
ZINIT_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}/zinit/zinit.git"

# Download Zinit, if it's not there yet
if [ ! -d "$ZINIT_HOME" ]; then
  mkdir -p "$(dirname $ZINIT_HOME)"
  git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
fi

# Source/Load zinit
source "${ZINIT_HOME}/zinit.zsh"

# Add in zsh plugins
zinit light zsh-users/zsh-syntax-highlighting
zinit light zsh-users/zsh-completions
zinit light zsh-users/zsh-autosuggestions
zinit light Aloxaf/fzf-tab

# Add in snippets
zinit snippet OMZP::git
zinit snippet OMZP::sudo
zinit snippet OMZP::archlinux
zinit snippet OMZP::aws
zinit snippet OMZP::kubectl
zinit snippet OMZP::kubectx
zinit snippet OMZP::command-not-found
zinit light trystan2k/zsh-tab-title

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
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'
zstyle ':fzf-tab:complete:__zoxide_z:*' fzf-preview 'ls --color $realpath'

# Aliases
alias ls='ls --color'
alias vim='nvim'
alias c='clear'
alias e="nvim"
alias gc-="git checkout -"

# Shell integrations
source <(fzf --zsh)
eval "$(zoxide init zsh)"
eval "$(starship init zsh)"

# env variable
export ZSH_TAB_TITLE_PREFIX=" "
export GOPATH="$HOME/go"
export EDITOR="nvim"
export PATH="$PATH:$HOME/go/bin"

# tool funcs
function cx() {
  if [[ -n "$1" ]]; then
    cd "$1" && ls -als
  else
    echo "Please provide a directory name."
  fi
}

function removeDuplicatedAppIcon ()
{
  defaults write com.apple.dock ResetLaunchPad -bool true;
  killall Dock
}

function proxy ()
{
  export {https,http}_proxy=http://127.0.0.1:2334
  export all_proxy=socks5://127.0.0.1:2334
  export no_proxy=127.0.0.1,localhost,apple.com
  npm config set proxy http://127.0.0.1:2334
}

function off-proxy()
{
  unset {https,http,all,no}_proxy
  npm config delete proxy --global
}

