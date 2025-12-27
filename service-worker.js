// 更新版本號，強制瀏覽器重新安裝 Service Worker
const CACHE_NAME = 'triage-simulator-v1.1.0'; // 版本號更新

// 1. 本地核心資源 (這些一定要成功，否則不讓安裝)
const LOCAL_ASSETS = [
  './', 
  './index.html', // 建議明確指定 HTML 檔名，避免路徑誤判
  './bgm.mp3',    // 新增背景音樂
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

// 2. 外部 CDN 資源 (這些如果失敗，不要卡住程式)
const CDN_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700;900&family=Noto+Sans+TC:wght&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

// 安裝 Service Worker
self.addEventListener('install', (event) => {
  // 強制跳過等待，讓新版 Service Worker 立刻接手
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('Service Worker: 開始快取檔案...');
      
      // 步驟 A: 快取本地檔案 (使用 addAll，失敗會丟出錯誤)
      try {
        await cache.addAll(LOCAL_ASSETS);
        console.log('Service Worker: 本地核心檔案快取成功');
      } catch (error) {
        console.error('Service Worker: 本地檔案快取失敗', error);
      }

      // 步驟 B: 快取外部 CDN (個別處理，使用 no-cors 模式避免錯誤)
      // 使用 map 讓每個檔案獨立下載，不會因為一個失敗就全部停止
      const cdnPromises = CDN_ASSETS.map(async (url) => {
        try {
          // 建立一個 no-cors 的請求，允許跨域不透明回應 (Opaque Response)
          const request = new Request(url, { mode: 'no-cors' });
          const response = await fetch(request);
          // 只有當網路請求成功時才放入快取
          if (response) {
            await cache.put(request, response);
          }
        } catch (error) {
          // 這裡只顯示警告，不拋出錯誤，確保 SW 能繼續安裝
          console.warn(`Service Worker: 無法快取外部資源 (${url}) - 離線時可能無法顯示樣式`, error);
        }
      });

      // 等待所有 CDN 嘗試完成 (無論成功失敗)
      await Promise.all(cdnPromises);
    })
  );
});

// 攔截請求 (Fetch)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 1. 如果快取有，直接回傳快取
        if (response) {
          return response;
        }

        // 2. 如果快取沒有，嘗試從網路下載
        return fetch(event.request).catch(() => {
          // 3. 如果網路也失敗 (完全離線且沒快取到)，可以在這裡回傳一個替代頁面或圖片
          // 目前暫時不處理，避免複雜化
          // console.log('離線且無快取:', event.request.url);
        });
      })
  );
});

// 啟動與清理舊快取
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: 清除舊快取', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // 讓 SW 立即控制所有頁面
  );
});

