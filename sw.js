/* Wimo · service worker
   Gör att Wimo kan installeras som app på datorn och mobilen.
   - Sidorna (HTML) hämtas alltid färskt från servern, förbi webbläsarens cache, så en ny version syns direkt.
   - Skript och stilmallar har versionsnummer i adressen (?v=…) och hämtas från nätet först.
   - Cachen används bara när nätet saknas.
   - version.json och Firebase rörs aldrig.
   Den här filen sparar ingen projektdata; den rör bara programfilerna. */
const CACHE = "wimo-v3";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
    e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
        .then(() => self.clients.claim()));
});

function arSida(req, url) {
    return req.mode === "navigate" || req.destination === "document" ||
        /\.html?$/.test(url.pathname) || url.pathname.endsWith("/") || !/\.[a-z0-9]+$/i.test(url.pathname);
}

self.addEventListener("fetch", (e) => {
    const req = e.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.endsWith("/version.json")) return;          // versionskollen går alltid direkt till servern

    const sida = arSida(req, url);
    const natet = sida
        ? fetch(new Request(req.url, { cache: "no-store", credentials: "same-origin", redirect: "follow" }))
            .then((svar) => svar.redirected ? Response.redirect(svar.url, 302) : svar)
        : fetch(req);

    e.respondWith(
        natet.then((svar) => {
            if (svar && svar.ok && svar.type === "basic") {
                const kopia = svar.clone();
                caches.open(CACHE).then((c) => c.put(req, kopia)).catch(() => { });
            }
            return svar;
        }).catch(() => caches.match(req, { ignoreSearch: sida })
            .then((t) => t || (sida ? caches.match("konto.html", { ignoreSearch: true }) : undefined))
            .then((t) => t || new Response("Wimo är offline och sidan finns inte sparad än.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })))
    );
});
