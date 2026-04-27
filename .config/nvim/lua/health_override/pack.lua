-- Fast replacement for `vim.pack` health check.
--
-- Why:
--   The stock `vim/pack/health.lua` spawns 3-5 `git` subprocesses PER plugin
--   (rev-parse --git-dir, rev-list -1 HEAD, remote get-url origin, …), each
--   via `vim.system(...):wait()`. On ~40 plugins that's 300+ child processes
--   and ~5s of main-thread busy-wait.
--
-- Strategy:
--   Skip `git` for common cases by reading `.git/HEAD` and `.git/config`
--   directly (single stat + file read, microseconds). Fall back to
--   parallel `vim.system` only for the rare cases that actually need it
--   (e.g. `ls-remote --get-url` to resolve `insteadOf` aliases).
--   In our benchmarks this drops the check from ~5s to ~50ms.
--
-- Same output format as stock `:checkhealth vim.pack`.

local M = {}

local health = vim.health

local function get_lockfile_path()
  return vim.fs.joinpath(vim.fn.stdpath("config"), "nvim-pack-lock.json")
end

local function get_plug_dir()
  return vim.fs.joinpath(vim.fn.stdpath("data"), "site", "pack", "core", "opt")
end

-- ============================================================
-- Direct .git/ reads (no subprocess)
-- ============================================================

-- Read `.git/HEAD`. Returns:
--   ok        - boolean: HEAD file exists & parsed
--   sha       - string|nil: resolved commit sha (nil if ref unresolvable)
--   is_detached - boolean: true when HEAD contains a raw sha (no `ref:`)
local function read_head(plug_path)
  local head_path = plug_path .. "/.git/HEAD"
  local ok, data = pcall(vim.fn.readblob, head_path)
  if not ok then
    return false, nil, false
  end
  data = (data or ""):gsub("%s+$", "")
  -- Detached HEAD: 40 hex chars (or 64 for sha256 repos)
  if data:match("^[0-9a-f]+$") and #data >= 40 then
    return true, data, true
  end
  -- Symbolic ref: "ref: refs/heads/main"
  local ref = data:match("^ref:%s*(.+)$")
  if not ref then
    return true, nil, false
  end
  -- Try loose ref first: .git/<ref>
  local ref_path = plug_path .. "/.git/" .. ref
  local ok2, ref_data = pcall(vim.fn.readblob, ref_path)
  if ok2 and ref_data then
    ref_data = (ref_data or ""):gsub("%s+$", "")
    if ref_data:match("^[0-9a-f]+$") then
      return true, ref_data, false
    end
  end
  -- Fallback: packed-refs
  local packed_path = plug_path .. "/.git/packed-refs"
  local ok3, packed = pcall(vim.fn.readblob, packed_path)
  if ok3 and packed then
    for line in tostring(packed):gmatch("[^\n]+") do
      local sha, name = line:match("^(%x+)%s+(%S+)")
      if name == ref and sha then
        return true, sha, false
      end
    end
  end
  return true, nil, false
end

-- Read `[remote "origin"] url = ...` from `.git/config`.
-- Returns the URL string or nil.
local function read_origin_url(plug_path)
  local cfg_path = plug_path .. "/.git/config"
  local ok, data = pcall(vim.fn.readblob, cfg_path)
  if not ok or not data then
    return nil
  end
  -- Simple parse: find [remote "origin"] section then capture `url = ...`
  local in_origin = false
  for line in tostring(data):gmatch("[^\n]+") do
    local stripped = line:match("^%s*(.-)%s*$")
    local section = stripped:match("^%[(.-)%]$")
    if section then
      in_origin = section:lower():gsub("%s+", " ") == 'remote "origin"'
    elseif in_origin then
      local url = stripped:match("^url%s*=%s*(.+)$")
      if url then
        return url
      end
    end
  end
  return nil
end

-- Quick check: is this a git repo? (presence of .git/HEAD is a strong proxy)
local function is_git_repo(plug_path)
  return vim.uv.fs_stat(plug_path .. "/.git/HEAD") ~= nil
end

-- ============================================================
-- Async git helpers (only used for rare cases)
-- ============================================================
local function spawn_git(out, key, cmd, cwd, pending)
  local full = vim.list_extend({ "git", "-c", "gc.auto=0" }, vim.deepcopy(cmd))
  local env = vim.fn.environ()
  env.GIT_DIR, env.GIT_WORK_TREE = nil, nil
  pending.n = pending.n + 1
  vim.system(
    full,
    { cwd = cwd, text = true, env = env, clear_env = true },
    function(res)
      if res.code ~= 0 then
        out[key] = { ok = false, out = (res.stderr or ""):gsub("\n+$", "") }
      else
        out[key] = { ok = true, out = (res.stdout or ""):gsub("\n+$", "") }
      end
      pending.n = pending.n - 1
    end
  )
end

local function wait_all(pending, timeout_ms)
  return vim.wait(timeout_ms, function()
    return pending.n == 0
  end, 10)
end

local function is_version(x)
  return type(x) == "string" or (type(x) == "table" and pcall(x.has, x, "1"))
end

-- ============================================================
-- Basics
-- ============================================================
local function check_basics()
  health.start("vim.pack: basics")

  if vim.fn.executable("git") == 0 then
    health.warn("`git` executable is required. Install it using your package manager")
    return false, false
  end

  local lockfile_path = get_lockfile_path()
  local has_lockfile = vim.fn.filereadable(lockfile_path) == 1
  local plug_dir = get_plug_dir()
  local has_plug_dir = vim.fn.isdirectory(plug_dir) == 1
  if not has_lockfile and not has_plug_dir then
    health.ok("`vim.pack` is not used")
    return false, false
  end

  -- Cheap sync call; only once.
  local version_out = vim.system({ "git", "version" }, { text = true }):wait()
  local version = ((version_out.stdout or ""):gsub("\n+$", ""))
  health.info(("Git: %s (%s)"):format(version:gsub("^git%s*", ""), vim.fn.exepath("git")))
  health.info("Lockfile: " .. lockfile_path)
  health.info("Plugin directory: " .. plug_dir)

  if has_lockfile and has_plug_dir then
    health.ok("")
  else
    local lf = has_lockfile and "present" or "absent"
    local pd = has_plug_dir and "present" or "absent"
    health.warn(
      ("Lockfile is %s, plugin directory is %s."):format(lf, pd)
        .. " Restart Nvim and run `vim.pack.add({})` to "
        .. (has_lockfile and "install plugins from the lockfile" or "regenerate the lockfile")
    )
  end

  return has_lockfile, has_plug_dir
end

-- ============================================================
-- Lockfile check
-- ============================================================
local function check_lockfile()
  health.start("vim.pack: lockfile")

  local can_read, text = pcall(vim.fn.readblob, get_lockfile_path())
  if not can_read then
    health.error("Could not read lockfile. Delete it and restart Nvim.")
    return
  end

  local can_parse, data = pcall(vim.json.decode, text)
  if not can_parse then
    health.error(("Could not parse lockfile: %s\nDelete it and restart Nvim"):format(data))
    return
  end

  if type(data.plugins) ~= "table" then
    health.error("Field `plugins` is not proper type. Delete lockfile and restart Nvim")
    return
  end

  local plug_dir = get_plug_dir()
  local is_good = true
  -- Plugins needing an ls-remote --get-url resolve (src mismatch)
  local late_checks = {} ---@type { name: string, lock: table, path: string, origin: string }[]

  for plug_name, lock_data in pairs(data.plugins) do
    local name_str = vim.inspect(plug_name)
    local function del_advice(reason)
      health.error(
        ("%s %s. Delete %s entry (do not create trailing comma) and "):format(name_str, reason, name_str)
          .. "restart Nvim to regenerate lockfile data"
      )
      is_good = false
    end

    if type(plug_name) ~= "string" then
      del_advice("is not a valid plugin name")
    elseif type(lock_data) ~= "table" then
      del_advice("entry is not a valid type")
    elseif type(lock_data.rev) ~= "string" then
      del_advice("`rev` entry is " .. (lock_data.rev and "not a valid type" or "missing"))
    elseif type(lock_data.src) ~= "string" then
      del_advice("`src` entry is " .. (lock_data.src and "not a valid type" or "missing"))
    elseif lock_data.version and not is_version(lock_data.version) then
      del_advice("`version` entry is not a valid type")
    else
      local plug_path = vim.fs.joinpath(plug_dir, plug_name)
      if vim.fn.isdirectory(plug_path) ~= 1 then
        health.warn(
          ("Plugin %s is not installed but present in the lockfile."):format(name_str)
            .. " Restart Nvim and run `vim.pack.add({})` to autoinstall."
            .. (" To fully delete, run `vim.pack.del({ %s }, { force = true })`"):format(name_str)
        )
        is_good = false
      elseif is_git_repo(plug_path) then
        local ok_head, head, _ = read_head(plug_path)
        if not ok_head or not head then
          health.error(
            ("Failed to read HEAD inside plugin %s."):format(name_str)
              .. " Manually delete directory " .. plug_path .. " and reinstall plugin"
          )
          is_good = false
        elseif lock_data.rev ~= head then
          health.error(
            ("Plugin %s is not at expected revision\n"):format(name_str)
              .. ("Expected: %s\nActual:   %s\n"):format(lock_data.rev, head)
              .. "To synchronize, restart Nvim and run "
              .. ("`vim.pack.update({ %s }, { offline = true })`\n"):format(name_str)
              .. "If there are no updates, delete `rev` lockfile entry "
              .. "(do not create trailing comma) and restart Nvim to regenerate lockfile data"
          )
          is_good = false
        end

        local origin = read_origin_url(plug_path)
        if not origin then
          health.error(
            ("Failed to read origin URL inside plugin %s."):format(name_str)
              .. " Manually delete directory " .. plug_path .. " and reinstall plugin"
          )
          is_good = false
        elseif lock_data.src ~= origin then
          -- Could be insteadOf alias — need ls-remote to resolve.
          table.insert(late_checks, { name = plug_name, lock = lock_data, path = plug_path, origin = origin })
        end
      end
    end
  end

  -- Parallel ls-remote only for mismatches (rare)
  if #late_checks > 0 then
    local results = {}
    local pending = { n = 0 }
    for _, e in ipairs(late_checks) do
      spawn_git(results, e.name .. ":lsremote", { "ls-remote", "--get-url", e.lock.src }, e.path, pending)
    end
    wait_all(pending, 30000)

    for _, e in ipairs(late_checks) do
      local name_str = vim.inspect(e.name)
      local r = results[e.name .. ":lsremote"]
      if not (r and r.ok and r.out == e.origin) then
        health.error(
          ("Plugin %s has not expected source\n"):format(name_str)
            .. ("Expected: %s\nActual:   %s\n"):format(e.lock.src, e.origin)
            .. "Delete `src` lockfile entry (do not create trailing comma) and "
            .. "restart Nvim to regenerate lockfile data"
        )
        is_good = false
      end
    end
  end

  if is_good then
    health.ok("")
  end
end

-- ============================================================
-- Plugin directory check
-- ============================================================
local function check_plug_dir()
  health.start("vim.pack: plugin directory")

  local plug_dir = get_plug_dir()
  local entries = {}
  for n, _ in vim.fs.dir(plug_dir) do
    table.insert(entries, { name = n, path = vim.fs.joinpath(plug_dir, n) })
  end

  -- Batch-fetch pack info ONCE with info=false to skip 3 extra git calls per
  -- plugin (abbrev-ref origin/HEAD, tag --list, branch --remote --list).
  local active_map = {}
  local pack_ok, pack_info = pcall(vim.pack.get, nil, { info = false })
  if pack_ok and pack_info then
    for _, p in ipairs(pack_info) do
      active_map[p.spec.name] = p.active and true or false
    end
  end

  local is_good = true
  for _, e in ipairs(entries) do
    local name_str = vim.inspect(e.name)
    if vim.fn.isdirectory(e.path) ~= 1 then
      health.error(("%s is not a directory. Delete it"):format(e.name))
      is_good = false
    elseif not is_git_repo(e.path) then
      health.error(
        ("%s is not a Git repository."):format(name_str)
          .. " It was not installed by `vim.pack` and should not be present in the plugin directory."
          .. " If installed manually, use dedicated `:h packages`"
      )
      is_good = false
    else
      local ok_head, _, detached = read_head(e.path)
      if not ok_head then
        health.error(
          ("Failed to read HEAD inside plugin %s."):format(name_str)
            .. " Manually delete directory " .. e.path .. " and reinstall plugin"
        )
        is_good = false
      elseif not detached then
        -- stock: abbrev-ref HEAD != "HEAD" → warn
        health.warn(
          ("Plugin %s is not at state which is a result of `vim.pack` operation.\n"):format(name_str)
            .. "If it was intentional, make sure you know what you are doing.\n"
            .. "Otherwise, restart Nvim and run "
            .. ("`vim.pack.update({ %s }, { offline = true })`.\n"):format(name_str)
            .. "If nothing is updated, plugin is at correct revision and will be managed as expected"
        )
        is_good = false
      end

      -- Match stock semantics: both (a) tracked-but-inactive and
      -- (b) on-disk-but-never-registered are reported as "not active".
      -- active_map has `false` for (a) and `nil` for (b).
      if not active_map[e.name] then
        health.info(
          ("Plugin %s is not active."):format(name_str)
            .. " Is it lazy loaded or did you forget to run `vim.pack.del()`?"
        )
      end
    end
  end

  if is_good then
    health.ok("")
  end
end

function M.check()
  local has_lockfile, has_plug_dir = check_basics()
  if has_lockfile then
    check_lockfile()
  end
  if has_plug_dir then
    check_plug_dir()
  end
end

-- Install override: force-load vim.pack.health then replace it.
pcall(function()
  local _ = vim.pack.health
  vim.pack.health = M
  package.loaded["vim.pack.health"] = M
end)

return M
