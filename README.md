# 🏁 Pit Wall · 赛事追踪

自动收集 **F1 赛程** 和 **CS2 战队比赛**（如 Team Spirit / donk），通过 **iCal 订阅**同步到你的 Apple 日历，**赛前 1 小时自动提醒**。GitHub Actions 每天自动拉取更新，本机无需开机。

## 🗓 订阅 Apple 日历

1. **日历** App → **文件 → 新建日历订阅**
2. 粘贴：`https://jiaxuanyang.com/sports-watchlist/calendar.ics`
3. 勾选「提醒」→ **订阅**

iPhone 连同一 iCloud 账号即可同步。

| 内容 | 进日历 | 提醒 |
|---|---|---|
| F1 排位赛 / 正赛 | ✅ | 赛前 1 小时 |
| F1 练习赛 | ❌ 仅网页展示 | — |
| CS2 跟踪队伍的比赛 | ✅ | 赛前 1 小时 |

## ⚙️ 管理跟踪队伍

编辑仓库的 [`config.json`](config.json)（网页上的「在 GitHub 编辑 config.json」按钮可直达）：

```json
{
  "f1Year": 2026,
  "trackers": [
    { "id": "f1", "type": "f1", "label": "F1 全赛站" },
    { "id": "cs2-spirit", "type": "cs2", "team": "Spirit", "label": "CS2 · Spirit (donk)" }
  ]
}
```

加 CS2 队伍：复制一行，把 `team` 改成队伍名（如 `Vitality`）→ 推送，约 1 分钟生效。

## 📊 管理页面

`https://jiaxuanyang.com/sports-watchlist/` — 按日期查看赛程与倒计时。

## ❓ 常见问题

- **日历没更新？** 仓库 **Actions** 标签页看工作流是否成功；日历右键订阅 →「刷新」
- **CS2 比赛偏晚？** 正常，赛程临近才确定，每天自动刷新
- **更新频率**：每天 10:17（北京时间）自动拉取；推送 `config.json` 会立即触发

## 数据来源

- **F1**：[Jolpica API](https://api.jolpi.ca/ergast/f1/2026.json)（免费）
- **CS2**：[Liquipedia](https://liquipedia.net/counterstrike/)（免费）
