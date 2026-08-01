# 🏁 Pit Wall · 赛事追踪

一个本地运行的小工具：自动收集 **F1 赛程** 和 **CS2 战队比赛**（如 Team Spirit / donk），在网页上查看，并通过 **iCal 订阅** 同步到你的 Apple 日历，**赛前 1 小时自动提醒**。

- 零依赖（只用 Node.js 内置模块，无 `npm install`）
- 数据源免费：F1 来自 [Jolpica API](https://api.jolpi.ca/ergast/f1/2026.json)，CS2 来自 [Liquipedia](https://liquipedia.net/counterstrike/Liquipedia:Matches)
- 支持自由增删跟踪的 CS2 队伍，赛程自动合并进同一个日历源

---

## 环境要求

- **Node.js ≥ 16**（内置 `fetch`）

检查版本：

```bash
node -v
```

## 快速开始

```bash
cd /Users/yangjiaxuan/CODE/sports
npm start
```

启动后终端会显示：

```
🏁 Sports Watchlist running
   Frontend : http://localhost:8787
   Calendar : http://localhost:8787/calendar.ics
```

保持终端窗口开启，服务即持续运行。

## 使用步骤

### 1. 打开管理页面

浏览器访问 **http://localhost:8787**

页面显示：
- **日历订阅**：订阅地址 + 一键复制按钮
- **跟踪内容**：当前跟踪的 F1 全赛站、CS2 队伍（可增删）
- **赛事列表**：按日期分组的未来赛程 + 实时倒计时

### 2. 订阅到 Apple 日历（一次性）

1. 打开 **日历** App → 菜单栏 **文件 → 新建日历订阅**
2. 粘贴订阅地址：`http://localhost:8787/calendar.ics`
3. 勾选 **「提醒」**（不要勾选"忽略提醒"）
4. 点 **订阅**

之后 Apple 日历会自动定期刷新订阅源，无需手动操作。

> 💡 **想用 iPhone 也收到提醒？** 需让手机访问到这台 Mac 的服务：
> - 方案一：Mac 和 iPhone 连同一 Wi-Fi，用 Mac 的局域网 IP（如 `http://192.168.x.x:8787/calendar.ics`）订阅，并把 Mac 的端口 8787 加入防火墙允许列表
> - 方案二：直接把 `.ics` 文件 AirDrop/微信发给手机导入（但不会自动更新）

### 3. 添加 / 删除跟踪的 CS2 队伍

在管理页面「跟踪内容」区域：

- **添加**：下拉选 `CS2` → 输入队伍名（如 `Spirit`、`Vitality`、`FaZe`）→ 点「＋ 添加」
- **删除**：点队伍标签右侧的 `×`

修改后日历源会自动包含新队伍的比赛。

### 4. 确认日历同步

- 网页端：「赛事列表」中带 **「进日历」** 标签的事件会进入日历
- 日历端：订阅后可在日历中看到形如 `F1 Dutch Grand Prix · 正赛`、`CS2 Spirit vs OG` 的事件，且都带有赛前 1 小时提醒

## 日历包含哪些内容

| 内容 | 进日历 | 说明 |
|---|---|---|
| F1 排位赛 | ✅ | 提前 1 小时提醒 |
| F1 正赛 | ✅ | 提前 1 小时提醒 |
| F1 练习赛 | ❌ | 仅在网页展示 |
| CS2 跟踪队伍的比赛 | ✅ | 提前 1 小时提醒 |

> 如需调整（例如把 F1 冲刺赛也加进日历），修改 `server.js` 中的 `F1_CALENDAR_SESSIONS`：
> ```js
> const F1_CALENDAR_SESSIONS = new Set(['Qualifying', 'Sprint', 'Race']);
> ```

## API 接口

本地服务提供的接口：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/` | 管理页面 |
| GET | `/api/events` | 全部赛事 JSON（含练习赛） |
| GET | `/calendar.ics` | Apple 日历订阅源 |
| GET | `/api/trackers` | 当前跟踪列表 |
| POST | `/api/trackers` | 添加跟踪，Body: `{"type":"f1"}` 或 `{"type":"cs2","team":"Spirit"}` |
| DELETE | `/api/trackers/:id` | 删除跟踪 |

## 配置

`config.json`：

```jsonc
{
  "f1Year": 2026,                      // F1 赛季年份
  "trackers": [
    { "id": "f1", "type": "f1", "label": "F1 全赛站" },
    { "id": "cs2-spirit", "type": "cs2", "team": "Spirit", "label": "CS2 · Spirit (donk)" }
  ]
}
```

- `f1Year`：F1 赛季年份，跨年后修改
- `trackers`：跟踪列表，通常在网页上操作，也可直接编辑此文件

## 其他设置

- **端口**：默认 `8787`，可用环境变量修改：`PORT=9000 npm start`
- **数据缓存**：F1 和 CS2 赛程各缓存 5 分钟，避免频繁请求被限流
- **时区**：事件按 UTC 存储，Apple 日历自动转换为本地时区显示

## 常见问题

### 订阅后日历里没有事件 / 不更新
- 确认服务仍在运行（终端窗口开着）
- Apple 日历 → 订阅的日历上右键 →「获取信息」，确认**未勾选"忽略提醒"**
- 手动刷新：日历 → 订阅的日历右键 →「刷新」

### CS2 比赛时间可能偏晚
CS2 赛程通常提前几小时到几天才确定，且临近会有推迟。日历会自动跟随订阅源刷新。

### 想换数据源 / 新增运动
当前已内置 F1、CS2。可参考 `lib/f1.js`、`lib/cs2.js` 的结构，在 `server.js` 的 `buildEvents()` 中接入新的抓取器。

## 项目结构

```
sports/
├── package.json          # 仅 scripts.start，无依赖
├── server.js             # HTTP 服务：托管前端 / API / .ics
├── config.json           # 跟踪队伍配置
├── lib/
│   ├── f1.js             # Jolpica F1 赛程抓取（含缓存）
│   ├── cs2.js            # Liquipedia CS2 赛程抓取（gzip + HTML 解析）
│   ├── ics.js            # iCalendar 生成（VALARM 提醒）
│   └── store.js          # config.json 读写
└── public/
    └── index.html        # 管理页面（原生 HTML/CSS/JS）
```

## 数据来源

- **F1**：[Jolpica API](https://api.jolpi.ca/ergast/f1/2026.json) — 免费、开源、无需鉴权（Ergast 的社区继任者）
- **CS2**：[Liquipedia](https://liquipedia.net/counterstrike/) — 免费 MediaWiki API，解析 `Liquipedia:Matches` 页面
