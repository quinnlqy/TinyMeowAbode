/**
 * FurnitureDB.js - 家具数据库
 * 包含所有可购买家具的配置信息
 * 
 * 墙面家具配置说明 (type: 'wall'):
 * - wallFace: 定义模型的哪一面是贴墙面，取值为:
 *   - 'back'   或 '+z' : 模型的背面(+Z方向)贴墙 (默认值)
 *   - 'front'  或 '-z' : 模型的正面(-Z方向)贴墙
 *   - 'left'   或 '-x' : 模型的左侧(-X方向)贴墙
 *   - 'right'  或 '+x' : 模型的右侧(+X方向)贴墙
 */

export const FURNITURE_DB = [
    {
        id: 'food_bowl', name: '猫食盆', price: 50, type: 'functional', subType: 'food', color: 0xffffff,
        modelFile: 'FoodBowl_Empty.glb',
        fullModelFile: 'FoodBowl_Full.glb',
        modelScale: 0.3, fixBottom: true, size: { x: 0.5, y: 0.3, z: 0.5 }
    },
    {
        id: 'litter_box', name: '猫砂盆', price: 80, type: 'functional', subType: 'toilet', color: 0x888888,
        modelFile: 'LitterBox_Dirty.glb',
        fullModelFile: 'LitterBox_Clean.glb',
        modelScale: 0.5, fixBottom: true, size: { x: 1.0, y: 0.4, z: 1.0 }
    },
    { id: 'rug', type: 'floor', layer: 0, name: '圆地毯', price: 20, color: 0x3498db, size: { x: 2, y: 0.02, z: 2 }, modelFile: 'RoundRug.glb', modelScale: 1.5, yFix: 0.02, autoCenter: true },
    { id: 'rug_squre', type: 'floor', layer: 0, name: '方地毯', price: 20, color: 0x3498db, size: { x: 2, y: 0.02, z: 2 }, modelFile: 'rug_squre.glb', modelScale: 1.5, yFix: 0.02, autoCenter: true },
    { id: 'bed', type: 'floor', layer: 1, name: '猫窝', price: 40, color: 0xe67e22, size: { x: 1, y: 0.5, z: 0.8 }, modelFile: 'bed.glb', modelScale: 0.8, canSleep: true, fixBottom: true },
    { id: 'PetBed', type: 'floor', layer: 1, name: '竹编猫窝', price: 40, color: 0xe67e22, size: { x: 1, y: 0.5, z: 0.8 }, modelFile: 'PetBed.glb', modelScale: 0.6, canSleep: true, fixBottom: true },

    { id: 'sofa', type: 'floor', layer: 1, name: '大沙发', price: 150, color: 0xe74c3c, size: { x: 3, y: 1, z: 1 }, modelFile: 'sofa.glb', modelScale: 2.0, canSleep: true, fixBottom: true },
    { id: 'ArmChair', type: 'floor', layer: 1, name: '扶手椅', price: 150, color: 0xe74c3c, size: { x: 1.2, y: 1, z: 1.2 }, modelFile: 'ArmChair.glb', modelScale: 1.0, canSleep: true, fixBottom: true },
    { id: 'CozyChair', type: 'floor', layer: 1, name: '单人沙发', price: 150, color: 0xe74c3c, size: { x: 1.2, y: 1, z: 1.2 }, modelFile: 'CozyChair.glb', modelScale: 0.9, canSleep: true, fixBottom: true },

    { id: 'ArmChair2', type: 'floor', layer: 1, name: '绿色椅子', price: 100, color: 0xe74c3c, size: { x: 1.2, y: 0.6, z: 1.2 }, modelFile: 'Chair.glb', modelScale: 0.8, canSleep: true, fixBottom: true },
    { id: 'Chair_Comfort', type: 'floor', layer: 1, name: '摇摇椅', price: 100, color: 0xe74c3c, size: { x: 1, y: 0.6, z: 1 }, modelFile: 'Chair_Comfort.glb', modelScale: 0.8, canSleep: true, fixBottom: true },
    { id: 'PersonBed', type: 'floor', layer: 1, name: '床', price: 100, color: 0xe74c3c, size: { x: 2, y: 1.2, z: 2 }, modelFile: 'PersonBed.glb', modelScale: 1.6, canSleep: true, fixBottom: true },

    { id: 'TeaSetTable', type: 'floor', layer: 1, name: '茶台', price: 100, color: 0xe74c3c, size: { x: 1.2, y: 1, z: 1.2 }, modelFile: 'TeaSetTable.glb', modelScale: 0.6, canSleep: false, fixBottom: true },
    { id: 'TelevisionTable', type: 'floor', layer: 1, name: '电视柜', price: 100, color: 0xe74c3c, size: { x: 1.2, y: 1, z: 1.2 }, modelFile: 'TelevisionTable.glb', modelScale: 1.5, canSleep: false, fixBottom: true },
    { id: 'Folding_Screen', type: 'floor', layer: 1, name: '屏风', price: 100, color: 0xe74c3c, size: { x: 1.2, y: 1, z: 1.2 }, modelFile: 'Folding_Screen.glb', modelScale: 2, canSleep: false, fixBottom: true },
    { id: 'Cushion_Roundel', type: 'floor', layer: 1, name: '圆垫子', price: 40, color: 0xe67e22, size: { x: 1, y: 0.2, z: 0.8 }, modelFile: 'Cushion_Roundel.glb', modelScale: 0.5, canSleep: true, fixBottom: true },
    { id: 'Go_Board', type: 'floor', layer: 1, name: '围棋', price: 40, color: 0xe67e22, size: { x: 1, y: 0.6, z: 1 }, modelFile: 'Go_Board.glb', modelScale: 0.6, canSleep: true, fixBottom: true },
    { id: 'Closet', type: 'floor', layer: 1, name: '衣柜', price: 40, color: 0xe67e22, size: { x: 2, y: 3.0, z: 0.8 }, modelFile: 'Closet.glb', modelScale: 1.6, canSleep: false, fixBottom: true },
    { id: 'Cabinet', type: 'floor', layer: 1, isSurface: true, name: '矮柜', price: 40, color: 0xe67e22, size: { x: 1, y: 1, z: 0.8 }, modelFile: 'Cabinet.glb', modelScale: 0.5, canSleep: false, fixBottom: true },
    { id: 'WoodenCabi', type: 'floor', layer: 1, isSurface: true, name: '矮木柜', price: 40, color: 0xe67e22, size: { x: 1.5, y: 1.2, z: 0.8 }, modelFile: 'WoodenCabi.glb', modelScale: 0.8, canSleep: false, fixBottom: true },

    { id: 'GreenCabinet', type: 'floor', layer: 1, isSurface: true, name: '绿柜子', price: 40, color: 0xe67e22, size: { x: 1.5, y: 1.6, z: 1 }, modelFile: 'GreenCabinet.glb', modelScale: 1.0, canSleep: false, fixBottom: true },
    { id: 'BathroomCabinet', type: 'floor', layer: 1, isSurface: true, name: '洗手池', price: 40, color: 0xe67e22, size: { x: 1.2, y: 1.3, z: 1.2 }, modelFile: 'BathroomCabinet.glb', modelScale: 1.0, canSleep: false, fixBottom: true },

    { id: 'cat_tree', type: 'floor', layer: 1, name: '猫爬架', price: 100, color: 0x8e44ad, size: { x: 1, y: 1.8, z: 1 }, modelFile: 'cat_tree.glb', modelScale: 1.0, fixBottom: true },
    { id: 'CatPlayground', type: 'floor', layer: 1, name: '木制猫爬架', price: 100, color: 0x8e44ad, size: { x: 1, y: 1.8, z: 1 }, modelFile: 'CatPlayground.glb', modelScale: 1.0, fixBottom: true },

    { id: 'book_shelf', type: 'floor', layer: 1, name: '书架', price: 100, color: 0x8e44ad, size: { x: 2, y: 2, z: 1 }, modelFile: 'book_shelf.glb', modelScale: 1.0, fixBottom: true, isSurface: true, surfaceHeight: 2.0 },

    { id: 'CafeTree', type: 'floor', layer: 1, name: '大盆栽', price: 100, color: 0x8e44ad, size: { x: 1, y: 2, z: 1 }, modelFile: 'CafeTree.glb', modelScale: 1.0, fixBottom: true },
    { id: 'PottedGreenPlant', type: 'floor', layer: 1, name: '大盆栽', price: 100, color: 0x8e44ad, size: { x: 1, y: 2, z: 1 }, modelFile: 'PottedGreenPlant.glb', modelScale: 1.0, fixBottom: true },
    { id: 'GreenPlant', type: 'floor', layer: 1, name: '盆栽', price: 100, color: 0x8e44ad, size: { x: 1, y: 2, z: 1 }, modelFile: 'GreenPlant.glb', modelScale: 1.0, fixBottom: true },
    { id: 'OrangeTree', type: 'floor', layer: 1, name: '橘子盆摘', price: 100, color: 0x8e44ad, size: { x: 1, y: 2, z: 1 }, modelFile: 'OrangeTree.glb', modelScale: 1.0, fixBottom: true },

    { id: 'Television', type: 'floor', layer: 1, name: '电视', price: 100, color: 0x8e44ad, size: { x: 1.9, y: 1.5, z: 0.8 }, modelFile: 'Television.glb', modelScale: 1.0, fixBottom: true },
    { id: 'table', type: 'floor', layer: 1, isSurface: true, surfaceHeight: 0.8, name: '木桌', price: 60, color: 0x8d6e63, size: { x: 1.5, y: 0.6, z: 1.5 }, modelFile: 'table.glb', modelScale: 1.0, fixBottom: true },
    { id: 'Tabletop', type: 'floor', layer: 1, isSurface: true, name: '绿色小桌', price: 40, color: 0xe67e22, size: { x: 0.8, y: 0.8, z: 0.8 }, modelFile: 'Tabletop.glb', modelScale: 0.5, canSleep: false, fixBottom: true },
    { id: 'FlowerStool', type: 'floor', layer: 1, isSurface: true, name: '小花桌', price: 40, color: 0xe67e22, size: { x: 0.8, y: 0.8, z: 0.8 }, modelFile: 'FlowerStool.glb', modelScale: 0.5, canSleep: false, fixBottom: true },

    {
        id: 'ChrismasTree',
        type: 'floor',
        layer: 1,
        name: '圣诞树',
        price: 100,
        color: 0x8d6e63,
        size: { x: 1.5, y: 2, z: 1.5 },
        modelFile: 'ChrismasTree2.glb',
        modelScale: 1.5,
        fixBottom: true,
        light: true,
        lightType: 'point',
        lightOffset: { x: 0, y: 1.8, z: 0 }
    },
    { id: 'fireplace', type: 'floor', layer: 1, name: '壁炉', price: 100, color: 0x8d6e63, size: { x: 1.5, y: 1.5, z: 1 }, modelFile: 'fireplace.glb', modelScale: 1.8, fixBottom: true },
    { id: 'frigerator', type: 'floor', layer: 1, name: '冰箱', price: 100, color: 0x8d6e63, size: { x: 1.5, y: 1.5, z: 1 }, modelFile: 'frigerator.glb', modelScale: 1.0, fixBottom: true },
    { id: 'RobotVacuum', type: 'floor', layer: 1, name: '扫地机器人', price: 100, color: 0x8d6e63, size: { x: 0.8, y: 0.3, z: 0.8 }, modelFile: 'RobotVacuum.glb', modelScale: 0.5, fixBottom: true, isVehicle: true, moveSpeed: 1.5 },

    { id: 'mug', type: 'small', layer: 2, name: '马克杯', price: 5, color: 0xffffff, size: { x: 0.3, y: 0.3, z: 0.3 }, modelFile: 'mug.glb', modelScale: 0.2, fixBottom: true },
    { id: 'DalMug', type: 'small', layer: 2, name: '马克杯蓝', price: 5, color: 0xffffff, size: { x: 0.3, y: 0.3, z: 0.3 }, modelFile: 'DalMug.glb', modelScale: 0.8, fixBottom: true },
    { id: 'CoffeeCup', type: 'small', layer: 2, name: '咖啡杯', price: 5, color: 0xffffff, size: { x: 0.3, y: 0.3, z: 0.3 }, modelFile: 'CoffeeCup.glb', modelScale: 0.8, fixBottom: true },
    { id: 'PumpkinDrink', type: 'small', layer: 2, name: '南瓜咖啡', price: 5, color: 0xffffff, size: { x: 0.3, y: 0.3, z: 0.3 }, modelFile: 'PumpkinDrink.glb', modelScale: 0.2, fixBottom: true },

    { id: 'BlossomVase', type: 'small', layer: 2, name: '小花瓶', price: 5, color: 0xffffff, size: { x: 0.3, y: 0.3, z: 0.3 }, modelFile: 'BlossomVase.glb', modelScale: 0.3, fixBottom: true },

    { id: 'Phonograph', type: 'small', layer: 2, name: '唱片机', price: 5, color: 0xffffff, size: { x: 0.3, y: 0.3, z: 0.3 }, modelFile: 'Phonograph.glb', modelScale: 0.5, fixBottom: true },
    { id: 'WovenElegance', type: 'small', layer: 2, name: '竹编包', price: 5, color: 0xffffff, size: { x: 0.3, y: 0.3, z: 0.3 }, modelFile: 'WovenElegance.glb', modelScale: 0.3, fixBottom: true },

    { id: 'ToyCarrot', type: 'small', layer: 2, name: '胡萝卜', price: 5, color: 0xffffff, size: { x: 0.3, y: 0.3, z: 0.3 }, modelFile: 'Carrot.glb', modelScale: 0.3, fixBottom: true, isToy: true },

    {
        id: 'ChrismasTree_Small',
        type: 'small',
        layer: 2,
        name: '小圣诞树',
        price: 5,
        color: 0xffffff,
        size: { x: 0.3, y: 0.3, z: 0.3 },
        modelFile: 'ChrismasTree_Small.glb',
        modelScale: 1.0,
        fixBottom: true,
        light: true,
        lightType: 'point',
        lightOffset: { x: 0, y: 0.25, z: 0 }
    },

    { id: 'lamp', type: 'small', layer: 2, name: '台灯', price: 25, color: 0xf1c40f, size: { x: 0.4, y: 0.6, z: 0.4 }, light: true, lightType: 'point', modelFile: 'lamp.glb', modelScale: 1.0, fixBottom: true },
    { id: 'tiffany_lamp', type: 'small', layer: 2, name: '精致台灯', price: 25, color: 0xf1c40f, size: { x: 0.4, y: 0.6, z: 0.4 }, light: true, lightType: 'point', modelFile: 'tiffany_lamp.glb', modelScale: 0.4, fixBottom: true },

    { id: 'floor_lamp', type: 'small', layer: 2, name: '落地灯', price: 25, color: 0xf1c40f, size: { x: 0.4, y: 0.6, z: 0.4 }, light: true, lightType: 'point', modelFile: 'floor_lamp.glb', modelScale: 1.0, fixBottom: true, lightOffset: { x: 0, y: 1.8, z: 0 } },
    { id: 'cutelamp', type: 'small', layer: 2, name: '可爱落地灯', price: 25, color: 0xf1c40f, size: { x: 0.4, y: 0.6, z: 0.4 }, light: true, lightType: 'point', modelFile: 'cutelamp.glb', modelScale: 1.0, fixBottom: true, lightOffset: { x: 0, y: 1.8, z: 0 } },
    { id: 'Cupboardlamp', type: 'small', layer: 2, name: '柜子灯', price: 25, color: 0xf1c40f, size: { x: 0.4, y: 0.6, z: 0.4 }, light: true, lightType: 'point', modelFile: 'Cupboardlamp.glb', modelScale: 0.6, fixBottom: true, lightOffset: { x: 0, y: 1.8, z: 0 } },

    { id: 'wall_plant', type: 'wall', layer: 1, name: '壁挂植物', price: 20, color: 0x2ecc71, size: { x: 2, y: 0.5, z: 0.5 }, modelFile: 'wall_plant.glb', modelScale: 0.8 },
    { id: 'WallBooksShelf', type: 'wall', layer: 1, name: '壁挂书架', price: 20, color: 0x2ecc71, size: { x: 2, y: 0.5, z: 0.5 }, modelFile: 'WallBooksShelf.glb', modelScale: 0.6 },

    { id: 'WoodenCabinet', type: 'wall', layer: 1, name: '壁柜', price: 20, color: 0x2ecc71, size: { x: 0.5, y: 0.5, z: 2.0 }, modelFile: 'WoodenCabinet.glb', wallFace: 'left', modelScale: 0.8 },
    { id: 'WallClock', type: 'wall', layer: 1, name: '挂钟', price: 20, color: 0x2ecc71, size: { x: 0.6, y: 0.5, z: 0.5 }, modelFile: 'WallClock.glb', modelScale: 0.5 },
    { id: 'CalligraphyFu', type: 'wall', layer: 1, name: '春节福', price: 20, color: 0x2ecc71, size: { x: 0.6, y: 0.5, z: 0.5 }, modelFile: 'CalligraphyFu.glb', modelScale: 0.5 },
    { id: 'XingshiMask', type: 'wall', layer: 1, name: '醒狮面具', price: 20, color: 0x2ecc71, size: { x: 0.6, y: 0.5, z: 0.5 }, modelFile: 'XingshiMask.glb', modelScale: 0.5 },
    { id: 'RedKnot', type: 'wall', layer: 1, name: '中国结', price: 20, color: 0x2ecc71, size: { x: 0.6, y: 0.5, z: 0.5 }, modelFile: 'RedKnot.glb', modelScale: 0.5 },

    { id: 'painting', type: 'wall', layer: 1, name: '风景画', price: 50, color: 0xFFD700, size: { x: 1, y: 1, z: 0.1 }, modelFile: 'painting.glb', modelScale: 1.0 },
    { id: 'curtain', type: 'wall', layer: 1, name: '窗帘', price: 80, color: 0xFFFFFF, size: { x: 2.0, y: 2.0, z: 0.5 }, modelFile: 'curtain.glb', modelScale: 1.5, autoCenter: true, allowOverlap: true },
    { id: 'wall_star', type: 'wall', layer: 1, name: '星星挂饰', price: 30, color: 0xFFFF00, size: { x: 0.5, y: 0.5, z: 0.5 }, modelFile: 'WallDecorate_Star.glb', modelScale: 1.0, autoCenter: true, allowOverlap: true },
    { id: 'ChrismaxSock', type: 'wall', layer: 1, name: '圣诞袜', price: 30, color: 0xFFFF00, size: { x: 0.5, y: 0.5, z: 0.5 }, modelFile: 'ChrismaxSock.glb', modelScale: 1.0, autoCenter: true, allowOverlap: true },

    { id: 'window', type: 'wall', layer: 1, name: '大窗', price: 120, color: 0x87CEEB, size: { x: 1.8, y: 1.8, z: 0.2 }, light: true, lightType: 'spot', modelFile: 'window_large.glb', autoCenter: true, modelScale: 1, manualOffset: { x: 0, y: 0, z: 0 } },
    { id: 'window2', type: 'wall', layer: 1, name: '窗2', price: 120, color: 0x87CEEB, size: { x: 1.8, y: 2, z: 0.2 }, light: true, lightType: 'spot', modelFile: 'Window2.glb', modelScale: 1, autoCenter: true },

    // 装饰类型 - 地板
    { id: 'floor_wood', type: 'decor', name: '木纹地板', price: 50, color: 0x8d6e63, decorType: 'floor', textureFile: 'WoodenFloor.jpg' },
    { id: 'floor_tile', type: 'decor', name: '白瓷砖', price: 50, color: 0xdbc2a3, decorType: 'floor', textureFile: 'tile.jpg' },
    { id: 'floor_plank', type: 'decor', name: '原木板地板', price: 60, color: 0x9e7b5d, decorType: 'floor', textureFile: 'plank_flooring_04_diff_1k.jpg' },
    { id: 'floor_flower', type: 'decor', name: '花砖地板', price: 80, color: 0xe8d4c4, decorType: 'floor', textureFile: 'FlowerFloor.png' },
    { id: 'floor_darkwood', type: 'decor', name: '深色木地板', price: 70, color: 0x5d4037, decorType: 'floor', textureFile: 'wood.jpg' },
    // 装饰类型 - 墙壁
    { id: 'wall_pink', type: 'decor', name: '温馨粉墙', price: 50, color: 0xc9a2a6, decorType: 'wall' },
    { id: 'wall_blue', type: 'decor', name: '清爽蓝墙', price: 50, color: 0xb3e5fc, decorType: 'wall' },
    { id: 'wall_blueWooden', type: 'decor', name: '蓝色木墙', price: 50, color: 0xc9a2a6, decorType: 'wall', textureFile: 'BlueWooden.jpg' },
    { id: 'MintWallpaper', type: 'decor', name: '薄荷墙纸', price: 50, color: 0xc9a2a6, decorType: 'wall', textureFile: 'MintWallpaper.jpg' },
    { id: 'CatFishWallpaper', type: 'decor', name: '猫咪墙纸', price: 50, color: 0xc9a2a6, decorType: 'wall', textureFile: 'CatFishWallpaper.png', wallpaperUnitWidth: 1 },

    { id: 'WoodWallpaper', type: 'decor', name: '木纹墙纸', price: 50, color: 0xc9a2a6, decorType: 'wall', textureFile: 'Wallpaper_1.png', wallpaperStyle: 'horizontal', wallpaperUnitWidth: 1.5 },
    { id: 'AppleWallpaper', type: 'decor', name: '苹果墙纸', price: 50, color: 0xc9a2a6, decorType: 'wall', textureFile: 'Wallpaper_2.png', wallpaperStyle: 'horizontal', wallpaperUnitWidth: 1.5 },
    { id: 'floor_default', type: 'decor', name: '经典米色', price: 0, color: 0xF5F5DC, decorType: 'floor' },
    { id: 'wall_default', type: 'decor', name: '经典暖灰', price: 0, color: 0xEBE5D1, decorType: 'wall' },

    // 马年盲盒
    {
        id: 'blind_box_horse',
        type: 'small',
        layer: 2,
        name: '马年盲盒',
        price: 30,
        color: 0xffffff,
        size: { x: 0.4, y: 0.4, z: 0.4 },
        modelFile: 'giftbox.glb',
        modelScale: 0.2,
        fixBottom: true,
        isBlindBox: true,
        blindBoxPool: ['horse_figure_ponyta', 'horse_figure_black', 'horse_figure_cute']
    },
    // 隐藏款：小马手办 (不可直接购买)
    {
        id: 'horse_figure_ponyta',
        type: 'small',
        layer: 2,
        name: '烈焰小马',
        price: 0,
        color: 0xffffff,
        size: { x: 0.4, y: 0.5, z: 0.4 },
        modelFile: 'Ponyta.glb',
        modelScale: 0.4,
        fixBottom: true,
        // [修复] 向右转90度
        manualRotation: { x: 0, y: -Math.PI / 2, z: 0 },
        isToy: true,
        toyAnimation: 'jump',
        excludeFromShop: true // 不在商店显示
    },
    {
        id: 'horse_figure_black',
        type: 'small',
        layer: 2,
        name: '黑骏马',
        price: 0,
        color: 0x333333,
        size: { x: 0.4, y: 0.6, z: 0.4 },
        modelFile: 'BlackHorse.glb',
        modelScale: 0.4,
        fixBottom: true,
        isToy: true,
        toyAnimation: 'spin',
        excludeFromShop: true // 不在商店显示
    },
    {
        id: 'horse_figure_cute',
        type: 'small',
        layer: 2,
        name: '萌萌小马',
        price: 0,
        color: 0xffc0cb,
        size: { x: 0.4, y: 0.5, z: 0.4 },
        modelFile: 'cutehorse.glb',
        modelScale: 0.4,
        fixBottom: true,
        // [修复] 修正模型倒下的问题 (向后转90度)
        manualRotation: { x: -Math.PI / 2, y: 0, z: 0 },
        isToy: true,
        toyAnimation: 'bounce',
        excludeFromShop: true // 不在商店显示
    }
];
