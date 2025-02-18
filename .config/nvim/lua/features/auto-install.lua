if not executable("kulala-fmt") then
  -- TODO: refactor
  fn.system("go install github.com/mistweaverco/kulala-fmt@latest")
end
