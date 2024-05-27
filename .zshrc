#!/usr/bin/env bash
eval "$(/opt/homebrew/bin/brew shellenv)"

export ZSH="$HOME/.oh-my-zsh"
export ZSH_THEME="robbyrussell"
export ZSH_TAB_TITLE_PREFIX=" "
export LANG=en_US.UTF-8
export GOPATH="$HOME/go"
export EDITOR="nvim"
export NPM_TOKEN=30724301-82cc-450e-9d61-d7fef77c2c07
export PATH="$PATH:$HOME/go/bin"
export MANPATH="/usr/local/man:$MANPATH"
export ARCHFLAGS="-arch x86_64"
export plugins=(git z nvm zsh-tab-title)
zstyle ':omz:update' mode disabled
source $ZSH/oh-my-zsh.sh

alias e="nvim"
alias gc-="git checkout -"

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

function cpu_info()
{
  local cpu_info=""
  if [[ "$(uname)" == "Darwin" ]]; then
    cpu_info=$(top -l 1 -n 0 | awk '/CPU usage/ {print $3+$5}')
  else
    cpu_info=$(top -bn1 | awk '/%Cpu/ {print $2+$4+$6+$10+$12+$14+$16}')
  fi

  echo "Used Cpu: ${cpu_info}%"
}
