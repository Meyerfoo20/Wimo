/* ======================================================================
   Wimo Forma · lagring och synk
   Det öppna projektet (foP), listan med projekt, lokal kopia i webbläsaren
   och synk mot molnet (forma/{id}) när man är inloggad.

   Varje ändring körs först på en kopia. Går den igenom sparas den lokalt
   direkt och läggs i kön till molnet. Har någon annan hunnit spara körs
   köade ändringar om ovanpå den nyare versionen, så att inget skrivs över.
   ====================================================================== */

const FO_LS_LISTA = "wimo_forma_lista";
const FO_LS_AKTIV = "wimo_forma_aktiv";
const FO_LS_LOKAL = "wimo_forma_lokal_jag";
const foLsProjekt = (id) => "wimo_forma_p_" + id;

let foP = null;             // öppet projekt (data)
let foPid = "";             // dess id
let foRev = 0;              // senast kända version i molnet
let foKo = [];              // ändringar som inte är sparade i molnet ännu
let foLista = [];           // [{ id, namn, moln, demo }]
let foMolnLista = null;     // projekt i molnet (null = inte hämtat)
let foLyssProjekt = null, foLyssLista = null, foPushTimer = null, foPushar = false;
let foSynkLage = "lokal";   // lokal | synkar | sparat | offline | fel
let foMolnMeta = null;      // { medlemmar, admins } för öppet molnprojekt

function foLasLs(k, std) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : std; } catch (e) { return std; } }
function foSkrivLs(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { status("Webbläsaren har inte plats för mer data. Exportera projektet och rensa gamla projekt.", true); return false; }
}
function foMoln() { return !!(window.p4FormaMoln && window.p4FormaMoln.redo()); }

/* ---------- vem är jag i projektet ---------- */
function foKonto() {
    const j = typeof window.p4Jag === "function" ? window.p4Jag() : null;
    if (j) return j;
    const lok = foLasLs(FO_LS_LOKAL, null);
    return lok ? { uid: "", namn: lok.namn || "", epost: lok.epost || "" } : null;
}
// Personen i projektet som motsvarar kontot (uid först, sedan e-post).
function foJagId() {
    if (!foP) return "";
    const k = foKonto();
    if (k && k.uid) { const x = foP.personer.find(y => y.uid === k.uid); if (x) return x.id; }
    if (k && k.epost) { const x = foP.personer.find(y => y.epost && y.epost === k.epost.toLowerCase()); if (x) return x.id; }
    if (!k || (!k.uid && !k.epost)) { const a = foP.personer.find(y => y.roll === "admin" && y.aktiv); if (a) return a.id; }
    return "";
}
function foJag() { return foP ? foPerson(foP, foJagId()) : null; }
function foDelaNamn(n) {
    const d = String(n || "").trim().split(/\s+/);
    return { fornamn: d[0] || "", efternamn: d.slice(1).join(" ") };
}

/* ---------- projektlistan ---------- */
function foLasLista() {
    foLista = foLasLs(FO_LS_LISTA, []).filter(x => x && x.id);
    return foLista;
}
function foSparaLista() { foSkrivLs(FO_LS_LISTA, foLista); }
function foAllaProjekt() {
    // Lokala projekt och de molnprojekt kontot är med i, utan dubbletter.
    const ut = foLista.filter(x => !x.moln || !foMolnLista || foMolnLista.some(m => m.id === x.id)).map(x => Object.assign({}, x));
    (foMolnLista || []).forEach(m => {
        const finns = ut.find(x => x.id === m.id);
        if (finns) { finns.namn = m.namn; finns.moln = true; }
        else ut.push({ id: m.id, namn: m.namn, moln: true });
    });
    return ut.sort((a, b) => a.namn.localeCompare(b.namn, "sv"));
}

/* ---------- öppna och spara lokalt ---------- */
function foSparaLokalt() {
    if (!foP || !foPid) return;
    foSkrivLs(foLsProjekt(foPid), { data: foP, rev: foRev, ko: foKo });
    const l = foLista.find(x => x.id === foPid);
    if (l && (l.namn !== foP.namn || l.demo !== !!foP.demo)) { l.namn = foP.namn; l.demo = !!foP.demo; foSparaLista(); }
}
function foOppnaProjekt(id) {
    if (foLyssProjekt) { foLyssProjekt(); foLyssProjekt = null; }
    clearTimeout(foPushTimer);
    const post = foLista.find(x => x.id === id) || (foMolnLista || []).find(x => x.id === id);
    if (!post) { foP = null; foPid = ""; return false; }
    if (!foLista.some(x => x.id === id)) { foLista.push({ id: id, namn: post.namn, moln: true }); foSparaLista(); }
    const lok = foLasLs(foLsProjekt(id), null);
    foPid = id;
    foP = lok && lok.data ? foLaga(lok.data) : null;
    foRev = lok ? lok.rev || 0 : 0;
    foKo = lok && Array.isArray(lok.ko) ? lok.ko : [];
    foMolnMeta = null;
    try { localStorage.setItem(FO_LS_AKTIV, id); } catch (e) { }
    const l = foLista.find(x => x.id === id);
    if (l && l.moln) foLyssnaProjekt();
    else foSynkLage = "lokal";
    return true;
}
function foSkapaProjekt(namn, data, moln) {
    const id = foId();
    const k = foKonto();
    const n = foDelaNamn(k ? k.namn : "");
    const p = data || foTomtProjekt(namn, { fornamn: n.fornamn || (k && k.epost ? k.epost.split("@")[0] : "Jag"), efternamn: n.efternamn,
        epost: k ? (k.epost || "").toLowerCase() : "", uid: k ? k.uid : "" });
    p.namn = namn || p.namn;
    foLista.push({ id: id, namn: p.namn, moln: !!moln, demo: !!p.demo });
    foSparaLista();
    foSkrivLs(foLsProjekt(id), { data: p, rev: 0, ko: [] });
    if (moln) {
        return window.p4FormaMoln.skapa(id, p.namn, p).then(() => {
            foSkrivLs(foLsProjekt(id), { data: p, rev: 1, ko: [] });
            return id;
        });
    }
    return Promise.resolve(id);
}
function foTaBortLokalt(id) {
    foLista = foLista.filter(x => x.id !== id);
    foSparaLista();
    try { localStorage.removeItem(foLsProjekt(id)); } catch (e) { }
    if (foPid === id) { foP = null; foPid = ""; try { localStorage.removeItem(FO_LS_AKTIV); } catch (e) { } }
}

/* ---------- ändra ---------- */
// Kör en ändring. Returnerar operationens resultat, eller null om den inte gick (felet visas).
function foGor(typ, a, tyst) {
    if (!foP) return null;
    const op = { typ: typ, a: a || {}, av: foJagId(), tid: foNu() };
    const kopia = JSON.parse(JSON.stringify(foP));
    let svar;
    try { svar = foKorOp(kopia, op); }
    catch (e) { status(e.message || "Det gick inte att spara.", true); return null; }
    foP = kopia;
    if (svar !== null || typ === "sett") {
        foKo.push(op);
        foSparaLokalt();
        foPlaneraPush();
    }
    if (!tyst && typeof foRita === "function") foRita();
    // Direktmejl för händelsen läggs i kön (bara den som gjorde ändringen köar).
    if (typeof foKoaMejl === "function") setTimeout(() => foKoaMejl().catch(e => console.warn(e)), 50);
    return svar === undefined ? true : svar;
}

/* ---------- molnet ---------- */
function foPlaneraPush() {
    const l = foLista.find(x => x.id === foPid);
    if (!l || !l.moln || !foMoln()) return;
    foSynkLage = "synkar"; foVisaSynk();
    clearTimeout(foPushTimer);
    foPushTimer = setTimeout(foPush, 500);
}
async function foPush() {
    if (foPushar || !foKo.length || !foMoln()) return;
    const pid = foPid;
    foPushar = true;
    const skickade = foKo.length;
    try {
        foRev = await window.p4FormaMoln.spara(pid, foP, foRev, foP.namn);
        if (pid === foPid) { foKo = foKo.slice(skickade); foSparaLokalt(); }
        foSynkLage = foKo.length ? "synkar" : "sparat";
    } catch (e) {
        if (e && e.konflikt && pid === foPid) {
            // Någon annan har sparat: lägg våra ändringar ovanpå deras version och försök igen.
            foRebase(e.fjarr);
            foPushar = false;
            return foPush();
        }
        console.warn("Forma sparning:", e);
        foSynkLage = navigator.onLine === false ? "offline" : "fel";
        setTimeout(() => { if (foKo.length) foPlaneraPush(); }, 8000);
    } finally { foPushar = false; }
    foVisaSynk();
    if (foKo.length) foPlaneraPush();
}
function foRebase(fjarr) {
    if (!fjarr || !fjarr.data) return;
    let p = foLaga(fjarr.data);
    const kvar = [];
    foKo.forEach(op => {
        try { const kopia = JSON.parse(JSON.stringify(p)); foKorOp(kopia, op); p = kopia; kvar.push(op); }
        catch (e) { status("En av dina ändringar kunde inte sparas eftersom någon annan hann före: " + (e.message || ""), true); }
    });
    foP = p; foRev = fjarr.rev; foKo = kvar;
    foSparaLokalt();
}
function foLyssnaProjekt() {
    if (!foMoln() || !foPid) { foSynkLage = "offline"; return; }
    const pid = foPid;
    foSynkLage = "synkar";
    foLyssProjekt = window.p4FormaMoln.lyssna(pid, (x) => {
        if (pid !== foPid) return;
        if (!x) {
            // Projektet finns inte längre i molnet, eller så har kontot tagits bort som medlem.
            status("Forma-projektet är borttaget eller så har du inte längre åtkomst.", true);
            foTaBortLokalt(pid);
            if (typeof foRita === "function") foRita();
            return;
        }
        foMolnMeta = { medlemmar: x.medlemmar, admins: x.admins };
        if (x.rev > foRev || !foP) {
            if (foKo.length) foRebase(x);
            else { foP = foLaga(x.data || foTomtProjekt(x.namn)); foRev = x.rev; foSparaLokalt(); }
        }
        foSynkLage = foKo.length ? "synkar" : "sparat";
        foSakerstallJag();
        if (foKo.length) foPlaneraPush();
        foVisaSynk();
        if (typeof foRita === "function") foRita();
    }, (e) => { console.warn("Forma:", e); foSynkLage = "fel"; foVisaSynk(); });
}
// Den inloggade finns inte i projektets kontaktlista: lägg till hen, så att namn och roll stämmer.
function foSakerstallJag() {
    if (!foP || foJagId()) return;
    const k = foKonto();
    if (!k || !k.uid) return;
    const ep = (k.epost || "").toLowerCase();
    const finns = ep && foP.personer.find(x => x.epost === ep);
    if (finns) { foGor("kopplaKonto", { id: finns.id, uid: k.uid }, true); return; }
    const n = foDelaNamn(k.namn);
    const admin = foMolnMeta && foMolnMeta.admins.includes(k.uid);
    foGor("sparaPerson", { id: foId(), fornamn: n.fornamn || ep.split("@")[0], efternamn: n.efternamn, epost: ep, uid: k.uid,
        roll: admin ? "admin" : "projektor", disc: [] }, true);
}
function foStartaMolnLista() {
    if (foLyssLista) { foLyssLista(); foLyssLista = null; }
    if (!foMoln()) { foMolnLista = null; return; }
    foLyssLista = window.p4FormaMoln.lista((l) => {
        foMolnLista = l;
        // Lokala kopior av molnprojekt som kontot inte längre är med i tas bort.
        foLista.filter(x => x.moln && !l.some(m => m.id === x.id)).forEach(x => foTaBortLokalt(x.id));
        // En länk (t.ex. från ett mejl) till ett projekt som inte var laddat ännu.
        if (typeof foVantarProjekt !== "undefined" && foVantarProjekt && l.some(m => m.id === foVantarProjekt) && foVantarProjekt !== foPid) {
            foOppnaProjekt(foVantarProjekt); foVantarProjekt = ""; if (typeof foLasAdress === "function") foLasAdress();
        }
        if (typeof foRita === "function" && foModulAktiv()) foRita();
    });
}
function foVisaSynk() {
    const el = document.getElementById("foSynk");
    if (!el) return;
    const l = foLista.find(x => x.id === foPid);
    const t = !l ? "" : !l.moln ? "Sparas lokalt på denna dator" :
        foSynkLage === "sparat" ? "Sparat i molnet" : foSynkLage === "synkar" ? "Sparar…" :
        foSynkLage === "offline" ? "Offline – sparas när nätet är tillbaka" : foSynkLage === "fel" ? "Kunde inte spara – försöker igen" : "Ansluter…";
    el.textContent = t;
    el.title = t;
    el.className = "fo-synk " + (!l ? "" : !l.moln ? "lokal" : foSynkLage);
}

window.addEventListener("wimo-konto", () => {
    foStartaMolnLista();
    if (foPid && foLista.some(x => x.id === foPid && x.moln) && !foLyssProjekt) foLyssnaProjekt();
    if (typeof foRita === "function" && foModulAktiv()) foRita();
});
window.addEventListener("online", () => { if (foKo.length) foPlaneraPush(); });

/* ======================================================================
   Bilagor: bilder, PDF och andra filer
   Lokalt i webbläsarens IndexedDB, och i molnet i forma/{id}/filer när
   projektet synkas. Filer upp till 900 kB per fil.
   ====================================================================== */
const FO_FIL_MAX = 900 * 1024;
let foDbPromise = null;
function foDb() {
    if (!foDbPromise) foDbPromise = new Promise((ok, fel) => {
        const r = indexedDB.open("wimo_forma_filer", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("filer");
        r.onsuccess = () => ok(r.result);
        r.onerror = () => fel(r.error);
    });
    return foDbPromise;
}
async function foDbSkriv(nyckel, varde) {
    const db = await foDb();
    return new Promise((ok, fel) => { const t = db.transaction("filer", "readwrite"); t.objectStore("filer").put(varde, nyckel); t.oncomplete = ok; t.onerror = () => fel(t.error); });
}
async function foDbLas(nyckel) {
    const db = await foDb();
    return new Promise((ok, fel) => { const r = db.transaction("filer").objectStore("filer").get(nyckel); r.onsuccess = () => ok(r.result || null); r.onerror = () => fel(r.error); });
}
function foLasFil(fil) {
    return new Promise((ok, fel) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => fel(r.error); r.readAsDataURL(fil); });
}
// Sparar filerna och returnerar deras uppgifter { id, namn, typ, storlek }.
async function foSparaFiler(filer) {
    const ut = [];
    for (const fil of filer) {
        if (fil.size > FO_FIL_MAX) { status(fil.name + " är för stor (" + foStorlek(fil.size) + "). Bilagor kan vara högst 900 kB.", true); continue; }
        const id = foId(), data = await foLasFil(fil);
        const namn = fil.name || ("Skärmklipp " + foDag(foNu()) + ".png");
        await foDbSkriv(foPid + ":" + id, { namn: namn, typ: fil.type, data: data });
        const l = foLista.find(x => x.id === foPid);
        if (l && l.moln && foMoln()) {
            try { await window.p4FormaMoln.sparaFil(foPid, id, { namn: namn, typ: fil.type, storlek: fil.size, data: data }); }
            catch (e) { console.warn("Forma fil:", e); status("Bilagan sparades bara på den här datorn. Försök igen när du har nät.", true); }
        }
        ut.push({ id: id, namn: namn, typ: fil.type || "", storlek: fil.size, tid: foNu() });
    }
    return ut;
}
async function foHamtaFil(meta) {
    let x = await foDbLas(foPid + ":" + meta.id).catch(() => null);
    if (!x && foMoln()) {
        try { x = await window.p4FormaMoln.hamtaFil(foPid, meta.id); if (x) foDbSkriv(foPid + ":" + meta.id, { namn: x.namn, typ: x.typ, data: x.data }); }
        catch (e) { x = null; }
    }
    return x;
}
function foStorlek(b) { return b > 1048576 ? (b / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(b / 1024)) + " kB"; }
