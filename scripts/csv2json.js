import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs'
import { join, relative, dirname, parse, basename } from 'path'

/**
 * CSV → 翻译 JSON 转换脚本
 * 
 * CSV 格式：
 *   key,zh-CN,en,ja
 *   greeting,你好,Hello,こんにちは
 *   goodbye,再见,Goodbye,さようなら
 * 
 * 输出（每列生成一个 JSON 文件）：
 *   zh-CN.json → {"greeting": "你好", "goodbye": "再见"}
 *   en.json    → {"greeting": "Hello", "goodbye": "さようなら"}
 *   ja.json    → {"greeting": "こんにちは", "goodbye": "さようなら"}
 * 
 * 用法：node csv2json.mjs [目录]
 * - 默认扫描仓库根目录下所有 .csv 文件
 * - 第一列为 key，其余列为各语言的翻译值
 * - 列名即为语言代码，也是输出文件名
 * - JSON 输出到 CSV 同目录（或通过 JSON_OUTPUT_DIR 环境变量指定）
 * 
 * GitLab CI 中自动运行，也可本地执行：node scripts/csv2json.mjs
 */

const ROOT = process.argv[2] || process.cwd()
const OUTPUT_DIR = process.env.JSON_OUTPUT_DIR || null

// 解析 CSV 行，支持双引号包裹（含逗号/换行的字段）
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

// 解析完整 CSV（处理多行字段）
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

// 递归查找 CSV 文件
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

// 主函数
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
      const csvText = readFileSync(csvPath, 'utf-8')
      const rows = parseCsv(csvText)

      if (rows.length < 2) {
        console.log(`  ⚠️  ${relative(ROOT, csvPath)} → 内容不足，跳过`)
        continue
      }

      const headers = rows[0].map(h => h.trim())
      // 第一列为 key，其余列为语言代码
      const locales = headers.slice(1)
      if (locales.length === 0) {
        console.log(`  ⚠️  ${relative(ROOT, csvPath)} → 只有一列，无语言列，跳过`)
        continue
      }

      // 确定输出目录
      const outBaseDir = OUTPUT_DIR || dirname(csvPath)

      // 为每个语言列生成一个 JSON
      for (const locale of locales) {
        if (!locale) continue
        const json = {}
        for (let i = 1; i < rows.length; i++) {
          const key = rows[i][0]?.trim()
          if (!key) continue // 跳过空 key 行
          const value = rows[i][headers.indexOf(locale)]?.trim() || ''
          if (value === '') continue // 空值不写入，让 i18n fallback 到默认语言
          json[key] = value
        }

        const jsonStr = JSON.stringify(json, null, 2)
        const outputPath = join(outBaseDir, `${locale}.json`)

        // 无变化则跳过
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

  console.log(`\n转换完成: ${converted} 个文件已更新`)
}

main()
