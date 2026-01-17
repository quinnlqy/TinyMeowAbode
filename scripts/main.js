import * as THREE from 'three';
        import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
        import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
        import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
        import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
        // === [新增] 后期处理模块 (直接复制这一段放在这里) ===
        import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
        import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
        import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
        import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
        import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
        import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

        // [新增] 只引入 ShaderPass，不需要 TiltShiftShader.js 了
        import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

        // === 模块化导入 ===
        import { AudioManager } from './managers/AudioManager.js';
        import { WeatherSystem, SkyShader, AuroraShader, createParticleTexture } from './systems/WeatherSystem.js';
        import { DiaryManager } from './managers/DiaryManager.js';
        import { GameSaveManager } from './managers/GameSaveManager.js';
        import { Furniture } from './entities/Furniture.js';
        import { CAT_CONFIG } from './core/Constants.js';
        import { createBlockCat, calculatePathInfo, calculateJumpPosition, generateWanderTarget } from './entities/CatUtils.js';

        setTimeout(() => { const ls = document.getElementById('loading-screen'); if(ls && ls.style.display !== 'none') document.getElementById('force-start-btn').style.display='block'; }, 5000);
// === WeatherSystem/SkyShader/AuroraShader 已迁移到 ./systems/WeatherSystem.js ===

        // === 1. 全局配置与变量 ===
        // CAT_CONFIG 已迁移到 ./core/Constants.js

    let weatherSystem; // 全局变量
        
        const audioManager = new AudioManager();
        
        // [关键] 监听全局点击，解锁音频上下文并播放 BGM
        window.addEventListener('click', () => audioManager.unlockAudio(), { once: true });

        const SKY_COLORS = { night: new THREE.Color(0x1a1a2e), dawn: new THREE.Color(0xffaa99), day: new THREE.Color(0xe0f7fa), dusk: new THREE.Color(0x6a5acd) };
        const DEFAULT_DECOR = { floor: { color: 0xF5F5DC, texture: null }, wall:  { color: 0xEBE5D1, texture: null } };
        
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
        const textureLoader = new THREE.TextureLoader();
        const gltfLoader = new GLTFLoader();
        const objLoader = new OBJLoader();
        
        let mode = 'idle', ghostMesh = null, currentItemData = null, currentRotation = 0, canPlace = false;
        let selectedObject = null, selectionBox = null, editingObjectOriginalPos = null, editingObjectOriginalQuat = null;
        // [新增] 用于存储跟随移动的物体（桌上的东西）
        let attachedItems = [];
        let longPressTimer = null, startPointer = new THREE.Vector2();
        
        const obstacles = []; const placedFurniture = []; const cats = []; 
        let heartScore = 500; let currentCategory = 'floor'; let activeDecorId = { floor: null, wall: null }; let skyPanels = []; 
        let pendingInteraction = null;
        let draggingCat = null; 

        // === [新增] 日记文案配置 ===
        const DIARY_CONFIG = {
            // [新增] 日记头部信息配置
            diary_meta: {
            weathers: [
                            "☀️ 阳光正好，适合烤毛",
                            "☁️ 阴天，适合冬眠",
                            "🌧️ 下雨了，睡个回笼觉",
                            "🌬️ 有风，适合窗边巡逻",
                            "✨ 星光璀璨，夜里很安静",
                            "🌙 月色朦胧，适合打盹",
                            "🔥 壁炉很暖，不想动弹"
                        ],
                        moods: [
                            "😐 心情一般，懒得理人",
                            "😊 勉强满意，赏个眼神",
                            "😠 充满杀气，生人勿近",
                            "😴 困成一滩泥，勿扰",
                            "😻 心情愉悦，可以贴贴",
                            "😡 有点暴躁，正在思考人生",
                            "🐟 饿得两眼发光，只想着饭"
                        ],
                        keywords: [
                            "#那个红色的光点", "#快递箱", "#难吃的药片", "#逗猫棒", 
                            "#窗外麻雀", "#沙发跑酷", "#午后小憩", "#人类奴才"
                        ]
                    },

                    // [新增] 特殊节日配置 (格式: "月-日")
            special_days: {
                // 平安夜
                "12-24": {
                    weather: ["🎄 空气里有烤鸡的味道", "✨ 星星在树顶眨眼"],
                    mood: ["🎅 蹲守红衣胖子", "🧦 检查袜子里的咸鱼"],
                    events: [
                        "两脚兽在床头挂了一只红色的袜子。那个尺寸装不下我，所以我塞了一只死老鼠进去，给他个惊喜。",
                        "今晚据说有个爬烟囱的胖子要来送礼。我守在壁炉前，准备收点过路费（罐头）。"
                    ]
                },
                // 圣诞节
                "12-25": {
                    weather: ["❄️ 适合拆礼物的晴天", "🎁 满屋子都是撕纸的声音"],
                    mood: ["👑 我是树顶的星星", "📦 沉迷纸箱"],
                    events: [
                        "那个绿色的尖刺怪物（圣诞树）下堆满了盒子。我帮两脚兽把包装纸都撕碎了，不必感谢，这是我应该做的。",
                        "两脚兽在那傻笑庆祝，而我只关心那只火鸡。最终我抢到了一个鸡腿，节日快乐，我的胃。"
                    ]
                },
                // 元旦
                "1-1": {
                    weather: ["📅 新的一年，旧的太阳", "🎆 昨晚太吵了没睡好"],
                    mood: ["😼 新年新气象(指换个姿势睡)", "💤 跨年熬夜补觉中"],
                    events: [
                        "两脚兽对着日历发呆，说要重新做人。我看了一眼空饭盆，觉得他还是先把'准时喂猫'学会再说吧。",
                        "外面响了一整夜的爆炸声（烟花）。人类为了庆祝地球公转一圈真是大动干戈，还是睡觉实在。"
                    ]
                },
                // 情人节
                "2-14": {
                    weather: ["🌹 空气里有甜腻的味道", "🍫 也不怕蛀牙"],
                    mood: ["💔 单身猫的凝视", "😼 现充都走开"],
                    events: [
                        "家里多了一束花，味道很怪。我尝了一口叶子，口感一般，于是我把花瓶推到了地上。",
                        "两脚兽今天带回来一盒黑乎乎的东西（巧克力），还不给我吃。哼，想必是毒药，他自己在服毒。"
                    ]
                },
                // 春节 (这里以2025年1月29日为例，你可以根据年份扩展)
                "1-29": {
                    weather: ["🧧 满眼都是红色", "🧨 噼里啪啦"],
                    mood: ["🦁 被鞭炮吓成了飞机耳", "💰 坐等压岁钱(罐头)"],
                    events: [
                        "今天家里来了很多人类，都在还要摸我。为了保护我的毛发，我躲到了床底下，那是绝对领域。",
                        "两脚兽给了我一个红色的纸包（红包）。我咬开一看，里面没有肉干，差评。"
                    ]
                }
            },

            // [新增] 离线事件文案
            offline_events: [
                {
                    weight: 20, // 普通离线事件权重
                    type: 'normal',
                    text: [
                        "两脚兽消失的第{hours}个小时，窗外那只麻雀又挑衅了我三次，但那是我留给晚上的战术储备。",
                        "独自在家，我巡视了领地五次。嗯，一切安好，除了那个莫名其妙的笔又掉地上了。",
                        "睡了一个漫长的午觉，醒来时发现太阳换了个地方，两脚兽还没回来。",
                        "我假装在睡觉，偷偷观察了周围的一切。这个房间藏着很多秘密。"
                    ]
                },
                {
                    weight: 50, // 破坏事件权重较高
                    type: 'damage_chance', // 特殊类型，后续可触发破坏动画
                    text: [
                        "那个玻璃杯站在桌边瑟瑟发抖，为了帮它解脱，我推了它一把。听到了清脆的响声，重力学定律再次得到了验证。",
                        "我试图给沙发做个新的造型，于是多挠了几下。两脚兽应该会喜欢我的新设计。",
                        "花瓶里的花太碍事了，我决定帮它们换个更舒服的位置——地板。"
                    ]
                },
                {
                    weight: 10, // 极低概率的神秘事件
                    type: 'mystery',
                    text: [
                        "墙角那个隐形的家伙今天又来了，我和它聊了一会儿关于量子力学的看法。",
                        "对着空气叫了几声，似乎听到了回应。这个房子里住着别的……东西？",
                        "我发现了一个新的光斑，它在墙上跳舞。我捕猎了它半小时。"
                    ]
                }
            ],

            // [新增] 特定物品的专用吐槽 (key 对应 furniture ID)
            specific_items: {
                // [新增] 猫食盆专用文案
                'food_bowl': [
                    "领地里多了一个饭盆。但我检查过了，里面是空的！这是在挑衅我吗？",
                    "新的饭盆？造型勉勉强强，希望能装得下更多的高级罐头。",
                    "两脚兽摆放了一个新的祭坛（饭盆）。我会在旁边守着，直到祭品出现。"
                ],

                // [新增] 猫砂盆专用文案
                'litter_box': [
                    "又一个厕所。两脚兽对收集我的粑粑真的很执着，我是不是该配合一下？",
                    "新的沙盆，踩上去脚感不错。今晚就给它开光，确立我的领土权。",
                    "这是我的新冥想室。请两脚兽在清理之前保持距离。",
                    "新的厕所？虽然造型一般，但脚感还算凑合。希望他能保持清理频率。",
                    "这是我的新办公室。请不要在我办公（拉屎）的时候盯着我看。"
                ],
                'ChrismasTree': [
                    "两脚兽带回了一棵发光的树（圣诞树）。上面的球球看起来很好吃，我决定今晚爬上去摘一颗。",
                    "那个绿色的尖刺怪物（圣诞树）占领了客厅。我试图在它脚下尿尿以示主权，但被阻止了。"
                ],
                'Television': [
                    "那个黑色的板子（电视）里有人在动。我盯着看了半小时，那是另一个维度的入口吗？",
                    "两脚兽对着那个发光的板子傻笑。为了唤醒他，我挡在了屏幕正中间。"
                ],
                'fireplace': [
                    "墙壁上多了一个温暖的洞（壁炉）。这是家里唯一值得称赞的设施，适合烤我的肉垫。",
                    "火光在跳舞。我盯着看了很久，觉得那个火苗比逗猫棒聪明多了。"
                ],
                'cat_tree': [
                    "终于有个能俯视两脚兽的高台了。朕甚慰。",
                    "这个高塔（爬架）是家里唯一符合我身份的宝座。虽然爬上去有点累。"
                ],
                'window': [
                    "墙上开了个洞（窗户），今天上演的是《麻雀的诱惑》，剧情很精彩。",
                    "那个洞（窗户）漏风，但也漏进来阳光。我勉为其难地在那里睡了一下午。"
                ],
                'ToyCarrot':[
                    "两脚兽又试图用这蠢东西吸引我的注意，不过看在不定期上贡零食的份上，可以把它列为食盆的前哨站。",
                    "为了零食，朕可以暂时容忍这根造型可笑的橙色柱子，并象征性地拍打两下。"
                ]
            },
            
            // 通用家具 (买地面大件时触发)
            buy_floor: [
                "领地里出现了一个叫【{item}】的庞然大物。好在包装它的纸箱子很棒，五星好评。",
                "愚蠢的两脚兽带回了【{item}】，占用了我宝贵的跑酷路线。不过箱子我征用了。",
                "新王座【{item}】勉强能坐，但那个快递箱才是本世纪最伟大的发明！",
                "家里越来越挤了，都是因为【{item}】。如果我绊倒了，都要怪两脚兽。"
            ],
            // 通用小物 (买桌上/墙上东西触发)
            buy_small: [
                "桌子上多了个【{item}】，目测推下去的声音会很清脆。",
                "新贡品【{item}】？摆放的位置毫无美感，但我懒得纠正他。",
                "墙上挂了个奇怪的东西【{item}】，我想跳起来把它挠下来，以此测试我的弹跳力。"
            ],
            // 喂食
            feed: [
                "虽然我不饿，但为了不让他跪在地上哭，我勉强吃了一口贡品。",
                "今天的罐头开得晚了3秒，这笔账我记在小本本上了。",
                "两脚兽呈上了御膳。看在他诚惶诚恐的份上，赏脸吃一半吧。",
                "吃饭是猫生大事。但他站在旁边看我吃是什么意思？变态吗？"
            ],
            // 铲屎
            clean: [
                "他又在偷我的便便了。人类这种收藏癖真是令人费解。",
                "厕所终于清理了。作为奖励，我今晚会多拉一点让他开心。",
                "每当他像寻宝一样挖掘沙盆时，我都觉得这个物种没救了。"
            ],
            // 抚摸 (心情好)
            pet_happy: [
                "技师手法尚可，允许他多摸两分钟。",
                "今天心情不错，让他摸两下也没关系，就当施舍了。",
                "竟然知道我要挠下巴？这个奴才终于开窍了。",
                "咕噜咕噜……这不是因为我喜欢，只是喉咙有点痒。"
            ],
            // 抚摸 (心情差)
            pet_angry: [
                "竟然敢在我不爽的时候摸我？给了一爪子。",
                "别碰我！今天的毛发造型不能乱！",
                "无论是谁，竟敢在这个时间打扰本王，判处死刑！"
            ]
        };       
        
        // === 2. 数据库 ===
        const FURNITURE_DB = [
            { 
                id: 'food_bowl', name: '猫食盆', price: 50, type: 'functional', subType: 'food', color: 0xffffff,
                modelFile: 'FoodBowl_Empty.glb',      
                fullModelFile: 'FoodBowl_Full.glb',   
                modelScale: 0.3, fixBottom: true, size: {x:0.5, y:0.3, z:0.5}
            },
            { 
                id: 'litter_box', name: '猫砂盆', price: 80, type: 'functional', subType: 'toilet', color: 0x888888,
                modelFile: 'LitterBox_Dirty.glb',    
                fullModelFile: 'LitterBox_Clean.glb',
                modelScale: 0.5, fixBottom: true, size: {x:1.0, y:0.4, z:1.0}
            },
            { id: 'rug',      type: 'floor', layer: 0, name: '圆地毯', price: 20,  color: 0x3498db, size: {x:2, y:0.02, z:2}, modelFile: 'RoundRug.glb', modelScale: 1.5, yFix: 0.02, autoCenter: true },
            { id: 'rug_squre',type: 'floor', layer: 0, name: '方地毯', price: 20,  color: 0x3498db, size: {x:2, y:0.02, z:2}, modelFile: 'rug_squre.glb', modelScale: 1.5, yFix: 0.02, autoCenter: true },
            { id: 'bed',      type: 'floor', layer: 1, name: '猫窝',   price: 40,  color: 0xe67e22, size: {x:1, y:0.5, z:0.8}, modelFile: 'bed.glb', modelScale: 0.8, canSleep: true, fixBottom: true },
            { id: 'sofa',     type: 'floor', layer: 1, name: '大沙发', price: 150, color: 0xe74c3c, size: {x:3, y:1, z:1},   modelFile: 'sofa.glb', modelScale: 2.0, canSleep: true, fixBottom: true },
            { id: 'ArmChair',     type: 'floor', layer: 1, name: '扶手椅', price: 150, color: 0xe74c3c, size: {x:1.2, y:1, z:1.2},   modelFile: 'ArmChair.glb', modelScale: 1.0, canSleep: true, fixBottom: true },
            { id: 'ArmChair2',     type: 'floor', layer: 1, name: '绿色椅子', price: 150, color: 0xe74c3c, size: {x:1.2, y:1, z:1.2},   modelFile: 'Chair.glb', modelScale: 1.0, canSleep: true, fixBottom: true },

            { id: 'cat_tree', type: 'floor', layer: 1, name: '猫爬架', price: 100, color: 0x8e44ad, size: {x:1, y:1.8, z:1},   modelFile: 'cat_tree.glb', modelScale: 1.0 , fixBottom: true},
            // [修复] 书架：添加 isSurface 和高度 (高度设为2，即放在顶端)
            { id: 'book_shelf', type: 'floor', layer: 1, name: '书架', price: 100, color: 0x8e44ad, size: {x:2, y:2, z:1},   modelFile: 'book_shelf.glb', modelScale: 1.0, fixBottom: true, isSurface: true, surfaceHeight: 2.0 }, 

            { id: 'CafeTree', type: 'floor', layer: 1, name: '大盆栽', price: 100, color: 0x8e44ad, size: {x:2, y:2, z:1},   modelFile: 'CafeTree.glb', modelScale: 1.0, fixBottom: true },
            { id: 'PottedGreenPlant', type: 'floor', layer: 1, name: '大盆栽', price: 100, color: 0x8e44ad, size: {x:2, y:2, z:1},   modelFile: 'PottedGreenPlant.glb', modelScale: 1.0, fixBottom: true },
            { id: 'GreenPlant', type: 'floor', layer: 1, name: '盆栽', price: 100, color: 0x8e44ad, size: {x:2, y:2, z:1},   modelFile: 'GreenPlant.glb', modelScale: 1.0, fixBottom: true },
         
            { id: 'Television', type: 'floor', layer: 1, name: '电视', price: 100, color: 0x8e44ad, size: {x:1.9, y:1.5, z:0.8},   modelFile: 'Television.glb', modelScale: 1.0, fixBottom: true },
            { id: 'table',    type: 'floor', layer: 1, isSurface: true, surfaceHeight: 0.8, name: '木桌', price: 60,  color: 0x8d6e63, size: {x:1.5, y:0.6, z:1.5}, modelFile: 'table.glb', modelScale: 1.0, fixBottom: true },
{ 
                id: 'ChrismasTree',    
                type: 'floor', 
                layer: 1, 
                name: '圣诞树', 
                price: 100,  
                color: 0x8d6e63, 
                size: {x:1.5, y:2, z:1.5}, 
                modelFile: 'ChrismasTree2.glb', 
                modelScale: 1.5, 
                fixBottom: true,
                
                // [新增] 光照属性
                light: true, 
                lightType: 'point', 
                // 光源位置：x=0, y=1.8(树顶), z=0
                lightOffset: { x: 0, y: 1.8, z: 0 } 
            },            
            { id: 'fireplace',    type: 'floor', layer: 1, name: '壁炉', price: 100,  color: 0x8d6e63, size: {x:1.5, y:1.5, z:1}, modelFile: 'fireplace.glb', modelScale: 1.8, fixBottom: true },
            { id: 'frigerator',    type: 'floor', layer: 1, name: '冰箱', price: 100,  color: 0x8d6e63, size: {x:1.5, y:1.5, z:1}, modelFile: 'frigerator.glb', modelScale: 1.0, fixBottom: true },

            { id: 'mug',      type: 'small', layer: 2, name: '马克杯', price: 5,   color: 0xffffff, size: {x:0.3, y:0.3, z:0.3}, modelFile: 'mug.glb', modelScale: 0.2, fixBottom: true },
            { id: 'DalMug',      type: 'small', layer: 2, name: '马克杯蓝', price: 5,   color: 0xffffff, size: {x:0.3, y:0.3, z:0.3}, modelFile: 'DalMug.glb', modelScale: 0.8, fixBottom: true },
            { id: 'CoffeeCup',      type: 'small', layer: 2, name: '咖啡杯', price: 5,   color: 0xffffff, size: {x:0.3, y:0.3, z:0.3}, modelFile: 'CoffeeCup.glb', modelScale: 0.8, fixBottom: true },
            { id: 'ToyCarrot',      type: 'small', layer: 2, name: '胡萝卜', price: 5,   color: 0xffffff, size: {x:0.3, y:0.3, z:0.3}, modelFile: 'Carrot.glb', modelScale: 0.3, fixBottom: true,isToy: true  },

            
            { 
                id: 'ChrismasTree_Small',      
                type: 'small', 
                layer: 2, 
                name: '小圣诞树', 
                price: 5,   
                color: 0xffffff, 
                size: {x:0.3, y:0.3, z:0.3}, 
                modelFile: 'ChrismasTree_Small.glb', 
                modelScale: 1.0, 
                fixBottom: true,
                
                // [新增] 加上点光源，让它照亮桌面
                light: true, 
                lightType: 'point', 
                // 偏移量根据 size 微调，y=0.25 大概在树中间
                lightOffset: { x: 0, y: 0.25, z: 0 } 
            },
          
            { id: 'lamp',     type: 'small', layer: 2, name: '台灯',   price: 25,  color: 0xf1c40f, size: {x:0.4, y:0.6, z:0.4}, light: true, lightType: 'point', modelFile: 'lamp.glb', modelScale: 1.0, fixBottom: true },
            { id: 'tiffany_lamp',     type: 'small', layer: 2, name: '台灯2',   price: 25,  color: 0xf1c40f, size: {x:0.4, y:0.6, z:0.4}, light: true, lightType: 'point', modelFile: 'tiffany_lamp.glb', modelScale: 0.4, fixBottom: true },

            { id: 'floor_lamp',     type: 'small', layer: 2, name: '落地灯',   price: 25,  color: 0xf1c40f, size: {x:0.4, y:0.6, z:0.4}, light: true, lightType: 'point', modelFile: 'floor_lamp.glb', modelScale: 1.0, fixBottom: true, lightOffset: { x: 0, y: 1.8, z: 0 }  },
            { id: 'cutelamp',     type: 'small', layer: 2, name: '落地灯2',   price: 25,  color: 0xf1c40f, size: {x:0.4, y:0.6, z:0.4}, light: true, lightType: 'point', modelFile: 'cutelamp.glb', modelScale: 1.0, fixBottom: true, lightOffset: { x: 0, y: 1.8, z: 0 }  },
           
            { id: 'wall_plant',    type: 'wall',  layer: 1, name: '壁挂藤', price: 20,  color: 0x2ecc71, size: {x:2, y:0.5, z:0.5}, modelFile: 'wall_plant.glb', modelScale: 0.8 },
            { id: 'painting', type: 'wall',  layer: 1, name: '风景画', price: 50,  color: 0xFFD700, size: {x:1, y:1, z:0.1}, modelFile: 'painting.glb', modelScale: 1.0 },
            { id: 'curtain', type: 'wall', layer: 1, name: '窗帘', price: 80, color: 0xFFFFFF, size: {x:2.0, y:2.0, z:0.5}, modelFile: 'curtain.glb', modelScale: 1.5, autoCenter: true, allowOverlap: true },
            { id: 'wall_star', type: 'wall', layer: 1, name: '星星挂饰', price: 30, color: 0xFFFF00, size: {x:0.5, y:0.5, z:0.5}, modelFile: 'WallDecorate_Star.glb', modelScale: 1.0, autoCenter: true, allowOverlap: true },
            { id: 'ChrismaxSock', type: 'wall', layer: 1, name: '圣诞袜', price: 30, color: 0xFFFF00, size: {x:0.5, y:0.5, z:0.5}, modelFile: 'ChrismaxSock.glb', modelScale: 1.0, autoCenter: true, allowOverlap: true },
            { id: 'CorkBorad', type: 'wall', layer: 1, name: '墙壁装饰', price: 30, color: 0xFFFF00, size: {x:0.5, y:0.5, z:0.5}, modelFile: 'CorkBorad.glb', modelScale: 1.0, autoCenter: true, allowOverlap: true },
          
            { id: 'window',   type: 'wall',  layer: 1, name: '大窗', price: 120, color: 0x87CEEB, size: {x:1.8, y:1.8, z:0.2}, light: true, lightType: 'spot', modelFile: 'window_large.glb', autoCenter: true, modelScale: 1, manualOffset: { x: 0, y: 0, z: 0 } },
            { id: 'window2', type: 'wall',  layer: 1, name: '窗2', price: 120, color: 0x87CEEB, size: {x:1.8, y:2, z:0.2}, light: true, lightType: 'spot', modelFile: 'Window2.glb', modelScale: 1, autoCenter: true },
            { id: 'floor_wood', type: 'decor', name: '木纹地板', price: 50, color: 0x8d6e63, decorType: 'floor', textureFile: 'WoodenFloor.jpg' }, 
            { id: 'floor_tile', type: 'decor', name: '白瓷砖',   price: 50, color: 0xdbc2a3, decorType: 'floor' },
            { id: 'wall_pink',  type: 'decor', name: '温馨粉墙', price: 50, color: 0xc9a2a6, decorType: 'wall' },
            { id: 'wall_blue',  type: 'decor', name: '清爽蓝墙', price: 50, color: 0xb3e5fc, decorType: 'wall' },
            { id: 'wall_blueWooden',  type: 'decor', name: '蓝色木墙', price: 50, color: 0xc9a2a6, decorType: 'wall',  textureFile: 'BlueWooden.jpg' },
            { id: 'MintWallpaper',  type: 'decor', name: '薄荷墙纸', price: 50, color: 0xc9a2a6, decorType: 'wall',  textureFile: 'MintWallpaper.jpg' },
            { id: 'floor_default', type: 'decor', name: '经典米色', price: 0, color: 0xF5F5DC, decorType: 'floor' },
            { id: 'wall_default',  type: 'decor', name: '经典暖灰', price: 0, color: 0xEBE5D1, decorType: 'wall' },
        ];

        // === 3. 辅助函数 ===
        function setDomText(id, text) { const el = document.getElementById(id); if (el) el.innerText = text; else console.warn(`Element #${id} not found`); }
        window.closeDialog = function() { document.getElementById('confirm-dialog').style.display = 'none'; pendingInteraction = null; }
        
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
            const v=pos.clone(); 
            v.y+=1; v.project(camera); 
            const x=(v.x*.5+.5)*window.innerWidth; 
            const y=(-(v.y*.5)+.5)*window.innerHeight; 
            const e=document.createElement('div'); 
            e.className='heart-float'; 
            e.innerText='❤ +5'; 
            e.style.left=x+'px'; 
            e.style.top=y+'px'; 
            document.body.appendChild(e); 
            updateMoney(5); 
            setTimeout(()=>e.remove(),1500); 
        }
        function showEmote(pos,t) { const v=pos.clone(); v.y+=1.2; v.project(camera); const x=(v.x*.5+.5)*window.innerWidth; const y=(-(v.y*.5)+.5)*window.innerHeight; const e=document.createElement('div'); e.className='emote-bubble'; e.innerText=t; e.style.left=x+'px'; e.style.top=y+'px'; document.body.appendChild(e); setTimeout(()=>e.remove(),1000); }

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
                if(i.modelFile) files.push({ key: i.id, path: './assets/models/'+i.modelFile }); 
                if(i.fullModelFile) files.push({ key: i.fullModelFile, path: './assets/models/'+i.fullModelFile });
            });

            if(files.length===0) { callback(); return; }
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
                }, undefined, (err)=>{ 
                    console.warn("Missing asset:", f.path); 
                    logToScreen(`Failed to load: ${f.path}`, 'warn'); 
                    count++; check(); 
                });
            });
            function check() {
                if(progressFill) progressFill.style.width = Math.floor((count/files.length)*100)+'%';
                if(count===files.length) { 
                    logToScreen("Assets loading finished.");
                    setTimeout(()=>{ if(loadingScreen) loadingScreen.remove(); callback(); }, 500); 
                }
            }
        }

        // [修复] 补回 Decor 函数
        function applyDecorVisuals(item) {
            const setMaterial = (mesh, config) => {
                if (config.textureFile) {
                    textureLoader.load('./assets/textures/' + config.textureFile, (tex) => {
                        tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
                        if (config.decorType === 'floor') tex.repeat.set(4, 4); else tex.repeat.set(2, 1);
                        mesh.material.map = tex; mesh.material.color.setHex(0xffffff); mesh.material.needsUpdate = true;
                    }, undefined, (err) => {console.error("Failed to load texture:", config.textureFile, err);});
                } else { mesh.material.map = null; mesh.material.color.setHex(config.color); mesh.material.needsUpdate = true; }
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
            
            raw.scale.set(1,1,1); 

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
            const boxSize = 0.6; // 箱子大概尺寸
            
            do {
                x = (Math.random() - 0.5) * 8; // 扩大一点范围
                z = (Math.random() - 0.5) * 8; 
                attempts++;

                // 创建候选箱子的包围盒
                const candidateBox = new THREE.Box3();
                candidateBox.min.set(x - boxSize/2, 0, z - boxSize/2);
                candidateBox.max.set(x + boxSize/2, 1, z + boxSize/2);

                // 检测与现有家具的碰撞
                var collision = placedFurniture.some(f => {
                    const fBox = new THREE.Box3().setFromObject(f);
                    //稍微缩小家具判定范围(expandByScalar(-0.1))，允许紧贴但重叠
                    return candidateBox.intersectsBox(fBox.expandByScalar(-0.1));
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
                if (sourceItem && sourceItem.size) {
                    // 稍微把箱子做大一点点
                    let tx = Math.max(0.6, sourceItem.size.x * 1.0); 
                    let ty = Math.max(0.4, sourceItem.size.y * 1.0); 
                    let tz = Math.max(0.6, sourceItem.size.z * 1.0);
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
            boxMesh.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
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

                        // 3. [修改] 更新新版 HUD UI
            const displayH = realHour;
            
            // 格式化 12小时制 AM/PM
            const ampm = displayH >= 12 ? 'PM' : 'AM';
            const hour12 = displayH % 12 || 12; 
            
            setDomText('time-text-display', `${hour12}:${realMin.toString().padStart(2,'0')}`);
            setDomText('time-ampm', ampm);
            
            // 更新天气图标 (切换 src)
            const weatherIcon = document.getElementById('weather-icon-img');
            if(weatherIcon) {
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
// === [修改] 自定义移轴 Shader (增加清晰区) ===
        const CustomTiltShiftShader = {
            name: 'TiltShiftShader',
            uniforms: {
                'tDiffuse': { value: null },
                'blurradius': { value: 1.0 },
                'focus': { value: 0.5 },
                'aspect': { value: 1.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
                }`,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float blurradius;
                uniform float focus;
                uniform float aspect;
                varying vec2 vUv;

                void main() {
                    vec4 color = vec4( 0.0 );
                    float total = 0.0;
                    
                    // 1. 计算距离焦点的垂直距离 (绝对值)
                    float dist = abs(vUv.y - focus);
                    
                    // 2. [核心修改] 设定一个"绝对清晰范围" (例如 0.15)
                    // 屏幕中间 30% (0.15*2) 的区域完全不模糊
                    // 超过 0.15 的部分，模糊程度才开始随距离增加
                    float amount = max(0.0, dist - 0.25) * blurradius; 
                    
                    for ( float i = -4.0; i <= 4.0; i++ ) {
                        for ( float j = -4.0; j <= 4.0; j++ ) {
                            float x = vUv.x + ( j * amount * 0.002 / aspect );
                            float y = vUv.y + ( i * amount * 0.002 );
                            color += texture2D( tDiffuse, vec2( x, y ) );
                            total += 1.0;
                        }
                    }
                    gl_FragColor = color / total;
                }`
        };

        // === [新增] 后期处理逻辑 ===
        let composer;

        function initPostProcessing() {
            const width = window.innerWidth;
            const height = window.innerHeight;

            composer = new EffectComposer(renderer);
            
            // 1. 基础场景渲染
            const renderPass = new RenderPass(scene, camera);
            composer.addPass(renderPass);

            // 2. SSAO (环境光遮蔽) - 增加角落阴影和立体感
            // 它是 Zelda/动森风格的关键，让物体"落地"而不是飘着
            const saoPass = new SAOPass(scene, camera, false, true);
            saoPass.params.output = 0; 
            saoPass.params.saoBias = 0.5;
            saoPass.params.saoIntensity = 0.05; // 阴影强度，越大约黑
            saoPass.params.saoScale = 100;
            saoPass.params.saoKernelRadius = 30;
            composer.addPass(saoPass);

            // 3. Bloom (辉光) - 让灯光和窗户有柔和光晕
            const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.5, 0.4, 0.85);
            bloomPass.threshold = 0.95; // 提高阈值：只有真正的灯泡、窗户高光才会发光，地板不发光
            bloomPass.strength = 0.15;  // 降低强度：防止画面太“仙”，变得清晰
            bloomPass.radius = 0.5;
            composer.addPass(bloomPass);

            // === [新增] 移轴效果 (使用自定义 Shader) ===
            const tiltShiftPass = new ShaderPass(CustomTiltShiftShader);
            
            // 参数调整：
            tiltShiftPass.uniforms['blurradius'].value = 3.0; // 模糊强度 (建议 3.0 - 5.0)
            tiltShiftPass.uniforms['focus'].value = 0.5;      // 焦点位置 (0.5 是正中间)
            tiltShiftPass.uniforms['aspect'].value = window.innerWidth / window.innerHeight;
            
            composer.addPass(tiltShiftPass);
            // ===================================
            

            // 4. SMAA (抗锯齿) - 消除锯齿边缘
            const smaaPass = new SMAAPass(width, height);
            composer.addPass(smaaPass);

            // 5. Output (色彩输出) - 确保色彩空间正确
            const outputPass = new OutputPass();
            composer.addPass(outputPass);
        }

        // === [新增] 后期处理逻辑结束 ===

        // === [新增] 为所有按钮绑定通用点击音效 ===
        document.querySelectorAll('button, .item-card, .shop-tab, .hud-btn-container, #weather-icon-container').forEach(btn => {
                    btn.addEventListener('click', () => audioManager.playSfx('ui_click'));
                });

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
            saveGame: () => gameSaveManager.saveGame()
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

        class Cat {
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
                    if (loadedModels['cat']) {
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
                            
                            logToScreen(`Cat loaded with ${anims.length} animations.`);
                            if (anims.length < 8) logToScreen("Warning: Cat model has fewer than 8 animations!", 'warn');
                        }
                    } else { this.mesh.add(createBlockCat(color)); }
                } catch (e) { console.error("Cat error:", e); this.mesh.add(createBlockCat(color)); }
                this.mesh.position.set(0, 0, 0); this.chooseNewAction(); 
            }
            // createBlockCat 已迁移到 ./entities/CatUtils.js
            showBubble(icon) { if (!this.bubbleEl || !this.bubbleIcon) return; this.bubbleIcon.innerText = icon; this.bubbleEl.classList.remove('hidden'); }
            hideBubble() { if (!this.bubbleEl) return; this.bubbleEl.classList.add('hidden'); }
            updateBubblePosition() { if (!this.bubbleEl || this.bubbleEl.classList.contains('hidden')) return; const pos = this.mesh.position.clone(); pos.y += 1.2; pos.project(camera); const x = (pos.x * .5 + .5) * window.innerWidth; const y = (-(pos.y * .5) + .5) * window.innerHeight; this.bubbleEl.style.left = `${x}px`; this.bubbleEl.style.top = `${y}px`; }
updateUI() { 
                // [修改] 适配新版 HUD (容器裁剪法)
                const hungerLevel = document.getElementById('level-hunger');
                const toiletLevel = document.getElementById('level-toilet');
                
                // 直接用 height 百分比
                // 100% = 满 (容器高度占满 Mask)
                // 0%   = 空 (容器高度为0，图片看不见)
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

            // [修改] Update (在醒来时记录 lastInteractTarget，并支持拖拽状态)
            update(dt) {
                if(this.isAnimated && this.mixer) this.mixer.update(dt);

                this.decayStats(dt); 
                this.updateBubblePosition();
                this.updateUI();

                this.updateVocal(dt); // [新增] 更新叫声逻辑

                // [新增] 拖拽状态：什么都不做，位置由鼠标控制
                if (this.state === 'dragged') {
                    return;
                }

                if (this.state === 'sleeping') {
                    this.sleepMinDuration -= dt;
                    if ((this.stats.hunger < 5 || this.stats.toilet < 5) || this.sleepMinDuration <= 0) {
                         
                         // [新增] 醒来时，记录这张床，下次别马上睡它
                         this.lastInteractTarget = this.interactTarget;

                         this.state = 'idle'; this.sleepMinDuration = 0;
                         this.hideBubble(); 
                         this.resetModelOffset(); 
                         this.trySpawnHeart(); // 使用新方法

                         this.chooseNewAction(); 
                    }
                    return; 
                }

                // ... 以下保持原有的物理与移动逻辑 ...
                if (this.state !== 'jumping') {
                    const rayOrigin = this.mesh.position.clone(); rayOrigin.y = 5; this.downRay.set(rayOrigin, new THREE.Vector3(0,-1,0));
                    const hitCandidates = [floorPlane, ...placedFurniture.filter(f => f.userData.parentClass && f.userData.parentClass.dbItem && f.userData.parentClass.dbItem.layer === 1 && !f.userData.parentClass.isBox)];
                    const hits = this.downRay.intersectObjects(hitCandidates, true); let targetY = 0; if(hits.length > 0) targetY = hits[0].point.y;
                    this.mesh.position.y += (targetY - this.mesh.position.y) * 0.2;
                }
                
                if(this.interactTarget && (!placedFurniture.includes(this.interactTarget) || !this.interactTarget.visible)) { this.interrupt(); return; }
                if (this.state === 'angry') { if (Date.now() > this.angryTime) { this.state = 'idle'; this.patience = 5 + Math.floor(Math.random() * 6); this.petCount = 0; updateStatusText("猫咪气消了"); } }
                
                if(this.state === 'walking') { this.handleWalkingLogic(dt); } 
                else if (this.state === 'jumping') { this.updateJumping(dt); } 
                else if(this.state === 'idle') { this.handleIdleLogic(dt); } 
                else if(this.state === 'interacting') { this.handleInteractingLogic(dt); } 
                else if(this.state === 'petting') { this.playAction('happy'); } 
                else if (this.state === 'begging') { 
                    this.playAction('happy'); 
                    this.checkIfNeedsSatisfied(); 
                    this.mesh.lookAt(camera.position.x, this.mesh.position.y, camera.position.z); 
                }
            }

            handleIdleLogic(dt) {
                this.playAction('idle'); 
                
                // [修改] 闲置逻辑简化：只负责倒计时
                // 真正的行为决策全部移交给了 chooseNewAction
                this.timer -= dt; 
                
                if (this.timer <= 0) {
                    this.chooseNewAction();
                }
            }

            handleWalkingLogic(dt) {
                this.playAction('walk'); 
                const dir = new THREE.Vector3().subVectors(this.stopPos, this.mesh.position); 
                dir.y = 0; 
                const dist = dir.length();
                
                // 1. 碰撞检测
                if (dist > 0.5) { 
                    const forwardDir = dir.clone().normalize(); 
                    this.forwardRay.set(this.mesh.position.clone().add(new THREE.Vector3(0,0.3,0)), forwardDir); 
                    
                    const obstacleMeshes = placedFurniture.filter(f => {
                        // 关键：行走时，绝对不要把自己要去的目标当成障碍物！
                        // 否则猫会还没走到，就检测到饭盆的碰撞盒，然后停下来
                        const isInteractTarget = (this.interactTarget && f === this.interactTarget);
                        const isFoodTarget = (this.targetFurniture && f === this.targetFurniture);
                        const isDecor = (f.userData.parentClass && f.userData.parentClass.dbItem.layer === 0);
                        return !isInteractTarget && !isFoodTarget && !isDecor;
                    });

                    const cols = this.forwardRay.intersectObjects(obstacleMeshes, true); 
                    // 增加判定距离，避免过于敏感
                    if(cols.length > 0 && cols[0].distance < 0.4) { 
                        // [修复] 遇到障碍物时尝试绕路，而不是直接放弃
                        this.tryAvoidObstacle(forwardDir, obstacleMeshes);
                        return; 
                    } 
                }

                // 2. 到达检测
                if (dist < 0.1) { 
                    // [修复] 如果正在绕路中，到达绕路点后重新指向原始目标
                    if (this.isAvoiding && this.originalTargetPos) {
                        this.isAvoiding = false;
                        // 重新计算到原始目标的路径
                        const vec = new THREE.Vector3().subVectors(this.mesh.position, this.originalTargetPos);
                        vec.y = 0;
                        vec.normalize();
                        this.stopPos.copy(this.originalTargetPos).add(vec.multiplyScalar(this.targetStopDist || 0.7));
                        return; // 继续走向原始目标
                    }
                    
                    // [新增] 安全检查：如果离目标家具的实际中心还很远，说明是"假到达" (可能是StopPos计算错了)
                    if (this.targetFurniture) {
                        const distToRealTarget = new THREE.Vector3().subVectors(this.targetFurniture.position, this.mesh.position);
                        distToRealTarget.y = 0;
                        // 如果离中心点超过 1.5米，说明停得太远了，可能是被卡住了或者计算错误
                        // 这种情况下，强制瞬移过去 (或者继续走)
                        if (distToRealTarget.length() > 1.5) {
                            // 强制修正位置到停止点 (瞬移修复)
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

            // [新增] 绕路逻辑：遇到障碍物时尝试左右绕行
            avoidCounter = 0; // 绕路尝试计数器
            avoidDirection = 1; // 1=右转, -1=左转
            originalTargetPos = null; // 原始目标位置
            targetStopDist = 0.7; // 目标停止距离
            isAvoiding = false; // 是否正在绕路中
            
            tryAvoidObstacle(blockedDir, obstacleMeshes) {
                // 限制绕路尝试次数，防止无限循环
                this.avoidCounter++;
                if (this.avoidCounter > 10) {
                    // 绕了10次还没绕过去，放弃这次任务
                    this.avoidCounter = 0;
                    this.isAvoiding = false;
                    this.chooseNewAction();
                    return;
                }
                
                // 标记正在绕路
                this.isAvoiding = true;
                
                // 尝试向左或向右偏转 45-90 度
                const angles = [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI * 3/4, -Math.PI * 3/4];
                const testRay = new THREE.Raycaster();
                const catPos = this.mesh.position.clone().add(new THREE.Vector3(0, 0.3, 0));
                
                for (let angle of angles) {
                    // 旋转方向向量
                    const rotatedDir = blockedDir.clone();
                    const cos = Math.cos(angle);
                    const sin = Math.sin(angle);
                    const newX = rotatedDir.x * cos - rotatedDir.z * sin;
                    const newZ = rotatedDir.x * sin + rotatedDir.z * cos;
                    rotatedDir.x = newX;
                    rotatedDir.z = newZ;
                    rotatedDir.normalize();
                    
                    // 检测这个方向是否可行
                    testRay.set(catPos, rotatedDir);
                    const hits = testRay.intersectObjects(obstacleMeshes, true);
                    
                    // 如果这个方向没有障碍物，或者障碍物很远
                    if (hits.length === 0 || hits[0].distance > 1.0) {
                        // 设置一个中间点，先走到这个方向 0.8 米处
                        const avoidPoint = this.mesh.position.clone().add(rotatedDir.multiplyScalar(0.8));
                        avoidPoint.y = 0;
                        
                        // 设置新的临时目标点
                        this.stopPos.copy(avoidPoint);
                        return; // 成功找到绕路方向
                    }
                }
                
                // 所有方向都被堵住，原地等待一下再重试
                this.state = 'idle';
                this.timer = 0.5; // 0.5 秒后重新决策
                this.isAvoiding = false;
            }

            // [新增] 辅助：恢复模型默认位置（用于修正睡觉偏移）
            resetModelOffset() {
                if(this.mesh.children.length > 0) {
                    this.mesh.children[0].position.x = 0; // 假设默认是0
                    // 保持Y轴 (CAT_CONFIG.yOffset 可能会用到，这里简单假设归零或保留原逻辑)
                    // 如果原模型有特定yOffset，最好在这里读取 CAT_CONFIG.yOffset
                    // 根据代码上下文: model.position.y = CAT_CONFIG.yOffset
                    this.mesh.children[0].position.y = CAT_CONFIG.yOffset || 0;
                    this.mesh.children[0].position.z = 0;
                }
            }


            // [修改] 交互逻辑 (也使用 trySpawnHeart)
            handleInteractingLogic(dt) {
                const isInsideBox = this.interactTarget && this.interactTarget.userData.parentClass && this.interactTarget.userData.parentClass.isBox && !this.interactTarget.userData.parentClass.isTipped;
                if (isInsideBox) { this.playAction('sleep'); } else { this.playAction('idle'); } 
                
                this.timer -= dt; 
                
                if(this.timer <= 0) { 
                    // [新增] 记录刚才玩过的东西
                    this.lastInteractTarget = this.interactTarget;

                    // 使用新方法
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

            // [新增] 检查并产生爱心 (解决问题3)
            trySpawnHeart() {
                // 如果饿死或憋坏了，就不给爱心
                if (this.stats.hunger <= 0 || this.stats.toilet <= 0) {
                    showEmote(this.mesh.position, '🚫'); // 提示玩家
                    return;
                }
                spawnHeart(this.mesh.position);
            }

            // [新增] 设置拖拽状态 (解决问题2)
            setDragged(isDragged) {
                if (isDragged) {
                    this.state = 'dragged';
                    this.interactTarget = null;
                    this.targetFurniture = null;
                    this.hideBubble();
                    this.resetModelOffset();
                    // 播放动作 5 (Urgent/Struggle)
                    // 确保映射正确：Action 5 对应 Urgent
                    this.playAction('urgent'); 
                } else {
                    // 放下后，重置为 idle，并让它自己决定下一步
                    this.state = 'idle';
                    this.playAction('idle');
                    // 稍微给点延迟再思考，避免瞬间乱跑
                    this.timer = 1.0; 
                }
            }

// [修改] 听到声音的反应 (移除长CD，改为状态判断)
            reactToSound(targetPos) {
                // 1. 绝对不可打断的状态
                if (this.state === 'eating' || 
                    this.state === 'pooping' || 
                    this.state === 'dragged') return;

                // 2. [新增] 如果已经在前往玩具的路上了，或者正在玩玩具，就不要重复触发
                // 这样避免狂点的时候猫咪鬼畜
                if (this.nextAction === 'INSPECT_TOY') return;

                // 3. [逻辑优化] 只有当猫咪离玩具比较远时(比如大于1米)，才会被吸引
                // 这样实现了"只有离开去干别的事了，才能再次被吸引"
                const dist = this.mesh.position.distanceTo(targetPos);
                if (dist < 1.0) {
                    // 离得太近了，转头看一眼就行，不用重新走
                    this.mesh.lookAt(targetPos.x, this.mesh.position.y, targetPos.z);
                    return;
                }

                // --- 唤醒与吸引逻辑 ---
                
                if (this.state === 'sleeping') {
                    this.resetModelOffset(); 
                    this.sleepMinDuration = 0; 
                    this.hideBubble(); // 隐藏Zzz
                    showEmote(this.mesh.position, '🙀'); // 吓醒
                } else {
                    showEmote(this.mesh.position, '❗'); // 吸引
                }
                
                // 打断当前闲逛
                this.interactTarget = null;
                this.targetFurniture = null;

                // 走过去
                this.setPath(targetPos, 0.6); 
                this.state = 'walking';
                this.nextAction = 'INSPECT_TOY'; // 标记目标是去玩玩具
            }

            pet() { 
                // 拖拽中不处理
                if (this.state === 'dragged') return; 

                // 状态检查
                if (this.state === 'angry') { 
                    audioManager.playSfx('meow_angry'); // [新增] 生气哈气
                    showEmote(this.mesh.position, '💢'); 
                    return; } 
                
                // [新增] 如果太饿或想上厕所，拒绝抚摸，并提示需求
                if (this.stats.hunger < 30) { 
                    showEmote(this.mesh.position, '🐟'); 
                    diaryManager.logEvent('pet_angry'); // <--- 记录：饿了不给摸
                    return; 
                }
                if (this.stats.toilet < 30) { 
                    showEmote(this.mesh.position, '💩'); 
                    diaryManager.logEvent('pet_angry'); // <--- 记录：急着上厕所不给摸
                    return; 
                }

                this.hideBubble(); 
                this.resetModelOffset();

                if (this.petCount >= this.patience) { 
                    showEmote(this.mesh.position, '💢'); 
                    this.state = 'angry'; 
                    this.angryTime = Date.now() + 15 * 60 * 1000; 
                    this.chooseNewAction(); 
                    updateStatusText("猫咪生气了 (15m CD)");
                    diaryManager.logEvent('pet_angry', {}, 100); // 愤怒抚摸权重高一点
                } 
                else { 
                    this.petCount++; 
                    this.trySpawnHeart(); 
                    showEmote(this.mesh.position, '😻'); 
                    this.state = 'petting'; 
                    audioManager.playSfx('meow_purr'); 

                    // [新增] 成功抚摸日记
                    // 只有当 petCount 累积到一定程度(比如3次)或者随机概率记录，避免刷屏
                    // 这里我们利用 DiaryManager 自带的重复文本过滤，直接调用
                    diaryManager.logEvent('pet_happy', {}, 20); // 友好抚摸权重 

                    if (this.resetTimer) clearTimeout(this.resetTimer); 
                    this.resetTimer = setTimeout(() => { 
                        if (this.state === 'petting') this.state = 'idle'; 
                    }, 2000); 
                } 
            }

            resetCooldown() 
            { 
                this.angryTime = 0; this.state = 'idle'; this.petCount = 0; this.patience = 10; showEmote(this.mesh.position, '❤️'); }
            
            // [修改] 中断行为：增加 hideBubble 和 resetOffset
            interrupt() { 
                showEmote(this.mesh.position,'❓'); 
                this.state='idle'; 
                this.interactTarget=null; 
                this.timer=1; 
                this.hideBubble();     // 修复：必须隐藏气泡
                this.resetModelOffset(); // 修复：恢复模型偏移
            }

            leaveInteraction() { 
                this.state = 'idle'; 
                this.interactTarget = null; 
                this.timer = 1; 
                this.hideBubble(); // [修复] 离开交互时隐藏气泡
            }

// [修复] AI 核心决策逻辑：生存优先 > 娱乐
            chooseNewAction() {
                const isDay = (visualHour >= 6 && visualHour < 18);
                
                // [修复] 每次决策前，先清除可能残留的气泡
                this.hideBubble();
                
                // 1. === 生存需求检查 (最高优先级) ===
                // 饥饿 < 40 就开始找吃的 (阈值提高一点，防止饿过头)
                if (this.stats.hunger < 40) {
                    const foodBowl = this.findAvailableFurniture('food', 'full');
                    if (foodBowl) {
                        this.interactTarget = foodBowl; // 记录目标
                        this.targetFurniture = foodBowl; // 兼容旧逻辑
                        
                        // [修复] 直接使用 foodBowl.position，保持一致性
                        this.setPath(foodBowl.position, 0.5);
                        
                        this.state = 'walking';
                        this.nextAction = 'EAT';
                        return; // 找到了就直接去，不往下执行
                    } else {
                        // 没饭了！冒气泡提示
                        this.showBubble('🐟');
                        // [修复] 即使没找到食物，也要继续往下执行其他行为，不要卡住
                    }
                }

                // 如厕 < 40 就找厕所
                if (this.stats.toilet < 40) {
                    const litterBox = this.findAvailableFurniture('toilet', 'clean');
                    if (litterBox) {
                        this.interactTarget = litterBox;
                        this.targetFurniture = litterBox;
                        
                        // [修复] 直接使用 litterBox.position
                        this.setPath(litterBox.position, 0.6);
                        
                        this.state = 'walking';
                        this.nextAction = 'POOP';
                        return;
                    } else {
                        // 厕所脏了！冒气泡
                        this.showBubble('💩');
                        // [修复] 继续往下执行
                    }
                }

                // 2. === 娱乐与休息 (低优先级) ===
                // 只有在肚子不饿、不想上厕所时，才执行下面的随机逻辑

                // 过滤掉刚刚才玩过的东西 (防止重复)
                const filterLast = (arr) => arr.filter(item => item !== this.lastInteractTarget);

                const boxes = placedFurniture.filter(f => f.userData.parentClass && f.userData.parentClass.isBox);
                const sleepers = placedFurniture.filter(f => f.userData.parentClass && f.userData.parentClass.dbItem.canSleep);
                const others = placedFurniture.filter(f => f.userData.parentClass && !f.userData.parentClass.isBox && !f.userData.parentClass.dbItem.canSleep && f.userData.parentClass.dbItem.layer === 1);

                let rnd = Math.random();
                let target = null;
                
                // 优先玩箱子
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
                    // 没事干就随机走走（使用工具函数）
                    this.lastInteractTarget = null;
                    this.interactTarget = null; 
                    const randPos = generateWanderTarget(this.mesh.position, 1, 4); 
                    this.setPath(randPos); 
                    this.state = 'walking'; 
                }
            }

            // [修复] 进入交互：智能对齐家具方向，防止穿模
            enterInteraction() { 
                if (this.interactTarget && this.interactTarget.userData.parentClass && this.interactTarget.userData.parentClass.dbItem.canSleep) {
                    this.state = 'sleeping';
                    this.sleepMinDuration = 10.0 + Math.random() * 10.0;
                    this.playAction('sleep'); 
                    this.showBubble('💤');

                    // 1. 位置归位：先移到家具中心
                    this.mesh.position.copy(this.interactTarget.position);

                    // 2. 旋转对齐：获取家具的旋转角度
                    const furnRotation = this.interactTarget.rotation.y;
                    
                    // 让猫咪的朝向与家具一致 (或者转90度，看模型情况)
                    // 假设猫咪默认朝向是Z轴，我们让它和家具方向一致，这样坐标系就统一了
                    this.mesh.rotation.y = furnRotation; 

                    // 3. 局部偏移计算：解决穿模与靠背问题
                    // 现在的 Z 是相对于家具的“正前方”的
                    // 如果靠背在家具的 -Z (局部)，我们就要往 +Z 移
                    // 使用 Vector3.applyAxisAngle 来计算世界坐标下的偏移
                    const localOffset = new THREE.Vector3(0, 0, 0.25); // 往“前”挪 0.25
                    
                    // 有些长条形家具（如床/沙发），可能需要沿着 X 轴稍微随机一点，不要每次都睡正中间
                    const randomX = (Math.random() - 0.5) * 0.4; 
                    localOffset.x += randomX;

                    // 将局部偏移转换为世界偏移并应用
                    localOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), furnRotation);
                    this.mesh.position.add(localOffset);

                    // 4. 高度修正
                    const itemSize = this.interactTarget.userData.parentClass.dbItem.size;
                    if(itemSize) {
                        this.mesh.position.y += (itemSize.y * 0.5) + 0.3;
                    }

                    // 5. 模型内部微调 (模型本身的重心偏差修正)
                    if(this.mesh.children.length > 0) {
                        // 稍微向右一点，抵消倒下动画的位移
                        this.mesh.children[0].position.set(0.2, CAT_CONFIG.yOffset || 0, 0); 
                    }
                    return;
                }

                // ... 其他交互逻辑 (玩箱子等) 保持不变 ...
                this.state = 'interacting'; 
                this.timer = 5 + Math.random() * 5; 
                if (this.interactTarget && this.interactTarget.userData.parentClass && this.interactTarget.userData.parentClass.isBox) { this.timer = 8; showEmote(this.mesh.position, '📦'); }
                if(this.interactTarget) { 
                    const isInsideBox = this.interactTarget.userData.parentClass && this.interactTarget.userData.parentClass.isBox && !this.interactTarget.userData.parentClass.isTipped; 
                    if (!isInsideBox) { this.mesh.rotation.y = Math.random() * Math.PI * 2; } 
                }
            }

// [修复] 设置路径：针对吃饭行为，缩小停止距离，并强制更新状态
            setPath(targetPosition, stopDist = 0.7) { 
                this.targetPos.copy(targetPosition); 
                
                // [修复] 重置绕路计数器，保存原始目标
                this.avoidCounter = 0;
                this.originalTargetPos = targetPosition.clone(); // 保存原始目标用于绕路后重新导航
                
                // 计算方向：从目标指向猫 (为了反向推算停止点)
                const vec = new THREE.Vector3().subVectors(this.mesh.position, targetPosition); 
                vec.y = 0; // 忽略高度差
                vec.normalize(); 
                
                // [针对吃饭的修正]
                // 检查 interactTarget 或 targetFurniture 是否是食物
                // 注意：chooseNewAction 设置 interactTarget，但 handleIdleLogic 设置 targetFurniture
                let isFood = false;
                if (this.targetFurniture && this.targetFurniture.userData.parentClass && this.targetFurniture.userData.parentClass.dbItem.subType === 'food') {
                    isFood = true;
                }

                if (isFood) {
                    stopDist = 0.5; // 离饭盆更近
                }

                // 计算停止点：目标点 + 方向 * 距离
                this.stopPos.copy(targetPosition).add(vec.multiplyScalar(stopDist));
                this.targetStopDist = stopDist; // [修复] 保存停止距离用于绕路后重新计算
            }

            // [修改] 生理需求衰减：调整比例为 3吃 : 2拉
            decayStats(dt) { 
                // 饥饿加快 (0.5 -> 0.6)，如厕变慢 (0.4 -> 0.3)
                this.stats.hunger -= 0.6 * dt; 
                this.stats.toilet -= 0.3 * dt; 
                
                if(this.stats.hunger < 0) this.stats.hunger = 0; 
                if(this.stats.toilet < 0) this.stats.toilet = 0; 
            }
            findAvailableFurniture(subType, requiredState) { return placedFurniture.find(f => f.userData.parentClass && f.userData.parentClass.dbItem.subType === subType && f.userData.parentClass.functionalState === requiredState); }
            checkIfNeedsSatisfied() { this.playAction('idle'); if (this.stats.hunger < 30) { const food = this.findAvailableFurniture('food', 'full'); if (food || this.stats.hunger > 90) { this.state = 'idle'; this.hideBubble(); } } if (this.stats.toilet < 40) { const box = this.findAvailableFurniture('toilet', 'clean'); if (box || this.stats.toilet > 90) { this.state = 'idle'; this.hideBubble(); } } }
            

            // [修改] 到达逻辑：修复猫砂盆高度 & 离开时跳出
            onArriveDest() {
                // [修复] 到达目标后重置绕路计数器
                this.avoidCounter = 0;
                
                if (!this.targetFurniture) { 
                    this.enterInteraction(); 
                    this.nextAction = null; 
                    this.targetFurniture = null;
                    return;
                }
                
                const parent = this.targetFurniture.userData.parentClass;
                if (parent && parent.isBox && !parent.isTipped) { this.startJump(); return; }

                // [新增] 到达玩具跟前
                if (this.nextAction === 'INSPECT_TOY') {
                    this.state = 'idle';
                    this.nextAction = null;
                    
                    // 面向玩具的方向 (因为 setPath 只负责走，停下时可能会歪)
                    // 我们让猫看向目标点 (这里需要拿到刚才的 targetPos，或者简单让它保持当前朝向)
                    // 最简单的是让它播放一个高兴或好奇的动作
                    this.playAction('happy'); 
                    // [修改] 头顶出现胡萝卜图标
                    showEmote(this.mesh.position, '🥕');
                    
                    // 盯着看 3 秒
                    this.timer = 3.0; 
                    return;
                }
                
                if (this.nextAction === 'EAT') { 
                    // [修复] 检查是否真的到了饭盆旁边
                    if (this.targetFurniture) {
                        const distToBowl = this.mesh.position.distanceTo(this.targetFurniture.position);
                        // 如果离饭盆还很远（> 1.5米），说明是误触发，重新走过去
                        if (distToBowl > 1.5) {
                            this.setPath(this.targetFurniture.position, 0.5);
                            this.state = 'walking';
                            // 保持 nextAction = 'EAT'，下次到达时再执行
                            return;
                        }
                    }
                    
                    this.state = 'eating'; 
                    
                    // [关键修复] 强制位置修正：瞬间移动到饭盆面前的完美位置
                    // 防止因为寻路误差导致的"隔空吃饭"
                    if(this.targetFurniture) {
                        const bowlPos = this.targetFurniture.position.clone();
                        const catPos = this.mesh.position.clone();
                        
                        // 计算方向：从碗指向猫
                        const direction = new THREE.Vector3().subVectors(catPos, bowlPos).normalize();
                        direction.y = 0; // 忽略高度
                        
                        // 设定理想位置：碗的中心向猫的方向延伸 0.6 米
                        const idealPos = bowlPos.clone().add(direction.multiplyScalar(0.6));
                        
                        // 瞬移过去 (保持 Y 轴在地面)
                        this.mesh.position.set(idealPos.x, 0, idealPos.z);
                        
                        // 强制看向碗
                        this.mesh.lookAt(bowlPos.x, 0, bowlPos.z);
                    }

                    this.playAction('eat'); 
                    
                    setTimeout(() => { 
                        if(this.state !== 'eating') return; 
                        this.stats.hunger = 100; 
                        if(this.targetFurniture && this.targetFurniture.userData.parentClass) this.targetFurniture.userData.parentClass.useByCat(); 
                        this.state = 'idle'; this.timer = 2; this.trySpawnHeart(); 
                        this.targetFurniture = null; 
                        this.hideBubble(); // [修复] 吃完饭隐藏气泡
                    }, 5000); 
                }
                else if (this.nextAction === 'POOP') { 
                    // [修复] 检查是否真的到了猫砂盆旁边
                    if (this.targetFurniture) {
                        const distToBox = this.mesh.position.distanceTo(this.targetFurniture.position);
                        if (distToBox > 1.5) {
                            this.setPath(this.targetFurniture.position, 0.6);
                            this.state = 'walking';
                            return;
                        }
                    }
                    
                    this.state = 'pooping'; 
                    
                    // [修复] 猫砂盆高度修正
                    // 从截图看，猫咪应该站在猫砂表面上（脚踩在沙子上）
                    // 当前猫咪埋了半个身子，需要大幅提高 Y 值
                    // 猫砂盆盆沿高度约 0.6-0.7 米，猫砂表面约 0.55 米
                    const litterBoxHeight = 0.7; // 猫砂表面高度
                    
                    this.mesh.position.copy(this.targetFurniture.position);
                    this.mesh.position.y = litterBoxHeight; 

                    this.playAction('urgent'); 
                    this.mesh.rotation.y = Math.random() * Math.PI * 2;
                    
                    setTimeout(() => { 
                        if(this.state !== 'pooping') return; 
                        
                        this.stats.toilet = 100; 
                        if(this.targetFurniture && this.targetFurniture.userData.parentClass) this.targetFurniture.userData.parentClass.useByCat(); 
                        
                        // [新增] 离开猫砂盆：跳回进入前的位置 (stopPos)
                        // 这样就避免了被困在猫砂盆模型里面
                        this.mesh.position.copy(this.stopPos);
                        // 重置高度为地面
                        this.mesh.position.y = 0; 

                        this.state = 'idle'; this.timer = 2; this.trySpawnHeart(); 
                        this.targetFurniture = null; 
                        this.hideBubble(); // [修复] 上完厕所隐藏气泡
                    }, 4000); 
                }
            }

            // [新增] 猫咪发声系统
            meowTimer = 0;
            
            updateVocal(dt) {
                // 1. 需求叫声 (高优先级，频率高)
                // 如果非常饿(<20) 或 非常急(<20)
                if (this.stats.hunger < 20 || this.stats.toilet < 20) {
                    this.meowTimer += dt;
                    if (this.meowTimer > 5.0) { // 每5秒叫一次
                        audioManager.playSfx('meow_urgent');
                        // [修复] 根据具体需求显示不同图标
                        if (this.stats.hunger < 20) {
                            showEmote(this.mesh.position, '🐟'); // 饿了显示鱼
                        } else {
                            showEmote(this.mesh.position, '💩'); // 急了显示便便
                        }
                        this.meowTimer = 0;
                    }
                    return;
                }

                // 2. 随机卖萌 (低优先级，频率低)
                // 只有在醒着的时候叫
                if (this.state !== 'sleeping') {
                    // 约每 20~30 秒有一次概率叫
                    if (Math.random() < 0.0005) { 
                        audioManager.playSfx('meow_normal');
                    }
                }
            }


        }

        // === 6. 交互与渲染 ===
        window.switchCategory = function(cat) {
            currentCategory = cat;
            
            // [修改] 切换 Tab 的 active 样式
            const tabs = document.querySelectorAll('.shop-tab');
            const catMap = { 'floor': 0, 'small': 1, 'wall': 2, 'decor': 3 };
            
            tabs.forEach(t => t.classList.remove('active'));
            if (tabs[catMap[cat]]) tabs[catMap[cat]].classList.add('active');
            
            renderShopItems(cat);
        };
        
        window.forceStart = function() { const ls = document.getElementById('loading-screen'); if(ls) ls.style.display = 'none'; if(!scene) startGame(); }
        window.debugAddMoney = function() { updateMoney(100); };
        window.debugResetCat = function() { cats.forEach(c => c.resetCooldown()); updateStatusText("猫咪不再生气了"); };

        let debugGizmosVisible = false;
        let debugHelpers = [];
        window.toggleDebugGizmos = function() {
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
        window.toggleConsole = function() {
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
window.toggleWeather = function() {
            if (!weatherSystem) return;
            const types = ['clear', 'rain', 'snow'];
            // 循环切换
            let currentIdx = types.indexOf(weatherSystem.currentWeather);
            let nextIdx = (currentIdx + 1) % types.length;
            weatherSystem.setWeather(types[nextIdx]);
        };
function renderShopItems(cat) {
            const c = document.getElementById('items-scroll'); 
            c.innerHTML = ''; 
            
            let typeFilter = cat; 
            FURNITURE_DB.filter(i => (i.type === typeFilter || (typeFilter === 'floor' && i.type === 'functional'))).forEach(item => {
                
                // 创建容器
                const card = document.createElement('div');
                card.className = 'item-card';
                if (heartScore < item.price) card.classList.add('disabled');
                if (item.type === 'decor' && activeDecorId[item.decorType] === item.id) card.classList.add('selected');

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

                // 1. 展示台背景 (Shelf) - 仅非装饰类显示台子，或者都显示，看你喜好
                // 假设墙纸也放在台子上卖
                const shelf = document.createElement('img');
                shelf.src = './assets/ui/shop_shelf.png';
                shelf.className = 'shelf-bg';
                card.appendChild(shelf);

                // 2. 商品图标 (Icon)
                // 检查是否有 iconFile 定义，或者拼凑路径 assets/ui/items/icon_{id}.png
                const iconPath = `./assets/ui/items/icon_${item.id}.png`;
                
                const iconImg = document.createElement('img');
                iconImg.className = 'item-icon';
                iconImg.src = iconPath;
                
                // [备用方案] 图片加载失败时，显示色块
                iconImg.onerror = function() {
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

        window.startNewPlacement = function(id) {
            const item = FURNITURE_DB.find(i => i.id === id);
            if (heartScore < item.price && !activeDecorId[item.decorType]) { alert("金钱不足"); return; } 
            if (item.type === 'decor') { handleDecorClick(item); return; }
            deselect(); mode = 'placing_new'; currentItemData = item; currentRotation = 0; createGhost(); updateStatusText("放置: " + item.name); document.querySelectorAll('.item-btn').forEach(b => b.classList.remove('selected'));
        }

        function handleDecorClick(item) {
            const type = item.decorType;
            if (activeDecorId[type] === item.id) { activeDecorId[type] = null; restoreDecorState(type); updateStatusText("已恢复默认样式"); } 
            else { if (heartScore >= item.price) { updateMoney(-item.price); activeDecorId[type] = item.id; applyDecorVisuals(item); updateStatusText("已装修: " + item.name); } else { alert("金钱不足！"); } }
            renderShopItems('decor'); 
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
            else { alert("金钱不足!"); 
            cancelPlace(); 
            gameSaveManager.saveGame();
            return; } 
            }
            
            let m = ghostMesh.clone();
            m.traverse(c => { 
                if (c.isMesh) { 
                    c.material.opacity = 1.0; 
                    c.material.transparent = false; 
                    if (!currentItemData.modelFile) c.material.color.setHex(currentItemData.color || 0xffffff); 
                } 
            });
            
            const newFurniture = new Furniture(m, currentItemData, furnitureCallbacks);
            scene.add(m); 
            placedFurniture.push(m);

            // [新增] 日记埋点：购买家具
            if (mode === 'placing_new') {
                const typeKey = (currentItemData.type === 'floor') ? 'buy_floor' : 'buy_small';
                
                // [关键修复] 必须传入 id: currentItemData.id
                // 这样 logEvent 才能去 specific_items 里查找有没有 'ChrismasTree' 的专用吐槽
                // [修改] 调用 logEvent，给购买事件一个权重
                diaryManager.logEvent(typeKey, {
                    item: currentItemData.name, 
                    id: currentItemData.id 
                }, 60); // 购买事件权重高一点
            }


            if(currentItemData.light) {
                if (currentItemData.lightType === 'point') { 
                    const bulb = new THREE.PointLight(0xffaa00, 0.8, 5); 
                    let lx = 0, ly = 0.3, lz = 0;
                    if (currentItemData.lightOffset) { lx = currentItemData.lightOffset.x || 0; ly = currentItemData.lightOffset.y || 0; lz = currentItemData.lightOffset.z || 0; }
                    bulb.position.set(lx, ly, lz); bulb.castShadow = true; m.add(bulb); 
                } else { 
                    const sl = new THREE.SpotLight(0xfff0dd, 5); sl.position.set(0,0,0); sl.target.position.set(0,0,5); sl.angle = Math.PI / 3; sl.penumbra = 0.5; sl.castShadow = true; m.add(sl); m.add(sl.target); 
                }
            }
            
            // [修复] 天空背景
            if(currentItemData.light && currentItemData.type === 'wall') { 
                 addSkyBacking(m, currentItemData.size); 
            }

            if (mode === 'placing_new' && currentItemData.layer === 1) { const savedItem = currentItemData; setTimeout(() => spawnMysteryBox(savedItem), 1000); }
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
            
            if (mode === 'idle' && e.button === 0) {
                raycaster.setFromCamera(pointer, camera);
                
                // 1. 优先检测猫咪
                let catHit = null;
                for(let cat of cats) { 
                    const hits = raycaster.intersectObject(cat.mesh, true); 
                    if(hits.length > 0) { catHit = cat; break; } 
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
            if (e.button === 0 && (mode === 'placing_new' || mode === 'moving_old') && canPlace && ghostMesh) confirmPlace();
        }

        function onUp() { 
            // 恢复视角控制
            controls.enabled = true;

            if (draggingCat) {
                draggingCat.setDragged(false);
                draggingCat = null;
                updateStatusText("放置猫咪");
            }
            else if (longPressTimer) { 
                clearTimeout(longPressTimer); 
                longPressTimer = null; 
                raycaster.setFromCamera(pointer, camera);
                for(let cat of cats) { 
                    const hits = raycaster.intersectObject(cat.mesh, true); 
                    if(hits.length > 0) { cat.pet(); return; } 
                }
            } 
        }  

        function selectObj(m, x, y) { deselect(); selectedObject = m; selectionBox = new THREE.BoxHelper(selectedObject, 0xffffff); scene.add(selectionBox); const menu = document.getElementById('context-menu'); menu.style.display = 'flex'; let px = x + 10, py = y + 10; if (px + 100 > window.innerWidth) px = window.innerWidth - 110; if (py + 100 > window.innerHeight) py = window.innerHeight - 110; menu.style.left = px + 'px'; menu.style.top = py + 'px'; updateStatusText("选中: 家具"); }
        function deselect() { selectedObject = null; if (selectionBox) { scene.remove(selectionBox); selectionBox = null; } document.getElementById('context-menu').style.display = 'none'; }
        function cancelPlace() { if (ghostMesh) scene.remove(ghostMesh); mode = 'idle'; ghostMesh = null; currentItemData = null; updateStatusText("浏览中"); }
        function cancelMove() { 
            if(mode==='moving_old'){
                if(ghostMesh) scene.remove(ghostMesh);
                
                if(selectedObject){
                    selectedObject.position.copy(editingObjectOriginalPos);
                    selectedObject.quaternion.copy(editingObjectOriginalQuat);
                    selectedObject.visible=true;
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
            deselect(); mode='idle'; ghostMesh=null; 
        }
        
        function showMenu(x,y) { const m=document.getElementById('context-menu'); m.style.display='flex'; let px=x+10, py=y+10; if(px+100>window.innerWidth)px=window.innerWidth-110; if(py+100>window.innerHeight)py=window.innerHeight-110; m.style.left=px+'px'; m.style.top=py+'px'; }
        function hideContextMenu() { document.getElementById('context-menu').style.display='none'; }
        
        function startMovingOld(m) { 
            mode = 'moving_old'; 
            selectedObject = m; // 记录当前正在搬运的真身
            
            // 1. 隐藏真身
            m.visible = false; 
            
            // 2. 初始化数据
            editingObjectOriginalPos = m.position.clone(); 
            editingObjectOriginalQuat = m.quaternion.clone(); 
            currentItemData = m.userData.parentClass ? m.userData.parentClass.dbItem : FURNITURE_DB[0]; 
            currentRotation = m.rotation.y; 
            
            // 3. 创建主体的虚影
            createGhost(); 
            updateStatusText("正在移动..."); 

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
                    
                    // 如果是放在家具上，稍微处理一下，避免穿模太深
                    // 这里简单处理：直接吸附到射线击中点
                    draggingCat.mesh.position.set(hit.point.x, targetY, hit.point.z);
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
                        const offset = currentItemData.size.z / 2 + 0.01;
                        const pos = h.point.clone().add(n.clone().multiplyScalar(offset));
                        if (Math.abs(n.x) > 0.5) { pos.y = Math.round(pos.y / 0.5) * 0.5; pos.z = Math.round(pos.z / 0.5) * 0.5; } 
                        else { pos.x = Math.round(pos.x / 0.5) * 0.5; pos.y = Math.round(pos.y / 0.5) * 0.5; }
                        const hh = currentItemData.size.y / 2; if (pos.y < hh) pos.y = hh; if (pos.y + hh > 3) pos.y = 3 - hh;
                        ghostMesh.position.copy(pos); ghostMesh.lookAt(pos.clone().add(n)); checkColl(true);
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
                                const finalOffset = attach.offset.clone().applyAxisAngle(new THREE.Vector3(0,1,0), rotDiff);
                                
                                attach.ghostMesh.position.copy(ghostMesh.position).add(finalOffset);
                                
                                // 2. 更新旋转
                                // 小物的旋转 = 初始旋转 + 旋转差值
                                attach.ghostMesh.rotation.y = attach.initialRotation + rotDiff;
                            });
                        }
                    }
                }
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
                         const finalOffset = attach.offset.clone().applyAxisAngle(new THREE.Vector3(0,1,0), rotDiff);
                         attach.ghostMesh.position.copy(ghostMesh.position).add(finalOffset);
                         attach.ghostMesh.rotation.y = attach.initialRotation + rotDiff;
                    });
                }
                
                checkColl(false); 
            } 
        }

        function playBounce(m) { let f=0; const baseScale = m.userData.parentClass.dbItem.modelScale || 1; function a(){ if(f<20){const k=f/20; const s=0.1+(0.9)*(Math.sin(k*Math.PI*1.5)*0.2+k); m.scale.set(baseScale*s, baseScale*s, baseScale*s); f++; requestAnimationFrame(a); }else m.scale.set(baseScale, baseScale, baseScale); } a(); }
        // [新增] 玩具挤压动画 (模拟物理弹性)
        function playToyAnim(mesh) {
            let frame = 0;
            const originalScale = mesh.userData.parentClass.dbItem.modelScale || 1.0;
            
            function animate() {
                frame++;
                // 简单的弹性公式：前10帧变扁，后10帧弹回
                if (frame <= 5) {
                    // 压扁：Y轴变小，XZ轴变大
                    const s = 1.0 - (frame / 5) * 0.3; // 压扁 30%
                    const s_fat = 1.0 + (frame / 5) * 0.1; 
                    mesh.scale.set(originalScale * s_fat, originalScale * s, originalScale * s_fat);
                } else if (frame <= 15) {
                    // 回弹：甚至稍微拉长一点 (Q弹感)
                    const t = (frame - 5) / 10;
                    const s = 0.7 + t * 0.4; // 0.7 -> 1.1
                    const s_thin = 1.1 - t * 0.15;
                    mesh.scale.set(originalScale * s_thin, originalScale * s, originalScale * s_thin);
                } else if (frame <= 20) {
                    // 恢复正常
                    mesh.scale.set(originalScale, originalScale, originalScale);
                    return; // 结束动画
                }
                requestAnimationFrame(animate);
            }
            animate();
        }
        
        
        function onWindowResize() { 
            const aspect = window.innerWidth / window.innerHeight; 
            const d = 8; 
            
            camera.left = -d * aspect; camera.right = d * aspect; camera.top = d; camera.bottom = -d; 
            camera.updateProjectionMatrix(); 
            renderer.setSize(window.innerWidth, window.innerHeight);
            

            // [新增] 更新移轴 Shader 的屏幕尺寸
            if (composer) {
                composer.setSize(window.innerWidth, window.innerHeight);
                composer.passes.forEach(pass => {
                    // 找到我们的移轴 Pass 并更新 aspect
                    if (pass.uniforms && pass.uniforms['aspect']) {
                        pass.uniforms['aspect'].value = window.innerWidth / window.innerHeight;
                    }
                });

            }

            // [新增] 更新天空 Shader 的分辨率
            if (weatherSystem && weatherSystem.skyMat) {
                weatherSystem.skyMat.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
                // 同步更新窗户材质的分辨率
                weatherSystem.windowMaterials.forEach(mat => {
                    if (mat && mat.uniforms && mat.uniforms.resolution) {
                        mat.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
                    }
                });
            }



        }


        function updateCameraMovement(dt) {
            if (!(moveKeys.w || moveKeys.a || moveKeys.s || moveKeys.d)) return;
            const moveSpeed = 10.0 * dt;
            const displacement = new THREE.Vector3();
            const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
            const right = new THREE.Vector3(); right.crossVectors(forward, camera.up).normalize();
            if (moveKeys.w) displacement.add(forward.multiplyScalar(moveSpeed));
            if (moveKeys.s) displacement.sub(forward.multiplyScalar(moveSpeed));
            if (moveKeys.d) displacement.add(right.multiplyScalar(moveSpeed));
            if (moveKeys.a) displacement.sub(right.multiplyScalar(moveSpeed));
            camera.position.add(displacement); controls.target.add(displacement);
        }

        function animate() {
            requestAnimationFrame(animate);
            const dt = gameClock.getDelta(); 
            updateCameraMovement(dt);
            controls.update();
            updateEnvironment(dt);
            cats.forEach(c => c.update(dt)); 
            if(selectionBox) selectionBox.update();
            
            // [修改] 使用 composer 替代 renderer
            // renderer.render(scene, camera);  <-- 删掉或注释这行
            if (composer) composer.render();    // <-- 改用这行
            else renderer.render(scene, camera); // 降级兼容
        }

        function startGame() {
            try {
                logToScreen("Initializing Renderer & Scene...");
                setDomText('heart-text-display', heartScore);
                window.switchCategory('floor'); 
                
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

                const aspect = window.innerWidth / window.innerHeight; 
                // [修改] 将 d=12 改为 d=9 (数值越小，镜头越近)
                const d=8; 
                // [修复1] 调整相机剪裁面 (防止近处闪黑片)
                // near 改为 -100 (关键！允许渲染相机后方的物体，防止旋转时被切掉)
                // far 改为 1000 (足够远)
                camera = new THREE.OrthographicCamera(-d*aspect, d*aspect, d, -d, -100, 1000); 

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
                controls.maxPolarAngle = Math.PI/2.1;

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
                        if(timeResetBtn) timeResetBtn.style.color = '#999'; 
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
                        if(hudSlider) hudSlider.value = vH;
                    };
                }

                // [新增] 日志调试函数的空壳 (防止报错)
                //window.debugGenDiary = function() { console.log("待实现: 生成日记"); updateStatusText("Debug: 生成日记 (待实现)"); };
                //window.debugClearDiary = function() { console.log("待实现: 清空日记"); updateStatusText("Debug: 清空日记 (待实现)"); };


                window.addEventListener('keydown', (e) => {
                    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
                    const key = e.key.toLowerCase();
                    if (key === 'r' && ghostMesh && currentItemData.type !== 'wall') { rotateItem(); }
                    switch (key) { case 'w': moveKeys.w = true; break; case 'a': moveKeys.a = true; break; case 's': moveKeys.s = true; break; case 'd': moveKeys.d = true; break; }
                });
                window.addEventListener('keyup', (e) => {
                    const key = e.key.toLowerCase();
                    switch (key) { case 'w': moveKeys.w = false; break; case 'a': moveKeys.a = false; break; case 's': moveKeys.s = false; break; case 'd': moveKeys.d = false; break; }
                });
                
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
                
                const wm=new THREE.MeshStandardMaterial({color:DEFAULT_DECOR.wall.color});
                const w1=new THREE.Mesh(new THREE.BoxGeometry(10,3,0.5), wm); w1.position.set(0,1.5,-5.25); w1.receiveShadow=true; w1.castShadow=true; scene.add(w1); obstacles.push(w1);
                const w2=new THREE.Mesh(new THREE.BoxGeometry(0.5,3,10), wm); w2.position.set(-5.25,1.5,0); w2.receiveShadow=true; w2.castShadow=true; scene.add(w2); obstacles.push(w2);
                wallGroup = [w1, w2];
                
                logToScreen("Spawning Cat...");
                
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
                                    if(itemConfig.light) {
                                        if (itemConfig.lightType === 'point') { 
                                            const bulb = new THREE.PointLight(0xffaa00, 0.8, 5); 
                                            let lx = 0, ly = 0.3, lz = 0;
                                            if (itemConfig.lightOffset) { lx = itemConfig.lightOffset.x || 0; ly = itemConfig.lightOffset.y || 0; lz = itemConfig.lightOffset.z || 0; }
                                            bulb.position.set(lx, ly, lz); bulb.castShadow = true; modelGroup.add(bulb); 
                                        } else { 
                                            const sl = new THREE.SpotLight(0xfff0dd, 5); sl.position.set(0,0,0); sl.target.position.set(0,0,5); sl.angle = Math.PI / 3; sl.penumbra = 0.5; sl.castShadow = true; modelGroup.add(sl); modelGroup.add(sl.target); 
                                        }
                                        if(itemConfig.type === 'wall') addSkyBacking(modelGroup, itemConfig.size);
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




                window.addEventListener('resize', onWindowResize); window.addEventListener('pointermove', onMove); window.addEventListener('pointerdown', onDown); window.addEventListener('pointerup', onUp);
                window.addEventListener('contextmenu', (e)=>{ e.preventDefault(); if(mode==='placing_new') cancelPlace(); else if(mode==='moving_old') cancelMove(); else deselect(); });
                
                document.getElementById('btn-move').onclick=()=>{if(selectedObject)startMovingOld(selectedObject);hideContextMenu();}
                document.getElementById('btn-delete').onclick=()=>{if(selectedObject)deleteSelected();hideContextMenu();}
                document.getElementById('btn-cancel').onclick=()=>{deselect();hideContextMenu();}

                // === [新增] 在 startGame 底部调用后期处理初始化 ===
                initPostProcessing();

                logToScreen("Game Loop Starting...");
                animate();
            } catch(e) {
                console.error(e);
                logToScreen("STARTGAME CRASH: " + e.message, 'error');
            }
        }

        // === [新增] 全局日记实例与交互函数 ===
        const diaryManager = new DiaryManager(DIARY_CONFIG, updateStatusText);

        // [新增] 关键修复：把实例挂载到 window，让 HTML 里的 onclick 能找到它
        window.diaryManager = diaryManager; 

        // [修改] window.toggleDiary: 打开时触发 flushPendingEvents
        // [修改] 日记开关逻辑：修正音效播放位置
        window.toggleDiary = function() {
            const modal = document.getElementById('diary-modal');
            
            if (modal.classList.contains('hidden')) {
                // === 打开日记 ===
                modal.classList.remove('hidden');
                
                // 业务逻辑
                diaryManager.flushPendingEvents(); 
                diaryManager.viewingDate = new Date(); 
                diaryManager.renderPage();
                diaryManager.updateUIHint(false);

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
        window.debugGenDiary = function() {
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
            diaryManager.updateUIHint(true);
            // 如果日记开着，刷新页面
            const modal = document.getElementById('diary-modal');
            if (modal && !modal.classList.contains('hidden')) {
                diaryManager.renderPage();
            }
        };
        // debugClearDiary 保持不变

        window.debugClearDiary = function() {
            diaryManager.clearAll();
            updateStatusText("日记已清空");
        };

        // [新增] UI 交互函数
        window.toggleTimePopover = function() {
            const pop = document.getElementById('time-popover');
            if (pop) pop.classList.toggle('hidden');
        };

        // [新增] 调试：开关阳光阴影
        window.toggleShadows = function() {
            if (sunLight) {
                sunLight.castShadow = !sunLight.castShadow;
                
                // 强制更新材质，确保渲染生效
                scene.traverse(c => {
                    if (c.material) c.material.needsUpdate = true;
                });
                
                updateStatusText("阳光阴影: " + (sunLight.castShadow ? "开" : "关"));
            }
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
            thumb.onmousedown = function(e) {
                e.preventDefault(); // 防止选中文字
                thumb.dataset.isDragging = 'true';
                thumb.style.transition = 'none'; // 拖拽时要实时跟手，关掉动画

                const startX = e.clientX;
                const startLeft = parseFloat(thumb.style.left || 0);
                const trackWidth = track.clientWidth;
                const thumbWidth = 50;
                const maxLeft = trackWidth - thumbWidth;
                const maxScrollLeft = container.scrollWidth - container.clientWidth;

                // 绑定全局移动事件
                document.onmousemove = function(moveEvent) {
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
                document.onmouseup = function() {
                    thumb.dataset.isDragging = 'false';
                    document.onmousemove = null;
                    document.onmouseup = null;
                };
            };

            // 初始化一次
            updateThumbPosition();
        }

        window.toggleShop = function() {
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




        function init() { try { loadAssets(() => { updateStatusText("资源加载完毕"); const ls = document.getElementById('loading-screen'); if(ls) ls.style.display = 'none'; if(!scene) startGame(); }); } catch(e) { console.error(e); alert("Init Error: " + e.message); } }
        
        init();