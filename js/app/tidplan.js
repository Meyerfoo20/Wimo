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

const TP_KOLUMNER = [
    { id: "nr", namn: "#", redig: false },
    { id: "namn", namn: "Aktivitet", redig: true },
    { id: "ansvarig", namn: "Ansvarig", redig: true },
    { id: "kalkTimmar", namn: "Timmar", redig: true },
    { id: "perioder", namn: "Perioder", redig: false }
];
const TP_REDIG = TP_KOLUMNER.filter(k => k.redig).map(k => k.id);
const TP_VECKOR = 16;          // minsta antal veckor i kalendern
const TP_DW = 20;              // bredd per arbetsdag i kalendern (px)
const TP_PIL_V = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5"/></svg>';
const TP_PIL_H = '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5"/></svg>';
const tpVy = { fran: null };   // kalenderns första måndag (null = veckan före idag)
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
    try { return typeof window.p4KanProjekt !== "function" || window.p4KanProjekt(state.id); } catch (e) { return true; }
}

// Raderna i visningsordning: varje förälder följs av sina underaktiviteter.
function tpRader() {
    const ut = [], p = state;
    const lagg = (foralder, niva) => tpSyskon(p, foralder).forEach(a => { ut.push({ a, niva }); lagg(a.id, niva + 1); });
    lagg(null, 0);
    // aktiviteter vars förälder saknas visas sist, så de inte försvinner
    tpAktiviteter(p).forEach(a => { if (!ut.some(r => r.a === a)) ut.push({ a, niva: 0 }); });
    return ut;
}

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
    // varje ändring i tidplanen blir ett eget ångra-steg (inte ihopslaget med tidigare)
    if (angraTxt)
        try { angraForeAvbryt(); angraForeKlar(angraTxt, patch.fore, T(), state); } catch (e) { }
    spara();
    ritaTidplan();
    return true;
}

/* ---------- ritning ---------- */

function tpTimmarText(v) { return typeof v === "number" ? String(v).replace(".", ",") : ""; }

function tpSlut(q) { return skiftaArbetsdagar(q.start, q.arbDagar - 1); }

function tpPerioderText(a) {
    const l = (a.perioder || []).slice().sort((x, y) => x.start < y.start ? -1 : 1);
    if (!l.length)
        return "";
    const fran = l[0].start, till = l.map(tpSlut).sort().pop();
    return (l.length > 1 ? l.length + " st · " : "") + kortDatum(fran) + "–" + kortDatum(till);
}

// Färgerna en aktivitet kan få (fältet farg): tavlans posttypsfärger utom mötets. Tomt = grön.
const TP_FARGER = [["gron", "Grön"], ["bla", "Blå"], ["orange", "Orange"], ["lila", "Lila"], ["rod", "Röd"], ["brun", "Brun"]];
const tpFarg = (a) => TP_FARGER.some(f => f[0] === a.farg) ? a.farg : "gron";

function tpCell(a, k, nr) {
    if (k.id === "nr") {
        const f = tpFarg(a), namn = TP_FARGER.find(x => x[0] === f)[1];
        return '<div class="tp-c tp-nr"><button type="button" class="tp-farg" data-tpfarg title="Färg: ' + namn + ' (klicka för att byta)" aria-label="Färg: ' + namn + '"></button>' + nr + "</div>";
    }
    if (k.id === "perioder")
        return '<div class="tp-c tp-per">' + esc(tpPerioderText(a)) + "</div>";
    const v = k.id === "kalkTimmar" ? tpTimmarText(a.kalkTimmar) : (a[k.id] || "");
    return '<div class="tp-c tp-e" tabindex="-1" data-tpfalt="' + k.id + '">' + esc(v) + "</div>";
}

/* ---------- kalenderns tidsaxel: bara arbetsdagar (mån–fre) ---------- */

function tpAxel() {
    const iMan = d2iso(mandag(iso2d(IDAG)));
    const fran = tpVy.fran || plus(iMan, -7);
    let sista = plus(fran, TP_VECKOR * 7 - 1);
    tpAktiviteter(state).forEach(a => (a.perioder || []).forEach(q => {
        const s = plus(tpSlut(q), 14);
        if (s > sista) sista = s;
    }));
    const veckor = Math.max(TP_VECKOR, Math.ceil((iso2d(sista) - iso2d(fran)) / 864e5 / 7));
    const dagar = [];
    for (let w = 0; w < veckor; w++)
        for (let d = 0; d < 5; d++)
            dagar.push(plus(fran, w * 7 + d));
    const index = {};
    dagar.forEach((d, i) => { index[d] = i; });
    return { fran, dagar, index, veckor };
}

// Kolumn för ett datum (helg räknas som närmast föregående fredag), kan vara utanför axeln.
function tpKol(ax, iso) {
    if (ax.index[iso] !== undefined)
        return ax.index[iso];
    return arbetsdagarMellan(ax.fran, iso);
}

function tpStaplar(a, ax) {
    return (a.perioder || []).map(q => {
        const k0 = tpKol(ax, q.start), w = q.arbDagar * TP_DW;
        const vald = tpValdPeriod === a.id + "|" + q.id;
        const titel = (a.namn || "Aktivitet") + "\n" + dagEtikett(q.start) + " – " + dagEtikett(tpSlut(q)) + "\n" + q.arbDagar + " arbetsdagar";
        return '<button type="button" class="tp-stapel' + (vald ? " vald" : "") + '" data-tpper="' + esc(a.id + "|" + q.id) + '"' +
            ' style="left:' + (k0 * TP_DW) + "px;width:" + w + 'px" title="' + esc(titel) + '" aria-label="' + esc(titel.replace(/\n/g, ", ")) + '">' +
            '<span class="tp-hand v" data-tphand="start" aria-hidden="true"></span>' +
            (w >= 44 ? '<span class="tp-dgr">' + q.arbDagar + " d</span>" : "") +
            '<span class="tp-hand h" data-tphand="slut" aria-hidden="true"></span></button>';
    }).join("");
}

function ritaTidplan() {
    const el = document.getElementById("tidplan");
    if (!el || !state)
        return;
    if (tpRedigerar || tpDrag) { tpVantar = true; return; }
    tpVantar = false;
    const kal0 = el.querySelector(".tp-kalender");
    if (kal0) tpScroll = kal0.scrollLeft;
    const fokusStapel = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.tpper;
    const fokus = document.activeElement && document.activeElement.closest && document.activeElement.closest("#tidplan [data-tprad]");
    const fokusId = fokus && fokus.dataset.tprad, fokusFalt = document.activeElement && document.activeElement.dataset && document.activeElement.dataset.tpfalt;
    const kan = tpKanAndra(), rader = tpRader(), ax = tpAxel();
    // idag på helg: linjen läggs mellan fredag och måndag
    const bredd = ax.dagar.length * TP_DW, iHelg = ax.index[IDAG] === undefined;
    const idagX = iHelg ? (tpKol(ax, IDAG) + 1) * TP_DW : ax.index[IDAG] * TP_DW + TP_DW / 2;
    const radHtml = rader.map((r, i) =>
        '<div class="tp-rad tpc-' + tpFarg(r.a) + (r.niva ? " tp-under" : "") + '" data-tprad="' + esc(r.a.id) + '" style="--niva:' + r.niva + '">' +
        TP_KOLUMNER.map(k => tpCell(r.a, k, i + 1)).join("") + "</div>").join("");
    const nyRad = kan ? '<div class="tp-rad tp-nyrad" data-tprad="ny">' +
        '<div class="tp-c tp-nr">' + (rader.length + 1) + "</div>" +
        '<div class="tp-c tp-e" tabindex="-1" data-tpfalt="namn"><span class="tp-tom">Ny aktivitet</span></div>' +
        '<div class="tp-c"></div><div class="tp-c"></div><div class="tp-c"></div></div>' : "";
    const kalRad = (a) => '<div class="tp-kalrad' + (a ? " tpc-" + tpFarg(a) : "") + '" data-tpspar="' + (a ? esc(a.id) : "ny") + '">' + (a ? tpStaplar(a, ax) : "") + "</div>";
    const veckor = [];
    for (let w = 0; w < ax.veckor; w++) veckor.push(ax.dagar[w * 5]);
    el.innerHTML =
        '<div class="p4-hero tp-hero"><div class="p4-hero-text">' +
        '<h1 class="g-rubrik">Tidplan</h1>' +
        '<div class="g-meta">' + esc(state.projekt || "Projekt") + " · " + rader.length + (rader.length === 1 ? " aktivitet" : " aktiviteter") +
        (kan ? "" : " · bara läsbehörighet") + "</div></div>" +
        '<div class="tp-nav" role="group" aria-label="Kalenderns period">' +
        '<button type="button" data-tpnav="-4" title="4 veckor bakåt" aria-label="4 veckor bakåt">' + TP_PIL_V + "</button>" +
        '<button type="button" data-tpnav="idag">Idag</button>' +
        '<button type="button" data-tpnav="4" title="4 veckor framåt" aria-label="4 veckor framåt">' + TP_PIL_H + "</button></div></div>" +
        '<div class="tp-yta' + (kan ? "" : " tp-las") + '">' +
        '<div class="tp-tabell" role="grid" aria-label="Aktiviteter">' +
        '<div class="tp-rad tp-huvud" role="row">' + TP_KOLUMNER.map(k => '<div class="tp-c">' + esc(k.namn) + "</div>").join("") + "</div>" +
        radHtml + nyRad + "</div>" +
        '<div class="tp-kalender" aria-label="Kalender">' +
        '<div class="tp-kalinre" style="width:' + bredd + "px;--dw:" + TP_DW + 'px">' +
        '<div class="tp-kalhuvud">' + veckor.map(d => '<span title="Vecka ' + veckonr(d) + ", från " + kortDatum(d) + '">v' + veckonr(d) +
            ' <small>' + kortDatum(d) + "</small></span>").join("") + "</div>" +
        rader.map(r => kalRad(r.a)).join("") + (kan ? kalRad(null) : "") +
        (idagX >= 0 && idagX <= bredd ? '<div class="tp-idag" style="left:' + idagX + 'px" title="Idag"></div>' : "") +
        "</div></div></div>" +
        '<details class="tp-genvagar"><summary>' + TP_PIL_H + "Kortkommandon</summary><dl>" +
        "<dt><kbd>Enter</kbd></dt><dd>Spara och gå till raden under</dd>" +
        "<dt><kbd>Tab</kbd></dt><dd>Spara och gå åt höger</dd>" +
        "<dt><kbd>Esc</kbd></dt><dd>Avbryt</dd>" +
        "<dt><kbd>Alt</kbd> <kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Flytta raden (eller dra i namnet)</dd>" +
        "<dt><kbd>Ctrl</kbd> <kbd>Enter</kbd></dt><dd>Infoga en rad ovanför</dd>" +
        "<dt><kbd>Ctrl</kbd> <kbd>Delete</kbd></dt><dd>Radera raden</dd>" +
        "<dt>Dra på en rad</dt><dd>Rita en period, ett klick ger en vecka</dd>" +
        "<dt><kbd>←</kbd> <kbd>→</kbd></dt><dd>Flytta markerad stapel en dag</dd>" +
        "<dt><kbd>Skift</kbd> <kbd>←</kbd> <kbd>→</kbd></dt><dd>Ändra stapelns längd</dd>" +
        "<dt><kbd>Delete</kbd></dt><dd>Ta bort markerad stapel</dd>" +
        "</dl></details>";
    tpScrolla();
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
        const ax = tpAxel(), k = tpKol(ax, IDAG);
        kal.scrollLeft = Math.max(0, Math.floor(k / 5 - 1) * 5 * TP_DW);
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
    const varde = !a ? "" : falt === "kalkTimmar" ? tpTimmarText(a.kalkTimmar) : (a[falt] || "");
    const inp = document.createElement("input");
    inp.className = "tp-in";
    inp.value = forsta != null ? forsta : varde;
    inp.setAttribute("aria-label", { namn: "Aktivitet", ansvarig: "Ansvarig", kalkTimmar: "Kalkylerade timmar" }[falt] || falt);
    if (falt === "kalkTimmar")
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
                if (r.falt === "kalkTimmar") {
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
                else if (ny !== undefined && ny !== (a[r.falt] === undefined ? (r.falt === "kalkTimmar" ? null : "") : a[r.falt])) {
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
        const j = TP_REDIG.indexOf(falt) + (steg === "hoger" ? 1 : -1);
        if (j >= TP_REDIG.length) { i++; f = TP_REDIG[0]; }
        else if (j < 0) { i--; f = TP_REDIG[TP_REDIG.length - 1]; }
        else f = TP_REDIG[j];
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
    else if (gor === "infoga") {
        const patch = opTpNyAktivitet(state, { namn: "", fore: id });
        if (tpKor(patch, "Ny rad")) {
            const cell = tpFokus(patch.andringar[0].id, "namn");
            tpBorja(cell);
        }
    }
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
            if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); return tpRadGor(id, e.key === "ArrowUp" ? "upp" : "ned"); }
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); return tpRadGor(id, "infoga"); }
            if ((e.ctrlKey || e.metaKey) && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); return tpRadGor(id, "radera"); }
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
            f[falt] = falt === "kalkTimmar" ? null : "";
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

// Antal arbetsdagar (kan vara negativt) från ett datum, utan att landa på helg.
function tpSkifta(iso, n) { return skiftaArbetsdagar(iso, n); }

let tpDrag = null;

(function () {
    const yta = document.getElementById("tidplan");
    if (!yta)
        return;

    yta.addEventListener("click", (e) => {
        const nav = e.target.closest("[data-tpnav]");
        if (!nav)
            return;
        const iMan = d2iso(mandag(iso2d(IDAG)));
        if (nav.dataset.tpnav === "idag") { tpVy.fran = null; tpScroll = null; }
        else {
            const kal = yta.querySelector(".tp-kalender");
            const syns = tpAxel().dagar[Math.round((kal ? kal.scrollLeft : 0) / TP_DW / 5) * 5] || iMan;
            tpVy.fran = plus(syns, +nav.dataset.tpnav * 7);
            tpScroll = 0;
        }
        ritaTidplan();
    });

    yta.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || !tpKanAndra())
            return;
        const spar = e.target.closest(".tp-kalrad");
        if (!spar || spar.dataset.tpspar === "ny")
            return;
        if (tpRedigerar)
            tpAvsluta(true);
        const inre = spar.closest(".tp-kalinre"), rect = inre.getBoundingClientRect();
        const stapel = e.target.closest(".tp-stapel");
        const ax = tpAxel();
        if (stapel) {
            const pq = tpPeriodAv(stapel.dataset.tpper);
            if (!pq)
                return;
            const hand = e.target.closest("[data-tphand]");
            tpDrag = { typ: hand ? hand.dataset.tphand : "flytta", el: stapel, nyckel: stapel.dataset.tpper, a: pq.a, q: pq.q,
                x0: e.clientX, left0: parseFloat(stapel.style.left), w0: parseFloat(stapel.style.width), dd: 0, flyttat: false, id: e.pointerId };
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
            d.el.textContent = d.flyttat ? (b - a + 1) + " d" : "";
            return;
        }
        const dx = e.clientX - d.x0;
        if (!d.flyttat && Math.abs(dx) < 4)
            return;
        d.flyttat = true;
        d.el.classList.add("drar");
        document.body.classList.add("tp-drar");
        const dd = Math.round(dx / TP_DW);
        d.dd = dd;
        if (d.typ === "flytta")
            d.el.style.left = d.left0 + dd * TP_DW + "px";
        else if (d.typ === "start") {
            const n = Math.max(-(d.w0 / TP_DW - 1), dd);   // minst en dag kvar
            d.dd = Math.min(dd, d.w0 / TP_DW - 1);
            d.el.style.left = d.left0 + d.dd * TP_DW + "px";
            d.el.style.width = d.w0 - d.dd * TP_DW + "px";
            void n;
        }
        else {
            d.dd = Math.max(dd, -(d.w0 / TP_DW - 1));
            d.el.style.width = d.w0 + d.dd * TP_DW + "px";
        }
    });

    const slut = (e) => {
        const d = tpDrag;
        if (!d || e.pointerId !== d.id)
            return;
        tpDrag = null;
        document.body.classList.remove("tp-drar");
        if (d.typ === "ny") {
            const a = tpHitta(d.aid);
            const k0 = Math.min(d.kol0, d.kol1), k1 = Math.max(d.kol0, d.kol1);
            // ett klick utan att dra ger en arbetsvecka
            const n = d.flyttat ? k1 - k0 + 1 : 5;
            if (a && e.type === "pointerup") {
                const patch = opTpNyPeriodPa(a, d.ax.dagar[k0], n);
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
        d.el.classList.remove("drar");
        tpValdPeriod = d.nyckel;
        if (!d.flyttat || !d.dd || e.type !== "pointerup") {
            ritaTidplan();
            tpFokusStapel();
            return;
        }
        const q = d.q;
        let falt;
        if (d.typ === "flytta")
            falt = { start: tpSkifta(q.start, d.dd) };
        else if (d.typ === "start")
            falt = { start: tpSkifta(q.start, d.dd), arbDagar: q.arbDagar - d.dd };
        else
            falt = { arbDagar: q.arbDagar + d.dd };
        tpKor(opTpAndraPeriod(d.a, q.id, falt), (d.typ === "flytta" ? "Flyttade " : "Ändrade ") + (d.a.namn || "period"));
        tpFokusStapel();
    };
    yta.addEventListener("pointerup", slut);
    yta.addEventListener("pointercancel", slut);

    // markerad stapel: pilar flyttar, Skift + pilar ändrar längden, Delete tar bort
    yta.addEventListener("keydown", (e) => {
        const st = e.target.closest && e.target.closest(".tp-stapel");
        if (!st || !tpKanAndra())
            return;
        const pq = tpPeriodAv(st.dataset.tpper);
        if (!pq)
            return;
        tpValdPeriod = st.dataset.tpper;
        const { a, q } = pq;
        if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            tpValdPeriod = null;
            tpKor(opTpTaBortPeriod(a, q.id), "Tog bort en period på " + (a.namn || "aktivitet"));
            tpFokus(a.id, "namn");
            return;
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            const n = e.key === "ArrowRight" ? 1 : -1;
            if (e.shiftKey) {
                if (q.arbDagar + n >= 1)
                    tpKor(opTpAndraPeriod(a, q.id, { arbDagar: q.arbDagar + n }), "Ändrade " + (a.namn || "period"));
            }
            else
                tpKor(opTpAndraPeriod(a, q.id, { start: tpSkifta(q.start, n) }), "Flyttade " + (a.namn || "period"));
            tpFokusStapel();
        }
        if (e.key === "Escape") { tpValdPeriod = null; st.blur(); ritaTidplan(); }
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
