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
// Ändringar som inte är sparade i molnet ännu ligger också i en egen liten nyckel, så att de finns kvar
// även om webbläsaren inte har plats för hela projektet.
const foLsKo = (id) => "wimo_forma_ko_" + id;
// Ändringar som inte kunde sparas (krock eller borttagen åtkomst). Tas aldrig bort automatiskt.
const FO_LS_EJSPARADE = "wimo_forma_ejsparade";
// Bilagor som inte kom upp i molnet ännu.
const foLsFilko = (id) => "wimo_forma_filko_" + id;

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
const foKoSig = (ko) => ko.length + ":" + (ko.length ? (ko[ko.length - 1].oid || ko[ko.length - 1].tid) : "");
function foSparaKo(id, ko) {
    try { if (ko.length) localStorage.setItem(foLsKo(id), JSON.stringify({ ko: ko })); else localStorage.removeItem(foLsKo(id)); return true; }
    catch (e) { status("Webbläsaren har inte plats för fler osparade ändringar. Anslut till nätet så att de kommer upp i molnet.", true); return false; }
}
function foSparaLokalt() {
    if (!foP || !foPid) return;
    foSparaKo(foPid, foKo);
    foSkrivLs(foLsProjekt(foPid), { data: foP, rev: foRev, ko: foKo, sig: foKoSig(foKo) });
    const l = foLista.find(x => x.id === foPid);
    if (l && (l.namn !== foP.namn || l.demo !== !!foP.demo)) { l.namn = foP.namn; l.demo = !!foP.demo; foSparaLista(); }
}
function foOppnaProjekt(id) {
    if (foLyssProjekt) { foLyssProjekt(); foLyssProjekt = null; }
    clearTimeout(foPushTimer);
    const post = foLista.find(x => x.id === id) || (foMolnLista || []).find(x => x.id === id);
    if (!post) { foP = null; foPid = ""; return false; }
    if (!foLista.some(x => x.id === id)) { foLista.push({ id: id, namn: post.namn, moln: true }); foSparaLista(); }
    const lok = foLasLs(foLsProjekt(id), null), kx = foLasLs(foLsKo(id), null);
    foPid = id;
    foP = lok && lok.data ? foLaga(lok.data) : null;
    foRev = lok ? lok.rev || 0 : 0;
    foKo = lok && Array.isArray(lok.ko) ? lok.ko : [];
    // Den lilla nyckeln med osparade ändringar är alltid den senaste. Stämmer den inte med den lokala kopian
    // (som inte fick plats) används inte kopian: projektet hämtas från molnet och ändringarna läggs ovanpå.
    const koNu = kx && Array.isArray(kx.ko) ? kx.ko : [];
    if (lok && lok.sig !== undefined ? lok.sig !== foKoSig(koNu) : koNu.length > foKo.length) {
        foKo = koNu; foP = null; foRev = 0;
    }
    foMolnMeta = null;
    if (!foArMolnPid(id) && foP) foKo = [];
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
// Sparar ändringar som inte gick att föra in i projektet, så att ingen text försvinner.
function foSparaEjSparade(pid, ops, orsak) {
    if (!ops || !ops.length) return;
    const l = foLasLs(FO_LS_EJSPARADE, []);
    const namn = ((foLista.find(x => x.id === pid) || {}).namn) || (foP && foPid === pid ? foP.namn : "") || pid;
    ops.forEach(op => l.push({ projekt: pid, projektNamn: namn, op: op, orsak: String(orsak || "").slice(0, 300), tid: foNu() }));
    try { localStorage.setItem(FO_LS_EJSPARADE, JSON.stringify(l)); } catch (e) { console.warn("Forma: kunde inte spara ej sparade ändringar", l); }
}
function foEjSparade() { return foLasLs(FO_LS_EJSPARADE, []); }
function foTaBortLokalt(id, orsak) {
    // Osparade ändringar i projektet tas aldrig bort: de flyttas till listan "Ändringar som inte kunde sparas".
    const lok = foLasLs(foLsProjekt(id), null), kx = foLasLs(foLsKo(id), null);
    const ko = foPid === id ? foKo : (kx && Array.isArray(kx.ko) ? kx.ko : (lok && Array.isArray(lok.ko) ? lok.ko : []));
    if (ko.length) foSparaEjSparade(id, ko, orsak || "Projektet togs bort från den här datorn innan ändringarna hann sparas i molnet.");
    try { localStorage.removeItem(foLsKo(id)); } catch (e) { }
    if (foPid === id) foKo = [];
    foLista = foLista.filter(x => x.id !== id);
    foSparaLista();
    try { localStorage.removeItem(foLsProjekt(id)); } catch (e) { }
    if (foPid === id) { foP = null; foPid = ""; try { localStorage.removeItem(FO_LS_AKTIV); } catch (e) { } }
}

function foArMolnPid(id) { const l = foLista.find(x => x.id === id); return !!(l && l.moln); }
/* ---------- ändra ---------- */
// Kör en ändring. Returnerar operationens resultat, eller null om den inte gick (felet visas).
function foGor(typ, a, tyst) {
    if (!foP) return null;
    const op = { typ: typ, a: a || {}, av: foJagId(), tid: foNu(), oid: foId() };
    const kopia = JSON.parse(JSON.stringify(foP));
    let svar;
    try { svar = foKorOp(kopia, op); }
    catch (e) { status(e.message || "Det gick inte att spara.", true); return null; }
    foP = kopia;
    if (svar !== null || typ === "sett") {
        // Bara molnprojekt har en kö till molnet. Lokala projekt sparas direkt i webbläsaren.
        if (foArMolnPid(foPid)) foKo.push(op);
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
// Ändringar som tar bort eller ersätter information: före dem tas alltid en säkerhetskopia.
const FO_KOPIA_OPS = ["rensaFragor", "taBortKategori", "taBortInlagg", "taBortKommentar", "taBortSignerad", "taBortProtokoll",
    "ersattPerson", "tpTaBort", "tpErsatt", "tpAvbrytRev", "makuleraRapport"];
let foVantandeSnap = null;  // ögonblicksbild från molnet som kom medan vi sparade
async function foPush() {
    if (foPushar || !foKo.length || !foMoln()) return;
    const pid = foPid;
    foPushar = true;
    try { await foRensaVidBehov(pid); } catch (e) { console.warn("Forma rensning:", e); }
    if (pid !== foPid) { foPushar = false; return; }
    // Det som skickas låses här, så att ett byte av projekt under tiden aldrig kan skriva fel projekt.
    const skickade = foKo.length, data = foP, rev = foRev, namn = foP.namn;
    const orsak = foKo.slice(0, skickade).some(op => FO_KOPIA_OPS.includes(op.typ)) ? "fore-" + foKo.find(op => FO_KOPIA_OPS.includes(op.typ)).typ : "";
    try {
        const ny = await window.p4FormaMoln.spara(pid, data, rev, namn, orsak);
        if (pid === foPid) { foRev = ny; foKo = foKo.slice(skickade); foSparaLokalt(); }
        else {
            // Projektet byttes medan vi sparade: uppdatera den lokala kopian av det sparade projektet.
            const kx = foLasLs(foLsKo(pid), null), rest = kx && Array.isArray(kx.ko) ? kx.ko.slice(skickade) : [];
            foSparaKo(pid, rest);
            foSkrivLs(foLsProjekt(pid), { data: data, rev: ny, ko: rest, sig: foKoSig(rest) });
        }
        foSynkLage = foKo.length ? "synkar" : "sparat";
        foFilerUpp(pid);
    } catch (e) {
        if (e && e.konflikt && pid === foPid) {
            // Någon annan har sparat: lägg våra ändringar ovanpå deras version och försök igen.
            foRebase(e.fjarr);
            foPushar = false;
            foVantandeSnap = null;
            return foPush();
        }
        console.warn("Forma sparning:", e);
        if (e && e.trasig) status("Projektet i molnet sparades av en nyare version av Wimo. Uppdatera sidan innan du fortsätter. Dina ändringar finns kvar på den här datorn.", true);
        if (e && e.forStor) status("Projektet är för stort för molnet och det finns inga fler avslutade frågor utan stjärna att flytta till arkivet. Ändringarna finns kvar på den här datorn. Kontakta Wimo.", true);
        if (e && /permission/i.test(String(e.code || e.message || ""))) status("Molnet tog inte emot ändringen. Dina ändringar finns kvar på den här datorn. Kontrollera att du fortfarande har åtkomst till projektet.", true);
        foSynkLage = navigator.onLine === false ? "offline" : "fel";
        setTimeout(() => { if (foKo.length) foPlaneraPush(); }, 8000);
    } finally { foPushar = false; }
    // En ögonblicksbild som kom under sparningen hanteras först nu (annars kan ändringar räknas två gånger).
    if (foVantandeSnap && pid === foPid) { const v = foVantandeSnap; foVantandeSnap = null; foTaEmot(v); }
    foVisaSynk();
    if (foKo.length) foPlaneraPush();
}
/* Molnet tar högst 900 000 tecken per projekt. Stora projekt komprimeras. Räcker inte det rensas
   de äldsta avslutade frågorna (klara eller makulerade) som inte är stjärnmärkta, tills projektet
   ligger under FO_RENSA_TILL. Före rensningen sparas en exakt kopia av hela projektet i molnet
   (forma/{id}/kopior), så frågorna finns kvar i arkivet och kan hämtas eller återställas.
   Rensningen är en vanlig ändring och syns i projektloggen. */
const FO_RENSA_VID = 820000, FO_RENSA_TILL = 700000;
async function foRensaVidBehov(pid) {
    if (!foP || !window.p4FormaMoln.storlek || !window.p4FormaMoln.kopia) return;
    let storlek = await window.p4FormaMoln.storlek(foP);
    if (storlek <= FO_RENSA_VID || pid !== foPid) return;
    const kandidater = foP.fragor.filter(f => !f.stjarna && !foAktiv(f))
        .sort((a, b) => String(a.andrad || a.skapad).localeCompare(String(b.andrad || b.skapad)));
    let totalt = 0;
    while (storlek > FO_RENSA_TILL && kandidater.length) {
        const ids = kandidater.splice(0, 20).map(f => f.id);
        const n = foGor("rensaFragor", { ids: ids }, true);
        if (n) totalt += n;
        storlek = await window.p4FormaMoln.storlek(foP);
        if (pid !== foPid) return;
    }
    if (totalt) {
        status(totalt + " gamla avslutade frågor utan stjärna flyttades till arkivet så att projektet ryms i molnet. De finns kvar i säkerhetskopiorna under Projekt. Stjärnmärk frågor som alltid ska ligga i projektet.", true);
        if (typeof foRita === "function") foRita();
    }
}
function foRebase(fjarr) {
    if (!fjarr || !fjarr.data) return;
    let p = foLaga(fjarr.data);
    const kvar = [], misslyckade = [];
    foKo.forEach(op => {
        try { const kopia = JSON.parse(JSON.stringify(p)); foKorOp(kopia, op); p = kopia; kvar.push(op); }
        catch (e) { misslyckade.push(op); status("En av dina ändringar kunde inte föras in eftersom någon annan hann före: " + (e.message || "") + " Texten finns kvar under Projekt > Säkerhetskopior.", true); }
    });
    if (misslyckade.length) foSparaEjSparade(foPid, misslyckade, "Krock med en ändring som någon annan hann spara först.");
    foP = p; foRev = fjarr.rev; foKo = kvar;
    foSparaLokalt();
}
function foLyssnaProjekt() {
    if (!foMoln() || !foPid) { foSynkLage = "offline"; return; }
    const pid = foPid;
    foSynkLage = "synkar";
    foLyssProjekt = window.p4FormaMoln.lyssna(pid, (x, info) => {
        if (pid !== foPid) return;
        if (!x) {
            // Från webbläsarens minne (t.ex. offline) betyder "finns inte" bara att vi inte vet. Rör inget.
            if (info && info.franCache) return;
            // Projektet finns inte längre i molnet, eller så har kontot tagits bort som medlem.
            status("Forma-projektet är borttaget eller så har du inte längre åtkomst.", true);
            foTaBortLokalt(pid, "Projektet togs bort i molnet eller så togs din åtkomst bort innan ändringarna hann sparas.");
            if (typeof foRita === "function") foRita();
            return;
        }
        if (foPushar) { foVantandeSnap = x; return; }
        foTaEmot(x);
    }, (e) => { console.warn("Forma:", e); foSynkLage = "fel"; foVisaSynk(); });
}
function foTaEmot(x) {
    if (x.trasig) {
        // Datan kunde inte läsas (sparad av en nyare version). Skriv aldrig över den med en tom kopia.
        foSynkLage = "fel"; foVisaSynk();
        status("Projektet sparades av en nyare version av Wimo. Uppdatera sidan.", true);
        return;
    }
    foMolnMeta = { medlemmar: x.medlemmar, admins: x.admins, kopior: x.kopior || [], kopiaTid: x.kopiaTid || 0, foretag: x.foretag || "" };
    if (x.rev > foRev || !foP) {
        if (foKo.length) foRebase(x);
        else { foP = foLaga(x.data || foTomtProjekt(x.namn)); foRev = x.rev; foSparaLokalt(); }
    }
    foSynkLage = foKo.length ? "synkar" : "sparat";
    foSakerstallJag();
    if (foKo.length) foPlaneraPush();
    foVisaSynk();
    if (typeof foRita === "function") foRita();
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
    foLyssLista = window.p4FormaMoln.lista((l, info) => {
        const franCache = !!(info && info.franCache);
        // Från webbläsarens minne kan listan vara ofullständig: behåll då de projekt vi redan känner till.
        foMolnLista = franCache ? l.concat((foMolnLista || []).filter(m => !l.some(y => y.id === m.id))) : l;
        // Lokala kopior av molnprojekt som kontot inte längre är med i tas bort (bara när svaret kommer från servern).
        if (!franCache) foLista.filter(x => x.moln && !l.some(m => m.id === x.id)).forEach(x => foTaBortLokalt(x.id));
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
window.addEventListener("online", () => { if (foKo.length) foPlaneraPush(); else if (foPid) foFilerUpp(foPid); });
// För utloggningen: finns det Forma-ändringar som inte är sparade i molnet?
window.foOsparat = function () {
    const ut = [];
    foLista.filter(x => x.moln).forEach(x => {
        const ko = x.id === foPid ? foKo : ((foLasLs(foLsKo(x.id), null) || {}).ko || (foLasLs(foLsProjekt(x.id), null) || {}).ko || []);
        if (ko.length || foLasLs(foLsFilko(x.id), []).length) ut.push(x.namn);
    });
    return ut;
};

/* ======================================================================
   Bilagor: bilder, PDF och andra filer
   Lokalt i webbläsarens IndexedDB, och i molnet i forma/{id}/filer när
   projektet synkas. Filer upp till 900 kB per fil.
   ====================================================================== */
// Molnet tar högst 1 MB per bilaga efter kodning (base64 gör filen en tredjedel större).
const FO_FIL_MAX = 750 * 1024;
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
        if (fil.size > FO_FIL_MAX) { status(fil.name + " är för stor (" + foStorlek(fil.size) + "). Bilagor kan vara högst 750 kB.", true); continue; }
        const id = foId(), data = await foLasFil(fil);
        const namn = fil.name || ("Skärmklipp " + foDag(foNu()) + ".png");
        await foDbSkriv(foPid + ":" + id, { namn: namn, typ: fil.type, data: data });
        const l = foLista.find(x => x.id === foPid);
        if (l && l.moln && foMoln()) {
            try { await window.p4FormaMoln.sparaFil(foPid, id, { namn: namn, typ: fil.type, storlek: fil.size, data: data }); }
            catch (e) { console.warn("Forma fil:", e); foFilKo(foPid, id, true); status("Bilagan är sparad på den här datorn och laddas upp automatiskt när nätet fungerar.", true); }
        }
        ut.push({ id: id, namn: namn, typ: fil.type || "", storlek: fil.size, tid: foNu() });
    }
    return ut;
}
// Kö för bilagor som inte kom upp i molnet. Försöks igen efter varje sparning och när nätet kommer tillbaka.
function foFilKo(pid, id, lagg) {
    const l = foLasLs(foLsFilko(pid), []).filter(x => x !== id);
    if (lagg) l.push(id);
    if (l.length) foSkrivLs(foLsFilko(pid), l); else try { localStorage.removeItem(foLsFilko(pid)); } catch (e) { }
}
let foFilerPagar = false;
async function foFilerUpp(pid) {
    const l = foLasLs(foLsFilko(pid), []);
    if (foFilerPagar || !l.length || !foMoln()) return;
    foFilerPagar = true;
    try {
        for (const id of l) {
            const x = await foDbLas(pid + ":" + id).catch(() => null);
            if (!x) continue;      // finns inte på den här datorn längre: behåll i kön så att det syns
            try {
                const finns = await window.p4FormaMoln.hamtaFil(pid, id).catch(() => null);
                if (!finns) await window.p4FormaMoln.sparaFil(pid, id, { namn: x.namn, typ: x.typ, storlek: Math.round((x.data || "").length * 0.75), data: x.data });
                foFilKo(pid, id, false);
            } catch (e) { console.warn("Forma fil:", e); break; }
        }
    } finally { foFilerPagar = false; }
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
