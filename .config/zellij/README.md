### deps

- [zjstatus](https://github.com/dj95/zjstatus)
- xclip for linux
- pbcopy for darwin
- wl-copy for wayland

### clear cache to resolve crash issue

#### Linux

```sh
sudo rm -rf $HOME/.cache/zellij/
```

#### MacOS

```sh
sudo rm -rf $HOME/Library/Caches/org.Zellij-Contributors.Zellij/
```

### build plugins

```sh
cd ./plugins/zjstatus
cargo build --release
```
