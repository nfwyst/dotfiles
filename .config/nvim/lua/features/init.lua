-- disable provider
SET_OPTS({
  loaded_python3_provider = 0,
  loaded_node_provider = 0,
  loaded_perl_provider = 0,
  loaded_ruby_provider = 0,
}, "g")

require("features.qf-del-bind-and-stop-auto-scroll")
require("features.reset-buffer")
require("features.show-first-diagnostic-virtual-text")
require("features.watch-system-info")
require("features.auto-install")
require("features.auto-view")
