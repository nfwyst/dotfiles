import argparse
import os
import ell
from ell import Message
from openai import OpenAI

MODEL = "deepseek-chat"

api_key = os.getenv('DEEPSEEK_API_KEY')
if api_key is None:
    raise ValueError("DEEPSEEK_API_KEY 环境变量未设置.")

client = OpenAI(
    base_url="https://api.deepseek.com/beta",
    api_key=api_key,
)

# ell.config.verbose = True

ell.config.register_model(MODEL, client)

# ell.init(store="./logdir", autocommit=True, verbose=True)


# 与用户讨论文档内容的专业聊天机器人
@ell.complex(model=MODEL, client=client, temperature=0.1)
def academic_chat_bot(
    message_history: list[Message], markdown_content: str
) -> list[Message]:
    """
    你是一个高度专业化的助手，专门帮助用户快速有效地理解专业文档。你的主要功能包括：

    1. **提取关键信息**：提供文档摘要、关键发现和重要见解，包括摘要、引言、结论以及重要的图表或公式。

    2. **澄清术语**：用简单明了的语言定义复杂或不熟悉的术语，并结合领域提供适当的上下文理解。

    3. **解释概念**：对文档中的复杂概念、方法论和理论框架提供清晰详细的解释。

    4. **识别引用**：突出显示理解文档背景或上下文所必需的重要参考文献和引用。

    5. **回答问题**：根据文档内容准确回答用户的问题。

    6. **建立联系**：帮助用户将文档中的想法与其他相关研究趋势或作品联系起来。

    7. **专注于内容**：仅根据文档内容协助用户理解，除非直接询问，否则不提供无关信息。

    **能力**：
    - 高效处理markdown格式文本，识别标题、子标题、列表和代码块。
    - 进行主题提取和总结以便快速回顾。
    - 在请求时提供相关专业内容的交叉引用。

    你将接收markdown格式的专业文档，并根据需要帮助用户尽可能高效地理解材料。
    """
    return f"上下文:\n ---------- \n {markdown_content} \n ---------------\n 历史记录: {message_history[:-1]} \n ---------- \n 问题: {message_history[-1]} \n ---------------\n 回应:"


# 将对话整理为Markdown文件的组织对话机器人
@ell.complex(model=MODEL, client=client, temperature=0.1)
def organize_conversation_bot(
    message_history: list[Message], original_content: str
) -> list[Message]:
    """
    你是负责维护、更新和改进基于另一个LLM和用户交互历史的笔记的组织助手。你的主要功能是：

    1. **读取和分析输入**：
       - **输入1**：现有的markdown笔记，可能包含摘要、解释、引用和观察等部分。
       - **输入2**：用户与另一个LLM的最近对话历史，包括见解、澄清、问题和新信息。

    2. **更新和整理笔记**：
       - **结合信息**：将对话历史中的新见解、解释和响应与现有笔记整合。
       - **清晰组织**：用适当的markdown功能（如#标题、##子标题、###子子标题，*或-列表，|表格等）清晰、有逻辑、结构化地重新组织内容。
       - **提高清晰度**：确保更新后的笔记简洁、结构良好、易于阅读。

    3. **保持Markdown格式**：
       - 使用markdown语法正确结构化输出。使用如#标题、*或-列表、|表格等适当标签。
       - 根据对话历史，在相关标题下添加新内容，并根据需要创建新部分。

    4. **改进笔记**：
       - **总结新见解**：综合对话历史创建简明扼要的总结。
       - **突出重要细节**：将对话历史中的关键点添加到笔记中，确保与现有内容一致。
       - **逻辑组织**：确保笔记逻辑流畅、易于导航，必要时重新排序部分以提高理解。

    5. **保持上下文**：
       - 保留现有markdown笔记中的关键信息，除非对话历史提供更好、更更新的版本。
       - 参考新添加的内容与现有内容，避免重复并确保一致性。
    """
    return f"现有笔记:\n ---------- \n {original_content} \n ---------------\n 对话历史: {message_history} \n ---------- \n 更新后的笔记:"


def read_markdown_file(file_path: str) -> str:
    """
    读取markdown文件的内容并返回字符串。

    参数:
        file_path (str): markdown文件的路径。

    返回:
        str: 文件内容。
    """
    try:
        with open(file_path, "r", encoding="utf-8") as file:
            content = file.read()
        return content
    except FileNotFoundError:
        raise FileNotFoundError(f"文件路径{file_path}不存在。")
    except Exception as e:
        raise Exception(f"读取文件时发生错误: {e}")


def parse_args():
    parser = argparse.ArgumentParser(description="处理一些文件。")
    parser.add_argument("input_file", type=str, help="输入markdown文件的路径。")
    parser.add_argument(
        "output_file", type=str, help="输出markdown文件的路径。"
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    input_file = args.input_file
    output_file = args.output_file
    document_content = read_markdown_file(input_file)
    original_content = (
        read_markdown_file(output_file) if os.path.exists(output_file) else ""
    )

    message_history = []

    while True:
        print("-" * 79)
        user_input = input("你: (输入'exit'退出) ")
        if user_input.lower() == "exit":
            break
        message_history.append(ell.user(user_input))
        print("-" * 79)
        print("思考中...")
        response = academic_chat_bot(message_history, document_content)
        print("Bot:", response.text)
        message_history.append(response)

    print("-" * 79)
    user_input = input("保存对话? (y/N): ")
    if user_input.lower() == "y":
        print("思考中...")
        response = organize_conversation_bot(message_history, original_content)

        with open(output_file, "w", encoding="utf-8") as file:
            file.write(response.text)

        print("对话已保存到", output_file)

    print("退出中...")

