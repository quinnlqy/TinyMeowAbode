/**
 * 家具类 - 家具实例和功能管理
 * @module systems/Furniture
 */
import * as THREE from 'three';
import gameState from '../core/GameState.js';
import { audioManager } from '../managers/AudioManager.js';
import { diaryManager } from '../managers/DiaryManager.js';
import { saveManager } from '../managers/SaveManager.js';

export class Furniture {
    constructor(mesh, dbItem) {
        this.mesh = mesh;
        this.dbItem = dbItem;
        this.isBox = dbItem.id.toLowerCase().includes('box');
        
        // 功能状态
        this.functionalState = null;
        this.modelEmpty = null;
        this.modelFull = null;
        
        // 关联到mesh
        mesh.userData.parentClass = this;
        mesh.userData.itemId = dbItem.id;
        
        this.init();
    }

    init() {
        // 获取模型引用
        if (this.mesh.children.length > 0) {
            this.modelEmpty = this.mesh.children[0];
        }
        
        // 加载满状态模型
        if (this.dbItem.fullModelFile && gameState.loadedModels[this.dbItem.fullModelFile]) {
            const fullModel = gameState.loadedModels[this.dbItem.fullModelFile].scene.clone();
            this.modelFull = fullModel;
            this.mesh.add(this.modelFull);
        }
        
        // 初始化功能状态
        if (this.dbItem.subType === 'food') {
            this.functionalState = 'full';
        } else if (this.dbItem.subType === 'toilet') {
            this.functionalState = 'clean';
        }
        
        this.updateVisuals();
    }

    /**
     * 更新视觉状态
     */
    updateVisuals() {
        if (!this.modelEmpty) return;
        
        const setVis = (emptyVis, fullVis) => {
            this.modelEmpty.visible = emptyVis;
            if (this.modelFull) this.modelFull.visible = fullVis;
        };
        
        if (this.dbItem.subType === 'food') {
            this.functionalState === 'full' ? setVis(false, true) : setVis(true, false);
        } else if (this.dbItem.subType === 'toilet') {
            this.functionalState === 'clean' ? setVis(false, true) : setVis(true, false);
        }
    }

    /**
     * 玩家交互
     * @returns {boolean} 是否需要确认对话框
     */
    interact() {
        const needsRefill = 
            (this.dbItem.subType === 'food' && this.functionalState === 'empty') ||
            (this.dbItem.subType === 'toilet' && this.functionalState === 'dirty');
        
        if (needsRefill) {
            const title = this.dbItem.subType === 'food' ? "补充猫粮?" : "清理猫砂?";
            return {
                needsDialog: true,
                title: title,
                message: "需要消耗 10 爱心",
                onConfirm: () => this.confirmRefill()
            };
        }
        return { needsDialog: false };
    }

    /**
     * 确认补充/清理
     */
    confirmRefill() {
        if (gameState.heartScore >= 10) {
            gameState.updateMoney(-10);
            
            if (this.dbItem.subType === 'food') {
                this.functionalState = 'full';
                this.showEmote('🍚');
                diaryManager.logEvent('feed', {}, 50);
                audioManager.playSfx('pour_food');
            } else {
                this.functionalState = 'clean';
                this.showEmote('✨');
                diaryManager.logEvent('clean', {}, 50);
                audioManager.playSfx('scoop_sand');
            }
            
            this.updateVisuals();
            saveManager.saveGame();
        } else {
            alert("爱心不足！");
        }
    }

    /**
     * 猫咪使用
     */
    useByCat() {
        if (this.dbItem.subType === 'food' && this.functionalState === 'full') {
            this.functionalState = 'empty';
            this.updateVisuals();
            this.showEmote('😋');
        } else if (this.dbItem.subType === 'toilet' && this.functionalState === 'clean') {
            this.functionalState = 'dirty';
            this.updateVisuals();
            this.showEmote('💩');
        }
        saveManager.saveGame();
    }

    /**
     * 显示表情
     * @param {string} emoji 
     */
    showEmote(emoji) {
        // 创建临时表情元素
        const emote = document.createElement('div');
        emote.className = 'floating-emote';
        emote.textContent = emoji;
        emote.style.cssText = `
            position: fixed;
            font-size: 32px;
            pointer-events: none;
            z-index: 1000;
            animation: floatUp 1s ease-out forwards;
        `;
        
        // 计算屏幕位置
        const pos = this.mesh.position.clone();
        pos.y += 1;
        pos.project(gameState.camera);
        
        const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(pos.y * 0.5) + 0.5) * window.innerHeight;
        
        emote.style.left = `${x}px`;
        emote.style.top = `${y}px`;
        
        document.body.appendChild(emote);
        
        setTimeout(() => emote.remove(), 1000);
    }

    /**
     * 获取序列化数据
     */
    serialize() {
        return {
            id: this.dbItem.id,
            position: {
                x: this.mesh.position.x,
                y: this.mesh.position.y,
                z: this.mesh.position.z
            },
            rotation: this.mesh.rotation.y,
            funcState: this.functionalState
        };
    }
}

export default Furniture;
