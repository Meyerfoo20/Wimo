/* ======================================================================
   Wimo · Tidplan (första utkastet)

   Projektets tidplan, för det aktiva projektet. Egen data i p.tidplan,
   oberoende av fyraveckorstavlans kort.

   Till vänster en aktivitetstabell som redigeras direkt i raderna, som
   i ett kalkylark: skriv, Enter sparar och går till raden under, Tab går
   åt höger, Esc avbryter. Raderna ligger i användarens egen ordning.
   Till höger plats för kalendern; staplar och dragning kommer i nästa steg.

   Alla ändringar går via operationerna i core/operationer.js
   (opTp…), så de sparas, synkas och kan ångras.
   ====================================================================== */

// Kolumnerna i tabellen. bredd = CSS-bredd, valbar = kan döljas under Kolumner.
const TP_KOLUMNER = [
    { id: "nr", namn: "#", redig: false, bredd: "48px" },
    { id: "namn", namn: "Aktivitet", redig: true, bredd: "minmax(150px, 1fr)" },
    { id: "ansvarig", namn: "Ansvarig", lang: "Ansvarig", redig: true, bredd: "96px", valbar: true },
    { id: "kalkTimmar", namn: "Kalk. h", kort: "Kalk.", lang: "Kalkylerade timmar", titel: "Kalkylerade timmar", redig: true, bredd: "68px", valbar: true },
    { id: "plan", namn: "Plan. h", kort: "Plan.", lang: "Planerade timmar", titel: "Planerade timmar (bemanning × arbetstimmar per dag)", redig: false, bredd: "68px", valbar: true },
    { id: "avvik", namn: "Avvik.", lang: "Avvikelse mot kalkyl", titel: "Planerat minus kalkylerat. Plus = planen kräver fler timmar än kalkylen.", redig: false, bredd: "104px", valbar: true },
    { id: "klart", namn: "Klart", lang: "Klart % (framdrift)", titel: "Hur stor del av aktiviteten som är klar", redig: true, bredd: "64px", valbar: true },
    { id: "basavvik", namn: "Mot bas", lang: "Mot baslinjen", titel: "Slutdatum jämfört med baslinjen, i arbetsdagar", redig: false, bredd: "82px", valbar: true, kraver: "bas" },
    { id: "perioder", namn: "Perioder", lang: "Perioder", redig: false, bredd: "116px", valbar: true }
];
// tabellens minsta bredd: fasta kolumner + 150 px för namnet
const tpKolMin = (kol) => kol.reduce((s, k) => s + (parseInt(k.bredd, 10) || 150), 0);
const tpKolumner = () => TP_KOLUMNER.filter(k => (!k.valbar || !tpVy.dolda.has(k.id)) && (k.kraver !== "bas" || (typeof tpAktivBas === "function" && tpAktivBas())));
const tpRedig = () => tpKolumner().filter(k => k.redig).map(k => k.id);
const TP_VECKOR = 16;          // minsta antal veckor i kalendern
// bredd per dag i kalendern (px) för dag-, vecko- och månadsvyn
const TP_ZOOM = { dag: { dw: 34, veckor: 10, namn: "Dag" }, vecka: { dw: 20, veckor: 16, namn: "Vecka" }, manad: { dw: 7, veckor: 52, namn: "Månad" } };
let TP_DW = 20;
// ångra/gör om: en pil som går upp och viker av åt sidan
const TP_ANGRA = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 4 3.5 8l4 4"/><path d="M3.5 8h8a5 5 0 0 1 0 10H9"/></svg>';
const TP_GOROM = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12.5 4 4 4-4 4"/><path d="M16.5 8h-8a5 5 0 0 0 0 10H11"/></svg>';
const TP_PIL_V = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg>';
const TP_PIL_H = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5"/></svg>';
// Vyn: sparas per projekt på den här datorn (påverkar inte andra).
// fran = kalenderns första måndag (null = veckan före idag), zoom, helger, ihop = hopfällda grupper,
// dolda = dolda kolumner, tab = tabellens bredd i px, resurser = resurspanelen ("ihop" | "normal" | "stor").
const tpVy = { fran: null, zoom: "vecka", helger: false, ihop: new Set(), dolda: new Set(), tabSmal: false, resurser: "normal", bas: null, avst: false, avstDatum: null, samband: true, pid: null };
function tpVyLas() {
    if (!state || tpVy.pid === state.id) return;
    let v = {};
    try { v = JSON.parse(localStorage.getItem("wimo_tidplanvy_" + state.id) || "{}") || {}; } catch (e) { }
    tpVy.pid = state.id;
    tpVy.fran = null;
    tpVy.zoom = TP_ZOOM[v.zoom] ? v.zoom : "vecka";
    tpVy.helger = !!v.helger;
    tpVy.ihop = new Set(Array.isArray(v.ihop) ? v.ihop : []);
    tpVy.dolda = new Set(Array.isArray(v.dolda) ? v.dolda : []);
    tpVy.tabSmal = v.tabSmal === true;
    tpVy.resurser = ["ihop", "normal", "stor"].indexOf(v.resurser) >= 0 ? v.resurser : "normal";
    tpVy.bas = typeof v.bas === "string" ? v.bas : null;
    tpVy.avst = v.avst === true;
    tpVy.samband = v.samband !== false;
    tpVy.avstDatum = /^\d{4}-\d{2}-\d{2}$/.test(v.avstDatum || "") ? v.avstDatum : null;
}
function tpVySpara() {
    if (!state) return;
    try {
        localStorage.setItem("wimo_tidplanvy_" + state.id, JSON.stringify({ zoom: tpVy.zoom, helger: tpVy.helger, ihop: [...tpVy.ihop],
            dolda: [...tpVy.dolda], tabSmal: tpVy.tabSmal, resurser: tpVy.resurser, bas: tpVy.bas, avst: tpVy.avst, avstDatum: tpVy.avstDatum, samband: tpVy.samband }));
    } catch (e) { }
}
let tpSenasteKlick = { nyckel: null, tid: 0 };
const tpValdaStaplar = new Set();   // markerade staplar ("aktivitetId|periodId") utöver den med fokus
let tpValdPeriod = null;       // "aktivitetId|periodId" för den markerade stapeln

let tpRedigerar = null;        // { cell, id, falt, input }
let tpVantar = false;          // en omritning väntar tills redigeringen är klar

/* ---------- öppna / stänga sidan ---------- */

function oppnaTidplan() {
    try { stangStart(); } catch (e) { }
    try { stangDash(); } catch (e) { }
    try { stangGantt(); } catch (e) { }
    try { stangBackup(); } catch (e) { }
    try { stangHjalp(); } catch (e) { }
    try { stangDagbok(); } catch (e) { }
    try { stangForslag(); } catch (e) { }
    document.body.classList.remove("p4-kontovy");
    document.body.classList.add("dashlage");
    document.getElementById("tidplan").classList.remove("dold");
    ritaTidplan();
}

function stangTidplan() {
    const el = document.getElementById("tidplan");
    if (!el || el.classList.contains("dold"))
        return;
    if (tpRedigerar)
        tpAvsluta(true);
    el.classList.add("dold");
    let annan = false;
    try { annan = dashOppen() || startOppen() || ganttOppen() || backupOppen() || hjalpOppen() || dagbokOppen() || forslagOppen(); } catch (e) { }
    if (!annan)
        document.body.classList.remove("dashlage");
}

function tidplanOppen() { const el = document.getElementById("tidplan"); return !!el && !el.classList.contains("dold"); }

// De andra sidorna stänger Tidplan när de öppnas.
["oppnaGantt", "oppnaDash", "oppnaStart", "oppnaBackup", "oppnaHjalp", "oppnaDagbok", "oppnaForslag"].forEach(namn => {
    const urs = window[namn];
    if (typeof urs !== "function")
        return;
    window[namn] = function () { stangTidplan(); return urs.apply(this, arguments); };
});

/* ---------- data ---------- */

function tpKanAndra() {
    // tidplanen ändras av huvudadmin och projektets projektadmin, alla andra kan läsa
    try { return typeof window.p4ArProjektAdmin !== "function" || window.p4ArProjektAdmin(state.id); } catch (e) { return true; }
}

// Alla rader i visningsordning: varje förälder följs av sina underaktiviteter.
function tpRaderAlla() {
    const ut = [], p = state, sedda = new Set();
    const lagg = (foralder, niva) => tpSyskon(p, foralder).forEach(a => {
        if (sedda.has(a.id)) return;
        sedda.add(a.id);
        ut.push({ a, niva });
        lagg(a.id, niva + 1);
    });
    lagg(null, 0);
    // aktiviteter vars förälder saknas visas sist, så de inte försvinner
    tpAktiviteter(p).forEach(a => { if (!sedda.has(a.id)) { sedda.add(a.id); ut.push({ a, niva: 0 }); } });
    const barn = new Set(tpAktiviteter(p).map(a => a.foralder).filter(Boolean));
    ut.forEach(r => { r.grupp = barn.has(r.a.id); });
    return ut;
}
// De rader som syns: underaktiviteter till hopfällda grupper döljs.
function tpRader() {
    const ut = [];
    let dold = null;
    tpRaderAlla().forEach(r => {
        if (dold !== null && r.niva > dold) return;
        dold = null;
        ut.push(r);
        if (r.grupp && tpVy.ihop.has(r.a.id)) dold = r.niva;
    });
    return ut;
}
function tpBarn() { return tpBarnKarta(tpAktiviteter(state)); }

function tpHitta(id) { return tpAktiviteter(state).find(a => a.id === id) || null; }

// Kör en operation: applicera, spara, logga ångra och rita om.
function tpKor(patch, angraTxt) {
    if (!patch || !patch.ok) {
        if (patch && patch.fel && patch.fel !== "ingen ändring")
            status(patch.fel.charAt(0).toUpperCase() + patch.fel.slice(1), true);
        return false;
    }
    if (!appliceraPatch(patch, { tavla: T(), projekt: state })) {
        status("Ändringen kunde inte sparas", true);
        return false;
    }
    // varje ändring blir ett eget steg i tidplanens ångra-historik (Ctrl+Z / Ctrl+Y)
    tpHistLagg({
        txt: angraTxt || "Ändring i tidplanen",
        angra: () => angraPatch(patch.fore, { tavla: T(), projekt: state }),
        gor: () => appliceraPatch(patch, { tavla: T(), projekt: state })
    });
    spara();
    ritaTidplan();
    return true;
}

// Flera operationer som ETT ångra-steg. steg(kor) anropar kor(patch) för varje ändring i tur och ordning,
// så att varje operation räknas fram på läget efter den förra (t.ex. ordningen för infogade rader).
function tpKorSerie(txt, steg) {
    const gjorda = [], ctx = () => ({ tavla: T(), projekt: state });
    const kor = (patch) => {
        if (!patch || !patch.ok || !appliceraPatch(patch, ctx())) return false;
        gjorda.push(patch);
        return true;
    };
    steg(kor);
    if (!gjorda.length) return null;
    tpHistLagg({
        txt,
        angra: () => { for (let i = gjorda.length - 1; i >= 0; i--) if (angraPatch(gjorda[i].fore, ctx()) === false) return false; return true; },
        gor: () => gjorda.every(p => appliceraPatch(p, ctx()) !== false)
    });
    spara();
    ritaTidplan();
    return gjorda;
}

/* ---------- markera, kopiera, klistra in, radera flera ---------- */

const tpMark = new Set();       // markerade aktiviteter (id)
let tpMarkAnkare = null;        // raden en Skift-markering räknas från
let tpUrklipp = null;           // { text, rader: [kopior i visningsordning med niva] } – senast kopierade rader

// lage: "en" = bara den här raden, "vaxla" = lägg till/ta bort, "intervall" = från ankaret till raden
function tpMarkera(id, lage) {
    const rader = tpRader().map(r => r.a.id);
    if (lage === "intervall" && tpMarkAnkare && rader.indexOf(tpMarkAnkare) >= 0) {
        const i = rader.indexOf(tpMarkAnkare), j = rader.indexOf(id);
        tpMark.clear();
        rader.slice(Math.min(i, j), Math.max(i, j) + 1).forEach(x => tpMark.add(x));
    }
    else if (lage === "vaxla") {
        if (tpMark.has(id)) tpMark.delete(id); else tpMark.add(id);
        tpMarkAnkare = id;
    }
    else {
        const ensam = tpMark.size === 1 && tpMark.has(id);
        tpMark.clear();
        if (!ensam) tpMark.add(id);
        tpMarkAnkare = id;
    }
    ritaTidplan();
    if (tpMark.has(id)) tpFokus(id, "namn");
}

// Markerade rader i visningsordning. Utan markering: raden med fokus.
function tpMarkerade() {
    const rader = tpRader();
    if (tpMark.size) return rader.filter(r => tpMark.has(r.a.id));
    const f = document.activeElement && document.activeElement.closest && document.activeElement.closest("#tidplan .tp-tabell [data-tprad]");
    const r = f && rader.find(x => x.a.id === f.dataset.tprad);
    return r ? [r] : [];
}

function tpMarkGor(gor) {
    const valda = tpMarkerade();
    if (gor === "avmarkera") { tpMark.clear(); return ritaTidplan(); }
    if (gor === "kopiera") return tpKopiera(valda);
    if (gor === "klistra") return tpKlistraInRader(valda.length ? valda[valda.length - 1].a.id : null);
    if (gor === "radera") return tpRaderaMarkerade();
    if (gor === "indrag" || gor === "utdrag") return tpIndrag(valda.map(r => r.a.id), gor === "indrag" ? 1 : -1);
    if ((gor === "ovan" || gor === "nedan") && valda.length) return tpRadGor(gor === "ovan" ? valda[0].a.id : valda[valda.length - 1].a.id, gor === "ovan" ? "infoga" : "infogaNedan");
}

// Indrag (+1): raden blir underaktivitet till raden ovanför på samma nivå.
// Utdrag (-1): raden lyfts ut ur sin grupp och hamnar direkt efter gruppen. Underaktiviteter följer med.
function tpIndrag(ids, steg) {
    if (!tpKanAndra() || !ids.length) return;
    const valda = new Set(ids);
    // en markerad grupp tar med sina underaktiviteter: flytta bara de översta
    const alla = tpRaderAlla(), toppar = alla.filter(r => valda.has(r.a.id) && !tpForfader(r.a, valda));
    let gjort = 0, hinder = 0;
    tpKorSerie(steg > 0 ? "Gjorde till underaktivitet" : "Lyfte ut ur gruppen", (kor) => {
        (steg > 0 ? toppar : toppar.slice().reverse()).forEach(r => {
            const a = tpHitta(r.a.id);
            if (!a) return;
            if (steg > 0) {
                const syskon = tpSyskon(state, a.foralder), i = syskon.indexOf(a);
                const ny = syskon[i - 1];
                if (!ny) { hinder++; return; }
                const barn = tpSyskon(state, ny.id);
                if (kor(opTpAndraAktivitet(a, { foralder: ny.id, ordning: barn.length ? barn[barn.length - 1].ordning + 1 : 1 }))) {
                    gjort++;
                    tpVy.ihop.delete(ny.id);
                }
            }
            else {
                const f = a.foralder && tpHitta(a.foralder);
                if (!f) { hinder++; return; }
                const syskon = tpSyskon(state, f.foralder), i = syskon.indexOf(f), nasta = syskon[i + 1];
                const ordning = nasta ? (f.ordning + nasta.ordning) / 2 : f.ordning + 1;
                if (kor(opTpAndraAktivitet(a, { foralder: f.foralder || null, ordning }))) gjort++;
            }
        });
    });
    tpVySpara();
    if (!gjort && hinder) status(steg > 0 ? "Den första raden i en grupp kan inte bli underaktivitet – det finns ingen rad ovanför på samma nivå" : "Raden ligger redan överst i hierarkin", true);
    if (gjort) { ritaTidplan(); tpFokus(toppar[0].a.id, "namn"); }
}
function tpForfader(a, mangd) {
    let f = a.foralder, n = 0;
    while (f && n++ < 100) { if (mangd.has(f)) return true; const x = tpHitta(f); f = x ? x.foralder : null; }
    return false;
}
function tpVaxlaIhop(id) {
    if (tpVy.ihop.has(id)) tpVy.ihop.delete(id); else tpVy.ihop.add(id);
    tpVySpara();
    ritaTidplan();
    tpFokus(id, "namn");
}

// Kolumner: välj vilka som syns (sparas på datorn).
function tpKolumnVal(knapp) {
    const gammal = document.getElementById("tpKolVal");
    if (gammal) { gammal.remove(); return; }
    const v = document.createElement("div");
    v.id = "tpKolVal";
    v.className = "p4d-pop tp-kolval";
    v.innerHTML = '<div class="tp-kolval-rubrik">Kolumner</div>' + TP_KOLUMNER.filter(k => k.valbar).map(k =>
        '<label><input type="checkbox" data-tpkol="' + k.id + '"' + (tpVy.dolda.has(k.id) ? "" : " checked") + "> " + esc(k.lang || k.namn) + "</label>").join("");
    document.body.appendChild(v);
    const r = knapp.getBoundingClientRect();
    v.style.top = (r.bottom + 6) + "px";
    v.style.left = Math.max(8, Math.min(r.left, innerWidth - v.offsetWidth - 8)) + "px";
    v.addEventListener("change", (e) => {
        const id = e.target.dataset.tpkol;
        if (!id) return;
        if (e.target.checked) tpVy.dolda.delete(id); else tpVy.dolda.add(id);
        tpVySpara();
        ritaTidplan();
    });
    const bort = (e) => { if (!v.contains(e.target) && e.target !== knapp) { v.remove(); document.removeEventListener("pointerdown", bort, true); } };
    setTimeout(() => document.addEventListener("pointerdown", bort, true), 0);
    const f = v.querySelector("input"); if (f) f.focus();
}

// Kopierar raderna (med underaktiviteter till en markerad grupp). Texten fungerar att klistra in i Excel.
function tpKopiera(valda) {
    if (!valda.length) return null;
    const alla = tpRaderAlla(), med = new Set(valda.map(r => r.a.id));
    alla.forEach(r => { if (r.a.foralder && med.has(r.a.foralder)) med.add(r.a.id); });
    const rader = alla.filter(r => med.has(r.a.id));
    const bas = Math.min(...rader.map(r => r.niva));
    const text = rader.map(r => [r.a.namn || "", r.a.ansvarig || "", tpTimmarText(r.a.kalkTimmar)].join("\t")).join("\r\n");
    tpUrklipp = { text, rader: rader.map(r => ({ a: JSON.parse(JSON.stringify(r.a)), niva: r.niva - bas })) };
    status(rader.length + (rader.length === 1 ? " rad kopierad" : " rader kopierade") + " · Ctrl+V klistrar in");
    ritaTidplan();
    return text;
}

// Klistrar in kopierade rader under raden efterId (null = sist). Nya id för rader och perioder.
function tpKlistraInRader(efterId) {
    if (!tpUrklipp || !tpUrklipp.rader.length) return status("Kopiera rader först", true);
    const nya = [];
    const res = tpKorSerie("Klistrade in " + tpUrklipp.rader.length + (tpUrklipp.rader.length === 1 ? " rad" : " rader"), (kor) => {
        const foraldrar = [];             // senaste nya id per nivå
        let efter = efterId;
        tpUrklipp.rader.forEach(({ a: kopia, niva }) => {
            const p = opTpNyAktivitet(state, niva === 0 ? (efter ? { namn: kopia.namn || "", efter } : { namn: kopia.namn || "" }) : { namn: kopia.namn || "" });
            if (!kor(p)) return;
            const id = p.andringar[0].id, a = tpHitta(id);
            const falt = { ansvarig: kopia.ansvarig || "", farg: kopia.farg || "", kalkTimmar: kopia.kalkTimmar == null ? null : kopia.kalkTimmar,
                perioder: (kopia.perioder || []).map(q => Object.assign(JSON.parse(JSON.stringify(q)), { id: tpNyPeriod(q.start, q.arbDagar).id })) };
            if (niva > 0 && foraldrar[niva - 1]) {
                falt.foralder = foraldrar[niva - 1];
                const syskon = tpSyskon(state, foraldrar[niva - 1]).filter(x => x.id !== id);
                falt.ordning = syskon.length ? syskon[syskon.length - 1].ordning + 1 : 1;
            }
            kor(opTpAndraAktivitet(a, falt));
            foraldrar[niva] = id;
            foraldrar.length = niva + 1;
            if (niva === 0) efter = id;
            nya.push(id);
        });
    });
    if (res) { tpMark.clear(); nya.forEach(id => tpMark.add(id)); ritaTidplan(); if (nya[0]) tpFokus(nya[0], "namn"); }
}

// Text från Excel eller en lista: en rad per aktivitet, kolumnerna namn, ansvarig, timmar (tabbar).
function tpTolkaText(text) {
    return String(text || "").replace(/\r/g, "").split("\n").map(r => r.split("\t").map(c => c.trim()))
        .filter(c => c.some(x => x !== "")).map(c => {
            const t = (c[2] || "").replace(/\s|h$/gi, "").replace(",", ".");
            return { namn: c[0] || "", ansvarig: c[1] || "", kalkTimmar: /^\d+(\.\d+)?$/.test(t) ? +t : null };
        });
}
function tpKlistraInText(text, efterId) {
    const rader = tpTolkaText(text);
    if (!rader.length) return false;
    const nya = [];
    tpKorSerie("Klistrade in " + rader.length + (rader.length === 1 ? " aktivitet" : " aktiviteter"), (kor) => {
        let efter = efterId;
        rader.forEach(r => {
            const p = opTpNyAktivitet(state, efter ? { namn: r.namn, ansvarig: r.ansvarig, kalkTimmar: r.kalkTimmar, efter } : { namn: r.namn, ansvarig: r.ansvarig, kalkTimmar: r.kalkTimmar });
            if (kor(p)) { efter = p.andringar[0].id; nya.push(efter); }
        });
    });
    tpMark.clear(); nya.forEach(id => tpMark.add(id));
    ritaTidplan();
    if (nya[0]) tpFokus(nya[nya.length - 1], "namn");
    status(nya.length + (nya.length === 1 ? " aktivitet inklistrad" : " aktiviteter inklistrade") + " · Ctrl+Z ångrar");
    return true;
}

function tpRaderaMarkerade() {
    const valda = tpMarkerade();
    if (!valda.length) return;
    const rader = tpRader(), sista = rader.findIndex(r => r.a.id === valda[valda.length - 1].a.id);
    const bort = new Set(valda.map(r => r.a.id));
    const kvar = rader.slice(sista + 1).find(r => !bort.has(r.a.id)) || rader.slice(0, sista).reverse().find(r => !bort.has(r.a.id));
    tpKorSerie("Raderade " + valda.length + (valda.length === 1 ? " rad" : " rader"), (kor) => {
        valda.forEach(r => { const a = tpHitta(r.a.id); if (a) kor(opTpTaBortAktivitet(state, a)); });
    });
    tpMark.clear();
    ritaTidplan();
    tpFokus(kvar ? kvar.a.id : "ny", "namn");
    status(valda.length + (valda.length === 1 ? " rad raderad" : " rader raderade") + " · Ctrl+Z ångrar");
}

// Urklipp: Ctrl+C / Ctrl+X / Ctrl+V i tabellen. I ett textfält gäller webbläsarens vanliga
// kopiering, utom när man klistrar in flera rader (då blir varje rad en aktivitet).
document.addEventListener("copy", (e) => {
    if (!tidplanOppen() || tpRedigerar || document.querySelector("#overlay .modal")) return;
    if (!(document.activeElement && document.activeElement.closest && document.activeElement.closest("#tidplan .tp-tabell")) && !tpMark.size) return;
    const text = tpKopiera(tpMarkerade());
    if (text == null) return;
    e.preventDefault();
    e.clipboardData.setData("text/plain", text);
});
document.addEventListener("paste", (e) => {
    if (!tidplanOppen() || !tpKanAndra() || document.querySelector("#overlay .modal")) return;
    const iTabell = document.activeElement && document.activeElement.closest && document.activeElement.closest("#tidplan .tp-tabell");
    if (!iTabell && !tpMark.size) return;
    const text = (e.clipboardData && e.clipboardData.getData("text/plain")) || "";
    const flera = /[\n\t]/.test(text.replace(/\r?\n$/, ""));
    let efter = null, iNyRad = false;
    if (tpRedigerar) {
        if (!flera) return;                   // en vanlig text klistras in i fältet
        iNyRad = tpRedigerar.id === "ny";
        efter = iNyRad ? null : tpRedigerar.id;
        tpAvsluta(!iNyRad);
    }
    else {
        const valda = tpMarkerade();
        efter = valda.length ? valda[valda.length - 1].a.id : null;
    }
    e.preventDefault();
    if (tpUrklipp && text.replace(/\r/g, "") === tpUrklipp.text.replace(/\r/g, "")) return tpKlistraInRader(efter);
    tpKlistraInText(text, efter);
});

/* ---------- ångra och gör om ----------
   En historik per projekt (bara i det här fönstret). Varje steg vet hur det ångras och görs om.
   En dragning är ett steg. Ändrar någon annan samma aktivitet så att steget inte går att ångra
   längre, tas steget bort och det sägs till. */
const TP_HIST_MAX = 100;
const tpHistorik = new Map();   // projekt-id → { bak: [], fram: [] }
function tpHist() {
    const id = state && state.id;
    if (!tpHistorik.has(id)) tpHistorik.set(id, { bak: [], fram: [] });
    return tpHistorik.get(id);
}
function tpHistLagg(steg) {
    const h = tpHist();
    h.bak.push(steg);
    if (h.bak.length > TP_HIST_MAX) h.bak.shift();
    h.fram = [];
}
function tpAngra() {
    const h = tpHist(), steg = h.bak.pop();
    if (!steg) return status("Inget att ångra");
    if (steg.angra() === false) { h.fram = []; spara(); ritaTidplan(); return status("Det går inte att ångra längre: aktiviteten har ändrats av någon annan", true); }
    h.fram.push(steg);
    spara();
    ritaTidplan();
    status("Ångrade: " + steg.txt);
}
function tpGorOm() {
    const h = tpHist(), steg = h.fram.pop();
    if (!steg) return status("Inget att göra om");
    if (steg.gor() === false) { h.fram = []; spara(); ritaTidplan(); return status("Det går inte att göra om längre", true); }
    h.bak.push(steg);
    spara();
    ritaTidplan();
    status("Gjorde om: " + steg.txt);
}

/* ---------- projektets kalender ---------- */

const TP_VDAG = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

function tpKalenderDialog() {
    if (!tpKanAndra()) return status("Bara projektadmin kan ändra kalendern", true);
    const fore = kalInst(state.tidplan.kalender);
    let lediga = fore.ledigaDagar.slice().sort(), semestrar = fore.semestrar.map(x => Object.assign({}, x));
    const ar = +IDAG.slice(0, 4);
    const helgLista = [ar, ar + 1].map(y => [...svenskaHelgdagar(y).entries()].filter(([d]) => d >= IDAG).map(([d, n]) => kortDatum(d) + " " + n)).flat().slice(0, 8).join(" · ");
    const semRad = (x, i) => '<div class="tp-semrad" data-sem="' + i + '">' +
        '<input class="f" type="text" data-semf="namn" value="' + esc(x.namn || "") + '" placeholder="T.ex. Industrisemester" aria-label="Namn">' +
        '<input class="f" type="date" data-semf="fran" value="' + esc(x.fran || "") + '" aria-label="Från">' +
        '<input class="f" type="date" data-semf="till" value="' + esc(x.till || "") + '" aria-label="Till och med">' +
        '<button type="button" class="parkiv" data-semtabort="' + i + '">Ta bort</button></div>';
    const ritaSem = () => { document.getElementById("tpSemLista").innerHTML = semestrar.map(semRad).join("") || '<p class="hjalp" style="margin:0">Ingen semester inlagd.</p>'; };
    const ledigText = () => lediga.length ? lediga.map(d => kortDatum(d) + (d.slice(0, 4) !== String(ar) ? "/" + d.slice(2, 4) : "")).join(", ") : "Inga";
    const kropp =
        '<p class="hjalp">Kalendern gäller hela tidplanen. Perioderna behåller sitt antal arbetsdagar när kalendern ändras, men slutdatumen kan flyttas.</p>' +
        '<div class="falt"><label>Arbetsdagar</label><div class="krysslista tp-vdagar">' +
        TP_VDAG.map((n, i) => '<label><input type="checkbox" class="tpVdag" value="' + (i + 1) + '"' + (fore.arbetsveckan.indexOf(i + 1) >= 0 ? " checked" : "") + "> " + n + "</label>").join("") + "</div></div>" +
        '<div class="falt"><label for="tpTimmar">Arbetstimmar per dag</label><input class="f" id="tpTimmar" type="number" min="1" max="24" step="0.5" value="' + fore.arbTimmarPerDag + '" style="max-width:120px"></div>' +
        '<div class="falt"><label class="tp-kryss"><input type="checkbox" id="tpHelg"' + (fore.helgdagar ? " checked" : "") + "> Räkna med svenska helgdagar</label>" +
        '<p class="hjalp" style="margin:4px 0 0">Även jul-, midsommar- och nyårsafton. Närmast: ' + esc(helgLista) + "</p></div>" +
        '<div class="falt"><label>Projektets lediga dagar</label><div class="ue-datumrad"><button type="button" class="mknapp" id="tpLedigaKnapp">Välj lediga dagar…</button>' +
        '<span class="hjalp" id="tpLedigaText">' + esc(ledigText()) + "</span></div></div>" +
        '<div class="falt"><label>Semester och längre uppehåll</label><div id="tpSemLista"></div>' +
        '<button type="button" class="mknapp" id="tpSemNy" style="margin-top:8px">+ Lägg till period</button></div>' +
        '<div id="tpKalFel"></div>';
    modal("Projektets kalender", "", kropp, [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Spara", primar: true, fn: () => {
                const vecka = [...document.querySelectorAll(".tpVdag:checked")].map(e => +e.value);
                const timmar = parseFloat(String(document.getElementById("tpTimmar").value).replace(",", "."));
                const sem = semestrar.filter(x => x.fran && x.till);
                const fel = !vecka.length ? "Välj minst en arbetsdag." : !(timmar > 0 && timmar <= 24) ? "Ange arbetstimmar mellan 1 och 24." :
                    sem.some(x => x.fran > x.till) ? "En semester slutar före den börjar." : "";
                if (fel) { document.getElementById("tpKalFel").innerHTML = '<div class="notis rod">' + fel + "</div>"; return; }
                const ny = Object.assign({}, state.tidplan.kalender, { arbetsveckan: vecka, arbTimmarPerDag: timmar,
                    helgdagar: document.getElementById("tpHelg").checked, ledigaDagar: lediga, semestrar: sem });
                tpSparaKalender(ny);
            } }
    ]);
    ritaSem();
    document.getElementById("tpLedigaKnapp").addEventListener("click", (e) => datumKalender(lediga, lista => {
        lediga = lista; document.getElementById("tpLedigaText").textContent = ledigText();
    }, "Projektets lediga dagar", e.currentTarget));
    document.getElementById("tpSemNy").addEventListener("click", () => { semestrar.push({ namn: "", fran: "", till: "" }); ritaSem(); });
    document.getElementById("tpSemLista").addEventListener("input", (e) => {
        const r = e.target.closest("[data-sem]");
        if (r && e.target.dataset.semf) semestrar[+r.dataset.sem][e.target.dataset.semf] = e.target.value;
    });
    document.getElementById("tpSemLista").addEventListener("change", (e) => {
        const r = e.target.closest("[data-sem]");
        if (r && e.target.dataset.semf) semestrar[+r.dataset.sem][e.target.dataset.semf] = e.target.value;
    });
    document.getElementById("tpSemLista").addEventListener("click", (e) => {
        const b = e.target.closest("[data-semtabort]");
        if (b) { semestrar.splice(+b.dataset.semtabort, 1); ritaSem(); }
    });
}

// Visar vilka perioder som får nya datum innan kalendern sparas (regel 6). Sparar och kan ångras.
function tpSparaKalender(ny) {
    const gammal = JSON.parse(JSON.stringify(state.tidplan.kalender || {}));
    const pav = kalPaverkan(tpAktiviteter(state), gammal, ny);
    const spara_ = () => {
        const tp = state.tidplan;
        tp.kalender = ny;
        tpHistLagg({ txt: "Ändrade kalendern", angra: () => { tp.kalender = gammal; }, gor: () => { tp.kalender = ny; } });
        stangModal();
        spara();
        ritaTidplan();
        status("Kalendern sparad" + (pav.length ? " · " + pav.length + (pav.length === 1 ? " period fick nytt slutdatum" : " perioder fick nya slutdatum") : ""));
    };
    if (!pav.length) return spara_();
    const rader = pav.slice(0, 10).map(x => "<tr><td>" + esc(x.aktivitet.namn || "Aktivitet") + "</td><td>" +
        (x.startFore !== x.startEfter ? "start " + kortDatum(x.startFore) + " → " + kortDatum(x.startEfter) + ", " : "") +
        "slut " + kortDatum(x.fore) + " → <b>" + kortDatum(x.efter) + "</b></td></tr>").join("");
    modal("Ändrade slutdatum", "", '<p class="fraga">' + pav.length + (pav.length === 1 ? " period får" : " perioder får") + " nytt slutdatum.</p>" +
        '<p class="hjalp">Perioderna behåller sitt antal arbetsdagar, men lediga dagar räknas annorlunda.</p>' +
        '<table class="lista tp-pavlista"><tbody>' + rader + "</tbody></table>" + (pav.length > 10 ? '<p class="hjalp">… och ' + (pav.length - 10) + " till.</p>" : ""), [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Spara kalendern", primar: true, fn: spara_ }
    ]);
}

/* ---------- ritning ---------- */

function tpTimmarText(v) { return typeof v === "number" ? String(v).replace(".", ",") : ""; }

// Projektets kalender (helgdagar, lediga dagar, semester). Byggs om när inställningarna ändras.
let tpKalCache = { nyckel: null, kal: null };
function tpKal() {
    const k = state && state.tidplan ? state.tidplan.kalender : null, nyckel = JSON.stringify(k || {});
    if (tpKalCache.nyckel !== nyckel) tpKalCache = { nyckel, kal: skapaKalender(k) };
    return tpKalCache.kal;
}
// Periodens första och sista arbetsdag enligt projektets kalender (regel 3 och 5 i kalender.js).
function tpStart(q) { return tpKal().narmasteArbetsdag(q.start, 1); }
function tpSlut(q) { return tpKal().slut(q.start, q.arbDagar); }
// Visade dagar per vecka: mån–fre, eller hela veckan om lördag eller söndag är arbetsdag.
function tpDpv() { return tpVy.helger || tpKal().inst.arbetsveckan.some(n => n > 5) ? 7 : 5; }

function tpPerioderText(a) {
    const l = (a.perioder || []).slice().sort((x, y) => x.start < y.start ? -1 : 1);
    if (!l.length)
        return "";
    const fran = l[0].start, till = l.map(tpSlut).sort().pop();
    return (l.length > 1 ? l.length + " st · " : "") + kortDatum(tpStart(l[0])) + "–" + kortDatum(till);
}

// Färgerna en aktivitet kan få (fältet farg): tavlans posttypsfärger utom mötets. Tomt = grön.
const TP_FARGER = [["gron", "Grön"], ["bla", "Blå"], ["orange", "Orange"], ["lila", "Lila"], ["rod", "Röd"], ["brun", "Brun"]];
const tpFarg = (a) => TP_FARGER.some(f => f[0] === a.farg) ? a.farg : "gron";

function tpCell(a, k, nr, r) {
    r = r || {};
    if ((k.id === "klart" || k.id === "basavvik") && typeof tpUfCell === "function") return tpUfCell(a, k, r);
    if (k.id === "namn") {
        const v = a.namn || "";
        const ihop = r.grupp && tpVy.ihop.has(a.id);
        return '<div class="tp-c tp-e" tabindex="-1" data-tpfalt="namn">' +
            (r.grupp ? '<button type="button" class="tp-ihop' + (ihop ? " ihop" : "") + '" data-tpihop tabindex="-1" aria-expanded="' + !ihop + '" title="' + (ihop ? "Visa" : "Fäll ihop") + ' underaktiviteterna" aria-label="' + (ihop ? "Visa" : "Fäll ihop") + ' underaktiviteterna">' + TP_PIL_H + "</button>" : "") +
            '<span class="tp-namntext"' + (String(v).length > 18 ? ' title="' + esc(v) + '"' : "") + '>' + esc(v) + "</span></div>";
    }
    if (k.id === "plan" || k.id === "avvik") {
        const barn = r.barnKarta || tpBarn(), kal = tpKal();
        const plan = tpPlaneradeTimmar(kal, barn, a, r.grupp), kalk = tpKalkTimmar(barn, a);
        if (k.id === "plan")
            return '<div class="tp-c tp-tal' + (r.grupp ? " tp-summa-tal" : "") + '">' + (plan ? tpTimmarText(Math.round(plan * 10) / 10) : "") + "</div>";
        const av = tpAvvikelse(kalk, plan);
        if (!av) return '<div class="tp-c tp-tal"></div>';
        const t = Math.round(av.timmar), pr = av.procent === null ? "" : (av.procent > 0 ? "+" : av.procent < 0 ? "−" : "") + Math.abs(Math.round(av.procent)) + " %";
        const kl = Math.abs(av.procent || 0) < 5 ? "noll" : av.timmar > 0 ? "over" : "under";
        return '<div class="tp-c tp-tal tp-avvik ' + kl + '" title="Planerat ' + tpTimmarText(Math.round(plan)) + " h, kalkylerat " + tpTimmarText(kalk) + ' h">' +
            (t > 0 ? "+" : t < 0 ? "−" : "") + Math.abs(t) + " h <small>" + pr + "</small></div>";
    }
    if (k.id === "kalkTimmar" && r.grupp && typeof a.kalkTimmar !== "number") {
        const sum = tpKalkTimmar(r.barnKarta || tpBarn(), a);
        return '<div class="tp-c tp-e tp-tal tp-summa-tal" tabindex="-1" data-tpfalt="kalkTimmar" title="Summan av underaktiviteterna">' + (sum === null ? "" : tpTimmarText(sum)) + "</div>";
    }
    if (k.id === "nr") {
        const f = tpFarg(a), namn = TP_FARGER.find(x => x[0] === f)[1];
        return '<div class="tp-c tp-nr"><button type="button" class="tp-farg" data-tpfarg title="Färg: ' + namn + ' (klicka för att byta)" aria-label="Färg: ' + namn + '"></button>' + nr + "</div>";
    }
    if (k.id === "perioder") {
        if (r.grupp) {
            const sp = tpSpann(tpKal(), r.barnKarta || tpBarn(), a);
            return '<div class="tp-c tp-per tp-summa-tal">' + (sp ? kortDatum(sp.fran) + "–" + kortDatum(sp.till) : "") + "</div>";
        }
        return '<div class="tp-c tp-per">' + esc(tpPerioderText(a)) + "</div>";
    }
    const v = k.id === "kalkTimmar" ? tpTimmarText(a.kalkTimmar) : (a[k.id] || "");
    return '<div class="tp-c tp-e' + (k.id === "kalkTimmar" ? " tp-tal" : "") + '" tabindex="-1" data-tpfalt="' + k.id + '">' + esc(v) + "</div>";
}

/* ---------- kalenderns tidsaxel: en kolumn per veckodag (mån–fre, eller hela veckan) ----------
   Lediga dagar (helgdagar, projektets lediga dagar, semester) har en egen kolumn men skuggas.
   En period ritas från sin första till sin sista arbetsdag, och lediga dagar inuti stapeln streckas. */

function tpAxel() {
    const iMan = d2iso(mandag(iso2d(IDAG)));
    const fran = tpVy.fran || plus(iMan, -7), dpv = tpDpv();
    const minV = (TP_ZOOM[tpVy.zoom] || TP_ZOOM.vecka).veckor;
    let sista = plus(fran, minV * 7 - 1);
    tpAktiviteter(state).forEach(a => (a.perioder || []).forEach(q => {
        const s = plus(tpSlut(q), 14);
        if (s > sista) sista = s;
    }));
    const veckor = Math.max(minV, Math.ceil((iso2d(sista) - iso2d(fran)) / 864e5 / 7));
    const dagar = [];
    for (let w = 0; w < veckor; w++)
        for (let d = 0; d < dpv; d++)
            dagar.push(plus(fran, w * 7 + d));
    const index = {};
    dagar.forEach((d, i) => { index[d] = i; });
    return { fran, dagar, index, veckor, dpv };
}

// Kolumn för ett datum, även utanför axeln. Med fem dagar i veckan hamnar helgen på fredagen.
function tpKol(ax, iso) {
    if (ax.index[iso] !== undefined)
        return ax.index[iso];
    const w = Math.floor(Math.round((iso2d(iso) - iso2d(ax.fran)) / 864e5) / 7), wd = (iso2d(iso).getDay() + 6) % 7;
    return w * ax.dpv + Math.min(wd, ax.dpv - 1);
}
// Datumet för en kolumn, även utanför axeln.
function tpDagAvKol(ax, k) {
    if (k >= 0 && k < ax.dagar.length) return ax.dagar[k];
    const w = Math.floor(k / ax.dpv);
    return plus(ax.fran, w * 7 + (k - w * ax.dpv));
}

// Kort text om bemanningen på en period: "4 pers", "4–1 pers" (varierande).
function tpBemText(q) {
    const tal = [];
    (q.bemanning || []).forEach(b => (b.segment || []).forEach(sg => tal.push(+sg.antal || 0)));
    if (!tal.length) return "";
    const typer = (q.bemanning || []).length;
    if (typer > 1) {
        // flera resurstyper: summan per segmentstart
        const dagar = tpKal().dagarI(q.start, q.arbDagar), sum = dagar.map((d, i) => q.bemanning.reduce((x, b) => x + tpSegmentAntal(b.segment, i + 1), 0));
        const mx = Math.max(...sum), mn = Math.min(...sum);
        return (mx === mn ? mx : mx + "–" + mn) + " pers";
    }
    const mx = Math.max(...tal), mn = Math.min(...tal);
    return mx ? (mx === mn ? mx : mx + "–" + mn) + " pers" : "";
}

function tpStaplar(a, ax, r) {
    const kal = tpKal();
    let html = typeof tpUfBasStaplar === "function" ? tpUfBasStaplar(a, ax, r) : "";
    // grupp: en tunn stapel från första till sista dagen i gruppen (dra den för att flytta hela gruppen)
    if (r && r.grupp) {
        const sp = tpSpann(kal, r.barnKarta || tpBarn(), a);
        if (sp) {
            const k0 = tpKol(ax, sp.fran), k1 = tpKol(ax, sp.till);
            const titel = (a.namn || "Grupp") + "\n" + dagEtikett(sp.fran) + " – " + dagEtikett(sp.till) + "\n" + kal.arbetsdagar(sp.fran, sp.till) + " arbetsdagar" +
                (tpKanAndra() ? "\nDra för att flytta hela gruppen" : "");
            html += '<div class="tp-summa" data-tpgrupp="' + esc(a.id) + '" style="left:' + (k0 * TP_DW) + "px;width:" + ((k1 - k0 + 1) * TP_DW) + 'px" title="' + esc(titel) + '"><span></span></div>';
        }
    }
    return html + (a.perioder || []).map(q => {
        const start = tpStart(q), slut = tpSlut(q);
        const k0 = tpKol(ax, start), k1 = tpKol(ax, slut), w = (k1 - k0 + 1) * TP_DW;
        const nyckel = a.id + "|" + q.id;
        const vald = tpValdPeriod === nyckel || tpValdaStaplar.has(nyckel);
        // lediga dagar inuti perioden streckas
        const pauser = [];
        for (let k = k0 + 1; k < k1; k++) {
            const d = tpDagAvKol(ax, k), skal = kal.ledigtSkal(d);
            if (skal) pauser.push({ k, skal });
        }
        const kd = Math.round((iso2d(slut) - iso2d(start)) / 864e5) + 1;
        const bem = tpBemText(q), pd = tpPeriodPersondagar(kal, q).tot;
        const titel = (a.namn || "Aktivitet") + "\n" + dagEtikett(start) + " – " + dagEtikett(slut) + "\n" + q.arbDagar + " arbetsdagar · " + kd + " kalenderdagar" +
            (pd ? "\n" + bem + " · " + tpTimmarText(pd) + " persondagar · " + tpTimmarText(pd * kal.inst.arbTimmarPerDag) + " h" : "") +
            (pauser.length ? "\nLedigt: " + [...new Set(pauser.map(x => x.skal).filter(x => x !== "helg"))].join(", ") : "") +
            (start !== q.start ? "\nStarten " + kortDatum(q.start) + " är en ledig dag, perioden börjar " + kortDatum(start) : "") +
            (q.utanforSammanstallning ? "\nRäknas inte med i gruppens spann" : "") +
            (typeof a.klart === "number" ? "\n" + a.klart + " % klart" : "") +
            (tpKanAndra() ? "\n\nDubbelklicka för datum, färg och bemanning" : "");
        const fyll = typeof tpUfFyll === "function" ? tpUfFyll(a, q, ax, k0, k1) : 0, klart = tpKlart(a);
        const etikett = w >= 44 ? q.arbDagar + " d" + (bem && w >= 92 ? " · " + bem : "") + (klart && w >= 120 ? " · " + klart + " %" : "") : "";
        const koppla = tpKanAndra() && !(r && r.grupp) && typeof tpSbVisa === "function" && tpSbVisa();
        const tv = typeof tpTvStapel === "function" ? tpTvStapel(a, q, tpTvCache) : { cls: "", titel: "", mark: "" };
        return '<button type="button" class="tp-stapel' + (vald ? " vald" : "") + (typeof tpSbBrottIds !== "undefined" && tpSbBrottIds.has(a.id) ? " sbbrott" : "") + tv.cls + (tpValdaStaplar.has(nyckel) ? " flervald" : "") + (start !== q.start ? " flyttstart" : "") +
            (q.farg ? " egenfarg tpc-" + q.farg : "") + '" data-tpper="' + esc(nyckel) + '"' +
             ' style="left:' + (k0 * TP_DW) + "px;width:" + w + 'px" title="' + esc(titel + tv.titel) + '" aria-label="' + esc((titel + tv.titel).replace(/\n/g, ", ")) + '" aria-pressed="' + vald + '">' +
            tv.mark +
            (fyll ? '<span class="tp-fyll" style="width:' + Math.min(w, fyll).toFixed(1) + 'px" aria-hidden="true"></span>' : "") +
            pauser.map(x => '<span class="tp-paus" style="left:' + ((x.k - k0) * TP_DW) + 'px" aria-hidden="true"></span>').join("") +
            '<span class="tp-hand v" data-tphand="start" aria-hidden="true"></span>' +
            (etikett ? '<span class="tp-dgr">' + etikett + "</span>" : "") +
            '<span class="tp-hand h" data-tphand="slut" aria-hidden="true"></span>' +
            (koppla ? '<span class="tp-koppla" data-tpkoppla title="Dra till en annan stapel för att skapa ett samband" aria-hidden="true"></span>' : "") + "</button>";
    }).join("");
}

// Kalenderns huvud: veckor (vecka), veckor + dagar (dag) eller månader + veckor (månad).
function tpKalHuvud(ax) {
    const z = tpVy.zoom, ut = [];
    const span = (x, w, cls, txt, titel) => ut.push('<span class="' + cls + '" style="left:' + x + "px;width:" + w + 'px"' + (titel ? ' title="' + esc(titel) + '"' : "") + ">" + txt + "</span>");
    for (let w = 0; w < ax.veckor; w++) {
        const d = ax.dagar[w * ax.dpv], x = w * ax.dpv * TP_DW, bw = ax.dpv * TP_DW;
        if (z === "manad") span(x, bw, "tp-kh-v liten", String(veckonr(d)), "Vecka " + veckonr(d) + ", från " + kortDatum(d));
        else span(x, bw, "tp-kh-v" + (z === "dag" ? " ovre" : ""), "v" + veckonr(d) + " <small>" + kortDatum(d) + "</small>", "Vecka " + veckonr(d) + ", från " + kortDatum(d));
    }
    if (z === "dag")
        ax.dagar.forEach((d, i) => span(i * TP_DW, TP_DW, "tp-kh-d" + (d === IDAG ? " idag" : ""), "<small>" + DAGKORT[(iso2d(d).getDay() + 6) % 7].charAt(0) + "</small>" + iso2d(d).getDate()));
    if (z === "manad") {
        let start = 0;
        ax.dagar.forEach((d, i) => {
            const nasta = ax.dagar[i + 1];
            if (!nasta || nasta.slice(0, 7) !== d.slice(0, 7)) {
                const m = iso2d(d);
                span(start * TP_DW, (i - start + 1) * TP_DW, "tp-kh-m", MANAD[m.getMonth()].replace(/^./, c => c.toUpperCase()) + " " + m.getFullYear());
                start = i + 1;
            }
        });
    }
    return '<div class="tp-kalhuvud z-' + z + '">' + ut.join("") + "</div>";
}

function ritaTidplan() {
    const el = document.getElementById("tidplan");
    if (!el || !state)
        return;
    if (tpRedigerar || tpDrag) { tpVantar = true; return; }
    tpVantar = false;
    tpVyLas();
    if (typeof tpSbForbered === "function") tpSbForbered();
    if (typeof tpTvForbered === "function") tpTvForbered();
    TP_DW = TP_ZOOM[tpVy.zoom].dw;
    const kal0 = el.querySelector(".tp-kalender");
    if (kal0) tpScroll = kal0.scrollLeft;
    const fokusStapel = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.tpper;
    const fokus = document.activeElement && document.activeElement.closest && document.activeElement.closest("#tidplan [data-tprad]");
    const fokusId = fokus && fokus.dataset.tprad, fokusFalt = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.tpfalt;
    const kan = tpKanAndra(), rader = tpRader(), ax = tpAxel(), barnKarta = tpBarn(), kolumner = tpKolumner();
    const alla = tpAktiviteter(state).length;
    [...tpMark].forEach(id => { if (!rader.some(r => r.a.id === id)) tpMark.delete(id); });
    [...tpValdaStaplar].forEach(k => { if (!tpPeriodAv(k)) tpValdaStaplar.delete(k); });
    // idag på helg: linjen läggs mellan fredag och måndag
    const bredd = ax.dagar.length * TP_DW, iHelg = ax.index[IDAG] === undefined;
    const idagX = iHelg ? (tpKol(ax, IDAG) + 1) * TP_DW : ax.index[IDAG] * TP_DW + TP_DW / 2;
    const radHtml = rader.map((r, i) => {
        r.barnKarta = barnKarta;
        const m = tpMark.has(r.a.id);
        return '<div class="tp-rad tpc-' + tpFarg(r.a) + (r.niva ? " tp-under" : "") + (r.grupp ? " tp-grupp" : "") + (m ? " markerad" : "") + '" data-tprad="' + esc(r.a.id) + '" style="--niva:' + r.niva + '"' + (m ? ' aria-selected="true"' : "") + ">" +
            kolumner.map(k => tpCell(r.a, k, i + 1, r)).join("") + "</div>";
    }).join("");
    const nyRad = kan ? '<div class="tp-rad tp-nyrad" data-tprad="ny">' +
        '<div class="tp-c tp-nr">' + (rader.length + 1) + "</div>" +
        '<div class="tp-c tp-e" tabindex="-1" data-tpfalt="namn"><span class="tp-tom">Ny aktivitet</span></div>' +
        kolumner.slice(2).map(() => '<div class="tp-c"></div>').join("") + "</div>" : "";
    const kalRad = (r) => '<div class="tp-kalrad' + (r ? " tpc-" + tpFarg(r.a) + (r.grupp ? " tp-grupprad" : "") : "") + '" data-tpspar="' + (r ? esc(r.a.id) : "ny") + '">' + (r ? tpStaplar(r.a, ax, r) : "") + "</div>";
    const kalObj = tpKal();
    const lediga = ax.dagar.map((d, i) => ({ d, i, skal: kalObj.ledigtSkal(d) })).filter(x => x.skal);
    const hist = tpHist(), h1 = hist.bak[hist.bak.length - 1], h2 = hist.fram[hist.fram.length - 1];
    const tabBredd = tpVy.tabSmal ? "20%" : "70%";
    el.classList.toggle("tp-tabsmal", tpVy.tabSmal);
    el.innerHTML =
        '<div class="p4-hero tp-hero"><div class="p4-hero-text">' +
        '<h1 class="g-rubrik">Tidplan</h1>' +
        '<div class="g-meta">' + esc(state.projekt || "Projekt") + " · " + alla + (alla === 1 ? " aktivitet" : " aktiviteter") +
        (kan ? "" : " · bara läsbehörighet") + "</div></div>" +
        '<div class="tp-verktyg">' + (typeof tpSbKnapp === "function" ? tpSbKnapp() : "") +
        (kan ? '<div class="tp-nav" role="group" aria-label="Ångra och gör om">' +
            '<button type="button" data-tpgor="angra" title="Ångra (Ctrl+Z)' + (h1 ? ": " + esc(h1.txt) : "") + '"' + (h1 ? "" : " disabled") + ' aria-label="Ångra" class="tp-ikon">' + TP_ANGRA + "</button>" +
            '<button type="button" data-tpgor="gorom" title="Gör om (Ctrl+Y)' + (h2 ? ": " + esc(h2.txt) : "") + '"' + (h2 ? "" : " disabled") + ' aria-label="Gör om" class="tp-ikon">' + TP_GOROM + "</button></div>" : "") +
        '<div class="tp-nav tp-zoom" role="radiogroup" aria-label="Tidsskala">' +
        Object.keys(TP_ZOOM).map(z => '<button type="button" role="radio" aria-checked="' + (tpVy.zoom === z) + '" class="' + (tpVy.zoom === z ? "vald" : "") + '" data-tpzoom="' + z + '">' + TP_ZOOM[z].namn + "</button>").join("") + "</div>" +
        '<div class="tp-nav" role="group" aria-label="Visning">' +
        '<button type="button" data-tpgor="helger" aria-pressed="' + tpVy.helger + '" class="' + (tpVy.helger ? "vald" : "") + '" title="Visa lördag och söndag i kalendern">Helger</button>' +
        '<button type="button" data-tpgor="kolumner" aria-haspopup="true" title="Välj vilka kolumner som syns">Kolumner</button>' +
        '<button type="button" data-tpgor="uppfoljning" aria-haspopup="dialog" aria-pressed="' + !!(tpVy.bas || tpVy.avst) + '" class="' + (tpVy.bas || tpVy.avst ? "vald" : "") + '" title="Baslinje och avstämningslinje">Uppföljning</button>' +
        (kan ? '<button type="button" data-tpgor="kalender" title="Arbetsdagar, helgdagar, lediga dagar och semester">Kalender</button>' : "") +
            '<button type="button" data-tpgor="skrivut" title="Skriv ut eller spara som PDF (Ctrl+P)">Skriv ut</button>' +
            (typeof tpTvKnapp === "function" ? tpTvKnapp() : "") + "</div>" +
        '<div class="tp-nav" role="group" aria-label="Kalenderns period">' +
        '<button type="button" data-tpnav="-4" title="4 veckor bakåt" aria-label="4 veckor bakåt">' + TP_PIL_V + "</button>" +
        '<button type="button" data-tpnav="idag">Idag</button>' +
        '<button type="button" data-tpnav="4" title="4 veckor framåt" aria-label="4 veckor framåt">' + TP_PIL_H + "</button></div></div></div>" +
        (kan ? '<div class="tp-markrad' + (tpMark.size ? "" : " dold") + '" role="toolbar" aria-label="Markerade rader">' +
            "<b>" + tpMark.size + (tpMark.size === 1 ? " rad markerad" : " rader markerade") + "</b>" +
            '<button type="button" class="mknapp" data-tpmark="kopiera" title="Ctrl+C">Kopiera</button>' +
            '<button type="button" class="mknapp" data-tpmark="klistra" title="Ctrl+V"' + (tpUrklipp ? "" : " disabled") + ">Klistra in under</button>" +
            '<span class="tp-markdel" aria-hidden="true"></span>' +
            '<button type="button" class="mknapp" data-tpmark="utdrag" title="Alt+Skift+← · lyft ut ur gruppen">' + TP_PIL_V + "Lyft ut</button>" +
            '<button type="button" class="mknapp" data-tpmark="indrag" title="Alt+Skift+→ · gör till underaktivitet till raden ovanför">Gör till underaktivitet' + TP_PIL_H + "</button>" +
            '<span class="tp-markdel" aria-hidden="true"></span>' +
            '<button type="button" class="mknapp" data-tpmark="ovan" title="Ctrl+Enter">Infoga ovanför</button>' +
            '<button type="button" class="mknapp" data-tpmark="nedan" title="Ctrl+Skift+Enter">Infoga nedanför</button>' +
            '<button type="button" class="mknapp tp-fara" data-tpmark="radera" title="Ctrl+Delete">Radera</button>' +
            '<button type="button" class="p4d-lank" data-tpmark="avmarkera" title="Esc">Avmarkera</button></div>' : "") +
        '<div class="tp-yta z-' + tpVy.zoom + (kan ? "" : " tp-las") + '" style="--tp-kol:' + kolumner.map(k => k.bredd).join(" ") + ";--tp-kolmin:" + tpKolMin(kolumner) + "px;--tp-tab:" + tabBredd + '">' +
        '<div class="tp-tabell" role="grid" aria-label="Aktiviteter">' +
        '<div class="tp-rad tp-huvud" role="row">' + kolumner.map(k => '<div class="tp-c' + (["kalkTimmar", "plan", "avvik"].indexOf(k.id) >= 0 ? " tp-tal" : "") + '"' + (k.titel ? ' title="' + esc(k.titel) + '"' : "") + ">" + esc(k.namn) + "</div>").join("") + "</div>" +
        radHtml + nyRad + "</div>" +
        '<button type="button" class="tp-tabknapp" data-tptab aria-expanded="' + !tpVy.tabSmal + '" title="' + (tpVy.tabSmal ? "Visa hela tabellen" : "Smalare tabell – mer plats för kalendern") + '" aria-label="' + (tpVy.tabSmal ? "Visa hela tabellen" : "Gör tabellen smalare") + '">' + (tpVy.tabSmal ? TP_PIL_H : TP_PIL_V) + "</button>" +
        '<div class="tp-kalender" aria-label="Kalender">' +
        '<div class="tp-kalinre" style="width:' + bredd + "px;--dw:" + TP_DW + "px;--dpv:" + ax.dpv + '">' +
        lediga.map(x => '<div class="tp-ledig' + (x.skal === "helg" ? " helg" : "") + '" style="left:' + (x.i * TP_DW) + 'px" title="' + esc(dagEtikett(x.d) + " · " + (x.skal === "helg" ? "Ledig" : x.skal)) + '"></div>').join("") +
        tpKalHuvud(ax) +
        rader.map(r => kalRad(r)).join("") + (kan ? kalRad(null) : "") +
        (typeof tpSbPilar === "function" ? tpSbPilar(ax, rader, 36, tpVy.zoom === "vecka" ? 36 : 52) : "") +
        (typeof tpUfAvstamning === "function" ? tpUfAvstamning(ax, rader, 36, tpVy.zoom === "vecka" ? 36 : 52) : "") +
        (idagX >= 0 && idagX <= bredd && !(tpVy.avst && !tpVy.avstDatum) ? '<div class="tp-idag" style="left:' + idagX + 'px" title="Idag"></div>' : "") +
        "</div>" +
        (!rader.length ? '<div class="tp-tomhjalp"><b>Kom igång</b><span>' + (kan ? "Skriv första aktiviteten i raden <i>Ny aktivitet</i>. Klicka sedan i kalendern på samma rad för att lägga ut en period – dra för att välja längd."
            : "Tidplanen är tom. Projektadmin lägger in aktiviteter och perioder.") + "</span></div>" : "") +
        "</div></div>" +
        (typeof tpResursPanel === "function" && rader.length ? tpResursPanel(ax, bredd, tabBredd) : "") +
        '<details class="tp-genvagar"><summary>' + TP_PIL_H + "Kortkommandon</summary><dl>" +
        "<dt><kbd>Enter</kbd></dt><dd>Spara och gå till raden under</dd>" +
        "<dt><kbd>Tab</kbd></dt><dd>Spara och gå åt höger</dd>" +
        "<dt><kbd>Esc</kbd></dt><dd>Avbryt</dd>" +
        "<dt><kbd>Alt</kbd> <kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Flytta raden (eller dra i namnet)</dd>" +
        "<dt><kbd>Alt</kbd> <kbd>Skift</kbd> <kbd>→</kbd> <kbd>←</kbd></dt><dd>Gör till underaktivitet / lyft ut ur gruppen</dd>" +
        "<dt>Pilen vid en grupp</dt><dd>Fäll ihop och visa underaktiviteterna</dd>" +
        "<dt>Kolumnen Klart</dt><dd>Skriv hur många procent som är klart, t.ex. <kbd>60</kbd></dd>" +
        "<dt>Uppföljning</dt><dd>Spara baslinje och visa avstämningslinje</dd>" +
        "<dt>Pricken vid en stapel</dt><dd>Dra till en annan stapel för att skapa ett samband</dd>" +
        "<dt>Klick på en pil</dt><dd>Ändra typ och glapp, eller ta bort sambandet</dd>" +
        "<dt>Till tavlan</dt><dd>Lägg ut perioder som moment på fyraveckorstavlan</dd>" +
        "<dt>Klick på radnumret</dt><dd>Markera raden (<kbd>Skift</kbd> = flera i följd, <kbd>Ctrl</kbd> = en till)</dd>" +
        "<dt><kbd>Skift</kbd> <kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Markera fler rader</dd>" +
        "<dt><kbd>Ctrl</kbd> <kbd>C</kbd> / <kbd>V</kbd></dt><dd>Kopiera och klistra in rader, även från Excel</dd>" +
        "<dt><kbd>Ctrl</kbd> <kbd>Enter</kbd></dt><dd>Infoga en rad ovanför (<kbd>Skift</kbd> = nedanför)</dd>" +
        "<dt><kbd>Ctrl</kbd> <kbd>Delete</kbd></dt><dd>Radera raden eller de markerade raderna</dd>" +
        "<dt>Dra på en rad</dt><dd>Rita en period, ett klick ger en vecka</dd>" +
        "<dt>Dubbelklick på en stapel</dt><dd>Datum, färg och bemanning (även <kbd>Enter</kbd>)</dd>" +
        "<dt><kbd>Skift</kbd>/<kbd>Ctrl</kbd> + klick på staplar</dt><dd>Markera flera staplar och flytta dem tillsammans</dd>" +
        "<dt>Dra i gruppens stapel</dt><dd>Flytta hela gruppen i tiden</dd>" +
        "<dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Flytta markerade staplar en arbetsdag</dd>" +
        "<dt><kbd>Skift</kbd> <kbd>←</kbd> <kbd>→</kbd></dt><dd>Ändra stapelns längd</dd>" +
        "<dt><kbd>Delete</kbd></dt><dd>Ta bort markerade staplar</dd>" +
        "<dt><kbd>Ctrl</kbd> <kbd>Z</kbd></dt><dd>Ångra</dd>" +
        "<dt><kbd>Ctrl</kbd> <kbd>Y</kbd></dt><dd>Gör om</dd>" +
        "</dl></details>";
    tpScrolla();
    if (typeof tpResursKoppla === "function") tpResursKoppla();
    if (fokusId)
        tpFokus(fokusId, fokusFalt || "namn");
    if (fokusStapel) {
        const st = el.querySelector('[data-tpper="' + (window.CSS && CSS.escape ? CSS.escape(fokusStapel) : fokusStapel) + '"]');
        if (st) st.focus({ preventScroll: true });
    }
}

let tpScroll = null;           // kalenderns scrollläge mellan omritningar (null = visa idag)
function tpScrolla() {
    const kal = document.querySelector("#tidplan .tp-kalender");
    if (!kal)
        return;
    if (tpScroll === null) {
        // har man bläddrat till en vecka börjar vyn där, annars en vecka före idag
        const ax = tpAxel(), k = tpVy.fran ? 0 : tpKol(ax, IDAG);
        kal.scrollLeft = Math.max(0, Math.floor(k / ax.dpv - 1) * ax.dpv * TP_DW);
        tpScroll = kal.scrollLeft;
    }
    else
        kal.scrollLeft = tpScroll;
}

/* ---------- redigering i cellerna ---------- */

function tpFokus(id, falt) {
    const rad = document.querySelector('#tidplan [data-tprad="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
    const cell = rad && (rad.querySelector('[data-tpfalt="' + falt + '"]') || rad.querySelector("[data-tpfalt]"));
    if (cell) { cell.focus(); return cell; }
    return null;
}

function tpBorja(cell, forsta) {
    if (!cell || !tpKanAndra())
        return;
    const rad = cell.closest("[data-tprad]"), id = rad.dataset.tprad, falt = cell.dataset.tpfalt;
    const a = id === "ny" ? null : tpHitta(id);
    if (id !== "ny" && !a)
        return;
    if (tpRedigerar)
        tpAvsluta(true);
    if (falt === "klart" && a && tpBarn().has(a.id)) { status("En grupps framdrift räknas fram ur underaktiviteterna"); return; }
    if (falt === "klart" && id === "ny") return;
    const varde = !a ? "" : falt === "kalkTimmar" ? tpTimmarText(a.kalkTimmar) : falt === "klart" ? (typeof a.klart === "number" ? String(a.klart) : "") : (a[falt] || "");
    const inp = document.createElement("input");
    inp.className = "tp-in";
    inp.value = forsta != null ? forsta : varde;
    inp.setAttribute("aria-label", { namn: "Aktivitet", ansvarig: "Ansvarig", kalkTimmar: "Kalkylerade timmar", klart: "Klart i procent" }[falt] || falt);
    if (falt === "kalkTimmar" || falt === "klart")
        inp.inputMode = "decimal";
    cell.classList.add("redigerar");
    cell.dataset.gammal = cell.innerHTML;
    cell.innerHTML = "";
    cell.appendChild(inp);
    inp.focus();
    if (forsta == null)
        inp.select();
    else
        inp.setSelectionRange(inp.value.length, inp.value.length);
    tpRedigerar = { cell, id, falt, input: inp };
}

// Avslutar redigeringen. Med sparaVarde sparas värdet. Returnerar id för raden
// (en ny rad får sitt nya id), eller null om inget sparades.
function tpAvsluta(sparaVarde) {
    const r = tpRedigerar;
    if (!r)
        return null;
    tpRedigerar = null;
    const v = r.input.value;
    r.cell.classList.remove("redigerar");
    r.cell.innerHTML = r.cell.dataset.gammal || "";
    let ut = r.id === "ny" ? null : r.id;
    if (sparaVarde) {
        if (r.id === "ny") {
            const namn = v.trim();
            if (namn) {
                const patch = opTpNyAktivitet(state, { namn });
                if (tpKor(patch, "Ny aktivitet: " + namn))
                    ut = patch.andringar[0].id;
            }
        }
        else {
            const a = tpHitta(r.id);
            if (a) {
                let ny;
                if (r.falt === "klart")
                    ny = tpUfTolkaKlart(v);
                else if (r.falt === "kalkTimmar") {
                    const s = v.trim().replace(",", ".").replace(/\s|h$/gi, "");
                    if (s === "")
                        ny = null;
                    else if (/^\d+(\.\d+)?$/.test(s))
                        ny = +s;
                    else {
                        status("Skriv timmarna som en siffra, t.ex. 120 eller 7,5", true);
                        ny = undefined;
                    }
                }
                else
                    ny = v.trim();
                if (r.falt === "namn" && ny === "" && a.namn)
                    status("Aktiviteten behöver ett namn. Radera raden med × om den ska bort.", true);
                else if (ny !== undefined && ny !== (a[r.falt] === undefined ? (r.falt === "kalkTimmar" || r.falt === "klart" ? null : "") : a[r.falt])) {
                    const falt = {};
                    falt[r.falt] = ny;
                    tpKor(opTpAndraAktivitet(a, falt), "Ändrade " + (a.namn || "aktivitet"));
                }
            }
        }
    }
    if (tpVantar)
        ritaTidplan();
    return ut;
}

// Nästa cell efter Enter (ned) eller Tab (höger), räknat från rad id och fält.
function tpNasta(id, falt, steg) {
    const rader = [...document.querySelectorAll("#tidplan .tp-tabell [data-tprad]")];
    let i = rader.findIndex(r => r.dataset.tprad === id), f = falt;
    if (i < 0)
        return null;
    if (steg === "ner") i++;
    else if (steg === "upp") i--;
    else {
        const j = tpRedig().indexOf(falt) + (steg === "hoger" ? 1 : -1);
        if (j >= tpRedig().length) { i++; f = tpRedig()[0]; }
        else if (j < 0) { i--; f = tpRedig()[tpRedig().length - 1]; }
        else f = tpRedig()[j];
    }
    const rad = rader[i];
    if (!rad)
        return null;
    return rad.querySelector('[data-tpfalt="' + f + '"]') || rad.querySelector('[data-tpfalt="namn"]');
}

function tpRadGor(id, gor) {
    const a = tpHitta(id);
    if (!a || !tpKanAndra())
        return;
    if (gor === "upp" || gor === "ned") {
        if (tpKor(opTpFlyttaAktivitet(state, a, gor === "upp" ? -1 : 1), "Flyttade " + (a.namn || "aktivitet")))
            tpFokus(id, "namn");
    }
    else if (gor === "infoga" || gor === "infogaNedan") {
        const patch = opTpNyAktivitet(state, gor === "infoga" ? { namn: "", fore: id } : { namn: "", efter: id });
        if (tpKor(patch, "Ny rad")) {
            const cell = tpFokus(patch.andringar[0].id, "namn");
            tpBorja(cell);
        }
    }
    else if (gor === "radera" && tpMark.size > 1 && tpMark.has(id))
        tpRaderaMarkerade();
    else if (gor === "radera") {
        const rader = tpRader(), i = rader.findIndex(r => r.a.id === id);
        const nasta = rader[i + 1] ? rader[i + 1].a.id : rader[i - 1] ? rader[i - 1].a.id : "ny";
        if (tpKor(opTpTaBortAktivitet(state, a), "Raderade " + (a.namn || "en rad")))
            tpFokus(nasta, "namn");
    }
}

/* ---------- händelser ---------- */

(function () {
    const yta = document.getElementById("tidplan");
    if (!yta)
        return;
    yta.addEventListener("click", (e) => {
        const gor = e.target.closest("[data-tpgor]");
        if (gor) {
            const rad = gor.closest("[data-tprad]");
            if (rad) tpRadGor(rad.dataset.tprad, gor.dataset.tpgor);
            return;
        }
        const mk = e.target.closest("[data-tpmark]");
        if (mk) return tpMarkGor(mk.dataset.tpmark);
        const ihop = e.target.closest("[data-tpihop]");
        if (ihop) { const r = ihop.closest("[data-tprad]"); if (r) tpVaxlaIhop(r.dataset.tprad); return; }
        const nr = e.target.closest(".tp-tabell .tp-nr");
        if (nr && !e.target.closest("[data-tpfarg]")) {
            const r = nr.closest("[data-tprad]");
            if (r && r.dataset.tprad !== "ny") { tpMarkera(r.dataset.tprad, e.shiftKey ? "intervall" : (e.ctrlKey || e.metaKey) ? "vaxla" : "en"); return; }
        }
        const cell = e.target.closest(".tp-tabell .tp-e");
        if (tpRadDragKlart) { tpRadDragKlart = false; return; }
        if (cell && !cell.classList.contains("redigerar"))
            tpBorja(cell);
    });

    yta.addEventListener("keydown", (e) => {
        // pågående redigering
        if (tpRedigerar && e.target === tpRedigerar.input) {
            const { id, falt } = tpRedigerar;
            if (e.key === "Escape") {
                e.preventDefault(); e.stopPropagation();
                tpAvsluta(false);
                tpFokus(id, falt);
                return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                const steg = e.key === "Enter" ? (e.shiftKey ? "upp" : "ner") : (e.shiftKey ? "vanster" : "hoger");
                const varTom = id === "ny" && !tpRedigerar.input.value.trim();
                const nyttId = tpAvsluta(true);
                if (id === "ny") {
                    if (varTom) { tpFokus("ny", "namn"); return; }
                    // ny rad skapad: Enter → fortsätt skriva på nästa nya rad, Tab → fyll i resten av raden
                    if (steg === "ner" && nyttId) { tpBorja(tpFokus("ny", "namn")); return; }
                    if (nyttId) { tpBorja(tpNasta(nyttId, "namn", steg) || tpFokus(nyttId, "namn")); return; }
                    return;
                }
                const nasta = tpNasta(id, falt, steg);
                if (nasta) {
                    // nästa rad redigeras direkt, så man kan skriva vidare utan extra tangent
                    tpBorja(nasta);
                }
                else
                    tpFokus(id, falt);
            }
            return;
        }
        const rad = e.target.closest && e.target.closest("[data-tprad]");
        const id = rad && rad.dataset.tprad;
        // genvägar för raden
        if (id && id !== "ny") {
            if (e.altKey && e.shiftKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
                e.preventDefault();
                const ids = tpMark.size && tpMark.has(id) ? tpMarkerade().map(r => r.a.id) : [id];
                return tpIndrag(ids, e.key === "ArrowRight" ? 1 : -1);
            }
            if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); return tpRadGor(id, e.key === "ArrowUp" ? "upp" : "ned"); }
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); return tpRadGor(id, e.shiftKey ? "infogaNedan" : "infoga"); }
            if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                e.preventDefault();
                if (!tpMark.size) tpMarkera(id, "en");
                const rader = tpRader(), i = rader.findIndex(r => r.a.id === id), j = i + (e.key === "ArrowUp" ? -1 : 1);
                if (rader[j]) { tpMarkera(rader[j].a.id, "intervall"); tpFokus(rader[j].a.id, (e.target.dataset && e.target.dataset.tpfalt) || "namn"); }
                return;
            }
            if ((e.key === "Delete" || e.key === "Backspace") && tpMark.size > 1 && tpMark.has(id) && !e.ctrlKey) { e.preventDefault(); return tpRaderaMarkerade(); }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && e.target.closest(".tp-tabell")) {
                e.preventDefault(); tpRader().forEach(r => tpMark.add(r.a.id)); tpMarkAnkare = id; return ritaTidplan();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); return tpRadGor(id, "radera"); }
        }
        if (e.key === "Escape" && tpMark.size && !tpRedigerar) { tpMark.clear(); ritaTidplan(); if (id) tpFokus(id, "namn"); return; }
        if (id === "ny" && (e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            const sista = tpRader().pop();
            return sista ? tpRadGor(sista.a.id, "infogaNedan") : tpBorja(tpFokus("ny", "namn"));
        }
        // markerad cell: skriv för att ersätta, Enter/F2 redigerar, pilar och Tab flyttar
        const cell = e.target.closest && e.target.closest(".tp-tabell .tp-e");
        if (!cell)
            return;
        const falt = cell.dataset.tpfalt;
        if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); return tpBorja(cell); }
        const pil = { ArrowDown: "ner", ArrowUp: "upp", ArrowRight: "hoger", ArrowLeft: "vanster" }[e.key];
        if (pil || e.key === "Tab") {
            e.preventDefault();
            const n = tpNasta(id, falt, pil || (e.shiftKey ? "vanster" : "hoger"));
            if (n) n.focus();
            return;
        }
        if (e.key === "Delete" && id !== "ny" && falt !== "namn") {
            e.preventDefault();
            const a = tpHitta(id), f = {};
            if (falt === "klart" && a && tpBarn().has(a.id)) return;
            f[falt] = falt === "kalkTimmar" || falt === "klart" ? null : "";
            if (a) tpKor(opTpAndraAktivitet(a, f), "Tömde " + falt);
            return;
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); tpBorja(cell, e.key); }
    });

    // klick utanför sparar
    yta.addEventListener("focusout", (e) => {
        if (tpRedigerar && e.target === tpRedigerar.input)
            setTimeout(() => { if (tpRedigerar && document.activeElement !== tpRedigerar.input) tpAvsluta(true); }, 0);
    });
})();

// Ritas om när data ändras (synk, ångra) – men inte mitt i en redigering.
const ursRitaTidplan = rita;
rita = function () {
    const r = ursRitaTidplan.apply(this, arguments);
    try { if (tidplanOppen()) ritaTidplan(); } catch (e) { }
    return r;
};

/* ---------- kalendern: rita, flytta och dra i staplar ---------- */

function tpPeriodAv(nyckel) {
    const [aid, qid] = String(nyckel || "").split("|");
    const a = tpHitta(aid), q = a && (a.perioder || []).find(x => x.id === qid);
    return q ? { a, q } : null;
}


let tpDrag = null;

(function () {
    const yta = document.getElementById("tidplan");
    if (!yta)
        return;

    yta.addEventListener("click", (e) => {
        // tabellens bredd: smal (20 %) eller bred (70 %); ändras på plats så att övergången syns
        const tabk = e.target.closest("[data-tptab]");
        if (tabk) {
            tpVy.tabSmal = !tpVy.tabSmal;
            tpVySpara();
            const v = tpVy.tabSmal ? "20%" : "70%";
            document.querySelectorAll("#tidplan .tp-yta, #tidplan .tp-respanel").forEach(el => el.style.setProperty("--tp-tab", v));
            yta.classList.toggle("tp-tabsmal", tpVy.tabSmal);
            tabk.innerHTML = tpVy.tabSmal ? TP_PIL_H : TP_PIL_V;
            tabk.setAttribute("aria-expanded", String(!tpVy.tabSmal));
            tabk.title = tpVy.tabSmal ? "Visa hela tabellen" : "Smalare tabell – mer plats för kalendern";
            tabk.setAttribute("aria-label", tpVy.tabSmal ? "Visa hela tabellen" : "Gör tabellen smalare");
            return;
        }
        const gor = e.target.closest("[data-tpgor]");
        if (gor) {
            if (gor.dataset.tpgor === "angra") tpAngra();
            else if (gor.dataset.tpgor === "gorom") tpGorOm();
            else if (gor.dataset.tpgor === "kalender") tpKalenderDialog();
            else if (gor.dataset.tpgor === "skrivut" && typeof tpUtskriftDialog === "function") tpUtskriftDialog();
            else if (gor.dataset.tpgor === "helger") { tpVy.helger = !tpVy.helger; tpVySpara(); ritaTidplan(); }
            else if (gor.dataset.tpgor === "kolumner") tpKolumnVal(gor);
            else if (gor.dataset.tpgor === "uppfoljning" && typeof tpUfMeny === "function") tpUfMeny(gor);
            else if (gor.dataset.tpgor === "samband" && typeof tpSbDialog === "function") tpSbDialog();
            else if (gor.dataset.tpgor === "tavla" && typeof tpTvDialog === "function") tpTvDialog();
            return;
        }
        const zoom = e.target.closest("[data-tpzoom]");
        if (zoom) {
            // behåll datumet mitt i bild när skalan byts
            const kal = yta.querySelector(".tp-kalender"), ax0 = tpAxel();
            const mitt = kal ? tpDagAvKol(ax0, Math.floor((kal.scrollLeft + kal.clientWidth / 2) / TP_DW)) : null;
            tpVy.zoom = zoom.dataset.tpzoom; tpVySpara();
            TP_DW = TP_ZOOM[tpVy.zoom].dw;
            tpScroll = null;
            ritaTidplan();
            const k2 = yta.querySelector(".tp-kalender");
            if (k2 && mitt) k2.scrollLeft = Math.max(0, tpKol(tpAxel(), mitt) * TP_DW - k2.clientWidth / 2);
            return;
        }
        const nav = e.target.closest("[data-tpnav]");
        if (!nav)
            return;
        const iMan = d2iso(mandag(iso2d(IDAG)));
        if (nav.dataset.tpnav === "idag") { tpVy.fran = null; tpScroll = null; }
        else {
            const kal = yta.querySelector(".tp-kalender");
            const ax0 = tpAxel(), syns = ax0.dagar[Math.round((kal ? kal.scrollLeft : 0) / TP_DW / ax0.dpv) * ax0.dpv] || iMan;
            tpVy.fran = plus(syns, +nav.dataset.tpnav * 7);
            tpScroll = 0;
        }
        ritaTidplan();
    });

    // Uppdaterar resurspanelen medan man drar (perioderna i "andrade" med nya datum).
    const live = (andrade) => { if (typeof tpResursLive === "function") tpResursLive(andrade); };

    // musklick ger inte webbläsarens fokus-scroll; stapeln fokuseras själv utan att vyn flyttas
    yta.addEventListener("mousedown", (e) => { if (e.target.closest(".tp-stapel, [data-tpgrupp]")) e.preventDefault(); });
    yta.addEventListener("pointerdown", (e) => {
        if (e.button !== 0)
            return;
        if (!tpKanAndra())
            return;
        const spar = e.target.closest(".tp-kalrad");
        if (!spar || spar.dataset.tpspar === "ny")
            return;
        if (tpRedigerar)
            tpAvsluta(true);
        const inre = spar.closest(".tp-kalinre"), rect = inre.getBoundingClientRect();
        const stapel = e.target.closest(".tp-stapel"), summa = e.target.closest("[data-tpgrupp]");
        const ax = tpAxel();
        if (summa && !stapel) {
            // flytta hela gruppen: alla perioder i gruppen och dess underaktiviteter
            const g = tpHitta(summa.dataset.tpgrupp);
            if (!g) return;
            const sp = tpSpann(tpKal(), tpBarn(), g);
            const lista = [];
            [g].concat(tpAllaUnder(tpBarn(), g.id)).forEach(x => (x.perioder || []).forEach(q => lista.push({ a: x, q })));
            const els = [summa].concat(lista.map(x => yta.querySelector('[data-tpper="' + (window.CSS && CSS.escape ? CSS.escape(x.a.id + "|" + x.q.id) : x.a.id + "|" + x.q.id) + '"]')).filter(Boolean))
                .concat([...yta.querySelectorAll("[data-tpgrupp]")].filter(el => tpAllaUnder(tpBarn(), g.id).some(x => x.id === el.dataset.tpgrupp)));
            tpDrag = { typ: "grupp", g, lista, els: els.map(el => ({ el, left0: parseFloat(el.style.left) })), start: sp.fran, k0: tpKol(ax, sp.fran), ax, x0: e.clientX, dd: 0, flyttat: false, id: e.pointerId };
            summa.setPointerCapture(e.pointerId);
            e.preventDefault();
            return;
        }
        if (stapel) {
            const pq = tpPeriodAv(stapel.dataset.tpper);
            if (!pq)
                return;
            const nyckel = stapel.dataset.tpper;
            // Skift/Ctrl + klick: lägg till eller ta bort stapeln ur markeringen
            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                if (tpValdPeriod && !tpValdaStaplar.size) tpValdaStaplar.add(tpValdPeriod);
                if (tpValdaStaplar.has(nyckel)) tpValdaStaplar.delete(nyckel); else tpValdaStaplar.add(nyckel);
                tpValdPeriod = tpValdaStaplar.has(nyckel) ? nyckel : ([...tpValdaStaplar].pop() || null);
                ritaTidplan();
                tpFokusStapel();
                e.preventDefault();
                return;
            }
            const hand = e.target.closest("[data-tphand]");
            if (!hand && tpValdaStaplar.size > 1 && tpValdaStaplar.has(nyckel)) {
                // flytta alla markerade staplar lika många kolumner
                const lista = [...tpValdaStaplar].map(tpPeriodAv).filter(Boolean);
                const els = lista.map(x => yta.querySelector('[data-tpper="' + (window.CSS && CSS.escape ? CSS.escape(x.a.id + "|" + x.q.id) : x.a.id + "|" + x.q.id) + '"]')).filter(Boolean);
                tpDrag = { typ: "flera", el: stapel, nyckel, lista, els: els.map(el => ({ el, left0: parseFloat(el.style.left) })), ax, x0: e.clientX, dd: 0, flyttat: false, id: e.pointerId };
                stapel.setPointerCapture(e.pointerId);
                e.preventDefault();
                return;
            }
            const st0 = tpStart(pq.q), sl0 = tpSlut(pq.q);
            tpDrag = { typ: hand ? hand.dataset.tphand : "flytta", el: stapel, nyckel, a: pq.a, q: pq.q, ax,
                start: st0, slut: sl0, k0: tpKol(ax, st0), k1: tpKol(ax, sl0),
                x0: e.clientX, dd: 0, flyttat: false, id: e.pointerId };
            stapel.setPointerCapture(e.pointerId);
        }
        else {
            // rita en ny period på raden
            const kol = Math.max(0, Math.min(ax.dagar.length - 1, Math.floor((e.clientX - rect.left) / TP_DW)));
            const ghost = document.createElement("div");
            ghost.className = "tp-stapel tp-ghost";
            ghost.style.left = kol * TP_DW + "px";
            ghost.style.width = TP_DW + "px";
            spar.appendChild(ghost);
            tpDrag = { typ: "ny", el: ghost, aid: spar.dataset.tpspar, kol0: kol, kol1: kol, ax, rect, flyttat: false, id: e.pointerId };
            spar.setPointerCapture(e.pointerId);
        }
        e.preventDefault();
    });

    yta.addEventListener("pointermove", (e) => {
        const d = tpDrag;
        if (!d || e.pointerId !== d.id)
            return;
        if (d.typ === "ny") {
            const kol = Math.max(0, Math.min(d.ax.dagar.length - 1, Math.floor((e.clientX - d.rect.left) / TP_DW)));
            if (kol !== d.kol0) d.flyttat = true;
            d.kol1 = kol;
            const a = Math.min(d.kol0, kol), b = Math.max(d.kol0, kol);
            d.el.style.left = a * TP_DW + "px";
            d.el.style.width = (b - a + 1) * TP_DW + "px";
            if (d.flyttat) {
                const kal = tpKal(), st = kal.narmasteArbetsdag(tpDagAvKol(d.ax, a), 1);
                d.el.textContent = Math.max(1, kal.arbetsdagar(st, tpDagAvKol(d.ax, b))) + " d";
            }
            return;
        }
        const dx = e.clientX - d.x0;
        // skydd mot oavsiktlig flytt: under 4 px räknas som ett klick
        if (!d.flyttat && Math.abs(dx) < 4)
            return;
        d.flyttat = true;
        if (d.el) d.el.classList.add("drar");
        document.body.classList.add("tp-drar");
        const dd = Math.round(dx / TP_DW), kal = tpKal();
        if (d.typ === "grupp" || d.typ === "flera") {
            if (dd === d.dd) return;
            d.dd = dd;
            d.els.forEach(x => { x.el.style.left = x.left0 + dd * TP_DW + "px"; x.el.classList.add("drar"); });
            live(tpFlyttLista(d, kal));
            return;
        }
        let n = d.q.arbDagar, ny = null;
        if (d.typ === "flytta") {
            d.dd = dd;
            d.el.style.left = (d.k0 + dd) * TP_DW + "px";
            ny = { start: kal.narmasteArbetsdag(tpDagAvKol(d.ax, d.k0 + dd), 1), arbDagar: n };
        }
        else if (d.typ === "start") {
            d.dd = Math.min(dd, d.k1 - d.k0);   // minst en dag kvar
            d.el.style.left = (d.k0 + d.dd) * TP_DW + "px";
            d.el.style.width = (d.k1 - d.k0 - d.dd + 1) * TP_DW + "px";
            const st = kal.narmasteArbetsdag(tpDagAvKol(d.ax, d.k0 + d.dd), 1);
            n = Math.max(1, kal.arbetsdagar(st, d.slut));
            ny = { start: st, arbDagar: n };
        }
        else {
            d.dd = Math.max(dd, d.k0 - d.k1);
            d.el.style.width = (d.k1 + d.dd - d.k0 + 1) * TP_DW + "px";
            n = Math.max(1, kal.arbetsdagar(d.start, tpDagAvKol(d.ax, d.k1 + d.dd)));
            ny = { start: d.q.start, arbDagar: n };
        }
        // antalet arbetsdagar visas medan man drar (lediga dagar räknas inte)
        const lbl = d.el.querySelector(".tp-dgr");
        if (lbl) lbl.textContent = n + " d";
        d.el.title = n + " arbetsdagar";
        live([{ a: d.a, q: Object.assign({}, d.q, ny) }]);
    });

    const slut = (e) => {
        const d = tpDrag;
        if (!d || e.pointerId !== d.id)
            return;
        tpDrag = null;
        document.body.classList.remove("tp-drar");
        if (d.typ === "ny") {
            const a = tpHitta(d.aid);
            const k0 = Math.min(d.kol0, d.kol1), k1 = Math.max(d.kol0, d.kol1), kal = tpKal();
            // perioden börjar på första arbetsdagen; ett klick utan att dra ger en arbetsvecka (5 arbetsdagar)
            const start = kal.narmasteArbetsdag(tpDagAvKol(d.ax, k0), 1);
            const n = d.flyttat ? Math.max(1, kal.arbetsdagar(start, tpDagAvKol(d.ax, k1))) : 5;
            if (a && e.type === "pointerup") {
                tpValdaStaplar.clear();
                const patch = opTpNyPeriodPa(a, start, n);
                if (patch.ok) tpValdPeriod = a.id + "|" + patch.period.id;
                if (!tpKor(patch, "Ny period på " + (a.namn || "aktivitet")))
                    d.el.remove();
                else
                    tpFokusStapel();
            }
            else
                d.el.remove();
            return;
        }
        if (d.typ === "grupp" || d.typ === "flera") {
            if (!d.flyttat || !d.dd || e.type !== "pointerup") { ritaTidplan(); if (d.typ === "flera") tpFokusStapel(); return; }
            const nya = tpFlyttLista(d, tpKal());
            tpKorSerie(d.typ === "grupp" ? "Flyttade gruppen " + (d.g.namn || "") : "Flyttade " + nya.length + " staplar", (kor) => {
                nya.forEach(x => { const a = tpHitta(x.a.id); if (a) kor(opTpAndraPeriod(a, x.q.id, { start: x.q.start })); });
            });
            if (d.typ === "flera") tpFokusStapel();
            return;
        }
        d.el.classList.remove("drar");
        // ett vanligt klick på en stapel avmarkerar de andra
        if (!d.flyttat) tpValdaStaplar.clear();
        tpValdPeriod = d.nyckel;
        if (!d.flyttat || !d.dd || e.type !== "pointerup") {
            // två klick på samma stapel inom en kort stund = dubbelklick (stapeln ritas om mellan klicken)
            const nu = Date.now(), dubbel = e.type === "pointerup" && !d.flyttat && tpSenasteKlick.nyckel === d.nyckel && nu - tpSenasteKlick.tid < 450;
            tpSenasteKlick = dubbel ? { nyckel: null, tid: 0 } : { nyckel: d.nyckel, tid: nu };
            ritaTidplan();
            tpFokusStapel();
            if (dubbel && typeof tpPeriodDialog === "function") { const pq = tpPeriodAv(d.nyckel); if (pq) tpPeriodDialog(pq.a, pq.q); }
            return;
        }
        const q = d.q, kal = tpKal();
        let falt;
        if (d.typ === "flytta")
            // flytten behåller antalet arbetsdagar (regel 4); en start på en ledig dag läggs på nästa arbetsdag
            falt = { start: kal.narmasteArbetsdag(tpDagAvKol(d.ax, d.k0 + d.dd), 1) };
        else if (d.typ === "start") {
            const ny = kal.narmasteArbetsdag(tpDagAvKol(d.ax, d.k0 + d.dd), 1);
            falt = { start: ny, arbDagar: Math.max(1, kal.arbetsdagar(ny, d.slut)) };
        }
        else
            falt = { arbDagar: Math.max(1, kal.arbetsdagar(d.start, tpDagAvKol(d.ax, d.k1 + d.dd))) };
        tpKor(opTpAndraPeriod(d.a, q.id, falt), (d.typ === "flytta" ? "Flyttade " : "Ändrade ") + (d.a.namn || "period"));
        tpLangdNotis(q, falt.arbDagar);
        tpFokusStapel();
    };
    yta.addEventListener("pointerup", slut);
    yta.addEventListener("pointercancel", slut);

    // dubbelklick på en stapel: datum, färg och bemanning

    // markerade staplar: pilar flyttar, Skift + pilar ändrar längden, Delete tar bort, Enter öppnar
    yta.addEventListener("keydown", (e) => {
        const st = e.target.closest && e.target.closest(".tp-stapel");
        if (!st || !tpKanAndra())
            return;
        const pq = tpPeriodAv(st.dataset.tpper);
        if (!pq)
            return;
        tpValdPeriod = st.dataset.tpper;
        const { a, q } = pq;
        const flera = tpValdaStaplar.size > 1 && tpValdaStaplar.has(st.dataset.tpper) ? [...tpValdaStaplar].map(tpPeriodAv).filter(Boolean) : null;
        if (e.key === "Enter" && typeof tpPeriodDialog === "function") { e.preventDefault(); return tpPeriodDialog(a, q); }
        if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            tpValdPeriod = null;
            if (flera) {
                tpKorSerie("Tog bort " + flera.length + " staplar", (kor) => flera.forEach(x => { const y = tpHitta(x.a.id); if (y) kor(opTpTaBortPeriod(y, x.q.id)); }));
                tpValdaStaplar.clear();
            }
            else
                tpKor(opTpTaBortPeriod(a, q.id), "Tog bort en period på " + (a.namn || "aktivitet"));
            tpFokus(a.id, "namn");
            return;
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            const n = e.key === "ArrowRight" ? 1 : -1, kal = tpKal();
            if (e.shiftKey) {
                if (q.arbDagar + n >= 1) {
                    tpKor(opTpAndraPeriod(a, q.id, { arbDagar: q.arbDagar + n }), "Ändrade " + (a.namn || "period"));
                    tpLangdNotis(q, q.arbDagar + n);
                }
            }
            else if (flera)
                tpKorSerie("Flyttade " + flera.length + " staplar", (kor) => flera.forEach(x => { const y = tpHitta(x.a.id); if (y) kor(opTpAndraPeriod(y, x.q.id, { start: kal.skifta(tpStart(x.q), n) })); }));
            else
                tpKor(opTpAndraPeriod(a, q.id, { start: kal.skifta(tpStart(q), n) }), "Flyttade " + (a.namn || "period"));
            tpFokusStapel();
        }
        if (e.key === "Escape") { tpValdPeriod = null; tpValdaStaplar.clear(); st.blur(); ritaTidplan(); }
    });
    yta.addEventListener("focusin", (e) => {
        const st = e.target.closest && e.target.closest(".tp-stapel");
        if (st && tpValdPeriod !== st.dataset.tpper) {
            yta.querySelectorAll(".tp-stapel.vald").forEach(x => x.classList.remove("vald"));
            st.classList.add("vald");
            tpValdPeriod = st.dataset.tpper;
        }
    });
})();

// Nya startdatum när flera staplar (eller en grupp) dras d.dd kolumner. Varje stapel flyttas lika
// många kolumner och landar på en arbetsdag; antalet arbetsdagar ändras inte.
function tpFlyttLista(d, kal) {
    if (d.typ === "grupp") {
        // gruppen: alla perioder flyttas lika många arbetsdagar som gruppens start flyttas
        const nyStart = kal.narmasteArbetsdag(tpDagAvKol(d.ax, d.k0 + d.dd), 1);
        const steg = nyStart >= d.start ? kal.arbetsdagar(plus(d.start, 1), nyStart) : -kal.arbetsdagar(nyStart, plus(d.start, -1));
        return d.lista.map(x => ({ a: x.a, q: Object.assign({}, x.q, { start: kal.skifta(tpStart(x.q), steg) }) }));
    }
    return d.lista.map(x => ({ a: x.a, q: Object.assign({}, x.q, { start: kal.narmasteArbetsdag(tpDagAvKol(d.ax, tpKol(d.ax, tpStart(x.q)) + d.dd), 1) }) }));
}
// Säg till när en ändrad längd påverkar varierande bemanning (inga tysta antaganden, 5.4).
function tpLangdNotis(q, nyLangd) {
    if (!(nyLangd > 0) || nyLangd === q.arbDagar || !(q.bemanning || []).some(tpVarierande)) return;
    if (nyLangd > q.arbDagar) {
        const sista = q.bemanning.filter(tpVarierande).map(b => b.segment.slice().sort((x, y) => x.franDag - y.franDag).pop().antal);
        status("Perioden blev " + (nyLangd - q.arbDagar) + " arbetsdagar längre. De nya dagarna har samma bemanning som sista delen (" + sista.join(", ") + " pers). Dubbelklicka för att ändra.");
    }
    else if (tpSegmentUtanfor(q.bemanning, nyLangd))
        status("Perioden blev kortare. En del av bemanningen ligger nu utanför perioden och räknas inte. Dubbelklicka för att se den.", true);
}

function tpFokusStapel() {
    if (!tpValdPeriod)
        return;
    const st = document.querySelector('#tidplan [data-tpper="' + (window.CSS && CSS.escape ? CSS.escape(tpValdPeriod) : tpValdPeriod) + '"]');
    if (st) st.focus({ preventScroll: true });
}

/* ---------- dra namnet för att flytta raden upp eller ned ---------- */

let tpRadDrag = null, tpRadDragKlart = false;

(function () {
    const yta = document.getElementById("tidplan");
    if (!yta)
        return;
    yta.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || !tpKanAndra())
            return;
        const cell = e.target.closest('.tp-tabell .tp-e[data-tpfalt="namn"]');
        const rad = cell && cell.closest("[data-tprad]");
        if (!rad || rad.dataset.tprad === "ny" || cell.classList.contains("redigerar"))
            return;
        tpRadDrag = { id: rad.dataset.tprad, rad, y0: e.clientY, aktiv: false, pid: e.pointerId, mal: null };
    });
    yta.addEventListener("pointermove", (e) => {
        const d = tpRadDrag;
        if (!d || e.pointerId !== d.pid)
            return;
        if (!d.aktiv) {
            if (Math.abs(e.clientY - d.y0) < 6)
                return;
            d.aktiv = true;
            if (tpRedigerar) tpAvsluta(true);
            d.rad.classList.add("tp-lyft");
            document.body.classList.add("tp-raddrar");
            d.linje = document.createElement("div");
            d.linje.className = "tp-droplinje";
            d.rad.parentElement.appendChild(d.linje);
            try { d.rad.setPointerCapture(e.pointerId); } catch (x) { }
        }
        e.preventDefault();
        // rad under pekaren (bara riktiga rader, inte huvud eller ny rad)
        const rader = [...yta.querySelectorAll(".tp-tabell [data-tprad]:not([data-tprad=ny])")];
        const tab = d.rad.parentElement.getBoundingClientRect();
        let i = rader.length;
        for (let k = 0; k < rader.length; k++) {
            const q = rader[k].getBoundingClientRect();
            if (e.clientY < q.top + q.height / 2) { i = k; break; }
        }
        d.mal = i;
        const ref = rader[i] ? rader[i].getBoundingClientRect().top : rader[rader.length - 1].getBoundingClientRect().bottom;
        d.linje.style.top = (ref - tab.top - 1) + "px";
    });
    const slut = (e) => {
        const d = tpRadDrag;
        if (!d || e.pointerId !== d.pid)
            return;
        tpRadDrag = null;
        if (!d.aktiv)
            return;
        tpRadDragKlart = true;
        setTimeout(() => { tpRadDragKlart = false; }, 0);
        d.rad.classList.remove("tp-lyft");
        document.body.classList.remove("tp-raddrar");
        if (d.linje) d.linje.remove();
        if (e.type !== "pointerup" || d.mal === null)
            return;
        const a = tpHitta(d.id);
        const rader = tpRader().map(r => r.a);
        // rader ovanför/under målet, utan den som flyttas
        const utan = rader.filter(x => x !== a);
        const fore = rader.slice(0, d.mal).filter(x => x !== a).pop() || null;
        const efter = utan[utan.indexOf(fore) + 1] || null;
        if (!a || (rader[d.mal] === a) || (rader[d.mal - 1] === a))
            return;
        if (tpKor(opTpFlyttaMellan(state, a, fore, efter), "Flyttade " + (a.namn || "aktivitet")))
            tpFokus(a.id, "namn");
    };
    yta.addEventListener("pointerup", slut);
    yta.addEventListener("pointercancel", slut);
})();

/* ---------- färg per aktivitet: fyra att välja mellan ---------- */

function tpStangFargval() {
    const v = document.getElementById("tpFargval");
    if (v) v.remove();
}

function tpVisaFargval(knapp) {
    tpStangFargval();
    const rad = knapp.closest("[data-tprad]"), a = rad && tpHitta(rad.dataset.tprad);
    if (!a || !tpKanAndra())
        return;
    const nu = tpFarg(a), q = knapp.getBoundingClientRect();
    const v = document.createElement("div");
    v.id = "tpFargval";
    v.className = "tp-fargval";
    v.setAttribute("role", "radiogroup");
    v.setAttribute("aria-label", "Färg för " + (a.namn || "aktiviteten"));
    v.innerHTML = TP_FARGER.map(([k, n]) => '<button type="button" role="radio" aria-checked="' + (k === nu) + '" class="tpc-' + k + (k === nu ? " vald" : "") +
        '" data-tpvalj="' + k + '" title="' + n + '" aria-label="' + n + '"></button>').join("");
    v.style.left = Math.round(q.left + window.scrollX - 6) + "px";
    v.style.top = Math.round(q.bottom + window.scrollY + 6) + "px";
    v.dataset.aid = a.id;
    document.body.appendChild(v);
    (v.querySelector(".vald") || v.querySelector("button")).focus();
}

document.addEventListener("click", (e) => {
    const knapp = e.target.closest && e.target.closest("#tidplan [data-tpfarg]");
    if (knapp) { e.stopPropagation(); return tpVisaFargval(knapp); }
    const val = e.target.closest && e.target.closest("#tpFargval [data-tpvalj]");
    if (val) {
        const v = document.getElementById("tpFargval"), a = tpHitta(v.dataset.aid);
        tpStangFargval();
        if (a) {
            const ny = val.dataset.tpvalj === "gron" ? "" : val.dataset.tpvalj;
            tpKor(opTpAndraAktivitet(a, { farg: ny }), "Bytte färg på " + (a.namn || "aktivitet"));
            tpFokus(a.id, "namn");
        }
        return;
    }
    if (!(e.target.closest && e.target.closest("#tpFargval")))
        tpStangFargval();
}, true);

document.addEventListener("keydown", (e) => {
    const v = document.getElementById("tpFargval");
    if (!v)
        return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); const id = v.dataset.aid; tpStangFargval(); tpFokus(id, "namn"); return; }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const b = [...v.querySelectorAll("button")], i = b.indexOf(document.activeElement);
        e.preventDefault();
        b[(i + (e.key === "ArrowRight" ? 1 : b.length - 1)) % b.length].focus();
    }
}, true);
window.addEventListener("scroll", tpStangFargval, true);

// Ctrl+Z / Ctrl+Y (och Ctrl+Skift+Z) i tidplanen. I ett textfält ångrar webbläsaren texten som vanligt.
document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || !tidplanOppen() || !tpKanAndra()) return;
    if (document.getElementById("overlay") && !document.getElementById("overlay").classList.contains("dold") && document.querySelector("#overlay .modal")) return;
    const t = e.target, txt = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if (txt || tpRedigerar || tpDrag) return;
    const k = e.key.toLowerCase();
    if (k === "z" && !e.shiftKey) { e.preventDefault(); tpAngra(); }
    else if (k === "y" || (k === "z" && e.shiftKey)) { e.preventDefault(); tpGorOm(); }
});

// Ctrl+P i tidplanen öppnar tidplanens utskrift i stället för en utskrift av hela sidan
document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "p" || !tidplanOppen()) return;
    if (document.querySelector("#overlay .modal") && !document.getElementById("overlay").classList.contains("dold")) return;
    if (typeof tpUtskriftDialog !== "function") return;
    e.preventDefault();
    tpUtskriftDialog();
});
