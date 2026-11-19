/* ======================================================================
   Wimo · Tidplan: utskrift och PDF

   En dialog väljer tidsperiod, papper, innehåll och färgförklaring.
   Sidorna byggs i millimeter: tidsaxeln anpassas till sidans bredd och
   raderna delas på så många sidor som behövs, med rubrik och tidsaxel
   på varje sida. Webbläsarens utskrift sparar som PDF.
   ====================================================================== */

const TPU_PAPPER = { A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594] };
// fasta ljusa färger: utskriften ska se likadan ut oavsett om skärmen är i mörkt läge
const TPU_FARG = {
    gron: ["#07695b", "#d3ece4", "#84c3b1"], bla: ["#1f4ea8", "#dae6f8", "#99b4e3"], orange: ["#b35204", "#fce2c6", "#e9ad76"],
    lila: ["#643f9a", "#ebe0f6", "#bba1dc"], rod: ["#b0261b", "#fadad3", "#e6a193"], brun: ["#74552f", "#eee2d1", "#cbb08d"]
};

const tpuNyckel = () => "wimo_tputskrift_" + (state && state.id);
function tpuLas() {
    let v = {};
    try { v = JSON.parse(localStorage.getItem(tpuNyckel()) || "{}") || {}; } catch (e) { }
    return Object.assign({ papper: "A3", liggande: true, axel: "auto", ansvarig: true, timmar: true, resurser: true, forklaring: true, idag: true, ihop: true, logga: true }, v);
}
function tpuSpara(o) { try { localStorage.setItem(tpuNyckel(), JSON.stringify(o)); } catch (e) { } }

// hela tidplanens spann (måndag till söndag), eller den här veckan + 12 om planen är tom
function tpuPlanSpann() {
    let fran = null, till = null;
    tpAktiviteter(state).forEach(a => (a.perioder || []).forEach(q => {
        const s = tpStart(q), e = tpSlut(q);
        if (!fran || s < fran) fran = s;
        if (!till || e > till) till = e;
    }));
    if (!fran) { fran = IDAG; till = plus(IDAG, 12 * 7); }
    return { fran: d2iso(mandag(iso2d(fran))), till: plus(d2iso(mandag(iso2d(till))), 6) };
}

// färger som används i tidplanen (aktiviteter och perioder)
function tpuAnvandaFarger() {
    const s = new Set();
    tpAktiviteter(state).forEach(a => {
        if ((a.perioder || []).length) s.add(tpFarg(a));
        (a.perioder || []).forEach(q => { if (q.farg) s.add(q.farg); });
    });
    return TP_FARGER.filter(f => s.has(f[0]));
}

/* ---------- dialogen ---------- */

function tpUtskriftDialog() {
    const o = tpuLas(), sp = tpuPlanSpann(), farger = tpuAnvandaFarger();
    const fargNamn = Object.assign({}, state.tidplan.fargNamn || {});
    const kryss = (id, txt, pa, hjalp) => '<label class="tp-kryss"><input type="checkbox" id="' + id + '"' + (pa ? " checked" : "") + "> " + txt + (hjalp ? ' <span class="hjalp">' + hjalp + "</span>" : "") + "</label>";
    const kropp = '<div class="tpu-dlg">' +
        '<div class="tpu-grupp"><div class="tpu-rubrik">Tidsperiod</div>' +
        '<div class="tpu-val"><label class="falt"><span>Från</span><input class="f" type="date" id="tpuFran" value="' + sp.fran + '"></label>' +
        '<label class="falt"><span>Till</span><input class="f" type="date" id="tpuTill" value="' + sp.till + '"></label>' +
        '<button type="button" class="p4d-lank" id="tpuHela">Hela tidplanen</button></div></div>' +
        '<div class="tpu-grupp"><div class="tpu-rubrik">Papper</div><div class="tpu-val">' +
        '<div class="tp-nav" role="radiogroup" aria-label="Pappersformat">' + Object.keys(TPU_PAPPER).map(k => '<button type="button" role="radio" data-tpupapper="' + k + '" class="' + (o.papper === k ? "vald" : "") + '" aria-checked="' + (o.papper === k) + '">' + k + "</button>").join("") + "</div>" +
        '<div class="tp-nav" role="radiogroup" aria-label="Orientering"><button type="button" role="radio" data-tpuorient="1" class="' + (o.liggande ? "vald" : "") + '" aria-checked="' + o.liggande + '">Liggande</button>' +
        '<button type="button" role="radio" data-tpuorient="0" class="' + (!o.liggande ? "vald" : "") + '" aria-checked="' + !o.liggande + '">Stående</button></div></div></div>' +
        '<div class="tpu-grupp"><div class="tpu-rubrik">Tidsaxel</div><div class="tpu-val">' +
        '<div class="tp-nav" role="radiogroup" aria-label="Tidsaxel">' + [["auto", "Automatisk"], ["dag", "Dagar"], ["vecka", "Veckor"], ["manad", "Månader"]].map(([k, n]) => '<button type="button" role="radio" data-tpuaxel="' + k + '" class="' + (o.axel === k ? "vald" : "") + '" aria-checked="' + (o.axel === k) + '">' + n + "</button>").join("") + "</div>" +
        '<span class="tpu-skala" id="tpuSkala"></span></div></div>' +
        '<div class="tpu-grupp"><div class="tpu-rubrik">Innehåll</div><div class="tpu-kryss">' +
        kryss("tpuAnsv", "Ansvarig", o.ansvarig) + kryss("tpuTim", "Kalkylerade och planerade timmar", o.timmar) +
        kryss("tpuRes", "Resursbehov per vecka", o.resurser) + kryss("tpuIdag", "Markera idag", o.idag) +
        kryss("tpuIhop", "Fäll ihop grupper som på skärmen", o.ihop) + kryss("tpuForkl", "Färgförklaring", o.forklaring) +
        (typeof tpAktivBas === "function" && tpAktivBas() ? kryss("tpuBas", "Jämför med baslinjen " + esc(tpAktivBas().namn), true) : "") +
        (tpAktiviteter(state).some(a => tpSamband(a).length) ? kryss("tpuSb", "Samband som pilar", tpVy.samband !== false) : "") +
        (tpuHarKlart() ? kryss("tpuAvst", "Avstämningslinje " + esc(kortDatum(tpAvstDatum())), !!tpVy.avst) : "") +
        (state.logotyp ? '<label class="tp-kryss"><input type="checkbox" id="tpuLogga"' + (o.logga ? " checked" : "") + '> Projektets logotyp <img class="tpu-loggamini" src="' + state.logotyp + '" alt=""></label>'
            : '<div class="tpu-ingenlogga"><span class="hjalp">Ingen logotyp.</span> <button type="button" class="p4d-lank" id="tpuLoggaValj">Välj bild…</button><input type="file" id="tpuLoggaFil" accept="image/png,image/jpeg,image/webp" hidden><span id="tpuLoggaFel"></span></div>') +
        "</div></div>" +
        (farger.length ? '<div class="tpu-grupp" id="tpuFargGrupp"><div class="tpu-rubrik">Färgförklaring <span class="hjalp">vad färgerna betyder, t.ex. Egen personal eller UE</span></div><div class="tpu-farger">' +
            farger.map(([k, n]) => '<label class="tpu-farg"><i style="--c:' + TPU_FARG[k][0] + ";--f:" + TPU_FARG[k][1] + '" aria-hidden="true"></i><input class="f" data-tpufarg="' + k + '" value="' + esc(fargNamn[k] || "") + '" placeholder="' + n + '" aria-label="Betydelse för ' + n + '"></label>').join("") + "</div></div>" : "") +
        '<div class="tpu-sammanf" id="tpuSammanf"></div><div id="tpuFel"></div></div>';
    modal("Skriv ut tidplanen", "Välj vad som ska med. I utskriftsrutan väljer du skrivare eller Spara som PDF.", kropp, [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Skriv ut / spara som PDF", primar: true, fn: () => kor() }
    ]);
    const $ = (id) => document.getElementById(id);
    const las = () => ({
        papper: o.papper, liggande: o.liggande, axel: o.axel,
        ansvarig: $("tpuAnsv").checked, timmar: $("tpuTim").checked, resurser: $("tpuRes").checked,
        idag: $("tpuIdag").checked, ihop: $("tpuIhop").checked, forklaring: $("tpuForkl").checked,
        logga: $("tpuLogga") ? $("tpuLogga").checked : o.logga,
        fran: $("tpuFran").value, till: $("tpuTill").value,
        sb: $("tpuSb") ? $("tpuSb").checked : false,
        bas: $("tpuBas") ? $("tpuBas").checked : false, avst: $("tpuAvst") ? $("tpuAvst").checked : false
    });
    function uppdatera() {
        const v = las();
        if (!(v.fran && v.till && v.till >= v.fran)) { $("tpuSammanf").textContent = ""; $("tpuSkala").textContent = ""; return; }
        const l = tpuLayout(v);
        const axelTxt = { dag: "dagar", vecka: "veckor", manad: "månader" }[l.axel];
        $("tpuSkala").textContent = (v.axel === "auto" ? "Visar " + axelTxt + " · " : "") + (Math.round(l.dw * l.dpv * 10) / 10).toString().replace(".", ",") + " mm per vecka";
        $("tpuSammanf").innerHTML = "<b>" + l.sidor + (l.sidor === 1 ? " sida" : " sidor") + "</b> · " + v.papper + " " + (v.liggande ? "liggande" : "stående") + " · " + l.rader.length + (l.rader.length === 1 ? " rad" : " rader") +
            (l.dw * l.dpv < 4 ? ' · <span class="tpu-varn">Tidsaxeln blir mycket tät – välj en kortare period eller större papper</span>' : "");
    }
    document.querySelector("#overlay .tpu-dlg").addEventListener("click", (e) => {
        const p = e.target.closest("[data-tpupapper]"), r = e.target.closest("[data-tpuorient]"), ax = e.target.closest("[data-tpuaxel]");
        if (!p && !r && !ax) return;
        if (p) o.papper = p.dataset.tpupapper;
        if (r) o.liggande = r.dataset.tpuorient === "1";
        if (ax) o.axel = ax.dataset.tpuaxel;
        const grupp = (p || r || ax).parentElement;
        grupp.querySelectorAll("button").forEach(b => { const pa = b === (p || r || ax); b.classList.toggle("vald", pa); b.setAttribute("aria-checked", String(pa)); });
        uppdatera();
    });
    document.querySelector("#overlay .tpu-dlg").addEventListener("change", uppdatera);
    document.querySelector("#overlay .tpu-dlg").addEventListener("input", (e) => { if (e.target.type === "date") uppdatera(); });
    $("tpuHela").addEventListener("click", () => { $("tpuFran").value = sp.fran; $("tpuTill").value = sp.till; $("tpuFran").dispatchEvent(new Event("change", { bubbles: true })); $("tpuTill").dispatchEvent(new Event("change", { bubbles: true })); uppdatera(); });
    if ($("tpuLoggaValj")) {
        $("tpuLoggaValj").addEventListener("click", () => $("tpuLoggaFil").click());
        $("tpuLoggaFil").addEventListener("change", (e) => {
            const f = e.target.files[0];
            e.target.value = "";
            laddaLogga(f, (data, fel) => {
                if (fel) return ($("tpuLoggaFel").innerHTML = ' <span class="tpu-varn">' + esc(fel) + "</span>");
                state.logotyp = data;
                spara();
                if (typeof ritaLogga === "function") ritaLogga();
                const ruta = document.querySelector("#overlay .tpu-ingenlogga");
                ruta.outerHTML = '<label class="tp-kryss"><input type="checkbox" id="tpuLogga" checked> Projektets logotyp <img class="tpu-loggamini" src="' + data + '" alt=""></label>';
            });
        });
    }
    function kor() {
        const v = las();
        if (!(v.fran && v.till)) return ($("tpuFel").innerHTML = '<div class="notis rod">Ange både från- och tilldatum.</div>');
        if (v.till < v.fran) return ($("tpuFel").innerHTML = '<div class="notis rod">Tilldatum måste vara efter frånvärdet.</div>');
        // färgförklaringen sparas i tidplanen, så den följer med till nästa utskrift och till kollegorna
        const nyaNamn = {};
        document.querySelectorAll("#overlay [data-tpufarg]").forEach(f => { if (f.value.trim()) nyaNamn[f.dataset.tpufarg] = f.value.trim(); });
        const gamla = state.tidplan.fargNamn || {};
        const andrat = JSON.stringify(Object.assign({}, gamla, nyaNamn)) !== JSON.stringify(gamla) || Object.keys(gamla).some(k => farger.some(f => f[0] === k) && !nyaNamn[k]);
        if (andrat) {
            const ny = Object.assign({}, gamla);
            farger.forEach(([k]) => { if (nyaNamn[k]) ny[k] = nyaNamn[k]; else delete ny[k]; });
            state.tidplan.fargNamn = ny;
            spara();
        }
        tpuSpara({ papper: v.papper, liggande: v.liggande, axel: v.axel, ansvarig: v.ansvarig, timmar: v.timmar, resurser: v.resurser, idag: v.idag, ihop: v.ihop, forklaring: v.forklaring, logga: v.logga });
        stangModal();
        tpSkrivUt(v);
    }
    uppdatera();
}

/* ---------- layout ---------- */

function tpuLayout(o) {
    const [pb, ph] = TPU_PAPPER[o.papper] || TPU_PAPPER.A3;
    const W = (o.liggande ? pb : ph) - 20, H = (o.liggande ? ph : pb) - 24 - 8;
    const kal = tpKal(), dpv = tpDpv(), stor = W > 380;
    // tabellens kolumner i mm
    const kol = [{ id: "nr", b: 9 }, { id: "namn", b: W < 300 ? 48 : stor ? 70 : 58 }];
    if (o.ansvarig) kol.push({ id: "ansvarig", b: 24 });
    if (o.timmar) kol.push({ id: "kalk", b: 12 }, { id: "plan", b: 12 }, { id: "avvik", b: 17 });
    if (tpuHarKlart()) kol.push({ id: "klart", b: 11 });
    if (o.bas && tpAktivBas()) kol.push({ id: "basavvik", b: 13 });
    // tabellen tar högst hälften av bredden; namnet krymper först (dock minst 30 mm)
    let tabB = kol.reduce((s, k) => s + k.b, 0);
    if (tabB > W * .5) { const namn = kol[1]; namn.b = Math.max(30, namn.b - (tabB - W * .5)); tabB = kol.reduce((s, k) => s + k.b, 0); }
    const TW = W - tabB;
    // dagarna på axeln: hela veckor, fem eller sju dagar per vecka som på skärmen
    const fran = d2iso(mandag(iso2d(o.fran))), dagar = [];
    for (let v = fran; v <= o.till; v = plus(v, 7))
        for (let d = 0; d < dpv; d++) dagar.push(plus(v, d));
    const index = {};
    dagar.forEach((d, i) => { index[d] = i; });
    const dw = TW / Math.max(1, dagar.length), vb = dw * dpv;
    const axel = o.axel !== "auto" ? o.axel : vb >= 30 ? "dag" : vb >= 7 ? "vecka" : "manad";
    // rader: följ hopfällda grupper om man vill
    const alla = tpRaderAlla(), dolda = new Set();
    if (o.ihop) alla.forEach(r => { if (r.grupp && tpVy.ihop.has(r.a.id)) tpAllaUnder(tpBarn(), r.a.id).forEach(x => dolda.add(x.id)); });
    const rader = alla.filter(r => !dolda.has(r.a.id));
    const barnKarta = tpBarn();
    rader.forEach(r => { r.barnKarta = barnKarta; });
    // sidindelning
    const rh = W < 300 ? 5 : 5.6, huvud = state.logotyp && o.logga ? 23 : 21, axelH = 9;
    const perSida = Math.max(1, Math.floor((H - huvud - axelH - 2) / rh));
    const behov = o.resurser ? tpResursbehov(kal, tpAktiviteter(state)) : new Map();
    const resRader = o.resurser && behov.size ? behov.size + (behov.size > 1 ? 1 : 0) + 1 : 0;
    const extraH = (resRader ? resRader * rh + 4 : 0) + (o.forklaring ? 12 : 0);
    const sidor = [];
    for (let i = 0; i < rader.length; i += perSida) sidor.push(rader.slice(i, i + perSida));
    if (!sidor.length) sidor.push([]);
    const sista = sidor[sidor.length - 1];
    const extraSida = extraH && (H - huvud - axelH - 2 - sista.length * rh) < extraH;
    return { o, W, H, kol, tabB, TW, dagar, index, dw, dpv, axel, rader, rh, huvud, axelH, behov, extraH, extraSida, kal, sidLista: sidor, sidor: sidor.length + (extraSida ? 1 : 0) };
}

/* ---------- ritning ---------- */

const tpuHarKlart = () => tpAktiviteter(state).some(a => typeof a.klart === "number");

const tpuMm = (v) => (Math.round(v * 100) / 100) + "mm";

function tpuAxelHtml(l) {
    const ut = [], s = (x, w, cls, txt) => ut.push('<span class="' + cls + '" style="left:' + tpuMm(x) + ";width:" + tpuMm(w) + '">' + txt + "</span>");
    const veckor = l.dagar.length / l.dpv;
    // överst: månader (dag- och veckoaxel) eller år (månadsaxel)
    let start = 0;
    l.dagar.forEach((d, i) => {
        const n = l.dagar[i + 1], nyckel = l.axel === "manad" ? 4 : 7;
        if (!n || n.slice(0, nyckel) !== d.slice(0, nyckel)) {
            const m = iso2d(d), w = (i - start + 1) * l.dw;
            if (l.axel === "manad") s(start * l.dw, w, "o", w > 10 ? String(m.getFullYear()) : "");
            else s(start * l.dw, w, "o", w > 14 ? MANAD[m.getMonth()].replace(/^./, c => c.toUpperCase()) + " " + m.getFullYear() : w > 7 ? MANAD[m.getMonth()].slice(0, 3) : "");
            start = i + 1;
        }
    });
    // underst: dagar, veckonummer eller månader
    if (l.axel === "dag") l.dagar.forEach((d, i) => s(i * l.dw, l.dw, "u", (l.dw > 4.5 ? DAGKORT[(iso2d(d).getDay() + 6) % 7].charAt(0) + " " : "") + iso2d(d).getDate()));
    else if (l.axel === "vecka") for (let w = 0; w < veckor; w++) s(w * l.dpv * l.dw, l.dpv * l.dw, "u", (l.dpv * l.dw > 9 ? "v" : "") + veckonr(l.dagar[w * l.dpv]));
    else {
        start = 0;
        l.dagar.forEach((d, i) => {
            const n = l.dagar[i + 1];
            if (!n || n.slice(0, 7) !== d.slice(0, 7)) {
                const w = (i - start + 1) * l.dw, m = iso2d(d).getMonth();
                s(start * l.dw, w, "u", w > 9 ? MANAD[m].slice(0, 3) : w > 3 ? MANAD[m].charAt(0).toUpperCase() : "");
                start = i + 1;
            }
        });
    }
    return '<div class="tpu-axel">' + ut.join("") + "</div>";
}

// bakgrund för tidsdelen: veckolinjer, lediga dagar och idag
function tpuBakgrund(l, hojd, o) {
    const ut = [];
    for (let w = 0; w * l.dpv < l.dagar.length; w++) {
        const d = l.dagar[w * l.dpv], forsta = w === 0 || d.slice(0, 7) !== l.dagar[w * l.dpv - 1].slice(0, 7);
        ut.push('<i class="tpu-vl' + (forsta ? " m" : "") + '" style="left:' + tpuMm(w * l.dpv * l.dw) + '"></i>');
    }
    l.dagar.forEach((d, i) => {
        const sk = l.kal.ledigtSkal(d);
        if (sk) ut.push('<i class="tpu-ledig' + (sk === "helg" ? " helg" : "") + '" style="left:' + tpuMm(i * l.dw) + ";width:" + tpuMm(l.dw) + '"></i>');
    });
    if (o.idag && !(o.avst && !tpVy.avstDatum) && l.index[IDAG] !== undefined) ut.push('<i class="tpu-idag" style="left:' + tpuMm((l.index[IDAG] + .5) * l.dw) + '"></i>');
    return '<div class="tpu-bg" style="height:' + tpuMm(hojd) + '">' + ut.join("") + "</div>";
}

// kolumn för ett datum; datum utanför axeln hamnar utanför (klipps)
function tpuKol(l, iso) {
    if (l.index[iso] !== undefined) return l.index[iso];
    if (iso < l.dagar[0]) return -1;
    if (iso > l.dagar[l.dagar.length - 1]) return l.dagar.length;
    // en helgdag när helgerna inte visas: närmast föregående dag på axeln
    let d = iso;
    for (let i = 0; i < 7; i++) { d = plus(d, -1); if (l.index[d] !== undefined) return l.index[d] + .999; }
    return -1;
}

function tpuStaplar(l, r, o) {
    const a = r.a, ut = [], kal = l.kal;
    const bas = o.bas && typeof tpAktivBas === "function" ? tpAktivBas() : null;
    if (bas) {
        const lista = r.grupp ? [tpBasSpann(kal, r.barnKarta, bas, a, true)].filter(Boolean) : tpBasPerioder(bas, a.id).map(q => ({ fran: kal.narmasteArbetsdag(q.start, 1), till: kal.slut(q.start, q.arbDagar) }));
        lista.forEach(sp => {
            const s = tpuKol(l, sp.fran), e = tpuKol(l, sp.till);
            if (e < 0 || s >= l.dagar.length) return;
            const k0 = Math.max(0, Math.ceil(s)), k1 = Math.min(l.dagar.length - 1, Math.floor(e));
            if (k1 >= k0) ut.push('<i class="tpu-bas' + (r.grupp ? " grupp" : "") + '" style="left:' + tpuMm(k0 * l.dw) + ";width:" + tpuMm((k1 - k0 + 1) * l.dw) + '"></i>');
        });
    }
    if (r.grupp) {
        const sp = tpSpann(kal, r.barnKarta, a);
        if (sp) {
            const k0 = Math.max(0, tpuKol(l, sp.fran)), k1 = Math.min(l.dagar.length - 1, Math.floor(tpuKol(l, sp.till)));
            if (k1 >= k0 && tpuKol(l, sp.till) >= 0 && tpuKol(l, sp.fran) < l.dagar.length)
                ut.push('<i class="tpu-gspann" style="left:' + tpuMm(k0 * l.dw) + ";width:" + tpuMm((k1 - k0 + 1) * l.dw) + ";--c:" + TPU_FARG[tpFarg(a)][0] + '"></i>');
        }
    }
    (a.perioder || []).forEach(q => {
        const s = tpuKol(l, tpStart(q)), e = tpuKol(l, tpSlut(q));
        if (e < 0 || s >= l.dagar.length) return;
        const k0 = Math.max(0, Math.ceil(s)), k1 = Math.min(l.dagar.length - 1, Math.floor(e));
        if (k1 < k0) return;
        const f = TPU_FARG[q.farg || tpFarg(a)] || TPU_FARG.gron, w = (k1 - k0 + 1) * l.dw;
        const bem = tpBemText(q), txt = w >= 30 && bem ? q.arbDagar + " d · " + bem : w >= 8 ? q.arbDagar + " d" : "";
        // framdrift: den klara delen fylls i
        let fyll = 0;
        if (tpKlart(a)) {
            const pt = tpFramdriftsPunkt(tpArbetsdagLista(kal, a.perioder), tpKlart(a)), qd = kal.dagarI(q.start, q.arbDagar);
            if (pt && pt.dag > qd[qd.length - 1]) fyll = w;
            else if (pt && pt.dag >= qd[0]) fyll = Math.max(0, Math.min(w, (tpuKol(l, pt.dag) - k0 + pt.del) * l.dw));
        }
        ut.push('<span class="tpu-st' + (r.grupp ? " i-grupp" : "") + (s < 0 ? " klippt-v" : "") + (e >= l.dagar.length ? " klippt-h" : "") + '" style="left:' + tpuMm(k0 * l.dw) + ";width:" + tpuMm(w) + ";--c:" + f[0] + ";--f:" + f[1] + ";--k:" + f[2] + '">' + (fyll ? '<i class="tpu-fyll" style="width:' + tpuMm(fyll) + '"></i>' : "") + "<b>" + esc(txt) + "</b></span>");
    });
    return ut.join("");
}

function tpuCell(l, r, k, nr) {
    const a = r.a, kal = l.kal, h = kal.inst.arbTimmarPerDag;
    const tal = (v) => v === null || v === undefined || v === 0 ? "" : tpTimmarText(Math.round(v * 10) / 10);
    if (k.id === "nr") return '<span class="c nr"><i style="background:' + TPU_FARG[tpFarg(a)][0] + '"></i>' + nr + "</span>";
    if (k.id === "namn") return '<span class="c namn" style="padding-left:' + tpuMm(1.5 + r.niva * 3.5) + '">' + (r.grupp ? "<b>" + esc(a.namn || "") + "</b>" : esc(a.namn || "")) + "</span>";
    if (k.id === "ansvarig") return '<span class="c">' + esc(a.ansvarig || "") + "</span>";
    if (k.id === "klart") {
        const lg = tpUfLaget(a, r);
        return '<span class="c t">' + (lg.harKlart && lg.dagar.length ? Math.round(lg.klart) + " %" : "") + "</span>";
    }
    if (k.id === "basavvik") {
        const bas = tpAktivBas(), nu = r.grupp ? tpSpann(kal, r.barnKarta, a) : (a.perioder || []).length ? tpSpann(kal, new Map(), a) : null, forr = tpBasSpann(kal, r.barnKarta, bas, a, r.grupp);
        if (!nu || !forr) return '<span class="c t">' + (nu && !forr ? "Ny" : "") + "</span>";
        const n = tpForskjutning(kal, nu.till, forr.till);
        return '<span class="c t' + (n > 0 ? " over" : "") + '">' + (n > 0 ? "+" + n + " d" : n < 0 ? "−" + Math.abs(n) + " d" : "0") + "</span>";
    }
    const kalk = r.grupp ? tpKalkTimmar(r.barnKarta, a) : (typeof a.kalkTimmar === "number" ? a.kalkTimmar : null);
    const plan = tpPlaneradeTimmar(kal, r.barnKarta, a, r.grupp);
    if (k.id === "kalk") return '<span class="c t">' + tal(kalk) + "</span>";
    if (k.id === "plan") return '<span class="c t">' + tal(plan) + "</span>";
    const av = tpAvvikelse(kalk, plan);
    if (!av) return '<span class="c t"></span>';
    const t = Math.round(av.timmar);
    return '<span class="c t' + (av.procent !== null && av.procent >= 5 ? " over" : "") + '">' + (t > 0 ? "+" : t < 0 ? "−" : "") + Math.abs(t) + (av.procent !== null ? " <small>" + (av.procent > 0 ? "+" : av.procent < 0 ? "−" : "") + Math.abs(Math.round(av.procent)) + "%</small>" : "") + "</span>";
}

function tpuResurser(l) {
    const typer = tpResTyper(), namn = (id) => { const t = typer.find(x => x.id === id); return t ? t.namn : "Borttagen yrkesgrupp"; };
    const ids = typer.map(t => t.id).filter(id => l.behov.has(id)).concat([...l.behov.keys()].filter(id => !typer.some(t => t.id === id)));
    const veckor = l.dagar.length / l.dpv, kolB = l.dpv * l.dw, h = l.kal.inst.arbTimmarPerDag;
    const veckoMax = (perDag) => { const ut = []; for (let w = 0; w < veckor; w++) { let m = 0; for (let d = 0; d < l.dpv; d++) m = Math.max(m, perDag.get(l.dagar[w * l.dpv + d]) || 0); ut.push(m); } return ut; };
    const rad = (vanster, celler, cls) => '<div class="tpu-rad' + (cls ? " " + cls : "") + '" style="height:' + tpuMm(l.rh) + '"><div class="tpu-tab" style="width:' + tpuMm(l.tabB) + '">' + vanster + '</div><div class="tpu-tid">' + celler + "</div></div>";
    const celler = (lista, kap) => lista.map((n, w) => n ? '<span class="tpu-rc' + (kap && n > kap ? " over" : "") + '" style="left:' + tpuMm(w * kolB) + ";width:" + tpuMm(kolB) + '">' + (kolB >= 3.2 ? tpTimmarText(Math.round(n * 10) / 10) : "") + "</span>" : "").join("");
    const tot = new Map();
    let ut = rad('<span class="c tpu-rrubrik">Resursbehov, flest personer samtidigt per vecka</span><span class="c t">Pd</span>', "", "tpu-rhuvud");
    ids.forEach(id => {
        const r = l.behov.get(id), kap = tpKapacitet(id);
        r.perDag.forEach((n, d) => tot.set(d, (tot.get(d) || 0) + n));
        ut += rad('<span class="c namn">' + esc(namn(id)) + (kap ? ' <small>' + kap + " i resursbanken</small>" : "") + '</span><span class="c t" title="' + esc(tpTimmarText(r.persondagar * h) + " h") + '">' + tpTimmarText(Math.round(r.persondagar * 10) / 10) + "</span>", celler(veckoMax(r.perDag), kap));
    });
    if (ids.length > 1) {
        const pd = ids.reduce((s, id) => s + l.behov.get(id).persondagar, 0);
        ut += rad('<span class="c namn"><b>Totalt</b></span><span class="c t"><b>' + tpTimmarText(Math.round(pd * 10) / 10) + "</b></span>", celler(veckoMax(tot)), "tpu-rtot");
    }
    return '<div class="tpu-res">' + ut + "</div>";
}

function tpuForklaring(l) {
    const namn = state.tidplan.fargNamn || {};
    const farger = tpuAnvandaFarger().map(([k, n]) => '<span><i class="sw" style="--c:' + TPU_FARG[k][0] + ";--f:" + TPU_FARG[k][1] + ";--k:" + TPU_FARG[k][2] + '"></i>' + esc(namn[k] || n) + "</span>");
    return '<div class="tpu-forkl">' + farger.join("") +
        '<span><i class="gr"></i>Grupp, hela tidsspannet</span><span><i class="le"></i>Ledig dag</span>' +
        (tpuHarKlart() ? '<span><i class="kl"></i>Klar del</span>' : "") +
        (l.o && l.o.sb ? '<span><i class="sbp"></i>Samband</span>' : "") +
        (l.o && l.o.bas && tpAktivBas() ? '<span><i class="ba"></i>Baslinje ' + esc(tpAktivBas().namn) + "</span>" : "") +
        (l.o && l.o.avst ? '<span><i class="av"></i>Avstämning ' + esc(kortDatum(tpAvstDatum())) + "</span>" : "") +
        (l.index[IDAG] !== undefined && l.o.idag && !(l.o.avst && !tpVy.avstDatum) ? '<span><i class="id"></i>Idag</span>' : "") +
        '<span class="tid">Perioder i arbetsdagar · ' + l.kal.inst.arbTimmarPerDag + " h per dag</span></div>";
}

function tpuHuvud(o, sida, antal) {
    const urval = kortDatum(o.fran) + " " + o.fran.slice(0, 4) + " – " + kortDatum(o.till) + " " + o.till.slice(0, 4) + " · v" + veckonr(o.fran) + "–" + veckonr(o.till);
    document.getElementById("utskriftsfot").textContent = (state.projekt || "Projekt") + " – Tidplan · " + urval + " · utskriven " + tidStampel();
    return '<div class="uhuvud tpu-huvud">' + (o.logga && state.logotyp ? '<img class="ulogga" src="' + state.logotyp + '" alt="">' : "") +
        '<div class="utext"><div class="utitel">' + esc(state.projekt || "Projekt") + " – Tidplan</div>" +
        '<div class="umeta">' + esc(urval) + " · utskriven " + tidStampel() + "</div></div>" +
        '<div class="tpu-sidnr">Sida ' + sida + " av " + antal + "</div></div>";
}

function tpuSamband(l, o, rader) {
    if (!o.sb || !rader.length) return "";
    const kal = l.kal, index = new Map(rader.map((r, i) => [r.a.id, i])), ut = [];
    const x = (iso, slutet) => { const k = tpuKol(l, iso); return (k < 0 ? 0 : k >= l.dagar.length ? l.dagar.length : (slutet ? Math.floor(k) + 1 : Math.ceil(k))) * l.dw; };
    rader.forEach((r, i) => tpSamband(r.a).forEach(s => {
        const fi = index.get(s.fran);
        if (fi === undefined) return;
        const f = tpEgetSpann(kal, rader[fi].a), e = tpEgetSpann(kal, r.a);
        if (!f || !e) return;
        const franSlut = s.typ === "FS" || s.typ === "FF", tillStart = s.typ === "FS" || s.typ === "SS";
        const d = tpSbVag(x(franSlut ? f.till : f.fran, franSlut), fi * l.rh + l.rh / 2, x(tillStart ? e.fran : e.till, !tillStart), i * l.rh + l.rh / 2, franSlut, tillStart, x(e.till, true), l.rh, 1.4);
        const brott = tpSambandBehov(kal, rader[fi].a, r.a, s) > 0;
        ut.push('<path d="' + d + '" class="' + (brott ? "brott" : "") + '" marker-end="url(#tpuPil' + (brott ? "R" : "") + ')"/>');
    }));
    if (!ut.length) return "";
    const H = rader.length * l.rh;
    return '<svg class="tpu-sb" viewBox="0 0 ' + l.TW.toFixed(2) + " " + H.toFixed(2) + '" style="width:' + tpuMm(l.TW) + ";height:" + tpuMm(H) + '">' +
        '<defs><marker id="tpuPil" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 8 4 0 8z" fill="#5a636b"/></marker>' +
        '<marker id="tpuPilR" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 8 4 0 8z" fill="#b0261b"/></marker></defs>' + ut.join("") + "</svg>";
}

function tpuAvstamning(l, o, rader) {
    if (!o.avst || !rader.length) return "";
    const kal = l.kal, dagen = kal.narmasteArbetsdag(tpAvstDatum(), 1), sk = tpuKol(l, dagen);
    if (sk < 0 || sk >= l.dagar.length) return "";
    const sx = Math.ceil(sk) * l.dw, H = rader.length * l.rh, pkt = [[sx, 0]], prickar = [];
    rader.forEach((r, i) => {
        const lg = tpUfLaget(r.a, r);
        if (!tpIAvstamning(lg.dagar, lg.klart, dagen)) return;
        const pt = tpFramdriftsPunkt(lg.dagar, lg.klart), k = tpuKol(l, pt.dag);
        const x = Math.max(0, Math.min(l.TW, (k < 0 ? 0 : k >= l.dagar.length ? l.dagar.length : k + pt.del) * l.dw)), y = i * l.rh + l.rh / 2;
        const lage = tpUfLage(lg, dagen);
        pkt.push([sx, y - l.rh * .42], [x, y], [sx, y + l.rh * .42]);
        prickar.push('<circle cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r=".7" class="' + (lage.dagar <= -.5 ? "efter" : lage.dagar >= .5 ? "fore" : "") + '"/>');
    });
    pkt.push([sx, H]);
    return '<svg class="tpu-avst" viewBox="0 0 ' + l.TW.toFixed(2) + " " + H.toFixed(2) + '" style="width:' + tpuMm(l.TW) + ";height:" + tpuMm(H) + '">' +
        '<polyline points="' + pkt.map(p => p[0].toFixed(2) + "," + p[1].toFixed(2)).join(" ") + '"/>' + prickar.join("") + "</svg>";
}

function tpuSidHtml(l, o, rader, nr0, sida, antal, medExtra) {
    const hojdRader = rader.length * l.rh;
    const tabHuvud = '<div class="tpu-rad tpu-thuvud" style="height:' + tpuMm(l.axelH) + '"><div class="tpu-tab" style="width:' + tpuMm(l.tabB) + '">' +
        l.kol.map(k => '<span class="c' + (["kalk", "plan", "avvik", "klart", "basavvik"].indexOf(k.id) >= 0 ? " t" : "") + '" style="width:' + tpuMm(k.b) + '">' + ({ nr: "#", namn: "Aktivitet", ansvarig: "Ansvarig", kalk: "Kalk. h", plan: "Plan. h", avvik: "Avvik.", klart: "Klart", basavvik: "Mot bas" })[k.id] + "</span>").join("") +
        '</div><div class="tpu-tid">' + tpuAxelHtml(l) + "</div></div>";
    const rad = rader.map((r, i) => '<div class="tpu-rad' + (r.grupp ? " grupp" : "") + '" style="height:' + tpuMm(l.rh) + '"><div class="tpu-tab" style="width:' + tpuMm(l.tabB) + '">' +
        l.kol.map(k => tpuCell(l, r, k, nr0 + i + 1).replace('<span class="c', '<span style="width:' + tpuMm(k.b) + '" class="c')).join("") +
        '</div><div class="tpu-tid">' + tpuStaplar(l, r, o) + "</div></div>").join("");
    return '<section class="tpu-sida" style="width:' + tpuMm(l.W) + ";height:" + tpuMm(l.H) + ";--tpu-tab:" + tpuMm(l.tabB) + ";--rh:" + tpuMm(l.rh) + ";--ah:" + tpuMm(l.axelH) + '">' + tpuHuvud(o, sida, antal) +
        (rader.length || !medExtra ? '<div class="tpu-plan">' + tabHuvud + '<div class="tpu-kropp">' + tpuBakgrund(l, hojdRader, o) + rad + tpuSamband(l, o, rader) + tpuAvstamning(l, o, rader) + "</div></div>" : "") +
        (medExtra && o.resurser && l.behov.size ? '<div class="tpu-plan tpu-resplan">' + (rader.length ? "" : tabHuvud) + tpuResurser(l) + "</div>" : "") +
        (medExtra && o.forklaring ? tpuForklaring(l) : "") + "</section>";
}

function tpSkrivUt(o) {
    const l = tpuLayout(o), sidor = l.sidLista, antal = l.sidor;
    let html = "", nr = 0;
    sidor.forEach((rader, i) => {
        const sista = i === sidor.length - 1;
        html += tpuSidHtml(l, o, rader, nr, i + 1, antal, sista && !l.extraSida);
        nr += rader.length;
    });
    if (l.extraSida) html += tpuSidHtml(l, o, [], nr, antal, antal, true);
    const [pb, ph] = TPU_PAPPER[o.papper] || TPU_PAPPER.A3, [bw, bh] = o.liggande ? [pb, ph] : [ph, pb];
    document.getElementById("utskrift").innerHTML = '<div class="tpu">' + html + "</div>";
    let st = document.getElementById("sidstil");
    if (!st) { st = document.createElement("style"); st.id = "sidstil"; document.head.appendChild(st); }
    st.textContent = "@page{size:" + bw + "mm " + bh + "mm;margin:10mm 10mm 14mm}";
    window.print();
}
