# 外来物种哨点 — 项目迭代记录

> 记录所有 UX 问题、调试过程、根因分析和解决方案。
> 最后更新：2026-04-25（本次：全部 20 个物种图片替换为真实照片）

---

## 一、问题汇总

### 1. 首页物种列表无法滚动（长期未解决）

**现象**：重点物种列表只能看到前 12 种（红火蚁等），后续物种被截断，手指滑到红火蚁位置就卡住。

**多次尝试的方案**：

| # | 方案 | 结果 |
|---|------|------|
| 1 | `scroll-view` + `height: 100vh` + `overflow: hidden` | scroll-view 高度 0，不滚动 |
| 2 | `scroll-view` + `flex: 1` + `height: 0`（父容器 flex column） | 微信 flex 计算错误，高度仍不对 |
| 3 | `scroll-view` + JS `SelectorQuery` 动态计算 scrollHeight | 微信元素查询返回 null 或 0，仍失败 |
| 4 | 去掉 `overflow: hidden`，改为 `display: flex; flex-direction: column` | flex 子元素高度不生效 |
| 5 | 恢复 `overflow: hidden`，hero + stats 放 scroll-view 外，用 JS 计算剩余高度 | calcScrollHeight 返回值过小（~151px），scroll-view 只显示 1 项 |
| 6 | 简化布局：hero + stats 固定在顶部，scroll-view 用 `flex: 1; height: 0; min-height: 0` | **当前方案**，依赖 flex 正确计算 |
| 7 | 新方案：物种 section 用独立 flex column，`scroll-view` 加 `flex: 1; height: 0; min-height: 0` | **待验证** |

**根因分析**：
微信小程序的 WebView 对 flex 布局支持存在 bug——当父容器是 `display: flex; flex-direction: column; height: 100vh` 时，子元素即使设置 `flex: 1` 也无法正确分配剩余空间。`overflow: hidden` 会导致 scroll-view 实际高度计算为 0。

**当前最新方案（v7）**：
- hero + stats 不在 scroll-view 内，而是作为 flex 固定项（`flex-shrink: 0`）
- 物种 section 是独立 flex 容器：`.species-section { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }`
- scroll-view 设置 `flex: 1; height: 0; min-height: 0`（`min-height: 0` 是关键，让 flex 元素可以小于内容尺寸）
- 移除了 JS 动态高度计算（不可靠）

---

### 2. 登录页密码输入不显示文字

**现象**：输入密码后显示为圆点（••••），看不见输入内容。

**原因**：
```xml
<!-- 错误写法：type="safe-password" 强制数字键盘 -->
<input type="safe-password" password="{{true}}" ...>

<!-- 修复后：type="text" + password 属性控制 -->
<input type="{{showPassword ? 'text' : 'password'}}" ...>
```

**解决方案**：
- 移除 `type="safe-password"`，改用 `type="{{showPassword ? 'text' : 'password'}}"`
- 登录页加载时 `showPassword` 默认为 `true`（密码直接显示可见）
- 添加 👁/🙈 切换按钮，用户可自行隐藏

**文件**：`miniprogram/pages/login/login.wxml`、`login.js`、`login.wxss`

---

### 3. 物种图片全部返回 HTTP 500

**现象**：首页所有物种缩略图显示红叉，控制台报 500 错误。

**原因**：所有 20 个图片文件扩展名是 `.jpg`，但文件内容是 **PNG 二进制**（文件头 `89 50 4E 47`）。服务器返回时声明 `Content-Type: image/jpeg`，微信图片解码器收到 PNG 数据但被告知是 JPEG → 解码失败 → 500。

**解决方案**：
```bash
# 用 Python PIL 将所有图片转为真实 JPEG
from PIL import Image
img = Image.open('species-001.jpg').convert('RGB')
img.save('species-001.jpg', 'JPEG', quality=85)
```

同时优化了 `home.js` 的 `loadData()`，在设置数据前先将 avatar 相对路径拼接为完整 URL：
```js
avatar = baseUrl + avatar  // → http://127.0.0.1:3000/static/species/species-001.jpg
```

**文件**：`server/static/species/species-*.jpg`（共20个）、`miniprogram/pages/home/home.js`

---

### 4. 热力图点击没反应（开发者工具限制）

**原因**：`wx.addHeatMap()` 是**仅真机可用**的 API，在微信开发者工具中调用永远失败，且无任何提示。

**解决方案**：
- 地图标记点添加 `callout` 气泡，**点击任意标记立即显示物种名和地址**（开发工具/真机均可用）
- 热力图仅在真机上生效，加载失败时不显示错误提示

**文件**：`miniprogram/pages/map/map.js`、`map.wxml`

---

### 5. 数据库 Seed 策略破坏用户数据

**原因**：`seedReports()` 使用 `INSERT OR REPLACE`，每次服务器重启都会覆盖所有上报记录。用户辛苦录入的数据在重启后全部消失。

**解决方案**：
```js
// 改为 INSERT OR IGNORE：只插入不存在 ID 的记录
INSERT OR IGNORE INTO reports (...) VALUES (...)
INSERT OR IGNORE INTO species (...) VALUES (...)
```
现在服务器重启不会覆盖用户上报，只补充缺失的 Mock 数据。

**文件**：`server/lib/database.js`

---

### 6. 审核台菜单不显示

**现象**：以 admin 账号登录后，"我的"页面没有审核台入口。

**原因**：
1. JWT decode 在部分微信版本中失败，导致 `role` 为空字符串
2. `review.js` 缺少 `var app = getApp()`，`app.globalData` 是 undefined

**解决方案**：
- 登录成功后缓存 role 到 `app.globalData.role`
- `profile.js` 的 `checkLogin()` 优先读取 `app.globalData.role` 作为 fallback

**文件**：`miniprogram/utils/api.js`、`miniprogram/pages/profile/profile.js`、`miniprogram/pages/review/review.js`

---

### 7. 审核页 AI 候选列表显示错误

**原因**：review.wxml 嵌套 `wx:for`，内外层都使用变量名 `item` 和 `index`，内层循环将外层数据覆盖。

**解决方案**：
```xml
<!-- 内层循环指定 wx:for-item="cand" 消除遮蔽 -->
<view wx:for="{{item.aiCandidates}}" wx:key="speciesId" wx:for-item="cand">
  <text>{{cand.speciesName}}</text>
</view>
```

**文件**：`miniprogram/pages/review/review.wxml`

---

### 8. Mock 数据坐标为 (0, 0)

**原因**：所有上报记录的 `latitude` 和 `longitude` 初始值均为 0，导致地图上所有点聚集在赤道大西洋中。

**解决方案**：修正为南京实际坐标（百家湖、玄武湖、秦淮河等）。

**文件**：`server/data/mock-data.js`

---

## 二、架构决策记录

### SQLite vs 内存数组

**当前选择：SQLite**（`server/data/invasive-species.db`）

| 场景 | SQLite | 内存数组 |
|------|--------|---------|
| 服务器重启 | 数据保留 | 数据丢失（需重新 seed） |
| 并发安全 | yes（better-sqlite3 WAL 模式） | no |
| 分页查询 | SQL 完成 | JS 手动过滤 |
| 部署复杂度 | 仅一个 .db 文件 | 无需额外依赖 |

**注意**：`INSERT OR IGNORE` 已设置，重启不覆盖用户数据。

### 识别服务提供商链

优先级：Zhipu AI → Moonshot → Python Ollama → Mock（兜底）

`MINIMAX_API_KEY` 已废弃（2026年4月官方停用），相关代码已移除。

---

## 三、Git 提交历史

| Commit | 描述 |
|--------|------|
| `3d51443` | fix: 替换全部 20 个物种图片为真实照片 |
| `7c20d79` | fix: 替换 species-013~020 占位图为正确格式 JPEG |
| `09be8a9` | feat: 添加分类筛选标签页、修复密码显示和列表滚动 |
| `195a060` | fix: 修复物种列表滚动、登录密码显示、图片500错误 |
| `f656365` | feat: 改进首页物种列表滚动和加载更多 |
| `3e9dcdf` | style: 优化登录页面设计 |
| `c6e64bf` | fix: 修复首页UX问题 |
| `6b3f607` | feat: 改进 Zhipu 请求错误处理和超时机制 |
| `dde43ab` | refactor: 弃用 MiniMax API，简化识别服务链 |

---

## 四、待解决问题

- [ ] **物种列表滚动**（scroll-view flex 高度计算问题，仍需真机验证）
- [ ] **热力图**（仅真机可用，气泡标注已作为替代方案）
- [ ] 地图 `addHeatMap` 在开发者工具中的友好提示（已加 wx.showToast，但热力图 API 本身不支持开发者工具）
- [x] **species-013~020 图片质量**（已替换为真实物种照片）

---

## 五、本次更新记录（2026-04-25）

### 物种图片全部替换为真实照片

**现象**：species-013 到 species-020 均为 120×120 2KB 占位图，前 12 个虽有正确格式但也可能需要更新。

**解决方案**：从 `server/uploads/species/` 复制全部 20 个真实照片到 `server/static/species/`，统一为 1248×832 真实 JPEG 格式。

**文件**：`server/static/species/species-001~020.jpg`

### Git 推送状态

本地分支领先 origin/main 10 个 commit，网络不稳定导致推送反复失败（curl 55 / RPC failed）。建议手动在本地执行 `git push origin main`。
