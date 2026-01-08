// 這是舊網站的 service-worker.js (自殺版本)

const CACHE_NAME = 'kill-switch-v999'; // 版本號隨便打一個很大的

self.addEventListener('install', (event) => {
    // 強制立即接管，不等待
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // 立即宣告接管所有頁面，並清除舊快取
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});

// 攔截請求：全部直接放行 (不讀快取，直接連網)
self.addEventListener('fetch', (event) => {
    // 什麼都不做，直接讓它去網路上抓 (這時就會抓到我們新的 index.html 轉址頁)
    return; 
});