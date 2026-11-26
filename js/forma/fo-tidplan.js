/* ======================================================================
   Wimo Forma · Tidplaner (steg 7)

   Samma arbetssätt som tidplanen i Wimo Plan: tabell till vänster som
   redigeras direkt i raderna (Enter sparar och går nedåt, Tab åt höger,
   Esc avbryter), Gantt-schema till höger med staplar som dras och
   förlängs, zoom dag/vecka/månad, grupper som fälls ihop, ångra/gör om.
   Formen (CSS-klasserna tp-*) är Plans, datamodellen är helt Formas egen:
   ingen koppling, synkning eller delad data med Wimo Plan.

   Datamodell (p.tidplaner[]):
     { id, namn, typ: "klassisk" | "aktiv", lage: "utkast" | "faststalld", revPagar,
       rader: [...]            arbetsversionen (utkast eller pågående revidering)
       gallande: { rev, tid, av, anledning, andringar, rader }   fastställd, gäller
       revisioner: [ samma form ]                                 alla publicerade
       uppf: { radId: { lage, prognos, utfall, konsekvens, kommentar, tid, av } }
       uhist: [ { rad, text, tid, av } ]  uppföljningens historik
       fria: [iso]  arbetsfria dagar utöver helger
       omplanering: "forslag" | "auto" }
   Rad: { id, namn, niva, typ: "akt" | "mil", start, slut, ansv, aktiv, resultat, fore: [id], farg }
   En rad med rader under sig (högre nivå direkt efter) är en grupp; gruppens datum räknas fram.

   Uppföljning (prognos, utfall, risk) ändrar aldrig fastställda datum.
   Bara projekteringsledare/administratör/superuser ändrar tidplanens innehåll.
   ====================================================================== */

const FO_TP_ANGRA_IK = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 4 3.5 8l4 4"/><path d="M3.5 8h8a5 5 0 0 1 0 10H9"/></svg>';
const FO_TP_GOROM_IK = '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12.5 4 4 4-4 4"/><path d="M16.5 8h-8a5 5 0 0 0 0 10H11"/></svg>';
/* ---------- kalender: arbetsdagar ---------- */
function foTpArb(tp, iso) { const d = new Date(iso + "T12:00:00").getDay(); return d !== 0 && d !== 6 && !(tp.fria || []).includes(iso); }
function foTpPlus(iso, n) { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function foTpNasta(tp, iso, rikt) { let d = iso, n = 0; while (!foTpArb(tp, d) && n++ < 60) d = foTpPlus(d, rikt || 1); return d; }
// längd i arbetsdagar (start och slut räknas med)
function foTpDagar(tp, start, slut) {
    if (!start || !slut || slut < start) return 0;
    let n = 0, d = start, s = 0;
    while (d <= slut && s++ < 4000) { if (foTpArb(tp, d)) n++; d = foTpPlus(d, 1); }
    return n;
}
// slutdatum för en aktivitet som börjar start och tar n arbetsdagar
function foTpSlutAv(tp, start, n) {
    let d = foTpNasta(tp, start, 1), k = 1, s = 0;
    while (k < Math.max(1, n) && s++ < 4000) { d = foTpPlus(d, 1); if (foTpArb(tp, d)) k++; }
    return d;
}
function foTpArbPlus(tp, iso, n) {
    let d = iso, k = 0, s = 0, steg = n < 0 ? -1 : 1;
    while (k < Math.abs(n) && s++ < 4000) { d = foTpPlus(d, steg); if (foTpArb(tp, d)) k++; }
    return d;
}

/* ---------- uppslag ---------- */
function foTp(p, id) { return (p.tidplaner || []).find(t => t.id === id) || null; }
function foTpLedare(p, personId) { return !personId || foKanLeda(p, personId) || foSuper(p, personId); }
// raderna som visas: arbetsversionen under utkast/revidering, annars den fastställda
function foTpVisade(tp) { return tp.lage === "faststalld" && !tp.revPagar && tp.gallande ? tp.gallande.rader : tp.rader; }
function foTpRedigerbar(tp) { return tp.lage === "utkast" || tp.revPagar; }
// grupper och framräknade datum
function foTpStruktur(rader) {
    const ut = rader.map((r, i) => ({ r, i, grupp: !!(rader[i + 1] && (rader[i + 1].niva || 0) > (r.niva || 0)) }));
    for (let i = ut.length - 1; i >= 0; i--) {
        const x = ut[i];
        if (!x.grupp) { x.start = x.r.start; x.slut = x.r.typ === "mil" ? x.r.start : x.r.slut; continue; }
        let s = "", e = "";
        for (let j = i + 1; j < ut.length && (ut[j].r.niva || 0) > (x.r.niva || 0); j++) {
            if (ut[j].start && (!s || ut[j].start < s)) s = ut[j].start;
            if (ut[j].slut && (!e || ut[j].slut > e)) e = ut[j].slut;
        }
        x.start = s; x.slut = e;
    }
    return ut;
}

/* ---------- status för en rad i den fastställda tidplanen ----------
   Skiljer på verkliga förseningar och avsaknad av återrapportering. */
const FO_TP_LAGE = {
    klar: { namn: "Klar", kl: "klar" }, plan: { namn: "Enligt plan", kl: "besvarad" }, ej: { namn: "Ej bedömd", kl: "fo-tp-ej" },
    risk: { namn: "Risk för försening", kl: "ofullstandig" }, sen: { namn: "Konstaterad försening", kl: "obesvarad fo-tp-sen" },
    passerad: { namn: "Passerat – ej bekräftad", kl: "ofullstandig fo-tp-pass" }
};
const FO_TP_KONS = { "": "Konsekvens ej bedömd", ingen: "Ingen bedömd följdpåverkan", hanterbar: "Påverkan finns men hanterbar", risk: "Risk för påverkan på viktig leverans" };
function foTpStatus(tp, rad, idag) {
    const u = (tp.uppf || {})[rad.id] || {};
    if (u.utfall) return "klar";
    if (u.lage === "sen") return "sen";
    const slut = rad.typ === "mil" ? rad.start : rad.slut;
    if (slut && slut < (idag || foIdag())) return "passerad";
    if (u.lage === "risk" || (u.prognos && slut && u.prognos > slut)) return "risk";
    if (u.lage === "plan") return "plan";
    return "ej";
}
// Leveranser: aktiva rader i den fastställda tidplanen (eller alla rader i en aktiv tidplan som har ansvarig)
function foTpLeveranser(p, idag) {
    idag = idag || foIdag();
    const ut = [];
    (p.tidplaner || []).forEach(tp => {
        if (tp.borttagen || !tp.gallande) return;
        foTpStruktur(tp.gallande.rader).forEach(x => {
            if (x.grupp || !(x.r.aktiv || (tp.typ === "aktiv" && x.r.ansv))) return;
            const slut = x.r.typ === "mil" ? x.r.start : x.r.slut;
            ut.push({ tp, rad: x.r, slut, status: foTpStatus(tp, x.r, idag), u: (tp.uppf || {})[x.r.id] || {} });
        });
    });
    return ut;
}

/* ---------- operationer ---------- */
function foTpKravLeda(p, ctx) { foKrav(foTpLedare(p, ctx.av), "Det är projekteringsledaren som äger tidplanen. Du kan rapportera prognos, risk och genomförd leverans."); }
function foTpKravRedig(tp) { foKrav(tp, "Tidplanen finns inte."); foKrav(foTpRedigerbar(tp), "Tidplanen är fastställd. Starta en revidering för att ändra den."); }
function foTpRensaRad(r) {
    const ut = { id: r.id, namn: String(r.namn || "").trim().slice(0, 200), niva: Math.max(0, Math.min(6, +r.niva || 0)), typ: r.typ === "mil" ? "mil" : "akt",
        start: r.start || "", slut: r.typ === "mil" ? "" : r.slut || "", ansv: r.ansv || null, aktiv: !!r.aktiv, resultat: String(r.resultat || "").slice(0, 300),
        fore: Array.isArray(r.fore) ? r.fore.filter(Boolean).slice(0, 20) : [], farg: r.farg || "", bank: r.bank || "" };
    if (ut.start && ut.slut && ut.slut < ut.start) ut.slut = ut.start;
    return ut;
}
function foTpJamfor(fore, efter) {
    const a = new Map((fore || []).map(r => [r.id, r])), b = new Map((efter || []).map(r => [r.id, r])), ut = [];
    efter.forEach(r => { if (!a.has(r.id)) ut.push("Ny: " + r.namn); });
    (fore || []).forEach(r => { if (!b.has(r.id)) ut.push("Borttagen: " + r.namn); });
    efter.forEach(r => {
        const g = a.get(r.id);
        if (!g) return;
        if (g.start !== r.start || g.slut !== r.slut) ut.push(r.namn + ": " + (g.start || "–") + "–" + (g.slut || g.start || "–") + " → " + (r.start || "–") + "–" + (r.slut || r.start || "–"));
        else if (g.namn !== r.namn) ut.push("Nytt namn: " + g.namn + " → " + r.namn);
        else if (JSON.stringify(g.ansv) !== JSON.stringify(r.ansv)) ut.push(r.namn + ": ny ansvarig");
    });
    return ut;
}
function foTpRevBet(n) { return n < 26 ? String.fromCharCode(65 + n) : "R" + (n + 1); }
Object.assign(FO_OPS, {
    tpNy(p, a, ctx) {
        foTpKravLeda(p, ctx);
        const namn = String(a.namn || "").trim();
        foKrav(namn, "Ge tidplanen ett namn.");
        if (!Array.isArray(p.tidplaner)) p.tidplaner = [];
        if (p.tidplaner.some(t => t.id === a.id)) return null;
        const kalla = a.kopiaAv ? foTp(p, a.kopiaAv) : null;
        // kopia av en tidigare tidplan: nya id, inga uppföljningsuppgifter eller revisioner följer med
        const idKarta = {};
        const rader = kalla ? foTpVisade(kalla).map(r => { const n = Object.assign({}, r, { id: foId() }); idKarta[r.id] = n.id; return n; }) : [];
        rader.forEach(r => { r.fore = (r.fore || []).map(f => idKarta[f]).filter(Boolean); });
        const tp = { id: a.id, namn, typ: a.typ === "aktiv" ? "aktiv" : "klassisk", lage: "utkast", revPagar: false, rader, gallande: null, revisioner: [],
            uppf: {}, uhist: [], fria: kalla ? (kalla.fria || []).slice() : [], omplanering: "forslag", skapad: ctx.tid, av: ctx.av, andrad: ctx.tid };
        p.tidplaner.push(tp);
        foLogg(p, ctx, tp.id, "Tidplanen " + namn + " skapades" + (kalla ? " som kopia av " + kalla.namn : ""));
        return tp;
    },
    tpInst(p, a, ctx) {
        foTpKravLeda(p, ctx);
        const tp = foTp(p, a.id); foKrav(tp, "Tidplanen finns inte.");
        if (a.namn !== undefined) { foKrav(String(a.namn).trim(), "Ge tidplanen ett namn."); tp.namn = String(a.namn).trim(); }
        if (a.typ !== undefined) tp.typ = a.typ === "aktiv" ? "aktiv" : "klassisk";
        if (a.fria !== undefined) tp.fria = (a.fria || []).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
        if (a.omplanering !== undefined) tp.omplanering = a.omplanering === "auto" ? "auto" : "forslag";
        if (a.borttagen !== undefined) { foKrav(!a.borttagen || String(a.orsak || "").trim(), "Ange varför."); tp.borttagen = a.borttagen ? { orsak: a.orsak, tid: ctx.tid, av: ctx.av } : null; }
        tp.andrad = ctx.tid;
        foLogg(p, ctx, tp.id, "Tidplanen " + tp.namn + " ändrades");
    },
    // en rad: ny eller ändrad (arbetsversionen)
    tpRad(p, a, ctx) {
        foTpKravLeda(p, ctx);
        const tp = foTp(p, a.tid); foTpKravRedig(tp);
        const i = tp.rader.findIndex(r => r.id === a.rad.id);
        if (i >= 0) {
            const ny = foTpRensaRad(Object.assign({}, tp.rader[i], a.rad));
            if (JSON.stringify(ny) === JSON.stringify(tp.rader[i])) return null;
            tp.rader[i] = ny;
        } else {
            const ny = foTpRensaRad(a.rad);
            foKrav(ny.namn, "Skriv vad aktiviteten heter.");
            const e = a.efter ? tp.rader.findIndex(r => r.id === a.efter) : -1;
            tp.rader.splice(e >= 0 ? e + 1 : tp.rader.length, 0, ny);
        }
        tp.andrad = ctx.tid;
        return tp.rader.find(r => r.id === a.rad.id);
    },
    tpRader(p, a, ctx) {
        // flera nya rader på en gång (aktivitetsbanken, inklistring)
        foTpKravLeda(p, ctx);
        const tp = foTp(p, a.tid); foTpKravRedig(tp);
        const nya = (a.rader || []).map(foTpRensaRad).filter(r => r.namn && !tp.rader.some(x => x.id === r.id));
        if (!nya.length) return null;
        const e = a.efter ? tp.rader.findIndex(r => r.id === a.efter) : -1;
        tp.rader.splice(e >= 0 ? e + 1 : tp.rader.length, 0, ...nya);
        tp.andrad = ctx.tid;
        return nya.length;
    },
    tpTaBort(p, a, ctx) {
        foTpKravLeda(p, ctx);
        const tp = foTp(p, a.tid); foTpKravRedig(tp);
        const ids = new Set(a.ids || []);
        const fore = tp.rader.length;
        tp.rader = tp.rader.filter(r => !ids.has(r.id));
        tp.rader.forEach(r => { r.fore = (r.fore || []).filter(f => !ids.has(f)); });
        if (tp.rader.length === fore) return null;
        tp.andrad = ctx.tid;
    },
    // ordning och nivåer (flytta upp/ned, dra in/ut). Alla rader måste vara med.
    tpOrdning(p, a, ctx) {
        foTpKravLeda(p, ctx);
        const tp = foTp(p, a.tid); foTpKravRedig(tp);
        const karta = new Map(tp.rader.map(r => [r.id, r]));
        foKrav((a.ordning || []).length === tp.rader.length && a.ordning.every(x => karta.has(x.id)), "Tidplanen har ändrats. Försök igen.");
        tp.rader = a.ordning.map(x => Object.assign(karta.get(x.id), { niva: Math.max(0, Math.min(6, +x.niva || 0)) }));
        tp.andrad = ctx.tid;
    },
    // ersätt hela arbetsversionen (ångra/gör om)
    tpErsatt(p, a, ctx) {
        foTpKravLeda(p, ctx);
        const tp = foTp(p, a.tid); foTpKravRedig(tp);
        tp.rader = (a.rader || []).map(foTpRensaRad);
        tp.andrad = ctx.tid;
    },
    tpPublicera(p, a, ctx) {
        foTpKravLeda(p, ctx);
        const tp = foTp(p, a.tid); foTpKravRedig(tp);
        foKrav(tp.rader.length, "Tidplanen är tom.");
        foKrav(!tp.gallande || String(a.anledning || "").trim(), "Ange anledningen till revideringen.");
        const andringar = tp.gallande ? foTpJamfor(tp.gallande.rader, tp.rader) : [];
        const rev = { rev: foTpRevBet(tp.revisioner.length), tid: ctx.tid, av: ctx.av, anledning: String(a.anledning || "").trim() || "Första fastställda versionen",
            andringar, rader: JSON.parse(JSON.stringify(tp.rader)) };
        tp.revisioner.push(rev);
        tp.gallande = rev;
        tp.lage = "faststalld"; tp.revPagar = false; tp.andrad = ctx.tid;
        foLogg(p, ctx, tp.id, tp.namn + " fastställdes, revision " + rev.rev);
        return rev;
    },
    tpRevidera(p, a, ctx) {
        foTpKravLeda(p, ctx);
        const tp = foTp(p, a.tid); foKrav(tp && tp.lage === "faststalld" && !tp.revPagar, "Tidplanen kan inte revideras nu.");
        tp.revPagar = true;
        tp.rader = JSON.parse(JSON.stringify(tp.gallande.rader));
        tp.andrad = ctx.tid;
        foLogg(p, ctx, tp.id, "Revidering av " + tp.namn + " påbörjad");
    },
    tpAvbrytRev(p, a, ctx) {
        foTpKravLeda(p, ctx);
        const tp = foTp(p, a.tid); foKrav(tp && tp.revPagar, "Ingen revidering pågår.");
        tp.revPagar = false;
        tp.rader = JSON.parse(JSON.stringify(tp.gallande.rader));
        foLogg(p, ctx, tp.id, "Revideringen av " + tp.namn + " avbröts");
    },
    // Uppföljning: prognos, utfall, risk, konsekvens. Ändrar aldrig fastställda datum.
    tpUppf(p, a, ctx) {
        const tp = foTp(p, a.tid); foKrav(tp && tp.gallande, "Tidplanen är inte fastställd än.");
        const rad = tp.gallande.rader.find(r => r.id === a.rad); foKrav(rad, "Aktiviteten finns inte i den fastställda tidplanen.");
        if (a.konsekvens !== undefined) foTpKravLeda(p, ctx);
        if (!tp.uppf) tp.uppf = {};
        const u = Object.assign({}, tp.uppf[a.rad] || {}), andr = [];
        if (a.lage !== undefined && a.lage !== (u.lage || "")) { u.lage = ["plan", "risk", "sen"].includes(a.lage) ? a.lage : ""; andr.push(u.lage ? FO_TP_LAGE[u.lage].namn : "Bedömning borttagen"); }
        if (a.prognos !== undefined && a.prognos !== (u.prognos || "")) { u.prognos = a.prognos || ""; andr.push("Prognos " + (u.prognos || "borttagen")); }
        if (a.utfall !== undefined && a.utfall !== (u.utfall || "")) { u.utfall = a.utfall || ""; andr.push(u.utfall ? "Genomförd " + u.utfall : "Genomförd borttagen"); }
        if (a.konsekvens !== undefined && a.konsekvens !== (u.konsekvens || "")) { u.konsekvens = a.konsekvens || ""; andr.push(FO_TP_KONS[u.konsekvens]); }
        if (a.kommentar !== undefined && String(a.kommentar).trim() !== (u.kommentar || "")) { u.kommentar = String(a.kommentar).trim(); if (u.kommentar) andr.push("”" + u.kommentar + "”"); }
        if (!andr.length) return null;
        u.tid = ctx.tid; u.av = ctx.av;
        tp.uppf[a.rad] = u;
        if (!Array.isArray(tp.uhist)) tp.uhist = [];
        tp.uhist.push({ rad: a.rad, text: andr.join(", "), tid: ctx.tid, av: ctx.av });
        if (tp.uhist.length > 2000) tp.uhist = tp.uhist.slice(-2000);
        return u;
    },
    // projektets egna aktiviteter i banken (massimport eller "spara till banken")
    tpBank(p, a, ctx) {
        foTpKravLeda(p, ctx);
        if (!Array.isArray(p.tpBank)) p.tpBank = [];
        const nya = (a.rader || []).map(r => ({ id: r.id || foId(), kalla: "projekt", kat: String(r.kat || "Egna aktiviteter").trim().slice(0, 80), namn: String(r.namn || "").trim().slice(0, 200),
            disc: String(r.disc || "").trim().slice(0, 12), skede: String(r.skede || "").trim().toUpperCase().slice(0, 4), dagar: Math.max(0, Math.min(500, +r.dagar || 0)), resultat: String(r.resultat || "").trim().slice(0, 200) }))
            .filter(r => r.namn && !p.tpBank.some(x => x.namn.toLowerCase() === r.namn.toLowerCase() && x.kat === r.kat));
        if (a.taBort) p.tpBank = p.tpBank.filter(x => !a.taBort.includes(x.id));
        if (!nya.length && !a.taBort) return null;
        p.tpBank.push(...nya);
        if (nya.length) foLogg(p, ctx, "", nya.length + " aktiviteter sparades i projektets aktivitetsbank");
        return nya.length;
    }
});
// Läsare får bara läsa; uppföljning (tpUppf) får alla som kan skriva i projektet.
if (typeof FO_AVIS_HAKAR !== "undefined") Object.assign(FO_AVIS_HAKAR, {
    tpPublicera(p, a, ctx, rev) {
        const tp = foTp(p, a.tid);
        if (!rev || !tp) return;
        const till = p.personer.filter(x => x.aktiv !== false).map(x => x.id);
        foAvisera(p, ctx, "tidplan", { typ: "tidplan", id: tp.id }, till, (tp.revisioner.length > 1 ? "Reviderad tidplan: " : "Ny fastställd tidplan: ") + tp.namn + " rev " + rev.rev +
            (rev.andringar.length ? " – " + rev.andringar.length + " ändringar" : ""));
    },
    tpUppf(p, a, ctx, u) {
        const tp = foTp(p, a.tid);
        if (!u || !tp || !(a.lage === "risk" || a.lage === "sen")) return;
        const rad = tp.gallande.rader.find(r => r.id === a.rad);
        const leda = p.personer.filter(x => x.aktiv !== false && (foKanLeda(p, x.id) || foSuper(p, x.id))).map(x => x.id);
        foAvisera(p, ctx, "tidplan_risk", { typ: "tidplan", id: tp.id }, leda, (a.lage === "sen" ? "Försening rapporterad: " : "Risk rapporterad: ") + (rad ? rad.namn : "") + " (" + tp.namn + ")");
    }
});
if (typeof FO_AVIS_TYPER !== "undefined") Object.assign(FO_AVIS_TYPER, {
    tidplan: { namn: "Fastställd eller reviderad tidplan", mejl: "daglig" },
    tidplan_risk: { namn: "Rapporterad leveransrisk", mejl: "direkt" },
    leverans: { namn: "Kommande leveranser", mejl: "daglig", agera: true }
});

/* ======================= vyn ======================= */
const FO_TP_ZOOM = { dag: { dw: 34, namn: "Dag" }, vecka: { dw: 20, namn: "Vecka" }, manad: { dw: 7, namn: "Månad" } };
const FO_TP_FARGER = ["", "bla", "orange", "lila", "rod", "brun"];
let foTpVal = "", foTpZoom = "vecka", foTpIhop = new Set(), foTpMark = "", foTpFilter = { disc: "", min: false, rev: "" }, foTpBankOppen = false;
const foTpAngra = {}, foTpGorOm = {};
function foTpAktuell(p) {
    const l = (p.tidplaner || []).filter(t => !t.borttagen);
    if (!l.some(t => t.id === foTpVal)) foTpVal = (l[0] || {}).id || "";
    return foTp(p, foTpVal);
}
function foTpAnsvText(p, ansv) { return ansv ? foPartText(p, ansv) : ""; }
function foTpAnsvDisc(p, ansv) { return !ansv ? "" : ansv.disc ? ansv.disc : ansv.person ? (foPersonDisc(p, ansv.person)[0] || "") : ""; }
// ångra: ögonblicksbild av arbetsversionen före varje ändring
function foTpGor(tp, typ, a, tyst) {
    const fore = JSON.stringify(tp.rader);
    const r = foGor(typ, Object.assign({ tid: tp.id }, a), tyst);
    if (r !== null && r !== undefined && r !== false) {
        (foTpAngra[tp.id] = foTpAngra[tp.id] || []).push(fore);
        if (foTpAngra[tp.id].length > 60) foTpAngra[tp.id].shift();
        foTpGorOm[tp.id] = [];
    }
    return r;
}
function foTpAngraSteg(tp, igen) {
    const fran = igen ? foTpGorOm : foTpAngra, till = igen ? foTpAngra : foTpGorOm;
    const s = (fran[tp.id] || []).pop();
    if (!s) return status(igen ? "Inget att göra om." : "Inget att ångra.");
    (till[tp.id] = till[tp.id] || []).push(JSON.stringify(tp.rader));
    foGor("tpErsatt", { tid: tp.id, rader: JSON.parse(s) }, true);
    status(igen ? "Gjort om." : "Ångrat.");
}

function foVyTidplaner(yta) {
    const p = foP, jag = foJagId(), leda = foTpLedare(p, jag), idag = foIdag();
    const lista = (p.tidplaner || []).filter(t => !t.borttagen);
    const tp = foTpAktuell(p);
    if (!tp) {
        yta.innerHTML = foTopp("Tidplaner") + foTomt("Ingen tidplan ännu",
            "Upprätta projekteringstidplanen direkt i Forma. Hämta aktiviteter från aktivitetsbanken, sätt datum och fastställ när den är klar. Tidplanen i Forma är helt fristående från Wimo Plan.",
            leda ? '<button type="button" class="p4-btn p4-btn-primar" id="foTpNy">Ny tidplan</button>' : "");
        const b = document.getElementById("foTpNy"); if (b) b.addEventListener("click", foTpNyDialog);
        return;
    }
    const redig = foTpRedigerbar(tp) && leda;
    const visaRev = foTpFilter.rev ? tp.revisioner.find(r => r.rev === foTpFilter.rev) : null;
    const rader = visaRev ? visaRev.rader : foTpVisade(tp);
    const struktur = foTpStruktur(rader);
    const uppfLage = tp.lage === "faststalld" && !tp.revPagar && !visaRev;
    // filter: min disciplin / mina leveranser
    const minaDisc = foPersonDisc(p, jag);
    const synlig = (x) => {
        if (foTpFilter.disc && foTpAnsvDisc(p, x.r.ansv) !== foTpFilter.disc && !x.grupp) return false;
        if (foTpFilter.min && !x.grupp && !(x.r.ansv && (foArPart(p, jag, x.r.ansv) || minaDisc.includes(foTpAnsvDisc(p, x.r.ansv))))) return false;
        return true;
    };
    // hopfällda grupper döljer sina rader
    const dold = new Set();
    struktur.forEach((x, i) => {
        if (x.grupp && foTpIhop.has(x.r.id)) for (let j = i + 1; j < struktur.length && (struktur[j].r.niva || 0) > (x.r.niva || 0); j++) dold.add(j);
    });
    const vis = struktur.filter((x, i) => !dold.has(i) && synlig(x));
    // axel: arbetsdagar från veckan före första aktiviteten till efter sista
    const dat = struktur.flatMap(x => [x.start, x.slut]).filter(Boolean).sort();
    let ax0 = dat[0] || idag; if (idag < ax0) ax0 = idag;
    let ax1 = dat[dat.length - 1] || foTpPlus(idag, 90); if (ax1 < idag) ax1 = idag;
    const mand = (iso) => { const d = new Date(iso + "T12:00:00"); const w = (d.getDay() + 6) % 7; d.setDate(d.getDate() - w); return d.toISOString().slice(0, 10); };
    ax0 = foTpPlus(mand(ax0), -7); ax1 = foTpPlus(mand(ax1), 7 * (foTpZoom === "manad" ? 8 : 4) + 4);
    const dagar = [], index = {};
    for (let d = ax0, s = 0; d <= ax1 && s < 3000; d = foTpPlus(d, 1), s++) { const w = new Date(d + "T12:00:00").getDay(); if (w !== 0 && w !== 6) { index[d] = dagar.length; dagar.push(d); } }
    const dw = FO_TP_ZOOM[foTpZoom].dw, bredd = dagar.length * dw;
    const kol = (iso, slut) => { let d = iso; for (let s = 0; index[d] === undefined && s < 7; s++) d = foTpPlus(d, slut ? -1 : 1); return index[d] === undefined ? (iso < ax0 ? 0 : dagar.length - 1) : index[d]; };
    // kolumner
    const kolumner = [
        { id: "nr", namn: "#", b: "52px" }, { id: "namn", namn: "Aktivitet", b: "minmax(180px, 1fr)" }, { id: "ansv", namn: "Ansvarig", b: "92px" },
        { id: "start", namn: "Start", b: "92px" }, { id: "slut", namn: "Slut", b: "92px" }, { id: "dgr", namn: "Dgr", b: "50px" }
    ].concat(uppfLage ? [{ id: "status", namn: "Status", b: "168px" }] : [{ id: "fore", namn: "Efter", b: "64px" }]);
    const kolMall = kolumner.map(k => k.b).join(" ");
    const nrAv = {}; struktur.forEach((x, i) => { nrAv[x.r.id] = i + 1; });
    const cell = (x, k) => {
        const r = x.r, e = redig && !(x.grupp && ["start", "slut", "dgr"].includes(k.id)) ? ' tp-e" tabindex="-1' : "";
        if (k.id === "nr") return '<div class="tp-c tp-nr" data-tpnr="' + r.id + '">' + (r.farg ? '<span class="tp-farg tpc-' + r.farg + '"></span>' : "") + nrAv[r.id] + '</div>';
        if (k.id === "namn") return '<div class="tp-c' + e + '" data-tpfalt="namn">' + (x.grupp ? '<button type="button" class="tp-ihop" data-tpihop="' + r.id + '" aria-expanded="' + !foTpIhop.has(r.id) + '" aria-label="Fäll ihop eller visa">' + (foTpIhop.has(r.id) ? "▸" : "▾") + '</button>' : "") +
            (r.typ === "mil" ? '<span class="fo-tp-mil" aria-hidden="true">◆</span>' : "") + '<span class="tp-namntext">' + esc(r.namn) + '</span>' + (r.aktiv ? ' <span class="fo-tp-akt" title="Aktiv leverans – bevakas">●</span>' : "") + '</div>';
        if (k.id === "ansv") return '<div class="tp-c' + e + '" data-tpfalt="ansv">' + (r.ansv && r.ansv.disc ? foDiscChip(p, r.ansv.disc) : esc(foTpAnsvText(p, r.ansv))) + '</div>';
        if (k.id === "start") return '<div class="tp-c tp-per' + e + '" data-tpfalt="start">' + (x.start ? foDatumKort(x.start) : "") + '</div>';
        if (k.id === "slut") return '<div class="tp-c tp-per' + e + '" data-tpfalt="slut">' + (r.typ === "mil" ? "" : x.slut ? foDatumKort(x.slut) : "") + '</div>';
        if (k.id === "dgr") return '<div class="tp-c tp-per' + e + '" data-tpfalt="dgr" style="justify-content:flex-end">' + (r.typ === "mil" ? "0" : x.start && x.slut ? foTpDagar(tp, x.start, x.slut) : "") + '</div>';
        if (k.id === "fore") return '<div class="tp-c tp-per' + e + '" data-tpfalt="fore">' + (r.fore || []).map(f => nrAv[f]).filter(Boolean).join(", ") + '</div>';
        if (k.id === "status") {
            if (x.grupp) return '<div class="tp-c"></div>';
            const st = foTpStatus(tp, r, idag), u = (tp.uppf || {})[r.id] || {};
            const visas = r.aktiv || tp.typ === "aktiv" || u.tid;
            return '<div class="tp-c fo-tp-statuscell"><button type="button" class="fo-tp-stat" data-tpuppf="' + r.id + '" title="Rapportera prognos, risk eller genomförd">' +
                (visas || st === "klar" ? '<span class="fo-lage ' + FO_TP_LAGE[st].kl + '"><i aria-hidden="true"></i>' + FO_TP_LAGE[st].namn + '</span>' : '<span class="tp-tom">–</span>') + (u.prognos && st !== "klar" ? ' <small>prog. ' + foDatumKort(u.prognos) + '</small>' : "") + '</button></div>';
        }
        return '<div class="tp-c"></div>';
    };
    const iFokus = (x) => foTpMark === x.r.id;
    const radHtml = vis.map(x => '<div class="tp-rad' + (x.r.farg ? " tpc-" + x.r.farg : "") + (x.r.niva ? " tp-under" : "") + (x.grupp ? " tp-grupp" : "") + (iFokus(x) ? " markerad" : "") +
        '" data-tprad="' + x.r.id + '" style="--niva:' + (x.r.niva || 0) + '">' + kolumner.map(k => cell(x, k)).join("") + '</div>').join("") +
        (redig ? '<div class="tp-rad tp-nyrad" data-tprad="ny"><div class="tp-c tp-nr">' + (struktur.length + 1) + '</div><div class="tp-c tp-e" tabindex="-1" data-tpfalt="namn"><span class="tp-tom">Ny aktivitet</span></div>' +
            kolumner.slice(2).map(() => '<div class="tp-c"></div>').join("") + '</div>' : "");
    // kalender: huvud
    let huvud = "";
    if (foTpZoom === "manad") {
        let m = "";
        dagar.forEach((d, i) => { if (d.slice(0, 7) !== m) { m = d.slice(0, 7); const slutI = dagar.findIndex((x, j) => j > i && x.slice(0, 7) !== m); huvud += '<span class="tp-kh-m" style="left:' + i * dw + 'px;width:' + ((slutI < 0 ? dagar.length : slutI) - i) * dw + 'px">' + ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"][+m.slice(5) - 1] + " " + m.slice(0, 4) + '</span>'; } });
        dagar.forEach((d, i) => { if (new Date(d + "T12:00:00").getDay() === 1 || i === 0) huvud += '<span class="tp-kh-v liten" style="left:' + i * dw + 'px;width:' + 5 * dw + 'px">' + foVecka(d) + '</span>'; });
    } else {
        dagar.forEach((d, i) => { if (new Date(d + "T12:00:00").getDay() === 1 || i === 0) huvud += '<span class="tp-kh-v" style="left:' + i * dw + 'px;width:' + 5 * dw + 'px">v ' + foVecka(d) + (foTpZoom === "vecka" ? '<small>' + foDatumKort(d) + '</small>' : "") + '</span>'; });
        if (foTpZoom === "dag") dagar.forEach((d, i) => { huvud += '<span class="tp-kh-d' + (d === idag ? " idag" : "") + '" style="left:' + i * dw + 'px;width:' + dw + 'px">' + (+d.slice(8)) + '</span>'; });
    }
    const bas = tp.revPagar && tp.gallande ? new Map(foTpStruktur(tp.gallande.rader).map(x => [x.r.id, x])) : null;
    const stapel = (x) => {
        if (!x.start) return "";
        const r = x.r, u = (tp.uppf || {})[r.id] || {};
        let html = "";
        if (bas && bas.has(r.id)) { const b = bas.get(r.id); if (b.start && (b.start !== x.start || b.slut !== x.slut)) { const i0 = kol(b.start), i1 = r.typ === "mil" ? i0 : kol(b.slut, true); html += '<div class="tp-stapel tp-ghost fo-tp-bas" style="left:' + i0 * dw + 'px;width:' + Math.max(dw, (i1 - i0 + 1) * dw) + 'px" title="Fastställd: ' + b.start + "–" + (b.slut || b.start) + '"></div>'; } }
        if (r.typ === "mil") { const i0 = kol(x.start); return html + '<div class="fo-tp-milstolpe" style="left:' + (i0 * dw + dw / 2) + 'px" data-tpstapel="' + r.id + '" title="' + esc(r.namn) + " " + x.start + '"></div>'; }
        const i0 = kol(x.start), i1 = kol(x.slut, true);
        const st = uppfLage ? foTpStatus(tp, r, idag) : "";
        html += '<div class="tp-stapel' + (x.grupp ? " fo-tp-gstapel" : "") + (st === "sen" || st === "passerad" ? " fo-tp-varn" : "") + '" style="left:' + i0 * dw + 'px;width:' + Math.max(dw, (i1 - i0 + 1) * dw) + 'px"' +
            (redig && !x.grupp ? ' data-tpstapel="' + r.id + '" tabindex="0"' : "") + ' title="' + esc(r.namn) + ": " + x.start + " – " + x.slut + '">' + (dw * (i1 - i0 + 1) > 30 && !x.grupp ? '<span class="tp-dgr">' + foTpDagar(tp, x.start, x.slut) + '</span>' : "") +
            (redig && !x.grupp ? '<span class="tp-hand v" data-tphand="v"></span><span class="tp-hand h" data-tphand="h"></span>' : "") + '</div>';
        if (uppfLage && u.prognos && x.slut && u.prognos !== x.slut) html += '<div class="fo-tp-prog" style="left:' + (kol(u.prognos, true) * dw + dw / 2) + 'px" title="Prognos ' + u.prognos + '"></div>';
        return html;
    };
    const kalRader = vis.map(x => '<div class="tp-kalrad' + (x.r.farg ? " tpc-" + x.r.farg : "") + '" data-tpkal="' + x.r.id + '">' + stapel(x) + '</div>').join("") + (redig ? '<div class="tp-kalrad" data-tpspar="ny"></div>' : "");
    const idagX = index[idag] !== undefined ? index[idag] * dw + dw / 2 : (kol(idag)) * dw;
    // topp, val av tidplan och läge
    const lagetext = tp.lage === "utkast" ? '<span class="fo-chip">Utkast</span>' : tp.revPagar ? '<span class="fo-chip fo-tp-revchip">Revidering pågår</span>' :
        '<span class="fo-chip fo-tp-faststalld">Fastställd rev ' + esc(tp.gallande.rev) + '</span>';
    let html = foTopp("Tidplaner", (leda ? '<button class="navknapp" type="button" id="foTpNy">Ny tidplan</button>' : "") +
        '<button class="navknapp" type="button" id="foTpSkriv">PDF</button><button class="navknapp" type="button" id="foTpExport">Excel</button>');
    html += '<div class="fo-tp-topp"><div class="fo-tp-val">' + (lista.length > 1 ? '<select class="f" id="foTpVal" aria-label="Tidplan">' + lista.map(t => '<option value="' + t.id + '"' + (t.id === tp.id ? " selected" : "") + '>' + esc(t.namn) + '</option>').join("") + '</select>' : '<b class="fo-tp-namn">' + esc(tp.namn) + '</b>') +
        lagetext + '<span class="fo-chip">' + (tp.typ === "aktiv" ? "Aktiv tidplan" : "Klassisk tidplan") + '</span>' + (leda ? '<button type="button" class="p4d-lank" id="foTpInst">Inställningar</button>' : "") + '</div>' +
        '<div class="fo-tp-lagesknappar">' + (leda && tp.lage === "utkast" ? '<button type="button" class="p4-btn p4-btn-primar" id="foTpPubl">Fastställ</button>' : "") +
        (leda && tp.lage === "faststalld" && !tp.revPagar ? '<button type="button" class="p4-btn p4-btn-ljus" id="foTpRev">Revidera</button>' : "") +
        (leda && tp.revPagar ? '<button type="button" class="p4-btn p4-btn-ljus" id="foTpAvbryt">Avbryt revidering</button><button type="button" class="p4-btn p4-btn-primar" id="foTpPubl">Publicera revision</button>' : "") + '</div></div>';
    if (tp.revPagar) html += '<p class="notis fo-tp-notis">Du arbetar i en arbetsversion. Den fastställda tidplanen (rev ' + esc(tp.gallande.rev) + ') gäller tills du publicerar revisionen. Streckade staplar visar de fastställda tiderna.</p>';
    if (!leda && tp.lage === "utkast") html += '<p class="notis fo-tp-notis">Tidplanen är ett utkast och är inte fastställd än.</p>';
    if (visaRev) html += '<p class="notis fo-tp-notis">Du tittar på revision ' + esc(visaRev.rev) + ' från ' + foDatumKort(visaRev.tid) + ' (' + esc(visaRev.anledning) + '). <button type="button" class="p4d-lank" id="foTpRevTill">Visa gällande</button></p>';
    // verktygsrad
    html += '<div class="fo-tp-verktyg">' +
        '<div class="tp-nav" role="group" aria-label="Zoom">' + Object.keys(FO_TP_ZOOM).map(z => '<button type="button" data-tpzoom="' + z + '" aria-pressed="' + (foTpZoom === z) + '" class="' + (foTpZoom === z ? "vald" : "") + '">' + FO_TP_ZOOM[z].namn + '</button>').join("") + '</div>' +
        '<div class="tp-nav"><button type="button" id="foTpIdag">Idag</button></div>' +
        (redig ? '<span class="tp-markdel"></span><div class="tp-nav"><button type="button" id="foTpBank" aria-pressed="' + foTpBankOppen + '" class="' + (foTpBankOppen ? "vald" : "") + '">Aktivitetsbank</button>' +
            '<button type="button" data-tpverk="mil" title="Ny milstolpe under markerad rad">+ Milstolpe</button></div>' +
            '<div class="tp-nav" role="group" aria-label="Markerad rad"><button type="button" data-tpverk="ut" title="Dra ut (Alt+←)" aria-label="Dra ut">⇤</button><button type="button" data-tpverk="in" title="Dra in under raden ovanför (Alt+→)" aria-label="Dra in">⇥</button>' +
            '<button type="button" data-tpverk="upp" title="Flytta upp (Alt+↑)" aria-label="Flytta upp">↑</button><button type="button" data-tpverk="ned" title="Flytta ned (Alt+↓)" aria-label="Flytta ned">↓</button>' +
            '<button type="button" data-tpverk="mer" title="Ansvar, färg och leverans">Detaljer</button><button type="button" data-tpverk="bort" title="Ta bort markerad rad (Delete)">Ta bort</button></div>' +
            '<div class="tp-nav" role="group" aria-label="Ångra"><button type="button" id="foTpAngra" title="Ångra (Ctrl+Z)" aria-label="Ångra">' + FO_TP_ANGRA_IK + '</button><button type="button" id="foTpGorOm" title="Gör om (Ctrl+Y)" aria-label="Gör om">' + FO_TP_GOROM_IK + '</button></div>' : "") +
        '<span class="fo-tp-hoger"><label class="fo-litefalt"><span class="sr">Disciplin</span><select class="f" id="foTpDisc"><option value="">Alla discipliner</option>' +
        p.discipliner.filter(d => d.aktiv).map(d => '<option value="' + d.id + '"' + (foTpFilter.disc === d.id ? " selected" : "") + '>' + esc(d.kod + " " + d.namn) + '</option>').join("") + '</select></label>' +
        '<label class="fo-kryss"><input type="checkbox" id="foTpMin"' + (foTpFilter.min ? " checked" : "") + '> Mina leveranser</label>' +
        (tp.revisioner.length ? '<select class="f" id="foTpRevVal" aria-label="Revision"><option value="">Gällande</option>' + tp.revisioner.slice().reverse().map(r => '<option value="' + r.rev + '"' + (foTpFilter.rev === r.rev ? " selected" : "") + '>Rev ' + esc(r.rev) + ' · ' + foDatumKort(r.tid) + '</option>').join("") + '</select>' : "") + '</span></div>';
    // konsekvensanalys: efterföljande aktiviteter som börjar innan föregående är klar
    const konflikter = redig ? foTpKonflikter(tp) : [];
    if (konflikter.length) html += '<div class="notis fo-tp-kons"><b>' + konflikter.length + (konflikter.length === 1 ? " aktivitet börjar" : " aktiviteter börjar") + ' innan det de beror på är klart.</b> ' +
        konflikter.slice(0, 4).map(k => esc(k.rad.namn) + " (efter " + esc(k.fore.namn) + ")").join(", ") + (konflikter.length > 4 ? " …" : "") +
        ' <button type="button" class="mknapp" id="foTpFlytta">Flytta dem till efter föregående</button></div>';
    html += '<div class="fo-tp-yta' + (foTpBankOppen && redig ? " med-bank" : "") + '"><div class="tp-yta z-' + foTpZoom + (redig ? "" : " tp-las") + '" style="--tp-kol:' + kolMall + ';--tp-tab:62%">' +
        '<div class="tp-tabell"><div class="tp-rad tp-huvud">' + kolumner.map(k => '<div class="tp-c">' + k.namn + '</div>').join("") + '</div>' + radHtml + '</div>' +
        '<div class="tp-kalender" id="foTpKal"><div class="tp-kalinre" style="width:' + bredd + 'px;--dw:' + dw + 'px;--dpv:5"><div class="tp-kalhuvud z-' + foTpZoom + '">' + huvud + '</div>' +
        kalRader + '<div class="tp-idag" style="left:' + idagX + 'px"></div></div></div></div>' +
        (foTpBankOppen && redig ? foTpBankPanel(p) : "") + '</div>';
    if (!struktur.length && redig) html += '<p class="hjalp">Skriv i raden <b>Ny aktivitet</b> eller öppna <b>Aktivitetsbanken</b> och lägg till aktiviteter med ett klick. Enter sparar och går till nästa rad, Tab går åt höger.</p>';
    html += '<p class="hjalp fo-tp-hjalp">' + (redig ? "Klicka i en cell för att skriva. Dra en stapel för att flytta, dra i kanten för att ändra längd. " : "") +
        (uppfLage ? "Klicka på statusen för att rapportera prognos, risk eller genomförd leverans – det ändrar aldrig de fastställda tiderna." : "") + '</p>';
    if (tp.revisioner.length) html += '<details class="fo-histdet"><summary>Revisioner (' + tp.revisioner.length + ')</summary><ul class="fo-hist">' + tp.revisioner.slice().reverse().map(r =>
        '<li><span>' + foDatumKort(r.tid) + '</span><b>Rev ' + esc(r.rev) + '</b> ' + esc(r.anledning) + ' <small>' + esc(foPersonNamn(p, r.av)) + (r.andringar.length ? " · " + r.andringar.length + " ändringar" : "") + '</small>' +
        (r.andringar.length ? '<ul class="fo-tp-andr">' + r.andringar.slice(0, 30).map(a => '<li>' + esc(a) + '</li>').join("") + '</ul>' : "") + '</li>').join("") + '</ul></details>';
    yta.innerHTML = html;
    foTpKoppla(yta, tp, { redig, leda, struktur, vis, dagar, index, dw, ax0, nrAv, uppfLage });
    const kal = document.getElementById("foTpKal");
    if (kal && foTpKoppla.scroll !== undefined && foTpKoppla.scrollTp === tp.id) kal.scrollLeft = foTpKoppla.scroll;
    else if (kal) kal.scrollLeft = Math.max(0, idagX - 120);
}
function foTpKonflikter(tp) {
    const k = new Map(tp.rader.map(r => [r.id, r])), ut = [];
    tp.rader.forEach(r => (r.fore || []).forEach(f => {
        const g = k.get(f); if (!g || !r.start) return;
        const gs = g.typ === "mil" ? g.start : g.slut;
        if (gs && r.start <= gs) ut.push({ rad: r, fore: g, slut: gs });
    }));
    return ut;
}
// flytta efterföljande aktiviteter så att de börjar dagen efter föregående (behåller längden)
function foTpLosKonflikter(tp, tyst) {
    for (let varv = 0; varv < 20; varv++) {
        const k = foTpKonflikter(tp);
        if (!k.length) break;
        const per = {};
        k.forEach(x => { if (!per[x.rad.id] || x.slut > per[x.rad.id]) per[x.rad.id] = x.slut; });
        Object.keys(per).forEach(id => {
            const r = tp.rader.find(x => x.id === id), n = r.typ === "mil" ? 0 : foTpDagar(tp, r.start, r.slut);
            const ny = foTpArbPlus(tp, per[id], 1);
            foTpGor(tp, "tpRad", { rad: r.typ === "mil" ? { id, start: ny } : { id, start: ny, slut: foTpSlutAv(tp, ny, n) } }, true);
        });
    }
    if (!tyst) status("Efterföljande aktiviteter är flyttade i arbetsversionen.");
}

/* ---------- interaktion ---------- */
function foTpKoppla(yta, tp, c) {
    const p = foP;
    const kal = document.getElementById("foTpKal");
    if (kal) kal.addEventListener("scroll", () => { foTpKoppla.scroll = kal.scrollLeft; foTpKoppla.scrollTp = tp.id; });
    const g = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener("click", fn); };
    g("foTpNy", foTpNyDialog);
    g("foTpInst", () => foTpInstDialog(tp));
    g("foTpPubl", () => foTpPublDialog(tp));
    g("foTpRev", () => { if (foGor("tpRevidera", { tid: tp.id })) status("Revidering påbörjad. Den fastställda tidplanen gäller tills du publicerar."); });
    g("foTpAvbryt", () => foFragaOrsak ? modal("Avbryt revidering", tp.namn, "<p>Ändringarna i arbetsversionen tas bort. Den fastställda tidplanen påverkas inte.</p>",
        [{ txt: "Fortsätt revidera", fn: stangModal }, { txt: "Avbryt revidering", primar: true, fara: true, fn: () => { stangModal(); foGor("tpAvbrytRev", { tid: tp.id }); } }]) : null);
    g("foTpRevTill", () => { foTpFilter.rev = ""; foRita(); });
    g("foTpIdag", () => { foTpKoppla.scroll = undefined; foRita(); });
    g("foTpBank", () => { foTpBankOppen = !foTpBankOppen; foRita(); });
    g("foTpAngra", () => foTpAngraSteg(tp, false));
    g("foTpGorOm", () => foTpAngraSteg(tp, true));
    g("foTpSkriv", () => foTpSkrivDialog(tp));
    g("foTpExport", () => foTpExportera(tp));
    g("foTpFlytta", () => foTpLosKonflikter(tp));
    const sel = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener("change", () => fn(el)); };
    sel("foTpVal", el => { foTpVal = el.value; foTpFilter.rev = ""; foTpMark = ""; foTpKoppla.scroll = undefined; foRita(); });
    sel("foTpDisc", el => { foTpFilter.disc = el.value; foRita(); });
    sel("foTpMin", el => { foTpFilter.min = el.checked; foRita(); });
    sel("foTpRevVal", el => { foTpFilter.rev = el.value; foRita(); });
    yta.querySelectorAll("[data-tpzoom]").forEach(b => b.addEventListener("click", () => { foTpZoom = b.dataset.tpzoom; foTpKoppla.scroll = undefined; foRita(); }));
    yta.querySelectorAll("[data-tpihop]").forEach(b => b.addEventListener("click", (e) => { e.stopPropagation(); const id = b.dataset.tpihop; foTpIhop.has(id) ? foTpIhop.delete(id) : foTpIhop.add(id); foRita(); }));
    yta.querySelectorAll("[data-tpuppf]").forEach(b => b.addEventListener("click", () => foTpUppfDialog(tp, b.dataset.tpuppf)));
    yta.querySelectorAll("[data-tpverk]").forEach(b => b.addEventListener("click", () => foTpVerktyg(tp, b.dataset.tpverk)));
    // markera rad (nummer)
    yta.querySelectorAll("[data-tpnr]").forEach(el => el.addEventListener("click", () => { foTpMark = foTpMark === el.dataset.tpnr ? "" : el.dataset.tpnr; foRita(); }));
    if (!c.redig) return;
    // direktredigering
    yta.querySelectorAll(".tp-tabell .tp-e").forEach(el => el.addEventListener("click", () => foTpBorja(tp, el, c)));
    // dra staplar
    yta.querySelectorAll("[data-tpstapel]").forEach(el => el.addEventListener("pointerdown", (e) => foTpDra(tp, el, e, c)));
    // bankpanelen
    foTpKopplaBank(yta, tp);
    // kortkommandon (en lyssnare för hela sidan, gäller bara i tidplanen)
    if (foTpKoppla.tangent) return;
    foTpKoppla.tangent = true;
    document.addEventListener("keydown", (e) => {
        if (foVy !== "tidplaner" || !foModulAktiv() || document.querySelector(".modal")) return;
        const tp = foTp(foP, foTpVal);
        if (!tp || !foTpRedigerbar(tp) || !foTpLedare(foP, foJagId())) return;
        if (e.target.closest && e.target.closest("input, textarea, select")) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); foTpAngraSteg(tp, e.shiftKey); }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); foTpAngraSteg(tp, true); }
        if (!foTpMark) return;
        if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); foTpVerktyg(tp, "in"); }
        if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); foTpVerktyg(tp, "ut"); }
        if (e.altKey && e.key === "ArrowUp") { e.preventDefault(); foTpVerktyg(tp, "upp"); }
        if (e.altKey && e.key === "ArrowDown") { e.preventDefault(); foTpVerktyg(tp, "ned"); }
        if (e.key === "Delete") { e.preventDefault(); foTpVerktyg(tp, "bort"); }
    });
}
const FO_TP_FALT = ["namn", "ansv", "start", "slut", "dgr", "fore"];
function foTpBorja(tp, el, c) {
    if (el.classList.contains("redigerar")) return;
    const radEl = el.closest("[data-tprad]"), id = radEl.dataset.tprad, falt = el.dataset.tpfalt;
    const p = foP, r = id === "ny" ? null : tp.rader.find(x => x.id === id);
    if (id === "ny" && falt !== "namn") return;
    const sx = c.struktur.find(x => x.r.id === id);
    let inp;
    if (falt === "ansv") {
        el.innerHTML = foPartSelect("foTpCell", r ? r.ansv : null, "Ingen", 'class="tp-in"');
        inp = el.querySelector("select"); inp.classList.add("tp-in");
    } else {
        // datum skrivs som text (som i ett kalkylark): 2026-12-10, 10/12 eller +5 (arbetsdagar framåt)
        const typ = falt === "dgr" ? "number" : "text";
        const v = !r ? "" : falt === "namn" ? r.namn : falt === "start" ? r.start : falt === "slut" ? r.slut : falt === "dgr" ? (r.start && r.slut ? foTpDagar(tp, r.start, r.slut) : "") :
            (r.fore || []).map(f => c.nrAv[f]).filter(Boolean).join(", ");
        el.innerHTML = '<input class="tp-in" type="' + typ + '"' + (typ === "number" ? ' min="0"' : "") + ' value="' + esc(v) + '"' + (falt === "fore" ? ' placeholder="t.ex. 3, 5"' : falt === "start" || falt === "slut" ? ' placeholder="ÅÅÅÅ-MM-DD" inputmode="numeric"' : "") + '>';
        inp = el.querySelector("input");
    }
    el.classList.add("redigerar");
    inp.focus(); if (inp.select) try { inp.select(); } catch (e) { }
    let klar = false;
    const spara = (steg) => {
        if (klar) return; klar = true;
        let v = inp.value;
        if ((falt === "start" || falt === "slut") && v.trim()) {
            v = foTpTolkaDatum(tp, v, (r && (falt === "start" ? r.start : r.slut)) || foIdag());
            if (!v) { status("Skriv datum som 2026-12-10, 10/12 eller +5.", true); klar = false; inp.focus(); return; }
        }
        let rad = null;
        if (!r) {
            if (v.trim()) {
                const sista = tp.rader[tp.rader.length - 1];
                const start = foTpNasta(tp, sista && sista.slut ? foTpArbPlus(tp, sista.slut, 1) : foIdag(), 1);
                const nyId = foId();
                const ny = foTpGor(tp, "tpRad", { rad: { id: nyId, namn: v.trim(), niva: sista ? sista.niva || 0 : 0, start, slut: foTpSlutAv(tp, start, 5) } }, true);
                if (ny) { foTpMark = nyId; foRita(); if (steg) setTimeout(() => { const n = document.querySelector('[data-tprad="ny"] [data-tpfalt="namn"]'); if (n) foTpBorja(foTp(foP, tp.id), n, foTpCtx()); }, 20); return; }
            }
            foRita(); return;
        }
        if (falt === "namn") rad = { id, namn: v };
        if (falt === "ansv") rad = { id, ansv: foPartFran(v) };
        if (falt === "start" && v) { const n = r.typ === "mil" ? 0 : foTpDagar(tp, r.start || v, r.slut || v); rad = r.typ === "mil" ? { id, start: v } : { id, start: v, slut: r.start && r.slut ? foTpSlutAv(tp, v, n) : v }; }
        if (falt === "slut" && v) rad = { id, slut: v < (r.start || v) ? r.start : v, start: r.start || v };
        if (falt === "dgr" && v !== "") { const n = Math.max(0, Math.round(+v)); rad = n === 0 ? { id, typ: "mil", start: r.start || foIdag() } : { id, typ: "akt", start: r.start || foIdag(), slut: foTpSlutAv(tp, r.start || foIdag(), n) }; }
        if (falt === "fore") {
            const nrTill = {}; Object.keys(c.nrAv).forEach(k => { nrTill[c.nrAv[k]] = k; });
            rad = { id, fore: v.split(/[,; ]+/).map(x => nrTill[+x]).filter(x => x && x !== id) };
        }
        if (rad) foTpGor(tp, "tpRad", { rad }, true);
        foRita();
        if (steg) setTimeout(() => {
            const rader = [...document.querySelectorAll(".tp-tabell [data-tprad]")];
            const i = rader.findIndex(x => x.dataset.tprad === id);
            let mal = null;
            if (steg === "ned") { const n = rader[i + 1]; mal = n && n.querySelector('[data-tpfalt="' + (n.dataset.tprad === "ny" ? "namn" : falt) + '"]'); }
            if (steg === "hoger" || steg === "vanster") {
                const j = FO_TP_FALT.indexOf(falt) + (steg === "hoger" ? 1 : -1);
                mal = rader[i] && FO_TP_FALT[j] && rader[i].querySelector('[data-tpfalt="' + FO_TP_FALT[j] + '"].tp-e');
            }
            if (mal) foTpBorja(foTp(foP, tp.id), mal, foTpCtx());
        }, 20);
    };
    inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); spara("ned"); }
        if (e.key === "Tab") { e.preventDefault(); spara(e.shiftKey ? "vanster" : "hoger"); }
        if (e.key === "Escape") { e.preventDefault(); klar = true; foRita(); }
    });
    inp.addEventListener("blur", () => setTimeout(() => spara(null), 0));
    if (inp.tagName === "SELECT") inp.addEventListener("change", () => spara(null));
}
function foTpTolkaDatum(tp, text, bas) {
    const t = String(text).trim();
    let m;
    if ((m = t.match(/^([+-])\s*(\d+)$/))) return foTpArbPlus(tp, bas, (m[1] === "-" ? -1 : 1) * +m[2]);
    if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
    if ((m = t.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/))) {
        let ar = m[3] ? (m[3].length === 2 ? "20" + m[3] : m[3]) : bas.slice(0, 4);
        const iso = ar + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
        if (!m[3] && iso < foTpPlus(bas, -180)) return (+ar + 1) + iso.slice(4);
        return isNaN(new Date(iso)) ? "" : iso;
    }
    return "";
}
// kontext för fortsatt redigering efter omritning
function foTpCtx() {
    const tp = foTp(foP, foTpVal), s = foTpStruktur(tp.rader), nrAv = {};
    s.forEach((x, i) => { nrAv[x.r.id] = i + 1; });
    return { struktur: s, nrAv, redig: true };
}
function foTpDra(tp, el, e, c) {
    if (e.button !== 0) return;
    e.preventDefault();
    const id = el.dataset.tpstapel, r = tp.rader.find(x => x.id === id);
    if (!r) return;
    const hand = e.target.dataset.tphand || "";
    const x0 = e.clientX, left0 = el.offsetLeft, w0 = el.offsetWidth, dw = c.dw;
    let dx = 0;
    el.classList.add("drar"); document.body.classList.add("tp-drar");
    el.setPointerCapture(e.pointerId);
    const flytta = (ev) => {
        dx = Math.round((ev.clientX - x0) / dw);
        if (hand === "h") el.style.width = Math.max(dw, w0 + dx * dw) + "px";
        else if (hand === "v") { el.style.left = Math.min(left0 + w0 - dw, left0 + dx * dw) + "px"; el.style.width = Math.max(dw, w0 - dx * dw) + "px"; }
        else el.style.left = (left0 + dx * dw) + (el.classList.contains("fo-tp-milstolpe") ? 0 : 0) + "px";
    };
    const slapp = () => {
        el.removeEventListener("pointermove", flytta); el.removeEventListener("pointerup", slapp); el.removeEventListener("pointercancel", slapp);
        document.body.classList.remove("tp-drar");
        if (!dx) { el.classList.remove("drar"); foTpMark = id; foRita(); return; }
        const ny = (iso) => foTpArbPlus(tp, foTpNasta(tp, iso, 1), dx);
        let rad;
        if (r.typ === "mil") rad = { id, start: ny(r.start) };
        else if (hand === "h") { const s = foTpArbPlus(tp, foTpNasta(tp, r.slut, -1), dx); rad = { id, slut: s < r.start ? r.start : s }; }
        else if (hand === "v") { const s = foTpArbPlus(tp, foTpNasta(tp, r.start, 1), dx); rad = { id, start: s > r.slut ? r.slut : s }; }
        else rad = { id, start: ny(r.start), slut: foTpArbPlus(tp, foTpNasta(tp, r.slut, -1), dx) };
        foTpMark = id;
        foTpGor(tp, "tpRad", { rad }, true);
        if (tp.omplanering === "auto") foTpLosKonflikter(foTp(foP, tp.id), true);
        foRita();
    };
    el.addEventListener("pointermove", flytta); el.addEventListener("pointerup", slapp); el.addEventListener("pointercancel", slapp);
}
function foTpVerktyg(tp, vad) {
    const i = tp.rader.findIndex(r => r.id === foTpMark), r = tp.rader[i];
    if (vad === "mil") {
        const efter = r ? r.id : (tp.rader[tp.rader.length - 1] || {}).id;
        const start = r ? (r.typ === "mil" ? r.start : r.slut) || foIdag() : foIdag();
        const nyId = foId();
        if (foTpGor(tp, "tpRad", { rad: { id: nyId, namn: "Ny milstolpe", typ: "mil", niva: r ? r.niva || 0 : 0, start }, efter })) {
            foTpMark = nyId; foRita();
            setTimeout(() => { const n = document.querySelector('[data-tprad="' + nyId + '"] [data-tpfalt="namn"]'); if (n) foTpBorja(foTp(foP, tp.id), n, foTpCtx()); }, 20);
        }
        return;
    }
    if (!r) return status("Markera en rad först genom att klicka på dess nummer.", true);
    // ett block = raden och dess underrader
    let slut = i + 1; while (slut < tp.rader.length && (tp.rader[slut].niva || 0) > (r.niva || 0)) slut++;
    const ordning = tp.rader.map(x => ({ id: x.id, niva: x.niva || 0 }));
    if (vad === "in" || vad === "ut") {
        if (vad === "in" && (i === 0 || (r.niva || 0) > (tp.rader[i - 1].niva || 0))) return status("Raden ligger redan så långt in det går.", true);
        if (vad === "ut" && !(r.niva || 0)) return;
        for (let j = i; j < slut; j++) ordning[j].niva += vad === "in" ? 1 : -1;
        foTpGor(tp, "tpOrdning", { ordning }, true); return foRita();
    }
    if (vad === "upp" || vad === "ned") {
        const block = ordning.slice(i, slut);
        if (vad === "upp") {
            let j = i - 1; while (j > 0 && (ordning[j].niva || 0) > (r.niva || 0)) j--;
            if (j < 0) return;
            ordning.splice(i, block.length); ordning.splice(j, 0, ...block);
        } else {
            if (slut >= ordning.length) return;
            let k = slut + 1; while (k < ordning.length && (ordning[k].niva || 0) > (ordning[slut].niva || 0)) k++;
            ordning.splice(i, block.length); ordning.splice(k - block.length, 0, ...block);
        }
        foTpGor(tp, "tpOrdning", { ordning }, true); return foRita();
    }
    if (vad === "bort") {
        const ids = tp.rader.slice(i, slut).map(x => x.id);
        if (foTpGor(tp, "tpTaBort", { ids }, true)) { foTpMark = ""; foRita(); status(ids.length === 1 ? "Raden är borttagen. Ctrl+Z ångrar." : ids.length + " rader borttagna. Ctrl+Z ångrar."); }
        return;
    }
    if (vad === "mer") return foTpRadDialog(tp, r);
}
// detaljer för en rad: ansvar, medverkande, leverans, resultat, färg
function foTpRadDialog(tp, r) {
    const p = foP;
    modal(r.namn, "Detaljer",
        '<div class="tva"><div class="falt"><label for="foTdAnsv">Ansvarig</label>' + foPartSelect("foTdAnsv", r.ansv, "Ingen") + '</div>' +
        '<div class="falt"><label for="foTdTyp">Typ</label><select class="f" id="foTdTyp"><option value="akt">Aktivitet</option><option value="mil"' + (r.typ === "mil" ? " selected" : "") + '>Milstolpe</option></select></div></div>' +
        '<label class="fo-kryss"><input type="checkbox" id="foTdAktiv"' + (r.aktiv ? " checked" : "") + '> Aktiv leverans – bevakas, syns i ansvarigs översikt och i uppföljningen</label>' +
        '<div class="falt"><label for="foTdRes">Förväntat resultat eller leverans</label><input class="f" id="foTdRes" value="' + esc(r.resultat || "") + '" placeholder="Till exempel Planritningar BH"></div>' +
        '<div class="falt"><label>Färg</label><div class="fo-tp-fargval">' + FO_TP_FARGER.map(f => '<label class="fo-tp-farg tpc-' + (f || "gron") + '"><input type="radio" name="foTdFarg" value="' + f + '"' + ((r.farg || "") === f ? " checked" : "") + '><span></span></label>').join("") + '</div></div>', [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Spara", primar: true, fn: () => {
            const typ = document.getElementById("foTdTyp").value;
            const rad = { id: r.id, ansv: foPartFran(document.getElementById("foTdAnsv").value), aktiv: document.getElementById("foTdAktiv").checked, typ,
                resultat: document.getElementById("foTdRes").value, farg: (document.querySelector('input[name="foTdFarg"]:checked') || {}).value || "" };
            if (typ === "akt" && !r.slut) rad.slut = foTpSlutAv(tp, r.start || foIdag(), 5);
            foTpGor(tp, "tpRad", { rad }); stangModal();
        } }]);
}
// uppföljning av en rad i den fastställda tidplanen
function foTpUppfDialog(tp, radId) {
    const p = foP, r = tp.gallande.rader.find(x => x.id === radId), u = (tp.uppf || {})[radId] || {}, jag = foJagId();
    if (!r || !foKanSkriva(p, jag)) return;
    const leda = foTpLedare(p, jag), slut = r.typ === "mil" ? r.start : r.slut, st = foTpStatus(tp, r, foIdag());
    const hist = (tp.uhist || []).filter(h => h.rad === radId).slice(-8).reverse();
    modal(r.namn, "Fastställt " + (r.typ === "mil" ? r.start : r.start + " – " + r.slut) + (r.ansv ? " · " + foTpAnsvText(p, r.ansv) : ""),
        '<p class="hjalp" style="margin-top:0">Status nu: <b>' + FO_TP_LAGE[st].namn + '</b>. Det du rapporterar här ändrar aldrig den fastställda tidplanen.</p>' +
        '<div class="falt"><label>Bedömning</label><div class="fo-tp-lageval">' + [["", "Ej bedömd"], ["plan", "Enligt plan"], ["risk", "Risk för försening"], ["sen", "Konstaterad försening"]].map(([k, t]) =>
            '<label class="fo-kryss"><input type="radio" name="foTuLage" value="' + k + '"' + ((u.lage || "") === k ? " checked" : "") + '> ' + t + '</label>').join("") + '</div></div>' +
        '<div class="tva"><div class="falt"><label for="foTuProg">Prognos</label><input class="f" type="date" id="foTuProg" value="' + esc(u.prognos || "") + '"></div>' +
        '<div class="falt"><label for="foTuUtf">Genomförd</label><input class="f" type="date" id="foTuUtf" value="' + esc(u.utfall || "") + '"></div></div>' +
        (leda ? '<div class="falt"><label for="foTuKons">Konsekvens</label><select class="f" id="foTuKons">' + Object.keys(FO_TP_KONS).map(k => '<option value="' + k + '"' + ((u.konsekvens || "") === k ? " selected" : "") + '>' + FO_TP_KONS[k] + '</option>').join("") + '</select></div>' : "") +
        '<div class="falt"><label for="foTuKom">Kommentar</label><input class="f" id="foTuKom" value="' + esc(u.kommentar || "") + '"></div>' +
        (hist.length ? '<details class="fo-histdet"><summary>Historik (' + hist.length + ')</summary><ul class="fo-hist">' + hist.map(h => '<li><span>' + foNarText(h.tid) + '</span>' + esc(h.text) + ' <small>' + esc(foPersonNamn(p, h.av)) + '</small></li>').join("") + '</ul></details>' : ""), [
        { txt: "Genomförd idag", vanster: true, fn: () => { foGor("tpUppf", { tid: tp.id, rad: radId, utfall: foIdag() }); stangModal(); } },
        { txt: "Avbryt", fn: stangModal },
        { txt: "Spara", primar: true, fn: () => {
            const a = { tid: tp.id, rad: radId, lage: (document.querySelector('input[name="foTuLage"]:checked') || {}).value || "", prognos: document.getElementById("foTuProg").value,
                utfall: document.getElementById("foTuUtf").value, kommentar: document.getElementById("foTuKom").value };
            const k = document.getElementById("foTuKons"); if (k) a.konsekvens = k.value;
            foGor("tpUppf", a); stangModal();
        } }]);
}
function foTpNyDialog() {
    const p = foP, lista = (p.tidplaner || []).filter(t => !t.borttagen);
    modal("Ny tidplan", "Välj namn och arbetssätt – allt kan ändras senare",
        '<div class="falt"><label for="foTnNamn">Namn</label><input class="f" id="foTnNamn" placeholder="Projekteringstidplan"></div>' +
        '<div class="falt"><label>Arbetssätt</label><label class="fo-kryss"><input type="radio" name="foTnTyp" value="klassisk" checked> Klassisk – aktiviteter, datum, milstolpar och manuell uppföljning</label>' +
        '<label class="fo-kryss"><input type="radio" name="foTnTyp" value="aktiv"> Aktiv – med ansvariga, leveransbevakning och påminnelser</label></div>' +
        (lista.length ? '<div class="falt"><label for="foTnKopia">Utgå från</label><select class="f" id="foTnKopia"><option value="">Tom tidplan</option>' + lista.map(t => '<option value="' + t.id + '">Kopia av ' + esc(t.namn) + '</option>').join("") + '</select></div>' : ""), [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Skapa", primar: true, fn: () => {
            const k = document.getElementById("foTnKopia");
            const tp = foGor("tpNy", { id: foId(), namn: document.getElementById("foTnNamn").value, typ: (document.querySelector('input[name="foTnTyp"]:checked') || {}).value, kopiaAv: k ? k.value : "" });
            if (tp) { stangModal(); foTpVal = tp.id; foTpBankOppen = !tp.rader.length; if (foVy !== "tidplaner") foGaTill("tidplaner"); else foRita(); }
        } }]);
    setTimeout(() => document.getElementById("foTnNamn").focus(), 30);
}
function foTpInstDialog(tp) {
    modal("Inställningar", tp.namn,
        '<div class="falt"><label for="foTiNamn">Namn</label><input class="f" id="foTiNamn" value="' + esc(tp.namn) + '"></div>' +
        '<div class="falt"><label>Arbetssätt</label><label class="fo-kryss"><input type="radio" name="foTiTyp" value="klassisk"' + (tp.typ !== "aktiv" ? " checked" : "") + '> Klassisk</label>' +
        '<label class="fo-kryss"><input type="radio" name="foTiTyp" value="aktiv"' + (tp.typ === "aktiv" ? " checked" : "") + '> Aktiv – rader med ansvarig bevakas som leveranser</label></div>' +
        '<div class="falt"><label>Beroenden</label><label class="fo-kryss"><input type="radio" name="foTiOmpl" value="forslag"' + (tp.omplanering !== "auto" ? " checked" : "") + '> Visa konsekvenser och föreslå flytt (standard)</label>' +
        '<label class="fo-kryss"><input type="radio" name="foTiOmpl" value="auto"' + (tp.omplanering === "auto" ? " checked" : "") + '> Flytta efterföljande aktiviteter automatiskt i arbetsversionen</label></div>' +
        '<div class="falt"><label for="foTiFria">Arbetsfria dagar utöver helger <span class="hjalp">(ett datum per rad, t.ex. 2026-12-24)</span></label><textarea class="f" id="foTiFria" rows="4">' + esc((tp.fria || []).join("\n")) + '</textarea></div>', [
        { txt: "Ta bort tidplanen", vanster: true, fara: true, fn: () => { stangModal(); foFragaOrsak("Ta bort tidplanen", "Tidplanen döljs men finns kvar i historiken och projektexporten.", "Ta bort", o => foGor("tpInst", { id: tp.id, borttagen: true, orsak: o })); } },
        { txt: "Avbryt", fn: stangModal },
        { txt: "Spara", primar: true, fn: () => {
            if (foGor("tpInst", { id: tp.id, namn: document.getElementById("foTiNamn").value, typ: (document.querySelector('input[name="foTiTyp"]:checked') || {}).value,
                omplanering: (document.querySelector('input[name="foTiOmpl"]:checked') || {}).value, fria: document.getElementById("foTiFria").value.split(/\s+/).filter(Boolean) })) stangModal();
        } }]);
}
function foTpPublDialog(tp) {
    const forsta = !tp.gallande, andr = forsta ? [] : foTpJamfor(tp.gallande.rader, tp.rader);
    const kons = foTpKonflikter(tp);
    modal(forsta ? "Fastställ tidplanen" : "Publicera revision " + foTpRevBet(tp.revisioner.length), tp.namn,
        (forsta ? '<p>Tidplanen blir projektets gällande styrdokument. Därefter ändrar uppföljning och prognoser aldrig de fastställda tiderna. Ändringar görs genom en revidering.</p>' :
            '<div class="falt"><label for="foTpAnl">Anledning till revideringen</label><input class="f" id="foTpAnl" placeholder="Till exempel Ändrad bygglovsprocess"></div>' +
            '<p class="hjalp">' + andr.length + ' ändringar mot rev ' + esc(tp.gallande.rev) + ':</p><ul class="fo-tp-andr">' + andr.slice(0, 20).map(a => '<li>' + esc(a) + '</li>').join("") + (andr.length > 20 ? '<li>…</li>' : "") + '</ul>') +
        (kons.length ? '<p class="notis">' + kons.length + ' aktiviteter börjar innan det de beror på är klart. Du kan publicera ändå – det är din bedömning som gäller.</p>' : "") +
        '<p class="hjalp">Projektgruppen aviseras' + (forsta ? "" : " med en sammanfattning av ändringarna") + '.</p>', [
        { txt: "Avbryt", fn: stangModal },
        { txt: forsta ? "Fastställ" : "Publicera", primar: true, fn: () => {
            const anl = document.getElementById("foTpAnl");
            const r = foGor("tpPublicera", { tid: tp.id, anledning: anl ? anl.value : "" });
            if (r) { stangModal(); foTpAngra[tp.id] = []; status(forsta ? "Tidplanen är fastställd som rev " + r.rev + "." : "Revision " + r.rev + " är publicerad och gäller nu."); }
        } }]);
}

/* ---------- aktivitetsbanken (inspirationspanel) ---------- */
let foTpBankSok = "", foTpBankKat = "", foTpBankDisc = "", foTpBankSkede = "", foTpBankVal = new Set();
function foTpBankAlla(p) { return FO_TP_BANK.concat(p.tpBank || []); }
function foTpBankPanel(p) {
    const alla = foTpBankAlla(p);
    const kat = [...new Set(alla.map(x => x.kat))];
    const q = foTpBankSok.trim().toLowerCase();
    const l = alla.filter(x => (!foTpBankKat || x.kat === foTpBankKat) && (!foTpBankDisc || x.disc === foTpBankDisc) && (!foTpBankSkede || x.skede === foTpBankSkede) &&
        (!q || (x.namn + " " + x.kat + " " + x.resultat + " " + x.disc).toLowerCase().includes(q)));
    const disc = [...new Set(alla.map(x => x.disc).filter(Boolean))].sort();
    const grupper = {};
    l.slice(0, 400).forEach(x => { (grupper[x.kat] = grupper[x.kat] || []).push(x); });
    return '<aside class="fo-tp-bank" aria-label="Aktivitetsbank"><div class="fo-tp-bankhuvud"><b>Aktivitetsbank</b><button type="button" class="p4d-lank" id="foTpBankImp">Importera …</button></div>' +
        '<input class="f" id="foTpBankSok" placeholder="Sök aktivitet …" value="' + esc(foTpBankSok) + '">' +
        '<div class="fo-tp-bankfilter"><select class="f" id="foTpBankKat"><option value="">Alla kategorier</option>' + kat.map(k => '<option' + (k === foTpBankKat ? " selected" : "") + '>' + esc(k) + '</option>').join("") + '</select>' +
        '<select class="f" id="foTpBankDisc"><option value="">Disciplin</option>' + disc.map(k => '<option' + (k === foTpBankDisc ? " selected" : "") + '>' + esc(k) + '</option>').join("") + '</select>' +
        '<select class="f" id="foTpBankSkede"><option value="">Skede</option>' + Object.keys(FO_TP_SKEDEN).map(k => '<option value="' + k + '"' + (k === foTpBankSkede ? " selected" : "") + '>' + FO_TP_SKEDEN[k] + '</option>').join("") + '</select></div>' +
        '<div class="fo-tp-banklista">' + (Object.keys(grupper).length ? Object.keys(grupper).map(k => '<div class="fo-tp-bankgrupp"><div class="fo-tp-bankkat"><span>' + esc(k) + '</span><button type="button" class="p4d-lank" data-bankpaket="' + esc(k) + '" title="Lägg till hela kategorin som en grupp">+ alla ' + grupper[k].length + '</button></div>' +
            grupper[k].map(x => '<label class="fo-tp-bankrad" title="' + esc(x.resultat || "") + '"><input type="checkbox" data-bankval="' + x.id + '"' + (foTpBankVal.has(x.id) ? " checked" : "") + '><span>' + esc(x.namn) + '<small>' + [x.disc, FO_TP_SKEDEN[x.skede] || "", x.dagar ? x.dagar + " dgr" : "milstolpe", x.kalla === "projekt" ? "projektets" : ""].filter(Boolean).join(" · ") + '</small></span>' +
                '<button type="button" class="fo-tp-banklagg" data-banklagg="' + x.id + '" aria-label="Lägg till ' + esc(x.namn) + '">+</button></label>').join("") + '</div>').join("") : '<p class="hjalp">Inga träffar.</p>') + '</div>' +
        '<div class="fo-tp-bankfot"><button type="button" class="p4-btn p4-btn-primar" id="foTpBankLaggValda"' + (foTpBankVal.size ? "" : " disabled") + '>Lägg till valda (' + foTpBankVal.size + ')</button></div>' +
        '<p class="hjalp fo-tp-bankinfo">Raderna kopieras in och blir vanliga, redigerbara rader. Ändringar i banken ändrar aldrig befintliga tidplaner. Banken är ett stöd – den säger inte att en tidplan är komplett.</p></aside>';
}
function foTpBankTillRader(tp, poster, somGrupp) {
    const p = foP, efter = foTpMark || (tp.rader[tp.rader.length - 1] || {}).id;
    const ref = tp.rader.find(r => r.id === efter);
    const niva = ref ? (ref.niva || 0) : 0;
    let start = foTpNasta(tp, ref && (ref.slut || ref.start) ? foTpArbPlus(tp, ref.slut || ref.start, 1) : foIdag(), 1);
    const rader = [];
    if (somGrupp) rader.push({ id: foId(), namn: somGrupp, niva, typ: "akt", start, slut: start });
    poster.forEach(x => {
        const discObj = p.discipliner.find(d => d.kod.toUpperCase() === String(x.disc || "").toUpperCase());
        const r = { id: foId(), namn: x.namn, niva: niva + (somGrupp ? 1 : 0), typ: x.dagar ? "akt" : "mil", start, slut: x.dagar ? foTpSlutAv(tp, start, x.dagar) : "",
            ansv: discObj ? { disc: discObj.id } : null, resultat: x.resultat || "", bank: x.id, aktiv: false };
        rader.push(r);
        if (!somGrupp) start = foTpArbPlus(tp, r.slut || r.start, 1);
    });
    const n = foTpGor(tp, "tpRader", { rader, efter }, true);
    if (n) { foTpMark = rader[rader.length - 1].id; foTpBankVal.clear(); foRita(); status(n + (n === 1 ? " aktivitet tillagd." : " aktiviteter tillagda.") + " Justera datum direkt i raderna."); }
}
function foTpKopplaBank(yta, tp) {
    const p = foP, alla = () => foTpBankAlla(p);
    const sok = document.getElementById("foTpBankSok");
    if (!sok) return;
    let t = null;
    sok.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { foTpBankSok = sok.value; foRita(); setTimeout(() => { const s = document.getElementById("foTpBankSok"); if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); } }, 0); }, 200); });
    [["foTpBankKat", v => foTpBankKat = v], ["foTpBankDisc", v => foTpBankDisc = v], ["foTpBankSkede", v => foTpBankSkede = v]].forEach(([id, fn]) => {
        document.getElementById(id).addEventListener("change", (e) => { fn(e.target.value); foRita(); });
    });
    yta.querySelectorAll("[data-bankval]").forEach(k => k.addEventListener("change", () => { k.checked ? foTpBankVal.add(k.dataset.bankval) : foTpBankVal.delete(k.dataset.bankval); foRita(); }));
    yta.querySelectorAll("[data-banklagg]").forEach(b => b.addEventListener("click", (e) => { e.preventDefault(); const x = alla().find(y => y.id === b.dataset.banklagg); if (x) foTpBankTillRader(tp, [x]); }));
    yta.querySelectorAll("[data-bankpaket]").forEach(b => b.addEventListener("click", () => foTpBankTillRader(tp, alla().filter(x => x.kat === b.dataset.bankpaket), b.dataset.bankpaket)));
    document.getElementById("foTpBankLaggValda").addEventListener("click", () => foTpBankTillRader(tp, alla().filter(x => foTpBankVal.has(x.id))));
    document.getElementById("foTpBankImp").addEventListener("click", foTpBankImport);
}
// Massimport: klistra in från Excel (kolumner: Kategori, Aktivitet, Disciplin, Skede, Dagar, Resultat)
function foTpBankImport() {
    modal("Importera aktiviteter", "Till projektets aktivitetsbank",
        '<p class="hjalp" style="margin-top:0">Kopiera rader från Excel och klistra in här. Kolumner i ordning: <b>Kategori, Aktivitet, Disciplin, Skede, Dagar, Resultat</b>. Bara Aktivitet krävs. Skede: PS, SH, BH, FU, PR eller AV. Dubbletter hoppas över.</p>' +
        '<textarea class="f" id="foTbImp" rows="10" placeholder="Arkitektur&#9;Planritningar BH&#9;A&#9;BH&#9;20&#9;Planer"></textarea><p class="hjalp" id="foTbAntal"></p>', [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Importera", primar: true, fn: () => {
            const rader = foTpTolkaImport(document.getElementById("foTbImp").value);
            if (!rader.length) return status("Hittade inga rader att importera.", true);
            const n = foGor("tpBank", { rader });
            stangModal(); status((n || 0) + " aktiviteter importerades till projektets bank.");
        } }]);
    const ta = document.getElementById("foTbImp");
    ta.addEventListener("input", () => { document.getElementById("foTbAntal").textContent = foTpTolkaImport(ta.value).length + " rader hittade."; });
}
function foTpTolkaImport(text) {
    return String(text || "").split(/\r?\n/).map(r => r.split(r.includes("\t") ? "\t" : /;|\|/)).filter(c => c.length && c.join("").trim())
        .map(c => c.length === 1 ? { namn: c[0] } : { kat: c[0], namn: c[1], disc: c[2], skede: c[3], dagar: String(c[4] || "").replace(",", "."), resultat: c[5] })
        .filter(r => r.namn && r.namn.trim() && !/^aktivitet$/i.test(r.namn.trim()));
}

/* ---------- export och utskrift ---------- */
function foTpExportera(tp) {
    const p = foP, rader = foTpStruktur(foTpVisade(tp)), idag = foIdag();
    const rad = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const csv = "﻿" + ["Nr", "Nivå", "Aktivitet", "Typ", "Ansvarig", "Start", "Slut", "Arbetsdagar", "Efter", "Status", "Prognos", "Genomförd", "Resultat"].map(rad).join(";") + "\r\n" +
        rader.map((x, i) => { const u = (tp.uppf || {})[x.r.id] || {}; return [i + 1, x.r.niva || 0, x.r.namn, x.grupp ? "Grupp" : x.r.typ === "mil" ? "Milstolpe" : "Aktivitet", foTpAnsvText(p, x.r.ansv), x.start, x.r.typ === "mil" ? "" : x.slut,
            x.r.typ === "mil" ? 0 : foTpDagar(tp, x.start, x.slut), (x.r.fore || []).map(f => rader.findIndex(y => y.r.id === f) + 1).filter(n => n > 0).join(","),
            tp.gallande && !x.grupp ? FO_TP_LAGE[foTpStatus(tp, x.r, idag)].namn : "", u.prognos || "", u.utfall || "", x.r.resultat || ""].map(rad).join(";"); }).join("\r\n");
    foLaddaNer(foFilnamn(p.namn + "-" + tp.namn) + ".csv", csv, "text/csv;charset=utf-8");
}
function foTpSkrivDialog(tp) {
    const p = foP;
    modal("Skriv ut eller spara som PDF", tp.namn,
        '<div class="tva"><div class="falt"><label for="foTsFormat">Format</label><select class="f" id="foTsFormat">' + ["A4", "A3", "A2", "A1"].map(f => '<option' + (f === "A3" ? " selected" : "") + '>' + f + '</option>').join("") + '</select></div>' +
        '<div class="falt"><label for="foTsRikt">Riktning</label><select class="f" id="foTsRikt"><option value="landscape">Liggande</option><option value="portrait">Stående</option></select></div></div>' +
        '<div class="tva"><div class="falt"><label for="foTsFran">Från</label><input class="f" type="date" id="foTsFran"></div><div class="falt"><label for="foTsTill">Till</label><input class="f" type="date" id="foTsTill"></div></div>' +
        '<div class="falt"><label for="foTsDisc">Disciplin</label><select class="f" id="foTsDisc"><option value="">Alla</option>' + p.discipliner.filter(d => d.aktiv).map(d => '<option value="' + d.id + '">' + esc(d.kod + " " + d.namn) + '</option>').join("") + '</select></div>' +
        '<label class="fo-kryss"><input type="checkbox" id="foTsStatus"' + (tp.gallande ? " checked" : "") + '> Visa status (intern uppföljning)</label>', [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Förhandsgranska", primar: true, fn: () => {
            const v = id => document.getElementById(id).value;
            const html = foTpUtskrift(tp, { format: v("foTsFormat"), rikt: v("foTsRikt"), fran: v("foTsFran"), till: v("foTsTill"), disc: v("foTsDisc"), status: document.getElementById("foTsStatus").checked });
            stangModal(); foRapOppnaFonster(html, false);
        } }]);
}
function foTpUtskrift(tp, o) {
    const p = foP, idag = foIdag(), rev = tp.lage === "faststalld" && tp.gallande ? tp.gallande : null;
    let s = foTpStruktur(foTpVisade(tp));
    if (o.disc) s = s.filter(x => x.grupp || foTpAnsvDisc(p, x.r.ansv) === o.disc);
    const dat = s.flatMap(x => [x.start, x.slut]).filter(Boolean).sort();
    const fran = o.fran || dat[0] || idag, till = o.till || dat[dat.length - 1] || idag;
    const tot = Math.max(1, (new Date(till) - new Date(fran)) / 864e5 + 1);
    const pos = iso => Math.max(0, Math.min(100, ((new Date(iso) - new Date(fran)) / 864e5) / tot * 100));
    const manader = []; for (let d = new Date(fran.slice(0, 7) + "-01T12:00:00"); d <= new Date(till); d.setMonth(d.getMonth() + 1)) manader.push(d.toISOString().slice(0, 10));
    const k = p.personer.find(x => x.id === foJagId());
    return '<!doctype html><html lang="sv"><head><meta charset="utf-8"><title>' + esc(tp.namn) + '</title><style>' +
        '@page{size:' + o.format + ' ' + o.rikt + ';margin:12mm}*{box-sizing:border-box}body{font-family:Inter,Segoe UI,Arial,sans-serif;color:#1d1d1b;font-size:9pt;margin:0}' +
        'header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1.5pt solid #1d1d1b;padding-bottom:6pt;margin-bottom:8pt}h1{font-size:15pt;margin:0}.meta{font-size:8pt;color:#555;text-align:right}' +
        'table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border-bottom:.5pt solid #ccc;padding:2.5pt 4pt;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;height:15pt}th{font-size:7.5pt;text-transform:uppercase;color:#555;background:#f2f0ea}' +
        '.g td{font-weight:700;background:#faf9f6}.tl{position:relative;padding:0}.bar{position:absolute;top:3pt;bottom:3pt;background:#dcefe4;border:1pt solid #2f7d4f}.g .bar{background:#1d1d1b;border-color:#1d1d1b;top:5pt;bottom:5pt}' +
        '.mil{position:absolute;top:3pt;width:8pt;height:8pt;background:#1d1d1b;transform:rotate(45deg);margin-left:-4pt}.man{position:absolute;top:0;bottom:0;border-left:.5pt solid #ddd;font-size:7pt;color:#777;padding-left:2pt}.th-tl{position:relative}' +
        '@media screen{body{padding:16px}}</style></head><body><header><div><h1>' + esc(tp.namn) + '</h1>' + esc(p.namn) + '</div><div class="meta">' + (rev ? "Fastställd revision " + esc(rev.rev) + " · " + foDatumKort(rev.tid) : "Utkast – ej fastställd") +
        '<br>Utskriven ' + idag + (k ? " av " + esc(foPersonNamn(p, k.id)) : "") + (o.disc ? "<br>Disciplin " + esc(foDiscText(p, o.disc)) : "") + '</div></header>' +
        '<table><colgroup><col style="width:3%"><col style="width:24%"><col style="width:8%"><col style="width:7%"><col style="width:7%">' + (o.status ? '<col style="width:9%">' : "") + '<col></colgroup>' +
        '<thead><tr><th>#</th><th>Aktivitet</th><th>Ansvarig</th><th>Start</th><th>Slut</th>' + (o.status ? '<th>Status</th>' : "") + '<th class="th-tl">' +
        manader.filter(m => m >= fran || pos(foTpPlus(m.slice(0, 7) + "-01", 32).slice(0, 7) + "-01") > 8).map(m => '<span class="man" style="left:' + pos(m < fran ? fran : m) + '%">' + ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"][+m.slice(5, 7) - 1] + " " + m.slice(0, 4) + '</span>').join("") + '</th></tr></thead><tbody>' +
        s.map((x, i) => '<tr class="' + (x.grupp ? "g" : "") + '"><td>' + (i + 1) + '</td><td style="padding-left:' + (4 + (x.r.niva || 0) * 9) + 'pt">' + esc(x.r.namn) + '</td><td>' + esc(foTpAnsvText(p, x.r.ansv)) + '</td><td>' + (x.start || "") + '</td><td>' + (x.r.typ === "mil" ? "" : x.slut || "") + '</td>' +
            (o.status ? '<td>' + (!x.grupp && rev ? FO_TP_LAGE[foTpStatus(tp, x.r, idag)].namn : "") + '</td>' : "") + '<td class="tl">' +
            (x.start && x.start <= till && (x.slut || x.start) >= fran ? (x.r.typ === "mil" ? '<span class="mil" style="left:' + pos(x.start) + '%"></span>' :
                '<span class="bar" style="left:' + pos(x.start < fran ? fran : x.start) + '%;width:' + Math.max(.4, pos(x.slut > till ? till : x.slut) - pos(x.start < fran ? fran : x.start) + 100 / tot) + '%"></span>') : "") + '</td></tr>').join("") +
        '</tbody></table></body></html>';
}
