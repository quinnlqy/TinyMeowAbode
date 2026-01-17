/**
 * InputManager.js - 统一输入管理
 * 处理鼠标、键盘、触摸输入，发送事件到游戏逻辑
 */

import * as THREE from 'three';

export class InputManager {
    constructor(renderer, camera, controls) {
        this.renderer = renderer;
        this.camera = camera;
        this.controls = controls;
        
        // 输入状态
        this.pointer = new THREE.Vector2();
        this.startPointer = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.moveKeys = { w: false, a: false, s: false, d: false };
        
        // 长按定时器
        this.longPressTimer = null;
        this.longPressDelay = 500;
        
        // 事件回调
        this.callbacks = {
            onPointerDown: null,
            onPointerUp: null,
            onPointerMove: null,
            onLongPress: null,
            onShortClick: null,
            onRightClick: null,
            onRotate: null
        };
        
        this._bindEvents();
    }
    
    /**
     * 设置回调
     */
    setCallbacks(callbacks) {
        Object.assign(this.callbacks, callbacks);
    }
    
    /**
     * 绑定 DOM 事件
     */
    _bindEvents() {
        const canvas = this.renderer.domElement;
        
        // 鼠标/触摸事件
        window.addEventListener('pointermove', this._onPointerMove.bind(this));
        window.addEventListener('pointerdown', this._onPointerDown.bind(this));
        window.addEventListener('pointerup', this._onPointerUp.bind(this));
        window.addEventListener('contextmenu', this._onContextMenu.bind(this));
        
        // 键盘事件
        window.addEventListener('keydown', this._onKeyDown.bind(this));
        window.addEventListener('keyup', this._onKeyUp.bind(this));
    }
    
    /**
     * 鼠标移动
     */
    _onPointerMove(e) {
        // 更新指针位置
        this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
        
        // 检测是否取消长按（移动距离过大）
        if (this.longPressTimer) {
            if (Math.hypot(e.clientX - this.startPointer.x, e.clientY - this.startPointer.y) > 5) {
                this._cancelLongPress();
            }
        }
        
        // 更新射线
        this.raycaster.setFromCamera(this.pointer, this.camera);
        
        // 触发回调
        if (this.callbacks.onPointerMove) {
            this.callbacks.onPointerMove(e, this.raycaster, this.pointer);
        }
    }
    
    /**
     * 鼠标按下
     */
    _onPointerDown(e) {
        if (e.target !== this.renderer.domElement) return;
        
        this.startPointer.x = e.clientX;
        this.startPointer.y = e.clientY;
        
        // 中键旋转
        if (e.button === 1) {
            e.preventDefault();
            if (this.callbacks.onRotate) {
                this.callbacks.onRotate();
            }
            return;
        }
        
        // 左键
        if (e.button === 0) {
            this.raycaster.setFromCamera(this.pointer, this.camera);
            
            // 启动长按检测
            this.longPressTimer = setTimeout(() => {
                this.longPressTimer = null;
                if (this.callbacks.onLongPress) {
                    this.callbacks.onLongPress(e, this.raycaster);
                }
            }, this.longPressDelay);
            
            if (this.callbacks.onPointerDown) {
                this.callbacks.onPointerDown(e, this.raycaster);
            }
        }
    }
    
    /**
     * 鼠标释放
     */
    _onPointerUp(e) {
        // 恢复视角控制
        this.controls.enabled = true;
        
        // 如果长按定时器还在，说明是短按
        if (this.longPressTimer) {
            this._cancelLongPress();
            this.raycaster.setFromCamera(this.pointer, this.camera);
            if (this.callbacks.onShortClick) {
                this.callbacks.onShortClick(e, this.raycaster);
            }
        }
        
        if (this.callbacks.onPointerUp) {
            this.callbacks.onPointerUp(e);
        }
    }
    
    /**
     * 右键菜单
     */
    _onContextMenu(e) {
        e.preventDefault();
        if (this.callbacks.onRightClick) {
            this.callbacks.onRightClick(e);
        }
    }
    
    /**
     * 键盘按下
     */
    _onKeyDown(e) {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
        
        const key = e.key.toLowerCase();
        
        // R 键旋转
        if (key === 'r') {
            if (this.callbacks.onRotate) {
                this.callbacks.onRotate();
            }
            return;
        }
        
        // WASD 移动
        switch (key) {
            case 'w': this.moveKeys.w = true; break;
            case 'a': this.moveKeys.a = true; break;
            case 's': this.moveKeys.s = true; break;
            case 'd': this.moveKeys.d = true; break;
        }
    }
    
    /**
     * 键盘释放
     */
    _onKeyUp(e) {
        const key = e.key.toLowerCase();
        switch (key) {
            case 'w': this.moveKeys.w = false; break;
            case 'a': this.moveKeys.a = false; break;
            case 's': this.moveKeys.s = false; break;
            case 'd': this.moveKeys.d = false; break;
        }
    }
    
    /**
     * 取消长按定时器
     */
    _cancelLongPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    }
    
    /**
     * 禁用视角控制（拖拽猫咪时）
     */
    disableControls() {
        this.controls.enabled = false;
    }
    
    /**
     * 更新相机移动
     */
    updateCameraMovement(dt) {
        if (!(this.moveKeys.w || this.moveKeys.a || this.moveKeys.s || this.moveKeys.d)) return;
        
        const moveSpeed = 10.0 * dt;
        const displacement = new THREE.Vector3();
        
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        
        const right = new THREE.Vector3();
        right.crossVectors(forward, this.camera.up).normalize();
        
        if (this.moveKeys.w) displacement.add(forward.clone().multiplyScalar(moveSpeed));
        if (this.moveKeys.s) displacement.sub(forward.clone().multiplyScalar(moveSpeed));
        if (this.moveKeys.d) displacement.add(right.clone().multiplyScalar(moveSpeed));
        if (this.moveKeys.a) displacement.sub(right.clone().multiplyScalar(moveSpeed));
        
        this.camera.position.add(displacement);
        this.controls.target.add(displacement);
    }
    
    /**
     * 获取射线
     */
    getRaycaster() {
        return this.raycaster;
    }
    
    /**
     * 获取指针位置
     */
    getPointer() {
        return this.pointer;
    }
}
