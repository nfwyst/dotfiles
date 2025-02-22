local review_prompt = string.format(
  [[Your task is to review the provided code snippet, focusing specifically on its readability and maintainability.
Identify any issues related to:
- Naming conventions that are unclear, misleading or doesn't follow conventions for the language being used.
- The presence of unnecessary comments, or the lack of necessary ones.
- Overly complex expressions that could benefit from simplification.
- High nesting levels that make the code difficult to follow.
- The use of excessively long names for variables or functions.
- Any inconsistencies in naming, formatting, or overall coding style.
- Repetitive code patterns that could be more efficiently handled through abstraction or optimization.

Your feedback must be concise, directly addressing each identified issue with:
- A clear description of the problem.
- A concrete suggestion for how to improve or correct the issue.

Format your feedback as follows:
- Explain the high-level issue or problem briefly.
- Provide a specific suggestion for improvement.

If the code snippet has no readability issues, simply confirm that the code is clear and well-written as is.
]]
)

local opts = { contains_code = true }

return {
  ["Generate a Commit Message"] = {
    prompts = {
      {
        role = "user",
        content = function()
          return "Write commit message with commitizen convention. Write clear, informative commit messages that explain the 'what' and 'why' behind changes, not just the 'how'."
            .. "\n\n```\n"
            .. fn.system("git diff")
            .. "\n```"
        end,
        opts = opts,
      },
    },
  },
  ["Generate a Commit Message for Staged Files"] = {
    strategy = "chat",
    description = "Generate a commit message for staged change",
    opts = {
      is_slash_cmd = true,
      short_name = "staged-commit",
      auto_submit = true,
    },
    prompts = {
      {
        role = "user",
        content = function()
          return "Write commit message for the change with commitizen convention. Write clear, informative commit messages that explain the 'what' and 'why' behind changes, not just the 'how'."
            .. "\n\n```\n"
            .. fn.system("git diff --staged")
            .. "\n```"
        end,
        opts = opts,
      },
    },
  },
  ["Add Documentation"] = {
    strategy = "inline",
    description = "Add documentation to the selected code",
    opts = {
      is_default = true,
      modes = { "v" },
      short_name = "doc",
      is_slash_cmd = true,
      auto_submit = true,
      user_prompt = false,
      stop_context_insertion = true,
    },
    prompts = {
      {
        role = "system",
        content = [[
                When asked to add documentation, follow these steps:
                1. **Identify Key Points**: Carefully read the provided code to understand its functionality.
                2. **Plan the Documentation**: Describe the key points to be documented in pseudocode, detailing each step.
                3. **Implement the Documentation**: Write the accompanying documentation in the same file or a separate file.
                4. **Review the Documentation**: Ensure that the documentation is comprehensive and clear. Ensure the documentation:
                  - Includes necessary explanations.
                  - Helps in understanding the code's functionality.
                  - Add parameters, return values, and exceptions documentation.
                  - Follows best practices for readability and maintainability.
                  - Is formatted correctly.

                Use Markdown formatting and include the programming language name at the start of the code block.]],
        opts = {
          visible = false,
        },
      },
      {
        role = "user",
        content = function(context)
          local code = require("codecompanion.helpers.actions").get_code(context.start_line, context.end_line)

          return "Please document the selected code:\n\n```" .. context.filetype .. "\n" .. code .. "\n```\n\n"
        end,
        opts = opts,
      },
    },
  },
  ["Refactor"] = {
    strategy = "chat",
    description = "Refactor the selected code for readability, maintainability and performances",
    opts = {
      is_default = true,
      modes = { "v" },
      short_name = "refactor",
      is_slash_cmd = true,
      auto_submit = true,
      user_prompt = false,
      stop_context_insertion = true,
    },
    prompts = {
      {
        role = "system",
        content = [[
                When asked to optimize code, follow these steps:
                1. **Analyze the Code**: Understand the functionality and identify potential bottlenecks.
                2. **Implement the Optimization**: Apply the optimizations including best practices to the code.
                3. **Shorten the code**: Remove unnecessary code and refactor the code to be more concise.
                3. **Review the Optimized Code**: Ensure the code is optimized for performance and readability. Ensure the code:
                  - Maintains the original functionality.
                  - Is more efficient in terms of time and space complexity.
                  - Follows best practices for readability and maintainability.
                  - Is formatted correctly.

                Use Markdown formatting and include the programming language name at the start of the code block.]],
        opts = {
          visible = false,
        },
      },
      {
        role = "user",
        content = function(context)
          local code = require("codecompanion.helpers.actions").get_code(context.start_line, context.end_line)

          return "Please optimize the selected code:\n\n```" .. context.filetype .. "\n" .. code .. "\n```\n\n"
        end,
        opts = opts,
      },
    },
  },
  ["PullRequest"] = {
    strategy = "chat",
    description = "Generate a Pull Request message description",
    opts = {
      is_default = true,
      short_name = "pr",
      is_slash_cmd = true,
      auto_submit = true,
    },
    prompts = {
      {
        role = "user",
        content = function()
          return "You are an expert at writing detailed and clear pull request descriptions."
            .. "Please create a pull request message following standard convention from the provided diff changes."
            .. "Ensure the title, description, type of change, checklist, related issues, and additional notes sections are well-structured and informative."
            .. "\n\n```diff\n"
            .. fn.system("git diff $(git merge-base HEAD main)...HEAD")
            .. "\n```"
        end,
        opts = opts,
      },
    },
  },
  ["Spell"] = {
    strategy = "inline",
    description = "Correct grammar and reformulate",
    opts = {
      is_default = true,
      short_name = "spell",
      is_slash_cmd = true,
      auto_submit = true,
    },
    prompts = {
      {
        role = "user",
        content = function(context)
          local text = require("codecompanion.helpers.actions").get_code(context.start_line, context.end_line)
          return "Correct grammar and reformulate:\n\n" .. text
        end,
        opts = opts,
      },
    },
  },
  ["Review"] = {
    strategy = "chat",
    description = "Review the provided code snippet.",
    opts = {
      modes = { "v" },
      short_name = "review",
      auto_submit = true,
      user_prompt = false,
      stop_context_insertion = true,
    },
    prompts = {
      {
        role = "system",
        content = review_prompt,
        opts = {
          visible = false,
        },
      },
      {
        role = "user",
        content = function(context)
          local code = require("codecompanion.helpers.actions").get_code(context.start_line, context.end_line)

          return "Please review the following code and provide suggestions for improvement then refactor the following code to improve its clarity and readability:\n\n```"
            .. context.filetype
            .. "\n"
            .. code
            .. "\n```\n\n"
        end,
        opts = opts,
      },
    },
  },
  ["Naming"] = {
    strategy = "inline",
    description = "Give betting naming for the provided code snippet.",
    opts = {
      modes = { "v" },
      short_name = "naming",
      auto_submit = true,
      user_prompt = false,
      stop_context_insertion = true,
    },
    prompts = {
      {
        role = "user",
        content = function(context)
          local code = require("codecompanion.helpers.actions").get_code(context.start_line, context.end_line)

          return "Please provide better names for the following variables and functions:\n\n```"
            .. context.filetype
            .. "\n"
            .. code
            .. "\n```\n\n"
        end,
        opts = opts,
      },
    },
  },
}
