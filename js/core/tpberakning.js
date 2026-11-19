/* ======================================================================
   Wimo · tidplanens beräkningar: gruppspann, bemanning, resurser och timmar
   Inget gränssnitt här – allt kan testas utan webbläsare (tests/tidplan.test.js).

   Bemanning på en period:  period.bemanning = [{ resursTyp, segment: [{ franDag, antal }] }]
   - franDag är arbetsdag nummer i perioden (1 = första). Ett segment gäller från sin dag
     till dagen före nästa segment, så bemanningen följer med när perioden flyttas.
   - Fast bemanning = ett segment från dag 1.
   - Förlängs perioden gäller sista segmentet även de nya dagarna (det sägs till i gränssnittet).
     Förkortas den räknas segment som börjar efter sista dagen inte med.
   Persondagar = summan av antal personer per arbetsdag. Timmar = persondagar × timmar per dag.
   Avvikelse = planerat − kalkylerat: positiv betyder att planen kräver mer än kalkylen.
   ====================================================================== */

// Barn per förälder och alla underaktiviteter (i alla led) till en aktivitet.
function tpBarnKarta(aktiviteter) {
    const m = new Map();
    (aktiviteter || []).forEach(a => {
        const f = a.foralder || null;
        if (!m.has(f)) m.set(f, []);
        m.get(f).push(a);
    });
    return m;
}
function tpEttLed(barn, id) { return barn.get(id) || []; }
function tpAllaUnder(barn, id) {
    const ut = [], ko = [...tpEttLed(barn, id)];
    while (ko.length) { const a = ko.shift(); ut.push(a); ko.push(...tpEttLed(barn, a.id)); }
    return ut;
}

// Gruppens spann: första start till sista slut för egna perioder och alla underaktiviteters.
// Perioder med utanforSammanstallning räknas inte (förberett för undantag som i Byggsamordnaren).
function tpSpann(kal, barn, a) {
    let fran = null, till = null;
    [a].concat(tpAllaUnder(barn, a.id)).forEach(x => (x.perioder || []).forEach(q => {
        if (q.utanforSammanstallning) return;
        const s = kal.narmasteArbetsdag(q.start, 1), e = kal.slut(q.start, q.arbDagar);
        if (fran === null || s < fran) fran = s;
        if (till === null || e > till) till = e;
    }));
    return fran ? { fran, till } : null;
}

// Antal personer per arbetsdag (index 1…arbDagar) för en bemanningsrad.
function tpSegmentAntal(segment, dagNr) {
    let antal = 0;
    (segment || []).slice().sort((x, y) => x.franDag - y.franDag).forEach(s => { if (s.franDag <= dagNr) antal = Math.max(0, +s.antal || 0); });
    return antal;
}
// Bemanningen dag för dag: [{ dag: iso, typ, antal }]
function tpPeriodDagar(kal, q) {
    const dagar = kal.dagarI(q.start, q.arbDagar), ut = [];
    (q.bemanning || []).forEach(b => {
        if (!b || !b.resursTyp) return;
        dagar.forEach((d, i) => { const n = tpSegmentAntal(b.segment, i + 1); if (n) ut.push({ dag: d, typ: b.resursTyp, antal: n }); });
    });
    return ut;
}
// Persondagar för en period, per resurstyp och totalt.
function tpPeriodPersondagar(kal, q) {
    const per = {};
    let tot = 0;
    tpPeriodDagar(kal, q).forEach(x => { per[x.typ] = (per[x.typ] || 0) + x.antal; tot += x.antal; });
    return { per, tot };
}
// Har bemanningen fler än ett segment (varierande)?
const tpVarierande = (b) => !!b && Array.isArray(b.segment) && b.segment.length > 1;

// Resursbehov för hela tidplanen: Map typ → { perDag: Map iso → antal, persondagar, max, maxDag }.
// hoppa(a, q) = true utelämnar en period (används medan den dras, då den läggs till med nya datum).
function tpResursbehov(kal, aktiviteter, hoppa, extra) {
    const m = new Map();
    const lagg = (x) => {
        if (!m.has(x.typ)) m.set(x.typ, { perDag: new Map(), persondagar: 0, max: 0, maxDag: null });
        const r = m.get(x.typ);
        const n = (r.perDag.get(x.dag) || 0) + x.antal;
        r.perDag.set(x.dag, n);
        r.persondagar += x.antal;
        if (n > r.max) { r.max = n; r.maxDag = x.dag; }
    };
    (aktiviteter || []).forEach(a => (a.perioder || []).forEach(q => {
        if (hoppa && hoppa(a, q)) return;
        tpPeriodDagar(kal, q).forEach(lagg);
    }));
    (extra || []).forEach(q => tpPeriodDagar(kal, q).forEach(lagg));
    return m;
}

// Planerade timmar för en aktivitet (egna perioder; med grupp = även underaktiviteterna).
function tpPlaneradePersondagar(kal, barn, a, medUnder) {
    let n = 0;
    (medUnder ? [a].concat(tpAllaUnder(barn, a.id)) : [a]).forEach(x => (x.perioder || []).forEach(q => { n += tpPeriodPersondagar(kal, q).tot; }));
    return n;
}
function tpPlaneradeTimmar(kal, barn, a, medUnder) { return tpPlaneradePersondagar(kal, barn, a, medUnder) * kal.inst.arbTimmarPerDag; }
// Kalkylerade timmar: egna, eller för en grupp utan egna summan av underaktiviteternas.
function tpKalkTimmar(barn, a) {
    if (typeof a.kalkTimmar === "number") return a.kalkTimmar;
    const under = tpAllaUnder(barn, a.id).filter(x => typeof x.kalkTimmar === "number" && !tpAllaUnder(barn, x.id).some(y => typeof y.kalkTimmar === "number"));
    return under.length ? under.reduce((s, x) => s + x.kalkTimmar, 0) : null;
}
// Avvikelse planerat mot kalkylerat. null om något saknas.
function tpAvvikelse(kalk, plan) {
    if (typeof kalk !== "number" || typeof plan !== "number" || !(plan > 0)) return null;
    const timmar = plan - kalk;
    return { timmar, procent: kalk > 0 ? timmar / kalk * 100 : null };
}

// Beräkningshjälp: förslag, skriver aldrig över planeringen.
function tpPersonerFor(timmar, arbDagar, tPerDag) { return timmar > 0 && arbDagar > 0 && tPerDag > 0 ? timmar / (arbDagar * tPerDag) : null; }
function tpDagarFor(timmar, antal, tPerDag) { return timmar > 0 && antal > 0 && tPerDag > 0 ? timmar / (antal * tPerDag) : null; }

// Fast bemanning med ett antal, eller ändrade segment. Rensar tomma och sorterar.
function tpRensaBemanning(bemanning, arbDagar) {
    return (bemanning || []).filter(b => b && b.resursTyp).map(b => {
        const seg = (b.segment || []).map(s => ({ franDag: Math.max(1, Math.round(+s.franDag) || 1), antal: Math.max(0, Math.round((+s.antal || 0) * 10) / 10) }))
            .sort((x, y) => x.franDag - y.franDag).filter((s, i, l) => i === 0 || s.franDag !== l[i - 1].franDag);
        if (seg.length) seg[0].franDag = 1;
        return { resursTyp: b.resursTyp, segment: seg.length ? seg : [{ franDag: 1, antal: 0 }] };
    });
}
// Segment som inte längre ryms när perioden kortats (för att kunna säga till).
function tpSegmentUtanfor(bemanning, arbDagar) {
    let n = 0;
    (bemanning || []).forEach(b => (b.segment || []).forEach(s => { if (s.franDag > arbDagar) n++; }));
    return n;
}

if (typeof module !== "undefined") module.exports = { tpBarnKarta, tpSpann, tpResursbehov, tpPeriodPersondagar, tpAvvikelse };

/* ---------- framdrift, baslinje och avstämning ---------- */

// Klart i procent (0–100). Saknas värdet räknas det som 0.
const tpKlart = (a) => typeof a.klart === "number" && isFinite(a.klart) ? Math.max(0, Math.min(100, a.klart)) : 0;

// Alla arbetsdagar i en aktivitets egna perioder, sorterade och utan dubbletter.
function tpArbetsdagLista(kal, perioder) {
    const s = new Set();
    (perioder || []).forEach(q => kal.dagarI(q.start, q.arbDagar).forEach(d => s.add(d)));
    return [...s].sort();
}

// En grupps framdrift: varje aktivitet med perioder (även gruppens egna) vägs med sina arbetsdagar.
function tpGruppKlart(kal, barn, a) {
    let tot = 0, klar = 0;
    [a].concat(tpAllaUnder(barn, a.id)).forEach(x => {
        const n = tpArbetsdagLista(kal, x.perioder).length;
        if (!n) return;
        tot += n; klar += n * tpKlart(x) / 100;
    });
    return tot ? klar / tot * 100 : null;
}

// Var framdriften står bland aktivitetens arbetsdagar: { dag, del } där del (0–1) är hur långt in i dagen.
function tpFramdriftsPunkt(dagar, klart) {
    if (!dagar.length) return null;
    const t = klart / 100 * dagar.length;
    if (t <= 0) return { dag: dagar[0], del: 0 };
    if (t >= dagar.length) return { dag: dagar[dagar.length - 1], del: 1 };
    const i = Math.ceil(t) - 1;
    return { dag: dagar[i], del: t - i };
}

// Hur mycket som borde vara klart vid avstämningsdatumet: andelen arbetsdagar före datumet.
function tpForvantatKlart(dagar, datum) {
    if (!dagar.length) return null;
    return dagar.filter(d => d < datum).length / dagar.length * 100;
}

// Ska aktiviteten bryta avstämningslinjen? Pågående och försenade gör det, och de som ligger före.
// Klara aktiviteter i det förflutna och ej påbörjade framtida aktiviteter ligger på linjen.
function tpIAvstamning(dagar, klart, datum) {
    if (!dagar.length) return false;
    if (klart >= 100) return dagar[dagar.length - 1] >= datum;
    if (dagar[0] >= datum) return klart > 0;
    return true;
}

// Baslinje: en ögonblicksbild av alla perioders start och längd.
function tpNyBaslinje(aktiviteter, namn, tid, genId) {
    const perioder = {};
    (aktiviteter || []).forEach(a => {
        const p = (a.perioder || []).map(q => [q.start, q.arbDagar]);
        if (p.length) perioder[a.id] = p;
    });
    return { id: uid(genId), namn: namn, sparad: tid, perioder };
}
const tpBasPerioder = (bas, aid) => ((bas && bas.perioder && bas.perioder[aid]) || []).map(([start, arbDagar]) => ({ start, arbDagar }));

// Baslinjens spann för en aktivitet (med underaktiviteter om medUnder).
function tpBasSpann(kal, barn, bas, a, medUnder) {
    let fran = null, till = null;
    (medUnder ? [a].concat(tpAllaUnder(barn, a.id)) : [a]).forEach(x => tpBasPerioder(bas, x.id).forEach(q => {
        const s = kal.narmasteArbetsdag(q.start, 1), e = kal.slut(q.start, q.arbDagar);
        if (fran === null || s < fran) fran = s;
        if (till === null || e > till) till = e;
    }));
    return fran ? { fran, till } : null;
}

// Förskjutning i arbetsdagar mellan två datum: positivt = senare än baslinjen.
function tpForskjutning(kal, nu, bas) {
    if (!nu || !bas || nu === bas) return 0;
    return nu > bas ? kal.arbetsdagar(plus(bas, 1), nu) : -kal.arbetsdagar(plus(nu, 1), bas);
}

/* ---------- samband ---------- */
// Ett samband sparas hos efterföljaren: a.samband = [{ id, fran: föregångarens id, typ, glapp }].
// typ: "FS" slut–start (vanligast), "SS" start–start, "FF" slut–slut, "SF" start–slut.
// glapp: arbetsdagar emellan (negativt = överlapp). Inget flyttas automatiskt.
const TP_SAMBANDSTYPER = [["FS", "Slut → start"], ["SS", "Start → start"], ["FF", "Slut → slut"], ["SF", "Start → slut"]];
const tpSamband = (a) => Array.isArray(a && a.samband) ? a.samband.filter(s => s && s.fran && TP_SAMBANDSTYPER.some(t => t[0] === s.typ)) : [];

// Aktivitetens egna perioders spann (första arbetsdag – sista arbetsdag).
function tpEgetSpann(kal, a) {
    let fran = null, till = null;
    (a.perioder || []).forEach(q => {
        const s = kal.narmasteArbetsdag(q.start, 1), e = kal.slut(q.start, q.arbDagar);
        if (fran === null || s < fran) fran = s;
        if (till === null || e > till) till = e;
    });
    return fran ? { fran, till } : null;
}

// Arbetsdagar från a till b (positivt om b är senare). 0 om samma dag.
function tpArbDiff(kal, a, b) {
    if (a === b) return 0;
    return b > a ? kal.arbetsdagar(plus(a, 1), b) : -kal.arbetsdagar(plus(b, 1), a);
}

// Hur många arbetsdagar efterföljaren måste flyttas för att sambandet ska hålla (0 = det håller).
function tpSambandBehov(kal, fore, efter, s) {
    const f = tpEgetSpann(kal, fore), e = tpEgetSpann(kal, efter);
    if (!f || !e) return 0;
    const g = Math.round(s.glapp || 0);
    let krav, nu;
    if (s.typ === "FS") { krav = kal.skifta(f.till, 1 + g); nu = e.fran; }
    else if (s.typ === "SS") { krav = kal.skifta(f.fran, g); nu = e.fran; }
    else if (s.typ === "FF") { krav = kal.skifta(f.till, g); nu = e.till; }
    else { krav = kal.skifta(f.fran, g); nu = e.till; }   // SF
    return Math.max(0, tpArbDiff(kal, nu, krav));
}

// Alla samband som inte håller: [{ s, fore, efter, dagar }]
function tpSambandBrott(kal, aktiviteter) {
    const karta = new Map(aktiviteter.map(a => [a.id, a])), ut = [];
    aktiviteter.forEach(efter => tpSamband(efter).forEach(s => {
        const fore = karta.get(s.fran);
        if (!fore) return;
        const n = tpSambandBehov(kal, fore, efter, s);
        if (n > 0) ut.push({ s, fore, efter, dagar: n });
    }));
    return ut;
}

// Skulle ett samband fran → till ge en slinga? (till leder redan, direkt eller via andra, till fran)
function tpSambandSlinga(aktiviteter, fran, till) {
    if (fran === till) return true;
    const efter = new Map();
    aktiviteter.forEach(a => tpSamband(a).forEach(s => { if (!efter.has(s.fran)) efter.set(s.fran, []); efter.get(s.fran).push(a.id); }));
    const sett = new Set(), stack = [till];
    while (stack.length) {
        const x = stack.pop();
        if (x === fran) return true;
        if (sett.has(x)) continue;
        sett.add(x);
        (efter.get(x) || []).forEach(y => stack.push(y));
    }
    return false;
}

// Förslag på flyttar så att alla samband håller: varje aktivitet flyttas så lite som möjligt,
// i sambandsordning, och aldrig bakåt. Returnerar [{ a, dagar, perioder: [{ id, start }] }].
function tpSambandForslag(kal, aktiviteter, bara) {
    const karta = new Map(aktiviteter.map(a => [a.id, a]));
    const fore = new Map(), efter = new Map();
    aktiviteter.forEach(a => tpSamband(a).forEach(s => {
        if (!karta.has(s.fran)) return;
        if (!fore.has(a.id)) fore.set(a.id, []); fore.get(a.id).push(s);
        if (!efter.has(s.fran)) efter.set(s.fran, []); efter.get(s.fran).push(a.id);
    }));
    // topologisk ordning (Kahn); aktiviteter i en slinga hoppas över
    const inGrad = new Map(aktiviteter.map(a => [a.id, (fore.get(a.id) || []).length])), ko = aktiviteter.filter(a => !inGrad.get(a.id)).map(a => a.id), ordning = [];
    while (ko.length) {
        const id = ko.shift(); ordning.push(id);
        (efter.get(id) || []).forEach(y => { inGrad.set(y, inGrad.get(y) - 1); if (!inGrad.get(y)) ko.push(y); });
    }
    // bara: begränsa till aktiviteter nedströms från de angivna (t.ex. efterföljarna till en flyttad aktivitet)
    let tillatna = null;
    if (bara) {
        tillatna = new Set(); const stack = [...bara];
        while (stack.length) { const x = stack.pop(); if (tillatna.has(x)) continue; tillatna.add(x); (efter.get(x) || []).forEach(y => stack.push(y)); }
    }
    const nya = new Map(), ut = [];   // id → tillfällig kopia med nya perioder
    const hamta = (id) => nya.get(id) || karta.get(id);
    ordning.forEach(id => {
        const a = karta.get(id);
        if (tillatna && !tillatna.has(id)) return;
        let n = 0;
        (fore.get(id) || []).forEach(s => { n = Math.max(n, tpSambandBehov(kal, hamta(s.fran), a, s)); });
        if (!n) return;
        const perioder = (a.perioder || []).map(q => ({ id: q.id, start: kal.skifta(kal.narmasteArbetsdag(q.start, 1), n), arbDagar: q.arbDagar }));
        nya.set(id, Object.assign({}, a, { perioder }));
        ut.push({ a, dagar: n, perioder: perioder.map(q => ({ id: q.id, start: q.start })) });
    });
    return ut;
}
