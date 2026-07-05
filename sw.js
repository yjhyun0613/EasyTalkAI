const CACHE_NAME = 'easily-say-ai-cache-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './demo.html',
  './style.css',
  './app.js',
  './mockData.js',
  './manifest.json',
  './app_icon.png'
];

// 서비스 워커 설치 시 자원 캐싱
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// 서비스 워커 활성화 (이전 캐시 삭제)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 네트워크 우선(Network First) 전략으로 수정하여 최신 코드 항시 반영
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then((networkResponse) => {
        // 정상적인 GET 요청 응답만 캐시에 업데이트
        if (networkResponse && networkResponse.status === 200 && e.request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // 네트워크 오프라인 시 캐시에서 탐색
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // 네비게이션 요청인데 캐시가 없고 오프라인이면 메인 페이지 제공
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
