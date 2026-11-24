/* ======================================================================
   Wimo · version och uppdatering
   - WIMO_VERSION står i konto.html (<meta name="wimo-version">). Samma värde läggs i
     version.json vid varje uppladdning.
   - Wimo frågar servern efter version.json (förbi all cache) när sidan laddas, när fliken
     visas igen och var 15:e minut. Finns en nyare version visas en notis.
   - Knappen "Uppdatera Wimo" på kontosidan skickar först iväg allt som väntar på att sparas,
     tömmer sedan bara programfilerna (service worker och dess cache) och laddar om.
     Projekt, inloggning och annan data i webbläsaren och i molnet rörs inte.
   ====================================================================== */
const WIMO_VERSION = (document.querySelector('meta[name="wimo-version"]') || {}).content || "";
let wimoNyVersion = "";            // senaste versionen på servern, om den är nyare än den här

const wimoVanta = (ms) => new Promise((r) => setTimeout(r, ms));

// Versionsnumret som text: 20261124h → 24 nov 2026 (h)
function wimoVersionText(v) {
    const m = /^(\d{4})(\d{2})(\d{2})([a-z]*)$/.exec(v || "");
    if (!m) return v || "okänd";
    const man = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"][+m[2] - 1] || m[2];
    return +m[3] + " " + man + " " + m[1] + (m[4] ? " (" + m[4] + ")" : "");
}

async function wimoKollaVersion() {
    if (!WIMO_VERSION || !/^https?:$/.test(location.protocol)) return;
    try {
        const svar = await fetch("version.json?t=" + Date.now(), { cache: "no-store" });
        if (!svar.ok) return;
        const v = String((await svar.json()).version || "");
        if (v && v > WIMO_VERSION && v !== wimoNyVersion) {
            wimoNyVersion = v;
            wimoVisaNotis();
            wimoRitaVersionsruta();
        }
    } catch (e) { /* offline eller ingen version.json: inget att göra */ }
}

/* ---------- notisen ---------- */
function wimoVisaNotis() {
    let n = document.getElementById("wimoVersionNotis");
    if (!n) {
        n = document.createElement("div");
        n.id = "wimoVersionNotis";
        n.className = "wimo-vnotis";
        n.setAttribute("role", "status");
        document.body.appendChild(n);
    }
    // Inloggad: till kontosidan och knappen där. Inte inloggad (kontosidan går inte att nå): uppdatera direkt.
    const inloggad = !document.body.classList.contains("p4-utloggad") && typeof window.p4OppnaKonto === "function";
    n.innerHTML = '<div class="wimo-vnotis-text"><b>En ny version av Wimo finns</b>' +
        "<span>" + (inloggad ? "Gå till Mitt konto och tryck på Uppdatera Wimo." : "Tryck på Uppdatera Wimo.") + " Din data påverkas inte.</span></div>" +
        (inloggad ? '<button type="button" class="wimo-vnotis-knapp" data-wimo-tillkonto>Gå till Mitt konto</button>'
            : '<button type="button" class="wimo-vnotis-knapp" data-wimo-uppdatera>Uppdatera Wimo</button>') +
        '<button type="button" class="wimo-vnotis-stang" data-wimo-stangnotis aria-label="Stäng">×</button>';
    n.hidden = false;
}

/* ---------- rutan högst upp på kontosidan ---------- */
function wimoVersionsrutaHtml() {
    const ny = !!wimoNyVersion;
    return '<div class="wimo-vruta' + (ny ? " ny" : "") + '" id="wimoVersionsruta">' +
        '<div class="wimo-vruta-text"><b>' + (ny ? "En ny version av Wimo finns" : "Wimo version " + wimoVersionText(WIMO_VERSION)) + "</b>" +
        "<span>" + (ny ? "Du har " + wimoVersionText(WIMO_VERSION) + ", senaste är " + wimoVersionText(wimoNyVersion) + ". "
            : "Ser något fel ut, eller har du inte fått det senaste? ") +
        "Uppdatera Wimo laddar om programmet. Dina projekt och din data påverkas inte.</span></div>" +
        '<button type="button" class="navknapp wimo-vruta-knapp" data-wimo-uppdatera>Uppdatera Wimo</button></div>';
}
function wimoRitaVersionsruta() {
    const sida = document.getElementById("p4KontoSida");
    if (!sida || !sida.firstElementChild) return;
    const gammal = document.getElementById("wimoVersionsruta");
    if (gammal) gammal.outerHTML = wimoVersionsrutaHtml();
    else sida.insertAdjacentHTML("afterbegin", wimoVersionsrutaHtml());
}

/* ---------- uppdatera ---------- */
async function wimoUppdatera(knapp) {
    if (knapp) { knapp.disabled = true; knapp.textContent = "Uppdaterar …"; }
    // 1. Skicka iväg det som väntar på att sparas i molnet (det finns redan kvar i webbläsaren)
    try { if (typeof window.p4SparaNu === "function") await Promise.race([window.p4SparaNu(), wimoVanta(5000)]); } catch (e) { }
    try { if (typeof foPush === "function") await Promise.race([foPush(), wimoVanta(4000)]); } catch (e) { }
    // 2. Töm bara programfilerna: service workerns cache och själva service workern
    try { if ("caches" in window) await Promise.all((await caches.keys()).map((n) => caches.delete(n))); } catch (e) { }
    try {
        if ("serviceWorker" in navigator)
            await Promise.all((await navigator.serviceWorker.getRegistrations()).map((r) => r.unregister()));
    } catch (e) { }
    // 3. Ladda om med en ny adress så att webbläsaren hämtar sidan på nytt
    location.replace(location.pathname + "?uppdaterad=" + Date.now() + location.hash);
}

/* ---------- start ---------- */
(function () {
    // ta bort ?uppdaterad=… ur adressen efter en uppdatering
    if (/[?&]uppdaterad=/.test(location.search)) {
        const q = location.search.replace(/[?&]uppdaterad=\d+/, "").replace(/^&/, "?");
        history.replaceState(history.state, "", location.pathname + (q === "?" ? "" : q) + location.hash);
    }
    // rutan läggs in varje gång kontosidan ritas
    const sida = document.getElementById("p4KontoSida");
    if (sida) new MutationObserver(() => {
        if (sida.firstElementChild && !document.getElementById("wimoVersionsruta")) wimoRitaVersionsruta();
    }).observe(sida, { childList: true });

    document.addEventListener("click", (e) => {
        const t = e.target.closest && e.target.closest("[data-wimo-uppdatera], [data-wimo-tillkonto], [data-wimo-stangnotis]");
        if (!t) return;
        if (t.hasAttribute("data-wimo-uppdatera")) return wimoUppdatera(t);
        const n = document.getElementById("wimoVersionNotis");
        if (n) n.hidden = true;
        if (t.hasAttribute("data-wimo-tillkonto") && typeof window.p4OppnaKonto === "function") window.p4OppnaKonto();
    });

    setTimeout(wimoKollaVersion, 4000);
    setInterval(wimoKollaVersion, 15 * 60 * 1000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") wimoKollaVersion(); });
})();
