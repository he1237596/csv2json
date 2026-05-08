# 多语言 CSV → JSON 自动化方案

---

## 项目目标

实现一套自动化流程：

```
CSV（多语言源） → 自动转换 → JSON → 提交回仓库 + Pages 发布
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
├── scripts/csv2json.js              # 转换脚本
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

## 转换脚本说明

**路径：** `scripts/csv2json.js`

### 功能

- 自动扫描目录下所有 CSV 文件
- 每个语言列生成对应的 `{locale}.json`
- 自动识别编码（UTF-8 / GBK）、去 BOM
- JSON 无变化时跳过写入

### 本地运行

```bash
npm install
node scripts/csv2json.js                        # 转换当前目录
JSON_OUTPUT_DIR=./dist node scripts/csv2json.js  # 指定输出目录
```

### 输出示例

```json
// zh-CN.json
{
  "greeting": "你好",
  "goodbye": "再见"
}
```

---

## GitHub Actions（推荐）

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

### 工作流说明

| Job | 说明 |
|-----|------|
| `convert-and-commit` | CSV 转 JSON，有变更时自动提交回仓库 |
| `deploy-pages` | 将 JSON 发布到 GitHub Pages（仅 master/main 分支） |

### 触发条件

- 推送 `**/*.csv` 文件变更时自动触发
- 可在 Actions 页面手动点击 **Run workflow** 触发

### JSON 访问地址

```
https://<用户名>.github.io/<仓库名>/simpro/en-US.json
https://<用户名>.github.io/<仓库名>/simmobile/zh-CN.json
```

---

## GitLab CI

### 配置文件

`.gitlab-ci.yml`

### 前置配置

1. **创建 Access Token**

   项目 → Settings → Repository → Push mirror 或 Access Tokens

   - Name: `csv2json-ci`
   - Scopes: `api`, `write_repository`

2. **配置 CI Variable**

   项目 → Settings → CI/CD → Variables → Add variable

   - Key: `GITLAB_TOKEN`
   - Value: 上一步创建的 token
   - 勾选 Masked

3. **Runner 要求**

   需要有带 `docker` tag 的 Runner。

### 工作流说明

| Stage | 说明 |
|-------|------|
| `convert` | CSV 转 JSON，有变更时自动提交回仓库 |
| `pages` | 将 JSON 发布到 GitLab Pages（仅默认分支） |

### 触发条件

- 任何推送都会触发 `convert` 阶段（脚本内部判断有无变化）
- `pages` 阶段仅在默认分支执行
- 提交消息包含 `[skip ci]` 可跳过 CI

### JSON 访问地址

```
https://<gitlab-domain>/pages/<namespace>/<project>/simpro/en-US.json
```

---

## 常见问题

### Q: 为什么要 npm install？

CI 环境是全新容器，没有 `node_modules`，必须安装依赖（`iconv-lite`）。

### Q: 自动提交失败（Authentication failed）

- **GitHub**: 检查 `PAT_TOKEN` 是否有 `Contents: Read and write` 权限
- **GitLab**: 检查 `GITLAB_TOKEN` 是否有 `write_repository` scope

### Q: GitHub Pages 部署失败（404 Not Found）

确保仓库 Settings → Pages → Source 已选择 **GitHub Actions**。

### Q: 想新增一个项目的翻译

1. 在仓库根目录创建新文件夹（如 `newapp/`）
2. 在其中放入 `translations.csv`
3. 推送后 CI 自动生成 JSON
4. GitHub Pages 需要在 workflow 中添加对应的 `cp` 和 `mkdir` 命令

---

## 架构流程

```
CSV（WPS/Excel 编辑）
   ↓
Git push
   ↓
CI（GitHub Actions / GitLab CI）
   ↓
csv2json.js 转换
   ↓
JSON 文件自动提交回仓库
   ↓
Pages 发布（可被前端直接引用）
   ↓
前端 i18n 使用
```
