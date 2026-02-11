/**
 * PostProcessing.js - 后期处理效果管理
 * 包含 SSAO、Bloom、移轴、抗锯齿等效果
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CustomTiltShiftShader } from '../shaders/TiltShiftShader.js';

/**
 * 初始化后期处理管线
 * @param {THREE.WebGLRenderer} renderer - 渲染器
 * @param {THREE.Scene} scene - 场景
 * @param {THREE.Camera} camera - 相机
 * @returns {EffectComposer} - 后期处理合成器
 */
export function initPostProcessing(renderer, scene, camera) {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const composer = new EffectComposer(renderer);

    // 1. 基础场景渲染
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // 检测移动端
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

    // 2. SSAO (环境光遮蔽) - 仅PC端启用（性能消耗极大）
    if (!isMobile) {
        const saoPass = new SAOPass(scene, camera, false, true);
        saoPass.params.output = 0;
        saoPass.params.saoBias = 0.5;
        saoPass.params.saoIntensity = 0.05;
        saoPass.params.saoScale = 100;
        saoPass.params.saoKernelRadius = 30;
        composer.addPass(saoPass);

        // 3. Bloom (辉光) - 仅PC端启用（多重全屏Buffer消耗显存）
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.5, 0.4, 0.85);
        bloomPass.threshold = 0.95;
        bloomPass.strength = 0.15;
        bloomPass.radius = 0.5;
        composer.addPass(bloomPass);
    }

    // 4. 移轴效果 (TiltShift) - 仅PC端启用（81次全屏纹理采样，手机GPU扛不住）
    if (!isMobile) {
        const tiltShiftPass = new ShaderPass(CustomTiltShiftShader);
        tiltShiftPass.uniforms['blurradius'].value = 3.0;
        tiltShiftPass.uniforms['focus'].value = 0.5;
        tiltShiftPass.uniforms['aspect'].value = width / height;
        composer.addPass(tiltShiftPass);
    }

    // 5. SMAA (抗锯齿) - 仅PC端启用（手机高像素密度不需要额外抗锯齿）
    if (!isMobile) {
        const smaaPass = new SMAAPass(width, height);
        composer.addPass(smaaPass);
    }

    // 6. Output (色彩输出)
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    return composer;
}

/**
 * 窗口大小改变时更新后期处理
 * @param {EffectComposer} composer - 后期处理合成器
 */
export function resizePostProcessing(composer) {
    if (!composer) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    composer.setSize(width, height);
    composer.passes.forEach(pass => {
        if (pass.uniforms && pass.uniforms['aspect']) {
            pass.uniforms['aspect'].value = width / height;
        }
    });
}
