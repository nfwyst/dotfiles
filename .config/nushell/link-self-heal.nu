# link-self-heal.nu — ensure macOS default nushell config dir links to dotfiles.
#
# Loaded from env.nu at startup. nushell resolves its config dir from
# XDG_CONFIG_HOME; emulators that don't inject it (e.g. Terminal.app) fall back
# to "~/Library/Application Support/nushell". We symlink that fallback path to
# the dotfiles config so every launch method shares one config (starship etc.).
#
# Self-healing: any XDG-injecting launch (ghostty) runs this and (re)creates the
# link if it's missing, broken, or replaced by nushell's auto-generated default
# dir — so the next Terminal.app launch picks up the dotfiles config.

def install-link [src: string, link: string] {
    let parent = ($link | path dirname)
    mkdir $parent
    let result = (
        ^/usr/bin/env -u RUBYOPT -u RUBYLIB -u GEM_HOME -u GEM_PATH -u RUBYGEMS_GEMDEPS -u BUNDLE_GEMFILE -u BUNDLE_PATH -u BUNDLE_BIN_PATH -u BUNDLE_APP_CONFIG -u BUNDLE_WITH -u BUNDLE_WITHOUT -u BUNDLER_ORIG_RUBYOPT -u BUNDLER_ORIG_RUBYLIB -u RBENV_VERSION -u RUBY_VERSION /usr/bin/ruby -e '
require "fiddle/import"

module CoreServices
  extend Fiddle::Importer
  dlload "/System/Library/Frameworks/CoreServices.framework/CoreServices"
  extern "int FSPathMakeRefWithOptions(const char *, unsigned int, void *, void *)"
  extern "int FSGetCatalogInfo(const void *, unsigned int, void *, void *, void *, void *)"
  extern "int FSDeleteObject(const void *)"
end

FILE_NOT_FOUND = -43
FS_REF_SIZE = 80
CATALOG_INFO_SIZE = 148
CATALOG_MODE_OFFSET = 66
CATALOG_PERMISSIONS = 0x00000400
DO_NOT_FOLLOW_LEAF_SYMLINK = 0x01
FILE_TYPE_MASK = 0o170000
SYMLINK_TYPE = 0o120000
source, destination = ARGV

64.times do
  begin
    File.symlink(source, destination)
    exit 0
  rescue Errno::EEXIST
  end

  reference = Fiddle::Pointer.malloc(FS_REF_SIZE)
  is_directory = Fiddle::Pointer.malloc(1)
  status = CoreServices.FSPathMakeRefWithOptions(
    destination,
    DO_NOT_FOLLOW_LEAF_SYMLINK,
    reference,
    is_directory,
  )
  next if status == FILE_NOT_FOUND
  raise "FSPathMakeRefWithOptions: #{status}" unless status == 0

  catalog = Fiddle::Pointer.malloc(CATALOG_INFO_SIZE)
  catalog[0, CATALOG_INFO_SIZE] = "\0" * CATALOG_INFO_SIZE
  status = CoreServices.FSGetCatalogInfo(
    reference,
    CATALOG_PERMISSIONS,
    catalog,
    nil,
    nil,
    nil,
  )
  next if status == FILE_NOT_FOUND
  raise "FSGetCatalogInfo: #{status}" unless status == 0

  mode = catalog[CATALOG_MODE_OFFSET, 2].unpack1("S")
  exit 0 unless (mode & FILE_TYPE_MASK) == SYMLINK_TYPE

  status = CoreServices.FSDeleteObject(reference)
  next if status == FILE_NOT_FOUND
  raise "FSDeleteObject: #{status}" unless status == 0
end
raise "link destination did not stabilize"
'
        $src
        $link
        | complete
    )
    if $result.exit_code != 0 {
        print --stderr $"link self-heal: ($result.stderr | str trim)"
    }
}

def link-self-heal [] {
    if ($env.UNAME? | default "") != "Darwin" { return }

    let src = ($nu.config-path | path dirname | path expand)
    let link = ($env.HOME | path join "Library/Application Support/nushell")

    let required = ["config.nu" "env.nu" "link-self-heal.nu"]
    if ($required | any {|file| (($src | path join $file | path type) != "file") }) {
        print --stderr "link self-heal: invalid dotfiles Nushell config source; required files missing"
        return
    }

    # started from the fallback dir itself — nothing to link
    if $src == $link { return }

    match ($link | path type) {
        null => {
            install-link $src $link
        }
        "symlink" => {
            if (($link | path expand) != $src) {
                install-link $src $link
            }
        }
        "dir" => {
            # 普通目录: 若为 nushell 无 XDG 首跑自动生成的 stub 目录(仅含默认
            # config.nu/env.nu, 无 link-self-heal 引用), 替换为链接 — 否则该启动
            # 方式永久用 stub 配置; 含真实用户配置的目录(有非 stub 内容)保留
            let config_file = ($link | path join "config.nu")
            let env_file = ($link | path join "env.nu")
            let entries = (ls -a $link | get name | path basename | where {|name| $name not-in ["." ".."]})
            let is_stub = (
                (($config_file | path type) == "file")
                and (($env_file | path type) == "file")
                and (($entries | where {|name| $name not-in ["config.nu" "env.nu"]}) | is-empty)
                and (open --raw $config_file | str starts-with "# Nushell Config File\n#\n# version =")
                and (open --raw $env_file | str starts-with "# Nushell Environment Config File\n#\n# version =")
            )
            if $is_stub {
                rm -rf $link
                install-link $src $link
            } else {
                print --stderr "link self-heal: preserving existing fallback config path; expected symlink to dotfiles Nushell config"
            }
        }
        _ => {
            print --stderr "link self-heal: preserving existing fallback config path; expected symlink to dotfiles Nushell config"
        }
    }
}

link-self-heal
