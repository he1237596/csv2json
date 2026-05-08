# 多语言 CSV → JSON 自动化方案

---

## 项目目标

实现一套自动化流程：

```
Supabase 翻译平台 → CSV 下载 → JSON 转换 → 提交回仓库 + Pages 发布
```

用于：

- 前端 i18n
- 多项目共享语言资源
- CI 自动同步

---

## CSV 规范

### 格式要求

```csv
key,zh-CN,en,ja
greeting,你好,Hello,こんにちは
goodbye,再见,Goodbye,さようなら
```

### 强制规则

- 第一列必须是 key
- 后面列是语言代码
- key 不允许重复
- 空值不会写入 JSON（用于 fallback）

### 编码要求

必须使用 **UTF-8**（WPS 另存为 → CSV UTF-8（逗号分隔））。脚本也会自动尝试 GBK 解码作为兜底。

---

## 项目结构

```
language-resource/
├── .github/workflows/convert.yml   # GitHub Actions CI
├── .gitlab-ci.yml                   # GitLab CI
├── scripts/
│   ├── download-csv.js              # 从 Supabase 下载 CSV
│   └── csv2json.js                  # CSV → JSON 转换
├── simpro/
│   ├── translations.csv             # 源文件
│   ├── zh-CN.json                   # 生成的 JSON
│   ├── en-US.json
│   └── ...
└── simmobile/
    ├── translations.csv
    ├── zh-CN.json
    ├── en-US.json
    └── ...
```

---

## 本地使用

```bash
npm install

# 从 Supabase 下载最新 CSV
npm run download -- simmobile simpro    # 指定项目
npm run download                        # 自动扫描

# CSV → JSON 转换
npm run convert

# 下载 + 转换一步完成（下载失败也会继续转换）
npm run build
```

### 脚本说明

| 脚本 | 说明 |
|------|------|
| `scripts/download-csv.js` | 从 Supabase Edge Function 下载各项目的 CSV 文件 |
| `scripts/csv2json.js` | 扫描所有 CSV，按语言列拆分为 JSON 文件 |

### 自动扫描规则

1. `projects/` 下的子文件夹
2. 根目录下包含 `translations.csv` 的子文件夹（排除 scripts、node_modules 等）

---

## GitLab CI

### 配置文件

`.gitlab-ci.yml`

### 前置配置

1. **创建 Access Token**

   项目 → Settings → Repository → Access Tokens

   - Name: `csv2json-ci`
   - Scopes: `api`, `write_repository`

2. **配置 CI Variable**

   项目 → Settings → CI/CD → Variables → Add variable

   - Key: `GITLAB_TOKEN`
   - Value: 上一步创建的 token
   - 勾选 Mask variable

3. **配置定时任务**（可选）

   项目 → Settings → CI/CD → Schedules → New schedule

   - Interval: 选择频率（如每天）
   - Cron timezone: `Asia/Shanghai`
   - Target branch: `master`
   - Cron pattern: `0 2 * * *`（每天凌晨 2 点）

4. **Runner 要求**

   需要有带 `docker` tag 的 Runner。

### Job 说明

| Job | 说明 | 触发条件 |
|-----|------|---------|
| `sync-all` | 下载 CSV + 转换 JSON，一次性提交 | 定时任务、手动触发（Run pipeline） |
| `csv-to-json` | 仅转换 JSON，无变化不提交 | CSV 文件变更、转换脚本变更 |
| `pages` | 将 JSON 发布到 GitLab Pages | 仅默认分支 |

### 各场景执行情况（仅默认分支）

| 场景 | sync-all | csv-to-json | pages |
|------|----------|-------------|-------|
| 定时任务触发 | ✅ 下载+转换 | 跳过 | ✅ |
| 手动 Run pipeline | ✅ 下载+转换 | 跳过 | ✅ |
| 手动改 CSV 推送 | 跳过 | ✅ 自动转换 | ✅ |
| 修改 `csv2json.js` 推送 | 跳过 | ✅ 自动转换 | ✅ |
| 修改其他文件推送 | 跳过 | 跳过 | ✅ |
| 下载接口挂了，手动改 CSV | 跳过 | ✅ 自动转换 | ✅ |

> **pages 说明**：只要推送到默认分支就会执行，不管文件是否有变化。内容相同时不会产生实际更新。

### 设计要点

- `sync-all` 将下载和转换合并为同一个 job，避免跨 job 文件不共享的问题
- `csv-to-json` 通过 `when: never` 排除 schedule/web 触发，避免与 sync-all 重复执行
- `csv-to-json` 无 JSON 变化时不提交，不会触发无意义的 pipeline
- 所有推送前执行 `git pull --rebase`，防止远程有新提交导致冲突
- 推送消息带 `[skip ci]`，避免无限循环触发

### JSON 访问地址

```
https://<gitlab-domain>/pages/<namespace>/<project>/simpro/en-US.json
https://<gitlab-domain>/pages/<namespace>/<project>/simmobile/zh-CN.json
```

---

## GitHub Actions

### 配置文件

`.github/workflows/convert.yml`

### 前置配置

1. **创建 Personal Access Token**

   GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens

   - Name: `csv2json-ci`
   - Repository: 选择当前仓库
   - Permissions → Contents: **Read and write**

2. **添加 Repository Secret**

   仓库 → Settings → Secrets and variables → Actions → New repository secret

   - Name: `PAT_TOKEN`
   - Value: 上一步创建的 token

3. **开启 GitHub Pages**

   仓库 → Settings → Pages → Source 选择 **GitHub Actions**

### Job 说明

| Job | 说明 | 触发条件 |
|-----|------|---------|
| `convert-and-commit` | CSV 转 JSON，有变更时自动提交回仓库 | CSV 文件变更、手动 Run workflow |
| `deploy-pages` | 将 JSON 发布到 GitHub Pages | 仅 master/main 分支 |

### JSON 访问地址

```
https://<用户名>.github.io/<仓库名>/simpro/en-US.json
https://<用户名>.github.io/<仓库名>/simmobile/zh-CN.json
```

---

## 新增项目

1. 在仓库根目录创建新文件夹（如 `newapp/`）
2. 在 Supabase 翻译平台中创建对应项目
3. 推送后 CI 自动下载 CSV 并生成 JSON

如需 Pages 发布，在 CI 配置的 `cp` 命令中添加对应目录。

---

## 常见问题

### Q: npm install 报错

CI 环境是全新容器，必须安装依赖。本地开发前也需先执行 `npm install`。

### Q: 自动提交失败（Authentication failed）

- **GitHub**: 检查 `PAT_TOKEN` 是否有 `Contents: Read and write` 权限
- **GitLab**: 检查 `GITLAB_TOKEN` 是否有 `write_repository` scope

### Q: 推送失败（non-fast-forward）

CI 推送前已配置 `git pull --rebase`，通常不会出现此问题。如果仍出现，说明有两个 CI 同时运行并修改了同分支，需避免并发。

### Q: GitHub Pages 部署失败（404 Not Found）

确保仓库 Settings → Pages → Source 已选择 **GitHub Actions**。

### Q: build 命令下载部分失败怎么办

`npm run build` 中即使下载失败也会继续执行转换，不会中断。
