if [[ -f "/opt/homebrew/bin/brew" ]] then
  # If you're using macOS, you'll want this enabled
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# Set the directory we want to store zinit and plugins
ZINIT_HOME="${XDG_DATA_HOME:-${HOME}/.local/share}/zinit/zinit.git"

# Function to check if a command can be executed
command_exists() {
  if command -v $1 &> /dev/null; then
    return 0
  else
    return 1
  fi
}

# set proxy
function proxy ()
{
  export {https,http}_proxy=http://127.0.0.1:7897
  export all_proxy=socks5://127.0.0.1:7897
  if command_exists "npm"; then
    npm config set proxy http://127.0.0.1:7897
  fi
  export no_proxy=127.0.0.1,localhost,apple.com
}

# init proxy
proxy

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
zstyle ':fzf-tab:complete:cd:*' fzf-preview 'ls --color $realpath'
zstyle ':fzf-tab:complete:__zoxide_z:*' fzf-preview 'ls --color $realpath'

# Aliases
alias ls='ls --color'
alias vim='nvim'
alias c='clear'
alias e="nvim"
alias gc-="git checkout -"
alias ys="yarn start"
alias python="python3"
alias pip="python3 -m pip"
if [[ "$uname" == "Linux" ]]; then
  alias pbcopy = "xclip -selection clipboard"
fi

# env variable
export ZSH_TAB_TITLE_PREFIX=" "
export GOPATH="$HOME/go"
export CARGO_HOME="$HOME/.cargo"
export PATH="$PATH:$GOPATH/bin:$HOME/.local/bin:$CARGO_HOME/bin:/usr/local/bin"
if [[ "$(uname)" == "Linux" ]]; then
  export PATH="$PATH:$HOME/.fzf/bin:$HOME/.nvim/bin:$HOME/.local/share/fnm"
fi
export EDITOR="$(which nvim)"
export SHELL="$(which zsh)"
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_DATA_HOME="$HOME/.local/share",
export OLLAMA_API_BASE="http://127.0.0.1:11434"

# Shell integrations
if command_exists "fzf"; then
  source <(fzf --zsh)
fi
source <(starship init zsh)
source <(zoxide init zsh)
eval "$(fnm env)"

# into directory and list all contents
function cx() {
  if [[ -n "$1" ]]; then
    cd "$1" && ls -als
  else
    echo "Please provide a directory name."
  fi
}

# unset proxy
function unproxy()
{
  unset {https,http,all,no}_proxy
  npm config delete proxy --global
}

if [[ "$(uname)" == "Linux" ]]; then
  # bind keymap
  function key() {
    if [[ -f "~/.xmodmap" ]]; then
      xmodmap ~/.xmodmap
    fi
  }
  key
else
  # remove unused app icons
  function removeDuplicatedAppIcon ()
  {
    defaults write com.apple.dock ResetLaunchPad -bool true;
    killall Dock
  }
  # run app with sudo
  function appSudo()
  {
    local name=$1
    local appPath="/Applications/${name}.app/Contents/MacOS/${name}"
    local appPath1="/Applications/${name}.app/Contents/MacOS/stable"
    if [[ -f $appPath ]]; then
      sudo $appPath
      return
    fi
    if [[ -f $appPath1 ]]; then
      sudo $appPath1
      return
    fi
    echo "no path find"
  }
fi


export NVM_DIR="$HOME/.config/nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion

export NODE_OPTIONS="--disable-warning=ExperimentalWarning"
