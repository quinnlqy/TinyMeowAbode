import { LOCALES } from '../data/Locales.js';

export class LocalizationManager {
    constructor() {
        this.currentLang = localStorage.getItem('cat_game_language') || 'zh-CN';
        this.listeners = [];
    }

    // 设置语言
    setLanguage(lang) {
        if (!LOCALES[lang]) {
            console.warn(`Language ${lang} not found, falling back to zh-CN`);
            lang = 'zh-CN';
        }
        this.currentLang = lang;
        localStorage.setItem('cat_game_language', lang);

        // 更新页面上的静态文本
        this.updateStaticUI();

        // 通知监听器（如 ShopManager, DiaryManager）
        this.notifyListeners();
    }

    // 获取翻译文本
    getText(key) {
        const localeData = LOCALES[this.currentLang];
        return localeData[key] || key;
    }

    // 获取当前语言代码
    getLanguage() {
        return this.currentLang;
    }

    // 注册语言变更监听
    addListener(callback) {
        this.listeners.push(callback);
    }

    notifyListeners() {
        this.listeners.forEach(callback => callback(this.currentLang));
    }

    // 更新带有 data-i18n 属性的 DOM 元素
    updateStaticUI() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const text = this.getText(key);
            if (text) {
                // 如果是 INPUT 且是 button/submit 类型，更新 value
                if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit')) {
                    el.value = text;
                } else {
                    el.innerText = text;
                }
            }
        });

        // 特殊处理：更新 html 的 lang 属性
        document.documentElement.lang = this.currentLang;
    }
}

// 单例模式导出
export const localizationManager = new LocalizationManager();
