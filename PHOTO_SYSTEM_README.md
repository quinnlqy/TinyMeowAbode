# 📷 照片系统使用说明

## 功能概述
游戏会自动为猫咪拍照并保存到日记本中，每天一张，最多保留30天。

## 自动拍照
- **触发时机**：每2小时检查一次
- **触发概率**：30%（优先选择猫咪在活动的时刻）
- **智能选择**：优先捕捉猫咪吃饭、睡觉、上厕所等有趣时刻
- **每日限制**：一天只保留一张照片

## 手动拍照
1. 打开日记本（点击底部📔按钮）
2. 在左侧照片框右下角找到📷按钮
3. 点击即可拍摄今天的照片
4. **限制**：每天只能拍一张，如果已拍过则无法再拍

## 照片存储
- **格式**：JPEG（quality: 0.7）
- **尺寸**：300x300像素
- **存储位置**：LocalStorage (key: `cat_game_photos_v1`)
- **保留天数**：30天（自动清理旧照片）
- **存储容量**：约每张15-30KB，30张约450KB-900KB

## 技术实现
- 使用 `renderer.domElement.toDataURL()` 截取3D场景
- 拍照时自动隐藏所有UI元素
- 智能调整相机到最佳位置（猫咪前方2-3米，俯视角度）
- 拍照闪光特效提示

## 音效接口
在 `PhotoManager.js` 的第269行预留了音效接口：
```javascript
// TODO: 播放拍照音效
// if (window.audioManager) {
//     window.audioManager.play('camera_shutter');
// }
```

你可以在 `AudioManager` 中添加拍照音效并取消注释这段代码。

## 调试
- 查看控制台日志：`📷 自动拍照：捕捉到有趣时刻！`
- 查看存储：Chrome DevTools → Application → Local Storage → `cat_game_photos_v1`

## 已知限制
- LocalStorage有5-10MB限制，30天照片约占1MB
- 如果存储失败会自动清理旧照片（保留20天）
- 照片质量固定为0.7，可在 `PhotoManager.js` 第262行调整

## 文件结构
```
scripts/
  └── managers/
      └── PhotoManager.js         // 照片管理器（新增）
      └── DiaryManager.js         // 日记管理器（已修改）
  └── main.js                     // 主逻辑（已集成）
index.html                        // 添加了拍照按钮
styles/main.css                   // 添加了按钮样式
```
