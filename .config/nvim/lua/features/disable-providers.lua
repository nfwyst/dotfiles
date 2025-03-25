local providers = { "node", "perl", "ruby", "python3" }
for _, provider in ipairs(providers) do
  g["loaded_" .. provider .. "_provider"] = 0
end
