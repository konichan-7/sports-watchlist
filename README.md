# 🏁 Pit Wall · 赛事追踪

自动收集 **F1 赛程** 和 **CS2 战队比赛**（如 Team Spirit / donk），通过 **iCal 订阅** 同步到你的 Apple 日历，**赛前 1 小时自动提醒**。

- **自动部署**：GitHub Actions 每小时拉取赛程 → 生成静态文件 → 托管在 GitHub Pages，本机无需开机
- **零依赖**（只用 Node.js 内置模块，无 `npm install`）
- **数据源免费**：F1 来自 [Jolpica API](https://api.jolpi.ca/ergast/f1/2026.json)，CS2 来自 [Liquipedia](https://liquipedia.net/counterstrike/Liquipedia:Matches)
- 支持增删跟踪的 CS2 队伍（编辑 `config.json` 即可）

---

## 已部署（推荐）—— 不需要本机运行

站点与日历源已部署在 GitHub Pages：

| 资源 | 地址 |
|---|---|
| 管理页面 | `https://jiaxuanyang.com/sports-watchlist/` |
| 日历订阅 | `https://jiaxuanyang.com/sports-watchlist/calendar.ics` |

### 1. 订阅到 Apple 日历（一次性）

1. 打开 **日历** App → 菜单栏 **文件 → 新建日历订阅**
2. 粘贴：`https://jiaxuanyang.com/sports-watchlist/calendar.ics`
3. 勾选 **「提醒」**（不要勾选"忽略提醒"）
4. 点 **订阅**

之后 Apple 日历会定期刷新订阅源。iPhone 连接同一 iCloud 账号即可同步收到。

### 2. 添加 / 删除跟踪的 CS2 队伍

在管理页面点「在 GitHub 编辑 config.json」，或直接在仓库修改 [`config.json`](config.json)：

```jsonc
{
  "f1Year": 2026,
  "trackers": [
    { "id": "f1", "type": "f1", "label": "F1 全赛站" },
    { "id": "cs2-spirit", "type": "cs2", "team": "Spirit", "label": "CS2 · Spirit (donk)" }
  ]
}
```

- 加一个 CS2 队伍：复制一行 tracker，改 `team` 为队伍名（如 `Vitality`）
- 提交推送后，GitHub Actions 会自动重新生成赛程（约 1 分钟内生效）

### 3. 更新频率

- 赛程数据每小时重新拉取（GitHub Actions cron）
- 推送 `config.json` 修改也会立即触发重新生成
- Apple 日历按自身设置定期刷新订阅源（可在日历的订阅信息中调整）

---

## 日历包含哪些内容

| 内容 | 进日历 | 说明 |
|---|---|---|
| F1 排位赛 | ✅ | 提前 1 小时提醒 |
| F1 正赛 | ✅ | 提前 1 小时提醒 |
| F1 练习赛 | ❌ | 仅在网页展示 |
| CS2 跟踪队伍的比赛 | ✅ | 提前 1 小时提醒 |

> 如需调整（例如把 F1 冲刺赛也加进日历），修改 `lib/events.js` 中的 `F1_CALENDAR_SESSIONS`：
> ```js
> const F1_CALENDAR_SESSIONS = new Set(['Qualifying', 'Sprint', 'Race']);
> ```

---

## 本机运行（可选）

仍然可以在本机运行以调试或作为备用：

```bash
cd /Users/yangjiaxuan/CODE/sports
npm start
```

启动后：

- 管理页面：`http://localhost:8787`
- 日历源：`http://localhost:8787/calendar.ics`（Apple 日历订阅 `http://` 地址时，需按提示允许非 HTTPS 订阅）

本机模式下前端支持「添加/删除队伍」的即时操作（写回 `config.json`）；部署到 GitHub Pages 后为只读 + 编辑仓库。

## 部署到 GitHub Pages（维护用）

本项目已配置好自动部署，正常情况下无需手动操作。如需了解：

- **工作流**：`.github/workflows/update-schedule.yml`（每小时 + push 触发）
- **构建脚本**：`scripts/build-static.js` 生成 `dist/`（calendar.ics、events.json、index.html）
- **发布源**：仓库 Settings → Pages → **GitHub Actions**

本地手动构建验证：

```bash
node scripts/build-static.js   # 生成 dist/
```

## API（仅本机模式）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 管理页面 |
| GET | `/api/events` | 全部赛事 JSON（含练习赛） |
| GET | `/calendar.ics` | 日历订阅源 |
| GET | `/api/trackers` | 当前跟踪列表 |
| POST | `/api/trackers` | 添加跟踪，Body: `{"type":"f1"}` 或 `{"type":"cs2","team":"Spirit"}` |
| DELETE | `/api/trackers/:id` | 删除跟踪 |

## 项目结构

```
sports/
├── .github/workflows/
│   └── update-schedule.yml  # Actions：定时构建 + 部署 Pages
├── scripts/
│   └── build-static.js      # 生成 dist/（静态部署用）
├── server.js                # 本机服务（可选，开发调试用）
├── config.json              # 跟踪队伍配置
├── lib/
│   ├── events.js            # 共享事件组装逻辑
│   ├── f1.js                # Jolpica F1 赛程抓取（含缓存）
│   ├── cs2.js               # Liquipedia CS2 赛程抓取（gzip + HTML 解析）
│   ├── ics.js               # iCalendar 生成（VALARM 提醒）
│   └── store.js             # config.json 读写
└── public/
    └── index.html           # 管理页面（原生 HTML/CSS/JS）
```

## 常见问题

### 日历里没有事件 / 不更新
- 确认 Actions 工作流运行成功：仓库 **Actions** 标签页 → Update schedule
- Apple 日历 → 订阅的日历右键 →「获取信息」，确认**未勾选"忽略提醒"**
- 手动刷新：日历 → 订阅的日历右键 →「刷新」

### CS2 比赛时间可能偏晚
CS2 赛程通常提前几小时到几天才确定，且临近会有推迟。Actions 每小时拉取，日历会跟随更新。

### 想换数据源 / 新增运动
当前已内置 F1、CS2。可参考 `lib/f1.js`、`lib/cs2.js` 的结构，在 `lib/events.js` 的 `buildEvents()` 中接入新的抓取器。

## 数据来源

- **F1**：[Jolpica API](https://api.jolpi.ca/ergast/f1/2026.json) — 免费、开源、无需鉴权（Ergast 的社区继任者）
- **CS2**：[Liquipedia](https://liquipedia.net/counterstrike/) — 免费 MediaWiki API，解析 `Liquipedia:Matches` 页面
