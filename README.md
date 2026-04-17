# 🧩 多语言 CSV → JSON 自动化方案

---

## 1️⃣ 项目目标

实现一套自动化流程：

```
CSV（多语言源） → 自动转换 → JSON → 提供访问
```

用于：

* 前端 i18n
* 多项目共享语言资源
* CI 自动同步

---

## 2️⃣ CSV 规范（⚠️ 很重要）

### 📌 格式要求

```csv
key,zh-CN,en,ja
greeting,你好,Hello,こんにちは
goodbye,再见,Goodbye,さようなら
```

---

### 📌 强制规则

* 第一列必须是 key
* 后面列是语言代码
* key 不允许重复
* 空值不会写入 JSON（用于 fallback）

---

### 🚨 编码要求（重点）

必须使用 **UTF-8**

#### ❌ 错误情况（WPS 默认）

```
GBK / ANSI → 会乱码
```

#### ✅ 正确操作（WPS）

```
另存为 → CSV UTF-8（逗号分隔）
```

---

## 3️⃣ 转换脚本说明

**路径：**

```
scripts/csv2json.js
```

---

### ✨ 功能

* 自动扫描所有 CSV
* 自动生成多语言 JSON
* 自动识别编码（UTF-8 / GBK）
* 自动去 BOM
* 无变化不重复写入

---

### 📌 输出示例

```json
// zh-CN.json
{
  "greeting": "你好",
  "goodbye": "再见"
}
```

---

## 4️⃣ GitLab CI 配置（核心）

### 📄 `.gitlab-ci.yml`

```yaml
image: node:20-alpine

stages:
  - convert
  - pages

csv-to-json:
  stage: convert
  rules:
    - changes:
        - "**/*.csv"
  before_script:
    - npm install
    - git config user.name "CI Bot"
    - git config user.email "ci-bot@gitlab.com"
  script:
    - echo "🚀 CSV → JSON 转换"
    - node scripts/csv2json.js

    - |
      if [ -n "$(git status --porcelain)" ]; then
        echo "有变化，提交..."
        git add .
        git commit -m "auto: csv to json [skip ci]"
        git push http://oauth2:${CI_JOB_TOKEN}@${CI_SERVER_HOST}/${CI_PROJECT_PATH}.git HEAD:${CI_COMMIT_REF_NAME}
      else
        echo "无变化"
      fi

pages:
  stage: pages
  script:
    - node scripts/csv2json.js
    - mkdir -p public
    - cp -r simmobile public/
    - cp -r simpro public/
  artifacts:
    paths:
      - public
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
```

---

## 5️⃣ CI 关键点说明

### ❗ 1. 为什么要 `npm install`

```
CI 是全新容器，没有 node_modules
```

必须执行：

```bash
npm install
```

否则：

```
Cannot find package 'iconv-lite'
```

---

### ❗ 2. git push 失败

报错：

```
Authentication failed
```

解决：

```bash
git push http://oauth2:${CI_JOB_TOKEN}@...
```

---

### ❗ 3. detached HEAD 问题

CI 默认：

```
不是在分支上
```

必须：

```bash
git push ... HEAD:${CI_COMMIT_REF_NAME}
```

---

### ❗ 4. Runner 网络问题

报错：

```
no route to host
```

原因：

```
Runner 容器访问不到 GitLab
```

解决：

* Runner 与 GitLab 在同一网络
* 或使用公网地址

---

## 6️⃣ JSON 访问方式

### 方式一（推荐）

```
GitLab Pages
http://<your-domain>/<project>/zh-CN.json
```

---

### 方式二（不推荐）

```
/raw/main/xxx.json
```

问题：

```
需要登录
```

解决：

* 项目设为 public
* 或使用 Pages

---

## 7️⃣ 架构流程

```
CSV（WPS/Excel）
   ↓
Git push
   ↓
GitLab CI
   ↓
csv2json.js
   ↓
JSON 文件
   ↓
GitLab Pages / API
   ↓
前端 i18n 使用
```

---

## 📌 总结

这套方案本质是：

> 一个轻量级多语言管理系统（i18n）

具备：

* 自动化
* 可扩展
* 可 CI/CD 集成
* 适合中小团队快速落地

---
