/* ======================================================================
   Wimo · kalendermotor för tidplanen
   Arbetsdagar, svenska helgdagar, projektets lediga dagar och semestrar.

   Regler (gäller hela tidplanen):
   1. Datum är text "ÅÅÅÅ-MM-DD" och räknas som lokala dagar – aldrig klockslag, så inga tidszonsfel.
   2. Start och slut räknas in: start måndag + 5 arbetsdagar = slut fredag samma vecka.
   3. En period sparar start + antal arbetsdagar. Slutdatumet räknas fram ur projektets kalender.
   4. En flytt behåller antalet arbetsdagar; slutet skjuts över helger och lediga dagar.
   5. En start på en ledig dag läggs på nästa arbetsdag (det visas, sker aldrig i det tysta).
   6. Ändras projektkalendern behåller perioderna sina arbetsdagar, och slutdatumen räknas om.
   ====================================================================== */

// Påskdagen (gregoriansk kalender, Meeus/Jones/Butcher).
function paskdagen(ar) {
    const a = ar % 19, b = Math.floor(ar / 100), c = ar % 100, d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const man = Math.floor((h + l - 7 * m + 114) / 31), dag = ((h + l - 7 * m + 114) % 31) + 1;
    return ar + "-" + String(man).padStart(2, "0") + "-" + String(dag).padStart(2, "0");
}

// Den dag i intervallet [fran, till] (samma månad) som är veckodagen vd (0 = söndag … 6 = lördag).
function veckodagMellan(ar, man, fran, till, vd) {
    for (let d = fran; d <= till; d++) {
        const iso = ar + "-" + String(man).padStart(2, "0") + "-" + String(d).padStart(2, "0");
        if (iso2d(iso).getDay() === vd) return iso;
    }
    return null;
}

const HELGDAG_CACHE = new Map();
// Svenska helgdagar ett visst år: Map iso → namn. Aftnarna (jul, midsommar, nyår) är inte
// officiella helgdagar men lediga enligt byggavtalet, och räknas därför också som lediga.
function svenskaHelgdagar(ar) {
    if (HELGDAG_CACHE.has(ar)) return HELGDAG_CACHE.get(ar);
    const m = new Map(), f = (mm, dd) => ar + "-" + String(mm).padStart(2, "0") + "-" + String(dd).padStart(2, "0");
    const pask = paskdagen(ar);
    m.set(f(1, 1), "Nyårsdagen");
    m.set(f(1, 6), "Trettondedag jul");
    m.set(plus(pask, -2), "Långfredagen");
    m.set(pask, "Påskdagen");
    m.set(plus(pask, 1), "Annandag påsk");
    m.set(f(5, 1), "Första maj");
    m.set(plus(pask, 39), "Kristi himmelsfärdsdag");
    m.set(plus(pask, 49), "Pingstdagen");
    m.set(f(6, 6), "Sveriges nationaldag");
    m.set(veckodagMellan(ar, 6, 19, 25, 5), "Midsommarafton");
    m.set(veckodagMellan(ar, 6, 20, 26, 6), "Midsommardagen");
    const ah = veckodagMellan(ar, 10, 31, 31, 6) || veckodagMellan(ar, 11, 1, 6, 6);
    m.set(ah, "Alla helgons dag");
    m.set(f(12, 24), "Julafton");
    m.set(f(12, 25), "Juldagen");
    m.set(f(12, 26), "Annandag jul");
    m.set(f(12, 31), "Nyårsafton");
    HELGDAG_CACHE.set(ar, m);
    return m;
}

const KAL_VECKA_STD = [1, 2, 3, 4, 5];   // ISO-veckodagar: 1 = måndag … 7 = söndag

// Projektets kalenderinställningar med standardvärden.
function kalInst(k) {
    k = k && typeof k === "object" ? k : {};
    const vecka = Array.isArray(k.arbetsveckan) && k.arbetsveckan.length ? k.arbetsveckan.filter(n => n >= 1 && n <= 7) : KAL_VECKA_STD;
    return {
        arbetsveckan: vecka.length ? vecka : KAL_VECKA_STD,
        arbTimmarPerDag: k.arbTimmarPerDag > 0 ? k.arbTimmarPerDag : 8,
        helgdagar: k.helgdagar === false ? false : true,
        ledigaDagar: Array.isArray(k.ledigaDagar) ? k.ledigaDagar.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)) : [],
        semestrar: Array.isArray(k.semestrar) ? k.semestrar.filter(s => s && /^\d{4}-\d{2}-\d{2}$/.test(s.fran) && /^\d{4}-\d{2}-\d{2}$/.test(s.till) && s.fran <= s.till) : []
    };
}

// En kalender att räkna med. Bygg en ny när inställningarna ändras.
function skapaKalender(k) {
    const inst = kalInst(k);
    const vecka = new Set(inst.arbetsveckan), ledig = new Set(inst.ledigaDagar), cache = new Map();
    const iso1 = (iso) => { const v = iso2d(iso).getDay(); return v === 0 ? 7 : v; };
    // Varför dagen är ledig, eller null för en arbetsdag.
    function ledigtSkal(iso) {
        if (cache.has(iso)) return cache.get(iso);
        let s = null;
        if (!vecka.has(iso1(iso))) s = "helg";
        else if (inst.helgdagar && svenskaHelgdagar(+iso.slice(0, 4)).has(iso)) s = svenskaHelgdagar(+iso.slice(0, 4)).get(iso);
        else if (ledig.has(iso)) s = "Ledig dag";
        else { const sem = inst.semestrar.find(x => iso >= x.fran && iso <= x.till); if (sem) s = sem.namn || "Semester"; }
        cache.set(iso, s);
        return s;
    }
    const arArbetsdag = (iso) => ledigtSkal(iso) === null;
    // Första arbetsdagen på eller efter (riktning 1) / före (riktning -1) iso.
    function narmasteArbetsdag(iso, riktning) {
        let d = iso, n = 0;
        while (!arArbetsdag(d) && n++ < 400) d = plus(d, riktning < 0 ? -1 : 1);
        return d;
    }
    // n arbetsdagar framåt (n > 0) eller bakåt (n < 0) från en arbetsdag. n = 0 ger samma dag.
    function skifta(iso, n) {
        let d = iso, kvar = Math.abs(n), steg = n < 0 ? -1 : 1, varv = 0;
        while (kvar > 0 && varv++ < 20000) {
            d = plus(d, steg);
            if (arArbetsdag(d)) kvar--;
        }
        return d;
    }
    // Sista arbetsdagen i en period: start räknas som dag 1.
    const slut = (start, arbDagar) => skifta(narmasteArbetsdag(start, 1), Math.max(1, arbDagar) - 1);
    // Antal arbetsdagar från a till och med b (båda räknas in om de är arbetsdagar). 0 om b < a.
    function arbetsdagar(a, b) {
        if (b < a) return 0;
        let d = a, n = 0, varv = 0;
        while (d <= b && varv++ < 20000) { if (arArbetsdag(d)) n++; d = plus(d, 1); }
        return n;
    }
    // Lista med arbetsdagarna i en period.
    function dagarI(start, arbDagar) {
        const ut = [];
        let d = narmasteArbetsdag(start, 1);
        for (let i = 0; i < Math.max(1, arbDagar); i++) { ut.push(d); if (i < arbDagar - 1) d = skifta(d, 1); }
        return ut;
    }
    return { inst, arArbetsdag, ledigtSkal, narmasteArbetsdag, skifta, slut, arbetsdagar, dagarI };
}

// Vilka perioder får nytt slutdatum om kalendern ändras från gammal till ny? (Regel 6.)
function kalPaverkan(aktiviteter, gammal, ny) {
    const ka = skapaKalender(gammal), kb = skapaKalender(ny), ut = [];
    (aktiviteter || []).forEach(a => (a.perioder || []).forEach(q => {
        const s1 = ka.slut(q.start, q.arbDagar), s2 = kb.slut(q.start, q.arbDagar);
        const st1 = ka.narmasteArbetsdag(q.start, 1), st2 = kb.narmasteArbetsdag(q.start, 1);
        if (s1 !== s2 || st1 !== st2) ut.push({ aktivitet: a, period: q, fore: s1, efter: s2, startFore: st1, startEfter: st2 });
    }));
    return ut;
}

if (typeof module !== "undefined") module.exports = { paskdagen, svenskaHelgdagar, kalInst, skapaKalender, kalPaverkan };
