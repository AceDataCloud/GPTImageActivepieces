# GPT Image for Activepieces

通过 Ace Data Cloud 创建 GPT Image 任务，并按**同一个任务 ID**查询结果。Piece 提供 **Create GPT Image task** 和 **Get GPT Image task** 两个动作。提交返回 ID 并不代表图片已完成；查询到 `succeeded` 后才可使用成品。[English](README.md)

**分发方式：**在 Activepieces 实例中将 `@acedatacloud/piece-gpt-image@0.1.0` 作为自定义 Piece 安装。公开 npm 包不会自动进入 Activepieces 共享目录。

## 安装与连接

Activepieces 0.92.2+ 中进入 **Platform Admin → Catalogue → Pieces → Install Piece → NPM Registry**，填写 `@acedatacloud/piece-gpt-image` 和版本 `0.1.0`。在流程中搜索 **GPT Image by Ace Data Cloud**，核对 Ace Data Cloud Logo 和两个动作。

创建连接时使用同时有 `/openai/images/generations` 与 `/openai/tasks` 权限的 Ace Data Cloud API Key。只填写 Key 本身，不加 `Bearer `；Key 留在连接中，不写入流程导出。生成前查看当前[价格](https://platform.acedata.cloud/models)与余额。

## 首次流程

1. 添加 **Create GPT Image task**，填写提示词，选择 `gpt-image-2`、`low`、`1024x1024` 和图片数量 `1`。
2. **只运行一次**创建动作，保存输出的 `task_id`。动作使用 `callback_url` 异步提交，不设置 HTTP 重试。若超时或返回 5xx，先查请求历史再考虑重提，任务可能已被接收。
3. 添加 **Get GPT Image task**，把 **Task ID** 映射为创建动作的输出。只查询同一个 ID，直至 `status=succeeded` 或 `failed`。pending 时不会把预览当作最终媒体。
4. 仅当 `success=true` 时打开 `media_urls`。若原始请求自带自定义 Trace ID 且丢失任务 ID，也可按 Trace ID 查询；本 Piece 的创建动作不设置自定义 Trace ID。

[无密钥首跑流程](https://raw.githubusercontent.com/AceDataCloud/GPTImageActivepieces/main/examples/gpt-image-quickstart.json) 导入后两个连接均为空，任务 ID 映射保留。运行前请配置自己的连接；创建动作已关闭自动重试。

图片数量为 1–10；每张成功图片可能单独计费。`size` 使用 `WIDTHxHEIGHT`，自定义尺寸限制以 GPT Image 2 公开指南为准。查询任务不会再次生成或计费。

隔离的 Activepieces CE 0.92.2 实例已接受构建归档，并通过 **Get GPT Image task** 查询一条既有完成任务；流程返回 `succeeded` 和 1 个最终图片 URL。本轮未通过创建动作提交新的付费图片任务。

## 排障

| 现象 | 处理 |
| --- | --- |
| 401 / 403 | 核对 Key、GPT Image 权限和两个路径的 Allowed APIs。 |
| 400 | 核对提示词、模型、`WIDTHxHEIGHT` 尺寸和图片数量。 |
| `pending` | 等待并查询同一任务 ID，不重跑创建。 |
| 429 | 降低并发，避免自动重试付费创建。 |
| 创建超时或 5xx | 先检查请求历史，再考虑再次提交。 |
| `failed` 或任务不存在 | 检查任务或 Trace ID 及保留期限。 |

Piece 只向 `https://api.acedata.cloud` 发送所选输入和 API Key，仅在终态返回媒体 URL，并过滤内部路由字段。[源码](https://github.com/AceDataCloud/GPTImageActivepieces) · [支持](https://github.com/AceDataCloud/GPTImageActivepieces/issues) · dev@acedata.cloud。
