# dsh-qq-waifu

> 让 AI 在 QQ 里**一句一句发消息**——像人打字，而不是甩一坨。

## 它解决什么

AI 的回复永远是一整段。结构清楚，但不像人在聊天。

真人发消息是这样的：

```
在的
刚才在忙，没看到
怎么啦？
```

这个插件把「切句 + 按打字速度逐条发」做成底层能力：**AI 发出的每条回复都会自动拆成几条独立消息**，中间带停顿，句末不留句号（保留 ？！ 这类情绪标点）。

## 两种用法

| 方式 | 说明 |
|---|---|
| **自动**（推荐） | 打一遍补丁，之后**所有正常回复**都会自动分条，不用我操心 |
| 手动 | `waifu_say` 工具：我主动把一段话拆开发；`waifu_split` 只预览不发 |

## 安装

```bash
# 1) 挂进 profile（或直接从市场装）
mklink /J "C:\Users\Isabella\.dsh\profiles\desktop\node_modules\dsh-qq-waifu" "D:\ds工作区\dsh-qq-waifu"

# 2) 给 dsh-qqbot 打分条补丁（幂等，可 --revert）
node outbound/apply-patch.mjs

# 3) 关掉 qqbot 的流式输出（否则回复走流式通道，补丁不生效）
#    profile/cordis.patch.yml → id: im-qqbot → config: streaming: false

# 4) 重启 DSH
```

`apply-patch.mjs --check` 查状态，`--revert` 撤销（会从 `.waifu-orig` 还原）。

## 配置

`~/.dsh/profiles/desktop/local/waifu-split.json`（**改完立刻生效，不用重启**）：

| 键 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关 |
| `maxChunks` | 5 | 一条回复最多拆几条 |
| `minChunkChars` | 4 | 短于这个字数并进前一句（避免"嗯""好"刷屏） |
| `maxChunkChars` | 60 | 长于这个字数按逗号再切 |
| `perCharMs` | 45 | 每个字折算多少毫秒"打字时间" |
| `minDelayMs` / `maxDelayMs` | 180 / 1800 | 单条停顿上下限 |
| `stripTrailingChars` | `。` | 句末要去掉的字符；留空保留原标点 |
| `onlyTags` | `["sendMarkdown"]` | 只对整条回复动手，工具结果不拆 |

## 可以和谁一起用

这个插件只管「**话怎么发出去**」，不管「**谁在说话**」。所以它可以和这些人格 / 接通道类插件叠加：

- `dsh-aurabot-qq`（人设角色住进 QQ，语音条 / 表情包）
- `dsh-fish-soul`（同一角色跨 QQ / B站 / 抖音）
- `dsh-identity`（身份系统：内核、traits、心情、关系）
- `dsh-qq-access` / `dsh-qq-bridge`（NapCat / OneBot 通道）

叠加后，它们产生的回复也会自动分条——**这是底层能力的价值**。

## 安全设计

- 切分是纯函数，9 项单测（短句合并 / 长句切逗号 / 上限截断 / 去句号 / 空输入）
- 发送循环 4 项单测（顺序 / 失败即停 / 可中止 / 节奏）
- **8 秒内同内容去重**：qqbot 的两条发送路径可能各触发一次，重复投递会被吞掉
- 失败即停：某条发不出去就报位置，不会把剩下的话硬塞
- 补丁带 `.waifu-orig` 备份，随时 `--revert`

## 已知限制

- **改 dist 需要重启**：qqbot 的模块不会被热加载
- **dsh-qqbot 升级会覆盖 dist**，升级后必须重跑 `apply-patch.mjs`
- 关掉 streaming 后**失去"边生成边显示"的效果**（换来的是整条回复的分句节奏）
- 依赖 qqbot 的发送链结构，版本大改时补丁可能失效——`--check` 会告诉你

## License

MIT
