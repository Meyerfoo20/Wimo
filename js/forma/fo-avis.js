/* ======================================================================
   Wimo Forma · aviseringar, påminnelser och kvitteringar (kärnan)
   Samma kod används i webbläsaren och i servern som skickar mejl, så att
   arbetsytan, aviseringscentret och det dagliga mejlet bygger på samma logik.

   Tre nivåer:
   1. Arbetsytan (foArbetsyta) – det personen behöver hantera. Står kvar tills
      uppgiften är hanterad, oavsett om aviseringar lästs eller mejl skickats.
   2. Aviseringar i Forma (p.aviseringar) – händelser som berör personen.
   3. Mejl – daglig sammanställning (speglar arbetsytan) och direktmejl för
      de få händelser som är särskilt viktiga.
   ====================================================================== */

// Grundinställningar. mejl: "direkt" | "daglig" | "ingen" (bara i Forma). obl = kan inte stängas av.
const FO_AVIS_TYPER = {
    ny_fraga: { namn: "Ny tilldelad fråga", mejl: "daglig", agera: true },
    nytt_svar: { namn: "Nytt svar", mejl: "daglig", agera: true },
    komplettering: { namn: "Begärd komplettering", mejl: "daglig", agera: true },
    ny_ansvarig: { namn: "Ny ansvarig", mejl: "daglig", agera: true },
    svarsdatum: { namn: "Ändrat svarsdatum", mejl: "daglig" },
    klar: { namn: "Klarmarkerad fråga", mejl: "ingen" },
    rev_besked: { namn: "Reviderat slutligt besked", mejl: "direkt", obl: true, agera: true, kvitt: true },
    beslut_andrat: { namn: "Ändrat fastställt beslut", mejl: "direkt", obl: true, agera: true, kvitt: true },
    tid: { namn: "Uppmärksammad tidspåverkan", mejl: "direkt", obl: true, agera: true },
    kostnad: { namn: "Uppmärksammad kostnadspåverkan", mejl: "direkt", obl: true, agera: true },
    paminnelse: { namn: "Manuell påminnelse", mejl: "direkt", obl: true, agera: true },
    bradskande: { namn: "Särskilt brådskande fråga", mejl: "direkt", agera: true },
    kvittering: { namn: "Begärd kvittering", mejl: "direkt", agera: true },
    atgard: { namn: "Tilldelad åtgärd", mejl: "daglig", agera: true },
    atgard_disc: { namn: "Ny åtgärd i egen disciplin", mejl: "daglig" },
    protokoll: { namn: "Nytt eller reviderat protokoll", mejl: "daglig" },
    protokoll_viktigt: { namn: "Viktigt protokoll", mejl: "direkt" },
    atgard_utford: { namn: "Utförd åtgärd att följa upp", mejl: "daglig", agera: true },
    info: { namn: "Allmän projektinformation", mejl: "ingen" }
};
const FO_AVIS_MEJL = { direkt: "Direkt", daglig: "Daglig sammanställning", ingen: "Bara i Forma" };
const FO_AVIS_STD = { regler: {}, kvitt: {}, konsMottagare: [], fore: 2, eskalera: 3 };
const FO_AVIS_MAX = 400;

function foAvisInst(p) {
    p.avis = Object.assign({}, FO_AVIS_STD, p.avis || {});
    if (!p.avis.regler || typeof p.avis.regler !== "object") p.avis.regler = {};
    if (!p.avis.kvitt || typeof p.avis.kvitt !== "object") p.avis.kvitt = {};
    if (!Array.isArray(p.avis.konsMottagare)) p.avis.konsMottagare = [];
    return p.avis;
}
// Projektets regel för en händelse. Obligatoriska går alltid direkt.
function foAvisRegel(p, typ) {
    const t = FO_AVIS_TYPER[typ];
    if (!t) return "ingen";
    if (t.obl) return "direkt";
    return (p.avis && p.avis.regler && p.avis.regler[typ]) || t.mejl;
}
function foAvisKvittKrav(p, typ) {
    const t = FO_AVIS_TYPER[typ];
    if (!t || !t.kvitt) return false;
    const v = p.avis && p.avis.kvitt ? p.avis.kvitt[typ] : undefined;
    return v === undefined ? true : !!v;
}

/* ---------- mottagare ---------- */
// Disciplinens utsedda aviseringsmottagare. Saknas de går aviseringen till alla aktiva i disciplinen,
// så att inget faller mellan stolarna – och Forma visar att mottagare saknas.
function foDiscAvis(p, discId) {
    const d = foDisc(p, discId);
    const utsedda = d && Array.isArray(d.avis) ? d.avis.filter(id => { const x = foPerson(p, id); return x && x.aktiv; }) : [];
    if (utsedda.length) return utsedda;
    return p.personer.filter(x => x.aktiv && (x.disc || []).includes(discId)).map(x => x.id);
}
function foDiscSaknarAvis(p, discId) { const d = foDisc(p, discId); return !(d && Array.isArray(d.avis) && d.avis.length); }
function foAvisPersoner(p, parter) {
    const ut = [];
    (parter || []).forEach(m => {
        if (!m) return;
        if (m.person) ut.push(m.person);
        else if (m.disc) foDiscAvis(p, m.disc).forEach(id => ut.push(id));
    });
    return [...new Set(ut)].filter(id => { const x = foPerson(p, id); return x && x.aktiv; });
}
// Är personen en av dem som aviseras som svarsansvarig?
function foArSvarsansvarig(p, personId, f) { return !!personId && foAvisPersoner(p, foMottagare(f)).includes(personId); }

/* ---------- arbetsdagar ---------- */
function foArbetsdagarMellan(fran, till) {
    // positivt om till ligger efter fran; räknar måndag–fredag
    if (!fran || !till || fran === till) return 0;
    const tecken = till > fran ? 1 : -1;
    let a = new Date((tecken > 0 ? fran : till) + "T12:00:00"), b = new Date((tecken > 0 ? till : fran) + "T12:00:00"), n = 0;
    while (a < b) { a.setDate(a.getDate() + 1); if (a.getDay() !== 0 && a.getDay() !== 6) n++; }
    return n * tecken;
}

/* ---------- arbetsytan: vad behöver personen göra? ---------- */
// Samma lista används i Min översikt, Projektöversikten, klockan och det dagliga mejlet.
// kat: svara | komplettera | bedoma | kvittera | atgard | eskalera
function foArbetsyta(p, personId, idag) {
    idag = idag || foIdag();
    const ut = [];
    if (!personId) return ut;
    const inst = foAvisInst(p);
    const leda = foKanLeda(p, personId) || p.plId === personId;
    p.fragor.forEach(f => {
        if (f.makulerad) return;
        const dagar = f.svarSenast ? foArbetsdagarMellan(idag, f.svarSenast) : null;
        const tid = { senast: f.svarSenast || "", forsenad: !!(f.svarSenast && f.svarSenast < idag), sistaDag: f.svarSenast === idag, snart: dagar !== null && dagar > 0 && dagar <= inst.fore,
            dagarSen: f.svarSenast && f.svarSenast < idag ? foArbetsdagarMellan(f.svarSenast, idag) : 0 };
        const bas = { fid: f.id, nr: f.nr, text: f.text, bradskande: !!f.bradskande };
        if (f.lage === "obesvarad" && foArSvarsansvarig(p, personId, f) && !foSvarPoster(f).some(x => foPostLamnat(x) === personId))
            ut.push(Object.assign({ kat: "svara" }, bas, tid));
        if (f.lage === "ofullstandig" && foArSvarsansvarig(p, personId, f)) ut.push(Object.assign({ kat: "komplettera" }, bas, tid));
        if (f.lage === "besvarad" && foArStallare(p, personId, f) && !foOkvittSvar(f).length) {
            // Svar att bedöma: visa svaret, vem som svarade och när, direkt i listan.
            const sv = foSenasteSvar(f);
            ut.push(Object.assign({ kat: "bedoma" }, bas, { ejSlutligt: !foSlutliga(f).length,
                svar: sv ? { text: sv.text, av: foPostLamnat(sv), tid: sv.tid, bilagor: (f.bilagor || []).filter(b => b.del === "d:" + sv.id).length } : null }));
        }
        foOkvitterade(f).filter(r => foArPart(p, personId, r.mottagare) || (r.mottagare && r.mottagare.disc && foDiscAvis(p, r.mottagare.disc).includes(personId)))
            .forEach(r => ut.push(Object.assign({ kat: "kvittera", rev: r.id, vad: (r.ver === "tillagg" ? "Komplettering av " : "Revidering av ") + ({ fraga: "frågan", svar: "svar", beslut: "beslut" })[r.typ] }, bas)));
        if (leda && (f.lage === "obesvarad" || f.lage === "ofullstandig") && tid.dagarSen >= inst.eskalera)
            ut.push(Object.assign({ kat: "eskalera" }, bas, tid, { mottagare: foMottagareText(p, f) }));
    });
    (p.kvittkrav || []).forEach(k => {
        if (k.stangd || !(k.till || []).includes(personId) || (k.kvitt || {})[personId]) return;
        ut.push({ kat: "kvittera", kid: k.id, nr: k.obj && k.obj.typ === "fraga" ? (foFraga(p, k.obj.id) || {}).nr : "", text: k.titel, vad: "Begärd kvittering", fid: k.obj && k.obj.typ === "fraga" ? k.obj.id : "", obj: k.obj });
    });
    p.atgarder.forEach(a => {
        if (a.status === "kontroll" && a.uppfoljare === personId) { ut.push({ kat: "kontrollera", aid: a.id, nr: "Å-" + a.nr, text: a.text, vad: "Utförd – kontrollera och avsluta" }); return; }
        if (a.status !== "oppen" || !foAvisPersoner(p, [a.ansvarig]).includes(personId)) return;
        ut.push({ kat: "atgard", aid: a.id, nr: "Å-" + a.nr, text: a.text, senast: a.senast || "", forsenad: !!(a.senast && a.senast < idag), sistaDag: a.senast === idag });
    });
    // Kommande leveranser i fastställda tidplaner (aktiva rader där personen eller hens disciplin är ansvarig).
    if (typeof foTpLeveranser === "function") {
        const omTva = new Date(idag + "T12:00:00"); omTva.setDate(omTva.getDate() + 14);
        const grans = omTva.toISOString().slice(0, 10);
        foTpLeveranser(p, idag).forEach(l => {
            if (l.status === "klar" || !l.slut || l.slut > grans || !l.rad.ansv || !foAvisPersoner(p, [l.rad.ansv]).includes(personId)) return;
            ut.push({ kat: "leverans", obj: { typ: "tidplan", id: l.tp.id }, nr: "", text: l.rad.namn, senast: l.slut, forsenad: l.slut < idag,
                vad: l.tp.namn + (l.status === "passerad" ? " · passerat – bekräfta eller lämna prognos" : l.status === "risk" ? " · risk rapporterad" : "") });
        });
    }
    // Protokoll som personen ansvarar för och som behöver följas upp (protokollbevakning).
    if (typeof foBevakning === "function") (p.forum || []).filter(fo => fo.aktiv && fo.bevakning && fo.bevakning.ansvarig === personId).forEach(fo => {
        const b = foBevakning(p, fo, idag);
        if (b && b.lage === "folj") ut.push({ kat: "protokoll", obj: { typ: "forum", id: fo.id }, nr: fo.kort, text: fo.namn, vad: b.text });
    });
    const vikt = x => (x.forsenad ? 0 : x.sistaDag ? 1 : x.bradskande ? 2 : x.snart ? 3 : 4) * 10 + ({ eskalera: 0, kvittera: 1, svara: 2, komplettera: 2, bedoma: 3, kontrollera: 4, atgard: 4, leverans: 4, protokoll: 5 })[x.kat];
    return ut.sort((a, b) => vikt(a) - vikt(b) || (a.senast || "9999").localeCompare(b.senast || "9999") || (+a.nr || 0) - (+b.nr || 0));
}
const FO_ARB_RUB = { svara: "Nya frågor att besvara", komplettera: "Begärda kompletteringar", bedoma: "Svar att bedöma", kvittera: "Att kvittera",
    atgard: "Dina åtgärder", eskalera: "Försenade mer än några dagar – behöver uppmärksammas", kontrollera: "Åtgärder att kontrollera", leverans: "Kommande leveranser", protokoll: "Protokoll att följa upp" };
// Inväntar: sådant personen väntar på från andra. Räknas fram ur registren, ingen egen bevakningslista.
function foInvantar(p, personId, idag) {
    idag = idag || foIdag();
    const ut = [];
    if (!personId) return ut;
    p.fragor.forEach(f => {
        if (f.makulerad || !foArStallare(p, personId, f)) return;
        if (f.lage !== "obesvarad" && f.lage !== "ofullstandig") return;
        ut.push({ kat: f.lage === "ofullstandig" ? "invKompl" : "invSvar", fid: f.id, nr: f.nr, text: f.text, senast: f.svarSenast || "",
            forsenad: !!(f.svarSenast && f.svarSenast < idag), mottagare: foMottagareText(p, f) || "ingen mottagare vald" });
    });
    p.atgarder.forEach(a => {
        if (a.status !== "oppen" || a.uppfoljare !== personId || foAvisPersoner(p, [a.ansvarig]).includes(personId)) return;
        ut.push({ kat: "invAtgard", aid: a.id, nr: "Å-" + a.nr, text: a.text, senast: a.senast || "", forsenad: !!(a.senast && a.senast < idag), mottagare: foPartText(p, a.ansvarig) || "ingen ansvarig" });
    });
    (p.kvittkrav || []).forEach(k => {
        if (k.stangd || k.av !== personId) return;
        const kvar = (k.till || []).filter(id => !(k.kvitt || {})[id]);
        if (!kvar.length) return;
        ut.push({ kat: "invKvitt", obj: k.obj, fid: k.obj && k.obj.typ === "fraga" ? k.obj.id : "", nr: k.obj && k.obj.typ === "fraga" ? (foFraga(p, k.obj.id) || {}).nr : "", text: k.titel,
            mottagare: kvar.map(id => foPersonNamn(p, id)).join(", ") });
    });
    return ut.sort((a, b) => (b.forsenad - a.forsenad) || (a.senast || "9999").localeCompare(b.senast || "9999"));
}
const FO_INV_RUB = { invSvar: "Svar på mina frågor", invKompl: "Begärda kompletteringar", invAtgard: "Åtgärder jag följer upp", invKvitt: "Kvitteringar jag begärt" };

/* ---------- händelser ---------- */
function foAvisHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
// Lägger till en avisering. Den som orsakade händelsen aviseras inte om sig själv.
function foAvisera(p, ctx, typ, obj, till, text, extra) {
    if (!Array.isArray(p.aviseringar)) p.aviseringar = [];
    const mott = [...new Set((till || []).filter(Boolean))].filter(id => id !== ctx.av && foPerson(p, id));
    if (!mott.length) return null;
    const id = "a" + foAvisHash(ctx.tid + "|" + typ + "|" + (obj ? obj.typ + obj.id : "") + "|" + mott.join(","));
    if (p.aviseringar.some(x => x.id === id)) return null;
    const x = Object.assign({ id: id, typ: typ, tid: ctx.tid, av: ctx.av || "", till: mott, obj: obj || null, text: String(text || "").slice(0, 400) }, extra || {});
    p.aviseringar.push(x);
    // Aviseringarna är händelser, inte uppgifter: gamla rensas, uppgifterna finns kvar i arbetsytan och historiken.
    if (p.aviseringar.length > FO_AVIS_MAX) p.aviseringar.splice(0, p.aviseringar.length - FO_AVIS_MAX);
    return x;
}
function foPersonerIFraga(p, f, medBerorda) {
    return [...new Set([foStallarePerson(f)].concat(foAvisPersoner(p, foMottagare(f)), medBerorda ? (f.berordaP || []).concat(foAvisPersoner(p, (f.berorda || []).map(d => ({ disc: d })))) : []))].filter(Boolean);
}

// Läge före en operation, för att kunna se vad som ändrades.
function foAvisFore(p, op) {
    const a = op.a || {};
    if (op.typ === "registreraProtokoll") { const x = (p.protokoll || []).find(y => y.id === a.id); return { prot: x ? { version: x.version, status: x.status } : null }; }
    const f = a.id && (op.typ in FO_AVIS_HAKAR) ? foFraga(p, a.id) : null;
    return f ? { lage: f.lage, mott: foAvisPersoner(p, foMottagare(f)), senast: f.svarSenast, kons: f.konsekvens.length, slut: foSlutliga(f).map(x => x.id), revs: f.revs.length } : null;
}
// Körs efter varje operation (även när ändringar körs om ovanpå en nyare version) – därför deterministisk.
function foAvisHak(p, op, ctx, svar, fore) {
    const h = FO_AVIS_HAKAR[op.typ];
    if (!h) return;
    try { h(p, op.a || {}, ctx, svar, fore); } catch (e) { /* en avisering får aldrig stoppa själva ändringen */ }
}
const FO_AVIS_HAKAR = {
    nyFraga(p, a, ctx, f) {
        if (!f) return;
        f.bradskande = !!a.bradskande;
        const o = { typ: "fraga", id: f.id };
        foAvisera(p, ctx, f.bradskande ? "bradskande" : "ny_fraga", o, foAvisPersoner(p, foMottagare(f)), "Fråga " + f.nr + ": " + f.text, { nr: f.nr });
        const ber = (f.berordaP || []).concat(foAvisPersoner(p, (f.berorda || []).map(d => ({ disc: d })))).filter(id => !foAvisPersoner(p, foMottagare(f)).includes(id));
        foAvisera(p, ctx, "info", o, ber, "Du är berörd av fråga " + f.nr + ": " + f.text, { nr: f.nr });
    },
    fragaFalt(p, a, ctx, svar, fore) {
        const f = foFraga(p, a.id);
        if (!f || !fore) return;
        const o = { typ: "fraga", id: f.id }, nu = foAvisPersoner(p, foMottagare(f));
        const nya = nu.filter(id => !fore.mott.includes(id));
        if (nya.length) foAvisera(p, ctx, "ny_ansvarig", o, nya, "Du ska svara på fråga " + f.nr + ": " + f.text, { nr: f.nr });
        if (a.svarSenast !== undefined && fore.senast !== f.svarSenast) foAvisera(p, ctx, "svarsdatum", o, nu, "Nytt svarsdatum för fråga " + f.nr + ": " + (f.svarSenast || "inget datum"), { nr: f.nr });
        if (a.stallare && a.stallare !== ctx.av) foAvisera(p, ctx, "info", o, [a.stallare], "Fråga " + f.nr + " har överförts till dig", { nr: f.nr });
    },
    dialogPost(p, a, ctx, x, fore) {
        const f = foFraga(p, a.id);
        if (!f || !x) return;
        const o = { typ: "fraga", id: f.id };
        // Nya mottagare via "Skicka även till" på en följdfråga: de ska svara och aviseras som sådana.
        const nyaMott = x.typ === "foljd" && fore ? foAvisPersoner(p, foMottagare(f)).filter(id => !fore.mott.includes(id)) : [];
        let mott = [];
        if (x.typ === "svar") mott = [foStallarePerson(f)], foAvisera(p, ctx, "nytt_svar", o, mott, "Nytt svar på fråga " + f.nr + " från " + (foPersonNamn(p, foPostLamnat(x)) || "–"), { nr: f.nr });
        else if (fore && fore.lage !== "ofullstandig" && f.lage === "ofullstandig") mott = foAvisPersoner(p, foMottagare(f)).filter(id => !nyaMott.includes(id)), foAvisera(p, ctx, "komplettering", o, mott, "Följdfråga – komplettering begärd i fråga " + f.nr, { nr: f.nr });
        else mott = foPersonerIFraga(p, f, false).filter(id => !nyaMott.includes(id)), foAvisera(p, ctx, "info", o, mott, "Följdfråga i fråga " + f.nr, { nr: f.nr });
        if (nyaMott.length) foAvisera(p, ctx, "ny_ansvarig", o, nyaMott, "Följdfråga till dig i fråga " + f.nr + ": " + x.text, { nr: f.nr });
        // Övriga i "Skicka även till" får svaret eller följdfrågan för kännedom.
        const extra = foAvisPersoner(p, x.till || []).filter(id => !mott.includes(id) && !nyaMott.includes(id) && id !== ctx.av);
        if (extra.length) foAvisera(p, ctx, "info", o, extra, (x.typ === "svar" ? "Svar i fråga " : "Följdfråga i fråga ") + f.nr + " från " + (foPersonNamn(p, foPostLamnat(x)) || "–") + ": " + x.text, { nr: f.nr });
    },
    svara(p, a, ctx, svar, fore) {
        const f = foFraga(p, a.id);
        if (f && fore && f.dialog.length) foAvisera(p, ctx, "nytt_svar", { typ: "fraga", id: f.id }, [foStallarePerson(f)], "Nytt svar på fråga " + f.nr, { nr: f.nr });
    },
    dialogAndra(p, a, ctx, svar, fore) {
        const f = foFraga(p, a.id), x = f && (f.dialog || []).find(d => d.id === a.post);
        if (!f || !x || !fore || x.typ !== "svar") return;
        const sist = x.ver[x.ver.length - 1];
        if (sist.typ === "rattelse") return;
        // Reviderat slutligt besked: viktigt, direkt och med kvittering.
        if (x.slutligt || fore.slut.includes(x.id) || fore.lage === "klar") {
            const till = foPersonerIFraga(p, f, true);
            const av = foAvisera(p, ctx, "rev_besked", { typ: "fraga", id: f.id }, till, "Det slutliga beskedet i fråga " + f.nr + " är " + (sist.typ === "tillagg" ? "kompletterat" : "reviderat") + (sist.orsak ? ": " + sist.orsak : ""), { nr: f.nr });
            if (av && foAvisKvittKrav(p, "rev_besked")) foNyttKvittKrav(p, ctx, { typ: "fraga", id: f.id }, "Reviderat slutligt besked i fråga " + f.nr, av.till, "rev_besked");
        } else foAvisera(p, ctx, "info", { typ: "fraga", id: f.id }, [foStallarePerson(f)], "Svaret i fråga " + f.nr + " är ändrat", { nr: f.nr });
    },
    fragaText(p, a, ctx) {
        const f = foFraga(p, a.id);
        if (!f) return;
        const v = f.textVer[f.textVer.length - 1];
        if (v.typ === "rattelse") return;
        foAvisera(p, ctx, v.typ === "andring" && f.lage === "ofullstandig" ? "komplettering" : "info", { typ: "fraga", id: f.id }, foAvisPersoner(p, foMottagare(f)),
            "Fråga " + f.nr + " är " + (v.typ === "tillagg" ? "kompletterad" : "reviderad") + (v.orsak ? ": " + v.orsak : ""), { nr: f.nr });
    },
    sattLage(p, a, ctx, svar, fore) {
        const f = foFraga(p, a.id);
        if (!f || !fore || fore.lage === f.lage) return;
        const o = { typ: "fraga", id: f.id };
        if (f.lage === "ofullstandig") foAvisera(p, ctx, "komplettering", o, foAvisPersoner(p, foMottagare(f)), "Komplettering begärd i fråga " + f.nr + (a.kommentar ? ": " + a.kommentar : ""), { nr: f.nr });
        if (f.lage === "klar") foAvisera(p, ctx, "klar", o, foAvisPersoner(p, foMottagare(f)), "Fråga " + f.nr + " är klarmarkerad", { nr: f.nr });
        if (fore.lage === "klar" && f.lage !== "klar") foAvisera(p, ctx, "info", o, foAvisPersoner(p, foMottagare(f)), "Fråga " + f.nr + " är återöppnad", { nr: f.nr });
    },
    konsekvensMarkera(p, a, ctx, k) {
        const f = foFraga(p, a.id);
        if (!f || !k) return;
        const till = foPersonerIFraga(p, f, false).concat(foAvisInst(p).konsMottagare, p.plId ? [p.plId] : []);
        foAvisera(p, ctx, a.typ === "tid" ? "tid" : "kostnad", { typ: "fraga", id: f.id }, till,
            FO_KONS[a.typ] + " i fråga " + f.nr + " (" + (foPersonNamn(p, ctx.av) || "–") + ")" + (k.kommentar ? ": " + k.kommentar : ""), { nr: f.nr });
    },
    nyttBeslut(p, a, ctx, b) {
        if (!b || !a.ersatter) return;
        const g = foBeslut(p, a.ersatter), f = b.fragaId ? foFraga(p, b.fragaId) : null;
        const till = (f ? foPersonerIFraga(p, f, true) : []).concat(p.plId ? [p.plId] : [], g && g.av ? [g.av] : [], g && g.fattare ? [g.fattare] : []);
        const av = foAvisera(p, ctx, "beslut_andrat", { typ: "beslut", id: b.id }, till, "Beslut " + (g ? g.nr : "") + " är " + (b.satt === "kompletterar" ? "kompletterat" : "ersatt") + " av " + b.nr + ": " + b.text);
        if (av && foAvisKvittKrav(p, "beslut_andrat")) foNyttKvittKrav(p, ctx, { typ: "beslut", id: b.id }, "Ändrat beslut: " + b.nr, av.till, "beslut_andrat");
    },
    nyAtgard(p, a, ctx, x) {
        if (!x) return;
        const ansv = foAvisPersoner(p, [x.ansvarig]);
        foAvisera(p, ctx, "atgard", { typ: "atgard", id: x.id }, ansv, "Åtgärd Å-" + x.nr + ": " + x.text);
        // Övriga i disciplinen informeras (en åtgärd, en utförandeansvarig).
        const d = foAtgardDisc(p, x);
        if (d) foAvisera(p, ctx, "atgard_disc", { typ: "atgard", id: x.id }, p.personer.filter(y => y.aktiv !== false && (y.disc || []).includes(d) && !ansv.includes(y.id)).map(y => y.id),
            "Ny åtgärd för " + foDiscText(p, d) + ": Å-" + x.nr + " " + x.text);
    },
    registreraProtokoll(p, a, ctx, x, fore) {
        if (!x || x.makulerad) return;
        const tidigare = fore && fore.prot;
        if (tidigare && tidigare.version === x.version && tidigare.status === x.status) return;
        const fo = foForum(p, x.forum);
        const till = p.personer.filter(y => y.aktiv !== false && y.id !== ctx.av).map(y => y.id);
        foAvisera(p, ctx, a.direkt ? "protokoll_viktigt" : "protokoll", { typ: "protokoll", id: x.id }, till,
            (tidigare ? "Reviderat protokoll: " : "Nytt protokoll: ") + (fo ? fo.namn : "") + (x.nr ? " " + x.nr : "") + " " + (x.datum || ""));
    },
    atgardStatus(p, a, ctx) {
        const x = foAtgard(p, a.id);
        if (!x || !x.uppfoljare || x.uppfoljare === ctx.av) return;
        if (x.status === "kontroll") foAvisera(p, ctx, "atgard_utford", { typ: "atgard", id: x.id }, [x.uppfoljare], "Åtgärd Å-" + x.nr + " är utförd och väntar på din kontroll: " + x.text);
        else if (x.status === "klar") foAvisera(p, ctx, "atgard_utford", { typ: "atgard", id: x.id }, [x.uppfoljare], "Åtgärd Å-" + x.nr + " är utförd: " + x.text);
    },
    atgardFalt(p, a, ctx) {
        const x = foAtgard(p, a.id);
        if (x && a.ansvarig) foAvisera(p, ctx, "atgard", { typ: "atgard", id: x.id }, foAvisPersoner(p, [x.ansvarig]), "Åtgärd Å-" + x.nr + " är tilldelad dig: " + x.text);
    },
    nyttInlagg(p, a, ctx, x) {
        if (!x) return;
        const till = (x.personer || []).concat(foAvisPersoner(p, (x.disc || []).map(d => ({ disc: d }))));
        foAvisera(p, ctx, "info", { typ: "inlagg", id: x.id }, till, (foPersonNamn(p, ctx.av) || "Någon") + " nämnde dig i projektflödet: " + String(x.text || "").slice(0, 160));
    }
};

/* ---------- kvitteringskrav (gemensamt för hela Forma) ---------- */
// Kvittering = personen har aktivt bekräftat att hen tagit del av informationen. Aldrig ett godkännande.
function foObjVersion(p, obj) {
    const o = foObj(p, obj);
    if (!o) return "";
    if (obj.typ === "fraga") return "v" + o.textVer.length + "." + (o.dialog || []).reduce((s, x) => s + x.ver.length, 0);
    if (obj.typ === "beslut") return o.nr;
    if (obj.typ === "inlagg") return o.andrad || o.tid || "";
    if (obj.typ === "atgard") return "v" + (o.hist || []).length;
    return "";
}
function foNyttKvittKrav(p, ctx, obj, titel, till, orsak) {
    if (!Array.isArray(p.kvittkrav)) p.kvittkrav = [];
    const mott = [...new Set((till || []).filter(id => id && id !== ctx.av && foPerson(p, id)))];
    if (!mott.length) return null;
    const id = "k" + foAvisHash(ctx.tid + "|" + (obj ? obj.typ + obj.id : "") + "|" + mott.join(","));
    if (p.kvittkrav.some(k => k.id === id)) return null;
    const k = { id: id, obj: obj, titel: String(titel || "").slice(0, 300), version: foObjVersion(p, obj), tid: ctx.tid, av: ctx.av || "", till: mott,
        kvitt: {}, annat: {}, orsak: orsak || "manuell", stangd: false };
    p.kvittkrav.push(k);
    const o = foObj(p, obj);
    if (o && o.hist) foHist(o, ctx, "Kvittering begärd av " + mott.map(x => foPersonNamn(p, x)).join(", "));
    return k;
}
function foKvittKravFor(p, obj) { return (p.kvittkrav || []).filter(k => k.obj && obj && k.obj.typ === obj.typ && k.obj.id === obj.id); }

Object.assign(FO_OPS, {
    // Begär kvittering av vald information från valda personer.
    begarKvittering(p, a, ctx) {
        foKrav(!ctx.av || foKanSkriva(p, ctx.av) || foSuper(p, ctx.av), "Du kan inte begära kvittering i projektet.");
        foKrav(foObj(p, a.obj), "Det finns inget att kvittera.");
        const till = (a.till || []).filter(id => foPerson(p, id));
        foKrav(till.length, "Välj vem som ska kvittera.");
        const k = foNyttKvittKrav(p, Object.assign({}, ctx, { tid: ctx.tid }), a.obj, a.titel || foObjNamn(p, a.obj), till, "manuell");
        if (!k) return null;
        foAvisera(p, ctx, "kvittering", a.obj, k.till, "Kvittera: " + k.titel + (a.meddelande ? " – " + String(a.meddelande).slice(0, 200) : ""), { kid: k.id });
        foLogg(p, ctx, a.obj.id, "Kvittering begärd: " + k.titel);
        return k;
    },
    // Personlig kvittering. Ingen kan kvittera i någon annans namn – inte heller en superuser.
    kvitteraKrav(p, a, ctx) {
        const k = (p.kvittkrav || []).find(x => x.id === a.kid);
        foKrav(k, "Kvitteringen finns inte.");
        foKrav(ctx.av && k.till.includes(ctx.av), "Bara den som ska kvittera kan kvittera.");
        if (k.kvitt[ctx.av]) return null;
        k.kvitt[ctx.av] = { tid: ctx.tid, version: k.version };
        const o = foObj(p, k.obj);
        if (o && o.hist) foHist(o, ctx, "Kvitterad av " + foPersonNamn(p, ctx.av) + " (" + k.titel + ")");
        foLogg(p, ctx, k.obj.id, foPersonNamn(p, ctx.av) + " kvitterade: " + k.titel);
    },
    // Projekteringsledaren dokumenterar att informationen nått personen på annat sätt. Är inte en kvittering.
    kvittAnnat(p, a, ctx) {
        const k = (p.kvittkrav || []).find(x => x.id === a.kid);
        foKrav(k, "Kvitteringen finns inte.");
        foKrav(!ctx.av || foKanLeda(p, ctx.av) || foSuper(p, ctx.av), "Bara projekteringsledare och administratör kan dokumentera det.");
        foKrav(k.till.includes(a.person), "Personen ska inte kvittera den här informationen.");
        const hur = String(a.hur || "").trim();
        foKrav(hur, "Beskriv hur informationen kommunicerades, t.ex. på projekteringsmöte 3 dec.");
        k.annat[a.person] = { tid: ctx.tid, av: ctx.av, hur: hur };
        const o = foObj(p, k.obj);
        if (o && o.hist) foHist(o, ctx, "Kommunicerat till " + foPersonNamn(p, a.person) + " på annat sätt: " + hur + " (dokumenterat av " + foPersonNamn(p, ctx.av) + ", inte kvitterat av personen)");
    },
    // Manuell påminnelse om en eller flera frågor. Varje mottagare får bara sina frågor.
    paminn(p, a, ctx) {
        const ids = Array.isArray(a.fragor) ? a.fragor : [a.id];
        const fragor = ids.map(id => foFraga(p, id)).filter(f => f && !f.makulerad);
        foKrav(fragor.length, "Välj frågor att påminna om.");
        foKrav(!ctx.av || fragor.every(f => foArStallare(p, ctx.av, f) || foKanLeda(p, ctx.av) || foSuper(p, ctx.av) || p.plId === ctx.av),
            "Frågeställaren och projekteringsledaren kan skicka påminnelser.");
        const medd = String(a.meddelande || "").trim().slice(0, 1000);
        const per = {};
        fragor.forEach(f => {
            const till = Array.isArray(a.till) && fragor.length === 1 ? a.till : foAvisPersoner(p, foMottagare(f).filter(m => !foHarSvarat(p, f, m) || f.lage === "ofullstandig"));
            const mott = (till.length ? till : foAvisPersoner(p, foMottagare(f))).filter(id => id !== ctx.av);
            if (!Array.isArray(f.paminnelser)) f.paminnelser = [];
            if (!mott.length) return;
            f.paminnelser.push({ tid: ctx.tid, av: ctx.av, till: mott, meddelande: medd });
            foHist(f, ctx, "Påminnelse till " + mott.map(id => foPersonNamn(p, id)).join(", ") + (medd ? ": " + medd : ""));
            mott.forEach(id => { (per[id] = per[id] || []).push(f.id); });
        });
        const mottagare = Object.keys(per);
        foKrav(mottagare.length, "Det finns ingen att påminna – kontrollera vem som ska svara.");
        mottagare.forEach(id => {
            const fl = per[id].map(fid => foFraga(p, fid));
            foAvisera(p, ctx, "paminnelse", fl.length === 1 ? { typ: "fraga", id: fl[0].id } : null, [id],
                (fl.length === 1 ? "Påminnelse om fråga " + fl[0].nr : "Påminnelse om " + fl.length + " frågor: " + fl.map(f => f.nr).join(", ")) + (medd ? " – " + medd : ""),
                { fragor: per[id], meddelande: medd });
        });
        foLogg(p, ctx, fragor.length === 1 ? fragor[0].id : "", "Påminnelse skickad om " + (fragor.length === 1 ? "fråga " + fragor[0].nr : fragor.length + " frågor"));
        return { mottagare: mottagare.length, fragor: fragor.length };
    },
    bradskande(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        foKrav(!ctx.av || foArStallare(p, ctx.av, f) || foKanLeda(p, ctx.av) || foSuper(p, ctx.av), "Frågeställaren eller projekteringsledaren markerar brådskande.");
        const pa = !!a.pa;
        if (!!f.bradskande === pa) return null;
        f.bradskande = pa; f.andrad = ctx.tid;
        foHist(f, ctx, pa ? "Markerad som särskilt brådskande" : "Inte längre markerad som brådskande");
        if (pa) foAvisera(p, ctx, "bradskande", { typ: "fraga", id: f.id }, foAvisPersoner(p, foMottagare(f)), "Särskilt brådskande: fråga " + f.nr + " – " + f.text, { nr: f.nr });
    },
    // Projektets aviseringsregler (administratör och projekteringsledare).
    avisRegler(p, a, ctx) {
        foKrav(!ctx.av || foKanLeda(p, ctx.av), "Bara administratör och projekteringsledare ändrar aviseringsreglerna.");
        const inst = foAvisInst(p), andr = [];
        if (a.regel && FO_AVIS_TYPER[a.regel.typ] && !FO_AVIS_TYPER[a.regel.typ].obl && FO_AVIS_MEJL[a.regel.mejl]) {
            inst.regler[a.regel.typ] = a.regel.mejl; andr.push(FO_AVIS_TYPER[a.regel.typ].namn + ": " + FO_AVIS_MEJL[a.regel.mejl].toLowerCase());
        }
        if (a.kvitt && FO_AVIS_TYPER[a.kvitt.typ] && FO_AVIS_TYPER[a.kvitt.typ].kvitt) {
            inst.kvitt[a.kvitt.typ] = !!a.kvitt.pa; andr.push(FO_AVIS_TYPER[a.kvitt.typ].namn + ": " + (a.kvitt.pa ? "kvittering krävs" : "ingen kvittering") + " (gäller framåt)");
        }
        if (a.fore !== undefined) { inst.fore = Math.max(0, Math.min(10, Math.round(+a.fore || 0))); andr.push("Påminnelse " + inst.fore + " arbetsdagar före svarsdatum"); }
        if (a.eskalera !== undefined) { inst.eskalera = Math.max(1, Math.min(30, Math.round(+a.eskalera || 1))); andr.push("Uppmärksamma projekteringsledaren efter " + inst.eskalera + " arbetsdagars försening"); }
        if (Array.isArray(a.konsMottagare)) { inst.konsMottagare = a.konsMottagare.filter(id => foPerson(p, id)); andr.push("Mottagare vid tid/kostnad: " + (inst.konsMottagare.map(id => foPersonNamn(p, id)).join(", ") || "inga utöver frågans parter")); }
        if (!andr.length) return null;
        foLogg(p, ctx, "", "Aviseringsregler: " + andr.join(" · "));
    },
    discAvis(p, a, ctx) {
        foKrav(!ctx.av || foKanLeda(p, ctx.av), "Bara administratör och projekteringsledare väljer aviseringsmottagare.");
        const d = foDisc(p, a.id);
        foKrav(d, "Disciplinen finns inte.");
        d.avis = (a.personer || []).filter(id => foPerson(p, id));
        foLogg(p, ctx, "", "Aviseringsmottagare för " + d.kod + ": " + (d.avis.map(id => foPersonNamn(p, id)).join(", ") || "alla i disciplinen"));
    }
});
