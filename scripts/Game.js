/**
 * 主游戏类 - 游戏初始化和主循环
 * @module Game
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { gameState, RENDER_CONFIG, DEFAULT_DECOR } from './core/index.js';
import { TiltShiftShader } from './core/Shaders.js';
import { audioManager, saveManager, diaryManager } from './managers/index.js';
import { Cat, WeatherSystem } from './systems/index.js';
import { FURNITURE_DB, getFurnitureById, getFurnitureByCategory } from './data/FurnitureDB.js';
import { setDomText, updateStatusText, sanitizeMaterial, showConfirmDialog } from './utils/helpers.js';

export class Game {
    constructor() {
        this.gltfLoader = new GLTFLoader();
        this.weatherSystem = null;
        this.composer = null;
        this.isRunning = false;
    }

    /**
     * 初始化游戏
     */
    async init() {
        updateStatusText("游戏初始化中...");
        
        // 加载资源
        await this.loadAssets();
        
        // 初始化渲染器
        this.initRenderer();
        
        // 初始化场景
        this.initScene();
        
        // 初始化后期处理
        this.initPostProcessing();
        
        // 初始化UI
        this.initUI();
        
        // 绑定事件
        this.bindEvents();
        
        // 加载存档
        this.loadSaveData();
        
        // 开始游戏循环
        this.start();
    }

    /**
     * 加载游戏资源
     */
    async loadAssets() {
        const files = [];
        files.push({ key: 'cat', path: './assets/models/cat.glb' });
        files.push({ key: 'box', path: './assets/models/cardboardBoxOpen.glb' });
        
        FURNITURE_DB.forEach(item => {
            if (item.modelFile) {
                files.push({ key: item.id, path: './assets/models/' + item.modelFile });
            }
            if (item.fullModelFile) {
                files.push({ key: item.fullModelFile, path: './assets/models/' + item.fullModelFile });
            }
        });

        const progressFill = document.getElementById('progress-fill');
        let loaded = 0;

        updateStatusText(`开始加载 ${files.length} 个资源...`);

        const loadPromises = files.map(file => {
            return new Promise((resolve) => {
                this.gltfLoader.load(
                    file.path,
                    (gltf) => {
                        gltf.scene.traverse(sanitizeMaterial);
                        gameState.loadedModels[file.key] = {
                            scene: gltf.scene,
                            animations: gltf.animations
                        };
                        loaded++;
                        if (progressFill) {
                            progressFill.style.width = `${Math.floor((loaded / files.length) * 100)}%`;
                        }
                        resolve();
                    },
                    undefined,
                    (err) => {
                        console.warn("Missing asset:", file.path);
                        loaded++;
                        resolve();
                    }
                );
            });
        });

        await Promise.all(loadPromises);
        updateStatusText("资源加载完毕");
        
        // 隐藏加载界面
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            setTimeout(() => loadingScreen.style.display = 'none', 500);
        }
    }

    /**
     * 初始化渲染器
     */
    initRenderer() {
        const renderer = new THREE.WebGLRenderer({
            antialias: false,
            powerPreference: "high-performance",
            stencil: false,
            depth: true
        });
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, RENDER_CONFIG.pixelRatioMax));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = RENDER_CONFIG.exposure;
        
        document.body.appendChild(renderer.domElement);
        gameState.renderer = renderer;
    }

    /**
     * 初始化场景
     */
    initScene() {
        const scene = new THREE.Scene();
        gameState.scene = scene;

        // 相机
        const aspect = window.innerWidth / window.innerHeight;
        const d = RENDER_CONFIG.cameraDistance;
        const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 0.1, 1000);
        camera.position.set(15, 15, 15);
        camera.lookAt(0, 0, 0);
        gameState.camera = camera;

        // 控制器
        const controls = new OrbitControls(camera, gameState.renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.maxPolarAngle = Math.PI / 2.2;
        controls.minPolarAngle = Math.PI / 6;
        controls.target.set(0, RENDER_CONFIG.panOffset, 0);
        gameState.controls = controls;

        // 光照
        this.initLighting();

        // 地面
        this.initGround();

        // 墙壁
        this.initWalls();

        // 天气系统
        this.weatherSystem = new WeatherSystem(scene);

        // 生成猫咪
        const cat = new Cat(scene);
        gameState.cats.push(cat);
    }

    /**
     * 初始化光照
     */
    initLighting() {
        const scene = gameState.scene;

        // 半球光
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        scene.add(hemiLight);
        gameState.hemiLight = hemiLight;

        // 太阳光
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
        sunLight.position.set(10, 20, 10);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = RENDER_CONFIG.shadowMapSize;
        sunLight.shadow.mapSize.height = RENDER_CONFIG.shadowMapSize;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 50;
        sunLight.shadow.camera.left = -20;
        sunLight.shadow.camera.right = 20;
        sunLight.shadow.camera.top = 20;
        sunLight.shadow.camera.bottom = -20;
        sunLight.shadow.bias = -0.0005;
        sunLight.shadow.normalBias = 0.05;
        scene.add(sunLight);
        gameState.sunLight = sunLight;
    }

    /**
     * 初始化地面
     */
    initGround() {
        const floorGeo = new THREE.PlaneGeometry(20, 20);
        const floorMat = new THREE.MeshStandardMaterial({
            color: DEFAULT_DECOR.floor.color,
            roughness: 0.8
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        floor.name = 'floor';
        gameState.scene.add(floor);
        gameState.floorPlane = floor;
    }

    /**
     * 初始化墙壁
     */
    initWalls() {
        const wallMat = new THREE.MeshStandardMaterial({
            color: DEFAULT_DECOR.wall.color,
            roughness: 0.9,
            side: THREE.DoubleSide
        });

        // 后墙
        const backWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 8), wallMat);
        backWall.position.set(0, 4, -10);
        backWall.receiveShadow = true;
        gameState.scene.add(backWall);
        gameState.wallGroup.push(backWall);

        // 左墙
        const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(20, 8), wallMat.clone());
        leftWall.position.set(-10, 4, 0);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.receiveShadow = true;
        gameState.scene.add(leftWall);
        gameState.wallGroup.push(leftWall);
    }

    /**
     * 初始化后期处理
     */
    initPostProcessing() {
        const { renderer, scene, camera } = gameState;
        
        this.composer = new EffectComposer(renderer);
        
        // 渲染通道
        const renderPass = new RenderPass(scene, camera);
        this.composer.addPass(renderPass);

        // Bloom
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.15, 0.95, 0.9
        );
        this.composer.addPass(bloomPass);

        // SMAA 抗锯齿
        const smaaPass = new SMAAPass(window.innerWidth, window.innerHeight);
        this.composer.addPass(smaaPass);

        // 移轴模糊
        const tiltShiftPass = new ShaderPass(TiltShiftShader);
        tiltShiftPass.uniforms['aspect'].value = window.innerWidth / window.innerHeight;
        this.composer.addPass(tiltShiftPass);

        // 输出
        const outputPass = new OutputPass();
        this.composer.addPass(outputPass);

        gameState.composer = this.composer;
    }

    /**
     * 初始化UI
     */
    initUI() {
        setDomText('heart-text-display', gameState.heartScore);
        
        // 初始化商店
        if (typeof window.switchCategory === 'function') {
            window.switchCategory('floor');
        }
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        window.addEventListener('resize', () => this.onResize());
        window.addEventListener('click', () => audioManager.unlockAudio(), { once: true });
        
        // 键盘控制
        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key in gameState.moveKeys) {
                gameState.moveKeys[key] = true;
            }
        });
        
        window.addEventListener('keyup', (e) => {
            const key = e.key.toLowerCase();
            if (key in gameState.moveKeys) {
                gameState.moveKeys[key] = false;
            }
        });
    }

    /**
     * 加载存档
     */
    loadSaveData() {
        const data = saveManager.loadGame();
        if (data) {
            // 恢复金钱
            if (data.heartScore !== undefined) {
                gameState.heartScore = data.heartScore;
                setDomText('heart-text-display', gameState.heartScore);
            }
            
            // 恢复装修
            if (data.activeDecor) {
                gameState.activeDecorId = data.activeDecor;
            }
            
            updateStatusText("存档加载成功");
        } else {
            updateStatusText("新游戏，无存档");
        }
    }

    /**
     * 窗口大小改变
     */
    onResize() {
        const aspect = window.innerWidth / window.innerHeight;
        const d = RENDER_CONFIG.cameraDistance;
        
        gameState.camera.left = -d * aspect;
        gameState.camera.right = d * aspect;
        gameState.camera.top = d;
        gameState.camera.bottom = -d;
        gameState.camera.updateProjectionMatrix();
        
        gameState.renderer.setSize(window.innerWidth, window.innerHeight);
        
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
        
        if (this.weatherSystem && this.weatherSystem.skyMat) {
            this.weatherSystem.skyMat.uniforms.resolution.value.set(
                window.innerWidth, 
                window.innerHeight
            );
        }
    }

    /**
     * 开始游戏循环
     */
    start() {
        this.isRunning = true;
        updateStatusText("游戏循环启动");
        this.animate();
    }

    /**
     * 暂停游戏
     */
    pause() {
        this.isRunning = false;
    }

    /**
     * 主循环
     */
    animate() {
        if (!this.isRunning) return;
        
        requestAnimationFrame(() => this.animate());
        
        const dt = gameState.gameClock.getDelta();
        
        // 更新控制器
        gameState.controls.update();
        
        // 更新相机移动
        this.updateCameraMovement(dt);
        
        // 更新环境
        this.updateEnvironment(dt);
        
        // 更新猫咪
        gameState.cats.forEach(cat => cat.update(dt));
        
        // 渲染
        if (this.composer) {
            this.composer.render();
        } else {
            gameState.renderer.render(gameState.scene, gameState.camera);
        }
    }

    /**
     * 更新相机移动
     */
    updateCameraMovement(dt) {
        const { moveKeys, camera, controls } = gameState;
        
        if (!(moveKeys.w || moveKeys.a || moveKeys.s || moveKeys.d)) return;
        
        const moveSpeed = 10.0 * dt;
        const displacement = new THREE.Vector3();
        
        const forward = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        
        const right = new THREE.Vector3();
        right.crossVectors(forward, camera.up).normalize();
        
        if (moveKeys.w) displacement.add(forward.clone().multiplyScalar(moveSpeed));
        if (moveKeys.s) displacement.sub(forward.clone().multiplyScalar(moveSpeed));
        if (moveKeys.d) displacement.add(right.clone().multiplyScalar(moveSpeed));
        if (moveKeys.a) displacement.sub(right.clone().multiplyScalar(moveSpeed));
        
        camera.position.add(displacement);
        controls.target.add(displacement);
    }

    /**
     * 更新环境 (时间、天气)
     */
    updateEnvironment(dt) {
        // 更新视觉时间
        if (gameState.isTimeAuto) {
            const now = new Date();
            gameState.visualHour = now.getHours() + now.getMinutes() / 60;
        }
        
        // 更新天空颜色
        if (this.weatherSystem) {
            this.weatherSystem.updateSkyColor(gameState.visualHour);
            this.weatherSystem.update(dt);
        }
        
        // 更新时间显示
        const hour = Math.floor(gameState.visualHour);
        const minute = Math.floor((gameState.visualHour % 1) * 60);
        const isPM = hour >= 12;
        const displayHour = hour % 12 || 12;
        
        setDomText('time-text-display', `${displayHour}:${String(minute).padStart(2, '0')}`);
        setDomText('time-ampm', isPM ? 'PM' : 'AM');
    }
}

export default Game;
