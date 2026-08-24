# Nushell Config File
#
# version = "0.93.0"

# For more information on defining custom themes, see
# https://www.nushell.sh/book/coloring_and_theming.html
# And here is the theme collection
# https://github.com/nushell/nu_scripts/tree/main/themes
let dark_theme = {
    # color for nushell primitives
    separator: white
    leading_trailing_space_bg: { attr: n } # no fg, no bg, attr none effectively turns this off
    header: green_bold
    empty: blue
    # Closures can be used to choose colors for specific values.
    # The value (in this case, a bool) is piped into the closure.
    # eg) {|| if $in { 'light_cyan' } else { 'light_gray' } }
    bool: light_cyan
    int: white
    filesize: cyan
    duration: white
    date: purple
    range: white
    float: white
    string: white
    nothing: white
    binary: white
    cell-path: white
    row_index: green_bold
    record: white
    list: white
    block: white
    hints: dark_gray
    search_result: { bg: red fg: white }
    shape_and: purple_bold
    shape_binary: purple_bold
    shape_block: blue_bold
    shape_bool: light_cyan
    shape_closure: green_bold
    shape_custom: green
    shape_datetime: cyan_bold
    shape_directory: cyan
    shape_external: cyan
    shape_externalarg: green_bold
    shape_external_resolved: light_yellow_bold
    shape_filepath: cyan
    shape_flag: blue_bold
    shape_float: purple_bold
    # shapes are used to change the cli syntax highlighting
    shape_garbage: { fg: white bg: red attr: b}
    shape_globpattern: cyan_bold
    shape_int: purple_bold
    shape_internalcall: cyan_bold
    shape_keyword: cyan_bold
    shape_list: cyan_bold
    shape_literal: blue
    shape_match_pattern: green
    shape_matching_brackets: { attr: u }
    shape_nothing: light_cyan
    shape_operator: yellow
    shape_or: purple_bold
    shape_pipe: purple_bold
    shape_range: yellow_bold
    shape_record: cyan_bold
    shape_redirection: purple_bold
    shape_signature: green_bold
    shape_string: green
    shape_string_interpolation: cyan_bold
    shape_table: blue_bold
    shape_variable: purple
    shape_vardecl: purple
}

let light_theme = {
    # color for nushell primitives
    separator: dark_gray
    leading_trailing_space_bg: { attr: n } # no fg, no bg, attr none effectively turns this off
    header: green_bold
    empty: blue
    # Closures can be used to choose colors for specific values.
    # The value (in this case, a bool) is piped into the closure.
    # eg) {|| if $in { 'dark_cyan' } else { 'dark_gray' } }
    bool: dark_cyan
    int: dark_gray
    filesize: cyan_bold
    duration: dark_gray
    date: purple
    range: dark_gray
    float: dark_gray
    string: dark_gray
    nothing: dark_gray
    binary: dark_gray
    cell-path: dark_gray
    row_index: green_bold
    record: dark_gray
    list: dark_gray
    block: dark_gray
    hints: dark_gray
    search_result: { fg: white bg: red }
    shape_and: purple_bold
    shape_binary: purple_bold
    shape_block: blue_bold
    shape_bool: light_cyan
    shape_closure: green_bold
    shape_custom: green
    shape_datetime: cyan_bold
    shape_directory: cyan
    shape_external: cyan
    shape_externalarg: green_bold
    shape_external_resolved: light_purple_bold
    shape_filepath: cyan
    shape_flag: blue_bold
    shape_float: purple_bold
    # shapes are used to change the cli syntax highlighting
    shape_garbage: { fg: white bg: red attr: b}
    shape_globpattern: cyan_bold
    shape_int: purple_bold
    shape_internalcall: cyan_bold
    shape_keyword: cyan_bold
    shape_list: cyan_bold
    shape_literal: blue
    shape_match_pattern: green
    shape_matching_brackets: { attr: u }
    shape_nothing: light_cyan
    shape_operator: yellow
    shape_or: purple_bold
    shape_pipe: purple_bold
    shape_range: yellow_bold
    shape_record: cyan_bold
    shape_redirection: purple_bold
    shape_signature: green_bold
    shape_string: green
    shape_string_interpolation: cyan_bold
    shape_table: blue_bold
    shape_variable: purple
    shape_vardecl: purple
}

# External completer example
# let carapace_completer = {|spans|
#     carapace $spans.0 nushell ...$spans | from json
# }

# The default config record. This is where much of your global configuration is setup.
$env.config = {
    show_banner: false # true or false to enable or disable the welcome banner at startup
    display_errors: { termination_signal: false } # don't show error when external cmd killed by ctrl+c (SIGINT)

    ls: {
        use_ls_colors: true # use the LS_COLORS environment variable to colorize output
        clickable_links: true # enable or disable clickable links. Your terminal has to support links.
    }

    rm: {
        always_trash: false # always act as if -t was given. Can be overridden with -p
    }

    table: {
        mode: rounded # basic, compact, compact_double, light, thin, with_love, rounded, reinforced, heavy, none, other
        index_mode: always # "always" show indexes, "never" show indexes, "auto" = show indexes when a table has "index" column
        show_empty: true # show 'empty list' and 'empty record' placeholders for command output
        padding: { left: 1, right: 1 } # a left right padding of each column in a table
        trim: {
            methodology: wrapping # wrapping or truncating
            wrapping_try_keep_words: true # A strategy used by the 'wrapping' methodology
            truncating_suffix: "..." # A suffix used by the 'truncating' methodology
        }
        header_on_separator: false # show header text on separator/border line
        # abbreviated_row_count: 10 # limit data rows from top and bottom after reaching a set point
    }

    error_style: "fancy" # "fancy" or "plain" for screen reader-friendly error messages

    # datetime_format determines what a datetime rendered in the shell would look like.
    # Behavior without this configuration point will be to "humanize" the datetime display,
    # showing something like "a day ago."
    datetime_format: {
        # normal: '%a, %d %b %Y %H:%M:%S %z'    # shows up in displays of variables or other datetime's outside of tables
        # table: '%m/%d/%y %I:%M:%S%p'          # generally shows up in tabular outputs such as ls. commenting this out will change it to the default human readable datetime format
    }

    explore: {
        status_bar_background: { fg: "#1D1F21", bg: "#C4C9C6" },
        command_bar_text: { fg: "#C4C9C6" },
        highlight: { fg: "black", bg: "yellow" },
        status: {
            error: { fg: "white", bg: "red" },
            warn: {}
            info: {}
        },
        table: {
            split_line: { fg: "#404040" },
            selected_cell: { bg: light_blue },
            selected_row: {},
            selected_column: {},
        },
    }

    history: {
        max_size: 100000 # Session has to be reloaded for this to take effect
        sync_on_enter: true # Enable to share history between multiple sessions, else you have to close the session to write history to file
        file_format: "sqlite" # "sqlite" or "plaintext"
        isolation: false # only available with sqlite file_format. true enables history isolation, false disables it. true will allow the history to be isolated to the current session using up/down arrows. false will allow the history to be shared across all sessions.
    }

    completions: {
        case_sensitive: false # set to true to enable case-sensitive completions
        quick: true    # set this to false to prevent auto-selecting completions when only one remains
        partial: true    # set this to false to prevent partial filling of the prompt
        algorithm: "prefix"    # prefix or fuzzy
        external: {
            enable: true # set to false to prevent nushell looking into $env.PATH to find more suggestions, `false` recommended for WSL users as this look up may be very slow
            max_results: 100 # setting it lower can improve completion performance at the cost of omitting some options
            completer: null # check 'carapace_completer' above as an example
        }
        use_ls_colors: true # set this to true to enable file/path/directory completions using LS_COLORS
    }

    filesize: {
        unit: "metric" # true => KB, MB, GB (ISO standard), false => KiB, MiB, GiB (Windows standard)
    }

    cursor_shape: {
        emacs: block # block, underscore, line, blink_block, blink_underscore, blink_line, inherit to skip setting cursor shape (line is the default)
        vi_insert: block # block, underscore, line, blink_block, blink_underscore, blink_line, inherit to skip setting cursor shape (block is the default)
        vi_normal: block # block, underscore, line, blink_block, blink_underscore, blink_line, inherit to skip setting cursor shape (underscore is the default)
    }

    color_config: (if ($env.HOME | path join ".local/state/theme/mode" | path exists) and ((open ($env.HOME | path join ".local/state/theme/mode") | str trim) == "light") { $light_theme } else { $dark_theme })
    footer_mode: 25 # always, never, number_of_rows, auto
    float_precision: 2 # the precision for displaying floats in tables
    buffer_editor: "" # command that will be used to edit the current line buffer with ctrl+o, if unset fallback to $env.EDITOR and $env.VISUAL
    use_ansi_coloring: true
    bracketed_paste: true # enable bracketed paste, currently useless on windows
    edit_mode: vi # emacs, vi
    shell_integration: {
      # osc2 abbreviates the path if in the home_dir, sets the tab/window title, shows the running command in the tab/window title
      osc2: true
      # osc7 is a way to communicate the path to the terminal, this is helpful for spawning new tabs in the same directory
      osc7: true
      # osc8 is also implemented as the deprecated setting ls.show_clickable_links, it shows clickable links in ls output if your terminal supports it. show_clickable_links is deprecated in favor of osc8
      osc8: true
      # osc9_9 is from ConEmu and is starting to get wider support. It's similar to osc7 in that it communicates the path to the terminal
      osc9_9: false
      # osc133 is several escapes invented by Final Term which include the supported ones below.
      # 133;A - Mark prompt start
      # 133;B - Mark prompt end
      # 133;C - Mark pre-execution
      # 133;D;exit - Mark execution finished with exit code
      # This is used to enable terminals to know where the prompt is, the command is, where the command finishes, and where the output of the command is
      osc133: true
      # osc633 is closely related to osc133 but only exists in visual studio code (vscode) and supports their shell integration features
      # 633;A - Mark prompt start
      # 633;B - Mark prompt end
      # 633;C - Mark pre-execution
      # 633;D;exit - Mark execution finished with exit code
      # 633;E - NOT IMPLEMENTED - Explicitly set the command line with an optional nonce
      # 633;P;Cwd=<path> - Mark the current working directory and communicate it to the terminal
      # and also helps with the run recent menu in vscode
      osc633: true
      # reset_application_mode is escape \x1b[?1l and was added to help ssh work better
      reset_application_mode: true
    }
    render_right_prompt_on_last_line: false # true or false to enable or disable right prompt to be rendered on last line of the prompt.
    use_kitty_protocol: false # enables keyboard enhancement protocol implemented by kitty console, only if your terminal support this.
    highlight_resolved_externals: false # true enables highlighting of external commands in the repl resolved by which.
    recursion_limit: 50 # the maximum number of times nushell allows recursion before stopping it

    plugins: {} # Per-plugin configuration. See https://www.nushell.sh/contributor-book/plugins.html#configuration.

    plugin_gc: {
        # Configuration for plugin garbage collection
        default: {
            enabled: true # true to enable stopping of inactive plugins
            stop_after: 10sec # how long to wait after a plugin is inactive to stop it
        }
        plugins: {
            # alternate configuration for specific plugins, by name, for example:
            #
            # gstat: {
            #     enabled: false
            # }
        }
    }

    hooks: {
        pre_prompt: [{||
            let theme_file = ($env.HOME | path join ".local/state/theme/mode")
            let mode = (if ($theme_file | path exists) { (open $theme_file | str trim) } else { "dark" })
            if ($env | get -o __THEME_MODE | default "") != $mode {
                $env.__THEME_MODE = $mode
                $env.config.color_config = (if $mode == "light" { $light_theme } else { $dark_theme })
                if (which vivid | is-not-empty) {
                    let vivid_theme = (if $mode == "light" { "tokyonight-day" } else { "tokyonight-storm" })
                    $env.LS_COLORS = (vivid generate $vivid_theme)
                }
            }
        }]
        pre_execution: [{||
            # exit 时 SIGKILL nu 的 children, 防 tmux POLLHUP 自旋。
            # 不可向 nu 自身或 pgid 发 TERM: 兄弟 pane 共享 pgid 会被一并送走。
            let _cmd = (commandline | str trim)
            if $_cmd == "exit" or $_cmd == "exit 0" {
                ^bash -c $"for c in $(pgrep -P ($nu.pid) 2>/dev/null); do kill -KILL $c 2>/dev/null; done; true"
            }
        }] # run before the repl input is run
        env_change: {
            PWD: [{|before, after| null }] # run if the PWD environment is different since the last repl input
        }
        display_output: "if (term size).columns >= 100 { table -e } else { table }" # run to display the output of a pipeline
        command_not_found: { null } # return an error message when a command is not found
    }

    menus: [
        # Configuration for default nushell menus
        # Note the lack of source parameter
        {
            name: completion_menu
            only_buffer_difference: false
            marker: "| "
            type: {
                layout: columnar
                columns: 4
                col_width: 20     # Optional value. If missing all the screen width is used to calculate column width
                col_padding: 2
            }
            style: {
                text: green
                selected_text: { attr: r }
                description_text: yellow
                match_text: { attr: u }
                selected_match_text: { attr: ur }
            }
        }
        {
            name: ide_completion_menu
            only_buffer_difference: false
            marker: "| "
            type: {
                layout: ide
                min_completion_width: 0,
                max_completion_width: 50,
                max_completion_height: 10, # will be limited by the available lines in the terminal
                padding: 0,
                border: true,
                cursor_offset: 0,
                description_mode: "prefer_right"
                min_description_width: 0
                max_description_width: 50
                max_description_height: 10
                description_offset: 1
                # If true, the cursor pos will be corrected, so the suggestions match up with the typed text
                #
                # C:\> str
                #      str join
                #      str trim
                #      str split
                correct_cursor_pos: false
            }
            style: {
                text: green
                selected_text: { attr: r }
                description_text: yellow
                match_text: { attr: u }
                selected_match_text: { attr: ur }
            }
        }
        {
            name: history_menu
            only_buffer_difference: true
            marker: "? "
            type: {
                layout: list
                page_size: 10
            }
            style: {
                text: green
                selected_text: green_reverse
                description_text: yellow
            }
        }
        {
            name: help_menu
            only_buffer_difference: true
            marker: "? "
            type: {
                layout: description
                columns: 4
                col_width: 20     # Optional value. If missing all the screen width is used to calculate column width
                col_padding: 2
                selection_rows: 4
                description_rows: 10
            }
            style: {
                text: green
                selected_text: green_reverse
                description_text: yellow
            }
        }
    ]

    keybindings: [
        {
            name: completion_menu
            modifier: none
            keycode: tab
            mode: [emacs vi_normal vi_insert]
            event: {
                until: [
                    { send: menu name: completion_menu }
                    { send: menunext }
                    { edit: complete }
                ]
            }
        }
        {
            name: ide_completion_menu
            modifier: control
            keycode: char_n
            mode: [emacs vi_normal vi_insert]
            event: {
                until: [
                    { send: menu name: ide_completion_menu }
                    { send: menunext }
                    { edit: complete }
                ]
            }
        }
        {
            name: history_menu
            modifier: control
            keycode: char_r
            mode: [emacs, vi_insert, vi_normal]
            event: { send: menu name: history_menu }
        }
        {
            name: help_menu
            modifier: none
            keycode: f1
            mode: [emacs, vi_insert, vi_normal]
            event: { send: menu name: help_menu }
        }
        {
            name: completion_previous_menu
            modifier: shift
            keycode: backtab
            mode: [emacs, vi_normal, vi_insert]
            event: { send: menuprevious }
        }
        {
            name: next_page_menu
            modifier: control
            keycode: char_x
            mode: emacs
            event: { send: menupagenext }
        }
        {
            name: undo_or_previous_page_menu
            modifier: control
            keycode: char_z
            mode: emacs
            event: {
                until: [
                    { send: menupageprevious }
                    { edit: undo }
                ]
            }
        }
        {
            name: escape
            modifier: none
            keycode: escape
            mode: [emacs, vi_normal, vi_insert]
            event: { send: esc }
        }
        {
            name: cancel_command
            modifier: control
            keycode: char_c
            mode: [emacs, vi_normal, vi_insert]
            event: { send: ctrlc }
        }
        {
            name: quit_shell
            modifier: control
            keycode: char_d
            mode: [emacs, vi_normal, vi_insert]
            event: { send: ctrld }
        }
        {
            name: clear_screen
            modifier: control
            keycode: char_l
            mode: [emacs, vi_normal, vi_insert]
            event: { send: clearscreen }
        }
        {
            name: search_history
            modifier: control
            keycode: char_q
            mode: [emacs, vi_normal, vi_insert]
            event: { send: searchhistory }
        }
        {
            name: open_command_editor
            modifier: control
            keycode: char_o
            mode: [emacs, vi_normal, vi_insert]
            event: { send: openeditor }
        }
        {
            name: move_up
            modifier: none
            keycode: up
            mode: [emacs, vi_normal, vi_insert]
            event: {
                until: [
                    { send: menuup }
                    { send: up }
                ]
            }
        }
        {
            name: move_down
            modifier: none
            keycode: down
            mode: [emacs, vi_normal, vi_insert]
            event: {
                until: [
                    { send: menudown }
                    { send: down }
                ]
            }
        }
        {
            name: move_left
            modifier: none
            keycode: left
            mode: [emacs, vi_normal, vi_insert]
            event: {
                until: [
                    { send: menuleft }
                    { send: left }
                ]
            }
        }
        {
            name: move_right_or_take_history_hint
            modifier: none
            keycode: right
            mode: [emacs, vi_normal, vi_insert]
            event: {
                until: [
                    { send: historyhintcomplete }
                    { send: menuright }
                    { send: right }
                ]
            }
        }
        {
            name: move_one_word_left
            modifier: control
            keycode: left
            mode: [emacs, vi_normal, vi_insert]
            event: { edit: movewordleft }
        }
        {
            name: move_one_word_right_or_take_history_hint
            modifier: control
            keycode: right
            mode: [emacs, vi_normal, vi_insert]
            event: {
                until: [
                    { send: historyhintwordcomplete }
                    { edit: movewordright }
                ]
            }
        }
        {
            name: move_to_line_start
            modifier: none
            keycode: home
            mode: [emacs, vi_normal, vi_insert]
            event: { edit: movetolinestart }
        }
        {
            name: move_to_line_start
            modifier: control
            keycode: char_a
            mode: [emacs, vi_normal, vi_insert]
            event: { edit: movetolinestart }
        }
        {
            name: move_to_line_end_or_take_history_hint
            modifier: none
            keycode: end
            mode: [emacs, vi_normal, vi_insert]
            event: {
                until: [
                    { send: historyhintcomplete }
                    { edit: movetolineend }
                ]
            }
        }
        {
            name: move_to_line_end_or_take_history_hint
            modifier: control
            keycode: char_e
            mode: [emacs, vi_normal, vi_insert]
            event: {
                until: [
                    { send: historyhintcomplete }
                    { edit: movetolineend }
                ]
            }
        }
        {
            name: move_to_line_start
            modifier: control
            keycode: home
            mode: [emacs, vi_normal, vi_insert]
            event: { edit: movetolinestart }
        }
        {
            name: move_to_line_end
            modifier: control
            keycode: end
            mode: [emacs, vi_normal, vi_insert]
            event: { edit: movetolineend }
        }
        {
            name: move_up
            modifier: control
            keycode: char_p
            mode: [emacs, vi_normal, vi_insert]
            event: {
                until: [
                    { send: menuup }
                    { send: up }
                ]
            }
        }
        {
            name: move_down
            modifier: control
            keycode: char_t
            mode: [emacs, vi_normal, vi_insert]
            event: {
                until: [
                    { send: menudown }
                    { send: down }
                ]
            }
        }
        {
            name: delete_one_character_backward
            modifier: none
            keycode: backspace
            mode: [emacs, vi_insert]
            event: { edit: backspace }
        }
        {
            name: delete_one_word_backward
            modifier: control
            keycode: backspace
            mode: [emacs, vi_insert]
            event: { edit: backspaceword }
        }
        {
            name: delete_one_character_forward
            modifier: none
            keycode: delete
            mode: [emacs, vi_insert]
            event: { edit: delete }
        }
        {
            name: delete_one_character_forward
            modifier: control
            keycode: delete
            mode: [emacs, vi_insert]
            event: { edit: delete }
        }
        {
            name: delete_one_character_backward
            modifier: control
            keycode: char_h
            mode: [emacs, vi_insert]
            event: { edit: backspace }
        }
        {
            name: delete_one_word_backward
            modifier: control
            keycode: char_w
            mode: [emacs, vi_insert]
            event: { edit: backspaceword }
        }
        {
            name: move_left
            modifier: none
            keycode: backspace
            mode: vi_normal
            event: { edit: moveleft }
        }
        {
            name: newline_or_run_command
            modifier: none
            keycode: enter
            mode: emacs
            event: { send: enter }
        }
        {
            name: move_left
            modifier: control
            keycode: char_b
            mode: emacs
            event: {
                until: [
                    { send: menuleft }
                    { send: left }
                ]
            }
        }
        {
            name: move_right_or_take_history_hint
            modifier: control
            keycode: char_f
            mode: emacs
            event: {
                until: [
                    { send: historyhintcomplete }
                    { send: menuright }
                    { send: right }
                ]
            }
        }
        {
            name: redo_change
            modifier: control
            keycode: char_g
            mode: emacs
            event: { edit: redo }
        }
        {
            name: undo_change
            modifier: control
            keycode: char_z
            mode: emacs
            event: { edit: undo }
        }
        {
            name: paste_before
            modifier: control
            keycode: char_y
            mode: emacs
            event: { edit: pastecutbufferbefore }
        }
        {
            name: cut_word_left
            modifier: control
            keycode: char_w
            mode: emacs
            event: { edit: cutwordleft }
        }
        {
            name: cut_line_to_end
            modifier: control
            keycode: char_k
            mode: emacs
            event: { edit: cuttoend }
        }
        {
            name: cut_line_from_start
            modifier: control
            keycode: char_u
            mode: emacs
            event: { edit: cutfromstart }
        }
        {
            name: swap_graphemes
            modifier: control
            keycode: char_t
            mode: emacs
            event: { edit: swapgraphemes }
        }
        {
            name: move_one_word_left
            modifier: alt
            keycode: left
            mode: emacs
            event: { edit: movewordleft }
        }
        {
            name: move_one_word_right_or_take_history_hint
            modifier: alt
            keycode: right
            mode: emacs
            event: {
                until: [
                    { send: historyhintwordcomplete }
                    { edit: movewordright }
                ]
            }
        }
        {
            name: move_one_word_left
            modifier: alt
            keycode: char_b
            mode: emacs
            event: { edit: movewordleft }
        }
        {
            name: move_one_word_right_or_take_history_hint
            modifier: alt
            keycode: char_f
            mode: emacs
            event: {
                until: [
                    { send: historyhintwordcomplete }
                    { edit: movewordright }
                ]
            }
        }
        {
            name: delete_one_word_forward
            modifier: alt
            keycode: delete
            mode: emacs
            event: { edit: deleteword }
        }
        {
            name: delete_one_word_backward
            modifier: alt
            keycode: backspace
            mode: emacs
            event: { edit: backspaceword }
        }
        {
            name: delete_one_word_backward
            modifier: alt
            keycode: char_m
            mode: emacs
            event: { edit: backspaceword }
        }
        {
            name: cut_word_to_right
            modifier: alt
            keycode: char_d
            mode: emacs
            event: { edit: cutwordright }
        }
        {
            name: upper_case_word
            modifier: alt
            keycode: char_u
            mode: emacs
            event: { edit: uppercaseword }
        }
        {
            name: lower_case_word
            modifier: alt
            keycode: char_l
            mode: emacs
            event: { edit: lowercaseword }
        }
        {
            name: capitalize_char
            modifier: alt
            keycode: char_c
            mode: emacs
            event: { edit: capitalizechar }
        }
        # The following bindings with `*system` events require that Nushell has
        # been compiled with the `system-clipboard` feature.
        # This should be the case for Windows, macOS, and most Linux distributions
        # Not available for example on Android (termux)
        # If you want to use the system clipboard for visual selection or to
        # paste directly, uncomment the respective lines and replace the version
        # using the internal clipboard.
        {
            name: copy_selection
            modifier: control_shift
            keycode: char_c
            mode: emacs
            event: { edit: copyselection }
            # event: { edit: copyselectionsystem }
        }
        {
            name: cut_selection
            modifier: control_shift
            keycode: char_x
            mode: emacs
            event: { edit: cutselection }
            # event: { edit: cutselectionsystem }
        }
        # {
        #     name: paste_system
        #     modifier: control_shift
        #     keycode: char_v
        #     mode: emacs
        #     event: { edit: pastesystem }
        # }
        {
            name: select_all
            modifier: control_shift
            keycode: char_a
            mode: emacs
            event: { edit: selectall }
        }
        {
          name: fuzzy_file
          modifier: control
          keycode: char_t
          mode: [emacs vi_normal vi_insert]
          event: {
            send: executehostcommand
            cmd: "commandline edit --insert (fzf --layout=reverse)"
          }
        }
    ]
}

# integration with starship prompt
use ~/.config/nushell/cache/starship/init.nu

# integration with zoxide filesystem navigator
source ~/.config/nushell/cache/zoxide/init.nu

# load git alias
source ~/.config/nushell/aliases/git.nu

# load opencode alias
source ~/.config/nushell/aliases/opencode.nu

# load tmux alias (ghostty 主窗口里敲 t 进入 tmux)
source ~/.config/nushell/aliases/tmux.nu

# integration with carapace
source ~/.config/nushell/cache/carapace/init.nu

# wrap carapace completer: skip package-name registry lookups (cause E500/timeout)
# carapace internally calls `npm search` for ALL pkg managers (npm/bun/bunx/npx/pnpm/yarn)
let _carapace_completer = $env.config.completions.external.completer
$env.config.completions.external.completer = {|spans|
    let last = ($spans | last)
    let is_flag = ($last | str starts-with "-")
    let len = ($spans | length)
    let skip = (
        # bunx/npx <pkg> — first positional is package name
        ($spans.0 in [bunx npx] and $len > 1 and not $is_flag)
        # npm install/uninstall/... <pkg>
        or ($spans.0 == "npm" and $len > 2 and ($spans.1 in [install uninstall add remove link i un rm]) and not $is_flag)
        # bun add/remove/x/... <pkg>
        or ($spans.0 == "bun" and $len > 2 and ($spans.1 in [add remove link unlink x]) and not $is_flag)
        # pnpm add/remove/install <pkg>
        or ($spans.0 == "pnpm" and $len > 2 and ($spans.1 in [add remove install i]) and not $is_flag)
        # yarn add/remove <pkg>
        or ($spans.0 == "yarn" and $len > 2 and ($spans.1 in [add remove]) and not $is_flag)
    )
    if $skip { return [] }
    do $_carapace_completer $spans
}

# integration with atuin
source ~/.config/nushell/cache/atuin/init.nu

# alias
alias e = nvim
alias eo = env NVIM_APPNAME=nvim-old nvim
alias vim = nvim
alias vi = nvim
alias ys = yarn start
alias bs = bun start
alias gc- = git checkout -
alias c = clear
alias python = python3
alias pip = python3 -m pip
alias cat = bat
alias find = fd
alias openclaw = bun run ($env.HOME | path join .bun install global node_modules openclaw dist index.js)
# bun 包装: 仅在安装族子命令 (install/add/update/remove/link...) 自动追加 --trust,
# 其余子命令 (upgrade/run/x/...) 原样透传,避免 --trust/--bun 被错误注入触发解析错误。
def --wrapped bun [...args] {
    let sub = ($args | get -o 0 | default "")
    if $sub in [install i add update remove rm link unlink] {
        ^bun ...$args --trust
    } else if $sub == "run" {
        ^bun --bun ...$args
    } else {
        ^bun ...$args
    }
}


def create_worktree [target_dir, branch_name] {
  if not ($target_dir | path exists) {
    mkdir $target_dir
  }
  let branch_exists = (git branch --list $branch_name | lines | length) > 0
  if not $branch_exists {
    git branch $branch_name
  }
  git worktree add $target_dir $branch_name
}

# set proxy
def --env proxy [] {
  let host = "http://127.0.0.1"
  let all_host = "socks5://127.0.0.1"
  let port = "7897"
  let address = $"($host):($port)"
  let all_address = $"($all_host):($port)"
  $env.http_proxy = $address
  $env.https_proxy = $address
  $env.all_proxy = $all_address
  $env.no_proxy = $"($host),http://localhost,https://www.apple.com"
  let npm_exists = command -v "npm" &> /dev/null | is-not-empty
  if $npm_exists {
    npm config set proxy $address --global
  }
}

# unset proxy
def --env unproxy [] {
  hide-env https_proxy
  hide-env http_proxy
  hide-env all_proxy
  hide-env no_proxy
  npm config delete proxy --global
}

# fuzzy find file
def ff [] {
  let fzfoutput = fzf --height 60% --layout reverse --border | str trim
  if (not ($fzfoutput | is-empty)) {
    ^nvim $fzfoutput
  }
}

# remove unused app icons in mac
def removeDuplicatedAppIcon [] {
  if $env.UNAME != "Darwin" {
    return
  }
  defaults write com.apple.dock ResetLaunchPad -bool true;
  killall Dock
}

def switch_ctrl_caps_lock [] {
  if $env.UNAME != "Linux" {
    return
  }
  let map_exists = $env.HOME | path join ".xmodmap" | path exists
  let cmd_exsits = which xmodmap | is-not-empty
  if $map_exists and $cmd_exsits {
    xmodmap ~/.xmodmap
  }
}

def run_qwen_agent [] {
    uv run run_server.py --llm deepseek-ai/DeepSeek-R1 --model_server https://api.hyperbolic.xyz/v1 --workstation_port 7864 --api_key $env.HYPERBOLIC_API_KEY --max_ref_token 89429
}

def free_memory [] {
  if $env.UNAME != "Linux" {
    return
  }
  sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'
}

let custom_env_path = $nu.default-config-dir | path join 'custom-env.nu'
if not ($custom_env_path | path exists) {
  touch $custom_env_path
  exit
}

def git-config-read [git: string, key: string] {
    let result = (do { ^$git config --global --get-all $key } | complete)
    if $result.exit_code == 0 { return ($result.stdout | lines) }

    let detail = ($result.stderr | str trim)
    if $result.exit_code == 1 and ($detail | is-empty) { return [] }
    let reason = (if ($detail | is-empty) { $"exit code ($result.exit_code)" } else { $detail })
    error make { msg: $"Git config read failed for ($key): ($reason)" }
}

def git-config-write-with-retry [git: string, key: string, args: list<string>] {
    for attempt in 1..5 {
        let write = (do { ^$git ...$args } | complete)
        if $write.exit_code == 0 { return { ok: true, detail: "" } }

        let detail = ($write.stderr | str trim)
        if not ($detail | str contains "could not lock config file") {
            error make { msg: $"Git config setup failed for ($key): ($detail)" }
        }
        if $attempt == 5 { return { ok: false, detail: $detail } }
        sleep 20ms
    }
}

# Set only missing or changed values. Writes retry only Git config-lock contention.
def ensure-git-config [key: string, value: string, --path] {
    let expected = (if $path { $value | path expand } else { $value })
    let git = "/usr/bin/git"
    if (git-config-read $git $key) == [$expected] { return }
    let write = (git-config-write-with-retry $git $key ["config" "--global" "--replace-all" $key $expected])
    if not $write.ok and (git-config-read $git $key) != [$expected] {
        error make { msg: $"Git config setup failed for ($key): ($write.detail)" }
    }
}

def ensure-git-include [value: string] {
    let canonical = ($value | path expand)
    let legacy = '~/.config/delta/themes.gitconfig'
    let git = "/usr/bin/git"
    for transition in 1..5 {
        let current = (git-config-read $git include.path)
        let managed = ($current | where {|include| $include == $legacy or $include == $canonical })
        if $managed == [$canonical] { return }

        let managed_value = (if ($managed | any {|include| $include == $legacy }) { $legacy } else { $canonical })
        let write = (git-config-write-with-retry $git include.path [
            "config" "--global" "--fixed-value" "--replace-all"
            "include.path" $canonical $managed_value
        ])
        if not $write.ok {
            let after = (git-config-read $git include.path)
            let after_managed = ($after | where {|include| $include == $legacy or $include == $canonical })
            if $after_managed == [$canonical] { return }
            if $after_managed == $managed {
                error make { msg: $"Git config setup failed for include.path: ($write.detail)" }
            }
        }
    }
    let current = (git-config-read $git include.path)
    let managed = ($current | where {|include| $include == $legacy or $include == $canonical })
    if $managed == [$canonical] { return }
    error make { msg: "Git config setup failed for include.path: did not converge" }
}

ensure-git-config core.pager delta
ensure-git-config interactive.diffFilter 'delta --color-only'
ensure-git-config delta.navigate "true"
ensure-git-config merge.conflictStyle zdiff3
ensure-git-config merge.tool nvimdiff
ensure-git-include ($env.HOME | path join ".config/delta/themes.gitconfig")

# ─── ALS Theme Monitor ───
const ALS_LABEL = "com.user.als-theme"

def als-plist-path [] {
    $env.HOME | path join "Library/LaunchAgents/com.user.als-theme.plist"
}

def als-domain-target [] {
    $"gui/(^/usr/bin/id -u | str trim)"
}

def als-service-target [] {
    $"(als-domain-target)/($ALS_LABEL)"
}

def launchctl-or-fail [action: string, ...args: string] {
    let launchctl = ($env.DOTFILES_LAUNCHCTL? | default "/bin/launchctl")
    let result = (do { ^$launchctl ...$args } | complete)
    if $result.exit_code != 0 {
        let detail = ($result.stderr | str trim)
        error make { msg: $"als ($action) failed: ($detail)" }
    }
}

def als-job [] {
    let launchctl = ($env.DOTFILES_LAUNCHCTL? | default "/bin/launchctl")
    do { ^$launchctl print (als-service-target) } | complete
}

def als-job-missing [job: record] {
    let detail = ($job.stderr | str trim)
    $job.exit_code == 113 or ($detail | str contains "Could not find service")
}

def als-plist-generation [] {
    if not (als-plist-path | path exists) { return null }

    open --raw (als-plist-path) |
        parse --regex '<key>ALS_CONFIG_GENERATION</key>\s*<string>(?<generation>[^<]+)</string>' |
        get -o 0.generation
}

def als-job-has-identity [job: record] {
    let expected_plist = $"path = (als-plist-path)"
    let expected_program = $"program = ($env.HOME | path join '.local' 'bin' 'als_reader')"
    let generation = (als-plist-generation)
    let lines = ($job.stdout | lines | each {|line| $line | str trim })
    (($lines | any {|line| $line == $expected_plist }) and
        ($lines | any {|line| $line == $expected_program }) and
        ($generation != null) and
        ($lines | any {|line| $line == $"ALS_CONFIG_GENERATION => ($generation)" }))
}

def als-job-state [job: record] {
    if $job.exit_code != 0 { return "unregistered" }

    if not (als-job-has-identity $job) {
        "stale"
    } else if ($job.stdout | parse --regex 'last exit code = (?<code>\d+)' | get -o 0.code | default "0" | into int) != 0 {
        "failed"
    } else {
        "healthy"
    }
}

def "als start" [] {
    let job = (als-job)
    if $job.exit_code == 0 {
        let state = (als-job-state $job)
        if $state == "healthy" {
            print "als-theme already loaded"
            return
        }
        error make { msg: $"als start failed: existing job is ($state); use `als reload`" }
    } else if not (als-job-missing $job) {
        error make { msg: $"als start failed: ($job.stderr | str trim)" }
    }
    launchctl-or-fail start bootstrap (als-domain-target) (als-plist-path)
    print "als-theme loaded"
}

def "als stop" [] {
    launchctl-or-fail stop bootout (als-service-target)
    print "als-theme unloaded"
}

def "als status" [] {
    let job = (als-job)
    if $job.exit_code != 0 {
        if (als-job-missing $job) {
            print "unregistered"
            return
        }
        error make { msg: $"als status failed: ($job.stderr | str trim)" }
    }
    print (als-job-state $job)
}

def "als reload" [] {
    let job = (als-job)
    if $job.exit_code != 0 {
        if not (als-job-missing $job) {
            error make { msg: $"als reload failed: ($job.stderr | str trim)" }
        }
        launchctl-or-fail reload bootstrap (als-domain-target) (als-plist-path)
        print "als-theme loaded"
        return
    }
    launchctl-or-fail reload bootout (als-service-target)
    launchctl-or-fail reload bootstrap (als-domain-target) (als-plist-path)
    print "als-theme reloaded"
}


# 杀死占用指定端口的进程
# 用法: kill-port <端口号>
# 示例: kill-port 8080
def kill-port [port: int] {
    if ($port < 1 or $port > 65535) {
        error make { msg: $"错误: 端口号 ($port) 超出有效范围 (1-65535)" }
    }

    print $"正在查找占用端口 ($port) 的进程..."

    # 获取操作系统
    # 获取操作系统
    let os = (sys host | get name)

    # 查找占用端口的进程 PID
    let pids = if ($os =~ "Darwin" or $os =~ "Linux") {
        try {
            ^lsof -i :($port) -t -P | lines | where { |line| $line | is-not-empty }
        } catch {
            []
        }
    } else {
        error make { msg: $"当前操作系统 ($os) 暂不支持" }
    }

    if ($pids | is-empty) {
        print $"没有找到占用端口 ($port) 的进程"
        return
    }

    # 显示进程信息
    for pid in $pids {
        try {
            let proc_info = (^ps -p $pid -o pid,comm | str trim | lines | last)
            print $"发现进程: PID=($pid), 命令=($proc_info)"
        } catch {
            print $"发现进程: PID=($pid)"
        }
    }

    # 杀死进程
    print "正在杀死进程..."
    for pid in $pids {
        try {
            ^kill -9 $pid
            print $"成功杀死进程 PID: ($pid)"
        } catch {
            print $"无法杀死进程 PID: ($pid)"
        }
    }

    print "完成"
}

# ─── skill-guard auto-scan ───────────────────────────────────────────────
# 注入扫描器: 检测 ~/.agents/skills 下平台/第三方植入的静默上报与隐藏指令
use ~/.agents/bin/skill-guard.nu

# bunx 包装: 透传所有调用,识别到 skills add/install/update 时自动跑注入扫描。
# 命中可疑项时交互询问是否清理 (装完 -> 检测 -> 清理 闭环)。
# nushell 无"命令执行后"hook, skills CLI 也未开放安装钩子, 故用 --wrapped 包装实现。
def --wrapped bunx [...args] {
    ^bunx ...$args
    let sub = ($args | get -o 0 | default "" | into string)
    let act = ($args | get -o 1 | default "" | into string)
    let act2 = ($args | get -o 2 | default "" | into string)
    let hit = (
        # 旧 skills CLI: bunx skills add|install|update|i
        ($sub == "skills" and ($act in ["add" "install" "update" "i"]))
        # 新 agentbuddy CLI: bunx agentbuddy[@ver] skill add|install|update
        or (($sub | str starts-with "agentbuddy") and $act == "skill" and ($act2 in ["add" "install" "update"]))
    )
    if $hit {
        print $"(ansi cyan)── skill-guard 注入扫描 ──(ansi reset)"
        skill-guard
        let n = (skill-guard --quiet)
        if $n > 0 {
            let answer = (input $"(ansi yellow)发现 ($n) 类可疑项, 是否立即清理遥测块/.ai-extension? [y/N] (ansi reset)")
            if ($answer | str lowercase | str trim) in ["y" "yes"] {
                skill-guard --clean
                print $"(ansi cyan)── 清理后复核 ──(ansi reset)"
                skill-guard
            } else {
                print "已跳过清理。可随时手动运行: skill-guard --clean"
            }
        }
    }
}
# ─────────────────────────────────────────────────────────────────────────
