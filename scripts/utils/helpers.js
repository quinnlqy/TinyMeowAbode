/**
 * 工具函数集合
 * @module utils/helpers
 */
import * as THREE from 'three';
import gameState from '../core/GameState.js';

/**
 * 设置DOM元素文本
 * @param {string} id - 元素ID
 * @param {string|number} text - 文本内容
 */
export function setDomText(id, text) {
    const el = document.getElementById(id);
    if (el) {
        el.innerText = text;
    } else {
        console.warn(`Element #${id} not found`);
    }
}

/**
 * 更新状态文本 (发送到日志面板)
 * @param {string} text - 状态文本
 * @param {string} type - 类型 ('info' | 'valid' | 'invalid')
 */
export function updateStatusText(text, type = 'info') {
    let logType = 'info';
    if (type === 'invalid') logType = 'error';
    else if (type === 'valid') logType = 'warn';
    
    if (typeof window.logToScreen === 'function') {
        window.logToScreen(text, logType);
    } else {
        console.log(text);
    }
}

/**
 * 在世界坐标位置显示浮动表情
 * @param {THREE.Vector3} worldPos - 世界坐标
 * @param {string} emoji - 表情符号
 */
export function showEmote(worldPos, emoji) {
    const pos = worldPos.clone();
    pos.y += 1.2;
    pos.project(gameState.camera);
    
    const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(pos.y * 0.5) + 0.5) * window.innerHeight;
    
    const el = document.createElement('div');
    el.className = 'emote-bubble';
    el.innerText = emoji;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

/**
 * 显示浮动金钱获取动画
 * @param {THREE.Vector3} worldPos - 世界坐标
 * @param {number} amount - 金额
 */
export function spawnHeart(worldPos, amount = 5) {
    const pos = worldPos.clone();
    pos.y += 1;
    pos.project(gameState.camera);
    
    const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(pos.y * 0.5) + 0.5) * window.innerHeight;
    
    const el = document.createElement('div');
    el.className = 'heart-float';
    el.innerText = `❤ +${amount}`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    
    document.body.appendChild(el);
    gameState.updateMoney(amount);
    
    setTimeout(() => el.remove(), 1500);
}

/**
 * 材质优化函数 - 赋予模型"动森"般的磨砂质感
 * @param {THREE.Object3D} child - Three.js对象
 */
export function sanitizeMaterial(child) {
    if (!child.isMesh) return;
    
    child.castShadow = true;
    child.receiveShadow = true;
    
    if (child.material.map) {
        child.material.map.colorSpace = THREE.SRGBColorSpace;
    }
    
    const isGlass = child.name.toLowerCase().includes('glass') || 
                    child.name.toLowerCase().includes('window');
    
    child.material.metalness = 0.0;
    child.material.roughness = 0.7;
    
    if (isGlass) {
        child.material.transparent = true;
        child.material.opacity = 0.3;
        child.material.color.setHex(0x88ccff);
        child.material.roughness = 0.1;
        child.material.metalness = 0.8;
    } else {
        child.material.transparent = false;
        child.material.opacity = 1.0;
    }
    
    child.material.needsUpdate = true;
}

/**
 * 显示确认对话框
 * @param {string} title - 标题
 * @param {string} msg - 消息
 * @param {Function} onYes - 确认回调
 */
export function showConfirmDialog(title, msg, onYes) {
    setDomText('dialog-title', title);
    setDomText('dialog-msg', msg);
    
    const dialog = document.getElementById('confirm-dialog');
    dialog.style.display = 'block';
    
    const yesBtn = document.getElementById('btn-confirm-yes');
    const newBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newBtn, yesBtn);
    
    newBtn.onclick = () => {
        onYes();
        closeConfirmDialog();
    };
}

/**
 * 关闭确认对话框
 */
export function closeConfirmDialog() {
    document.getElementById('confirm-dialog').style.display = 'none';
}

/**
 * 限制数值在范围内
 * @param {number} value 
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

/**
 * 线性插值
 * @param {number} a 
 * @param {number} b 
 * @param {number} t 
 * @returns {number}
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * 随机选择数组元素
 * @param {Array} arr 
 * @returns {*}
 */
export function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// 导出到全局 (兼容旧代码)
window.closeDialog = closeConfirmDialog;
