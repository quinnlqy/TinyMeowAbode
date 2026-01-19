/**
 * FurnitureDB.js - 家具数据库
 * 包含所有可购买家具的配置信息
 */

export const FURNITURE_DB = [
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
    { id: 'ArmChair2',     type: 'floor', layer: 1, name: '绿色椅子', price: 100, color: 0xe74c3c, size: {x:1.2, y:1, z:1.2},   modelFile: 'Chair.glb', modelScale: 0.8, canSleep: true, fixBottom: true },
    { id: 'TeaSetTable',     type: 'floor', layer: 1, name: '茶台', price: 100, color: 0xe74c3c, size: {x:1.2, y:1, z:1.2},   modelFile: 'TeaSetTable.glb', modelScale: 0.6, canSleep: false, fixBottom: true },
    { id: 'TelevisionTable',     type: 'floor', layer: 1, name: '电视柜', price: 100, color: 0xe74c3c, size: {x:1.2, y:1, z:1.2},   modelFile: 'TelevisionTable.glb', modelScale: 1.5, canSleep: true, fixBottom: true },
    { id: 'Folding_Screen',     type: 'floor', layer: 1, name: '屏风', price: 100, color: 0xe74c3c, size: {x:1.2, y:1, z:1.2},   modelFile: 'Folding_Screen.glb', modelScale: 2, canSleep: false, fixBottom: true },

    { id: 'cat_tree', type: 'floor', layer: 1, name: '猫爬架', price: 100, color: 0x8e44ad, size: {x:1, y:1.8, z:1},   modelFile: 'cat_tree.glb', modelScale: 1.0 , fixBottom: true},
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
        light: true, 
        lightType: 'point', 
        lightOffset: { x: 0, y: 1.8, z: 0 } 
    },            
    { id: 'fireplace',    type: 'floor', layer: 1, name: '壁炉', price: 100,  color: 0x8d6e63, size: {x:1.5, y:1.5, z:1}, modelFile: 'fireplace.glb', modelScale: 1.8, fixBottom: true },
    { id: 'frigerator',    type: 'floor', layer: 1, name: '冰箱', price: 100,  color: 0x8d6e63, size: {x:1.5, y:1.5, z:1}, modelFile: 'frigerator.glb', modelScale: 1.0, fixBottom: true },

    { id: 'mug',      type: 'small', layer: 2, name: '马克杯', price: 5,   color: 0xffffff, size: {x:0.3, y:0.3, z:0.3}, modelFile: 'mug.glb', modelScale: 0.2, fixBottom: true },
    { id: 'DalMug',      type: 'small', layer: 2, name: '马克杯蓝', price: 5,   color: 0xffffff, size: {x:0.3, y:0.3, z:0.3}, modelFile: 'DalMug.glb', modelScale: 0.8, fixBottom: true },
    { id: 'CoffeeCup',      type: 'small', layer: 2, name: '咖啡杯', price: 5,   color: 0xffffff, size: {x:0.3, y:0.3, z:0.3}, modelFile: 'CoffeeCup.glb', modelScale: 0.8, fixBottom: true },
    { id: 'ToyCarrot',      type: 'small', layer: 2, name: '胡萝卜', price: 5,   color: 0xffffff, size: {x:0.3, y:0.3, z:0.3}, modelFile: 'Carrot.glb', modelScale: 0.3, fixBottom: true, isToy: true },

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
        light: true, 
        lightType: 'point', 
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
  
    { id: 'window',   type: 'wall',  layer: 1, name: '大窗', price: 120, color: 0x87CEEB, size: {x:1.8, y:1.8, z:0.2}, light: true, lightType: 'spot', modelFile: 'window_large.glb', autoCenter: true, modelScale: 1, manualOffset: { x: 0, y: 0, z: 0 } },
    { id: 'window2', type: 'wall',  layer: 1, name: '窗2', price: 120, color: 0x87CEEB, size: {x:1.8, y:2, z:0.2}, light: true, lightType: 'spot', modelFile: 'Window2.glb', modelScale: 1, autoCenter: true },
    
    // 装饰类型
    { id: 'floor_wood', type: 'decor', name: '木纹地板', price: 50, color: 0x8d6e63, decorType: 'floor', textureFile: 'WoodenFloor.jpg' }, 
    { id: 'floor_tile', type: 'decor', name: '白瓷砖',   price: 50, color: 0xdbc2a3, decorType: 'floor' },
    { id: 'wall_pink',  type: 'decor', name: '温馨粉墙', price: 50, color: 0xc9a2a6, decorType: 'wall' },
    { id: 'wall_blue',  type: 'decor', name: '清爽蓝墙', price: 50, color: 0xb3e5fc, decorType: 'wall' },
    { id: 'wall_blueWooden',  type: 'decor', name: '蓝色木墙', price: 50, color: 0xc9a2a6, decorType: 'wall',  textureFile: 'BlueWooden.jpg' },
    { id: 'MintWallpaper',  type: 'decor', name: '薄荷墙纸', price: 50, color: 0xc9a2a6, decorType: 'wall',  textureFile: 'MintWallpaper.jpg' },
    { id: 'WoodWallpaper',  type: 'decor', name: '木纹墙纸', price: 50, color: 0xc9a2a6, decorType: 'wall',  textureFile: 'Wallpaper_1.png', wallpaperStyle: 'horizontal', wallpaperUnitWidth: 0.8 },
    { id: 'floor_default', type: 'decor', name: '经典米色', price: 0, color: 0xF5F5DC, decorType: 'floor' },
    { id: 'wall_default',  type: 'decor', name: '经典暖灰', price: 0, color: 0xEBE5D1, decorType: 'wall' },
];
