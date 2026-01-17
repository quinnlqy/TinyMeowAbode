/**
 * 猫咪的家 - 主入口文件
 * @version 2.0.0 (模块化重构版)
 * 
 * 目录结构:
 * scripts/
 * ├── main.js          # 入口文件
 * ├── Game.js          # 主游戏类
 * ├── core/            # 核心模块
 * │   ├── Constants.js # 常量配置
 * │   ├── GameState.js # 全局状态
 * │   └── Shaders.js   # 自定义着色器
 * ├── managers/        # 管理器
 * │   ├── AudioManager.js
 * │   ├── SaveManager.js
 * │   └── DiaryManager.js
 * ├── systems/         # 游戏系统
 * │   ├── Cat.js
 * │   ├── Furniture.js
 * │   └── WeatherSystem.js
 * ├── data/            # 数据配置
 * │   └── FurnitureDB.js
 * └── utils/           # 工具函数
 *     └── helpers.js
 */

import { Game } from './Game.js';
import { gameState } from './core/GameState.js';
import { audioManager, saveManager, diaryManager } from './managers/index.js';
import { FURNITURE_DB, getFurnitureByCategory } from './data/FurnitureDB.js';
import { setDomText, updateStatusText, showConfirmDialog } from './utils/helpers.js';

// ========== 全局实例 ==========
let game = null;

// ========== 初始化 ==========
async function init() {
    try {
        // 显示强制启动按钮（5秒后）
        setTimeout(() => {
            const ls = document.getElementById('loading-screen');
            if (ls && ls.style.display !== 'none') {
                document.getElementById('force-start-btn').style.display = 'block';
            }
        }, 5000);

        // 创建并初始化游戏
        game = new Game();
        await game.init();
        
    } catch (e) {
        console.error("Init Error:", e);
        alert("初始化错误: " + e.message);
    }
}

// ========== 暴露到全局的函数 (供 HTML onclick 调用) ==========

// 商店相关
window.switchCategory = function(category) {
    const currentCategory = category;
    
    // 更新页签高亮
    document.querySelectorAll('.shop-tab').forEach((tab, idx) => {
        const cats = ['floor', 'small', 'wall', 'decor'];
        if (cats[idx] === category) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    renderShopItems(category);
};

window.renderShopItems = renderShopItems;
function renderShopItems(category) {
    const container = document.getElementById('items-scroll');
    if (!container) return;
    
    container.innerHTML = '';
    
    const items = getFurnitureByCategory(category);
    
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';
        
        const isOwned = gameState.activeDecorId[item.decorType] === item.id;
        const canAfford = gameState.heartScore >= item.price;
        
        if (!canAfford && !isOwned) {
            card.classList.add('disabled');
        }
        
        card.innerHTML = `
            <div class="item-icon">${item.name.charAt(0)}</div>
            <div class="item-name">${item.name}</div>
            <div class="item-price">❤ ${item.price}</div>
        `;
        
        if (!card.classList.contains('disabled')) {
            card.onclick = () => window.startNewPlacement(item.id);
        }
        
        container.appendChild(card);
    });
}

// 日记相关
window.diaryManager = diaryManager;
window.toggleDiary = function() {
    const modal = document.getElementById('diary-modal');
    
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        diaryManager.flushPendingEvents();
        diaryManager.viewingDate = new Date();
        diaryManager.renderPage();
        diaryManager.updateUIHint(false);
        audioManager.playSfx('ui_popup');
    } else {
        modal.classList.add('hidden');
        audioManager.playSfx('ui_close');
    }
};

// 商店面板
window.toggleShop = function() {
    const shop = document.getElementById('shop-panel-container');
    
    if (shop.classList.contains('hidden-bottom')) {
        shop.classList.remove('hidden-bottom');
        audioManager.playSfx('ui_popup');
    } else {
        shop.classList.add('hidden-bottom');
        audioManager.playSfx('ui_close');
    }
};

// 时间控制
window.toggleTimePopover = function() {
    const pop = document.getElementById('time-popover');
    if (pop) pop.classList.toggle('hidden');
};

// 调试功能
window.debugAddMoney = function() {
    gameState.updateMoney(100);
    updateStatusText("Debug: +100 爱心");
};

window.debugResetCat = function() {
    gameState.cats.forEach(cat => {
        cat.mesh.position.set(0, 0, 0);
        cat.state = 'idle';
        cat.stats.hunger = 80;
        cat.stats.toilet = 80;
    });
    updateStatusText("Debug: 猫咪已重置");
};

window.toggleDebugGizmos = function() {
    updateStatusText("Debug: 线框模式切换");
};

window.toggleConsole = function() {
    const console = document.getElementById('debug-console');
    if (console) {
        console.style.display = console.style.display === 'none' ? 'block' : 'none';
    }
};

window.debugGenDiary = function() {
    diaryManager.logEvent('debug_event', { item: "测试日记条目" }, 50);
    updateStatusText("Debug: 已生成日记");
};

window.debugClearDiary = function() {
    diaryManager.clearAll();
    updateStatusText("Debug: 日记已清空");
};

window.toggleShadows = function() {
    if (gameState.sunLight) {
        gameState.sunLight.castShadow = !gameState.sunLight.castShadow;
        updateStatusText("阴影: " + (gameState.sunLight.castShadow ? "开" : "关"));
    }
};

window.toggleWeather = function() {
    if (game && game.weatherSystem) {
        const weather = game.weatherSystem.toggleWeather();
        updateStatusText("天气: " + weather);
    }
};

// 强制启动
window.forceStart = function() {
    const ls = document.getElementById('loading-screen');
    if (ls) ls.style.display = 'none';
};

// 关闭对话框
window.closeDialog = function() {
    document.getElementById('confirm-dialog').style.display = 'none';
};

// ========== 启动游戏 ==========
init();
