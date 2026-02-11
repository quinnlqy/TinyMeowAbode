import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
// === [新增] 后期处理模块 (直接复制这一段放在这里) ===
// 后期处理已迁移到 ./rendering/PostProcessing.js

// === 模块化导入 ===
import { AudioManager } from './managers/AudioManager.js';
import { WeatherSystem, SkyShader, AuroraShader, createParticleTexture } from './systems/WeatherSystem.js';
import { DiaryManager } from './managers/DiaryManager.js';
import { PhotoManager } from './managers/PhotoManager.js';
import { GameSaveManager } from './managers/GameSaveManager.js';
import { Furniture } from './entities/Furniture.js';
import { CAT_CONFIG } from './core/Constants.js';
import { createBlockCat, calculatePathInfo, calculateJumpPosition, generateWanderTarget } from './entities/CatUtils.js';
import { GameContext } from './core/GameContext.js';
import { Cat } from './entities/Cat.js';
import { FURNITURE_DB } from './data/FurnitureDB.js';
import { DIARY_CONFIG } from './data/DiaryConfig.js';
import { CustomTiltShiftShader } from './shaders/TiltShiftShader.js';
import { initPostProcessing, resizePostProcessing } from './rendering/PostProcessing.js';
import { playBounce, playToyAnim, spawnFloatingText, showEmoteBubble } from './utils/AnimationUtils.js';
import { InputManager } from './input/InputManager.js';

// (已移除强制进入按钮的自动显示逻辑)
// === WeatherSystem/SkyShader/AuroraShader 已迁移到 ./systems/WeatherSystem.js ===

// === 1. 全局配置与变量 ===
// CAT_CONFIG 已迁移到 ./core/Constants.js

window.GAME_VERSION = "v1.0.1 (Debug)";
console.log(`%c Game Version: ${window.GAME_VERSION} `, 'background: #222; color: #bada55; font-size: 20px;');

// 更新 Loading Screen 的版本号
const verEl = document.getElementById('version-text');
if (verEl) verEl.innerText = window.GAME_VERSION;

let weatherSystem; // 全局变量

const audioManager = new AudioManager();

// [关键] 监听全局点击，解锁音频上下文并播放 BGM
window.addEventListener('click', () => audioManager.unlockAudio(), { once: true });

const SKY_COLORS = { night: new THREE.Color(0x1a1a2e), dawn: new THREE.Color(0xffaa99), day: new THREE.Color(0xe0f7fa), dusk: new THREE.Color(0x6a5acd) };
const DEFAULT_DECOR = { floor: { color: 0xF5F5DC, texture: null }, wall: { color: 0xEBE5D1, texture: null } };

let scene, camera, renderer, controls;
let raycaster, pointer, floorPlane, wallGroup;
let sunLight, hemiLight;
let sunMesh, moonMesh, celestialGroup;
const gameClock = new THREE.Clock();

// === [修改] 时间系统变量重构 ===
// 移除原来的 gameTime 和 timeSpeed
// let gameTime = 8.0; let timeSpeed = 0.2; 

let visualHour = 8.0;     // 视觉时间 (0-24)，用于渲染天空/光照
let isTimeAuto = true;    // 是否自动跟随现实时间
let lastRealTime = Date.now(); // 上一帧的真实时间

const moveKeys = { w: false, a: false, s: false, d: false };
const loadedModels = {};
// [关键修复] 禁用 Three.js 全局缓存，避免纹理对象被共享和污染
THREE.Cache.enabled = false;
const textureLoader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();
const objLoader = new OBJLoader();

let mode = 'idle', ghostMesh = null, currentItemData = null, currentRotation = 0, canPlace = false;
let selectedObject = null, selectionBox = null, editingObjectOriginalPos = null, editingObjectOriginalQuat = null;
// [新增] 用于存储跟随移动的物体（桌上的东西）
let attachedItems = [];
let longPressTimer = null, startPointer = new THREE.Vector2();
let inputManager = null;

// === [新增] 移动端检测 ===
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
console.log(`[Device Check] isMobile: ${isMobile}, maxTouchPoints: ${navigator.maxTouchPoints}`);

const obstacles = []; const placedFurniture = []; const cats = [];
let heartScore = 500; let currentCategory = 'furniture'; let activeDecorId = { floor: null, wall: null }; let skyPanels = [];
let pendingInteraction = null;
let draggingCat = null;

// === DIARY_CONFIG 已迁移到 ./data/DiaryConfig.js ===

// === FURNITURE_DB 已迁移到 ./data/FurnitureDB.js ===

// === [新增] 全局 Tooltip 管理 ===
const Tooltip = {
    el: null,
    init() {
        this.el = document.getElementById('global-tooltip');
        // 全局鼠标移动监听 (不依赖 raycaster，确保覆盖所有 UI)
        window.addEventListener('mousemove', (e) => {
            if (this.el && this.el.style.display !== 'none') {
                // 偏移 15px 防止遮挡鼠标
                this.el.style.left = (e.clientX + 15) + 'px';
                this.el.style.top = (e.clientY + 15) + 'px';
            }
        });
    },
    show(html) {
        if (isMobile) return; // 手机端不显示鼠标提示
        if (!this.el) this.el = document.getElementById('global-tooltip');
        if (!this.el) return;

        this.el.innerHTML = html;
        this.el.style.display = 'block';
    },
    hide() {
        if (!this.el) this.el = document.getElementById('global-tooltip');
        if (!this.el) return;
        this.el.style.display = 'none';
    }
};

// === 3. 辅助函数 ===
function setDomText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; else console.warn(`Element #${id} not found`); }
window.closeDialog = function () { document.getElementById('confirm-dialog').style.display = 'none'; pendingInteraction = null; }

function showConfirmDialog(title, msg, onYes) {
    setDomText('dialog-title', title); setDomText('dialog-msg', msg);
    document.getElementById('confirm-dialog').style.display = 'block';
    const yesBtn = document.getElementById('btn-confirm-yes'); const newBtn = yesBtn.cloneNode(true); yesBtn.parentNode.replaceChild(newBtn, yesBtn);
    newBtn.onclick = () => { onYes(); window.closeDialog(); };
}

// [修改] 状态更新函数：不再显示在屏幕左侧，而是发送到系统日志
function updateStatusText(text, type) {
    // 1. 定义日志类型颜色
    let logType = 'info';
    if (type === 'invalid') logType = 'error'; // 红字
    else if (type === 'valid') logType = 'warn'; // 黄字/绿字

    // 2. 调用全局的日志函数 (定义在 head 里的那个)
    // 这样 "资源加载完毕" 和 "调试模式: 开启" 都会进入日志面板
    if (typeof window.logToScreen === 'function') {
        logToScreen(text, logType);
    } else {
        console.log(text);
    }
}

function updateMoney(amt) {
    heartScore += amt;
    setDomText('heart-text-display', heartScore); // 修改ID
    refreshShopState();
    gameSaveManager.saveGame();
}

function refreshShopState() {
    // 重新遍历所有卡片，更新 disabled 状态
    const cards = document.querySelectorAll('.item-card');
    // 这里比较麻烦，因为 DOM 里没存 price。
    // 简单粗暴点：直接重绘整个列表
    renderShopItems(currentCategory);
}

function spawnHeart(pos) {
    audioManager.playSfx('get_money');
    spawnFloatingText(camera, pos, '❤ +5', 'heart-float');
    updateMoney(5);
}
function showEmote(pos, t) {
    showEmoteBubble(camera, pos, t);
}

// [升级版] 材质优化函数：赋予模型"动森"般的磨砂质感
function sanitizeMaterial(child) {
    if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (child.material.map) child.material.map.colorSpace = THREE.SRGBColorSpace;

        // 特殊处理玻璃/窗户
        const isGlass = child.name.toLowerCase().includes('glass') || child.name.toLowerCase().includes('window');

        child.material.metalness = 0.0; // 几乎无金属感（像粘土/塑料）
        child.material.roughness = 0.7; // 高粗糙度，减少锐利反光，增加柔和感

        if (isGlass) {
            child.material.transparent = true;
            child.material.opacity = 0.3;
            child.material.color.setHex(0x88ccff);
            child.material.roughness = 0.1; // 玻璃光滑
            child.material.metalness = 0.8;
        } else {
            child.material.transparent = false;
            child.material.opacity = 1.0;
        }
        child.material.needsUpdate = true;
    }
}

function loadAssets(callback) {
    const files = [];
    files.push({ key: 'cat', path: './assets/models/cat.glb' });
    files.push({ key: 'box', path: './assets/models/cardboardBoxOpen.glb' });
    FURNITURE_DB.forEach(i => {
        if (i.modelFile) files.push({ key: i.id, path: './assets/models/' + i.modelFile });
        if (i.fullModelFile) files.push({ key: i.fullModelFile, path: './assets/models/' + i.fullModelFile });
    });

    if (files.length === 0) { callback(); return; }
    let count = 0;
    const progressFill = document.getElementById('progress-fill');
    const loadingScreen = document.getElementById('loading-screen');
    logToScreen(`Start loading ${files.length} assets...`);

    files.forEach(f => {
        const isObj = f.path.toLowerCase().endsWith('.obj');
        const l = isObj ? objLoader : gltfLoader;
        l.load(f.path, (data) => {
            const sceneData = isObj ? data : data.scene;
            const anims = isObj ? [] : data.animations;
            sceneData.traverse(sanitizeMaterial);
            loadedModels[f.key] = { scene: sceneData, animations: anims };
            count++; check();
        }, undefined, (err) => {
            console.warn("Missing asset:", f.path);
            logToScreen(`Failed to load: ${f.path}`, 'warn');
            count++; check();
        });
    });
    function check() {
        if (progressFill) progressFill.style.width = Math.floor((count / files.length) * 100) + '%';
        if (count === files.length) {
            logToScreen("Assets loading finished.");
            setTimeout(() => { if (loadingScreen) loadingScreen.remove(); callback(); }, 500);
        }
    }
}

// [修复] 补回 Decor 函数
function applyDecorVisuals(item) {
    console.log('[应用装饰] ID:', item.id, 'Type:', item.decorType, 'Texture:', item.textureFile, 'Style:', item.wallpaperStyle, 'UnitWidth:', item.wallpaperUnitWidth);
    const setMaterial = (mesh, config) => {
        // [关键修复] 确保每个 mesh 有独立的材质对象
        if (!mesh._hasOwnMaterial) {
            mesh.material = mesh.material.clone();
            mesh._hasOwnMaterial = true;
        }

        if (config.textureFile) {
            // [关键修复] 为每次加载创建独立的 TextureLoader + 唯一URL，彻底避免任何缓存
            const independentLoader = new THREE.TextureLoader();
            const uniqueId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const textureUrl = './assets/textures/' + config.textureFile + '?_=' + uniqueId;
            independentLoader.load(textureUrl, (tex) => {
                // 为调试添加 mesh 标识
                const meshId = mesh.name || mesh.uuid.substring(0, 8);
                console.log('[纹理加载] Mesh:', meshId, 'URL:', textureUrl);

                // 不需要克隆，因为每次都是独立加载的新纹理
                tex.repeat = new THREE.Vector2(1, 1);
                tex.offset = new THREE.Vector2(0, 0);
                tex.needsUpdate = true;

                tex.colorSpace = THREE.SRGBColorSpace;
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;

                if (config.decorType === 'floor') {
                    // 地板：正常平铺
                    tex.repeat.set(4, 4);
                } else {
                    // 墙纸：根据 wallpaperStyle 配置决定平铺方式
                    console.log('[墙纸调试] config.wallpaperStyle =', config.wallpaperStyle);

                    if (config.wallpaperStyle === 'horizontal') {
                        // 横向平铺模式（竖条墙纸横向重复）

                        const wallHeight = 3.2; // 墙壁实际高度（米）

                        // 获取墙壁宽度
                        let wallWidth = 5; // 默认宽度

                        // 计算墙的实际宽度（考虑缩放和旋转）
                        mesh.geometry.computeBoundingBox();
                        const bbox = mesh.geometry.boundingBox;
                        if (bbox) {
                            const bboxWidth = bbox.max.x - bbox.min.x;
                            const bboxDepth = bbox.max.z - bbox.min.z;
                            const bboxHeight = bbox.max.y - bbox.min.y;

                            // 获取世界缩放
                            const worldScale = new THREE.Vector3();
                            mesh.getWorldScale(worldScale);

                            // 计算实际尺寸
                            const actualWidth = bboxWidth * worldScale.x;
                            const actualDepth = bboxDepth * worldScale.z;

                            // 墙的宽度是 X 和 Z 中较大的那个（因为墙可能旋转）
                            wallWidth = Math.max(actualWidth, actualDepth);

                            console.log('[墙尺寸] bbox:', bboxWidth.toFixed(2), 'x', bboxDepth.toFixed(2),
                                'scale:', worldScale.x.toFixed(2), 'x', worldScale.z.toFixed(2),
                                '=> wallWidth:', wallWidth.toFixed(2));

                            if (wallWidth < 1) {
                                wallWidth = 5;
                            }
                        }

                        const texWidth = tex.image.width;
                        const texHeight = tex.image.height;

                        const verticalRepeat = 1;
                        let horizontalRepeat;

                        // 如果指定了单元宽度，使用它来计算重复次数
                        if (config.wallpaperUnitWidth && config.wallpaperUnitWidth > 0) {
                            horizontalRepeat = wallWidth / config.wallpaperUnitWidth;
                        } else {
                            // 否则根据贴图宽高比自动计算
                            const texAspectRatio = texWidth / texHeight;
                            const texWidthIn3D = wallHeight * texAspectRatio;
                            horizontalRepeat = wallWidth / texWidthIn3D;
                        }

                        if (!horizontalRepeat || horizontalRepeat <= 0 || !isFinite(horizontalRepeat)) {
                            console.warn('[墙纸] 计算异常，使用默认值');
                            horizontalRepeat = 6;
                        }

                        console.log('[墙纸] Mesh:', mesh.name || mesh.uuid.substring(0, 8), '贴图:', texWidth, 'x', texHeight, '墙宽:', wallWidth.toFixed(2), 'm, 单元宽:', config.wallpaperUnitWidth || 'auto', 'repeat:', horizontalRepeat.toFixed(2), 'x', verticalRepeat);

                        tex.repeat.set(horizontalRepeat, verticalRepeat);
                    } else if (config.wallpaperStyle === 'stretch') {
                        // 拉伸模式：整张贴图拉伸填充墙面
                        console.log('[墙纸] 使用拉伸模式');
                        tex.repeat.set(1, 1);
                    } else if (config.wallpaperStyle === 'tiled' || config.wallpaperUnitWidth) {
                        // 方形平铺模式：根据单元宽度均匀平铺，图案保持正方形不变形
                        const wallHeight = 3.2; // 墙壁实际高度（米）

                        // 获取墙壁宽度
                        let wallWidth = 5;
                        mesh.geometry.computeBoundingBox();
                        const bbox = mesh.geometry.boundingBox;
                        if (bbox) {
                            const bboxWidth = bbox.max.x - bbox.min.x;
                            const bboxDepth = bbox.max.z - bbox.min.z;
                            const worldScale = new THREE.Vector3();
                            mesh.getWorldScale(worldScale);
                            const actualWidth = bboxWidth * worldScale.x;
                            const actualDepth = bboxDepth * worldScale.z;
                            wallWidth = Math.max(actualWidth, actualDepth);
                            if (wallWidth < 1) wallWidth = 5;
                        }

                        const unitWidth = config.wallpaperUnitWidth || 1; // 默认1米
                        const horizontalRepeat = wallWidth / unitWidth;
                        const verticalRepeat = wallHeight / unitWidth;

                        console.log('[墙纸] 方形平铺模式 - 墙宽:', wallWidth.toFixed(2), 'm, 单元宽:', unitWidth, 'repeat:', horizontalRepeat.toFixed(2), 'x', verticalRepeat.toFixed(2));

                        tex.repeat.set(horizontalRepeat, verticalRepeat);
                    } else {
                        // 默认模式：双向平铺
                        console.log('[墙纸] 使用默认平铺模式 2x1');
                        tex.repeat.set(2, 1);
                    }
                }

                mesh.material.map = tex;
                mesh.material.color.setHex(0xffffff);
                mesh.material.needsUpdate = true;
            }, undefined, (err) => { console.error("Failed to load texture:", config.textureFile, err); });
        } else {
            mesh.material.map = null;
            mesh.material.color.setHex(config.color);
            mesh.material.needsUpdate = true;
        }
    };
    if (item.decorType === 'floor') setMaterial(floorPlane, item);
    else if (item.decorType === 'wall') wallGroup.forEach(wall => setMaterial(wall, item));
}
function restoreDecorState(type) { const currentId = activeDecorId[type]; if (currentId) { const item = FURNITURE_DB.find(i => i.id === currentId); if (item) applyDecorVisuals(item); } else { const def = DEFAULT_DECOR[type]; applyDecorVisuals({ decorType: type, color: def.color, textureFile: def.texture }); } }



function prepareModel(item) {
    let sceneData = null;
    if (loadedModels[item.id]) sceneData = loadedModels[item.id].scene;
    else if (item.modelFile && loadedModels[item.modelFile]) sceneData = loadedModels[item.modelFile].scene;

    if (!sceneData) return null;

    const raw = sceneData.clone();
    raw.traverse(sanitizeMaterial);
    if (item.fixBottom) { const box = new THREE.Box3().setFromObject(raw); raw.position.y = -box.min.y; }
    if (item.autoCenter) { const box = new THREE.Box3().setFromObject(raw); const c = new THREE.Vector3(); box.getCenter(c); raw.position.x -= c.x; raw.position.y -= c.y; raw.position.z -= c.z; }
    if (item.manualOffset) { raw.position.x += (item.manualOffset.x || 0); raw.position.y += (item.manualOffset.y || 0); raw.position.z += (item.manualOffset.z || 0); }
    if (item.manualRotation) {
        raw.rotation.x += (item.manualRotation.x || 0);
        raw.rotation.y += (item.manualRotation.y || 0);
        raw.rotation.z += (item.manualRotation.z || 0);
    }

    raw.scale.set(1, 1, 1);

    const group = new THREE.Group();
    group.add(raw);



    const s = item.modelScale || 1.0;
    group.scale.set(s, s, s);

    // === [新增] 圣诞树专属：让装饰品发光 ===
    // === [修复] 圣诞树发光逻辑 (大树+小树) ===
    if (item.id === 'ChrismasTree' || item.id === 'ChrismasTree_Small') {
        group.traverse((child) => {
            if (child.isMesh) {
                const name = child.name.toLowerCase();

                // 关键词匹配：星星、灯、彩带、铃铛、球、礼物
                let isDecoration = (
                    name.includes('star') ||
                    name.includes('light') ||
                    name.includes('ribbon') ||
                    name.includes('bell') ||
                    name.includes('ball') ||
                    name.includes('present') ||
                    name.includes('dec')
                );

                // [新增] 特殊补丁：小圣诞树的名字叫 "Bowl"，强制让它也算作装饰
                if (item.id === 'ChrismasTree_Small' && name.includes('bowl')) {
                    isDecoration = true;
                }

                // 排除逻辑：树干树叶不发光 (针对大树)
                const isTreeParts = (
                    name.includes('leaf') ||
                    name.includes('tree') ||
                    name.includes('bark') ||
                    name.includes('trunk')
                );

                if (isDecoration && !isTreeParts) {
                    child.material.emissive = new THREE.Color(0xffffff);

                    // 继承贴图颜色 (金星发金光，绿叶发绿光)
                    if (child.material.map) {
                        child.material.emissiveMap = child.material.map;
                    } else {
                        child.material.emissive = child.material.color;
                    }

                    child.material.emissiveIntensity = 0.75;
                    child.material.toneMapped = false;
                } else {
                    child.material.emissiveIntensity = 0;
                    child.material.toneMapped = true;
                }
            }
        });
    }
    // ==========================================

    // === [修复] 解决 Z-fighting (黑片闪烁) 终极版 ===

    // 1. 地毯 (Layer 0): 物理高度设为 0.01 (紧贴地板但有间隙)
    if (item.layer === 0) {
        // 强制修正容器高度
        group.position.y = 0.01;

        // 开启多边形偏移，让显卡优先渲染它
        group.traverse((child) => {
            if (child.isMesh) {
                child.material.polygonOffset = true;
                child.material.polygonOffsetFactor = -2.0; // 强行拉近深度
                child.material.polygonOffsetUnits = -2.0;
            }
        });
    }

    // 2. 普通家具 (Layer 1): 物理高度设为 0.02 (绝对压在地毯上面)
    if (item.layer === 1) {
        // 如果模型本身有 fixBottom 逻辑，这里是在那个基础上的额外抬升
        // 这样家具底座绝对不会和地毯穿插
        group.position.y += 0.02;
    }

    // ===========================================



    return group;
}

// === 4. 箱子逻辑 ===
// [修复] 箱子生成逻辑：使用 Box3 进行严格碰撞检测
function spawnMysteryBox(sourceItem) {
    let x, z, attempts = 0;

    // [修复] 使用实际的箱子尺寸进行碰撞检测
    const sizeSource = sourceItem.actualModelSize || sourceItem.size;
    let boxSizeX = 0.6, boxSizeZ = 0.6;
    if (sizeSource) {
        boxSizeX = Math.max(0.6, sizeSource.x);
        boxSizeZ = Math.max(0.6, sizeSource.z);
    }

    do {
        x = (Math.random() - 0.5) * 8; // 扩大一点范围
        z = (Math.random() - 0.5) * 8;
        attempts++;

        // 创建候选箱子的包围盒 - 使用实际尺寸
        const candidateBox = new THREE.Box3();
        candidateBox.min.set(x - boxSizeX / 2, 0, z - boxSizeZ / 2);
        candidateBox.max.set(x + boxSizeX / 2, 1, z + boxSizeZ / 2);

        // 检测与现有家具的碰撞
        // [修复] 扩大候选箱子判定范围，确保与家具有足够间距
        var collision = placedFurniture.some(f => {
            const fBox = new THREE.Box3().setFromObject(f);
            // 扩大候选箱子 0.2 米，确保不会太贴近家具
            const expandedCandidate = candidateBox.clone().expandByScalar(0.2);
            return expandedCandidate.intersectsBox(fBox);
        });

    } while (collision && attempts < 50);

    if (collision) {
        // 如果尝试50次都找不到空地，就不生成了，避免卡死
        return;
    }

    let boxMesh; let isTall = false; let realHeight = 0.5;
    if (loadedModels['box']) {
        const raw = loadedModels['box'].scene.clone(); raw.traverse(sanitizeMaterial);
        const box3_raw = new THREE.Box3().setFromObject(raw); const center = new THREE.Vector3(); box3_raw.getCenter(center); raw.position.sub(center);
        boxMesh = new THREE.Group(); boxMesh.add(raw);
        let sx = 0.5, sy = 0.5, sz = 0.5;
        // 根据来源家具调整箱子大小
        // [修复] 优先使用模型实际包围盒（红色框），其次才用配置尺寸（绿色框）
        const sizeSource = sourceItem.actualModelSize || sourceItem.size;
        if (sizeSource) {
            // 稍微把箱子做大一点点
            let tx = Math.max(0.6, sizeSource.x * 1.0);
            let ty = Math.max(0.4, sizeSource.y * 1.0);
            let tz = Math.max(0.6, sizeSource.z * 1.0);
            if (sourceItem.id.includes('rug')) ty = 0.3;

            const box3 = new THREE.Box3().setFromObject(raw); const baseSize = new THREE.Vector3(); box3.getSize(baseSize);
            sx = baseSize.x > 0.01 ? tx / baseSize.x : 1; sy = baseSize.y > 0.01 ? ty / baseSize.y : 1; sz = baseSize.z > 0.01 ? tz / baseSize.z : 1;
        }
        raw.scale.set(sx, sy, sz); isTall = sy > sx * 1.5 || sy > sz * 1.5; if (isTall) raw.rotation.x = Math.PI / 2; raw.updateMatrix();
        const finalBox = new THREE.Box3().setFromObject(raw); raw.position.y -= finalBox.min.y; realHeight = finalBox.max.y - finalBox.min.y;
    } else {
        let size = { x: 0.6, y: 0.5, z: 0.6 }; const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z); const boxMat = new THREE.MeshStandardMaterial({ color: 0xcd853f });
        boxMesh = new THREE.Mesh(boxGeo, boxMat); boxMesh.position.y = size.y / 2; realHeight = size.y;
    }
    boxMesh.position.set(x, 0, z); boxMesh.rotation.y = Math.random() * Math.PI * 2;
    boxMesh.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    scene.add(boxMesh);
    const boxDbItem = { id: 'mystery_box', name: "快递箱", price: 0, type: 'floor', layer: 1 };
    const boxFurnitureInstance = new Furniture(boxMesh, boxDbItem, furnitureCallbacks); boxFurnitureInstance.isBox = true; boxFurnitureInstance.isTipped = isTall; boxFurnitureInstance.boxHeight = realHeight;
    placedFurniture.push(boxMesh); showEmote(boxMesh.position, '📦');
}


// [修改] 为窗户添加渐变天空背景 (修复参数缺失导致的报错)
function addSkyBacking(mesh, size) {
    if (!weatherSystem) return;

    const width = size.x * 0.85;
    const height = size.y * 0.85;
    const planeGeo = new THREE.PlaneGeometry(width, height);

    const skyPlaneMat = new THREE.ShaderMaterial({
        uniforms: {
            // 颜色
            topColor: { value: new THREE.Color().copy(weatherSystem.skyMat.uniforms.topColor.value) },
            bottomColor: { value: new THREE.Color().copy(weatherSystem.skyMat.uniforms.bottomColor.value) },

            // [关键修复] 补全缺失的 uniforms，否则 update 时会报错！
            starOpacity: { value: 0.0 },
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
        },
        vertexShader: SkyShader.vertex,
        fragmentShader: SkyShader.fragment,
        side: THREE.FrontSide
    });

    const plane = new THREE.Mesh(planeGeo, skyPlaneMat);

    const zPos = -size.z / 2 + 0.05;
    plane.position.set(0, 0, zPos);

    mesh.add(plane);

    weatherSystem.windowMaterials.push(skyPlaneMat);
}


// [修改] 天空颜色逻辑：延长日出和日落的过渡时间
function getSkyColor(gameTime) {
    // 定义颜色
    const nightColor = SKY_COLORS.night;
    const dawnColor = SKY_COLORS.dawn;
    const dayColor = SKY_COLORS.day;
    const duskColor = SKY_COLORS.dusk;

    // 1. 深夜 (20:00 - 05:00)
    if (gameTime >= 20 || gameTime < 5) {
        return nightColor;
    }
    // 2. 朝阳过渡期 (05:00 - 09:00, 持续4小时)
    else if (gameTime >= 5 && gameTime < 9) {
        const ratio = (gameTime - 5) / 4; // 0.0 ~ 1.0
        return nightColor.clone().lerp(dawnColor, ratio);
    }
    // 3. 早上过渡到白天 (09:00 - 10:00, 快速过渡，防止白天太粉)
    else if (gameTime >= 9 && gameTime < 10) {
        const ratio = (gameTime - 9) / 1;
        return dawnColor.clone().lerp(dayColor, ratio);
    }
    // 4. 正午白天 (10:00 - 15:00)
    else if (gameTime >= 10 && gameTime < 15) {
        return dayColor;
    }
    // 5. 白天过渡到夕阳 (15:00 - 17:00)
    else if (gameTime >= 15 && gameTime < 17) {
        const ratio = (gameTime - 15) / 2;
        return dayColor.clone().lerp(duskColor, ratio);
    }
    // 6. 夕阳晚霞 (17:00 - 20:00, 持续3小时)
    else if (gameTime >= 17 && gameTime < 20) {
        const ratio = (gameTime - 17) / 3;
        return duskColor.clone().lerp(nightColor, ratio);
    }

    return nightColor; // Fallback
}

// [修复] 环境更新函数：只负责更新数据和UI，不绑定事件
function updateEnvironment(dt) {
    const now = new Date();

    // 1. 获取真实时间
    const realHour = now.getHours();
    const realMin = now.getMinutes();

    // 2. 确定视觉时间 (visualHour)
    if (isTimeAuto) {
        // 自动模式：视觉时间 = 真实时间
        visualHour = realHour + realMin / 60.0;

        // 同步 HUD 滑块
        const hudSlider = document.getElementById('time-slider-hud');
        if (hudSlider && document.activeElement !== hudSlider) hudSlider.value = visualHour;
    }

    // 同步到 GameContext（供模块化组件使用）
    GameContext.visualHour = visualHour;

    // 3. [修改] 更新新版 HUD UI
    const displayH = realHour;

    // 格式化 12小时制 AM/PM
    const ampm = displayH >= 12 ? 'PM' : 'AM';
    const hour12 = displayH % 12 || 12;

    setDomText('time-text-display', `${hour12}:${realMin.toString().padStart(2, '0')}`);
    setDomText('time-ampm', ampm);

    // 更新天气图标 (切换 src)
    const weatherIcon = document.getElementById('weather-icon-img');
    if (weatherIcon) {
        const isDay = (displayH >= 6 && displayH < 18);
        // 假设你有 icon_sun.png 和 icon_moon.png
        const targetIcon = isDay ? './assets/ui/icon_sun.png' : './assets/ui/icon_moon.png';
        if (!weatherIcon.src.includes(targetIcon)) weatherIcon.src = targetIcon;
    }

    // 4. 渲染天空与光照 (保持不变)
    //const skyColor = getSkyColor(visualHour); 
    //scene.background = skyColor; 
    //document.body.style.backgroundColor = `rgb(${skyColor.r*255},${skyColor.g*255},${skyColor.b*255})`;
    //skyPanels.forEach(panel => { panel.material.color.copy(skyColor); });
    // [新增] 更新天候系统
    if (weatherSystem) {
        weatherSystem.update(dt, visualHour);
    }

    // 光照强度逻辑 (复用 Phase 1.0 的逻辑)
    const isDaytime = (visualHour >= 6 && visualHour < 18);

    if (isDaytime) {
        // 计算太阳位置
        const angle = (visualHour - 12) / 12 * Math.PI;

        // [关键修改] 半径加大！
        // 之前是 80 或 100，现在设为 60 (配合下面的高Y轴)
        // 让太阳在很远的地方转，保证光线是平行的
        const radius = 60;

        const sunX = Math.sin(angle) * radius;

        // [关键修复] 锁定最低高度 + 整体抬升
        // 让太阳永远在 30米 以上的高空盘旋
        // 这样光线永远是从斜上方射下来的，绝对不会出现"侧切"导致的黑片
        let sunY = Math.cos(angle) * radius;
        if (sunY < 30) sunY = 30;

        // 计算亮度 (早晚渐变)
        let intensityFactor = 1.0;
        if (visualHour < 9) intensityFactor = (visualHour - 6) / 3;
        else if (visualHour > 15) intensityFactor = (18 - visualHour) / 3;
        if (intensityFactor < 0.1) intensityFactor = 0.1;

        // 应用设置
        sunLight.intensity = 3.5 * intensityFactor;

        // Z轴也给一点偏移，让阴影稍微有点立体感，不要完全正侧面
        sunLight.position.set(sunX, sunY, 20);

        sunLight.target.position.set(0, 0, 0);
        sunLight.target.updateMatrixWorld();


        // 环境光配合
        hemiLight.intensity = 0.5 + (1.0 * intensityFactor);

        // 关室内灯
        placedFurniture.forEach(f => { const light = f.children.find(c => c.isLight); if (light) light.visible = false; });
    } else {
        // 夜晚
        sunLight.intensity = 0;
        hemiLight.intensity = 0.6;

        // 开室内灯
        placedFurniture.forEach(f => { const light = f.children.find(c => c.isLight); if (light) light.visible = true; });
    }
}
// === CustomTiltShiftShader 已迁移到 ./shaders/TiltShiftShader.js ===

// === PostProcessing 已迁移到 ./rendering/PostProcessing.js ===
let composer;



// === [新增] 为所有按钮绑定通用点击音效 ===
document.querySelectorAll('button, .item-card, .shop-tab, .hud-btn-container, #weather-icon-container').forEach(btn => {
    btn.addEventListener('click', () => audioManager.playSfx('ui_click'));
});

// [新增] 家具替换逻辑 (用于盲盒开启等)
function replaceFurniture(oldMesh, newId) {
    // 1. 找到旧家具数据
    const oldIndex = placedFurniture.indexOf(oldMesh);
    if (oldIndex === -1) return;

    const oldItem = oldMesh.userData.parentClass ? oldMesh.userData.parentClass.dbItem : null;
    const pos = oldMesh.position.clone();
    const rot = oldMesh.rotation.clone();

    // 2. 移除旧家具
    scene.remove(oldMesh);
    placedFurniture.splice(oldIndex, 1);

    // 3. 获取新家具配置
    const newItem = FURNITURE_DB.find(i => i.id === newId);
    if (!newItem) {
        console.error("New item not found:", newId);
        return;
    }

    // 4. 创建新模型
    const modelGroup = prepareModel(newItem);
    if (!modelGroup) return;

    modelGroup.position.copy(pos);
    modelGroup.rotation.copy(rot);

    // 5. 初始化新家具对象
    const newFurniture = new Furniture(modelGroup, newItem, furnitureCallbacks);

    // 6. 添加到场景
    scene.add(modelGroup);
    placedFurniture.push(modelGroup);

    // 7. 特效反馈
    spawnFloatingText(camera, pos.clone().add(new THREE.Vector3(0, 0.5, 0)), '✨ Unboxed! ✨', 'heart-float');
    audioManager.playSfx('ui_popup'); // 播放音效

    // 8. 自动存盘
    gameSaveManager.saveGame();

    updateStatusText(`恭喜获得: ${newItem.name}`);
}

// === Furniture 已迁移到 ./entities/Furniture.js ===
// 家具回调对象（供 Furniture 类使用）
const furnitureCallbacks = {
    prepareModel,
    logToScreen,
    showConfirmDialog,
    getHeartScore: () => heartScore,
    updateMoney,
    showEmote,
    updateStatusText,
    get diaryManager() { return diaryManager; },
    get audioManager() { return audioManager; },
    saveGame: () => gameSaveManager.saveGame(),
    replaceFurniture // [新增]
};

// === DiaryManager 已迁移到 ./managers/DiaryManager.js ===

// === GameSaveManager 已迁移到 ./managers/GameSaveManager.js ===

const gameSaveManager = new GameSaveManager(
    // 获取游戏数据的回调
    () => ({ cats, heartScore, activeDecorId, placedFurniture }),
    // 恢复数据的回调
    {
        setHeartScore: (val) => { heartScore = val; setDomText('heart-text-display', heartScore); },
        setActiveDecor: (val) => { activeDecorId = val; },
        applyDecorVisuals: applyDecorVisuals,
        FURNITURE_DB: FURNITURE_DB
    }
);

// === Cat 类已迁移到 ./entities/Cat.js ===

// === 6. 交互与渲染 ===
window.switchCategory = function (cat) {
    currentCategory = cat;

    // [修改] 切换 Tab 的 active 样式
    const tabs = document.querySelectorAll('.shop-tab');
    const catMap = { 'furniture': 0, 'small': 1, 'wall': 2, 'wallpaper': 3, 'flooring': 4, 'rug': 5 };

    tabs.forEach(t => t.classList.remove('active'));
    if (tabs[catMap[cat]]) tabs[catMap[cat]].classList.add('active');

    renderShopItems(cat);

    // 切换分页时，滚动回开头
    const container = document.getElementById('items-scroll');
    if (container) {
        container.scrollLeft = 0;
    }
};

window.forceStart = function () { const ls = document.getElementById('loading-screen'); if (ls) ls.style.display = 'none'; if (!scene) startGame(); }
window.debugAddMoney = function () { updateMoney(100); };
window.debugClearSave = function () {
    localStorage.clear();
    alert('存档已清除，页面将重新加载');
    location.reload();
};
window.debugResetCat = function () { cats.forEach(c => c.resetCooldown()); updateStatusText("猫咪不再生气了"); };

// [新增] 强制猫咪上厕所的GM功能
window.debugForceToilet = function () {
    cats.forEach(cat => {
        // 将便便值设为0，触发急迫状态
        cat.stats.toilet = 0;
        // 如果猫咪在睡觉或其他状态，打断它
        if (cat.state === 'sleeping' || cat.state === 'eating') {
            cat.state = 'idle';
            cat.timer = 0;
        }
        console.log("已强制猫咪进入急迫状态 (toilet = 0)");
    });
    updateStatusText("🚽 猫咪急需上厕所！");
};

// [新增] 手动拍照功能
window.takeManualPhoto = function () {
    if (window.photoManager) {
        window.photoManager.enterPhotoMode(); // 进入拍照模式
    } else {
        console.error('照片系统未初始化');
    }
};

// [新增] 拍照模式下的快门功能
window.capturePhoto = function () {
    if (window.photoManager) {
        window.photoManager.captureInPhotoMode();
    }
};

// [新增] 退出拍照模式
window.exitPhotoMode = function () {
    if (window.photoManager) {
        window.photoManager.exitPhotoMode();
    }
};

// [新增] 猫咪状态调试函数
window.debugCatInfo = function () {
    console.log("\n========== 猫咪调试信息 ==========");
    console.log("猫咪数量:", cats.length);

    cats.forEach((cat, index) => {
        console.log(`\n--- 猫咪 #${index + 1} ---`);
        console.log("状态 (state):", cat.state);
        console.log("位置 (position):", {
            x: cat.mesh.position.x.toFixed(2),
            y: cat.mesh.position.y.toFixed(2),
            z: cat.mesh.position.z.toFixed(2)
        });
        console.log("可见性 (visible):", cat.mesh.visible);
        console.log("在场景中:", scene.children.includes(cat.mesh));
        console.log("饱食度 (hunger):", cat.stats.hunger);
        console.log("便便值 (toilet):", cat.stats.toilet);
        console.log("冷却时间 (cooldown):", cat.cooldown);

        if (cat.state === 'sleeping') {
            console.log("睡眠位置:", cat.sleepTarget ? {
                x: cat.sleepTarget.x.toFixed(2),
                y: cat.sleepTarget.y.toFixed(2),
                z: cat.sleepTarget.z.toFixed(2)
            } : "无");
            console.log("睡眠家具:", cat.currentSleepFurniture?.userData?.parentClass?.dbItem?.name || "无");
        }

        if (cat.state === 'eating') {
            console.log("食盆:", cat.targetFoodBowl ? "有" : "无");
        }

        // 检查 Mesh 的父级
        console.log("Mesh 父级:", cat.mesh.parent?.type || "无父级");

        // 检查动画
        if (cat.mixer) {
            console.log("AnimationMixer 存在:", true);
            console.log("当前动作:", cat.currentAction?._clip?.name || "无");
        } else {
            console.log("AnimationMixer 存在:", false);
        }
    });

    console.log("\n========== 场景信息 ==========");
    console.log("场景子对象数量:", scene.children.length);
    console.log("相机位置:", {
        x: camera.position.x.toFixed(2),
        y: camera.position.y.toFixed(2),
        z: camera.position.z.toFixed(2)
    });
    console.log("================================\n");

    alert("猫咪调试信息已输出到控制台！\n请按 F12 打开控制台查看详细信息");
};

let debugGizmosVisible = false;
let debugHelpers = [];
window.toggleDebugGizmos = function () {
    debugGizmosVisible = !debugGizmosVisible;

    // 1. 清除旧的线框
    debugHelpers.forEach(h => scene.remove(h));
    debugHelpers = [];

    if (!debugGizmosVisible) {
        updateStatusText("调试模式: 关闭");
        return;
    }

    // 2. 生成新的线框
    placedFurniture.forEach(f => {
        if (!f.userData.parentClass) return;
        const db = f.userData.parentClass.dbItem;

        // 红色：实际模型包围盒 (BoxHelper) - 这是真实的物理边缘
        const meshHelper = new THREE.BoxHelper(f, 0xff0000);
        scene.add(meshHelper);
        debugHelpers.push(meshHelper);

        // 绿色：逻辑数据包围盒 (Based on DB Size)
        if (db.size) {
            const geo = new THREE.BoxGeometry(db.size.x, db.size.y, db.size.z);
            const edges = new THREE.EdgesGeometry(geo);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00ff00 }));

            line.position.copy(f.position);
            line.rotation.copy(f.rotation);

            // [修复] 只有非墙壁类家具，才需要抬高线框
            // 墙壁类家具 (type === 'wall') 通常原点就在中心，不需要抬高
            if (db.type !== 'wall' && db.fixBottom !== false) {
                line.position.y += db.size.y / 2;
            }

            scene.add(line);
            debugHelpers.push(line);
        }
    });
    updateStatusText("调试模式: 开启 - 红:模型 绿:逻辑");
}

// [新增] 切换日志显示/隐藏
window.toggleConsole = function () {
    const consoleDiv = document.getElementById('debug-console');
    if (consoleDiv) {
        // 如果当前是隐藏的，就显示；如果是显示的，就隐藏
        if (consoleDiv.style.display === 'none' || consoleDiv.style.display === '') {
            consoleDiv.style.display = 'block';
        } else {
            consoleDiv.style.display = 'none';
        }
    }
};
window.toggleWeather = function () {
    if (!weatherSystem) return;
    const types = ['clear', 'rain', 'snow'];
    // 循环切换
    let currentIdx = types.indexOf(weatherSystem.currentWeather);
    let nextIdx = (currentIdx + 1) % types.length;
    weatherSystem.setWeather(types[nextIdx], true); // true 表示手动切换
};

// [新增] 天气按钮循环切换函数
window.cycleWeather = function () {
    if (!weatherSystem) return;

    const weatherTypes = ['clear', 'rain', 'snow'];
    const weatherIcons = {
        'clear': './assets/ui/weather/sunny.png',
        'rain': './assets/ui/weather/rainning.png',
        'snow': './assets/ui/weather/snow.png'
    };
    const weatherNames = {
        'clear': '晴天',
        'rain': '雨天',
        'snow': '雪天'
    };

    // 循环切换天气
    let currentIdx = weatherTypes.indexOf(weatherSystem.currentWeather);
    let nextIdx = (currentIdx + 1) % weatherTypes.length;
    let nextWeather = weatherTypes[nextIdx];

    // 更新天气系统（true 表示手动切换）
    weatherSystem.setWeather(nextWeather, true);

    // 更新按钮图标
    const iconImg = document.getElementById('weather-btn-icon');
    if (iconImg) {
        iconImg.src = weatherIcons[nextWeather];
    }

    // 显示提示
    updateStatusText('天气: ' + weatherNames[nextWeather]);
};

function renderShopItems(cat) {
    const c = document.getElementById('items-scroll');
    c.innerHTML = '';

    let allItems = [];

    // 根据新的分类筛选商品
    switch (cat) {
        case 'furniture':
            // 大型家具（floor类型，layer=1，排除地毯和功能性家具）
            allItems = FURNITURE_DB.filter(i =>
                i.type === 'floor' &&
                i.layer === 1 &&
                !i.id.includes('rug')
            );
            break;
        case 'small':
            // 小物件（small类型）+ 功能性家具（猫砂盆、食盆）
            allItems = FURNITURE_DB.filter(i =>
                (i.type === 'small' || i.type === 'functional') &&
                !i.excludeFromShop
            );
            break;
        case 'wall':
            // 壁挂物（wall类型）
            allItems = FURNITURE_DB.filter(i => i.type === 'wall' && !i.excludeFromShop);
            break;
        case 'wallpaper':
            // 墙纸（decor类型，decorType='wall'）
            allItems = FURNITURE_DB.filter(i =>
                i.type === 'decor' &&
                i.decorType === 'wall' &&
                !i.excludeFromShop
            );
            break;
        case 'flooring':
            // 地板（decor类型，decorType='floor'，排除地毯）
            allItems = FURNITURE_DB.filter(i =>
                i.type === 'decor' &&
                i.decorType === 'floor' &&
                !i.excludeFromShop
            );
            break;
        case 'rug':
            // 地毯（floor类型，layer=0，或id包含rug）
            allItems = FURNITURE_DB.filter(i =>
                ((i.type === 'floor' && i.layer === 0) || i.id.includes('rug')) &&
                !i.excludeFromShop
            );
            break;
        default:
            allItems = [];
    }

    allItems.forEach(item => {

        // 创建容器
        const card = document.createElement('div');
        card.className = 'item-card';
        if (heartScore < item.price) card.classList.add('disabled');

        // === 为装修类添加选中状态 ===
        if (item.type === 'decor' && activeDecorId[item.decorType] === item.id) {
            card.classList.add('selected');

            // 添加选中图标
            const selectedIcon = document.createElement('img');
            selectedIcon.src = './assets/ui/selected.png';
            selectedIcon.className = 'selected-icon';
            selectedIcon.style.cssText = `
                        position: absolute;
                        top: 8px;
                        right: 8px;
                        width: 32px;
                        height: 32px;
                        pointer-events: none;
                        z-index: 10;
                    `;
            card.appendChild(selectedIcon);
        }

        // 点击事件
        card.onclick = (e) => {
            e.stopPropagation();
            if (!card.classList.contains('disabled')) {
                startNewPlacement(item.id);
            }
        };

        // 装饰预览事件
        if (item.type === 'decor') {
            card.onmouseenter = () => applyDecorVisuals(item);
            card.onmouseleave = () => restoreDecorState(item.decorType);
        }

        // === 鼠标悬浮显示家具名称 (使用全局Tooltip) ===
        const hintText = isMobile ? '' : '<br><span style="font-size:10px;opacity:0.8; color:#ffd700;">✨ 点击选择家具摆放</span>';
        card.onmouseenter = function (e) {
            // 如果是装修类，先执行预览
            if (item.type === 'decor') {
                applyDecorVisuals(item);
            }
            // 显示全局提示
            Tooltip.show(`📦 ${item.name}${hintText}`);
        };

        // 鼠标移出隐藏
        card.onmouseleave = function () {
            // 如果是装修类，恢复状态
            if (item.type === 'decor') {
                restoreDecorState(item.decorType);
            }
            Tooltip.hide();
        };

        // 1. 展示台背景 (Shelf) - 仅非装饰类显示台子，或者都显示，看你喜好
        // 假设墙纸也放在台子上卖
        const shelf = document.createElement('img');
        shelf.src = './assets/ui/shop_shelf.png';
        shelf.className = 'shelf-bg';
        card.appendChild(shelf);

        // 2. 商品图标 (Icon)
        // [优化] 优先使用 item.iconFile，否则尝试拼凑 assets/ui/items/icon_{id}.png
        let iconPath;
        if (item.iconFile) {
            iconPath = `./assets/ui/items/${item.iconFile}`;
        } else {
            // 默认尝试 .png
            iconPath = `./assets/ui/items/icon_${item.id}.png`;
        }

        const iconImg = document.createElement('img');
        iconImg.className = 'item-icon';
        iconImg.src = iconPath;

        // [备用方案] 图片加载失败时，显示色块
        iconImg.onerror = function () {
            this.style.display = 'none'; // 隐藏破图
            const placeholder = document.createElement('div');
            placeholder.className = 'item-placeholder';

            // 如果有纹理用纹理，没纹理用颜色
            if (item.textureFile) {
                placeholder.style.backgroundImage = `url(./assets/textures/${item.textureFile})`;
                placeholder.style.backgroundSize = 'cover';
            } else {
                const colorVal = item.color !== undefined ? item.color : 0xcccccc;
                placeholder.style.background = '#' + colorVal.toString(16).padStart(6, '0');
            }
            card.insertBefore(placeholder, shelf.nextSibling); // 插在台子上面
        };

        card.appendChild(iconImg);

        // 3. 价格吊牌 (Tag)
        const tag = document.createElement('div');
        tag.className = 'price-tag-new';

        // [修复] 插入爱心小图标和价格
        const priceText = item.price > 0 ? item.price : 'Free';
        // 这里复用爱心组件的那个图标，稍微缩小一点
        tag.innerHTML = `<img src="./assets/ui/icon_heart.png" class="price-heart-icon"><span>${priceText}</span>`;

        card.appendChild(tag);

        c.appendChild(card);
    });
    // 不需要 refreshShopState 了，因为上面创建时已经判断了 disabled

    // [新增] 渲染完商品后，重置滚动条
    setTimeout(() => setupCustomScrollbar(), 50);
}

window.startNewPlacement = function (id) {
    const item = FURNITURE_DB.find(i => i.id === id);
    if (heartScore < item.price && !activeDecorId[item.decorType]) { alert("金钱不足"); return; }
    if (item.type === 'decor') { handleDecorClick(item); return; }

    deselect();
    mode = 'placing_new';
    currentItemData = item;
    currentRotation = 0;
    createGhost();
    updateStatusText("放置: " + item.name);
    document.querySelectorAll('.item-btn').forEach(b => b.classList.remove('selected'));

    // PC端显示放置提示
    if (!isMobile) {
        Tooltip.show('💡 旋转：点击鼠标中键 / R键<br>❌ 取消：点击鼠标右键');
    }

    // === [新增] 移动端专属逻辑 ===
    if (isMobile) {
        // 0. 禁用相机旋转，防止拖拽家具时场景跟着转
        if (inputManager) inputManager.disableControls();

        // 1. 将家具放置在房间中央（简化逻辑，避免摄像机计算问题）
        if (ghostMesh) {
            // 地面家具放在中央
            if (item.type === 'wall') {
                // 墙上物品放在后墙中央
                ghostMesh.position.set(0, 1.5, -3.5);
            } else {
                // 普通家具放在地面中央
                ghostMesh.position.set(0, 0, 0);
            }
            console.log('[Mobile] Ghost position set to:', ghostMesh.position);
        }

        // 2. 显示移动端操作栏
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) mobileControls.style.display = 'flex';

        // 3. 隐藏底部 UI（商店、HUD底栏）
        document.getElementById('shop-panel-container')?.classList.add('hidden-in-edit-mode');
        document.getElementById('hud-bottom-bar')?.classList.add('hidden-in-edit-mode');

        // 4. [修复] 进行一次碰撞检测，而不是无脑允许放置
        checkColl(item.type === 'wall');
    }
}

function handleDecorClick(item) {
    const type = item.decorType;
    if (activeDecorId[type] === item.id) { activeDecorId[type] = null; restoreDecorState(type); updateStatusText("已恢复默认样式"); }
    else { if (heartScore >= item.price) { updateMoney(-item.price); activeDecorId[type] = item.id; applyDecorVisuals(item); updateStatusText("已装修: " + item.name); } else { alert("金钱不足！"); } }
    // 重新渲染当前分类（修复：根据 decorType 确定当前分类）
    renderShopItems(type === 'wall' ? 'wallpaper' : 'flooring');
}

function createGhost() {
    if (ghostMesh) scene.remove(ghostMesh);
    const item = currentItemData; const modelGroup = prepareModel(item);
    if (modelGroup) { ghostMesh = modelGroup; } else { let mat = new THREE.MeshStandardMaterial({ color: item.color, transparent: true, opacity: 0.6 }); let geo = new THREE.BoxGeometry(item.size?.x || 1, item.size?.y || 1, item.size?.z || 1); ghostMesh = new THREE.Mesh(geo, mat); }
    ghostMesh.traverse((c) => { if (c.isMesh) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.5; } });
    ghostMesh.position.set(0, -100, 0); if (item.type !== 'wall') ghostMesh.rotation.y = currentRotation; scene.add(ghostMesh);
}

function checkColl(isWall) {
    ghostMesh.updateMatrixWorld();
    const box = new THREE.Box3().setFromObject(ghostMesh);
    if (currentItemData.layer === 0) {
        box.min.x += 0.1; box.max.x -= 0.1;
        box.min.z += 0.1; box.max.z -= 0.1;
    } else {
        box.expandByScalar(-0.1);
    }

    let col = false;
    // 1. Wall structure collision
    if (!isWall) {
        for (let o of obstacles) {
            if (box.intersectsBox(new THREE.Box3().setFromObject(o))) { col = true; break; }
        }
    }

    // 2. Furniture collision
    if (!col) {
        for (let f of placedFurniture) {
            if (mode === 'moving_old' && f === selectedObject) continue;

            // [修复] 层级判断逻辑
            const myL = currentItemData.layer;
            const otherL = f.userData.parentClass ? f.userData.parentClass.dbItem.layer : 1;

            // Layer 0 (Rugs) ignores everything and is ignored by everything
            if (myL === 0 || otherL === 0) continue;

            // Layer 2 vs Layer 1 collision rules (simplified: ignore vertical stacking collision for horizontal placement)
            if ((myL === 2 && otherL === 1) || (myL === 1 && otherL === 2)) continue;

            // Overlap property
            if (currentItemData.allowOverlap && f.userData.parentClass && f.userData.parentClass.dbItem.type === 'wall') continue;

            if (box.intersectsBox(new THREE.Box3().setFromObject(f))) { col = true; break; }
        }
    }
    if (ghostMesh.position.y < 0 && currentItemData.layer !== 0) col = true;

    if (col) {
        ghostMesh.traverse(c => { if (c.isMesh) c.material.color.setHex(0xff0000) });
        canPlace = false;
        updateStatusText("位置冲突", "invalid");
    } else {
        ghostMesh.traverse(c => { if (c.isMesh) c.material.color.setHex(0xffffff) });
        canPlace = true;
        updateStatusText("可放置", "valid");
    }
}

function confirmPlace() {
    if (mode === 'placing_new') {
        if (heartScore >= currentItemData.price)
            updateMoney(-currentItemData.price);
        else {
            alert("金钱不足!");
            cancelPlace();
            gameSaveManager.saveGame();
            return;
        }
    }

    // 隐藏放置提示并移除监听
    // 隐藏放置提示
    Tooltip.hide();

    let m = ghostMesh.clone();
    m.traverse(c => {
        if (c.isMesh) {
            c.material.opacity = 1.0;
            c.material.transparent = false;
            if (!currentItemData.modelFile) c.material.color.setHex(currentItemData.color || 0xffffff);
        }
    });

    const newFurniture = new Furniture(m, currentItemData, furnitureCallbacks);
    // [修复] 如果是从旧家具移动过来的，保留功能状态
    if (currentItemData.functionalState) {
        newFurniture.functionalState = currentItemData.functionalState;
        newFurniture.updateVisuals();
    }
    scene.add(m);
    placedFurniture.push(m);

    // [新增] 日记埋点：购买家具
    if (mode === 'placing_new') {
        // 根据家具类型选择对应的日记文案类别
        let typeKey = 'buy_small'; // 默认小物
        if (currentItemData.type === 'floor') {
            typeKey = 'buy_floor';  // 地面大件家具
        } else if (currentItemData.type === 'wall') {
            typeKey = 'buy_wall';   // 墙面挂饰
        }

        // [关键修复] 必须传入 id: currentItemData.id
        // 这样 logEvent 才能去 specific_items 里查找有没有 'ChrismasTree' 的专用吐槽
        // [修改] 调用 logEvent，给购买事件一个权重
        diaryManager.logEvent(typeKey, {
            item: currentItemData.name,
            id: currentItemData.id
        }, 60); // 购买事件权重高一点
    }


    if (currentItemData.light) {
        if (currentItemData.lightType === 'point') {
            const bulb = new THREE.PointLight(0xffaa00, 0.8, 5);
            let lx = 0, ly = 0.3, lz = 0;
            if (currentItemData.lightOffset) { lx = currentItemData.lightOffset.x || 0; ly = currentItemData.lightOffset.y || 0; lz = currentItemData.lightOffset.z || 0; }
            bulb.position.set(lx, ly, lz); bulb.castShadow = true; m.add(bulb);
        } else {
            const sl = new THREE.SpotLight(0xfff0dd, 5); sl.position.set(0, 0, 0); sl.target.position.set(0, 0, 5); sl.angle = Math.PI / 3; sl.penumbra = 0.5; sl.castShadow = true; m.add(sl); m.add(sl.target);
        }
    }

    // [修复] 天空背景
    if (currentItemData.light && currentItemData.type === 'wall') {
        addSkyBacking(m, currentItemData.size);
    }

    if (mode === 'placing_new' && currentItemData.layer === 1) {
        // [修复] 使用模型实际包围盒（红色框）而非配置尺寸（绿色框）
        const actualBox = new THREE.Box3().setFromObject(ghostMesh);
        const actualSize = new THREE.Vector3();
        actualBox.getSize(actualSize);
        const savedItem = { ...currentItemData, actualModelSize: { x: actualSize.x, y: actualSize.y, z: actualSize.z } };
        setTimeout(() => spawnMysteryBox(savedItem), 1000);
    }
    if (mode === 'moving_old') {
        scene.remove(selectedObject);
        const i = placedFurniture.indexOf(selectedObject);
        if (i > -1) placedFurniture.splice(i, 1);

        // === [新增] 确认放置跟随物 ===
        if (attachedItems.length > 0) {
            attachedItems.forEach(attach => {
                // 移除虚影
                scene.remove(attach.ghostMesh);
                // 更新真身位置
                attach.realMesh.position.copy(attach.ghostMesh.position);
                attach.realMesh.rotation.y = attach.ghostMesh.rotation.y;
                // 显示真身
                attach.realMesh.visible = true;

                // 播放弹跳动画
                playBounce(attach.realMesh);
            });
            attachedItems = []; // 清空
        }

        deselect();
    }
    cancelPlace();
    playBounce(m);
    audioManager.playSfx('place_item'); // [新增] 放置音效

    gameSaveManager.saveGame(); // 也要存盘
}

function onDown(e) {
    if (e.target !== renderer.domElement) return;
    startPointer.x = e.clientX; startPointer.y = e.clientY;

    // [修复] 触摸事件兼容：触摸时 e.button 可能是 0 或 -1，统一处理为"主要点击"
    const isPrimaryClick = e.button === 0 || e.pointerType === 'touch';

    // [修复] 在点击时更新 pointer 坐标，避免使用旧的 onMove 坐标
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

    if (mode === 'idle' && isPrimaryClick) {
        raycaster.setFromCamera(pointer, camera);

        // [调试] 移动端触摸点击日志
        if (isMobile) {
            console.log('[Mobile Touch] pointer:', pointer.x.toFixed(3), pointer.y.toFixed(3));
            const allHits = raycaster.intersectObjects(placedFurniture, true);
            console.log('[Mobile Touch] furniture hits:', allHits.length, allHits.map(h => h.object.name || h.object.uuid.slice(0, 8)));
        }

        // 1. 优先检测猫咪
        let catHit = null;
        for (let cat of cats) {
            const hits = raycaster.intersectObject(cat.mesh, true);
            if (hits.length > 0) { catHit = cat; break; }
        }

        if (catHit) {
            // 点击到猫咪，先暂时锁定视角旋转，防止长按时误触
            controls.enabled = false;

            longPressTimer = setTimeout(() => {
                // 长按触发：开始拖拽
                draggingCat = catHit;
                draggingCat.setDragged(true);
                updateStatusText("拎起猫咪");
            }, 500);
            return;
        }

        // 2. 检测家具
        const hits = raycaster.intersectObjects(placedFurniture, true);
        if (hits.length > 0) {
            let root = hits[0].object; while (root.parent && root.parent !== scene) root = root.parent;

            if (root.userData.isBox) {
                scene.remove(root);
                const i = placedFurniture.indexOf(root);
                if (i > -1) placedFurniture.splice(i, 1);
                updateMoney(10); spawnHeart(root.position); updateStatusText("回收纸箱+10");
                return;
            }
            if (root.userData.parentClass) {
                const itemData = root.userData.parentClass.dbItem;

                // === [新增] 玩具交互逻辑 ===
                if (itemData.isToy) {
                    // 1. 播放挤压动画
                    playToyAnim(root);

                    // 2. 播放声音 (如果没有 squeak，先用 ui_popup 测试)
                    audioManager.playSfx('toy_squeak'); // 记得确保 AudioManager 里有这个 key

                    // 3. 猫咪反应：看向玩具，并在头顶冒个问号
                    if (cats.length > 0) {
                        cats[0].reactToSound(root.position);
                    }

                    // 注意：这里不 return，因为长按可能还需要移动它
                    // 但短按就会触发这个效果
                }
                // ==========================

                const didInteract = root.userData.parentClass.interact();


                if (didInteract) return;
                if (root.userData.parentClass.isBox) { scene.remove(root); const i = placedFurniture.indexOf(root); if (i > -1) placedFurniture.splice(i, 1); updateMoney(10); spawnHeart(root.position); updateStatusText("回收纸箱+10"); return; }
            }
            longPressTimer = setTimeout(() => selectObj(root, e.clientX, e.clientY), 500);
        }
    }
    if (e.button === 1 && ghostMesh && currentItemData.type !== 'wall') { e.preventDefault(); rotateItem(); return; }
    // [修复] PC 端：点击地面确认放置；移动端：通过操作栏"确定"按钮确认（不在这里处理）
    if (!isMobile && isPrimaryClick && (mode === 'placing_new' || mode === 'moving_old') && canPlace && ghostMesh) confirmPlace();
}

function onUp() {
    // 恢复视角控制
    // [修复] 移动端：摆放家具模式下不要恢复相机控制，直到确认/取消
    if (isMobile && (mode === 'placing_new' || mode === 'moving_old')) {
        // 保持禁用状态
    } else {
        controls.enabled = true;
    }

    if (draggingCat) {
        draggingCat.setDragged(false);
        draggingCat = null;
        updateStatusText("放置猫咪");
    }
    else if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        raycaster.setFromCamera(pointer, camera);
        for (let cat of cats) {
            const hits = raycaster.intersectObject(cat.mesh, true);
            if (hits.length > 0) { cat.pet(); return; }
        }
    }
}

function selectObj(m, x, y) { deselect(); selectedObject = m; selectionBox = new THREE.BoxHelper(selectedObject, 0xffffff); scene.add(selectionBox); const menu = document.getElementById('context-menu'); menu.style.display = 'flex'; let px = x + 10, py = y + 10; if (px + 100 > window.innerWidth) px = window.innerWidth - 110; if (py + 100 > window.innerHeight) py = window.innerHeight - 110; menu.style.left = px + 'px'; menu.style.top = py + 'px'; updateStatusText("选中: 家具"); }
function deselect() { selectedObject = null; if (selectionBox) { scene.remove(selectionBox); selectionBox = null; } document.getElementById('context-menu').style.display = 'none'; }
function cancelPlace() {
    if (ghostMesh) scene.remove(ghostMesh);
    mode = 'idle';
    ghostMesh = null;
    currentItemData = null;
    updateStatusText("浏览中");

    // 隐藏放置提示并移除监听
    const hint = document.getElementById('placement-hint');
    if (hint) hint.style.display = 'none';
    if (window._placementHintMoveHandler) {
        window.removeEventListener('mousemove', window._placementHintMoveHandler);
        window._placementHintMoveHandler = null;
    }

    // === [新增] 移动端：隐藏操作栏并恢复底部UI ===
    if (isMobile) {
        // 恢复相机控制
        if (inputManager) inputManager.enableControls();

        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) mobileControls.style.display = 'none';

        document.getElementById('shop-panel-container')?.classList.remove('hidden-in-edit-mode');
        document.getElementById('hud-bottom-bar')?.classList.remove('hidden-in-edit-mode');
    }
}
function cancelMove() {
    // [新增] 移动端：恢复相机控制
    if (isMobile && inputManager) inputManager.enableControls();

    if (mode === 'moving_old') {
        if (ghostMesh) scene.remove(ghostMesh);

        if (selectedObject) {
            selectedObject.position.copy(editingObjectOriginalPos);
            selectedObject.quaternion.copy(editingObjectOriginalQuat);
            selectedObject.visible = true;
        }

        // === [新增] 恢复跟随物 ===
        if (attachedItems.length > 0) {
            attachedItems.forEach(attach => {
                scene.remove(attach.ghostMesh);
                attach.realMesh.visible = true; // 原地复活
            });
            attachedItems = [];
        }
    }
    deselect(); mode = 'idle'; ghostMesh = null;
}

function showMenu(x, y) { const m = document.getElementById('context-menu'); m.style.display = 'flex'; let px = x + 10, py = y + 10; if (px + 100 > window.innerWidth) px = window.innerWidth - 110; if (py + 100 > window.innerHeight) py = window.innerHeight - 110; m.style.left = px + 'px'; m.style.top = py + 'px'; }
function hideContextMenu() { document.getElementById('context-menu').style.display = 'none'; }

function startMovingOld(m) {
    mode = 'moving_old';
    selectedObject = m; // 记录当前正在搬运的真身

    // [新增] 移动端：禁用相机旋转
    if (isMobile && inputManager) inputManager.disableControls();

    // 1. 隐藏真身
    m.visible = false;

    // 2. 初始化数据
    // 2. 初始化数据
    editingObjectOriginalPos = m.position.clone();
    editingObjectOriginalQuat = m.quaternion.clone();

    const dbItem = m.userData.parentClass ? m.userData.parentClass.dbItem : FURNITURE_DB[0];
    currentItemData = { ...dbItem }; // 浅拷贝，防止污染DB
    // [修复] 保留功能状态 (如碗里的猫粮)
    if (m.userData.parentClass && m.userData.parentClass.functionalState) {
        currentItemData.functionalState = m.userData.parentClass.functionalState;
    }

    currentRotation = m.rotation.y;

    // 3. 创建主体的虚影
    createGhost();
    createGhost();
    updateStatusText("正在移动...");

    // === [修复] 移动端：显示操作栏 ===
    if (isMobile) {
        const mobileControls = document.getElementById('mobile-controls');
        if (mobileControls) mobileControls.style.display = 'flex';

        document.getElementById('shop-panel-container')?.classList.add('hidden-in-edit-mode');
        document.getElementById('hud-bottom-bar')?.classList.add('hidden-in-edit-mode');

        // 立即检测一次碰撞，更新 ghost 颜色
        checkColl(currentItemData.type === 'wall');
    }

    // === [新增] 连带移动逻辑：寻找桌子上的东西 ===
    attachedItems = []; // 清空缓存

    // 只有移动 Layer 1 (桌子/柜子) 时才检测 Layer 2
    if (currentItemData.layer === 1) {
        const mainBox = new THREE.Box3().setFromObject(m);
        // 稍微缩小一点判定范围，防止误判边缘物体
        mainBox.expandByScalar(-0.1);
        // Y轴向上延伸，检测桌面上方
        mainBox.max.y += 2.0;

        placedFurniture.forEach(item => {
            // 排除自己
            if (item === m) return;

            // 只检测 Layer 2 (小物)
            const itemDb = item.userData.parentClass.dbItem;
            if (itemDb.layer !== 2) return;

            // 检测包含关系
            if (mainBox.containsPoint(item.position)) {
                // 找到了！
                // 1. 隐藏这个小物
                item.visible = false;

                // 2. 创建小物的虚影
                const smallGhost = prepareModel(itemDb);
                // 半透明材质
                smallGhost.traverse((c) => {
                    if (c.isMesh) {
                        c.material = c.material.clone();
                        c.material.transparent = true;
                        c.material.opacity = 0.5;
                    }
                });
                scene.add(smallGhost);

                // 3. 计算相对偏移量 (关键！)
                // 计算小物相对于桌子中心的偏移
                // 这一步必须用未旋转的坐标系来算，或者记录当前相对位置
                // 简单做法：记录 offset 向量
                const offset = item.position.clone().sub(m.position);

                // 4. 存入数组
                attachedItems.push({
                    realMesh: item,      // 真身
                    ghostMesh: smallGhost, // 虚影
                    offset: offset,      // 相对位置
                    initialRotation: item.rotation.y // 初始旋转
                });
            }
        });
    }
}


function deleteSelected() { if (!selectedObject) return; scene.remove(selectedObject); const i = placedFurniture.indexOf(selectedObject); if (i > -1) placedFurniture.splice(i, 1); deselect(); }

// === 替换 onMove (增加拖拽逻辑) ===
function onMove(e) {
    if (longPressTimer && !draggingCat) {
        // 如果移动距离过大，取消长按判定（防止误触）
        if (Math.hypot(e.clientX - startPointer.x, e.clientY - startPointer.y) > 5) {
            clearTimeout(longPressTimer); longPressTimer = null;
        }
    }
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1; pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

    // [新增] 猫咪拖拽逻辑
    if (draggingCat) {
        raycaster.setFromCamera(pointer, camera);
        // 射线检测：地板 + 所有家具 (让猫能被放在桌子/沙发上)
        const checkList = [floorPlane, ...placedFurniture];
        const hits = raycaster.intersectObjects(checkList, true);

        if (hits.length > 0) {
            const hit = hits[0];
            // 获取点击点的高度
            let targetY = hit.point.y;

            // [修复] 边界检查：限制猫咪在房间范围内 (-4 到 4)
            const clampedX = Math.max(-4, Math.min(4, hit.point.x));
            const clampedZ = Math.max(-4, Math.min(4, hit.point.z));

            draggingCat.mesh.position.set(clampedX, targetY, clampedZ);
        }
        return;
    }

    // ... 原有的家具移动逻辑 ...
    if ((mode === 'placing_new' || mode === 'moving_old') && ghostMesh) {
        raycaster.setFromCamera(pointer, camera);
        if (currentItemData.type === 'wall') {
            const hits = raycaster.intersectObjects(obstacles);
            if (hits.length > 0) {
                const h = hits[0]; const n = h.face.normal;
                if (Math.abs(n.y) > 0.5) return;

                // === 根据 wallFace 配置选择正确的 offset ===
                const wallFace = currentItemData.wallFace || 'back';
                let offsetDepth;
                switch (wallFace) {
                    case 'left': case '-x':
                    case 'right': case '+x':
                        // 左右贴墙时，用 size.x 作为贴墙深度
                        offsetDepth = currentItemData.size.x / 2;
                        break;
                    case 'front': case '-z':
                    case 'back': case '+z':
                    default:
                        // 前后贴墙时，用 size.z 作为贴墙深度
                        offsetDepth = currentItemData.size.z / 2;
                        break;
                }
                const offset = offsetDepth + 0.01;

                const pos = h.point.clone().add(n.clone().multiplyScalar(offset));
                if (Math.abs(n.x) > 0.5) { pos.y = Math.round(pos.y / 0.5) * 0.5; pos.z = Math.round(pos.z / 0.5) * 0.5; }
                else { pos.x = Math.round(pos.x / 0.5) * 0.5; pos.y = Math.round(pos.y / 0.5) * 0.5; }
                const hh = currentItemData.size.y / 2; if (pos.y < hh) pos.y = hh; if (pos.y + hh > 3) pos.y = 3 - hh;
                ghostMesh.position.copy(pos);
                ghostMesh.lookAt(pos.clone().add(n));

                // === 应用 wallFace 配置，调整贴墙朝向 ===
                let faceRotation = 0;
                switch (wallFace) {
                    case 'front': case '-z': faceRotation = Math.PI; break;       // 正面贴墙，需旋转180度
                    case 'left': case '-x': faceRotation = -Math.PI / 2; break;  // 左侧贴墙，需旋转-90度
                    case 'right': case '+x': faceRotation = Math.PI / 2; break;   // 右侧贴墙，需旋转90度
                    case 'back': case '+z': default: faceRotation = 0; break;    // 背面贴墙，默认不旋转
                }
                if (faceRotation !== 0) {
                    ghostMesh.rotateY(faceRotation);
                }

                checkColl(true);
            }
            return;
        }
        let onTable = false;
        if (currentItemData.layer === 2) {
            const surfaceMeshes = placedFurniture.filter(f => f.userData.parentClass && f.userData.parentClass.dbItem && f.userData.parentClass.dbItem.isSurface);
            const hits = raycaster.intersectObjects(surfaceMeshes, true);
            if (hits.length > 0) {
                const hit = hits[0]; let targetY = hit.point.y;
                if (hit.object.parent && hit.object.parent.userData.parentClass && hit.object.parent.userData.parentClass.dbItem.surfaceHeight) {
                    targetY = hit.object.parent.position.y + hit.object.parent.userData.parentClass.dbItem.surfaceHeight;
                }
                if (currentItemData.yFix) targetY += currentItemData.yFix;
                ghostMesh.position.set(hit.point.x, targetY, hit.point.z); ghostMesh.rotation.set(0, currentRotation, 0); checkColl(false); onTable = true;
            }
        }
        if (!onTable) {
            const hits = raycaster.intersectObject(floorPlane);
            if (hits.length > 0) {
                const p = hits[0].point; let targetY = 0; if (currentItemData.id.includes('rug')) targetY = 0.01;
                ghostMesh.position.set(Math.round(p.x / 0.5) * 0.5, targetY, Math.round(p.z / 0.5) * 0.5);
                ghostMesh.rotation.set(0, currentRotation, 0);
                checkColl(false);
                // === [新增] 更新跟随的小物虚影 ===
                if (attachedItems.length > 0) {
                    attachedItems.forEach(attach => {
                        // 1. 计算新的位置
                        // 偏移量需要根据主体的旋转进行"旋转变换"
                        // 计算旋转差值：当前角度 - 初始角度 (注意：这里初始角度其实是移动开始前物体的角度)
                        // 但 simpler approach: 直接应用 currentRotation 到 offset 向量

                        const rotatedOffset = attach.offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), currentRotation - editingObjectOriginalQuat.y);
                        // 注意：这里 rotate 的计算比较复杂，因为 Quaternion 转换。
                        // 简单方案：假设我们只做 90度 旋转。
                        // 实际上：offset 是基于世界坐标的。我们需要它跟随 ghostMesh 旋转。

                        // 正确做法：
                        // offset 是 (ItemPos - TablePos)。
                        // 当 Table 旋转了 (currentRotation - originalRotation) 后，Offset 也要旋转同样角度。
                        const rotDiff = currentRotation - selectedObject.rotation.y;
                        const finalOffset = attach.offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rotDiff);

                        attach.ghostMesh.position.copy(ghostMesh.position).add(finalOffset);

                        // 2. 更新旋转
                        // 小物的旋转 = 初始旋转 + 旋转差值
                        attach.ghostMesh.rotation.y = attach.initialRotation + rotDiff;
                    });
                }
            }
        }
    }
    // === [新增] 3D 对象悬浮提示 (仅在空闲状态且非移动端) ===
    if (mode === 'idle' && !isMobile && !draggingCat && !ghostMesh) {
        // UI 遮挡检测：如果在 Canvas 之外（InputManager传递的e.target），则不射线检测
        // 但是 InputManager.onPointerMove 传递的 e.target 可能是 Canvas 上方的 DIV
        // 所以检查 e.target.tagName
        if (e.target && e.target.tagName !== 'CANVAS') {
            // 鼠标在 UI 上，不显示 3D 提示 (但 Tooltip 可能由 UI 触发显示，所以不 hide)
            return;
        }

        raycaster.setFromCamera(pointer, camera);

        // 1. 检测猫咪
        const hitCats = raycaster.intersectObjects(cats.map(c => c.mesh), true);
        if (hitCats.length > 0) {
            Tooltip.show('🐈 抚摸猫咪');
            return;
        }

        // 2. 检测功能家具
        const hitFurn = raycaster.intersectObjects(placedFurniture, true);
        if (hitFurn.length > 0) {
            // 向上查找 parentGroup
            let obj = hitFurn[0].object;
            while (obj && !obj.userData.parentClass) {
                obj = obj.parent;
                if (!obj) break;
            }

            if (obj && obj.userData.parentClass) {
                const furn = obj.userData.parentClass;
                // 检查功能
                if (furn.dbItem.id === 'FoodBowl_Empty') {
                    Tooltip.show('🥣 点击添加猫粮 (-10❤)');
                    return;
                } else if (furn.dbItem.id === 'LitterBox_Full') {
                    Tooltip.show('🧹 点击清理猫砂');
                    return;
                }
            }
        }

        // 如果什么都没扫到，隐藏 Tooltip
        Tooltip.hide();
    }
}

function rotateItem() {
    currentRotation += Math.PI / 2;
    if (ghostMesh) {
        ghostMesh.rotation.y = currentRotation;

        // === [新增] 同步旋转跟随物 ===
        if (attachedItems.length > 0 && selectedObject) {
            const rotDiff = currentRotation - selectedObject.rotation.y;
            attachedItems.forEach(attach => {
                const finalOffset = attach.offset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rotDiff);
                attach.ghostMesh.position.copy(ghostMesh.position).add(finalOffset);
                attach.ghostMesh.rotation.y = attach.initialRotation + rotDiff;
            });
        }

        checkColl(false);
    }
}

// === 动画函数已迁移到 ./utils/AnimationUtils.js ===


function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const d = 8;

    camera.left = -d * aspect; camera.right = d * aspect; camera.top = d; camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);


    // [新增] 更新移轴 Shader 的屏幕尺寸
    resizePostProcessing(composer);

    // [新增] 更新天空 Shader 的分辨率
    if (weatherSystem && weatherSystem.skyMat) {
        // [修复] 使用 renderer.getDrawingBufferSize 或 domElement.width/height (物理像素)
        // 之前用 window.inner* (CSS像素) 导致在高分屏手机上 gl_FragCoord 超出了范围，天空变成霓虹色
        const pixelRatio = renderer.getPixelRatio();
        weatherSystem.skyMat.uniforms.resolution.value.set(
            window.innerWidth * pixelRatio,
            window.innerHeight * pixelRatio
        );

        // 同步更新窗户材质的分辨率
        weatherSystem.windowMaterials.forEach(mat => {
            if (mat && mat.uniforms && mat.uniforms.resolution) {
                mat.uniforms.resolution.value.copy(weatherSystem.skyMat.uniforms.resolution.value);
            }
        });
    }
    mat.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
}


function updateCameraMovement(dt) {
    if (!inputManager) return;
    const moveKeys = inputManager.moveKeys;
    if (!(moveKeys.w || moveKeys.a || moveKeys.s || moveKeys.d)) return;
    const moveSpeed = 10.0 * dt;
    const displacement = new THREE.Vector3();
    const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
    const right = new THREE.Vector3(); right.crossVectors(forward, camera.up).normalize();
    if (moveKeys.w) displacement.add(forward.multiplyScalar(moveSpeed));
    if (moveKeys.s) displacement.sub(forward.multiplyScalar(moveSpeed));
    if (moveKeys.d) displacement.add(right.multiplyScalar(moveSpeed));
    if (moveKeys.a) displacement.sub(right.multiplyScalar(moveSpeed));

    // 计算新的目标位置
    const newTargetX = controls.target.x + displacement.x;
    const newTargetZ = controls.target.z + displacement.z;
    const newTargetY = controls.target.y + displacement.y;

    // === WASD移动范围限制配置 ===
    const panOffset = -2;       // 初始中心点
    const maxOffsetX = 8;      // X轴最大偏移距离
    const maxOffsetZ = 8;      // Z轴最大偏移距离
    const minY = -5;            // 最低高度
    const maxY = 8;            // 最高高度

    // 限制焦点的移动范围
    const clampedTargetX = Math.max(panOffset - maxOffsetX, Math.min(panOffset + maxOffsetX, newTargetX));
    const clampedTargetZ = Math.max(panOffset - maxOffsetZ, Math.min(panOffset + maxOffsetZ, newTargetZ));
    const clampedTargetY = Math.max(minY, Math.min(maxY, newTargetY));

    // 计算实际可以移动的距离
    const actualDisplacement = new THREE.Vector3(
        clampedTargetX - controls.target.x,
        clampedTargetY - controls.target.y,
        clampedTargetZ - controls.target.z
    );

    // 应用位移
    camera.position.add(actualDisplacement);
    controls.target.add(actualDisplacement);
}

function animate() {
    requestAnimationFrame(animate);
    const dt = gameClock.getDelta();

    // 更新核心游戏逻辑（如果页面可见）
    if (!document.hidden) {
        updateGameLogic(dt);
    }

    // 更新渲染（只在页面可见时）
    updateCameraMovement(dt);
    controls.update();
    updateEnvironment(dt);
    if (selectionBox) selectionBox.update();

    // [新增] 更新照片系统（自动拍照检查）
    if (photoManager) photoManager.update();

    // [修改] 使用 composer 替代 renderer
    // renderer.render(scene, camera);  <-- 删掉或注释这行
    if (composer) composer.render();    // <-- 改用这行
    else renderer.render(scene, camera); // 降级兼容
}

// [新增] 核心游戏逻辑更新函数（可在后台调用）
function updateGameLogic(dt) {
    // 限制 dt 最大值，防止切换窗口后一帧更新过多
    dt = Math.min(dt, 0.1);

    cats.forEach(c => c.update(dt));

    // 更新家具逻辑 (扫地机器人)
    placedFurniture.forEach(mesh => {
        if (mesh.userData && mesh.userData.parentClass && typeof mesh.userData.parentClass.update === 'function') {
            mesh.userData.parentClass.update(dt);
        }
    });

    // 每帧检查天气（只会在日期变化时触发）
    if (weatherSystem) {
        weatherSystem.checkDailyWeather();
    }
}

// [新增] 后台更新机制：即使页面不可见，也持续更新游戏逻辑
let backgroundUpdateInterval = null;
let lastBackgroundUpdate = Date.now();

function startBackgroundUpdate() {
    if (backgroundUpdateInterval) return;

    lastBackgroundUpdate = Date.now();

    // 每 500ms 更新一次游戏逻辑
    backgroundUpdateInterval = setInterval(() => {
        const now = Date.now();
        const dt = (now - lastBackgroundUpdate) / 1000;
        lastBackgroundUpdate = now;

        // 只更新游戏逻辑，不渲染
        updateGameLogic(dt);
    }, 500);

    console.log('[Background] 后台更新已启动');
}

function stopBackgroundUpdate() {
    if (backgroundUpdateInterval) {
        clearInterval(backgroundUpdateInterval);
        backgroundUpdateInterval = null;
        console.log('[Background] 后台更新已停止');
    }
}

// [新增] 监听页面可见性变化
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // 页面隐藏，启动后台更新
        startBackgroundUpdate();
    } else {
        // 页面恢复可见，停止后台更新
        stopBackgroundUpdate();
        // 重置时钟，防止返回时出现巨大的 dt
        gameClock.getDelta();
    }
});

function startGame() {
    try {
        logToScreen("Initializing Renderer & Scene...");
        setDomText('heart-text-display', heartScore);
        window.switchCategory('furniture');

        renderer = new THREE.WebGLRenderer({
            antialias: false, // 关闭自带抗锯齿，我们将使用后期处理(SMAA)来抗锯齿，性能更好且兼容AO
            powerPreference: "high-performance",
            stencil: false,
            depth: true
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制像素比，防止高分屏卡顿

        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // 3. 色彩空间与色调映射 (关键！)
        renderer.outputColorSpace = THREE.SRGBColorSpace; // 确保纹理和光照颜色准确
        renderer.toneMapping = THREE.ACESFilmicToneMapping; // 电影级色调
        renderer.toneMappingExposure = 1.2; // 曝光度，配合光照强度调整

        document.body.appendChild(renderer.domElement);

        scene = new THREE.Scene();

        // [删除] 原来的 scene.background = skyColor; 
        // 我们不再用纯色背景了，改用 WeatherSystem
        // scene.background = new THREE.Color(0xe0f7fa); 

        // [新增] 初始化天候系统
        weatherSystem = new WeatherSystem(scene, updateStatusText);
        weatherSystem.updateSkyColor(visualHour, true);

        // [修复] 初始化时也需要设置正确的分辨率 (物理像素)
        //防止高分屏手机刚进游戏时天空颜色异常
        const pixelRatio = renderer.getPixelRatio();
        if (weatherSystem.skyMat) {
            weatherSystem.skyMat.uniforms.resolution.value.set(
                window.innerWidth * pixelRatio,
                window.innerHeight * pixelRatio
            );
        }

        // [新增] 将天气系统关联到日记管理器，并检查每日天气
        if (window.diaryManager) {
            window.diaryManager.weatherSystem = weatherSystem;
            weatherSystem.checkDailyWeather();
        }

        const aspect = window.innerWidth / window.innerHeight;
        // [修改] 将 d=12 改为 d=9 (数值越小，镜头越近)
        const d = 8;
        // [修复1] 调整相机剪裁面 (防止近处闪黑片)
        // near 改为 -100 (关键！允许渲染相机后方的物体，防止旋转时被切掉)
        // far 改为 1000 (足够远)
        camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, -100, 1000);

        // === [关键修改] 初始平移位置 ===
        // 这里的 -8 就是模拟你按住 W 键走了一段距离的效果
        // 数值越小(负数)：相机往"前"跑，房间看起来往"后/下"退
        // 数值越大(正数)：相机往"后"跑，房间看起来往"前/上"冲
        const panOffset = -2;


        // 相机位置也随之偏移 (保持 20,20,20 的相对角度)
        camera.position.set(20 + panOffset, 20, 20 + panOffset);

        // 重点：告诉控制器，我们要盯着新的中心点看，而不是 (0,0,0)
        camera.lookAt(panOffset, 0, panOffset);

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        // 限制垂直旋转角度
        controls.minPolarAngle = Math.PI / 8;   // 最高视角（不能太俯视）
        controls.maxPolarAngle = Math.PI / 2.1; // 最低视角（不能太平）

        // 限制水平旋转角度（以初始角度为中心，左右各60度）
        // 初始角度约为 0，所以范围是 -105度 到 15度
        const initialAzimuth = 0; // 初始方位角
        const azimuthRange = Math.PI / 3;     // 60度 = π/3
        controls.minAzimuthAngle = initialAzimuth; // 左转60度
        controls.maxAzimuthAngle = initialAzimuth + Math.PI / 2; // 右转60度

        // [关键] 设置控制器的默认焦点，否则它会自动弹回 (0,0,0)
        controls.target.set(panOffset, 0, panOffset);

        // [修复2] 限制缩放范围 (Zoom In / Zoom Out)
        // 1.0 是默认大小 (d=8)
        controls.enableZoom = true;
        controls.minZoom = 0.8; // 拉远上限：只能稍微拉远一点点，防止看到穿帮的黑色背景
        controls.maxZoom = 2.5; // 拉近上限：大概能看到猫咪全身特写，不再允许贴脸

        // === [新版 UI 适配] 绑定时间滑块与重置按钮 ===
        const hudSlider = document.getElementById('time-slider-hud'); // 新的ID
        const timeResetBtn = document.getElementById('time-reset-btn'); // 新的ID

        // 1. 滑块拖动：切换到手动模式
        if (hudSlider) {
            hudSlider.addEventListener('input', (e) => {
                isTimeAuto = false;
                visualHour = parseFloat(e.target.value);
                // 变灰，表示离开了自动模式
                if (timeResetBtn) timeResetBtn.style.color = '#999';
                // 即时更新天气系统
                if (weatherSystem) {
                    weatherSystem.setTimeInstant(visualHour);
                }
            });
        }

        // 2. 重置按钮点击：恢复自动模式
        if (timeResetBtn) {
            timeResetBtn.onclick = () => {
                isTimeAuto = true;
                // 变绿，表示正在同步
                timeResetBtn.style.color = '#2ecc71';
                updateStatusText("时间已同步现实");

                // 立即同步滑块位置，防止视觉跳变
                const now = new Date();
                const vH = now.getHours() + now.getMinutes() / 60.0;
                if (hudSlider) hudSlider.value = vH;
            };
        }

        // [新增] 日志调试函数的空壳 (防止报错)
        //window.debugGenDiary = function() { console.log("待实现: 生成日记"); updateStatusText("Debug: 生成日记 (待实现)"); };
        //window.debugClearDiary = function() { console.log("待实现: 清空日记"); updateStatusText("Debug: 清空日记 (待实现)"); };


        // === InputManager 初始化 ===
        inputManager = new InputManager(renderer, camera, controls);
        inputManager.setCallbacks({
            onPointerMove: (e, raycaster) => onMove(e),
            onPointerDown: (e, raycaster) => onDown(e),
            onPointerUp: (e) => onUp(e),
            onRightClick: (e) => {
                if (mode === 'placing_new') cancelPlace();
                else if (mode === 'moving_old') cancelMove();
                else deselect();
            },
            onRotateKey: () => {
                if (ghostMesh && currentItemData.type !== 'wall') rotateItem();
            },
            onCameraReset: () => {
                // [新增] 视角复位回调
                console.log("[Main] Resetting camera view");
                // 默认位置 (根据 initCamera 中的设置)
                // const panOffset = -2; // 已经在闭包中有这个变量了
                const targetPos = new THREE.Vector3(20 + panOffset, 20, 20 + panOffset);
                const targetLookAt = new THREE.Vector3(panOffset, 0, panOffset);

                // 使用 gsap 动画平滑复位 (这里简单直接设置)
                camera.position.copy(targetPos);
                controls.target.copy(targetLookAt);
                controls.update();

                updateStatusText("视角已复位");
                audioManager.playSfx('ui_click');
            }
        });
        inputManager.bind();

        // [新增] 初始化全局 Tooltip
        Tooltip.init();

        hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 2.0);
        scene.add(hemiLight);

        const al = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(al);

        // [修复] 阳光设置
        sunLight = new THREE.DirectionalLight(0xffdfba, 3.0);
        // 1. 初始位置：放得非常高、非常远，绝对不要让它进屋子
        sunLight.position.set(50, 50, 30);
        sunLight.castShadow = true;

        // 2. 提高分辨率：因为范围大了，分辨率也要跟上，否则锯齿严重
        sunLight.shadow.mapSize.width = 4096;
        sunLight.shadow.mapSize.height = 4096;

        // 3. 回归高质量 Bias：让阴影紧贴物体
        // 之前改成了 -0.001 导致悬空，现在改回细腻的参数
        sunLight.shadow.bias = -0.00005;
        sunLight.shadow.normalBias = 0.02;

        // 4. [核心修复] 扩大阴影盒子！
        // 把这个盒子做得足够大，让它的"黑边"跑到屏幕外面去
        const shadowDist = 50;
        sunLight.shadow.camera.left = -shadowDist;
        sunLight.shadow.camera.right = shadowDist;
        sunLight.shadow.camera.top = shadowDist;
        sunLight.shadow.camera.bottom = -shadowDist;

        // 5. 拉长视距
        sunLight.shadow.camera.near = 1;
        sunLight.shadow.camera.far = 200; // 照得更远

        scene.add(sunLight);

        raycaster = new THREE.Raycaster(); pointer = new THREE.Vector2();


        // [修复] 地板加厚 (BoxGeometry)
        // 宽度12，厚度2，深度12
        const floorThickness = 0.5;
        const fg = new THREE.BoxGeometry(12, floorThickness, 12);

        const fm = new THREE.MeshStandardMaterial({
            color: DEFAULT_DECOR.floor.color,
            roughness: 0.8,
            // Box 不太需要 polygonOffset，因为它的顶面和底面分得很开
        });

        floorPlane = new THREE.Mesh(fg, fm);

        // [关键] 计算位置，让顶面依然在 y = -0.05
        // Box 的原点在中心。所以中心 Y = 目标顶面高度 - (厚度 / 2)
        // -0.05 - 1.0 = -1.05
        floorPlane.position.y = -0.05 - (floorThickness / 2);

        floorPlane.receiveShadow = true;
        scene.add(floorPlane);

        //显示网格
        //const gh=new THREE.GridHelper(12,24,0xffffff,0xffffff); gh.position.y=0.01; gh.material.opacity=0.2; gh.material.transparent=true; scene.add(gh);

        const wm = new THREE.MeshStandardMaterial({ color: DEFAULT_DECOR.wall.color });
        // 后墙：宽10, 高3.2, 厚0.5
        const w1 = new THREE.Mesh(new THREE.BoxGeometry(10, 3.2, 0.5), wm);
        w1.position.set(0, 1.6, -5.25); // Y位置 = 高度/2 = 1.6
        w1.receiveShadow = true;
        w1.castShadow = true;
        scene.add(w1);
        obstacles.push(w1);

        // 左墙：厚0.5, 高3.2, 宽10
        const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.2, 10), wm);
        w2.position.set(-5.25, 1.6, 0); // Y位置 = 高度/2 = 1.6
        w2.receiveShadow = true;
        w2.castShadow = true;
        scene.add(w2);
        obstacles.push(w2);

        wallGroup = [w1, w2];

        logToScreen("Spawning Cat...");

        // === 初始化 GameContext（供模块化组件使用）===
        GameContext.init({
            scene,
            camera,
            renderer,
            floorPlane,
            loadedModels,
            placedFurniture,
            cats,
            audioManager,
            diaryManager,
            gameSaveManager,
            weatherSystem,
            CAT_CONFIG,
            FURNITURE_DB,
            DIARY_CONFIG,
            updateStatusText,
            showEmote,
            spawnHeart,
            logToScreen,
            showConfirmDialog
        });

        // [修复] 必须先定义 newCat 变量，下面恢复存档时才能用
        const newCat = new Cat(scene, 0xffa502);
        cats.push(newCat);

        // === [关键修改] 读取存档并恢复场景 ===
        const savedData = gameSaveManager.loadGame();

        if (savedData) {
            updateStatusText("检测到存档，正在恢复...");

            // 1. 恢复猫咪属性 (现在 newCat 存在了，就不会报错了)
            if (savedData.catStats) {
                newCat.stats.hunger = savedData.catStats.hunger;
                newCat.stats.toilet = savedData.catStats.toilet;
            }

            // 2. 恢复家具
            if (savedData.furniture && savedData.furniture.length > 0) {
                savedData.furniture.forEach(fData => {
                    // 查找数据库配置
                    // 注意：如果是 mystery_box，它不在 DB 里，需要特殊处理，或者我们在 DB 里加上 mystery_box 的定义
                    // 你的代码之前写了 const boxDbItem = { id: 'mystery_box'... }，这里我们简单处理，暂不恢复箱子，或者只恢复普通家具
                    // 为了简化，我们暂时只恢复 DB 里有的家具。箱子因为是随机生成的，丢了就丢了（或者你需要把 mystery_box 加入 FURNITURE_DB）

                    let itemConfig = FURNITURE_DB.find(i => i.id === fData.id);

                    // 特殊处理：如果是神秘箱子
                    if (fData.id === 'mystery_box') {
                        // 重新生成箱子比较麻烦，这里暂时跳过箱子的恢复，避免复杂
                        // 如果非常需要恢复箱子，需要把 spawnMysteryBox 逻辑拆分
                        return;
                    }

                    if (itemConfig) {
                        const modelGroup = prepareModel(itemConfig);
                        if (modelGroup) {
                            modelGroup.position.set(fData.pos.x, fData.pos.y, fData.pos.z);
                            modelGroup.rotation.y = fData.rot.y;

                            // 实例化类
                            const furnClass = new Furniture(modelGroup, itemConfig, furnitureCallbacks);

                            // 恢复功能状态 (满/空)
                            if (fData.funcState && furnClass.functionalState) {
                                furnClass.functionalState = fData.funcState;
                                furnClass.updateVisuals();
                            }

                            // 添加光照逻辑 (保持不变)
                            if (itemConfig.light) {
                                if (itemConfig.lightType === 'point') {
                                    const bulb = new THREE.PointLight(0xffaa00, 0.8, 5);
                                    let lx = 0, ly = 0.3, lz = 0;
                                    if (itemConfig.lightOffset) { lx = itemConfig.lightOffset.x || 0; ly = itemConfig.lightOffset.y || 0; lz = itemConfig.lightOffset.z || 0; }
                                    bulb.position.set(lx, ly, lz); bulb.castShadow = true; modelGroup.add(bulb);
                                } else {
                                    const sl = new THREE.SpotLight(0xfff0dd, 5); sl.position.set(0, 0, 0); sl.target.position.set(0, 0, 5); sl.angle = Math.PI / 3; sl.penumbra = 0.5; sl.castShadow = true; modelGroup.add(sl); modelGroup.add(sl.target);
                                }
                                if (itemConfig.type === 'wall') addSkyBacking(modelGroup, itemConfig.size);
                            }

                            // === [新增] 强制高度修正 (防止旧存档里的地毯陷地里) ===
                            // 如果是地毯(Layer 0)，且高度接近0（说明是旧数据），强制设为 0.02
                            if (itemConfig.layer === 0 && Math.abs(modelGroup.position.y) < 0.01) {
                                modelGroup.position.y = 0.02;
                            }
                            // =======================================================

                            scene.add(modelGroup); // <--- 这里是你截图里的 4115 行
                            placedFurniture.push(modelGroup);
                        }
                    }
                });
            }
        } else {
            updateStatusText("新游戏，无存档");
            // 只有在新游戏时，才需要特殊的初始化（如果以后有引导流程的话）
        }




        window.addEventListener('resize', onWindowResize);
        // 输入事件已由 InputManager 管理

        document.getElementById('btn-move').onclick = () => { if (selectedObject) startMovingOld(selectedObject); hideContextMenu(); }
        document.getElementById('btn-delete').onclick = () => { if (selectedObject) deleteSelected(); hideContextMenu(); }
        document.getElementById('btn-cancel').onclick = () => { deselect(); hideContextMenu(); }

        // === [新增] 移动端操作栏按钮事件绑定 ===
        if (isMobile) {
            document.getElementById('btn-mobile-cancel').onclick = () => {
                cancelPlace();
            };

            document.getElementById('btn-mobile-rotate').onclick = () => {
                if (ghostMesh && mode === 'placing_new') {
                    currentRotation += Math.PI / 2;
                    ghostMesh.rotation.y = currentRotation;
                }
            };

            document.getElementById('btn-mobile-confirm').onclick = () => {
                if (mode === 'placing_new' && canPlace && ghostMesh) {
                    confirmPlace();
                } else if (!canPlace) {
                    // 无法放置时给予反馈
                    updateStatusText("无法放置在此处");
                }
            };
        }

        // === [新增] 在 startGame 底部调用后期处理初始化 ===
        composer = initPostProcessing(renderer, scene, camera);

        // === [新增] 初始化照片系统 ===
        photoManager.init(renderer, scene, camera, cats);
        console.log("📷 照片系统已初始化");

        logToScreen("Game Loop Starting...");
        animate();
    } catch (e) {
        console.error(e);
        logToScreen("STARTGAME CRASH: " + e.message, 'error');
    }
}

// === [新增] 全局日记实例与交互函数 ===
// 注意：weatherSystem 在 startGame() 中初始化，所以这里先不传入
const diaryManager = new DiaryManager(DIARY_CONFIG, updateStatusText, null);
const photoManager = new PhotoManager();

// [新增] 关键修复：把实例挂载到 window，让 HTML 里的 onclick 能找到它
window.diaryManager = diaryManager;
window.photoManager = photoManager;

// === [新增] 每日登录奖励：第一次打开游戏 +50 爱心 ===
(function checkDailyLoginReward() {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    const lastRewardDate = localStorage.getItem('daily_reward_date');

    if (lastRewardDate !== todayKey) {
        localStorage.setItem('daily_reward_date', todayKey);
        // 延迟执行，等游戏完全加载后再加
        setTimeout(() => {
            updateMoney(50);
            console.log('[Daily] 每日登录奖励 +50 爱心');
        }, 3000);
    }
})();

// [修改] window.toggleDiary: 打开时触发 flushPendingEvents
// [修改] 日记开关逻辑：修正音效播放位置
window.toggleDiary = function () {
    const modal = document.getElementById('diary-modal');

    if (modal.classList.contains('hidden')) {
        // === 打开日记 ===
        modal.classList.remove('hidden');

        // 业务逻辑
        diaryManager.flushPendingEvents();
        diaryManager.viewingDate = new Date();
        diaryManager.renderPage();
        diaryManager.markAsRead(); // [修复] 使用新方法标记为已读

        // [修正] 播放打开音效
        audioManager.playSfx('ui_popup');
    } else {
        // === 关闭日记 ===
        modal.classList.add('hidden');

        // [修正] 播放关闭音效
        audioManager.playSfx('ui_close');
    }
};

// [修改] Debug生成日记：随机生成今天或昨天的日记，方便测试翻页
window.debugGenDiary = function () {
    const msgs = [
        "两脚兽今天一直在屏幕前发呆，真让人担心。",
        "刚刚那只蚊子飞得好慢，但我懒得动。",
        "想吃高级罐头，现在的猫粮口感一般。",
        "在沙发底下发现了一个丢失已久的瓶盖！",
        "又是无聊的一天，我想回喵星了。"
    ];
    const randomMsg = msgs[Math.floor(Math.random() * msgs.length)];

    // 50% 概率生成昨天的日记
    const isYesterday = Math.random() > 0.5;

    if (isYesterday) {
        // 模拟昨天的时间戳
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const key = diaryManager.formatDateKey(yesterday);

        // 手动写入昨天的 entry
        if (!diaryManager.entries[key]) diaryManager.entries[key] = { meta: diaryManager.generateDailyMeta(), events: [] };

        diaryManager.entries[key].events.push({
            id: Date.now(),
            time: "12:00",
            type: 'debug',
            text: "[昨天] " + randomMsg
        });
        diaryManager.save();
        updateStatusText("Debug: 已生成一条【昨天】的日记 (请翻页查看)");
    } else {
        // 生成今天的
        diaryManager.logEvent('debug_event', { item: randomMsg }, 50);
        updateStatusText("Debug: 已生成一条【今天】的日记");
    }

    // 刷新红点
    diaryManager.checkAndUpdateRedDot(); // [修复] 使用新方法检查红点状态
    // 如果日记开着，刷新页面
    const modal = document.getElementById('diary-modal');
    if (modal && !modal.classList.contains('hidden')) {
        diaryManager.renderPage();
    }
};
// debugClearDiary 保持不变

window.debugClearDiary = function () {
    diaryManager.clearAll();
    updateStatusText("日记已清空");
};

// [新增] UI 交互函数
window.toggleTimePopover = function () {
    const pop = document.getElementById('time-popover');
    if (pop) pop.classList.toggle('hidden');
};

// [新增] 调试：开关阳光阴影
window.toggleShadows = function () {
    if (sunLight) {
        sunLight.castShadow = !sunLight.castShadow;

        // 强制更新材质，确保渲染生效
        scene.traverse(c => {
            if (c.material) c.material.needsUpdate = true;
        });

        updateStatusText("阳光阴影: " + (sunLight.castShadow ? "开" : "关"));
    }
};

// [新增] GM指令：猫咪骑扫地机器人
window.debugRideRobot = function () {
    // 1. 找扫地机器人
    const robotMesh = placedFurniture.find(m =>
        m.userData.parentClass &&
        m.userData.parentClass.dbItem.id === 'RobotVacuum'
    );
    if (!robotMesh) {
        console.log("No Robot Vacuum found!");
        return;
    }
    const robot = robotMesh.userData.parentClass;

    // 2. 找一只猫
    if (cats.length === 0) return;
    const cat = cats[0];

    // 3. 绑定
    robot.rider = cat;
    cat.interactTarget = robotMesh; // 注意：Cat.js 里 interactTarget 是 mesh
    cat.targetFurniture = robotMesh;
    cat.state = 'riding';
    cat.ridingTimer = 30.0; // 骑 30 秒
    cat.playAction('idle');

    console.log("Cat is riding the robot!");
    updateStatusText("开启骑乘模式");
};



// [修改] 滚动条逻辑：支持双向绑定（滚动->动猫头，拖拽猫头->动滚动）
function setupCustomScrollbar() {
    const container = document.getElementById('items-scroll');
    const thumb = document.getElementById('custom-thumb');
    const track = document.getElementById('custom-scrollbar');

    if (!container || !thumb || !track) return;

    // === 1. 监听内容滚动 -> 移动猫头 ===
    container.onscroll = () => {
        // 如果正在被鼠标拖拽中，暂停监听滚动，防止逻辑打架抖动
        if (thumb.dataset.isDragging === 'true') return;

        updateThumbPosition();
    };

    function updateThumbPosition() {
        const scrollLeft = container.scrollLeft;
        const maxScrollLeft = container.scrollWidth - container.clientWidth;

        if (maxScrollLeft <= 0) {
            thumb.style.display = 'none';
            return;
        } else {
            thumb.style.display = 'block';
        }

        const ratio = scrollLeft / maxScrollLeft;
        const trackWidth = track.clientWidth;
        const thumbWidth = 50;
        const maxLeft = trackWidth - thumbWidth;

        thumb.style.transition = 'left 0.1s linear'; // 自动滚动时要顺滑
        thumb.style.left = (ratio * maxLeft) + 'px';
    }

    // === 2. 监听鼠标拖拽猫头 -> 滚动内容 ===
    thumb.onmousedown = function (e) {
        e.preventDefault(); // 防止选中文字
        thumb.dataset.isDragging = 'true';
        thumb.style.transition = 'none'; // 拖拽时要实时跟手，关掉动画
        thumb.style.cursor = 'grabbing';

        const startX = e.clientX;
        const startLeft = parseFloat(thumb.style.left || 0);
        const trackWidth = track.clientWidth;
        const thumbWidth = 50;
        const maxLeft = trackWidth - thumbWidth;
        const maxScrollLeft = container.scrollWidth - container.clientWidth;

        // 绑定全局移动事件
        document.onmousemove = function (moveEvent) {
            const deltaX = moveEvent.clientX - startX;
            let newLeft = startLeft + deltaX;

            // 限制范围
            if (newLeft < 0) newLeft = 0;
            if (newLeft > maxLeft) newLeft = maxLeft;

            // 移动滑块
            thumb.style.left = newLeft + 'px';

            // 反向计算：滑块位置 -> 滚动条百分比 -> 实际滚动位置
            const ratio = newLeft / maxLeft;
            container.scrollLeft = ratio * maxScrollLeft;
        };

        // 鼠标松开，取消监听
        document.onmouseup = function () {
            thumb.dataset.isDragging = 'false';
            thumb.style.cursor = 'grab';
            document.onmousemove = null;
            document.onmouseup = null;
        };
    };

    // === 3. 添加鼠标滚轮支持（提升滑动流畅度）===
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        // 增加滚动速度，让滑动更灵敏
        container.scrollLeft += e.deltaY * 2; // 乘以2让滚动更快
    }, { passive: false });

    // 设置初始鼠标样式
    thumb.style.cursor = 'grab';

    // 初始化一次
    updateThumbPosition();

    // === 4. [新增] 触摸事件支持（移动端拖拽滑块）===
    thumb.addEventListener('touchstart', function (e) {
        e.preventDefault();
        thumb.dataset.isDragging = 'true';
        thumb.style.transition = 'none';

        const touch = e.touches[0];
        const startX = touch.clientX;
        const startLeft = parseFloat(thumb.style.left || 0);
        const trackWidth = track.clientWidth;
        const thumbWidth = 50;
        const maxLeft = trackWidth - thumbWidth;
        const maxScrollLeft = container.scrollWidth - container.clientWidth;

        function onTouchMove(moveEvent) {
            const moveTouch = moveEvent.touches[0];
            const deltaX = moveTouch.clientX - startX;
            let newLeft = startLeft + deltaX;

            if (newLeft < 0) newLeft = 0;
            if (newLeft > maxLeft) newLeft = maxLeft;

            thumb.style.left = newLeft + 'px';
            const ratio = newLeft / maxLeft;
            container.scrollLeft = ratio * maxScrollLeft;
        }

        function onTouchEnd() {
            thumb.dataset.isDragging = 'false';
            document.removeEventListener('touchmove', onTouchMove);
            document.removeEventListener('touchend', onTouchEnd);
        }

        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    }, { passive: false });
}

window.toggleShop = function () {
    const shop = document.getElementById('shop-panel-container');

    if (shop.classList.contains('hidden-bottom')) {
        // === 打开逻辑 ===
        shop.classList.remove('hidden-bottom');

        // 播放打开音效
        audioManager.playSfx('ui_popup');

        // 初始化滚动条
        setTimeout(() => setupCustomScrollbar(), 50);
    } else {
        // === 关闭逻辑 ===
        shop.classList.add('hidden-bottom');

        // 播放关闭音效
        audioManager.playSfx('ui_close');
    }
};
// [新增] 存档导出：下载为 JSON 文件
window.exportSaveToFile = function () {
    const saveData = gameSaveManager.exportSave();
    if (!saveData) {
        alert('没有找到存档数据！');
        return;
    }

    // 生成下载文件
    const blob = new Blob([saveData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CatGame_Save_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    updateStatusText('存档已导出！');
};

// [新增] 存档导入：从文件上传
window.importSaveFromFile = function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const jsonString = event.target.result;
            if (gameSaveManager.importSave(jsonString)) {
                updateStatusText('存档导入成功！刷新页面以加载...');
                setTimeout(() => location.reload(), 1500);
            } else {
                alert('存档文件格式错误！');
            }
        };
        reader.readAsText(file);
    };
    input.click();
};




function init() { try { loadAssets(() => { updateStatusText("资源加载完毕"); const ls = document.getElementById('loading-screen'); if (ls) ls.style.display = 'none'; if (!scene) startGame(); }); } catch (e) { console.error(e); alert("Init Error: " + e.message); } }


// === GM 指令 ===
// 强制猫咪骑上扫地机器人
window.gmCatRide = function () {
    const catsLines = GameContext.cats || []; // Use GameContext.cats
    const robot = GameContext.placedFurniture.find(f => f.userData.parentClass && f.userData.parentClass.isVehicle);

    if (catsLines.length > 0 && robot) {
        const cat = catsLines[0]; // 默认操作第一只猫
        cat.interactTarget = robot;
        cat.targetFurniture = robot;
        cat.setPath(robot.position, 0.5);
        cat.state = 'walking';
        cat.nextAction = 'RIDE';
        console.log("GM: Cat commanded to ride robot.");
    } else {
        console.log("GM: Cat or Robot not found.");
    }
};

// [新增] GM 指令：显示所有隐藏的调试按钮
// 在控制台输入 showDebug() 即可
window.showDebug = function () {
    const btns = document.querySelectorAll('.debug-only');
    btns.forEach(btn => {
        btn.style.display = 'inline-block';
    });
    console.log("配置已启用：调试按钮已显示");
    updateStatusText("Debug模式已开启");
};

// === [新增] 游戏说明弹窗 ===
window.showManual = function () {
    let modal = document.getElementById('manual-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'manual-modal';
        modal.innerHTML = `
            <div id="manual-content">
                <button id="manual-close" onclick="document.getElementById('manual-modal').classList.remove('show')">&times;</button>
                <h2>📖 方寸喵居 - 玩家操作指南</h2>
                <h3>💻 电脑端 (PC)</h3>
                <p><b>视角控制：</b><br>
                旋转：按住鼠标左键拖动<br>
                平移：按住鼠标右键拖动，或 W/A/S/D<br>
                缩放：滚动鼠标滚轮<br>
                复位：按 H 键回到默认视角</p>
                <p><b>家具互动：</b><br>
                放置：从商店点击家具 → 移动鼠标 → 左键放置<br>
                旋转：点击鼠标中键，或按 R 键<br>
                取消：点击鼠标右键<br>
                移动：长按已放置家具 → 选择"移动"<br>
                删除：选中家具后点击删除按钮</p>
                <h3>📱 手机端 (Mobile)</h3>
                <p><b>视角控制：</b><br>
                旋转：单指拖动空白处<br>
                平移：双指同时拖动<br>
                缩放：双指捏合/张开<br>
                复位：点击屏幕 3 次回到默认视角</p>
                <p><b>家具互动：</b><br>
                放置：从商店拖拽家具到场景<br>
                旋转：点击旋转按钮<br>
                移动：长按家具 1 秒进入移动模式</p>
                <h3>❤️ 赚取爱心</h3>
                <p>抚摸猫咪 (+1) · 每日登录 (+50) · 猫咪使用家具</p>
                <h3>🐱 照顾猫咪</h3>
                <p>饥饿时猫咪会找<b>猫食盆</b>（点击补充，-10爱心）<br>
                如厕时猫咪会找<b>猫砂盆</b>（点击清理）</p>
                <h3>🏠 装修指南</h3>
                <p>商店在屏幕下方，分类：家具、小物、墙面家具、墙纸、地板、地毯<br>
                猫食盆和猫砂盆在<b>小物</b>分页</p>
                <h3>💾 存档</h3>
                <p>保存：点击右上"💾 保存"下载 .json 文件<br>
                读取：点击"📂 读取"导入文件<br>
                手机电脑可通过存档文件互传进度</p>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('show');
        });
    }
    modal.classList.add('show');
};

init();