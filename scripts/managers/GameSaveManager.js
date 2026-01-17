/**
 * GameSaveManager - 游戏存档管理器
 * 负责保存和加载游戏进度
 */

export class GameSaveManager {
    /**
     * @param {Function} getGameData - 获取游戏数据的回调，返回 { cats, heartScore, activeDecorId, placedFurniture }
     * @param {Function} restoreCallbacks - 恢复数据的回调对象 { setHeartScore, setActiveDecor, applyDecorVisuals, FURNITURE_DB }
     */
    constructor(getGameData, restoreCallbacks) {
        this.saveKey = 'cat_game_save_v1';
        this.getGameData = getGameData;
        this.restoreCallbacks = restoreCallbacks;
        
        // 自动保存间隔 (30秒)
        setInterval(() => this.saveGame(), 30000);
    }

    // 收集当前游戏数据并保存
    saveGame() {
        const data = this.getGameData();
        if (!data.cats || !data.cats[0]) return; // 还没初始化好

        const saveData = {
            // 1. 基础数据
            heartScore: data.heartScore,
            activeDecor: data.activeDecorId, // 装修状态
            
            // 2. 猫咪状态 (只存一只)
            catStats: {
                hunger: data.cats[0].stats.hunger,
                toilet: data.cats[0].stats.toilet,
            },

            // 3. 家具列表
            furniture: data.placedFurniture.map(f => {
                const p = f.userData.parentClass;
                return {
                    id: p.dbItem.id, // 核心ID
                    pos: { x: f.position.x, y: f.position.y, z: f.position.z },
                    rot: { y: f.rotation.y },
                    funcState: p.functionalState, 
                    isBox: p.isBox,
                    isTipped: p.isTipped,
                    boxHeight: p.boxHeight
                };
            })
        };

        localStorage.setItem(this.saveKey, JSON.stringify(saveData));
        console.log("Game Saved:", saveData);
    }

    // 读取并恢复游戏
    loadGame() {
        const json = localStorage.getItem(this.saveKey);
        if (!json) return false; // 没有存档

        try {
            const data = JSON.parse(json);
            const cb = this.restoreCallbacks;
            
            // 1. 恢复金钱
            if (data.heartScore !== undefined && cb.setHeartScore) {
                cb.setHeartScore(data.heartScore);
            }

            // 2. 恢复装修 (地板/墙壁)
            if (data.activeDecor && cb.setActiveDecor) {
                cb.setActiveDecor(data.activeDecor);
                if (data.activeDecor.floor) {
                    const item = cb.FURNITURE_DB.find(i => i.id === data.activeDecor.floor);
                    if (item && cb.applyDecorVisuals) cb.applyDecorVisuals(item);
                }
                if (data.activeDecor.wall) {
                    const item = cb.FURNITURE_DB.find(i => i.id === data.activeDecor.wall);
                    if (item && cb.applyDecorVisuals) cb.applyDecorVisuals(item);
                }
            }

            // 3. 返回数据供外部恢复猫咪状态和家具
            return data;

        } catch (e) {
            console.error("Save file corrupted", e);
            return false;
        }
    }
}
