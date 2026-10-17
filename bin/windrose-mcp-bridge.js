#!/usr/bin/env node
/**
 * windrose-mcp-bridge — a local stdio MCP server that forwards every message to
 * the WindRose remote MCP endpoint, for clients that only speak stdio or cannot
 * send a custom Authorization header.
 *
 *   WINDROSE_API_KEY=wr_xxxxxxxxxxxxxxxx.<secret>  npx -y github:gabriele-wink/windrose-mcp-claude
 *
 * Environment:
 *   WINDROSE_API_KEY   required — "<key_id>.<key_secret>" from WindRose Settings → API & MCP access
 *   WINDROSE_MCP_URL   optional — default https://app.windroses.world/api/mcp.php
 *
 * Transport: newline-delimited JSON-RPC on stdin/stdout (MCP stdio). Each line is
 * POSTed as-is; the JSON reply is written back as one line; notifications (HTTP
 * 202) produce no output. Logs go to stderr only — stdout is the protocol.
 * No dependencies: Node 18+ (built-in fetch).
 */
'use strict'

const readline = require('node:readline')

const URL_ = process.env.WINDROSE_MCP_URL || 'https://app.windroses.world/api/mcp.php'
const KEY = (process.env.WINDROSE_API_KEY || '').trim()
const VERSION = require('../package.json').version

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stderr.write(`windrose-mcp-bridge ${VERSION}\n\nUsage: WINDROSE_API_KEY=<key_id>.<key_secret> windrose-mcp-bridge\nForwards MCP stdio to ${URL_}\n`)
  process.exit(0)
}
if (!/^wr_[0-9a-f]{16}\.[0-9a-f]{48}$/i.test(KEY)) {
  process.stderr.write('windrose-mcp-bridge: set WINDROSE_API_KEY to "<key_id>.<key_secret>" (WindRose Settings → API & MCP access)\n')
  process.exit(1)
}

const log = (...a) => process.stderr.write(`[windrose-mcp-bridge] ${a.join(' ')}\n`)
const send = (obj) => process.stdout.write(JSON.stringify(obj) + '\n')
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

let protocolVersion = null

async function forward(line) {
  let msg
  try { msg = JSON.parse(line) } catch { send(rpcError(null, -32700, 'Parse error')); return }
  const ids = Array.isArray(msg) ? msg.filter(m => m && 'id' in m).map(m => m.id) : (msg && 'id' in msg ? [msg.id] : [])
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${KEY}`,
    'User-Agent': `windrose-mcp-bridge/${VERSION}`,
  }
  if (protocolVersion) headers['MCP-Protocol-Version'] = protocolVersion
  try {
    const res = await fetch(URL_, { method: 'POST', headers, body: line, signal: AbortSignal.timeout(90_000) })
    if (res.status === 202) return
    const text = await res.text()
    let body
    try { body = JSON.parse(text) } catch {
      log(`HTTP ${res.status}: non-JSON reply`)
      ids.forEach(id => send(rpcError(id, -32603, `WindRose MCP answered HTTP ${res.status}`)))
      return
    }
    // Remember the negotiated version, as the Streamable HTTP transport asks.
    const init = Array.isArray(body) ? null : body?.result?.protocolVersion
    if (init) protocolVersion = init
    // An auth/plan/rate error comes back without the request id: give it one.
    if (!Array.isArray(body) && body.error && body.id == null && ids.length === 1) body.id = ids[0]
    send(body)
  } catch (e) {
    log(`request failed: ${e.message}`)
    ids.forEach(id => send(rpcError(id, -32603, `Cannot reach WindRose MCP: ${e.message}`)))
  }
}

// Sequential, so replies leave in the order requests arrived.
let queue = Promise.resolve()
const rl = readline.createInterface({ input: process.stdin, terminal: false })
rl.on('line', (line) => {
  if (!line.trim()) return
  queue = queue.then(() => forward(line))
})
rl.on('close', () => { queue.then(() => process.exit(0)) })
log(`forwarding to ${URL_}`)
