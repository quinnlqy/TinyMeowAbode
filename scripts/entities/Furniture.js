/**
 * Furniture - 家具类
 * 管理家具的状态和交互
 */
import * as THREE from 'three';
import { GameContext } from '../core/GameContext.js';

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

        // 载具属性
        this.isVehicle = dbItem.isVehicle || false;
        this.isMoving = true;
        this.isTurning = false;
        this.targetRotation = 0;
        this.moveTimer = 5 + Math.random() * 10;
        this.pauseTimer = 0;
        this.collisionCount = 0; // 连续碰撞计数器 (检测是否卡住)
        
        // [新增] 扫地机器人覆盖式清扫路径
        this.sweepMode = 'zigzag'; // 'zigzag' = 之字形清扫, 'edge' = 沿边清扫
        this.sweepDirection = 1;   // 1 = 正向, -1 = 反向 (用于之字形)
        this.sweepLane = 0;        // 当前清扫的"行"
        this.edgeWall = null;      // 当前沿着哪面墙清扫 ('north', 'south', 'east', 'west')
        this.lastTurnWasCollision = false; // 上次转向是否因为碰撞
        this.zigzagStepCount = 0;  // 之字形步数计数

        if (this.isVehicle && this.callbacks.logToScreen) {
            // this.callbacks.logToScreen(`Vehicle initialized: ${dbItem.id}`);
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
        // [新增] 盲盒开启逻辑
        if (this.dbItem.isBlindBox) {
            // 随机抽取
            const pool = this.dbItem.blindBoxPool || [];
            if (pool.length > 0) {
                const pickedId = pool[Math.floor(Math.random() * pool.length)];

                // 调用替换回调
                if (this.callbacks.replaceFurniture) {
                    this.callbacks.replaceFurniture(this.mesh, pickedId);

                    // 记录日记
                    if (this.callbacks.diaryManager) {
                        this.callbacks.diaryManager.logEvent('open_blind_box', {}, 80);
                    }
                    return true;
                }
            }
        }

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

    /**
     * 更新逻辑 (每一帧调用)
     * @param {number} dt Delta time
     */
    update(dt) {
        if (!this.isVehicle) return;

        // 1. 转向状态 (最高优先级)
        if (this.isTurning) {
            // 平滑旋转 logic
            const rotateSpeed = 2.0; // 弧度/秒
            let diff = this.targetRotation - this.mesh.rotation.y;
            
            // 规范化角度差到 [-PI, PI]
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;

            if (Math.abs(diff) < 0.05) {
                // 旋转完成
                this.mesh.rotation.y = this.targetRotation;
                // 规范化当前角度
                while (this.mesh.rotation.y > Math.PI) this.mesh.rotation.y -= Math.PI * 2;
                while (this.mesh.rotation.y < -Math.PI) this.mesh.rotation.y += Math.PI * 2;
                
                this.isTurning = false;
                this.isMoving = true; // 恢复移动
                console.log(`[Robot] 转向完成，当前朝向: ${(this.mesh.rotation.y * 180 / Math.PI).toFixed(1)}度`);
            } else {
                // 插值旋转
                const step = rotateSpeed * dt;
                // 简单逼近
                if (diff > 0) this.mesh.rotation.y += Math.min(diff, step);
                else this.mesh.rotation.y -= Math.min(-diff, step);
            }
            return;
        }

        // 2. 移动状态
        if (this.isMoving) {
            // 移动逻辑
            const speedPerSec = this.dbItem.moveSpeed || 1.5;
            const moveStep = speedPerSec * dt;

            const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
            const currentPos = this.mesh.position;
            const nextPos = currentPos.clone().add(dir.clone().multiplyScalar(moveStep));

            // [边界检查] 房间范围 -4.5 ~ 4.5
            const boundary = 4.3;
            const hitBoundary = Math.abs(nextPos.x) > boundary || Math.abs(nextPos.z) > boundary;
            
            // [修复] 如果刚转向完成，先走几步再检测边界，避免死循环
            if (this.justTurned) {
                this.postTurnMoveCount++;
                if (this.postTurnMoveCount > 30) { // 约 0.5 秒后恢复正常检测
                    this.justTurned = false;
                }
            }
            
            // [修复] 如果刚转向，暂时不检测边界，但仍然强制限制在边界内
            if (hitBoundary) {
                if (this.justTurned) {
                    // 刚转向，不触发再次转向，但限制位置
                    nextPos.x = Math.max(-boundary, Math.min(boundary, nextPos.x));
                    nextPos.z = Math.max(-boundary, Math.min(boundary, nextPos.z));
                } else {
                    console.log('[Robot] 撞墙边界，执行之字形转向');
                    this.performZigzagTurn();
                    return;
                }
            }

            // [碰撞检查] - 使用实际模型包围盒进行碰撞检测
            let hasCollision = false;
            let collidedWith = null;
            if (GameContext.placedFurniture) {
                const lookAheadDist = 0.5;
                const predictedPos = nextPos.clone();
                predictedPos.add(dir.clone().multiplyScalar(lookAheadDist));
                const robotRadius = 0.35;

                for (const otherMesh of GameContext.placedFurniture) {
                    if (otherMesh === this.mesh) continue;
                    if (!otherMesh.userData || !otherMesh.userData.parentClass) continue;
                    
                    const dbItem = otherMesh.userData.parentClass.dbItem;
                    if (!dbItem) continue;
                    if (dbItem.layer === 0) continue;
                    if (dbItem.type === 'wall') continue;
                    if (dbItem.layer === 2) continue;
                    if (dbItem.isVehicle) continue;
                    
                    const otherBox = new THREE.Box3().setFromObject(otherMesh);
                    otherBox.expandByScalar(robotRadius);
                    
                    if (otherBox.containsPoint(predictedPos)) {
                        hasCollision = true;
                        collidedWith = dbItem.name || 'unknown';
                        break;
                    }
                }
            }

            if (hasCollision) {
                console.log(`[Robot] 检测到碰撞: ${collidedWith}`);
                this.collisionCount++;
                if (this.collisionCount > 4) {
                    console.log("[Robot] 卡住了，随机换方向...");
                    this.isMoving = false;
                    this.pauseTimer = 2.0;
                    this.collisionCount = 0;
                    // 卡住后随机选择新方向
                    this.sweepMode = Math.random() < 0.5 ? 'zigzag' : 'random';
                } else {
                    this.performZigzagTurn();
                }
                return;
            }

            // 移动成功，重置碰撞计数
            if (this.collisionCount > 0) this.collisionCount = Math.max(0, this.collisionCount - 0.1);
            this.lastTurnWasCollision = false;

            this.mesh.position.copy(nextPos);
            this.zigzagStepCount++;

            // [新增] 之字形清扫：定期检查是否需要转向覆盖下一行
            // 每走一段距离后，有概率切换到另一条清扫路线
            if (this.sweepMode === 'zigzag' && this.zigzagStepCount > 200 && Math.random() < 0.02) {
                console.log('[Robot] 之字形清扫：主动换行');
                this.performZigzagTurn();
                this.zigzagStepCount = 0;
            }

            // [新增] 骑乘逻辑：如果有什么东西坐在我上面，带着它一起走
            if (this.rider && this.rider.mesh) {
                const riderPos = this.mesh.position.clone();
                riderPos.y += 0.15;
                this.rider.mesh.position.copy(riderPos);
                this.rider.mesh.rotation.y = this.mesh.rotation.y + Math.PI;
            }

        } else {
            // 3. 暂停状态
            this.pauseTimer -= dt;
            if (this.pauseTimer <= 0) {
                this.isMoving = true;
                this.moveTimer = 5 + Math.random() * 10;
                // 暂停结束后，选择新的清扫方向
                this.startSmartTurn();
            }
        }
    }

    /**
     * [新增] 执行之字形转向
     * 撞墙或碰撞后，转90度继续清扫
     */
    performZigzagTurn() {
        this.isMoving = false;
        this.isTurning = true;
        this.zigzagStepCount = 0;
        
        // [修复] 设置刚转向标记，转向完成后需要先走一小段再检测边界
        this.justTurned = true;
        this.postTurnMoveCount = 0;

        const currentRot = this.mesh.rotation.y;
        
        // 之字形清扫核心逻辑：
        // 撞墙后，先转90度移动一小段，然后再转90度反向清扫
        // 这样就能形成"回"字形或"之"字形的清扫路径
        
        // 计算当前主要朝向 (量化到4个方向)
        const normalizedRot = ((currentRot % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const facing = Math.round(normalizedRot / (Math.PI / 2)) % 4; // 0=北, 1=东, 2=南, 3=西
        
        // 交替左右转，模拟真实扫地机器人的覆盖式清扫
        const turnDirection = this.sweepDirection;
        this.sweepDirection *= -1; // 下次反向转
        
        // 转90度
        const turnAngle = (Math.PI / 2) * turnDirection;
        this.targetRotation = currentRot + turnAngle;
        
        console.log(`[Robot] 之字形转向: ${turnDirection > 0 ? '右转' : '左转'}90度`);
    }

    /**
     * [新增] 智能转向 - 选择一个开阔的方向
     */
    startSmartTurn() {
        this.isMoving = false;
        this.isTurning = true;

        const currentPos = this.mesh.position;
        const currentRot = this.mesh.rotation.y;
        const robotRadius = 0.35;
        const boundary = 4.2;

        // 检测多个方向的开阔程度
        const directions = [];
        for (let deg = 0; deg < 360; deg += 45) {
            const rad = deg * (Math.PI / 180);
            const testRot = rad;
            
            // 模拟在这个方向走一段距离
            const dir = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), testRot);
            
            // 检测这个方向能走多远
            let maxDist = 0;
            for (let dist = 0.5; dist <= 3.0; dist += 0.5) {
                const testPos = currentPos.clone().add(dir.clone().multiplyScalar(dist));
                
                // 边界检查
                if (Math.abs(testPos.x) > boundary || Math.abs(testPos.z) > boundary) {
                    break;
                }
                
                // 碰撞检查
                let hasCollision = false;
                if (GameContext.placedFurniture) {
                    for (let otherMesh of GameContext.placedFurniture) {
                        if (otherMesh === this.mesh) continue;
                        if (!otherMesh.userData || !otherMesh.userData.parentClass) continue;
                        
                        const dbItem = otherMesh.userData.parentClass.dbItem;
                        if (!dbItem) continue;
                        if (dbItem.layer === 0 || dbItem.type === 'wall' || dbItem.layer === 2 || dbItem.isVehicle) continue;
                        
                        const otherBox = new THREE.Box3().setFromObject(otherMesh);
                        otherBox.expandByScalar(robotRadius);
                        
                        if (otherBox.containsPoint(testPos)) {
                            hasCollision = true;
                            break;
                        }
                    }
                }
                
                if (hasCollision) break;
                maxDist = dist;
            }
            
            directions.push({ deg, rad: testRot, maxDist });
        }

        // 按开阔程度排序，选择最开阔的方向（加入一点随机性）
        directions.sort((a, b) => b.maxDist - a.maxDist);
        
        // 从前3个最开阔的方向中随机选一个
        const topChoices = directions.slice(0, 3).filter(d => d.maxDist > 0.5);
        if (topChoices.length > 0) {
            const choice = topChoices[Math.floor(Math.random() * topChoices.length)];
            this.targetRotation = choice.rad;
            console.log(`[Robot] 智能转向: 选择${choice.deg}度方向，开阔距离${choice.maxDist.toFixed(1)}米`);
        } else {
            // 都堵住了，随机转
            this.targetRotation = Math.random() * Math.PI * 2;
            console.log('[Robot] 智能转向: 四面楚歌，随机转向');
        }
    }

    startTurning(isBigTurn) {
        // [修改] 直接调用之字形转向或智能转向
        if (isBigTurn) {
            this.performZigzagTurn();
        } else {
            // 碰撞时，有50%概率用之字形，50%用智能转向
            if (Math.random() < 0.5) {
                this.performZigzagTurn();
            } else {
                this.startSmartTurn();
            }
        }
    }

    turnRandomly() {
        this.startTurning(false);
    }
}
