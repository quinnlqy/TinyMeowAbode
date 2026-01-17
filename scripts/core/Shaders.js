/**
 * 自定义 Shader 定义
 * @module core/Shaders
 */

// ========== 天空渐变 Shader ==========
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

// ========== 极光 Shader ==========
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

// ========== 移轴模糊 Shader ==========
export const TiltShiftShader = {
    uniforms: {
        'tDiffuse': { value: null },
        'focusCenter': { value: 0.5 },
        'focusRange': { value: 0.3 },
        'blurAmount': { value: 2.0 },
        'aspect': { value: 1.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float focusCenter;
        uniform float focusRange;
        uniform float blurAmount;
        uniform float aspect;
        varying vec2 vUv;
        
        void main() {
            float dist = abs(vUv.y - focusCenter);
            float blur = smoothstep(focusRange * 0.5, focusRange, dist) * blurAmount;
            
            vec2 texelSize = vec2(1.0 / 1920.0, 1.0 / 1080.0);
            vec4 color = vec4(0.0);
            float total = 0.0;
            
            for (float x = -4.0; x <= 4.0; x += 1.0) {
                for (float y = -4.0; y <= 4.0; y += 1.0) {
                    float weight = 1.0 - length(vec2(x, y)) / 5.66;
                    if (weight > 0.0) {
                        vec2 offset = vec2(x, y) * texelSize * blur;
                        color += texture2D(tDiffuse, vUv + offset) * weight;
                        total += weight;
                    }
                }
            }
            gl_FragColor = color / total;
        }
    `
};
