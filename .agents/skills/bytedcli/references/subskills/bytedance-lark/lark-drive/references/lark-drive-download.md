
# drive +download

> **前置条件：** 先阅读 [`../lark-shared/GUIDE.md`](../../lark-shared/GUIDE.md) 了解认证、全局参数和安全规则。

从飞书云空间下载文件到本地。

## 命令

```bash
# 下载到指定路径
bytedcli lark drive +download --file-token boxbc_xxx --output ./report.pdf

# 只提供 token，默认保存为当前目录下同名文件
bytedcli lark drive +download --file-token boxbc_xxx
```

## URL 解析

从飞书文件 URL 提取 token：

```
https://xxx.feishu.cn/drive/file/boxbc_xxx
                                  ^^^^^^^^^
                                  file_token
```

## 参考

- [lark-drive](../GUIDE.md) -- 云空间全部命令
- [lark-shared](../../lark-shared/GUIDE.md) -- 认证和全局参数
