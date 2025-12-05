const CACHE_NAME = 'triage-simulator-v1.0.1';

// 定義需要快取的資源列表
// 包含您的 HTML 檔案中所引用的所有圖片及外部 CDN 函式庫
const ASSETS_TO_CACHE = [
  './', // 快取當前頁面 (HTML)
  
  // --- 外部函式庫 (CDN) ---
  'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700;900&family=Noto+Sans+TC:wght&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',

  // --- 本地圖片資源 (根據您的 HTML 內容) ---
  './Gemini_Generated_Image_qo3hgnqo3hgnqo3h (2).jpg',
  './Gemini_Generated_Image_qo3hgnqo3hgnqo3h (1).jpg',
  './Gemini_Generated_Image_qo3hgnqo3hgnqo3h.jpg',
  './Stree.jpg',
  './mele.png',
  './femele.png',
  './children.png',
  './walk.png',
  './green.png',
  './tone.png',
  './asma.png',
  './bp.png',
  './coo.png',
  './red1.png',
  './yellow.png',
  './black1.png',
  './cantwalk.png'
];

// 安裝 Service Worker 並快取資源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
});

// 攔截請求
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 如果在快取中找到，直接回傳快取
        if (response) {
          return response;
        }
        // 否則發送網絡請求
        return fetch(event.request);
      })
  );
});

// 更新 Service Worker 時清除舊快取
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
    })
  );
});