/* ======================================================================
   Wimo · Tidplan: koppling till fyraveckorstavlan

   En period i tidplanen kan läggas ut på en tavla som ett moment:
   Start-post på första arbetsdagen och Klart-post på sista (en dag = en post),
   med aktivitetens namn, ansvarig och bemanning. Posterna får kortet.tp =
   { aid, qid } så att tidplanen hittar dem igen.

   Tavlan äger detaljerna. Ändras datum eller bemanning i tidplanen – eller
   flyttas momentet på tavlan – visas det som "ändrat", och man väljer själv
   åt vilket håll det ska uppdateras. Inget skrivs över automatiskt.
   ====================================================================== */

let tpTvCache = new Map();
function tpTvForbered() { tpTvCache = tpTvIndex(); }

// Alla poster på projektets tavlor som kommer från tidplanen: qid → { tavla, s, k, p }
function tpTvIndex() {
    const ut = new Map();
    ((state && state.tavlor) || []).forEach(t => (t.kort || []).forEach(k => {
        if (!k || !k.tp || !k.tp.qid) return;
        const r = ut.get(k.tp.qid) || { tavla: t, s: null, k: null, p: null, aid: k.tp.aid };
        if (k.roll === "S") r.s = k; else if (k.roll === "K") r.k = k; else if (k.roll === "P") r.p = k;
        ut.set(k.tp.qid, r);
    }));
    return ut;
}

// Vad tavlan borde visa för perioden enligt tidplanen.
function tpTvForvantat(a, q) {
    const kal = tpKal(), start = kal.narmasteArbetsdag(q.start, 1), slut = kal.slut(q.start, q.arbDagar);
    // bemanning: flest personer per yrkesgrupp under perioden
    const behov = (q.bemanning || []).filter(b => b.resursTyp).map(b => ({ kategoriId: b.resursTyp, antal: Math.max(0, ...(b.segment || []).map(s => s.antal || 0)) })).filter(b => b.antal > 0);
    const flera = (a.perioder || []).length > 1, nr = (a.perioder || []).indexOf(q) + 1;
    return { start, slut, behov, namn: (a.namn || "Aktivitet") + (flera ? " · del " + nr : ""), vem: a.ansvarig || "" };
}

const tpTvBehovText = (behov) => (behov || []).map(b => { const t = tpResTyper().find(x => x.id === b.kategoriId); return b.antal + " " + (t ? t.namn.toLowerCase() : "pers"); }).join(", ");
const tpTvSammaBehov = (x, y) => JSON.stringify((x || []).map(b => [b.kategoriId, b.antal]).sort()) === JSON.stringify((y || []).map(b => [b.kategoriId, b.antal]).sort());

// Läget för en period: ny (inte på tavlan), synk, andrad (datum/bemanning skiljer). klar = bockad på tavlan.
function tpTvLage(a, q, idx) {
    const v = tpTvForvantat(a, q), r = (idx || tpTvIndex()).get(q.id);
    if (!r || !(r.s || r.p)) return { typ: "ny", v };
    const bar = r.s || r.p, tavStart = bar.dag, tavSlut = r.k ? r.k.dag : bar.dag;
    const tavBehov = bar.bemanning ? bar.bemanning.behov || [] : [];
    const datum = tavStart !== v.start || tavSlut !== v.slut, bem = !tpTvSammaBehov(tavBehov, v.behov);
    const klar = !!(r.k ? r.k.klar : r.p && r.p.klar);
    return { typ: datum || bem ? "andrad" : "synk", v, r, tavStart, tavSlut, tavBehov, datum, bem, klar };
}

// Alla perioder med läge, valfritt bara de som ligger i [fran, till].
function tpTvRader(fran, till) {
    const idx = tpTvIndex(), ut = [];
    tpRaderAlla().forEach(rad => {
        if (rad.grupp && !(rad.a.perioder || []).length) return;
        (rad.a.perioder || []).forEach(q => {
            const l = tpTvLage(rad.a, q, idx);
            if (fran && till && l.typ === "ny" && (l.v.slut < fran || l.v.start > till)) return;
            ut.push({ a: rad.a, q, l });
        });
    });
    return ut;
}

/* ---------- ändra tavlan / tidplanen ---------- */

function tpTvLaggUt(lista, tavla) {
    let n = 0;
    tpKorSerie("Lade ut " + lista.length + (lista.length === 1 ? " moment" : " moment") + " på " + tavla.namn, (kor) => lista.forEach(({ a, q }) => {
        const v = tpTvForvantat(a, q), kedja = "k" + uid();
        const kort = v.start === v.slut
            ? [{ dag: v.start, typ: "produktion", roll: "P", text: v.namn, vem: v.vem, kedja }]
            : [{ dag: v.start, typ: "produktion", roll: "S", text: "Start " + v.namn, vem: v.vem, kedja }, { dag: v.slut, typ: "produktion", roll: "K", text: v.namn + " klart", vem: v.vem, kedja }];
        const patch = opGuideLaggUpp({ kort, text: v.namn, start: v.start, plats: "", bemanning: { behov: v.behov, personer: [] }, grund: [], forval: [], mtrl: [], hinder: [] }, tavla.id);
        if (!patch.ok) return;
        patch.andringar.forEach(c => { if (c.objekt === "kort" && c.varde) c.varde.tp = { aid: a.id, qid: q.id }; });
        if (kor(patch)) { n++; if (typeof logg2 === "function") logg2(tavla, "Lagt ut från tidplanen: " + v.namn + " " + kortDatum(v.start) + (v.slut !== v.start ? "–" + kortDatum(v.slut) : "")); }
    }));
    return n;
}

// Tidplanen → tavlan: flytta posterna och uppdatera bemanningen.
function tpTvUppdateraTavlan(lista) {
    let n = 0;
    tpKorSerie("Uppdaterade " + lista.length + " moment på tavlan", (kor) => lista.forEach(({ a, q }) => {
        const l = tpTvLage(a, q);
        if (l.typ !== "andrad") return;
        const r = l.r, bar = r.s || r.p, orsak = "Ändrad i tidplanen";
        let gjort = false;
        if (l.datum) {
            if (bar.dag !== l.v.start) gjort = kor(opFlyttaKort(bar, l.v.start, orsak)) || gjort;
            if (r.k && r.k.dag !== l.v.slut) gjort = kor(opFlyttaKort(r.k, l.v.slut, orsak)) || gjort;
            // en enda post (P) som blivit flera dagar får en Klart-post
            if (!r.k && l.v.slut !== l.v.start) {
                const p = opNyttKort({ dag: l.v.slut, typ: "produktion", roll: "K", text: l.v.namn + " klart", vem: l.v.vem, kedja: bar.kedja }, r.tavla.id);
                p.andringar[0].varde.tp = { aid: a.id, qid: q.id };
                gjort = kor(p) || gjort;
            }
        }
        if (l.bem) gjort = kor(opSattBemanning(bar, l.v.behov, bar.bemanning ? bar.bemanning.personer || [] : [])) || gjort;
        if (gjort) { n++; if (typeof logg2 === "function") logg2(r.tavla, "Uppdaterat från tidplanen: " + l.v.namn); }
    }));
    return n;
}

// Tavlan → tidplanen: periodens start och längd från momentets poster på tavlan.
function tpTvHamtaFranTavlan(lista) {
    const kal = tpKal();
    let n = 0;
    tpKorSerie("Hämtade datum från tavlan", (kor) => lista.forEach(({ a, q }) => {
        const l = tpTvLage(a, q);
        if (l.typ !== "andrad" || !l.datum) return;
        const dagar = Math.max(1, kal.arbetsdagar(l.tavStart, l.tavSlut));
        if (kor(opTpAndraPeriod(tpHitta(a.id), q.id, { start: l.tavStart, arbDagar: dagar }))) n++;
    }));
    return n;
}

function tpTvTaBortKoppling(qid) {
    const idx = tpTvIndex(), r = idx.get(qid);
    if (!r) return;
    tpKorSerie("Tog bort kopplingen till tavlan", (kor) => [r.s, r.k, r.p].filter(Boolean).forEach(k => kor(opSattTidplanKoppling(k, null, r.tavla.id))));
}

function tpTvVisaPaTavlan(qid) {
    const r = tpTvIndex().get(qid);
    if (!r) return;
    const k = r.s || r.p || r.k;
    stangTidplan();
    if (window.p4MarkeraNav) window.p4MarkeraNav();
    if (state.aktiv !== r.tavla.id) { state.aktiv = r.tavla.id; spara(); }
    const v = Math.floor((iso2d(k.dag) - iso2d(tavlaStart())) / 864e5 / 7);
    vyOffset = v >= 0 && v < 4 ? 0 : v;
    rita();
    if (typeof visaKort === "function") visaKort(k);
}

/* ---------- i tidplanen ---------- */

// Antal perioder som skiljer sig från tavlan (för knappen i verktygsraden).
function tpTvAntalAndrade() { let n = 0; tpAktiviteter(state).forEach(a => (a.perioder || []).forEach(q => { if (tpTvCache.has(q.id) && tpTvLage(a, q, tpTvCache).typ === "andrad") n++; })); return n; }

function tpTvKnapp() {
    const n = tpTvAntalAndrade();
    return '<button type="button" data-tpgor="tavla" title="Lägg ut perioder som moment på fyraveckorstavlan' + (n ? " · " + n + " skiljer sig från tavlan" : "") + '">Till tavlan' +
        (n ? ' <span class="tp-tvantal" aria-label="' + n + ' ändrade">' + n + "</span>" : "") + "</button>";
}

// Markering på en stapel som finns på tavlan.
function tpTvStapel(a, q, idx) {
    const r = idx.get(q.id);
    if (!r || !(r.s || r.p)) return { cls: "", titel: "", mark: "" };
    const l = tpTvLage(a, q, idx);
    const titel = "\nPå tavlan " + r.tavla.namn + (l.typ === "andrad" ? " · skiljer sig: tavlan " + kortDatum(l.tavStart) + (l.tavSlut !== l.tavStart ? "–" + kortDatum(l.tavSlut) : "") + (l.bem ? ", annan bemanning" : "") : " · samma som tidplanen") + (l.klar ? " · bockad klar" : "");
    return { cls: " pa-tavlan" + (l.typ === "andrad" ? " tavla-andrad" : ""), titel, mark: '<span class="tp-tvmark" aria-hidden="true"></span>' };
}

// Sektion i perioddialogen.
function tpTvPeriodDel(a, q) {
    const l = tpTvLage(a, q), kan = tpKanAndra(), tavlor = (state.tavlor || []);
    if (l.typ === "ny") {
        if (!kan || !tavlor.length) return '<p class="hjalp" style="margin:0">Inte utlagd på någon tavla.</p>';
        return '<div class="tp-tvdel"><span class="hjalp">Inte på tavlan än.</span>' +
            (tavlor.length > 1 ? '<select class="f" id="pdTavla" aria-label="Tavla">' + tavlor.map(t => '<option value="' + esc(t.id) + '"' + (t.id === state.aktiv ? " selected" : "") + ">" + esc(t.namn) + "</option>").join("") + "</select>" : "") +
            '<button type="button" class="mknapp" data-tv="laggut">Lägg ut som moment</button></div>';
    }
    const d = (s, e) => kortDatum(s) + (e !== s ? "–" + kortDatum(e) : "");
    return '<div class="tp-tvdel ' + l.typ + '"><span><b>' + esc(l.r.tavla.namn) + "</b> · " + d(l.tavStart, l.tavSlut) + (l.tavBehov.length ? " · " + esc(tpTvBehovText(l.tavBehov)) : "") + (l.klar ? ' · <span class="tp-tvklar">bockad klar</span>' : "") + "</span>" +
        (l.typ === "andrad" ? '<span class="tp-tvskiljer">Tidplanen: ' + d(l.v.start, l.v.slut) + (l.bem ? " · " + esc(tpTvBehovText(l.v.behov) || "ingen bemanning") : "") + "</span>" +
            (kan ? '<span class="tp-tvknappar"><button type="button" class="mknapp primar" data-tv="uppdatera">Uppdatera tavlan</button>' + (l.datum ? '<button type="button" class="mknapp" data-tv="hamta">Hämta datum från tavlan</button>' : "") + "</span>" : "") : "") +
        '<span class="tp-tvknappar"><button type="button" class="p4d-lank" data-tv="visa">Visa på tavlan</button>' + (kan ? '<button type="button" class="p4d-lank" data-tv="koppla-bort">Ta bort kopplingen</button>' : "") + "</span></div>";
}

function tpTvPeriodKoppla(rot, a, q, stang) {
    rot.addEventListener("click", (e) => {
        const b = e.target.closest("[data-tv]");
        if (!b) return;
        const typ = b.dataset.tv;
        if (typ === "visa") { stang(); return tpTvVisaPaTavlan(q.id); }
        stang();
        if (typ === "laggut") {
            const v = document.getElementById("pdTavla"), t = (state.tavlor || []).find(x => x.id === (v ? v.value : state.aktiv)) || state.tavlor[0];
            if (tpTvLaggUt([{ a, q }], t)) status((a.namn || "Aktiviteten") + " finns nu som moment på " + t.namn + " · Ctrl+Z ångrar");
        }
        if (typ === "uppdatera" && tpTvUppdateraTavlan([{ a, q }])) status("Tavlan uppdaterad · Ctrl+Z ångrar");
        if (typ === "hamta" && tpTvHamtaFranTavlan([{ a, q }])) status("Perioden har tavlans datum · Ctrl+Z ångrar");
        if (typ === "koppla-bort") { tpTvTaBortKoppling(q.id); status("Kopplingen är borttagen. Momentet finns kvar på tavlan."); }
    });
}

/* ---------- dialogen "Till tavlan" ---------- */

function tpTvDialog() {
    const tavlor = state.tavlor || [];
    if (!tavlor.length) return status("Projektet har ingen tavla än", true);
    const kan = tpKanAndra();
    // tavlans fyra veckor: från den här veckans måndag
    let fran = dennaVeckasMandag(IDAG), till = plus(fran, 4 * 7 - 3);
    let filter = "alla";
    const kropp = '<div class="tp-tvdlg">' +
        '<div class="tp-tvtopp"><label class="falt"><span>Från</span><input class="f" type="date" id="tvFran" value="' + fran + '"></label>' +
        '<label class="falt"><span>Till</span><input class="f" type="date" id="tvTill" value="' + till + '"></label>' +
        (tavlor.length > 1 ? '<label class="falt"><span>Nya moment till</span><select class="f" id="tvTavla">' + tavlor.map(t => '<option value="' + esc(t.id) + '"' + (t.id === state.aktiv ? " selected" : "") + ">" + esc(t.namn) + "</option>").join("") + "</select></label>" : "") +
        "</div>" +
        '<div class="tp-nav tp-tvfilter" role="radiogroup" aria-label="Visa"></div>' +
        '<div id="tvLista" class="tp-tvlista"></div><div id="tvSumma" class="tp-tvsumma"></div></div>';
    modal("Till fyraveckorstavlan", "Lägg ut perioder som moment på tavlan. Tavlan äger detaljerna – inget skrivs över utan att du väljer det.", kropp, [
        { txt: "Stäng", fn: stangModal },
        kan ? { txt: "Hämta datum från tavlan", id: "tvHamta", fn: () => kor("hamta") } : null,
        kan ? { txt: "Utför", primar: true, id: "tvUtfor", fn: () => kor("utfor") } : null
    ].filter(Boolean));
    const $ = (id) => document.getElementById(id);
    const valda = new Set();
    let rader = [];
    const rita = () => {
        fran = $("tvFran").value || fran; till = $("tvTill").value || till;
        rader = tpTvRader(fran, till).filter(x => x.l.typ !== "ny" ? (x.l.tavSlut >= fran && x.l.tavStart <= till) || (x.l.v.slut >= fran && x.l.v.start <= till) : true);
        const antal = { ny: 0, andrad: 0, synk: 0 };
        rader.forEach(x => antal[x.l.typ]++);
        document.querySelector("#overlay .tp-tvfilter").innerHTML = [["alla", "Alla", rader.length], ["ny", "Inte på tavlan", antal.ny], ["andrad", "Skiljer sig", antal.andrad], ["synk", "Samma", antal.synk]]
            .map(([k, n, c]) => '<button type="button" role="radio" data-tvf="' + k + '" class="' + (filter === k ? "vald" : "") + '" aria-checked="' + (filter === k) + '">' + n + ' <span class="tp-tvantal grå">' + c + "</span></button>").join("");
        const synliga = rader.filter(x => filter === "alla" || x.l.typ === filter);
        const d = (s, e) => kortDatum(s) + (e !== s ? "–" + kortDatum(e) : "");
        $("tvLista").innerHTML = synliga.length ? '<table class="lista"><thead><tr><th>' + (kan ? '<input type="checkbox" id="tvAlla" aria-label="Markera alla">' : "") + "</th><th>Aktivitet</th><th>Tidplanen</th><th>Tavlan</th><th>Läge</th></tr></thead><tbody>" +
            synliga.map(x => {
                const nyckel = x.q.id, l = x.l, kanVal = kan && l.typ !== "synk";
                return '<tr class="tv-' + l.typ + '"><td>' + (kanVal ? '<input type="checkbox" data-tvq="' + esc(nyckel) + '"' + (valda.has(nyckel) ? " checked" : "") + ' aria-label="Välj ' + esc(l.v.namn) + '">' : "") + "</td>" +
                    "<td><b>" + esc(l.v.namn) + "</b>" + (l.v.behov.length ? '<small>' + esc(tpTvBehovText(l.v.behov)) + "</small>" : "") + "</td>" +
                    "<td>" + d(l.v.start, l.v.slut) + "</td>" +
                    "<td>" + (l.typ === "ny" ? '<span class="hjalp">–</span>' : esc(l.r.tavla.namn) + " " + d(l.tavStart, l.tavSlut) + (l.bem ? '<small>' + esc(tpTvBehovText(l.tavBehov) || "ingen bemanning") + "</small>" : "")) + "</td>" +
                    '<td><span class="tp-tvlage ' + l.typ + '">' + (l.typ === "ny" ? "Inte på tavlan" : l.typ === "andrad" ? (l.datum && l.bem ? "Datum och bemanning" : l.datum ? "Datum skiljer" : "Bemanning skiljer") : "Samma") + "</span>" + (l.klar ? ' <span class="tp-tvklar">klar</span>' : "") + "</td></tr>";
            }).join("") + "</tbody></table>"
            : '<p class="hjalp" style="margin:12px 0">Inga perioder ' + (filter === "alla" ? "mellan " + kortDatum(fran) + " och " + kortDatum(till) : "här") + ".</p>";
        summa();
    };
    const summa = () => {
        const val = rader.filter(x => valda.has(x.q.id)), ny = val.filter(x => x.l.typ === "ny").length, an = val.filter(x => x.l.typ === "andrad").length;
        const hamtbara = val.filter(x => x.l.typ === "andrad" && x.l.datum).length;
        $("tvSumma").innerHTML = val.length ? "<b>" + val.length + " valda</b>" + (ny ? " · " + ny + " läggs ut som nya moment" : "") + (an ? " · " + an + " uppdateras på tavlan" : "") : '<span class="hjalp">Markera de perioder du vill lägga ut eller uppdatera.</span>';
        const u = $("tvUtfor"), h = $("tvHamta");
        if (u) { u.disabled = !(ny || an); u.textContent = ny && an ? "Lägg ut " + ny + " och uppdatera " + an : ny ? "Lägg ut " + ny + (ny === 1 ? " moment" : " moment") : an ? "Uppdatera " + an + " på tavlan" : "Utför"; }
        if (h) { h.disabled = !hamtbara; h.title = hamtbara ? "Tidplanens perioder får tavlans datum" : "Markera perioder vars datum skiljer sig"; }
    };
    // förval: allt som inte finns eller skiljer sig
    tpTvRader(fran, till).forEach(x => { if (x.l.typ !== "synk") valda.add(x.q.id); });
    const rot = document.querySelector("#overlay .tp-tvdlg");
    rot.addEventListener("change", (e) => {
        if (e.target.id === "tvFran" || e.target.id === "tvTill") return rita();
        if (e.target.id === "tvAlla") { rader.filter(x => x.l.typ !== "synk" && (filter === "alla" || x.l.typ === filter)).forEach(x => e.target.checked ? valda.add(x.q.id) : valda.delete(x.q.id)); return rita(); }
        if (e.target.dataset.tvq) { e.target.checked ? valda.add(e.target.dataset.tvq) : valda.delete(e.target.dataset.tvq); summa(); }
    });
    rot.addEventListener("click", (e) => { const f = e.target.closest("[data-tvf]"); if (f) { filter = f.dataset.tvf; rita(); } });
    function kor(vad) {
        const val = rader.filter(x => valda.has(x.q.id));
        stangModal();
        if (vad === "hamta") {
            const n = tpTvHamtaFranTavlan(val.filter(x => x.l.typ === "andrad"));
            return status(n + (n === 1 ? " period fick" : " perioder fick") + " tavlans datum · Ctrl+Z ångrar");
        }
        const tv = $("tvTavla"), t = tv ? tavlor.find(x => x.id === tv.value) : (tavlor.find(x => x.id === state.aktiv) || tavlor[0]);
        const nya = val.filter(x => x.l.typ === "ny"), andr = val.filter(x => x.l.typ === "andrad");
        const n1 = nya.length ? tpTvLaggUt(nya, t) : 0, n2 = andr.length ? tpTvUppdateraTavlan(andr) : 0;
        status([n1 ? n1 + " moment lagda på " + t.namn : "", n2 ? n2 + " uppdaterade" : ""].filter(Boolean).join(" · ") + " · Ctrl+Z ångrar");
    }
    rita();
}

/* ---------- på tavlan: posten kommer från tidplanen ---------- */

function tpTvKortInfo(k) {
    if (!k || !k.tp || !k.tp.aid) return "";
    const a = state.tidplan && (state.tidplan.aktiviteter || []).find(x => x.id === k.tp.aid);
    if (!a) return '<div class="tp-tvfran"><span>Kom från tidplanen (aktiviteten finns inte längre)</span></div>';
    const q = (a.perioder || []).find(x => x.id === k.tp.qid), l = q ? tpTvLage(a, q) : null;
    return '<div class="tp-tvfran"><span>Från tidplanen: <b>' + esc(a.namn || "Aktivitet") + "</b>" + (l && l.typ === "andrad" ? ' · <span class="tp-tvskiljer">tidplanen har ' + kortDatum(l.v.start) + (l.v.slut !== l.v.start ? "–" + kortDatum(l.v.slut) : "") + "</span>" : "") + "</span>" +
        '<button type="button" class="p4d-lank" data-tvoppna="' + esc(a.id) + '">Öppna i tidplanen</button></div>';
}

document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tvoppna]");
    if (!b) return;
    const aid = b.dataset.tvoppna;
    stangModal();
    oppnaTidplan();
    if (typeof tpFokus === "function") setTimeout(() => tpFokus(aid, "namn"), 30);
});
