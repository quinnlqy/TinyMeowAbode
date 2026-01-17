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

        this.mesh = new THREE.Group(); this.scene.add(this.mesh); 
        this.downRay = new THREE.Raycaster(); this.downRay.ray.direction.set(0,-1,0); 
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
                    this.actions['idle']  = this.mixer.clipAction(getAnim(CAT_CONFIG.anim.idle));
                    this.actions['eat']   = this.mixer.clipAction(getAnim(CAT_CONFIG.anim.eat));
                    this.actions['urgent']= this.mixer.clipAction(getAnim(CAT_CONFIG.anim.urgent));
                    this.actions['walk']  = this.mixer.clipAction(getAnim(CAT_CONFIG.anim.walk));
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
        if(hungerLevel) {
            hungerLevel.style.height = this.stats.hunger + '%';
        }
        if(toiletLevel) {
            toiletLevel.style.height = this.stats.toilet + '%';
        }
    }
    
    playAction(name) { 
        if(this.isAnimated && this.actions[name] && this.currentAction !== this.actions[name]) { 
            if(this.currentAction) this.currentAction.fadeOut(0.2); 
            this.actions[name].reset().fadeIn(0.2).play(); 
            this.currentAction = this.actions[name]; 
        } 
    }

    update(dt) {
        if(this.isAnimated && this.mixer) this.mixer.update(dt);

        this.decayStats(dt); 
        this.updateBubblePosition();
        this.updateUI();

        this.updateVocal(dt);

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
        
        if (this.state !== 'jumping') {
            const rayOrigin = this.mesh.position.clone(); rayOrigin.y = 5; this.downRay.set(rayOrigin, new THREE.Vector3(0,-1,0));
            const hitCandidates = [floorPlane, ...placedFurniture.filter(f => f.userData.parentClass && f.userData.parentClass.dbItem && f.userData.parentClass.dbItem.layer === 1 && !f.userData.parentClass.isBox)];
            const hits = this.downRay.intersectObjects(hitCandidates, true); let targetY = 0; if(hits.length > 0) targetY = hits[0].point.y;
            this.mesh.position.y += (targetY - this.mesh.position.y) * 0.2;
        }
        
        if(this.interactTarget && (!placedFurniture.includes(this.interactTarget) || !this.interactTarget.visible)) { this.interrupt(); return; }
        if (this.state === 'angry') { if (Date.now() > this.angryTime) { this.state = 'idle'; this.patience = 5 + Math.floor(Math.random() * 6); this.petCount = 0; GameContext.updateStatusText("猫咪气消了"); } }
        
        if(this.state === 'walking') { this.handleWalkingLogic(dt); } 
        else if (this.state === 'jumping') { this.updateJumping(dt); } 
        else if(this.state === 'idle') { this.handleIdleLogic(dt); } 
        else if(this.state === 'interacting') { this.handleInteractingLogic(dt); } 
        else if(this.state === 'petting') { this.playAction('happy'); } 
        else if (this.state === 'begging') { 
            this.playAction('happy'); 
            this.checkIfNeedsSatisfied(); 
            const camera = GameContext.camera;
            this.mesh.lookAt(camera.position.x, this.mesh.position.y, camera.position.z); 
        }
    }

    handleIdleLogic(dt) {
        this.playAction('idle'); 
        this.timer -= dt; 
        if (this.timer <= 0) {
            this.chooseNewAction();
        }
    }

    handleWalkingLogic(dt) {
        const placedFurniture = GameContext.placedFurniture;
        
        this.playAction('walk'); 
        const dir = new THREE.Vector3().subVectors(this.stopPos, this.mesh.position); 
        dir.y = 0; 
        const dist = dir.length();
        
        if (dist > 0.5) { 
            const forwardDir = dir.clone().normalize(); 
            this.forwardRay.set(this.mesh.position.clone().add(new THREE.Vector3(0,0.3,0)), forwardDir); 
            
            const obstacleMeshes = placedFurniture.filter(f => {
                const isInteractTarget = (this.interactTarget && f === this.interactTarget);
                const isFoodTarget = (this.targetFurniture && f === this.targetFurniture);
                const isDecor = (f.userData.parentClass && f.userData.parentClass.dbItem.layer === 0);
                return !isInteractTarget && !isFoodTarget && !isDecor;
            });

            const cols = this.forwardRay.intersectObjects(obstacleMeshes, true); 
            if(cols.length > 0 && cols[0].distance < 0.4) { 
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
    
    tryAvoidObstacle(blockedDir, obstacleMeshes) {
        this.avoidCounter++;
        if (this.avoidCounter > 10) {
            this.avoidCounter = 0;
            this.isAvoiding = false;
            this.chooseNewAction();
            return;
        }
        
        this.isAvoiding = true;
        
        const angles = [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI * 3/4, -Math.PI * 3/4];
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
            
            if (hits.length === 0 || hits[0].distance > 1.0) {
                const avoidPoint = this.mesh.position.clone().add(rotatedDir.multiplyScalar(0.8));
                avoidPoint.y = 0;
                this.stopPos.copy(avoidPoint);
                return;
            }
        }
        
        this.state = 'idle';
        this.timer = 0.5;
        this.isAvoiding = false;
    }

    resetModelOffset() {
        if(this.mesh.children.length > 0) {
            this.mesh.children[0].position.x = 0;
            this.mesh.children[0].position.y = CAT_CONFIG.yOffset || 0;
            this.mesh.children[0].position.z = 0;
        }
    }

    handleInteractingLogic(dt) {
        const isInsideBox = this.interactTarget && this.interactTarget.userData.parentClass && this.interactTarget.userData.parentClass.isBox && !this.interactTarget.userData.parentClass.isTipped;
        if (isInsideBox) { this.playAction('sleep'); } else { this.playAction('idle'); } 
        
        this.timer -= dt; 
        
        if(this.timer <= 0) { 
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
        
        if (this.state === 'sleeping') {
            this.resetModelOffset(); 
            this.sleepMinDuration = 0; 
            this.hideBubble();
            GameContext.showEmote(this.mesh.position, '🙀');
        } else {
            GameContext.showEmote(this.mesh.position, '❗');
        }
        
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
        GameContext.showEmote(this.mesh.position,'❓'); 
        this.state='idle'; 
        this.interactTarget=null; 
        this.timer=1; 
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

        let rnd = Math.random();
        let target = null;
        
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

        if(target) { 
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
            if(itemSize) {
                this.mesh.position.y += (itemSize.y * 0.5) + 0.3;
            }

            if(this.mesh.children.length > 0) {
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
        if(this.interactTarget) { 
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
        
        if(this.stats.hunger < 0) this.stats.hunger = 0; 
        if(this.stats.toilet < 0) this.stats.toilet = 0; 
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
            
            if(this.targetFurniture) {
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
                if(this.state !== 'eating') return; 
                this.stats.hunger = 100; 
                if(this.targetFurniture && this.targetFurniture.userData.parentClass) this.targetFurniture.userData.parentClass.useByCat(); 
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
            
            const litterBoxHeight = 0.7;
            
            this.mesh.position.copy(this.targetFurniture.position);
            this.mesh.position.y = litterBoxHeight; 

            this.playAction('urgent'); 
            this.mesh.rotation.y = Math.random() * Math.PI * 2;
            
            setTimeout(() => { 
                if(this.state !== 'pooping') return; 
                
                this.stats.toilet = 100; 
                if(this.targetFurniture && this.targetFurniture.userData.parentClass) this.targetFurniture.userData.parentClass.useByCat(); 
                
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
