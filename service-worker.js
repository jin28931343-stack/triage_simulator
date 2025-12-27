// 更新版本號，強制瀏覽器重新安裝 Service Worker
const CACHE_NAME = 'triage-simulator-v2.1.2'; // 版本號更新

// 1. 本地核心資源 (請確保這裡的路徑與您實際的資料夾結構完全一致)
const LOCAL_ASSETS = [
  './', 
  './index.html',
  './Script.js',  // 注意大小寫，必須與檔名完全一致
  './style.css',
  './manifest.json',
  
  // 圖片與音效資源 (加上 PIC/ 前綴)
  './PIC/bgm.mp3',
  './PIC/Stree.jpg',
  './PIC/beginner.jpg',
  './PIC/pro.jpg',
  './PIC/master.jpg',
  './PIC/mele.png',
  './PIC/femele.png',
  './PIC/children.png',
  './PIC/walk.png',
  './PIC/green.png',
  './PIC/tone.png',
  './PIC/asma.png',
  './PIC/bp.png',
  './PIC/coo.png',
  './PIC/red1.png',
  './PIC/yellow.png',
  './PIC/black1.png',
  './PIC/cantwalk.png',
  './PIC/Triage_dolls.png'
];

// 2. 外部 CDN 資源
const CDN_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700;900&family=Noto+Sans+TC:wght&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

// 安裝 Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('Service Worker: 開始快取檔案...');
      try {
        await cache.addAll(LOCAL_ASSETS);
        console.log('Service Worker: 本地核心檔案快取成功');
      } catch (error) {
        console.error('Service Worker: 本地檔案快取失敗 (通常是某個檔案路徑錯誤或不存在)', error);
      }

      const cdnPromises = CDN_ASSETS.map(async (url) => {
        try {
          const request = new Request(url, { mode: 'no-cors' });
          const response = await fetch(request);
          if (response) await cache.put(request, response);
        } catch (error) {
          console.warn(`Service Worker: 無法快取外部資源 (${url})`, error);
        }
      });
      await Promise.all(cdnPromises);
    })
  );
});

// 攔截請求
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => console.log('離線且無快取'));
    })
  );
});

// 清理舊快取
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});