/**
 * DiaryManager - 日记管理器
 * 管理游戏中的日记系统，包括事件记录、离线事件、节日事件等
 */

export class DiaryManager {
    constructor(diaryConfig, statusCallback = null) {
        this.DIARY_CONFIG = diaryConfig;
        this.statusCallback = statusCallback;
        
        this.storageKey = 'cat_game_diary_v1';
        this.entries = {}; // 结构: { "YYYY-MM-DD": { meta: {}, events: [] } }
        this.eventCooldowns = {};
        this.viewingDate = new Date();
        
        this.MAX_ENTRIES_PER_DAY = 10;
        this.pendingEvents = []; // 暂存池

        this.load();
        this.init();
    }

    // 初始化逻辑：处理离线事件
    init() {
        const now = Date.now();
        const lastLogin = localStorage.getItem('last_login_time');
        
        if (lastLogin) {
            const lastLoginTime = parseInt(lastLogin);
            const offlineDurationHours = (now - lastLoginTime) / (1000 * 60 * 60);

            if (offlineDurationHours >= 1) {
                this.generateOfflineEvents(offlineDurationHours);
            }
        }
        localStorage.setItem('last_login_time', now.toString());

        this.checkSpecialDayEvent();
    }

    checkSpecialDayEvent() {
        const now = new Date();
        const dateKey = `${now.getMonth() + 1}-${now.getDate()}`;
        const specialConfig = this.DIARY_CONFIG.special_days[dateKey];

        if (specialConfig) {
            const todayKey = this.getTodayKey();
            
            if (!this.entries[todayKey]) {
                this.entries[todayKey] = {
                    meta: this.generateDailyMeta(), 
                    events: []
                };
            }
            
            const dayEntry = this.entries[todayKey];

            if (dayEntry.meta.isSpecialProcessed) {
                return; 
            }

            dayEntry.meta.weather = specialConfig.weather[Math.floor(Math.random() * specialConfig.weather.length)];
            dayEntry.meta.mood = specialConfig.mood[Math.floor(Math.random() * specialConfig.mood.length)];
            
            dayEntry.meta.isSpecialProcessed = true; 

            const todayEvents = dayEntry.events || [];
            const hasLogged = todayEvents.some(e => specialConfig.events.includes(e.text));
            
            if (!hasLogged) {
                const text = specialConfig.events[Math.floor(Math.random() * specialConfig.events.length)];
                
                this.pendingEvents.push({
                    time: this.getTimeString(),
                    type: 'special',
                    text: text,
                    weight: 200, 
                    rawType: 'special_day'
                });
                
                this.flushPendingEvents();
            } else {
                this.save();
            }
        }
    }

    formatDateKey(date) {
        return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
    }

    getTodayKey() { 
        return this.formatDateKey(new Date()); 
    }

    getTimeString() {
        const now = new Date();
        return `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
    }

    load() {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
            try { 
                this.entries = JSON.parse(saved); 
                
                const keys = Object.keys(this.entries);
                if (keys.length > 0) {
                    const firstVal = this.entries[keys[0]];
                    if (Array.isArray(firstVal)) {
                        console.warn("Detected old diary format, resetting...");
                        this.entries = {};
                    }
                }
            } 
            catch(e) { console.error("Diary load failed", e); this.entries = {}; }
        }
    }

    save() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
    }

    logEvent(eventType, params = {}, weight = 20) {
        const cooldownTime = eventType.startsWith('pet') ? 10 * 60 * 1000 : 60 * 1000;
        const now = Date.now();
        if (this.eventCooldowns[eventType] && (now - this.eventCooldowns[eventType] < cooldownTime)) return;
        this.eventCooldowns[eventType] = now;

        let text = '';
        if (params.id && this.DIARY_CONFIG.specific_items[params.id]) {
            const specifics = this.DIARY_CONFIG.specific_items[params.id];
            text = specifics[Math.floor(Math.random() * specifics.length)];
            weight = Math.max(weight, 60);
        } else {
            const templates = this.DIARY_CONFIG[eventType];
            if (!templates || templates.length === 0) return;
            text = templates[Math.floor(Math.random() * templates.length)];
            if (params.item) text = text.replace('{item}', params.item);
        }

        this.pendingEvents.push({
            time: this.getTimeString(),
            type: 'interaction',
            text: text,
            weight: weight,
            rawType: eventType
        });
    }

    generateOfflineEvents(offlineDurationHours) {
        const numEvents = Math.min(3, Math.floor(offlineDurationHours / 2));
        if (numEvents === 0) return;

        if (this.statusCallback) {
            this.statusCallback(`检测到离线 ${offlineDurationHours.toFixed(1)} 小时，正在生成日记...`);
        }
        
        for (let i = 0; i < numEvents; i++) {
            let eventPool = this.DIARY_CONFIG.offline_events;
            
            let totalWeight = eventPool.reduce((sum, e) => sum + e.weight, 0);
            let randomPoint = Math.random() * totalWeight;
            
            let chosenEvent = null;
            for (const event of eventPool) {
                randomPoint -= event.weight;
                if (randomPoint <= 0) {
                    chosenEvent = event;
                    break;
                }
            }

            if (chosenEvent) {
                const text = chosenEvent.text[Math.floor(Math.random() * chosenEvent.text.length)];
                const final_text = text.replace('{hours}', offlineDurationHours.toFixed(1));
                
                this.pendingEvents.push({
                    time: this.getTimeString(),
                    type: 'offline',
                    text: final_text,
                    weight: chosenEvent.weight,
                    rawType: 'offline_event'
                });
            }
        }
    }

    flushPendingEvents() {
        if (this.pendingEvents.length === 0) return;

        const key = this.getTodayKey();
        if (!this.entries[key]) {
            this.entries[key] = {
                meta: this.generateDailyMeta(),
                events: []
            };
        }
        
        let currentDayEntries = this.entries[key].events;
        
        currentDayEntries.push(...this.pendingEvents);
        this.pendingEvents = [];

        currentDayEntries.sort((a, b) => b.weight - a.weight);

        const uniqueEntries = [];
        const seenTexts = new Set();
        for (const entry of currentDayEntries) {
            if (!seenTexts.has(entry.text)) {
                uniqueEntries.push(entry);
                seenTexts.add(entry.text);
            }
        }
        currentDayEntries = uniqueEntries;

        if (currentDayEntries.length > this.MAX_ENTRIES_PER_DAY) {
            currentDayEntries = currentDayEntries.slice(0, this.MAX_ENTRIES_PER_DAY);
        }
        
        this.entries[key].events = currentDayEntries;
        this.save();
        this.updateUIHint(true);
    }

    generateDailyMeta() {
        const now = new Date();
        const dateKey = `${now.getMonth() + 1}-${now.getDate()}`;
        const specialConfig = this.DIARY_CONFIG.special_days[dateKey];

        const metaConfig = this.DIARY_CONFIG.diary_meta;
        
        let weather = metaConfig.weathers[Math.floor(Math.random() * metaConfig.weathers.length)];
        let mood = metaConfig.moods[Math.floor(Math.random() * metaConfig.moods.length)];
        let keyword = metaConfig.keywords[Math.floor(Math.random() * metaConfig.keywords.length)];

        if (specialConfig) {
            weather = specialConfig.weather[Math.floor(Math.random() * specialConfig.weather.length)];
            mood = specialConfig.mood[Math.floor(Math.random() * specialConfig.mood.length)];
        }

        return { weather, mood, keyword };
    }

    renderPage() {
        const dateTitle = document.getElementById('diary-date-title'); 
        const weatherMeta = document.getElementById('diary-weather');
        const moodMeta = document.getElementById('diary-mood');
        const photoDate = document.getElementById('diary-photo-date');
        const photoWeather = document.getElementById('diary-photo-weather');
        const entriesContainer = document.getElementById('diary-entries-scroll');

        const key = this.formatDateKey(this.viewingDate);
        const dayEntry = this.entries[key];
        const list = dayEntry ? dayEntry.events : [];
        const meta = dayEntry ? dayEntry.meta : null;

        if (dateTitle) dateTitle.innerText = key;

        if (weatherMeta) weatherMeta.innerText = meta ? meta.weather : '🌤️ 心情随笔';
        if (moodMeta) moodMeta.innerText = meta ? meta.mood : '😐 心情一般';

        if (photoDate) photoDate.innerText = key;
        if (photoWeather) photoWeather.innerText = meta ? meta.weather.split(' ')[1] : '适合睡觉';

        entriesContainer.innerHTML = ''; 

        if (list.length === 0) {
            entriesContainer.innerHTML = '<div class="entry empty-tip">今天猫咪很懒，没有留下记录...</div>';
        } else {
            list.forEach(item => {
                const div = document.createElement('div');
                div.className = 'entry';
                div.innerHTML = `<div class="entry-time">${item.time}</div><div class="entry-text">${item.text}</div>`;
                entriesContainer.appendChild(div);
            });
        }

        const btnNext = document.getElementById('btn-diary-next');
        const btnPrev = document.getElementById('btn-diary-prev');
        
        const currentKey = key;
        const todayKey = this.getTodayKey();
        
        const allDates = Object.keys(this.entries).sort();
        const earliestKey = allDates.length > 0 ? allDates[0] : todayKey;

        const hasNext = currentKey < todayKey;
        const hasPrev = currentKey > earliestKey;
        
        if (btnNext) {
            btnNext.style.visibility = hasNext ? 'visible' : 'hidden';
        }
        if (btnPrev) {
            btnPrev.style.visibility = hasPrev ? 'visible' : 'hidden';
        }
    }

    updateUIHint(hasNew) {
        const dot = document.getElementById('diary-red-dot-hud');
        if(dot) dot.style.display = hasNew ? 'block' : 'none';
    }

    changePage(delta) {
        this.viewingDate.setDate(this.viewingDate.getDate() + delta);
        this.renderPage();
    }
    
    clearAll() {
        this.entries = {};
        this.save();
        const modal = document.getElementById('diary-modal');
        if (modal && !modal.classList.contains('hidden')) {
            this.renderPage();
        }
    }
}
