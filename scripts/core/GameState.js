/**
 * 全局游戏状态管理
 * @module core/GameState
 */
import * as THREE from 'three';

class GameStateManager {
    constructor() {
        // Three.js 核心对象
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.composer = null;
        
        // 光照
        this.sunLight = null;
        this.hemiLight = null;
        this.sunMesh = null;
        this.moonMesh = null;
        this.celestialGroup = null;
        
        // 场景元素
        this.floorPlane = null;
        this.wallGroup = [];
        this.obstacles = [];
        
        // 游戏对象
        this.cats = [];
        this.placedFurniture = [];
        this.loadedModels = {};
        
        // 交互状态
        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();
        this.mode = 'idle'; // idle, placing_new, moving_old, selecting
        this.ghostMesh = null;
        this.currentItemData = null;
        this.currentRotation = 0;
        this.canPlace = false;
        this.selectedObject = null;
        this.selectionBox = null;
        
        // 经济系统
        this.heartScore = 500;
        this.activeDecorId = { floor: null, wall: null };
        
        // 时间系统
        this.visualHour = 8.0;
        this.isTimeAuto = true;
        this.lastRealTime = Date.now();
        
        // 输入状态
        this.moveKeys = { w: false, a: false, s: false, d: false };
        
        // 时钟
        this.gameClock = new THREE.Clock();
        
        // 加载器
        this.textureLoader = new THREE.TextureLoader();
    }
    
    // 更新金钱
    updateMoney(delta) {
        this.heartScore += delta;
        const el = document.getElementById('heart-text-display');
        if (el) el.textContent = this.heartScore;
    }
    
    // 重置状态
    reset() {
        this.mode = 'idle';
        this.ghostMesh = null;
        this.currentItemData = null;
        this.selectedObject = null;
    }
}

// 单例导出
export const gameState = new GameStateManager();
export default gameState;
