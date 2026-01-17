/**
 * 游戏存档管理器
 * @module managers/SaveManager
 */
import gameState from '../core/GameState.js';

class SaveManager {
    constructor() {
        this.saveKey = 'cat_game_save_v2';
    }

    /**
     * 保存游戏
     */
    saveGame() {
        const saveData = {
            version: 2,
            timestamp: Date.now(),
            heartScore: gameState.heartScore,
            activeDecor: gameState.activeDecorId,
            catStats: gameState.cats.map(cat => ({
                hunger: cat.stats.hunger,
                toilet: cat.stats.toilet,
                position: {
                    x: cat.mesh.position.x,
                    y: cat.mesh.position.y,
                    z: cat.mesh.position.z
                },
                state: cat.state
            })),
            furniture: gameState.placedFurniture.map(f => {
                const pc = f.userData.parentClass;
                return {
                    id: pc ? pc.dbItem.id : f.userData.itemId,
                    position: { x: f.position.x, y: f.position.y, z: f.position.z },
                    rotation: f.rotation.y,
                    funcState: pc ? pc.functionalState : null
                };
            })
        };

        localStorage.setItem(this.saveKey, JSON.stringify(saveData));
        console.log("Game Saved:", saveData);
    }

    /**
     * 读取存档
     * @returns {Object|null} 存档数据或null
     */
    loadGame() {
        const json = localStorage.getItem(this.saveKey);
        if (!json) return null;

        try {
            const data = JSON.parse(json);
            return data;
        } catch (e) {
            console.error("Save file corrupted", e);
            return null;
        }
    }

    /**
     * 检查是否有存档
     * @returns {boolean}
     */
    hasSave() {
        return localStorage.getItem(this.saveKey) !== null;
    }

    /**
     * 删除存档
     */
    deleteSave() {
        localStorage.removeItem(this.saveKey);
        console.log("Save deleted");
    }

    /**
     * 导出存档为JSON字符串
     * @returns {string}
     */
    exportSave() {
        return localStorage.getItem(this.saveKey) || '';
    }

    /**
     * 导入存档
     * @param {string} jsonString - JSON字符串
     * @returns {boolean} 是否成功
     */
    importSave(jsonString) {
        try {
            JSON.parse(jsonString); // 验证格式
            localStorage.setItem(this.saveKey, jsonString);
            return true;
        } catch (e) {
            console.error("Invalid save data", e);
            return false;
        }
    }
}

// 单例导出
export const saveManager = new SaveManager();
export default saveManager;
