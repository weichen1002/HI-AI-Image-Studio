import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const SOURCE_REPO = 'YouMind-OpenLab/awesome-gpt-image-2'
const SOURCE_PATH = 'README_zh.md'
const SOURCE_URL = 'https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/README_zh.md'

function parseLimit() {
  const args = process.argv.slice(2)
  const fromEnv = Number(process.env.SYNC_LIMIT || '')
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv)
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--limit=')) {
      const n = Number(a.slice('--limit='.length))
      if (Number.isFinite(n) && n > 0) return Math.floor(n)
    }
    if (a === '--limit') {
      const n = Number(args[i + 1])
      if (Number.isFinite(n) && n > 0) return Math.floor(n)
    }
  }
  return 50
}

function sha1(input) {
  return crypto.createHash('sha1').update(String(input || ''), 'utf8').digest('hex')
}

function extractSection(markdown) {
  const all = String(markdown || '').match(/##\s*📋\s*所有提示词[\s\S]*?(?=\n##\s|$)/)
  if (all) return all[0]
  const featured = String(markdown || '').match(/##\s*🔥\s*精选提示词[\s\S]*?(?=\n##\s|$)/)
  return featured ? featured[0] : ''
}

function extractBlocks(section) {
  const parts = String(section || '').split(/\n(?=###\s)/g)
  return parts
    .map((p) => p.trim())
    .filter((p) => p.startsWith('### '))
}

function extractTitle(block) {
  const m = block.match(/^###\s+(.+?)\s*$/m)
  return m ? m[1].trim() : ''
}

function extractPureTitle(title) {
  const t = String(title || '').trim()
  if (!t) return ''
  const parts = t.split(/\s-\s/)
  if (parts.length > 1) return parts.slice(1).join(' - ').trim()
  const m = t.match(/No\.\s*\d+:\s*(.+)$/)
  return m ? m[1].trim() : t
}

function extractDesc(block) {
  const m = block.match(/####\s*📖\s*描述\s*[\r\n]+([\s\S]*?)(?=\n####|\n---|\n###\s)/)
  if (!m) return ''
  return m[1]
    .replace(/^\s+|\s+$/g, '')
    .replace(/\n{3,}/g, '\n\n')
}

function extractPrompt(block) {
  const m = block.match(/####\s*📝\s*提示词[\s\S]*?```[^\n]*\n([\s\S]*?)```/)
  return m ? String(m[1] || '').replace(/^\s+|\s+$/g, '') : ''
}

function extractCoverImage(block) {
  const m = block.match(/<img[^>]+src="([^"]+)"/i)
  if (m) return m[1]
  const m2 = block.match(/!\[[^\]]*]\((https?:\/\/[^\s)]+)\)/)
  return m2 ? m2[1] : ''
}

function extractTryUrl(block) {
  const m = block.match(/\*\*\[👉[^\]]*]\((https?:\/\/[^\s)]+)\)\*\*/)
  return m ? m[1] : ''
}

function extractCategory(title) {
  const m = String(title || '').match(/No\.\s*\d+:\s*([^-\n]+?)\s*-\s*/)
  if (m) return m[1].trim()
  return '提示词'
}

function toTemplate(block) {
  const originalTitle = extractTitle(block)
  const title = extractPureTitle(originalTitle)
  const desc = extractDesc(block)
  const prompt = extractPrompt(block)
  if (!originalTitle || !title || !prompt) return null

  const coverImage = extractCoverImage(block)
  const url = extractTryUrl(block)
  const id = sha1(`${originalTitle}\n${prompt}`).slice(0, 12)

  return {
    id,
    category: extractCategory(originalTitle),
    title,
    desc,
    coverImage,
    prompt,
    source: {
      repo: SOURCE_REPO,
      path: SOURCE_PATH,
      url
    }
  }
}

async function main() {
  const limit = parseLimit()
  const res = await fetch(SOURCE_URL, {
    headers: {
      'user-agent': 'hi-image-studio-sync/1.0'
    }
  })
  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status} ${res.statusText}`)
  }
  const markdown = await res.text()
  const section = extractSection(markdown)
  if (!section) {
    throw new Error('cannot find featured section')
  }

  const blocks = extractBlocks(section)
  const templates = blocks.map(toTemplate).filter(Boolean).slice(0, limit)

  const outDir = path.join(process.cwd(), 'public', 'data')
  const outFile = path.join(outDir, 'inspiration-templates.json')
  await fs.mkdir(outDir, { recursive: true })
  await fs.writeFile(outFile, JSON.stringify(templates, null, 2) + '\n', 'utf8')
  process.stdout.write(`generated ${templates.length} templates -> ${outFile}\n`)
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err?.message || err) + '\n')
  process.exit(1)
})
