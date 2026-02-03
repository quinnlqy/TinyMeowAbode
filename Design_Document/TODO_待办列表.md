# 《猫咪的家》待办列表 (TODO)

**创建日期**：2026-02-02  
**状态说明**：`[ ]` 未开始 | `[/]` 进行中 | `[x]` 已完成

---

## 🔴 高优先级 - Bug 修复

### 1. 日记系统 - 区分墙面挂饰和桌面小物
- [x] **问题**：日记条目中没有区分"墙上挂的物件"和"桌面小物"
- [x] **方案**：
  - 在 `DiaryConfig.js` 中新增 `buy_wall` 类别
  - 修改 `DiaryManager.logEvent()` 判断家具类型
  - 判断逻辑：`type === 'wall'` → 触发 `buy_wall` 文案
  - 判断逻辑：`type === 'small' && layer === 2` → 触发 `buy_small` 文案
- [x] **涉及文件**：
  - `scripts/data/DiaryConfig.js`
  - `scripts/managers/DiaryManager.js`

### 2. 方形墙纸拉伸问题
- [x] **问题**：有图案的方形墙纸会被拉伸变形
- [x] **方案**：
  - 检查墙纸贴图的 UV 映射逻辑
  - 使用 `wallpaperUnitWidth` 配置正确计算贴图重复次数
  - 确保贴图的 `wrapS` 和 `wrapT` 设置为 `THREE.RepeatWrapping`
  - 根据墙面实际尺寸计算 repeat 值：`repeat.x = wallWidth / wallpaperUnitWidth`
- [x] **涉及文件**：
  - `scripts/main.js` (墙面贴图应用逻辑)
  - `scripts/data/FurnitureDB.js` (检查 wallpaperUnitWidth 配置)

### 3. 快递箱尺寸错误
- [x] **问题**：快递箱大小根据绿色框生成，应该根据红色框
- [x] **方案**：
  - 找到快递箱生成逻辑
  - 确认红色框和绿色框分别代表什么（可能是家具实际尺寸 vs 碰撞盒）
  - 修改 `spawnBox()` 函数使用正确的尺寸参考
- [x] **涉及文件**：
  - `scripts/main.js` (搜索 `box` 或 `快递` 相关逻辑)

---

## 🟡 中优先级 - 新功能

### 4. 春节物品日记彩蛋 ✅ (已在任务1中完成)
- [x] **需求**：在日记中添加对中国春节物件的特殊描述
- [x] **方案**：
  - 在 `DiaryConfig.js` 的 `specific_items` 中添加：
    - `CalligraphyFu` (福字)
    - `XingshiMask` (醒狮面具)  
    - `RedKnot` (中国结)
  - 编写傲娇风格文案
- [x] **示例文案**：
```javascript
'CalligraphyFu': [
    "两脚兽在墙上贴了个倒着的红色方块（福字）。我不懂为什么要倒着贴，人类的审美真是个谜。",
    "那个红色的大字（福字）散发着奇怪的胶水味。我绕道走了，懒得理它。"
],
'XingshiMask': [
    "墙上多了一张狮子脸（醒狮面具）。半夜它盯着我看，气氛诡异，我决定今晚睡床底下。",
    "那个彩色的大嘴巴（醒狮面具）太吵闹了，不符合我安静优雅的气质。"
],
'RedKnot': [
    "墙上挂了一团红色的绳子（中国结）。我试图把它扯下来当玩具，但够不到，气死了。",
    "那个红色的装饰品晃来晃去的，非常碍眼。我已经计划好，等两脚兽不在的时候跳上去咬它。"
]
```
- [x] **涉及文件**：
  - `scripts/data/DiaryConfig.js`

### 5. 存档导出/导入 UI 入口
- [x] **需求**：游戏中目前没有存档导出/导入的 UI 入口
- [x] **方案**：
  - 在设置面板或 Debug 面板中添加两个按钮
  - "导出存档"：调用 `saveManager.exportSave()`，生成下载文件或复制到剪贴板
  - "导入存档"：弹出文件选择或文本框，调用 `saveManager.importSave(jsonString)`
  - 导入成功后刷新页面加载新存档
- [x] **涉及文件**：
  - `index.html` (添加按钮)
  - `scripts/main.js` (添加事件处理)
  - `scripts/managers/GameSaveManager.js` (添加导出/导入方法)
  - `styles/main.css` (按钮样式)

### 6. 增加地板图案
- [x] **需求**：增加更多地板纹理选项
- [x] **方案**：
  - 制作或获取新的地板贴图（如大理石、木拼花、草地等）
  - 在 `FurnitureDB.js` 的 `decor` 类型中添加新地板
  - 配置 `textureFile` 指向新贴图文件
- [x] **已添加**：
  - `floor_plank` - 原木板地板 (使用 plank_flooring_04_diff_1k.jpg)
  - `floor_flower` - 花砖地板 (使用 FlowerFloor.png)
  - `floor_darkwood` - 深色木地板 (使用 wood.jpg)
- [x] **涉及文件**：
  - `scripts/data/FurnitureDB.js`

---

## 🟢 低优先级 - 新内容

### 7. 马年盲盒 - 小马手办
- [ ] **需求**：增加一个盲盒家具，打开后随机获得一个小马手办
- [ ] **方案**：
  - 在 `FurnitureDB.js` 中添加：
    - 盲盒家具 `blind_box_horse`
    - 多款小马手办 `horse_figure_1`, `horse_figure_2` 等
  - 盲盒购买后触发随机逻辑
  - 随机选择一款小马手办放置在场景中
  - 日记系统添加盲盒开启的专属文案
- [ ] **技术要点**：
  - 需要制作/获取多款小马模型
  - 购买盲盒时不直接放置，而是先播放开箱动画
  - 随机算法决定获得哪款手办
- [ ] **涉及文件**：
  - `scripts/data/FurnitureDB.js`
  - `scripts/main.js` (盲盒逻辑)
  - `assets/models/` (新增模型)

### 8. 扫地机器人 AI
- [x] **需求**：
  - 扫地机器人会在房间里移动打扫
  - 猫咪会跳上正在运行的扫地机器人站着
- [x] **方案**：
  - 为扫地机器人添加 `isVehicle` 属性和 `update` 逻辑
  - 实现移动/暂停状态机，碰到边界/障碍物转向
  - 猫咪 AI 新增 `riding` 状态，30% 概率对运动中的机器人感兴趣
  - 站在机器人上时，跟随机器人移动和旋转
- [x] **已完成**：
  - 实现了机器人的随机巡逻与暂停逻辑
  - 实现了猫咪的骑乘行为
  - 添加了专属日记
- [x] **涉及文件**：
  - `scripts/data/FurnitureDB.js`
  - `scripts/systems/Furniture.js`
  - `scripts/entities/Cat.js`
  - `scripts/main.js`

---

## 📝 备注

### 已确认的设计决定

1. **Debug 工具栏**：开发用途，最终版本将隐藏
2. **存档导出/导入**：功能已实现，需要添加 UI 入口
3. **极光效果**：未完成内容，暂不在文档中提及

### 优先级说明

| 优先级 | 说明 |
|--------|------|
| 🔴 高 | Bug 修复，影响现有功能 |
| 🟡 中 | 新功能，提升用户体验 |
| 🟢 低 | 新内容，锦上添花 |

---

## 📊 进度追踪

| 任务 | 状态 | 预计工时 | 实际工时 |
|------|------|----------|----------|
| 日记区分墙面/小物 | [ ] | 1h | - |
| 方形墙纸拉伸修复 | [ ] | 2h | - |
| 快递箱尺寸修复 | [ ] | 1h | - |
| 春节物品日记 | [ ] | 0.5h | - |
| 存档导出/导入 UI | [ ] | 2h | - |
| 新增地板图案 | [ ] | 1h | - |
| 马年盲盒 | [ ] | 4h | - |
| 扫地机器人功能 | [ ] | 6h | - |
