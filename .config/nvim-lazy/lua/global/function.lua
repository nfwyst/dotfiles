function CUR_BUF()
  return api.nvim_get_current_buf()
end

function BUF_INFO(bufnr)
  if not bufnr then
    return fn.getbufinfo()
  end
  return fn.getbufinfo(bufnr)[1]
end

function IS_FILEPATH(path)
  return fn.filereadable(path) == 1
end

function BUF_PATH(bufnr)
  return api.nvim_buf_get_name(bufnr)
end

function EMPTY(input)
  return not input or input == ""
end

function SHORT_HOME_PATH(path)
  return path:gsub("^" .. HOME_PATH, "~")
end

function SET_OPTS(opts, scope)
  scope = scope or "opt"
  for k, v in pairs(opts) do
    vim[scope][k] = v
  end
end
