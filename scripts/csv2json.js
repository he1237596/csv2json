import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs'
import { join, relative, dirname } from 'path'
import iconv from 'iconv-lite'

const ROOT = process.argv[2] || process.cwd()
const OUTPUT_DIR = process.env.JSON_OUTPUT_DIR || null

// ✅ 读取 CSV（自动处理 UTF-8 / GBK / BOM）
function readCsvWithEncoding(filePath) {
  const buffer = readFileSync(filePath)

  // 先按 UTF-8 读
  let text = buffer.toString('utf-8')

  // 如果出现乱码字符，尝试 GBK
  if (text.includes('�')) {
    console.log(`  ⚠️ 检测到乱码，尝试用 GBK 解码: ${filePath}`)
    text = iconv.decode(buffer, 'gbk')
  }

  // 去 BOM
  text = text.replace(/^\uFEFF/, '')

  return text
}

// 解析 CSV 行
function parseCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }

  result.push(current)
  return result
}

// 解析 CSV（支持多行字段）
function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const rows = []
  let row = []

  for (const line of lines) {
    if (row.length === 0) {
      row = parseCsvLine(line)
    } else {
      const lastField = row[row.length - 1]
      const openQuotes = (lastField.match(/"/g) || []).length

      if (openQuotes % 2 !== 0) {
        row[row.length - 1] = lastField + '\n' + line
      } else {
        rows.push(row)
        row = parseCsvLine(line)
      }
    }
  }

  if (row.length > 0 && (row.length > 1 || row[0].trim() !== '')) {
    rows.push(row)
  }

  return rows
}

// 递归查找 CSV
function findCsvFiles(dir) {
  const results = []

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      if (entry === '.git' || entry === 'node_modules') continue
      results.push(...findCsvFiles(fullPath))
    } else if (entry.toLowerCase().endsWith('.csv')) {
      results.push(fullPath)
    }
  }

  return results
}

// 主逻辑
function main() {
  console.log(`📁 扫描目录: ${ROOT}`)

  const csvFiles = findCsvFiles(ROOT)
  if (csvFiles.length === 0) {
    console.log('未找到 CSV 文件')
    return
  }

  console.log(`找到 ${csvFiles.length} 个 CSV 文件`)

  let converted = 0

  for (const csvPath of csvFiles) {
    try {
      const csvText = readCsvWithEncoding(csvPath)
      const rows = parseCsv(csvText)

      if (rows.length < 2) {
        console.log(`  ⚠️ ${relative(ROOT, csvPath)} → 内容不足，跳过`)
        continue
      }

      const headers = rows[0].map(h => h.trim())
      const locales = headers.slice(1)

      if (locales.length === 0) {
        console.log(`  ⚠️ ${relative(ROOT, csvPath)} → 无语言列，跳过`)
        continue
      }

      // ✅ 提前缓存列索引（优化）
      const localeIndexMap = {}
      locales.forEach(l => {
        localeIndexMap[l] = headers.indexOf(l)
      })

      const outBaseDir = OUTPUT_DIR || dirname(csvPath)

      for (const locale of locales) {
        if (!locale) continue

        const json = {}

        for (let i = 1; i < rows.length; i++) {
          const key = rows[i][0]?.trim()
          if (!key) continue

          const value = rows[i][localeIndexMap[locale]]?.trim() || ''
          if (value === '') continue

          json[key] = value
        }

        const jsonStr = JSON.stringify(json, null, 2)
        const outputPath = join(outBaseDir, `${locale}.json`)

        // 无变化跳过
        if (existsSync(outputPath)) {
          const existing = readFileSync(outputPath, 'utf-8')
          if (existing === jsonStr) continue
        }

        mkdirSync(outBaseDir, { recursive: true })
        writeFileSync(outputPath, jsonStr, 'utf-8')

        console.log(`  ✅ ${relative(ROOT, csvPath)} → ${locale}.json (${Object.keys(json).length} keys)`)
        converted++
      }

    } catch (err) {
      console.error(`  ❌ ${relative(ROOT, csvPath)}: ${err.message}`)
    }
  }

  console.log(`\n🎉 转换完成: ${converted} 个文件更新`)
}

main()