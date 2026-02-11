/**
 * 猫咪类 - 猫咪行为AI和状态管理
 * @module systems/Cat
 */
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CAT_CONFIG } from '../core/Constants.js';
import gameState from '../core/GameState.js';
import { audioManager } from '../managers/AudioManager.js';
import { diaryManager } from '../managers/DiaryManager.js';

export class Cat {
    constructor(scene, color = 0xffa500) {
        this.scene = scene;
        this.state = 'idle';
        this.stats = { hunger: 80, toilet: 80 };

        // 目标和路径
        this.targetFurniture = null;
        this.interactTarget = null;
        this.lastInteractTarget = null;
        this.nextAction = null;
        this.targetPos = new THREE.Vector3();
        this.stopPos = new THREE.Vector3();
        this.jumpStart = new THREE.Vector3();
        this.jumpEnd = new THREE.Vector3();

        // 动画
        this.mixer = null;
        this.actions = {};
        this.isAnimated = false;
        this.currentAction = null;

        // 状态计时
        this.timer = 0;
        this.petCount = 0;
        this.patience = 5 + Math.floor(Math.random() * 6);
        this.angryTime = 0;
        this.sleepMinDuration = 0;

        // UI元素
        this.bubbleEl = document.getElementById('cat-bubble');
        this.bubbleIcon = document.getElementById('bubble-icon');

        // Mesh和射线
        this.mesh = new THREE.Group();
        this.scene.add(this.mesh);
        this.downRay = new THREE.Raycaster();
        this.downRay.ray.direction.set(0, -1, 0);
        this.forwardRay = new THREE.Raycaster();

        this.initModel(color);
    }

    initModel(color) {
        try {
            if (gameState.loadedModels['cat']) {
                const model = SkeletonUtils.clone(gameState.loadedModels['cat'].scene);
                model.scale.set(CAT_CONFIG.scale, CAT_CONFIG.scale, CAT_CONFIG.scale);
                model.position.y = CAT_CONFIG.yOffset;
                model.rotation.x = CAT_CONFIG.rotateX;
                model.rotation.y = CAT_CONFIG.rotateY;
                this.mesh.add(model);

                const anims = gameState.loadedModels['cat'].animations;
                if (anims && anims.length > 0) {
                    this.isAnimated = true;
                    this.mixer = new THREE.AnimationMixer(model);

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
                }
            } else {
                this.mesh.add(this.createBlockCat(color));
            }
        } catch (e) {
            console.error("Cat init error:", e);
            this.mesh.add(this.createBlockCat(color));
        }

        this.mesh.position.set(0, 0, 0);
        this.chooseNewAction();
    }

    createBlockCat(color) {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: color });

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.6), mat);
        body.position.y = 0.15;
        group.add(body);

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.3), mat);
        head.position.set(0, 0.4, 0.4);
        group.add(head);

        return group;
    }

    // ========== 动画控制 ==========

    playAction(name, fadeTime = 0.3) {
        if (!this.isAnimated || !this.actions[name]) return;

        if (this.currentAction === name) return;

        const newAction = this.actions[name];

        if (this.currentAction && this.actions[this.currentAction]) {
            this.actions[this.currentAction].fadeOut(fadeTime);
        }

        newAction.reset().fadeIn(fadeTime).play();
        this.currentAction = name;
    }

    // ========== UI ==========

    showBubble(icon) {
        if (!this.bubbleEl || !this.bubbleIcon) return;
        this.bubbleIcon.innerText = icon;
        this.bubbleEl.classList.remove('hidden');
    }

    hideBubble() {
        if (!this.bubbleEl) return;
        this.bubbleEl.classList.add('hidden');
    }

    updateBubblePosition() {
        if (!this.bubbleEl || this.bubbleEl.classList.contains('hidden')) return;

        const pos = this.mesh.position.clone();
        pos.y += 1.2;
        pos.project(gameState.camera);

        const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-(pos.y * 0.5) + 0.5) * window.innerHeight;

        this.bubbleEl.style.left = `${x}px`;
        this.bubbleEl.style.top = `${y}px`;
    }

    updateUI() {
        const hungerLevel = document.getElementById('level-hunger');
        const toiletLevel = document.getElementById('level-toilet');

        if (hungerLevel) {
            hungerLevel.style.height = `${this.stats.hunger}%`;
        }
        if (toiletLevel) {
            toiletLevel.style.height = `${100 - this.stats.toilet}%`;
        }
    }

    // ========== 移动 ==========

    setPath(targetPos, stopDist = 0.5) {
        this.targetPos.copy(targetPos);
        this.stopPos.copy(targetPos);

        const dir = new THREE.Vector3().subVectors(this.targetPos, this.mesh.position).normalize();
        this.stopPos.sub(dir.multiplyScalar(stopDist));

        this.playAction('walk');
    }

    moveTowards(dt) {
        const direction = new THREE.Vector3().subVectors(this.stopPos, this.mesh.position);
        const distance = direction.length();

        if (distance < 0.1) {
            return true; // 到达
        }

        direction.normalize();
        const speed = 1.5;
        this.mesh.position.add(direction.multiplyScalar(speed * dt));

        // 朝向目标
        const angle = Math.atan2(direction.x, direction.z);
        this.mesh.rotation.y = angle;

        return false;
    }

    // ========== AI行为 ==========

    chooseNewAction() {
        this.hideBubble();

        const hour = new Date().getHours();
        const isDay = hour >= 6 && hour < 22;

        // 饥饿检查
        if (this.stats.hunger < 40) {
            const foodBowl = this.findAvailableFurniture('food', 'full');
            if (foodBowl) {
                this.interactTarget = foodBowl;
                this.setPath(foodBowl.position, 0.5);
                this.state = 'walking';
                this.nextAction = 'EAT';
                return;
            } else {
                this.showBubble('🐟');
            }
        }

        // 如厕检查
        if (this.stats.toilet < 40) {
            const litterBox = this.findAvailableFurniture('toilet', 'clean');
            if (litterBox) {
                this.interactTarget = litterBox;
                this.setPath(litterBox.position, 0.6);
                this.state = 'walking';
                this.nextAction = 'POOP';
                return;
            } else {
                this.showBubble('💩');
            }
        }

        // 随机行为
        const boxes = gameState.placedFurniture.filter(f =>
            f.userData.parentClass && f.userData.parentClass.isBox
        );
        const sleepers = gameState.placedFurniture.filter(f =>
            f.userData.parentClass && f.userData.parentClass.dbItem.canSleep
        );

        let target = null;
        const rnd = Math.random();

        if (boxes.length > 0 && rnd < 0.4) {
            target = boxes[Math.floor(Math.random() * boxes.length)];
        } else if (sleepers.length > 0 && Math.random() < (isDay ? 0.3 : 0.6)) {
            target = sleepers[Math.floor(Math.random() * sleepers.length)];
        }

        if (target) {
            this.interactTarget = target;
            this.setPath(target.position, 0.5);
            this.state = 'walking';
        } else {
            // 随机漫步
            const randPos = new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                0,
                (Math.random() - 0.5) * 8
            );
            this.setPath(randPos);
            this.state = 'walking';
        }
    }

    findAvailableFurniture(subType, funcState) {
        for (const f of gameState.placedFurniture) {
            const pc = f.userData.parentClass;
            if (pc && pc.dbItem.subType === subType && pc.functionalState === funcState) {
                return f;
            }
        }
        return null;
    }

    enterInteraction() {
        const target = this.interactTarget;
        if (!target || !target.userData.parentClass) {
            this.state = 'idle';
            this.playAction('idle');
            this.timer = 2 + Math.random() * 3;
            return;
        }

        const item = target.userData.parentClass;

        if (item.dbItem.canSleep) {
            this.state = 'sleeping';
            this.sleepMinDuration = 10.0 + Math.random() * 10.0;
            this.playAction('sleep');
            this.showBubble('💤');
            diaryManager.logEvent('sleep', {}, 30);
        } else if (item.isBox) {
            this.state = 'playing';
            this.timer = 5 + Math.random() * 5;
            this.playAction('happy');
            this.showBubble('📦');
            diaryManager.logEvent('box', {}, 50);
        } else {
            this.state = 'idle';
            this.playAction('idle');
            this.timer = 2 + Math.random() * 3;
        }

        this.lastInteractTarget = target;
    }

    // ========== 交互 ==========

    pet() {
        if (this.state === 'angry') return;

        this.petCount++;

        if (this.petCount > this.patience) {
            this.state = 'angry';
            this.angryTime = 3.0;
            this.playAction('urgent');
            this.showBubble('💢');
            audioManager.playSfx('meow_angry');
            diaryManager.logEvent('angry', {}, 60);
        } else {
            this.playAction('happy');
            this.showBubble('❤️');
            audioManager.playSfx('meow_happy');
            gameState.updateMoney(1);
            diaryManager.logEvent('pet', {}, 40);

            setTimeout(() => {
                this.hideBubble();
                if (this.state !== 'angry') {
                    this.playAction('idle');
                }
            }, 1500);
        }
    }

    // ========== 更新循环 ==========

    update(dt) {
        if (this.mixer) {
            this.mixer.update(dt);
        }

        this.updateBubblePosition();

        // 饥饿：100→40 约需 4.8小时 (一天吃5顿)
        this.stats.hunger -= dt * 0.00347;
        // 如厕：100→40 约需 12小时 (一天拉2次)
        this.stats.toilet -= dt * 0.00139;
        this.stats.hunger = Math.max(0, this.stats.hunger);
        this.stats.toilet = Math.max(0, this.stats.toilet);
        this.updateUI();

        // 状态机
        switch (this.state) {
            case 'idle':
                this.timer -= dt;
                if (this.timer <= 0) {
                    this.chooseNewAction();
                }
                break;

            case 'walking':
                if (this.moveTowards(dt)) {
                    if (this.nextAction === 'EAT') {
                        this.state = 'eating';
                        this.timer = 3;
                        this.playAction('eat');
                    } else if (this.nextAction === 'POOP') {
                        this.state = 'pooping';
                        this.timer = 4;
                        this.playAction('urgent');
                    } else {
                        this.enterInteraction();
                    }
                    this.nextAction = null;
                }
                break;

            case 'eating':
                this.timer -= dt;
                if (this.timer <= 0) {
                    this.stats.hunger = Math.min(100, this.stats.hunger + 50);
                    if (this.interactTarget && this.interactTarget.userData.parentClass) {
                        this.interactTarget.userData.parentClass.useByCat();
                    }
                    diaryManager.logEvent('feed', {}, 40);
                    this.state = 'idle';
                    this.timer = 2;
                    this.playAction('idle');
                }
                break;

            case 'pooping':
                this.timer -= dt;
                if (this.timer <= 0) {
                    this.stats.toilet = Math.min(100, this.stats.toilet + 60);
                    if (this.interactTarget && this.interactTarget.userData.parentClass) {
                        this.interactTarget.userData.parentClass.useByCat();
                    }
                    this.state = 'idle';
                    this.timer = 2;
                    this.playAction('idle');
                }
                break;

            case 'sleeping':
                this.sleepMinDuration -= dt;
                if (this.sleepMinDuration <= 0 && Math.random() < 0.01) {
                    this.hideBubble();
                    this.state = 'idle';
                    this.timer = 1;
                    this.playAction('idle');
                }
                break;

            case 'playing':
                this.timer -= dt;
                if (this.timer <= 0) {
                    this.hideBubble();
                    this.state = 'idle';
                    this.timer = 2 + Math.random() * 3;
                    this.playAction('idle');
                }
                break;

            case 'angry':
                this.angryTime -= dt;
                if (this.angryTime <= 0) {
                    this.hideBubble();
                    this.state = 'idle';
                    this.petCount = 0;
                    this.patience = 5 + Math.floor(Math.random() * 6);
                    this.playAction('idle');
                }
                break;
        }
    }
}

export default Cat;
