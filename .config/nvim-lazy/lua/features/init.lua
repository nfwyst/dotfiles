-- disable provider
SET_OPTS({
  loaded_python3_provider = 0,
  loaded_node_provider = 0,
  loaded_perl_provider = 0,
  loaded_ruby_provider = 0,
}, "g")

require("features.remove-quickfix-item")
require("features.reset-buffer")
