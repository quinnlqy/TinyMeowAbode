/**
 * Furniture - 家具类
 * 管理家具的状态和交互
 */

export class Furniture {
    /**
     * @param {Object} mesh - Three.js 网格对象
     * @param {Object} dbItem - 家具数据库配置
     * @param {Object} callbacks - 回调函数集合
     */
    constructor(mesh, dbItem, callbacks = {}) {
        this.mesh = mesh;
        this.dbItem = dbItem;
        this.mesh.userData.parentClass = this;
        this.callbacks = callbacks;
        
        this.functionalState = null;
        this.isBox = false;
        this.isTipped = false;
        this.boxHeight = 0;
        this.modelEmpty = null;
        this.modelFull = null;
        
        if (this.dbItem.type === 'functional') {
            this.initFunctionalState();
        }
    }

    initFunctionalState() {
        if (this.mesh.children.length > 0) {
            this.modelEmpty = this.mesh.children[0];
        }
        
        if (this.dbItem.fullModelFile && this.callbacks.prepareModel) {
            const fullItemConfig = { 
                ...this.dbItem, 
                id: this.dbItem.id + '_full', 
                modelFile: this.dbItem.fullModelFile 
            };
            const fullGroup = this.callbacks.prepareModel(fullItemConfig);
            if (fullGroup) {
                this.modelFull = fullGroup.children[0];
                this.mesh.add(this.modelFull);
            } else if (this.callbacks.logToScreen) {
                this.callbacks.logToScreen(`Warning: Full model missing: ${this.dbItem.fullModelFile}`, 'error');
            }
        }
        
        // 新购买的功能性家具初始状态：食物盆是空的，猫砂盆是干净的
        if (this.dbItem.subType === 'food') {
            this.functionalState = 'empty';  // 新买的碗是空的，需要添加食物
        } else if (this.dbItem.subType === 'toilet') {
            this.functionalState = 'clean';  // 新买的猫砂盆是干净的
        }
        
        this.updateVisuals();
    }

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

    interact() {
        const needsRefill = 
            (this.dbItem.subType === 'food' && this.functionalState === 'empty') || 
            (this.dbItem.subType === 'toilet' && this.functionalState === 'dirty');

        if (needsRefill && this.callbacks.showConfirmDialog) {
            const title = this.dbItem.subType === 'food' ? "补充猫粮?" : "清理猫砂?";
            this.callbacks.showConfirmDialog(title, "需要消耗 10 爱心", () => {
                this.confirmRefill();
            });
            return true;
        }
        return false;
    }

    confirmRefill() {
        const cb = this.callbacks;
        
        if (!cb.getHeartScore || cb.getHeartScore() < 10) {
            alert("爱心不足！");
            return;
        }
        
        if (cb.updateMoney) cb.updateMoney(-10);

        if (this.dbItem.subType === 'food') {
            this.functionalState = 'full';
            if (cb.showEmote) cb.showEmote(this.mesh.position, '🍚');
            if (cb.updateStatusText) cb.updateStatusText("猫粮已加满");
            if (cb.diaryManager) cb.diaryManager.logEvent('feed', {}, 50);
            if (cb.audioManager) cb.audioManager.playSfx('pour_food');
        } else {
            this.functionalState = 'clean';
            if (cb.showEmote) cb.showEmote(this.mesh.position, '✨');
            if (cb.updateStatusText) cb.updateStatusText("猫砂盆已清理");
            if (cb.diaryManager) cb.diaryManager.logEvent('clean', {}, 50);
            if (cb.audioManager) cb.audioManager.playSfx('scoop_sand');
        }
        
        this.updateVisuals();
        if (cb.saveGame) cb.saveGame();
    }

    useByCat() {
        if (this.dbItem.subType === 'food' && this.functionalState === 'full') {
            this.functionalState = 'empty';
            this.updateVisuals();
            if (this.callbacks.showEmote) this.callbacks.showEmote(this.mesh.position, '😋');
        } else if (this.dbItem.subType === 'toilet' && this.functionalState === 'clean') {
            this.functionalState = 'dirty';
            this.updateVisuals();
            if (this.callbacks.showEmote) this.callbacks.showEmote(this.mesh.position, '💩');
        }
        
        if (this.callbacks.saveGame) this.callbacks.saveGame();
    }
}
