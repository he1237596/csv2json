import { writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs'
import { join, basename } from 'path'

const API_URL = 'https://xonrngcdkvcvslnlwhis.supabase.co/functions/v1/export-csv'

// 用法: node scripts/download-csv.js [项目名1 项目名2 ...]
// 不传参则自动扫描 projects/ 下的子文件夹
async function downloadCsv(projectName, targetDir) {
  const url = `${API_URL}?project=${encodeURIComponent(projectName)}`
  console.log(`  ↓ 下载: ${projectName} → ${url}`)

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  }

  const csv = await res.text()

  if (!csv.trim()) {
    console.log(`  ⚠️ ${projectName}: 返回内容为空，跳过`)
    return false
  }

  mkdirSync(targetDir, { recursive: true })
  const outputPath = join(targetDir, 'translations.csv')
  writeFileSync(outputPath, csv, 'utf-8')

  const lines = csv.trim().split('\n').length
  console.log(`  ✅ ${projectName} → ${outputPath} (${lines} 行)`)
  return true
}

function findProjectDirs(root) {
  const results = []

  // 扫描 projects/ 目录下的所有子文件夹
  const projectsDir = join(root, 'projects')
  if (existsSync(projectsDir)) {
    for (const entry of readdirSync(projectsDir)) {
      const fullPath = join(projectsDir, entry)
      if (statSync(fullPath).isDirectory() && !entry.startsWith('.')) {
        results.push({ name: entry, dir: fullPath })
      }
    }
  }

  return results
}

async function main() {
  const root = process.cwd()
  const args = process.argv.slice(2)

  let projects = []

  if (args.length > 0) {
    // 手动指定项目名，下载到 projects/ 下
    for (const name of args) {
      const dir = join(root, 'projects', name)
      projects.push({ name, dir })
    }
  } else {
    // 自动扫描
    projects = findProjectDirs(root)
  }

  if (projects.length === 0) {
    console.log('未找到项目目录。')
    console.log('用法:')
    console.log('  node scripts/download-csv.js simmobile simpro   # 指定项目名')
    console.log('  node scripts/download-csv.js                     # 自动扫描')
    console.log()
    console.log('自动扫描规则:')
    console.log('  projects/ 下的所有子文件夹')
    return
  }

  console.log(`📁 找到 ${projects.length} 个项目: ${projects.map(p => p.name).join(', ')}\n`)

  let success = 0
  let failed = 0

  for (const { name, dir } of projects) {
    try {
      const ok = await downloadCsv(name, dir)
      if (ok) success++
    } catch (err) {
      console.error(`  ❌ ${name}: ${err.message}`)
      failed++
    }
  }

  console.log(`\n🎉 下载完成: ${success} 成功, ${failed} 失败`)
}

main()
