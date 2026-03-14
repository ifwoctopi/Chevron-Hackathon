import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'

loadEnvFiles(['.env', '.env.local', 'src/.env'])

const PORT = Number(process.env.PORT || 8787)
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env['GEMINI-API-KEY']
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

if (!GEMINI_API_KEY) {
  console.warn('Gemini API key not found. Set GEMINI_API_KEY (preferred) or GEMINI-API-KEY in .env.')
}

function loadEnvFiles(paths) {
  paths.forEach((path) => {
    if (!existsSync(path)) return

    const content = readFileSync(path, 'utf8')
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return

      const separator = trimmed.indexOf('=')
      if (separator <= 0) return

      const key = trimmed.slice(0, separator).trim()
      let value = trimmed.slice(separator + 1).trim()

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      if (process.env[key] === undefined) {
        process.env[key] = value
      }
    })
  })
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': CLIENT_ORIGIN,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(JSON.stringify(payload))
}

async function parseJsonBody(req) {
  const chunks = []
  let size = 0

  for await (const chunk of req) {
    size += chunk.length
    if (size > 1_000_000) {
      throw new Error('Payload too large')
    }
    chunks.push(chunk)
  }

  const raw = Buffer.concat(chunks).toString('utf8')
  return raw ? JSON.parse(raw) : {}
}

function buildPrompt(question, telemetryContext) {
  return [
    'You are an oil-and-gas field operations copilot.',
    'Use telemetry context to answer questions, identify risk, and suggest engineer assignment.',
    'Prioritize safety, clarity, and concrete actions.',
    'When assigning engineers, include priority order, rationale, and what each engineer should do first.',
    '',
    'Telemetry context JSON:',
    JSON.stringify(telemetryContext, null, 2),
    '',
    'Operator question:',
    question,
  ].join('\n')
}

async function callGemini(question, telemetryContext) {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini key missing on server')
  }

  const prompt = buildPrompt(question, telemetryContext)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 700,
      },
    }),
  })

  const payload = await response.json()

  if (!response.ok) {
    const message = payload?.error?.message || 'Gemini API request failed'
    throw new Error(message)
  }

  const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim()

  if (!text) {
    throw new Error('Gemini returned an empty response')
  }

  return {
    text,
    model: GEMINI_MODEL,
  }
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true })
    return
  }

  if (req.method === 'GET' && requestUrl.pathname === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      model: GEMINI_MODEL,
      hasKey: Boolean(GEMINI_API_KEY),
    })
    return
  }

  if (req.method === 'POST' && requestUrl.pathname === '/api/gemini/chat') {
    try {
      const body = await parseJsonBody(req)
      const question = String(body.question || '').trim()
      const telemetryContext = body.telemetryContext || {}

      if (!question) {
        sendJson(res, 400, { error: 'Question is required' })
        return
      }

      const result = await callGemini(question, telemetryContext)
      sendJson(res, 200, result)
      return
    } catch (error) {
      sendJson(res, 500, { error: error.message || 'Server error' })
      return
    }
  }

  sendJson(res, 404, { error: 'Not found' })
})

server.listen(PORT, () => {
  console.log(`Gemini server listening on http://localhost:${PORT}`)
})
