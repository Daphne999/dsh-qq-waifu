/**
 * dsh-qq-waifu —— 把 OPERIT 的 "Waifu 模式" 里能搬到 QQ 的部分做出来。
 *
 * OPERIT 的四件事 → QQ 侧对应做法：
 *   1. 逐句发送（按标点切、一句一条、带打字间隔）→ 本插件的 waifu_say 工具
 *   2. 合并发送（连发多条短消息，停顿后合成一条）→ 由 qqbot 的 debounce 补丁负责
 *   3. 间隔/打字速度 → 配置项（perCharMs / minDelayMs / maxDelayMs）
 *   4. 绑定角色卡 → QQ 侧没有角色卡概念，用 preset / 人设代替
 *
 * 设计原则：不劫持 qqbot 的回复链路（那要改它的流式发送，风险高）；
 * 而是提供"逐句发送"的能力，由 agent 在需要时调用。
 */
import Schema from '@deepseek-ai/schemastery'
import http from 'node:http'
import { splitReply, typingDelayMs } from './splitter.mjs'
import { sendSentences } from './sender.mjs'

export const name = 'dsh-qq-waifu'
export const inject = []

export const Config = Schema.object({
  enabled: Schema.boolean().default(true).description('总开关：关掉后工具仍然注册但会拒绝发送'),
  maxChunks: Schema.number().default(5).description('一条回复最多切成几段'),
  minChunkChars: Schema.number().default(4).description('短于这个字数的片段并进前一段'),
  maxChunkChars: Schema.number().default(60).description('长于这个字数的片段按逗号再切'),
  perCharMs: Schema.number().default(45).description('每个字折算多少毫秒"打字时间"'),
  minDelayMs: Schema.number().default(180).description('两条之间最短停顿'),
  maxDelayMs: Schema.number().default(1800).description('两条之间最长停顿'),
  notifyPath: Schema.string().default('/wechat/qq-notify/test').description('发送通道（默认复用 qq-notify 的 HTTP 路由）'),
  notifyPort: Schema.number().default(0).description('发送通道端口；0 = 自动探测宿主端口'),
})

/** 宿主端口：0 时问 webServer 要，问不到再退回环境变量 */
function hostPort(ctx, config) {
  if (config.notifyPort) return Number(config.notifyPort)
  try {
    const ws = ctx.get('webServer')
    const p = ws?.port ?? ws?.server?.address?.()?.port
    if (p) return Number(p)
  } catch {}
  return Number(process.env.DSH_PORT || process.env.DSH_WEB_PORT || 61310)
}

/** 通过 qq-notify 的 HTTP 路由发一条纯文本 */
function makeSender(ctx, config) {
  return async (text) => {
    const port = hostPort(ctx, config)
    await new Promise((resolve, reject) => {
      const body = JSON.stringify({ text })
      const req = http.request(
        {
          host: '127.0.0.1',
          port,
          path: config.notifyPath || '/wechat/qq-notify/test',
          method: 'POST',
          headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
          timeout: 15000,
        },
        (res) => {
          res.resume()
          res.on('end', () => (res.statusCode && res.statusCode < 400 ? resolve() : reject(new Error(`发送通道返回 ${res.statusCode}`))))
        },
      )
      req.on('error', (e) => reject(new Error(`发送失败：${e.message}`)))
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('发送超时'))
      })
      req.write(body)
      req.end()
    })
  }
}

export async function apply(ctx, config) {
  const log = (line) => {
    try {
      ctx.logger?.info?.(`[dsh-qq-waifu] ${line}`)
    } catch {}
    try {
      console.log(`[dsh-qq-waifu] ${line}`)
    } catch {}
  }

  let tools
  try {
    tools = ctx.get('tools')
  } catch {
    tools = undefined
  }
  if (!tools?.register) {
    log('⚠️ tools 服务不可用，waifu_* 未注册')
    return
  }

  const opts = () => ({
    maxChunks: config.maxChunks,
    minChunkChars: config.minChunkChars,
    maxChunkChars: config.maxChunkChars,
    perCharMs: config.perCharMs,
    minDelayMs: config.minDelayMs,
    maxDelayMs: config.maxDelayMs,
  })

  // 1) 预览：只切分不发送
  tools.register({
    name: 'waifu_split',
    description:
      'Preview how a reply would be split into separate chat bubbles (Waifu mode). Returns the chunks and the estimated '
      + 'typing delay between them. Use it to check tone before actually sending.',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string', description: 'The full reply text.' } },
      required: ['text'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', properties: { ok: { type: 'boolean' }, report: { type: 'string' } }, required: ['ok', 'report'], additionalProperties: false },
      render: (_a, v) => [{ type: 'text', text: v?.report ?? '' }],
    },
    async execute(args) {
      const text = String(args?.text || '').trim()
      if (!text) return { ok: false, report: 'text 为空' }
      const o = opts()
      const chunks = splitReply(text, o)
      const lines = chunks.map((c, i) => {
        const d = i < chunks.length - 1 ? typingDelayMs(c, { perCharMs: o.perCharMs, minMs: o.minDelayMs, maxMs: o.maxDelayMs }) : 0
        return `${i + 1}. 「${c}」${d ? ` → 停 ${d}ms` : ''}`
      })
      return { ok: true, report: `会切成 ${chunks.length} 条：\n${lines.join('\n')}` }
    },
  })

  // 2) 真正逐条发送
  tools.register({
    name: 'waifu_say',
    description:
      'Send a reply as several short chat messages, like a human typing (Waifu mode). Splits on punctuation, sends each '
      + 'chunk with a typing-like delay, and stops if a send fails. Prefer this for casual chat replies; use one message for '
      + 'long technical answers.',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string', description: 'The full reply text to split and send.' } },
      required: ['text'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object', properties: { ok: { type: 'boolean' }, report: { type: 'string' } }, required: ['ok', 'report'], additionalProperties: false },
      render: (_a, v) => [{ type: 'text', text: v?.report ?? '' }],
    },
    async execute(args) {
      if (config.enabled === false) return { ok: false, report: 'Waifu 模式已关闭（config.enabled=false）' }
      const text = String(args?.text || '').trim()
      if (!text) return { ok: false, report: 'text 为空' }
      const send = makeSender(ctx, config)
      const res = await sendSentences(text, send, opts())
      if (res.failedAt !== null) {
        return { ok: false, report: `发了 ${res.sent.length} 条后失败（第 ${res.failedAt + 1} 条）：${res.error}` }
      }
      return { ok: true, report: `已按 ${res.sent.length} 条发出：\n${res.sent.map((s, i) => `${i + 1}. ${s}`).join('\n')}` }
    },
  })

  // 3) 状态
  tools.register({
    name: 'waifu_status',
    description: 'Show the current Waifu-mode settings (chunking limits, typing pace, send channel).',
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
    output: {
      schema: { type: 'object', properties: { ok: { type: 'boolean' }, report: { type: 'string' } }, required: ['ok', 'report'], additionalProperties: false },
      render: (_a, v) => [{ type: 'text', text: v?.report ?? '' }],
    },
    async execute() {
      return {
        ok: true,
        report: [
          `开关：${config.enabled === false ? '关' : '开'}`,
          `切分：最多 ${config.maxChunks} 段；短于 ${config.minChunkChars} 字并入前段；长于 ${config.maxChunkChars} 字按逗号再切`,
          `节奏：每字 ${config.perCharMs}ms，单条停顿 ${config.minDelayMs}~${config.maxDelayMs}ms`,
          `通道：127.0.0.1:${hostPort(ctx, config)}${config.notifyPath || '/wechat/qq-notify/test'}`,
          '入站合并：由 qqbot 的 debounce 补丁负责（连续多条短消息停顿后合并）',
        ].join('\n'),
      }
    },
  })

  log('✅ waifu_split / waifu_say / waifu_status 已注册')
}
