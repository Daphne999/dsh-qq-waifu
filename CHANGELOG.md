# Changelog

## 0.2.0 — 2026-11-05

**自动分条上线**：不再需要我主动调用工具，正常回复也会自动拆条。

- 新增 `outbound/` 补丁（`apply-patch.mjs`），改 dsh-qqbot 的 `outbound-buffer.js` 与 `outbound.js` 两处发送路径
- 需要把 `im-qqbot` 的 `streaming` 设为 `false`（流式通道会让补丁失效）
- 新增 `stripTrailingChars` 配置：句末去掉句号，保留 `？！`（真人不打句号）
- 新增 8 秒内同内容去重（两条发送路径都会触发，避免重复投递）
- 实测：一条 4 句的回复拆成 4 条独立消息，句末无句号
- 配置改为 `local/waifu-split.json`，**改完立刻生效不用重启**

## 0.1.0 — 2026-11-05

首个版本（骨架 + 手动逐句发送）。

- `waifu_split`：预览切分与停顿节奏
- `waifu_say`：切分 → 逐条发送 → 打字间隔，失败即停，可中止
- `waifu_status`：查看当前设置
- 切分纯函数 `lib/splitter.mjs`，9 项单测
- 发送循环 `lib/sender.mjs`，4 项单测（顺序 / 失败 / 中止 / 节奏）
- 烟测 5 项全过
