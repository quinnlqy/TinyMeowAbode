/**
 * Cat.js - 猫咪实体模块
 * 依赖 GameContext 获取全局资源
 */
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { GameContext } from '../core/GameContext.js';
import { CAT_CONFIG } from '../core/Constants.js';
import { createBlockCat, generateWanderTarget } from './CatUtils.js';

export class Cat {
    constructor(scene, color) {
        this.scene = scene;
        this.state = 'idle';
        this.stats = { hunger: 80, toilet: 80 };
        this.targetFurniture = null; this.nextAction = null;
        this.bubbleEl = document.getElementById('cat-bubble'); this.bubbleIcon = document.getElementById('bubble-icon');
        this.targetPos = new THREE.Vector3(); this.stopPos = new THREE.Vector3();
        this.jumpStart = new THREE.Vector3(); this.jumpEnd = new THREE.Vector3();
        this.interactTarget = null; this.timer = 0; this.mixer = null; this.actions = {}; this.isAnimated = false;
        this.petCount = 0; this.patience = 5 + Math.floor(Math.random() * 6); this.angryTime = 0;
        this.sleepMinDuration = 0;
        this.dismountCooldown = 0; // [修复] 下车后的冷却时间，防止立即再次上车

        this.mesh = new THREE.Group(); this.scene.add(this.mesh);
        this.downRay = new THREE.Raycaster(); this.downRay.ray.direction.set(0, -1, 0);
        this.forwardRay = new THREE.Raycaster();

        try {
            const loadedModels = GameContext.loadedModels;
            if (loadedModels && loadedModels['cat']) {
                const model = SkeletonUtils.clone(loadedModels['cat'].scene);
                model.scale.set(CAT_CONFIG.scale, CAT_CONFIG.scale, CAT_CONFIG.scale);
                model.position.y = CAT_CONFIG.yOffset; model.rotation.x = CAT_CONFIG.rotateX; model.rotation.y = CAT_CONFIG.rotateY;
                this.mesh.add(model);
                if (loadedModels['cat'].animations.length > 0) {
                    this.isAnimated = true; this.mixer = new THREE.AnimationMixer(model);
                    const anims = loadedModels['cat'].animations;
                    const getAnim = (idx) => anims[idx] || anims[0];
                    this.actions['sleep'] = this.mixer.clipAction(getAnim(CAT_CONFIG.anim.sleep));
                    this.actions['happy'] = this.mixer.clipAction(getAnim(CAT_CONFIG.anim.happy));
                    this.actions['idle'] = this.mixer.clipAction(getAnim(CAT_CONFIG.anim.idle));
                    this.actions['eat'] = this.mixer.clipAction(getAnim(CAT_CONFIG.anim.eat));
                    this.actions['urgent'] = this.mixer.clipAction(getAnim(CAT_CONFIG.anim.urgent));
                    this.actions['walk'] = this.mixer.clipAction(getAnim(CAT_CONFIG.anim.walk));
                    this.actions['sleep'].setLoop(THREE.LoopOnce);
                    this.actions['sleep'].clampWhenFinished = true;
                    this.playAction('idle');

                    GameContext.logToScreen(`Cat loaded with ${anims.length} animations.`);
                    if (anims.length < 8) GameContext.logToScreen("Warning: Cat model has fewer than 8 animations!", 'warn');
                }
            } else { this.mesh.add(createBlockCat(color)); }
        } catch (e) { console.error("Cat error:", e); this.mesh.add(createBlockCat(color)); }
        this.mesh.position.set(0, 0, 0); this.chooseNewAction();
    }

    showBubble(icon) { if (!this.bubbleEl || !this.bubbleIcon) return; this.bubbleIcon.innerText = icon; this.bubbleEl.classList.remove('hidden'); }
    hideBubble() { if (!this.bubbleEl) return; this.bubbleEl.classList.add('hidden'); }

    updateBubblePosition() {
        if (!this.bubbleEl || this.bubbleEl.classList.contains('hidden')) return;
        const camera = GameContext.camera;
        const pos = this.mesh.position.clone();
        pos.y += 1.2;
        pos.project(camera);
        const x = (pos.x * .5 + .5) * window.innerWidth;
        const y = (-(pos.y * .5) + .5) * window.innerHeight;
        this.bubbleEl.style.left = `${x}px`;
        this.bubbleEl.style.top = `${y}px`;
    }

    updateUI() {
        const hungerLevel = document.getElementById('level-hunger');
        const toiletLevel = document.getElementById('level-toilet');
        if (hungerLevel) {
            hungerLevel.style.height = this.stats.hunger + '%';
        }
        if (toiletLevel) {
            toiletLevel.style.height = this.stats.toilet + '%';
        }
    }

    playAction(name) {
        if (this.isAnimated && this.actions[name] && this.currentAction !== this.actions[name]) {
            if (this.currentAction) this.currentAction.fadeOut(0.2);
            this.actions[name].reset().fadeIn(0.2).play();
            this.currentAction = this.actions[name];
        }
    }

    update(dt) {
        if (this.isAnimated && this.mixer) this.mixer.update(dt);

        this.decayStats(dt);
        this.updateBubblePosition();
        this.updateUI();

        this.updateVocal(dt);

        // [修复] 更新下车冷却时间
        if (this.dismountCooldown > 0) {
            this.dismountCooldown -= dt;
        }

        if (this.state === 'dragged') {
            return;
        }

        if (this.state === 'sleeping') {
            this.sleepMinDuration -= dt;
            if ((this.stats.hunger < 5 || this.stats.toilet < 5) || this.sleepMinDuration <= 0) {
                this.lastInteractTarget = this.interactTarget;
                this.state = 'idle'; this.sleepMinDuration = 0;
                this.hideBubble();
                this.resetModelOffset();
                this.trySpawnHeart();
                this.chooseNewAction();
            }
            return;
        }

        const floorPlane = GameContext.floorPlane;
        const placedFurniture = GameContext.placedFurniture;

        // [修复] 在 pooping/riding 状态下，不执行地面检测
        if (this.state !== 'jumping' && this.state !== 'pooping' && this.state !== 'riding') {
            const rayOrigin = this.mesh.position.clone(); rayOrigin.y = 5; this.downRay.set(rayOrigin, new THREE.Vector3(0, -1, 0));
            // [修复] 排除 isVehicle (扫地机器人)，防止猫把它当成地板踩上去，导致卡住或浮空
            const hitCandidates = [floorPlane, ...placedFurniture.filter(f => f.userData.parentClass && f.userData.parentClass.dbItem && f.userData.parentClass.dbItem.layer === 1 && !f.userData.parentClass.isBox && !f.userData.parentClass.dbItem.isVehicle)];
            const hits = this.downRay.intersectObjects(hitCandidates, true); let targetY = 0; if (hits.length > 0) targetY = hits[0].point.y;
            this.mesh.position.y += (targetY - this.mesh.position.y) * 0.2;
        }

        if (this.interactTarget && (!placedFurniture.includes(this.interactTarget) || !this.interactTarget.visible)) { this.interrupt(); return; }
        if (this.state === 'angry') { if (Date.now() > this.angryTime) { this.state = 'idle'; this.patience = 5 + Math.floor(Math.random() * 6); this.petCount = 0; GameContext.updateStatusText("猫咪气消了"); } }

        if (this.state === 'walking') { this.handleWalkingLogic(dt); }
        else if (this.state === 'jumping') { this.updateJumping(dt); }
        else if (this.state === 'idle') { this.handleIdleLogic(dt); }
        else if (this.state === 'interacting') { this.handleInteractingLogic(dt); }
        else if (this.state === 'petting') { this.playAction('happy'); }
        else if (this.state === 'begging') {
            this.playAction('happy');
            this.checkIfNeedsSatisfied();
            const camera = GameContext.camera;
            this.mesh.lookAt(camera.position.x, this.mesh.position.y, camera.position.z);
        }
        else if (this.state === 'riding') { this.handleRidingLogic(dt); }
    }

    handleIdleLogic(dt) {
        this.playAction('idle');
        this.timer -= dt;
        if (this.timer <= 0) {
            this.chooseNewAction();
        }
    }

    handleRidingLogic(dt) {
        const vehicle = this.interactTarget ? this.interactTarget.userData.parentClass : null;
        // 如果载具没了，或者既不移动也不旋转（完全停止且不是暂停思考），跳下来
        // 但注意 robot 有 pauseTimer，这时候 isMoving=false 且 isTurning=false。
        // 为了防止秒下车，我们可以宽容一点，或者只检查 timer。
        // 简单处理：只要 vehicle 存在且 timer 没结束就不下车 (除非被销毁)
        if (!vehicle) {
            console.log('[Cat] 载具消失，下车');
            this.state = 'idle';
            this.interactTarget = null;
            this.ridingVehicle = null; // [修复] 清除骑乘载具引用
            this.chooseNewAction();
            return;
        }
        
        // [修复] 绑定 rider 引用，让载具知道谁在骑它
        vehicle.rider = this;

        this.playAction('idle'); // 也可以用 sit
        this.showBubble('🤖');

        // [修复] 保存当前骑乘的载具引用，用于在 update 中跟随位置
        this.ridingVehicle = this.interactTarget;

        // 跟随载具位置
        const vehiclePos = this.interactTarget.position;
        this.mesh.position.copy(vehiclePos);
        this.mesh.position.y = 0.15; // [修正] 降低高度 (扫地机器人很薄)
        
        // [修复] 猫咪应该和扫地机器人同方向旋转
        // 由于猫咪模型和机器人模型的朝向可能相差 180 度，需要加上 Math.PI
        // 这样当机器人顺时针旋转时，猫咪也会顺时针旋转（而不是逆时针）
        this.mesh.rotation.y = this.interactTarget.rotation.y + Math.PI;

        // 随机想下来
        this.ridingTimer -= dt;
        if (this.ridingTimer <= 0) {
            console.log('[Cat] 骑乘时间到，准备下车');
            
            // [修复] 保存下车前的位置，用于计算下车方向
            const dismountBasePos = this.mesh.position.clone();
            const vehicleRotation = this.interactTarget.rotation.y;
            
            console.log(`[Cat] 下车基准位置: (${dismountBasePos.x.toFixed(2)}, ${dismountBasePos.z.toFixed(2)}), 载具朝向: ${(vehicleRotation * 180 / Math.PI).toFixed(1)}度`);
            
            // [修复] 先清除载具的 rider 引用，防止被拉回去
            if (vehicle) {
                vehicle.rider = null;
            }
            
            // [修复] 先清除所有相关引用，再改变状态
            this.ridingVehicle = null;
            this.interactTarget = null;
            this.targetFurniture = null;
            this.nextAction = null; // [修复] 清除 nextAction，防止被误认为还要上车
            this.hideBubble(); // [修复] 清除气泡
            this.state = 'idle';

            // [修复] 智能下车：尝试寻找周围没有家具的空地
            // 优先向载具侧面下车 (左右)，避免被后面的家具卡住
            const tryAngles = [
                vehicleRotation + Math.PI / 2,  // 右侧
                vehicleRotation - Math.PI / 2,  // 左侧
                vehicleRotation + Math.PI,      // 后方
                vehicleRotation                  // 前方
            ];
            const angleNames = ['右侧', '左侧', '后方', '前方'];
            let bestPos = null;

            for (let i = 0; i < tryAngles.length; i++) {
                const ang = tryAngles[i];
                const dir = new THREE.Vector3(Math.sin(ang), 0, Math.cos(ang));
                const testPos = dismountBasePos.clone().add(dir.multiplyScalar(0.8));
                testPos.y = 0;

                console.log(`[Cat] 尝试${angleNames[i]}下车: (${testPos.x.toFixed(2)}, ${testPos.z.toFixed(2)})`);

                // 边界检查
                if (Math.abs(testPos.x) > 4.5 || Math.abs(testPos.z) > 4.5) {
                    console.log(`[Cat] ${angleNames[i]}超出边界`);
                    continue;
                }

                // 检测是否与家具碰撞
                let hasCollision = false;
                let collidedWith = '';
                for (let f of GameContext.placedFurniture) {
                    if (!f.userData.parentClass) continue;
                    const item = f.userData.parentClass.dbItem;
                    if (item.layer !== 1) continue; // 忽略地毯和小物
                    if (item.isVehicle) continue; // 忽略载具本身

                    // [修复] 使用实际模型包围盒 (红色线框) 进行碰撞检测
                    // 但只检查 X-Z 平面，不考虑高度 (猫只需要检查地面空间)
                    const box = new THREE.Box3().setFromObject(f);
                    
                    // 检查 testPos 是否在 box 的 X-Z 投影内
                    // 不使用 containsPoint 因为高度会干扰判断
                    const inXRange = testPos.x >= box.min.x - 0.2 && testPos.x <= box.max.x + 0.2;
                    const inZRange = testPos.z >= box.min.z - 0.2 && testPos.z <= box.max.z + 0.2;
                    
                    if (inXRange && inZRange) {
                        hasCollision = true;
                        collidedWith = item.name;
                        break;
                    }
                }

                if (hasCollision) {
                    console.log(`[Cat] ${angleNames[i]}有障碍物: ${collidedWith}`);
                } else {
                    console.log(`[Cat] ${angleNames[i]}可以下车!`);
                    bestPos = testPos;
                    break;
                }
            }

            if (bestPos) {
                console.log(`[Cat] 下车到: (${bestPos.x.toFixed(2)}, ${bestPos.z.toFixed(2)})`);
                this.mesh.position.copy(bestPos);
            } else {
                // 如果四面楚歌，向载具的右后方跳远一点
                console.log('[Cat] 四面楚歌，尝试跳远一点');
                const escapeAngle = vehicleRotation + Math.PI * 0.75;
                const escapeDir = new THREE.Vector3(Math.sin(escapeAngle), 0, Math.cos(escapeAngle));
                this.mesh.position.copy(dismountBasePos).add(escapeDir.multiplyScalar(1.2));
                // 边界限制
                this.mesh.position.x = Math.max(-4.5, Math.min(4.5, this.mesh.position.x));
                this.mesh.position.z = Math.max(-4.5, Math.min(4.5, this.mesh.position.z));
                console.log(`[Cat] 跳跃下车到: (${this.mesh.position.x.toFixed(2)}, ${this.mesh.position.z.toFixed(2)})`);
            }
            // 强制落地
            this.mesh.position.y = 0;

            // [修复] 设置下车冷却时间，防止立即再次上车
            this.dismountCooldown = 8.0; // 8秒内不会再想骑扫地机器人
            console.log('[Cat] 设置下车冷却时间: 8秒');

            this.chooseNewAction();
        }
    }

    handleWalkingLogic(dt) {
        const placedFurniture = GameContext.placedFurniture;

        this.playAction('walk');
        const dir = new THREE.Vector3().subVectors(this.stopPos, this.mesh.position);
        dir.y = 0;
        const dist = dir.length();

        // [修复] 检查是否已经离目标足够近，可以直接到达
        let closeEnoughToTarget = false;
        if (this.interactTarget || this.targetFurniture) {
            const target = this.targetFurniture || this.interactTarget;
            const distToTarget = new THREE.Vector3().subVectors(target.position, this.mesh.position);
            distToTarget.y = 0;
            // 如果离目标已经很近 (< 1.2)，就不再避障，直接走过去
            if (distToTarget.length() < 1.2) {
                closeEnoughToTarget = true;
            }
        }

        if (dist > 0.5 && !closeEnoughToTarget) {
            const forwardDir = dir.clone().normalize();
            this.forwardRay.set(this.mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0)), forwardDir);

            const obstacleMeshes = placedFurniture.filter(f => {
                const isInteractTarget = (this.interactTarget && f === this.interactTarget);
                const isFoodTarget = (this.targetFurniture && f === this.targetFurniture);
                const isDecor = (f.userData.parentClass && f.userData.parentClass.dbItem.layer === 0);
                // [修复] 忽略载具 (扫地机器人)，猫可以穿过它们
                const isVehicle = (f.userData.parentClass && f.userData.parentClass.dbItem.isVehicle);
                return !isInteractTarget && !isFoodTarget && !isDecor && !isVehicle;
            });

            const cols = this.forwardRay.intersectObjects(obstacleMeshes, true);
            if (cols.length > 0 && cols[0].distance < 0.4) {
                this.tryAvoidObstacle(forwardDir, obstacleMeshes);
                return;
            }
        }

        if (dist < 0.1) {
            if (this.isAvoiding && this.originalTargetPos) {
                this.isAvoiding = false;
                const vec = new THREE.Vector3().subVectors(this.mesh.position, this.originalTargetPos);
                vec.y = 0;
                vec.normalize();
                this.stopPos.copy(this.originalTargetPos).add(vec.multiplyScalar(this.targetStopDist || 0.7));
                return;
            }

            if (this.targetFurniture) {
                const distToRealTarget = new THREE.Vector3().subVectors(this.targetFurniture.position, this.mesh.position);
                distToRealTarget.y = 0;
                if (distToRealTarget.length() > 1.5) {
                    this.mesh.position.x = this.stopPos.x;
                    this.mesh.position.z = this.stopPos.z;
                }
            }
            this.onArriveDest();
        } else {
            dir.normalize();
            this.mesh.position.add(dir.multiplyScalar(2.0 * dt));
            this.mesh.lookAt(this.stopPos.x, this.mesh.position.y, this.stopPos.z);
        }
    }

    avoidCounter = 0;
    avoidDirection = 1;
    originalTargetPos = null;
    targetStopDist = 0.7;
    isAvoiding = false;
    stuckCounter = 0; // [新增] 卡住计数器

    tryAvoidObstacle(blockedDir, obstacleMeshes) {
        this.avoidCounter++;
        
        // [修复] 如果避障次数过多，说明卡住了，放弃当前目标
        if (this.avoidCounter > 8) {
            console.log('[Cat] 避障失败次数过多，放弃当前目标');
            this.avoidCounter = 0;
            this.isAvoiding = false;
            this.stuckCounter++;
            
            // [修复] 如果连续多次卡住，随机传送到一个安全位置
            if (this.stuckCounter > 3) {
                console.log('[Cat] 严重卡住，随机传送');
                this.stuckCounter = 0;
                // 传送到房间中心附近的随机位置
                this.mesh.position.x = (Math.random() - 0.5) * 4;
                this.mesh.position.z = (Math.random() - 0.5) * 4;
                this.mesh.position.y = 0;
            }
            
            this.chooseNewAction();
            return;
        }

        this.isAvoiding = true;

        // [修复] 增加更多角度选择，提高找到出路的几率
        const angles = [
            Math.PI / 6, -Math.PI / 6,        // 30度
            Math.PI / 4, -Math.PI / 4,        // 45度
            Math.PI / 3, -Math.PI / 3,        // 60度
            Math.PI / 2, -Math.PI / 2,        // 90度
            Math.PI * 2 / 3, -Math.PI * 2 / 3, // 120度
            Math.PI * 3 / 4, -Math.PI * 3 / 4, // 135度
            Math.PI                            // 180度 (掉头)
        ];
        
        const testRay = new THREE.Raycaster();
        const catPos = this.mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0));

        for (let angle of angles) {
            const rotatedDir = blockedDir.clone();
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const newX = rotatedDir.x * cos - rotatedDir.z * sin;
            const newZ = rotatedDir.x * sin + rotatedDir.z * cos;
            rotatedDir.x = newX;
            rotatedDir.z = newZ;
            rotatedDir.normalize();

            testRay.set(catPos, rotatedDir);
            const hits = testRay.intersectObjects(obstacleMeshes, true);

            // [修复] 检查边界
            const testPos = this.mesh.position.clone().add(rotatedDir.clone().multiplyScalar(0.8));
            if (Math.abs(testPos.x) > 4.5 || Math.abs(testPos.z) > 4.5) {
                continue; // 会撞墙，跳过
            }

            if (hits.length === 0 || hits[0].distance > 0.8) {
                const avoidPoint = this.mesh.position.clone().add(rotatedDir.multiplyScalar(0.8));
                avoidPoint.y = 0;
                this.stopPos.copy(avoidPoint);
                // [修复] 重置卡住计数器
                this.stuckCounter = 0;
                return;
            }
        }

        // [修复] 如果所有方向都被堵住，尝试后退
        console.log('[Cat] 所有方向被堵，尝试后退');
        const backDir = blockedDir.clone().negate();
        const backPos = this.mesh.position.clone().add(backDir.multiplyScalar(0.5));
        backPos.y = 0;
        
        // 边界检查
        if (Math.abs(backPos.x) < 4.5 && Math.abs(backPos.z) < 4.5) {
            this.stopPos.copy(backPos);
            return;
        }

        this.state = 'idle';
        this.timer = 0.5;
        this.isAvoiding = false;
    }

    resetModelOffset() {
        if (this.mesh.children.length > 0) {
            this.mesh.children[0].position.x = 0;
            this.mesh.children[0].position.y = CAT_CONFIG.yOffset || 0;
            this.mesh.children[0].position.z = 0;
        }
    }

    handleInteractingLogic(dt) {
        const isInsideBox = this.interactTarget && this.interactTarget.userData.parentClass && this.interactTarget.userData.parentClass.isBox && !this.interactTarget.userData.parentClass.isTipped;
        if (isInsideBox) { this.playAction('sleep'); } else { this.playAction('idle'); }

        this.timer -= dt;

        if (this.timer <= 0) {
            this.lastInteractTarget = this.interactTarget;
            this.trySpawnHeart();
            if (isInsideBox) { this.mesh.position.copy(this.jumpStart); this.mesh.position.y = 0; }
            this.leaveInteraction();
        }
    }

    startJump() { this.state = 'jumping'; this.playAction('idle'); this.jumpTimer = 0; this.jumpDuration = 0.6; this.jumpStart.copy(this.mesh.position); this.jumpEnd.copy(this.interactTarget.position); let h = this.interactTarget.userData.parentClass.boxHeight || 0.5; this.jumpEnd.y = h * 0.5; if (this.jumpEnd.y < 0.2) this.jumpEnd.y = 0.2; }

    updateJumping(dt) {
        this.jumpTimer += dt; let t = this.jumpTimer / this.jumpDuration; if (t > 1) t = 1;
        this.mesh.position.x = THREE.MathUtils.lerp(this.jumpStart.x, this.jumpEnd.x, t); this.mesh.position.z = THREE.MathUtils.lerp(this.jumpStart.z, this.jumpEnd.z, t);
        const height = this.jumpEnd.y + 0.5; const yBase = THREE.MathUtils.lerp(this.jumpStart.y, this.jumpEnd.y, t); const yArc = Math.sin(t * Math.PI) * height; this.mesh.position.y = yBase + yArc; this.mesh.lookAt(this.jumpEnd.x, this.mesh.position.y, this.jumpEnd.z);
        if (t >= 1) { this.mesh.rotation.x = 0; this.mesh.rotation.z = 0; this.enterInteraction(); }
    }

    trySpawnHeart() {
        if (this.stats.hunger <= 0 || this.stats.toilet <= 0) {
            GameContext.showEmote(this.mesh.position, '🚫');
            return;
        }
        GameContext.spawnHeart(this.mesh.position);
    }

    setDragged(isDragged) {
        if (isDragged) {
            this.state = 'dragged';
            this.interactTarget = null;
            this.targetFurniture = null;
            this.hideBubble();
            this.resetModelOffset();
            this.playAction('urgent');
        } else {
            this.state = 'idle';
            this.playAction('idle');
            this.timer = 1.0;
        }
    }

    reactToSound(targetPos) {
        if (this.state === 'eating' ||
            this.state === 'pooping' ||
            this.state === 'dragged') return;

        if (this.nextAction === 'INSPECT_TOY') return;

        const dist = this.mesh.position.distanceTo(targetPos);
        if (dist < 1.0) {
            this.mesh.lookAt(targetPos.x, this.mesh.position.y, targetPos.z);
            return;
        }

        // [修复] 如果猫咪正在骑乘载具，需要先正确下车
        if (this.state === 'riding') {
            // 清除载具的 rider 引用，防止被拉回去
            if (this.interactTarget && this.interactTarget.userData.parentClass) {
                this.interactTarget.userData.parentClass.rider = null;
            }
            this.ridingVehicle = null;
            // 强制落地
            this.mesh.position.y = 0;
            // 设置下车冷却时间
            this.dismountCooldown = 5.0;
            console.log('[Cat] 被玩具声音吸引，从载具上下来');
        }

        if (this.state === 'sleeping') {
            this.resetModelOffset();
            this.sleepMinDuration = 0;
            this.hideBubble();
            GameContext.showEmote(this.mesh.position, '🙀');
        } else {
            GameContext.showEmote(this.mesh.position, '❗');
        }

        // [修复] 确保清除气泡
        this.hideBubble();

        this.interactTarget = null;
        this.targetFurniture = null;

        this.setPath(targetPos, 0.6);
        this.state = 'walking';
        this.nextAction = 'INSPECT_TOY';
    }

    pet() {
        const audioManager = GameContext.audioManager;
        const diaryManager = GameContext.diaryManager;

        if (this.state === 'dragged') return;

        if (this.state === 'angry') {
            audioManager.playSfx('meow_angry');
            GameContext.showEmote(this.mesh.position, '💢');
            return;
        }

        if (this.stats.hunger < 30) {
            GameContext.showEmote(this.mesh.position, '🐟');
            diaryManager.logEvent('pet_angry');
            return;
        }
        if (this.stats.toilet < 30) {
            GameContext.showEmote(this.mesh.position, '💩');
            diaryManager.logEvent('pet_angry');
            return;
        }

        this.hideBubble();
        this.resetModelOffset();

        if (this.petCount >= this.patience) {
            GameContext.showEmote(this.mesh.position, '💢');
            this.state = 'angry';
            this.angryTime = Date.now() + 15 * 60 * 1000;
            this.chooseNewAction();
            GameContext.updateStatusText("猫咪生气了 (15m CD)");
            diaryManager.logEvent('pet_angry', {}, 100);
        }
        else {
            this.petCount++;
            this.trySpawnHeart();
            GameContext.showEmote(this.mesh.position, '😻');
            this.state = 'petting';
            audioManager.playSfx('meow_purr');

            diaryManager.logEvent('pet_happy', {}, 20);

            if (this.resetTimer) clearTimeout(this.resetTimer);
            this.resetTimer = setTimeout(() => {
                if (this.state === 'petting') this.state = 'idle';
            }, 2000);
        }
    }

    resetCooldown() {
        this.angryTime = 0; this.state = 'idle'; this.petCount = 0; this.patience = 10;
        GameContext.showEmote(this.mesh.position, '❤️');
    }

    interrupt() {
        GameContext.showEmote(this.mesh.position, '❓');
        this.state = 'idle';
        this.interactTarget = null;
        this.timer = 1;
        this.hideBubble();
        this.resetModelOffset();
    }

    leaveInteraction() {
        this.state = 'idle';
        this.interactTarget = null;
        this.timer = 1;
        this.hideBubble();
    }

    chooseNewAction() {
        const visualHour = GameContext.visualHour;
        const placedFurniture = GameContext.placedFurniture;
        const isDay = (visualHour >= 6 && visualHour < 18);

        this.hideBubble();

        if (this.stats.hunger < 40) {
            const foodBowl = this.findAvailableFurniture('food', 'full');
            if (foodBowl) {
                this.interactTarget = foodBowl;
                this.targetFurniture = foodBowl;
                this.setPath(foodBowl.position, 0.5);
                this.state = 'walking';
                this.nextAction = 'EAT';
                return;
            } else {
                this.showBubble('🐟');
            }
        }

        if (this.stats.toilet < 40) {
            const litterBox = this.findAvailableFurniture('toilet', 'clean');
            if (litterBox) {
                this.interactTarget = litterBox;
                this.targetFurniture = litterBox;
                this.setPath(litterBox.position, 0.6);
                this.state = 'walking';
                this.nextAction = 'POOP';
                return;
            } else {
                this.showBubble('💩');
            }
        }

        const filterLast = (arr) => arr.filter(item => item !== this.lastInteractTarget);

        const boxes = placedFurniture.filter(f => f.userData.parentClass && f.userData.parentClass.isBox);
        const sleepers = placedFurniture.filter(f => f.userData.parentClass && f.userData.parentClass.dbItem.canSleep);
        const others = placedFurniture.filter(f => f.userData.parentClass && !f.userData.parentClass.isBox && !f.userData.parentClass.dbItem.canSleep && f.userData.parentClass.dbItem.layer === 1);
        const vehicles = placedFurniture.filter(f => f.userData.parentClass && f.userData.parentClass.isVehicle && f.userData.parentClass.isMoving);

        let rnd = Math.random();
        let target = null;

        // 优先检查有没有正在跑的扫地机器人 (30% 概率感兴趣)
        // [修复] 如果刚下车（冷却时间内），不会再想骑上去
        if (vehicles.length > 0 && rnd < 0.3 && this.dismountCooldown <= 0) {
            target = vehicles[Math.floor(Math.random() * vehicles.length)];
            this.interactTarget = target;
            this.targetFurniture = target; // 关键：设为 targetFurniture 才能触发 onArriveDest 中的 parent 检查
            this.setPath(target.position, 0.5);
            this.state = 'walking';
            this.nextAction = 'RIDE';
            return;
        }

        const availBoxes = filterLast(boxes);
        if (availBoxes.length > 0 && rnd < 0.6) {
            target = availBoxes[Math.floor(Math.random() * availBoxes.length)];
        }
        else {
            let sleepRnd = Math.random();
            let wantSleep = isDay ? (sleepRnd < 0.7) : (sleepRnd < 0.3);

            const availSleepers = filterLast(sleepers);
            if (wantSleep && availSleepers.length > 0) {
                target = availSleepers[Math.floor(Math.random() * availSleepers.length)];
            }
            else {
                const availOthers = filterLast(others);
                if (availOthers.length > 0 && Math.random() < 0.5) {
                    target = availOthers[Math.floor(Math.random() * availOthers.length)];
                } else {
                    target = null;
                }
            }
        }

        if (target) {
            this.interactTarget = target;
            const dist = (target.userData.parentClass.dbItem.canSleep) ? 0.5 : 0.7;
            this.setPath(target.position, dist);
            this.state = 'walking';
        }
        else {
            this.lastInteractTarget = null;
            this.interactTarget = null;
            const randPos = generateWanderTarget(this.mesh.position, 1, 4);
            this.setPath(randPos);
            this.state = 'walking';
        }
    }

    enterInteraction() {
        if (this.interactTarget && this.interactTarget.userData.parentClass && this.interactTarget.userData.parentClass.dbItem.canSleep) {
            this.state = 'sleeping';
            this.sleepMinDuration = 10.0 + Math.random() * 10.0;
            this.playAction('sleep');
            this.showBubble('💤');

            this.mesh.position.copy(this.interactTarget.position);

            const furnRotation = this.interactTarget.rotation.y;
            this.mesh.rotation.y = furnRotation;

            const localOffset = new THREE.Vector3(0, 0, 0.25);
            const randomX = (Math.random() - 0.5) * 0.4;
            localOffset.x += randomX;

            localOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), furnRotation);
            this.mesh.position.add(localOffset);

            const itemSize = this.interactTarget.userData.parentClass.dbItem.size;
            if (itemSize) {
                this.mesh.position.y += (itemSize.y * 0.5) + 0.3;
            }

            if (this.mesh.children.length > 0) {
                this.mesh.children[0].position.set(0.2, CAT_CONFIG.yOffset || 0, 0);
            }
            return;
        }

        this.state = 'interacting';
        this.timer = 5 + Math.random() * 5;
        if (this.interactTarget && this.interactTarget.userData.parentClass && this.interactTarget.userData.parentClass.isBox) {
            this.timer = 8;
            GameContext.showEmote(this.mesh.position, '📦');
        }
        if (this.interactTarget) {
            const isInsideBox = this.interactTarget.userData.parentClass && this.interactTarget.userData.parentClass.isBox && !this.interactTarget.userData.parentClass.isTipped;
            if (!isInsideBox) { this.mesh.rotation.y = Math.random() * Math.PI * 2; }
        }
    }

    setPath(targetPosition, stopDist = 0.7) {
        this.targetPos.copy(targetPosition);

        this.avoidCounter = 0;
        this.originalTargetPos = targetPosition.clone();

        const vec = new THREE.Vector3().subVectors(this.mesh.position, targetPosition);
        vec.y = 0;
        vec.normalize();

        let isFood = false;
        if (this.targetFurniture && this.targetFurniture.userData.parentClass && this.targetFurniture.userData.parentClass.dbItem.subType === 'food') {
            isFood = true;
        }

        if (isFood) {
            stopDist = 0.5;
        }

        this.stopPos.copy(targetPosition).add(vec.multiplyScalar(stopDist));
        this.targetStopDist = stopDist;
    }

    decayStats(dt) {
        this.stats.hunger -= 0.6 * dt;
        this.stats.toilet -= 0.3 * dt;

        if (this.stats.hunger < 0) this.stats.hunger = 0;
        if (this.stats.toilet < 0) this.stats.toilet = 0;
    }

    findAvailableFurniture(subType, requiredState) {
        const placedFurniture = GameContext.placedFurniture;
        return placedFurniture.find(f => f.userData.parentClass && f.userData.parentClass.dbItem.subType === subType && f.userData.parentClass.functionalState === requiredState);
    }

    checkIfNeedsSatisfied() {
        this.playAction('idle');
        if (this.stats.hunger < 30) {
            const food = this.findAvailableFurniture('food', 'full');
            if (food || this.stats.hunger > 90) { this.state = 'idle'; this.hideBubble(); }
        }
        if (this.stats.toilet < 40) {
            const box = this.findAvailableFurniture('toilet', 'clean');
            if (box || this.stats.toilet > 90) { this.state = 'idle'; this.hideBubble(); }
        }
    }

    onArriveDest() {
        const audioManager = GameContext.audioManager;

        this.avoidCounter = 0;

        if (!this.targetFurniture) {
            this.enterInteraction();
            this.nextAction = null;
            this.targetFurniture = null;
            return;
        }

        const parent = this.targetFurniture.userData.parentClass;
        if (parent && parent.isBox && !parent.isTipped) { this.startJump(); return; }

        // [新增] 登上载具逻辑
        if (this.nextAction === 'RIDE') {
            if (parent && parent.isVehicle && parent.isMoving) {
                this.state = 'riding';
                this.ridingTimer = 10 + Math.random() * 10; // 骑 10-20 秒
                GameContext.showEmote(this.mesh.position, '🤠');
            } else {
                // 如果跑到跟前停了，就发呆
                this.state = 'idle';
                this.timer = 2;
                GameContext.showEmote(this.mesh.position, '❓');
            }
            this.nextAction = null;
            return;
        }

        if (this.nextAction === 'INSPECT_TOY') {
            this.state = 'idle';
            this.nextAction = null;
            this.playAction('happy');
            GameContext.showEmote(this.mesh.position, '🥕');
            this.timer = 3.0;
            return;
        }

        if (this.nextAction === 'EAT') {
            if (this.targetFurniture) {
                const distToBowl = this.mesh.position.distanceTo(this.targetFurniture.position);
                if (distToBowl > 1.5) {
                    this.setPath(this.targetFurniture.position, 0.5);
                    this.state = 'walking';
                    return;
                }
            }

            this.state = 'eating';

            if (this.targetFurniture) {
                const bowlPos = this.targetFurniture.position.clone();
                const catPos = this.mesh.position.clone();

                const direction = new THREE.Vector3().subVectors(catPos, bowlPos).normalize();
                direction.y = 0;

                const idealPos = bowlPos.clone().add(direction.multiplyScalar(0.6));

                this.mesh.position.set(idealPos.x, 0, idealPos.z);
                this.mesh.lookAt(bowlPos.x, 0, bowlPos.z);
            }

            this.playAction('eat');

            setTimeout(() => {
                if (this.state !== 'eating') return;
                this.stats.hunger = 100;
                if (this.targetFurniture && this.targetFurniture.userData.parentClass) this.targetFurniture.userData.parentClass.useByCat();
                this.state = 'idle'; this.timer = 2; this.trySpawnHeart();
                this.targetFurniture = null;
                this.hideBubble();
            }, 5000);
        }
        else if (this.nextAction === 'POOP') {
            if (this.targetFurniture) {
                const distToBox = this.mesh.position.distanceTo(this.targetFurniture.position);
                if (distToBox > 1.5) {
                    this.setPath(this.targetFurniture.position, 0.6);
                    this.state = 'walking';
                    return;
                }
            }

            this.state = 'pooping';

            const litterBoxHeight = 0.25; // 猫砂盆高度，可根据模型调整

            this.mesh.position.copy(this.targetFurniture.position);
            this.mesh.position.y = litterBoxHeight;

            this.playAction('urgent');
            this.mesh.rotation.y = Math.random() * Math.PI * 2;

            setTimeout(() => {
                if (this.state !== 'pooping') return;

                this.stats.toilet = 100;
                if (this.targetFurniture && this.targetFurniture.userData.parentClass) this.targetFurniture.userData.parentClass.useByCat();

                this.mesh.position.copy(this.stopPos);
                this.mesh.position.y = 0;

                this.state = 'idle'; this.timer = 2; this.trySpawnHeart();
                this.targetFurniture = null;
                this.hideBubble();
            }, 4000);
        }
    }

    meowTimer = 0;

    updateVocal(dt) {
        const audioManager = GameContext.audioManager;

        if (this.stats.hunger < 20 || this.stats.toilet < 20) {
            this.meowTimer += dt;
            if (this.meowTimer > 5.0) {
                audioManager.playSfx('meow_urgent');
                if (this.stats.hunger < 20) {
                    GameContext.showEmote(this.mesh.position, '🐟');
                } else {
                    GameContext.showEmote(this.mesh.position, '💩');
                }
                this.meowTimer = 0;
            }
            return;
        }

        if (this.state !== 'sleeping') {
            if (Math.random() < 0.0005) {
                audioManager.playSfx('meow_normal');
            }
        }
    }
}
