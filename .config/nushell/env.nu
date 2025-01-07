# Nushell Environment Config File
#
# version = "0.93.0"

def create_left_prompt [] {
    let dir = match (do --ignore-shell-errors { $env.PWD | path relative-to $nu.home-path }) {
        null => $env.PWD
        '' => '~'
        $relative_pwd => ([~ $relative_pwd] | path join)
    }

    let path_color = (if (is-admin) { ansi red_bold } else { ansi green_bold })
    let separator_color = (if (is-admin) { ansi light_red_bold } else { ansi light_green_bold })
    let path_segment = $"($path_color)($dir)"

    $path_segment | str replace --all (char path_sep) $"($separator_color)(char path_sep)($path_color)"
}

def create_right_prompt [] {
    # create a right prompt in magenta with green separators and am/pm underlined
    let time_segment = ([
        (ansi reset)
        (ansi magenta)
        (date now | format date '%x %X') # try to respect user's locale
    ] | str join | str replace --regex --all "([/:])" $"(ansi green)${1}(ansi magenta)" |
        str replace --regex --all "([AP]M)" $"(ansi magenta_underline)${1}")

    let last_exit_code = if ($env.LAST_EXIT_CODE != 0) {([
        (ansi rb)
        ($env.LAST_EXIT_CODE)
    ] | str join)
    } else { "" }

    ([$last_exit_code, (char space), $time_segment] | str join)
}

# Use nushell functions to define your right and left prompt
$env.PROMPT_COMMAND = {|| create_left_prompt }
# FIXME: This default is not implemented in rust code as of 2023-09-08.
$env.PROMPT_COMMAND_RIGHT = {|| create_right_prompt }

# The prompt indicators are environmental variables that represent
# the state of the prompt
$env.PROMPT_INDICATOR = {|| "> " }
$env.PROMPT_INDICATOR_VI_INSERT = {|| " " }
$env.PROMPT_INDICATOR_VI_NORMAL = {|| " " }
$env.PROMPT_MULTILINE_INDICATOR = {|| "::: " }

# If you want previously entered commands to have a different prompt from the usual one,
# you can uncomment one or more of the following lines.
# This can be useful if you have a 2-line prompt and it's taking up a lot of space
# because every command entered takes up 2 lines instead of 1. You can then uncomment
# the line below so that previously entered commands show with a single `🚀`.
# $env.TRANSIENT_PROMPT_COMMAND = {|| "🚀 " }
# $env.TRANSIENT_PROMPT_INDICATOR = {|| "" }
# $env.TRANSIENT_PROMPT_INDICATOR_VI_INSERT = {|| " " }
# $env.TRANSIENT_PROMPT_INDICATOR_VI_NORMAL = {|| " " }
# $env.TRANSIENT_PROMPT_MULTILINE_INDICATOR = {|| "" }
# $env.TRANSIENT_PROMPT_COMMAND_RIGHT = {|| "" }

# Specifies how environment variables are:
# - converted from a string to a value on Nushell startup (from_string)
# - converted from a value back to a string when running external commands (to_string)
# Note: The conversions happen *after* config.nu is loaded
$env.ENV_CONVERSIONS = {
    "PATH": {
        from_string: { |s| $s | split row (char esep) | path expand --no-symlink }
        to_string: { |v| $v | path expand --no-symlink | str join (char esep) }
    }
    "Path": {
        from_string: { |s| $s | split row (char esep) | path expand --no-symlink }
        to_string: { |v| $v | path expand --no-symlink | str join (char esep) }
    }
}

# Directories to search for scripts when calling source or use
# The default for this is $nu.default-config-dir/scripts
$env.NU_LIB_DIRS = [
    ($nu.default-config-dir | path join 'scripts') # add <nushell-config-dir>/scripts
]

# Directories to search for plugin binaries when calling register
# The default for this is $nu.default-config-dir/plugins
$env.NU_PLUGIN_DIRS = [
    ($nu.default-config-dir | path join 'plugins') # add <nushell-config-dir>/plugins
]

# To add entries to PATH (on Windows you might use Path), you can use the following pattern:
$env.PATH = ($env.PATH | split row (char esep))
$env.UNAME = (uname | get kernel-name)
$env.GOPATH = ($env.HOME | path join "go")
$env.CARGO_HOME = ($env.HOME | path join ".cargo")
$env.XDG_CONFIG_HOME = ($env.HOME | path join ".config")
$env.XDG_DATA_HOME = ($env.HOME | path join ".local/share")

use std "path add"
path add ($env.GOPATH | path join "bin")
path add ($env.CARGO_HOME | path join "bin")

if $env.UNAME == "Darwin" {
  let brew = "/opt/homebrew"
  let brew_bin = $"($brew)/bin"
  let brew_sbin = $"($brew)/sbin"
  let path_exists = $brew_bin | path exists
  if $path_exists {
    path add $brew_bin
    path add $brew_sbin
  }
  $env.SSL_CERT_FILE = "/etc/ssl/cert.pem"
}

if $env.UNAME == "Linux" {
  path add ($env.HOME | path join ".local/bin")
  $env.PKG_CONFIG_PATH = "/usr/lib64/pkgconfig"
  $env.OPENSSL_DIR = "/usr"
}

$env.EDITOR = (which nvim | get path | first)
$env.SHELL = (which nu | get path | first)

# To load from a custom file you can use:
# source ($nu.default-config-dir | path join 'custom.nu')

# prepare for starship
mkdir ~/.config/nushell/cache/starship
starship init nu | save -f ~/.config/nushell/cache/starship/init.nu

# prepare for zoxide
mkdir ~/.config/nushell/cache/zoxide
zoxide init nushell | save -f ~/.config/nushell/cache/zoxide/init.nu

# load fnm env
if (which fnm | is-not-empty) {
  fnm env --json | from json | load-env
  path add ($env.FNM_MULTISHELL_PATH | path join "bin")
}

# llm
$env.OLLAMA_API_BASE = "http://127.0.0.1:11434"

# uniq path
$env.PATH = ($env.PATH | uniq)

$env.NODE_OPTIONS = "--no-warnings=ExperimentalWarning"
