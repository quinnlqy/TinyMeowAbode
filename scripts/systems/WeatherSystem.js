/**
 * WeatherSystem - 天气系统
 * 管理天空、云朵、极光、雨雪等天气效果
 */
import * as THREE from 'three';

// === 天空 Shader ===
export const SkyShader = {
    vertex: `
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec4 vScreenPos;
        void main() {
            vUv = uv;
            vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
            vWorldPosition = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
            vScreenPos = gl_Position;
        }
    `,
    fragment: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float starOpacity;
        uniform vec2 resolution;
        
        varying vec2 vUv;
        varying vec3 vWorldPosition;
        varying vec4 vScreenPos;

        float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
        }

        void main() {
            float h = gl_FragCoord.y / resolution.y;
            vec3 bg = mix(bottomColor, topColor, h);
            
            if (starOpacity > 0.0) {
                vec2 st = vWorldPosition.xz * 0.05; 
                vec2 ipos = floor(st);
                
                float rnd = random(ipos);
                if (rnd > 0.97) { 
                    float brightness = random(ipos + 1.0);
                    float shine = sin(gl_FragCoord.x * 5.0 + brightness * 10.0) * 0.5 + 0.5;
                    bg += vec3(starOpacity * shine * brightness);
                }
            }
            gl_FragColor = vec4(bg, 1.0);
        }
    `
};

// === 极光 Shader ===
export const AuroraShader = {
    vertex: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragment: `
        uniform float time;
        varying vec2 vUv;
        void main() {
            float alpha = sin(vUv.x * 10.0 + time) * 0.5 + 0.5;
            alpha *= sin(vUv.x * 5.0 - time * 0.5) * 0.5 + 0.5;
            alpha *= smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
            
            vec3 color = mix(vec3(0.0, 1.0, 0.8), vec3(0.5, 0.0, 1.0), vUv.x);
            gl_FragColor = vec4(color, alpha * 0.4);
        }
    `
};

// === 动态生成粒子贴图 (雨/雪) ===
export function createParticleTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    if (type === 'snow') {
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);
    } else if (type === 'rain') {
        ctx.fillStyle = 'rgba(200, 220, 255, 1.0)';
        ctx.fillRect(12, 0, 8, 32);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

// === 天气系统类 ===
export class WeatherSystem {
    constructor(scene, statusCallback = null) {
        this.scene = scene;
        this.statusCallback = statusCallback; // 用于更新状态文字
        this.dome = null;
        this.skyMat = null;

        this.aurora = null;
        this.clouds = [];
        this.rainSystem = null;
        this.snowSystem = null;
        
        this.windowMaterials = [];
        this.currentWeather = 'clear'; 

        this.initSky();
        this.initAurora();
        this.initClouds();
        this.initPrecipitation();
    }
    
    initSky() {
        const geo = new THREE.SphereGeometry(400, 32, 15);
        
        this.skyMat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x0077ff) },
                bottomColor: { value: new THREE.Color(0xffffff) },
                starOpacity: { value: 0.0 },
                resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
            },
            vertexShader: SkyShader.vertex,
            fragmentShader: SkyShader.fragment,
            side: THREE.BackSide,
            depthWrite: false
        });

        this.dome = new THREE.Mesh(geo, this.skyMat);
        this.dome.renderOrder = -1;
        this.scene.add(this.dome);
    }

    initAurora() {
        const geo = new THREE.CylinderGeometry(200, 200, 50, 32, 1, true, 0, Math.PI);
        geo.rotateZ(Math.PI / 8);
        geo.translate(0, 100, -200);
        
        const mat = new THREE.ShaderMaterial({
            uniforms: { time: { value: 0 } },
            vertexShader: AuroraShader.vertex,
            fragmentShader: AuroraShader.fragment,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        this.aurora = new THREE.Mesh(geo, mat);
        this.aurora.visible = false;
        this.scene.add(this.aurora);
    }
    
    initClouds() {
        const cloudGeo = new THREE.SphereGeometry(1, 12, 12);
        const cloudMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff, 
            flatShading: true, 
            opacity: 0.8, 
            transparent: true,
            depthWrite: false 
        });

        const directions = [
            { name: 'back', axis: 'x', minX: -25, maxX: 20, baseZ: -25, moveDir: 1 },
            { name: 'front', axis: 'x', minX: -25, maxX: 20, baseZ: 15, moveDir: -1 },
            { name: 'left', axis: 'z', minZ: -30, maxZ: 20, baseX: -25, moveDir: 1 },
            { name: 'right', axis: 'z', minZ: -30, maxZ: 20, baseX: 20, moveDir: -1 }
        ];

        directions.forEach(dir => {
            for(let i=0; i<3; i++) {
                const cloudGroup = new THREE.Group();
                
                for(let j=0; j<3+Math.random()*2; j++) {
                    const mesh = new THREE.Mesh(cloudGeo, cloudMat.clone());
                    mesh.position.set(Math.random()*2-1, Math.random()*1-0.5, Math.random()*1-0.5);
                    mesh.scale.setScalar(0.8 + Math.random() * 0.5);
                    cloudGroup.add(mesh);
                }
                
                cloudGroup.scale.setScalar(1.0);

                if (dir.axis === 'x') {
                    cloudGroup.userData = {
                        axis: 'x',
                        speed: 1.5 + Math.random() * 1.5,
                        direction: dir.moveDir,
                        minX: dir.minX,
                        maxX: dir.maxX,
                        baseY: -10 + Math.random() * 1,
                        baseZ: dir.baseZ
                    };
                    cloudGroup.position.set(
                        dir.minX + Math.random() * (dir.maxX - dir.minX),
                        cloudGroup.userData.baseY,
                        dir.baseZ
                    );
                } else {
                    cloudGroup.userData = {
                        axis: 'z',
                        speed: 1.5 + Math.random() * 1.5,
                        direction: dir.moveDir,
                        minZ: dir.minZ,
                        maxZ: dir.maxZ,
                        baseY: -10 + Math.random() * 1,
                        baseX: dir.baseX
                    };
                    cloudGroup.position.set(
                        dir.baseX,
                        cloudGroup.userData.baseY,
                        dir.minZ + Math.random() * (dir.maxZ - dir.minZ)
                    );
                }
                
                this.scene.add(cloudGroup);
                this.clouds.push(cloudGroup);
            }
        });
    }
    
    initPrecipitation() {
        const count = 2000;
        const geo = new THREE.BufferGeometry();
        const pos = [];
        
        for(let i=0; i<count; i++) {
            pos.push(
                (Math.random()-0.5)*100, 
                Math.random()*60,       
                (Math.random()-0.5)*100
            );
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        
        this.rainMat = new THREE.PointsMaterial({
            color: 0xddddff,
            size: 8.0,
            map: createParticleTexture('rain'), 
            transparent: true, 
            opacity: 0.8,
            depthWrite: false, 
            blending: THREE.AdditiveBlending
        });
        
        this.snowMat = new THREE.PointsMaterial({
            color: 0xffffff, 
            size: 20.0,
            map: createParticleTexture('snow'), 
            transparent: true, 
            opacity: 0.9,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.precipSystem = new THREE.Points(geo, this.rainMat);
        this.precipSystem.visible = false; 
        this.precipSystem.renderOrder = 2; 
        
        this.scene.add(this.precipSystem);
    }
    
    setWeather(type) {
        this.currentWeather = type;
        if (type === 'clear') {
            this.precipSystem.visible = false;
        } else {
            this.precipSystem.visible = true;
            this.precipSystem.material = (type === 'snow') ? this.snowMat : this.rainMat;
        }
        if (this.statusCallback) {
            this.statusCallback("天气变成了: " + type);
        }
    }

    update(dt, hour) {
        this.updateSkyColor(hour);

        let targetStarOpacity = 0;
        if (hour >= 19 || hour <= 5) targetStarOpacity = 1.0;
        
        const currentOp = this.skyMat.uniforms.starOpacity.value;
        const newOp = currentOp + (targetStarOpacity - currentOp) * dt * 0.5;
        
        this.skyMat.uniforms.starOpacity.value = newOp;

        this.windowMaterials.forEach(mat => {
            if (mat && mat.uniforms && mat.uniforms.starOpacity && mat.uniforms.resolution) {
                mat.uniforms.starOpacity.value = newOp;
                mat.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
            }
        });

        if (hour > 22 || hour < 3) {
            this.aurora.visible = true;
            this.aurora.material.uniforms.time.value += dt * 0.5;
            if(this.aurora.material.opacity < 1) this.aurora.material.opacity += dt * 0.5;
        } else {
            this.aurora.visible = false;
        }

        this.clouds.forEach(c => {
            if (c.userData.axis === 'x') {
                c.position.x += c.userData.speed * c.userData.direction * dt;
                
                if (c.position.x > c.userData.maxX) {
                    c.position.x = c.userData.minX;
                } else if (c.position.x < c.userData.minX) {
                    c.position.x = c.userData.maxX;
                }
            } else {
                c.position.z += c.userData.speed * c.userData.direction * dt;
                
                if (c.position.z > c.userData.maxZ) {
                    c.position.z = c.userData.minZ;
                } else if (c.position.z < c.userData.minZ) {
                    c.position.z = c.userData.maxZ;
                }
            }
            
            let cloudColor = 0xffffff;
            if (hour >= 5 && hour < 9) { 
                cloudColor = 0xffcba4;
            } else if (hour >= 9 && hour < 17) { 
                cloudColor = 0xffffff;
            } else if (hour >= 17 && hour < 20) { 
                cloudColor = 0xffa07a;
            } else { 
                cloudColor = 0x4a5568;
            }
            
            c.children.forEach(m => {
                if (m.material && m.material.color) {
                    m.material.color.lerp(new THREE.Color(cloudColor), dt * 0.5);
                }
            });
        });

        if (this.currentWeather !== 'clear' && this.precipSystem.visible) {
            const positions = this.precipSystem.geometry.attributes.position.array;
            const isRain = (this.currentWeather === 'rain');
            
            const speed = isRain ? 12 : 0.8; 
            
            const time = Date.now() * 0.001;

            for(let i=0; i<positions.length; i+=3) {
                positions[i+1] -= speed * dt;
                
                if (!isRain) {
                    positions[i] += Math.sin(time + positions[i+1] * 0.1) * 0.05 * dt; 
                }

                if (positions[i+1] < -5) {
                    positions[i+1] = 50;
                }
            }
            this.precipSystem.geometry.attributes.position.needsUpdate = true;
            
            if(isRain) {
                this.clouds.forEach(c => c.children.forEach(m => m.material.color.setHex(0x888888)));
            } else {
                this.clouds.forEach(c => c.children.forEach(m => m.material.color.setHex(0xffffff)));
            }
        }
    }
    
    updateSkyColor(hour, isInstant = false) { 
        const dawnTop = new THREE.Color(0x607d8b);
        const dawnBot = new THREE.Color(0xffe0b2);
        
        const dayTop = new THREE.Color(0x4fc3f7); 
        const dayBot = new THREE.Color(0xffffff); 
        
        const duskTop = new THREE.Color(0x2c3e50);
        const duskBot = new THREE.Color(0xffcc80);
        
        const nightTop = new THREE.Color(0x0a0a12); 
        const nightBot = new THREE.Color(0x1a237e);

        let t = this.skyMat.uniforms.topColor.value;
        let b = this.skyMat.uniforms.bottomColor.value;
        
        const lerpFactor = isInstant ? 1.0 : 0.01;

        if (hour >= 5 && hour < 9) { 
            t.lerp(dawnTop, lerpFactor); b.lerp(dawnBot, lerpFactor);
        } else if (hour >= 9 && hour < 17) { 
            t.lerp(dayTop, lerpFactor); b.lerp(dayBot, lerpFactor);
        } else if (hour >= 17 && hour < 20) { 
            t.lerp(duskTop, lerpFactor); b.lerp(duskBot, lerpFactor);
        } else { 
            t.lerp(nightTop, lerpFactor); b.lerp(nightBot, lerpFactor);
        }

        this.windowMaterials.forEach(mat => {
            if(mat && mat.uniforms && mat.uniforms.topColor) {
                mat.uniforms.topColor.value.copy(t);
                mat.uniforms.bottomColor.value.copy(b);
            }
        });
    }
}
