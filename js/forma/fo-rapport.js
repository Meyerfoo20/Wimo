/* ======================================================================
   Wimo Forma · Rapporter & export
   Två delar:
   - Skapa rapport: välj rapporttyp, omfattning och urval, förhandsgranska,
     skriv ut/spara som PDF, exportera till Excel eller lås.
   - Rapportarkiv: låsta, daterade sammanställningar och de externt
     signerade dokument som hör till dem.

   En låst sammanställning sparas som en egen fil i det skick den hade när
   den låstes, med en kontrollsumma (SHA-256). Senare ändringar i projektets
   levande register påverkar den aldrig.
   Snabbexport (aktuell lista, aktuellt filter) finns kvar i respektive vy.
   ====================================================================== */

const FO_RAPPORTER = [
    { id: "fragor", namn: "Komplett frågeförteckning", text: "Alla frågor med svar, ansvarig och läge." },
    { id: "disciplin", namn: "Disciplinvis sammanställning", text: "Frågorna per ansvarig disciplin, med antal per läge." },
    { id: "beslut", namn: "Beslutslogg", text: "Fastställda beslut, gällande och ersatta." },
    { id: "rev", namn: "Revisionsförteckning", text: "Alla tillägg och ändringar i frågor, svar och beslut, med kvittens." },
    { id: "oppna", namn: "Öppna frågor", text: "Frågor som inte är klara, med svarsdatum och försenade först." },
    { id: "slutlig", namn: "Slutlig besluts- och ändringssammanställning", text: "Gällande beslut, ändringar i sak och frågor som kan påverka tid eller kostnad." },
    // Skapas från Möten & protokoll: de tekniska frågor som behandlades på ett möte.
    { id: "mote", namn: "Tekniska frågor från möte", text: "Frågorna som behandlades på mötet, med svar, status och beslut.", dold: true }
];
let foRapVal = { typ: "fragor", disc: "", fran: "", till: "", mak: false };

function foRapTyp(id) { return FO_RAPPORTER.find(r => r.id === id) || FO_RAPPORTER[0]; }

/* ---------- urval ---------- */
function foRapIPeriod(dag, v) {
    dag = foDag(dag);
    if (v.fran && (!dag || dag < v.fran)) return false;
    if (v.till && (!dag || dag > v.till)) return false;
    return true;
}
function foRapFragaDisc(p, f, disc) {
    if (!disc) return true;
    return f.fran === disc || f.berorda.includes(disc) ||
        foMottagare(f).some(m => m.disc === disc || foPersonDisc(p, m.person).includes(disc));
}
function foRapAnsvDisc(p, f) {
    const m = foMottagare(f)[0];
    if (!m) return "";
    if (m.disc) return m.disc;
    return foPersonDisc(p, m.person)[0] || "";
}
function foRapUrvalText(p, v) {
    if (v.typ === "mote") { const fo = foForum(p, v.forum); return [(fo ? fo.namn : "Möte") + (v.motesnr ? " " + v.motesnr : ""), "Mötesdatum " + (v.datum || "–")].join(" · "); }
    const d = v.disc ? foDisc(p, v.disc) : null;
    return [d ? "Disciplin " + d.kod + " – " + d.namn : "Alla discipliner",
        v.fran || v.till ? "Period " + (v.fran || "start") + " – " + (v.till || "idag") : "Hela projekttiden",
        v.mak ? "Makulerade frågor med" : ""].filter(Boolean).join(" · ");
}

/* ---------- innehåll per rapporttyp ---------- */
// Returnerar { sammanfattning: [[etikett, värde]], delar: [{ rub, kol, rader, tomt }], antal }.
function foRapData(p, v) {
    const idag = foIdag();
    const lageNamn = f => f.makulerad ? "Makulerad" : FO_LAGE[f.lage].namn;
    const fragor = p.fragor.filter(f => (v.mak || !f.makulerad) && foRapFragaDisc(p, f, v.disc) && foRapIPeriod(f.skapad, v)).sort((a, b) => a.nr - b.nr);
    const svarText = f => foSvarText(f) || (foHarSvar(f) ? "(" + foSvarPoster(f).length + " svar, slutligt svar inte valt)" : "–");
    const franText = f => (foPersonNamn(p, foStallarePerson(f)) || "–") + (f.fran ? " (" + foDiscText(p, f.fran) + ")" : "");
    const konsText = f => [foKonsAktiva(f, "tid").length ? "Tid" : "", foKonsAktiva(f, "kostnad").length ? "Kostnad" : ""].filter(Boolean).join(", ");
    const fragaRad = f => [f.nr, f.text, franText(f), foMottagareText(p, f) || "–", svarText(f), lageNamn(f) + (konsText(f) ? " · risk: " + konsText(f).toLowerCase() : ""), foDag(f.skapad)];
    const fragaKol = ["Nr", "Fråga", "Frågeställare", "Ska svara", "Slutligt svar", "Status", "Registrerad"];
    const beslutOk = b => {
        const f = b.fragaId ? foFraga(p, b.fragaId) : null;
        return foRapIPeriod(b.datum, v) && (!v.disc || (f && foRapFragaDisc(p, f, v.disc)));
    };
    const beslutRad = b => {
        const f = b.fragaId ? foFraga(p, b.fragaId) : null, fo = b.forum ? foForum(p, b.forum) : null;
        const ers = b.ersattAv ? foBeslut(p, b.ersattAv) : null, ersatter = b.ersatter ? foBeslut(p, b.ersatter) : null;
        return [b.nr, b.text + (ersatter ? " (" + (b.satt === "kompletterar" ? "kompletterar " : "ersätter ") + ersatter.nr + ")" : ""),
            f ? "Fråga " + f.nr : fo ? fo.namn : "–", foPersonNamn(p, b.fattare) || "–", b.datum || "",
            b.status === "gallande" ? "Gällande" : "Ersatt" + (ers ? " av " + ers.nr : "")];
    };
    const beslutKol = ["Nr", "Beslut", "Källa", "Beslutsfattare", "Datum", "Status"];
    const revs = () => {
        const ut = [];
        p.fragor.forEach(f => {
            if (f.makulerad && !v.mak) return;
            if (!foRapFragaDisc(p, f, v.disc)) return;
            f.revs.forEach(r => { if (foRapIPeriod(r.tid, v)) ut.push({ f, r }); });
        });
        return ut.sort((a, b) => a.f.nr - b.f.nr || a.r.nr - b.r.nr);
    };
    const revRad = ({ f, r }) => [f.nr, foRevNamn(r.nr), ({ fraga: "Fråga", svar: "Svar", beslut: "Beslut" })[r.typ] || r.typ,
        r.ver === "tillagg" ? "Tillägg" : "Ändring i sak", foDag(r.tid), foPersonNamn(p, r.av) || "–", foPartText(p, r.mottagare) || "–",
        r.kvitt ? (r.kvitt.auto ? "Ingen kvittens krävs" : "Kvitterad " + foDag(r.kvitt.tid) + " av " + (foPersonNamn(p, r.kvitt.av) || "–")) : "Ej kvitterad"];
    const revKol = ["Fråga", "Rev", "Avser", "Typ", "Datum", "Av", "Mottagare", "Kvittens"];

    const per = {};
    fragor.forEach(f => { per[f.lage] = (per[f.lage] || 0) + (f.makulerad ? 0 : 1); });
    const lageSum = () => [["Frågor", fragor.length], ["Obesvarade", per.obesvarad || 0], ["Ofullständiga svar", per.ofullstandig || 0],
        ["Besvarade", per.besvarad || 0], ["Klara", per.klar || 0], ["Försenade", fragor.filter(f => foForsenad(f, idag)).length]];

    if (v.typ === "mote") {
        const fo = foForum(p, v.forum) || {};
        const beh = p.fragor.filter(f => !f.makulerad && f.behandlad && f.behandlad[v.forum] === v.datum).sort((a, b) => a.nr - b.nr);
        const motesSvar = f => (f.dialog || []).filter(x => x.typ === "svar" && x.mote && x.mote.forum === v.forum && x.mote.datum === v.datum);
        const bes = p.beslut.filter(b => (b.forum === v.forum && b.datum === v.datum) || beh.some(f => f.id === b.fragaId && b.datum === v.datum));
        const regText = f => { const m = motesSvar(f); return m.length ? m.map(x => "På mötet: " + x.text + " (registrerat av " + (foPersonNamn(p, x.av) || "–") + (x.lamnat !== x.av ? ", lämnat av " + (foPersonNamn(p, x.lamnat) || "–") : "") + ")").join(" · ") : ""; };
        return { antal: beh.length, sammanfattning: [["Behandlade frågor", beh.length], ["Svar registrerade på mötet", beh.filter(f => motesSvar(f).length).length], ["Beslut", bes.length]],
            delar: [
                { rub: "Behandlade frågor – " + (fo.namn || "") + (v.motesnr ? " " + v.motesnr : ""), kol: ["Nr", "Fråga", "Frågeställare", "Ska svara", "Svar vid mötet", "Status"],
                    rader: beh.map(f => [f.nr, f.text, franText(f), foMottagareText(p, f) || "–", [svarText(f), regText(f)].filter(x => x && x !== "–").join(" · ") || "–", lageNamn(f)]), tomt: "Inga frågor markerades som behandlade detta datum." },
                { rub: "Beslut", kol: beslutKol, rader: bes.map(beslutRad), tomt: "Inga beslut registrerade på mötet." }
            ] };
    }
    if (v.typ === "fragor") return { antal: fragor.length, sammanfattning: lageSum(), delar: [{ rub: "Frågor", kol: fragaKol, rader: fragor.map(fragaRad), tomt: "Inga frågor i urvalet." }] };
    if (v.typ === "oppna") {
        const l = fragor.filter(f => !f.makulerad && f.lage !== "klar").sort((a, b) => (foForsenad(b, idag) ? 1 : 0) - (foForsenad(a, idag) ? 1 : 0) ||
            (a.svarSenast || "9999").localeCompare(b.svarSenast || "9999") || a.nr - b.nr);
        return { antal: l.length, sammanfattning: [["Öppna frågor", l.length], ["Försenade", l.filter(f => foForsenad(f, idag)).length],
            ["Att kvittera", l.filter(f => foOkvitterade(f).length).length]],
            delar: [{ rub: "Öppna frågor", kol: ["Nr", "Fråga", "Ansvarig", "Läge", "Svar senast", "Försenad"],
                rader: l.map(f => [f.nr, f.text, foMottagareText(p, f) || "–", lageNamn(f), f.svarSenast ? f.svarSenast + " (v. " + foVecka(f.svarSenast) + ")" : "–", foForsenad(f, idag) ? "Ja" : ""]), tomt: "Inga öppna frågor i urvalet." }] };
    }
    if (v.typ === "disciplin") {
        const disc = p.discipliner.slice().sort((a, b) => (a.ordning || 0) - (b.ordning || 0)).filter(d => !v.disc || d.id === v.disc);
        const grupper = disc.map(d => ({ d, l: fragor.filter(f => foRapAnsvDisc(p, f) === d.id) }));
        const utan = fragor.filter(f => !disc.some(d => d.id === foRapAnsvDisc(p, f)));
        const rakna = l => [l.length, l.filter(f => f.lage === "obesvarad" && !f.makulerad).length, l.filter(f => f.lage === "ofullstandig" && !f.makulerad).length,
            l.filter(f => f.lage === "besvarad" && !f.makulerad).length, l.filter(f => f.lage === "klar" && !f.makulerad).length, l.filter(f => foForsenad(f, idag)).length];
        const kol = ["Nr", "Fråga", "Från", "Läge", "Svar senast"];
        const rad = f => [f.nr, f.text, foDiscText(p, f.fran) || "–", lageNamn(f), f.svarSenast || "–"];
        return { antal: fragor.length, sammanfattning: lageSum(), delar: [
            { rub: "Översikt per disciplin", kol: ["Disciplin", "Totalt", "Obesvarade", "Ofullständiga", "Besvarade", "Klara", "Försenade"],
                rader: grupper.map(g => [g.d.kod + " – " + g.d.namn].concat(rakna(g.l))).concat(utan.length && !v.disc ? [["Utan ansvarig disciplin"].concat(rakna(utan))] : []), tomt: "Inga discipliner i projektet." }
        ].concat(grupper.filter(g => g.l.length).map(g => ({ rub: g.d.kod + " – " + g.d.namn, kol, rader: g.l.map(rad) })))
         .concat(utan.length && !v.disc ? [{ rub: "Utan ansvarig disciplin", kol, rader: utan.map(rad) }] : []) };
    }
    if (v.typ === "beslut") {
        const l = p.beslut.filter(beslutOk).sort((a, b) => (a.datum || "").localeCompare(b.datum || "") || (a.skapad || "").localeCompare(b.skapad || ""));
        return { antal: l.length, sammanfattning: [["Beslut", l.length], ["Gällande", l.filter(b => b.status === "gallande").length], ["Ersatta", l.filter(b => b.status !== "gallande").length]],
            delar: [{ rub: "Beslut", kol: beslutKol, rader: l.map(beslutRad), tomt: "Inga beslut i urvalet." }] };
    }
    if (v.typ === "rev") {
        const l = revs();
        return { antal: l.length, sammanfattning: [["Revisioner", l.length], ["Ändringar i sak", l.filter(x => x.r.ver !== "tillagg").length],
            ["Tillägg", l.filter(x => x.r.ver === "tillagg").length], ["Ej kvitterade", l.filter(x => !x.r.kvitt).length]],
            delar: [{ rub: "Revisioner", kol: revKol, rader: l.map(revRad), tomt: "Inga revisioner i urvalet." }] };
    }
    // slutlig
    const gall = p.beslut.filter(b => b.status === "gallande" && beslutOk(b)).sort((a, b) => (a.datum || "").localeCompare(b.datum || ""));
    const ersatta = p.beslut.filter(b => b.status !== "gallande" && beslutOk(b)).sort((a, b) => (a.datum || "").localeCompare(b.datum || ""));
    const andr = revs().filter(x => x.r.ver !== "tillagg");
    const pav = fragor.filter(f => f.paverkar && !f.makulerad);
    return { antal: gall.length + andr.length, sammanfattning: [["Gällande beslut", gall.length], ["Ersatta beslut", ersatta.length], ["Ändringar i sak", andr.length], ["Kan påverka tid/kostnad", pav.length]],
        delar: [
            { rub: "Gällande beslut", kol: beslutKol, rader: gall.map(beslutRad), tomt: "Inga gällande beslut." },
            { rub: "Ändringar i sak", kol: revKol, rader: andr.map(revRad), tomt: "Inga ändringar i sak." },
            { rub: "Frågor med risk för tid- eller kostnadspåverkan", kol: ["Nr", "Fråga", "Risk", "Markerad av", "Slutligt svar", "Status"], rader: pav.map(f => [f.nr, f.text, konsText(f),
                [...new Set(foKonsAktiva(f).map(k => foPersonNamn(p, k.av)))].join(", "), svarText(f), lageNamn(f)]), tomt: "Inga frågor markerade." },
            { rub: "Ersatta beslut", kol: beslutKol, rader: ersatta.map(beslutRad), tomt: "Inga ersatta beslut." }
        ] };
}

/* ---------- som dokument (förhandsgranskning, utskrift och låst fil) ---------- */
function foRapHtml(p, v, las) {
    const typ = foRapTyp(v.typ), d = foRapData(p, v);
    const cell = x => esc(x == null ? "" : String(x)).replace(/\n/g, "<br>");
    const tid = las ? las.tid : foNu();
    const rubrik = las ? las.titel : typ.namn;
    const delar = d.delar.map(del => '<section><h2>' + esc(del.rub) + ' <small>' + del.rader.length + '</small></h2>' +
        (del.rader.length ? '<table><thead><tr>' + del.kol.map(k => '<th>' + esc(k) + '</th>').join("") + '</tr></thead><tbody>' +
            del.rader.map(r => '<tr>' + r.map(cell).map(x => '<td>' + x + '</td>').join("") + '</tr>').join("") + '</tbody></table>'
            : '<p class="tomt">' + esc(del.tomt || "Inget att visa.") + '</p>') + '</section>').join("");
    return '<!DOCTYPE html><html lang="sv"><head><meta charset="utf-8"><title>' + esc(p.namn + " – " + rubrik) + '</title><style>' +
        'body{font:12px/1.45 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;margin:28px;color:#181c19;background:#fff}' +
        'header{border-bottom:2px solid #181c19;padding-bottom:12px;margin-bottom:16px}.proj{font-size:11px;color:#56615a;font-weight:600}' +
        'h1{font-size:20px;margin:2px 0 6px}.meta{color:#56615a;font-size:11px}.las{display:inline-block;margin-top:8px;border:2px solid #181c19;padding:3px 8px;font-weight:700;font-size:11px}' +
        '.sum{display:flex;flex-wrap:wrap;gap:0;border:1px solid #d6d2c8;margin:0 0 18px}.sum div{padding:8px 14px;border-right:1px solid #d6d2c8}.sum b{display:block;font-size:17px}.sum span{font-size:10.5px;color:#56615a}' +
        'h2{font-size:13px;margin:18px 0 6px}h2 small{color:#56615a;font-weight:500}table{width:100%;border-collapse:collapse;page-break-inside:auto}tr{page-break-inside:avoid}' +
        'th,td{border-bottom:1px solid #e2ded5;padding:5px 7px;text-align:left;vertical-align:top}th{font-size:10px;color:#56615a;font-weight:700;background:#f6f4ef}' +
        'td:first-child{font-weight:700;white-space:nowrap}.tomt{color:#56615a}footer{margin-top:24px;border-top:1px solid #d6d2c8;padding-top:8px;color:#56615a;font-size:10px}' +
        'table.info{margin:8px 0 0;width:auto;min-width:60%}table.info th{background:none;text-align:left;font-size:10px;padding:3px 10px 3px 0;white-space:nowrap;border:0}table.info td{border:0;padding:3px 18px 3px 0;font-weight:500 !important;white-space:normal}' +
        '.sign{page-break-inside:avoid;margin-top:26px}.signgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:28px 40px;margin-top:14px}.signruta{display:flex;flex-direction:column;gap:2px;font-size:11px}' +
        '.signruta .linje{border-bottom:1px solid #181c19;height:38px}.signruta .linje.kort{height:30px;width:60%}.signruta span{color:#56615a;font-size:10px}.signruta b{font-size:12px;margin-top:4px}' +
        '@media print{body{margin:12mm}}</style></head><body><header><div class="proj">' + esc(p.namn) + (p.nummer ? " · " + esc(p.nummer) : "") + '</div>' +
        '<h1>' + esc(rubrik) + '</h1><div class="meta">' + esc(typ.namn) + ' · ' + esc(foRapUrvalText(p, v)) + '</div>' +
        (las ? '<div class="las">Låst sammanställning ' + esc(las.nr) + (las.version > 1 ? " (version " + las.version + ")" : "") + ' · ' + esc(foDag(tid)) + ' ' + esc(foKlocka(tid)) + '</div>' +
            '<table class="info"><tr><th>Rapport-ID</th><td>' + esc(las.rapportId) + '</td><th>Skapad av</th><td>' + esc(las.avNamn) + '</td></tr>' +
            '<tr><th>Rapporttyp</th><td>' + esc(typ.namn) + '</td><th>Datum och tid</th><td>' + esc(foDag(tid) + " " + foKlocka(tid)) + '</td></tr>' +
            '<tr><th>Urval</th><td>' + esc(foRapUrvalText(p, v)) + '</td><th>Registerläge</th><td>' + esc(las.registerlage) + '</td></tr>' +
            (las.ersatterNr ? '<tr><th>Ersätter</th><td colspan="3">' + esc(las.ersatterNr) + ' (den tidigare versionen finns kvar i rapportarkivet)</td></tr>' : "") +
            (las.signerare && las.signerare.length ? '<tr><th>Avsedda signerande parter</th><td colspan="3">' + las.signerare.map(x => esc(x.namn + (x.roll ? ", " + x.roll : ""))).join("<br>") + '</td></tr>' : "") + '</table>' +
            (las.anteckning ? '<div class="meta" style="margin-top:6px">' + cell(las.anteckning) + '</div>' : "")
            : '<div class="meta">Förhandsgranskning ' + esc(foDag(tid)) + ' ' + esc(foKlocka(tid)) + ' · inte låst</div>') + '</header>' +
        '<div class="sum">' + d.sammanfattning.map(([e, n]) => '<div><b>' + esc(String(n)) + '</b><span>' + esc(e) + '</span></div>').join("") + '</div>' +
        delar + (las && las.signerare && las.signerare.length ? '<section class="sign"><h2>Signering</h2><p class="tomt">Signeras utanför Wimo, digitalt eller på papper. Ange rapport-ID ' + esc(las.rapportId) + ' vid signeringen.</p>' +
            '<div class="signgrid">' + las.signerare.map(x => '<div class="signruta"><div class="linje"></div><span>Underskrift</span><b>' + esc(x.namn) + '</b><span>' + esc(x.roll || "") + '</span><div class="linje kort"></div><span>Ort och datum</span></div>').join("") + '</div></section>' : "") +
        '<footer>' + (las ? "Rapport-ID " + esc(las.rapportId) + ". Låst i Wimo Forma. Innehållet speglar registret när sammanställningen låstes och påverkas inte av senare ändringar. " :
            "Utskrift från Wimo Forma. Innehållet speglar projektet just nu. ") + "Besked = svar från projektör. Beslut = fastställt av angiven beslutsfattare. Klara frågor är inte beslut." + '</footer></body></html>';
}
function foRapCsv(p, v) {
    const d = foRapData(p, v), rad = x => '"' + String(x == null ? "" : x).replace(/"/g, '""') + '"';
    let ut = "﻿" + [p.namn, foRapTyp(v.typ).namn, foRapUrvalText(p, v)].map(rad).join(";") + "\r\n";
    d.delar.forEach(del => { ut += "\r\n" + rad(del.rub) + "\r\n" + del.kol.map(rad).join(";") + "\r\n" + del.rader.map(r => r.map(rad).join(";")).join("\r\n") + "\r\n"; });
    return ut;
}
function foRapOppnaFonster(html, skrivUt) {
    const w = window.open("", "_blank");
    if (!w) return status("Webbläsaren stoppade fönstret. Tillåt popup-fönster för Wimo.", true);
    w.document.write(html);
    w.document.close();
    if (skrivUt) setTimeout(() => w.print(), 300);
}
async function foRapKontroll(text) {
    try {
        const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
        return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
    } catch (e) { return ""; }
}

/* ---------- vyn ---------- */
function foVyRapporter(yta) {
    const p = foP, jag = foJagId(), leda = foKanLeda(p, jag);
    const arkiv = p.rapporter || [];
    if (!["skapa", "arkiv"].includes(foFlik.rapport)) foFlik.rapport = "skapa";
    let html = foTopp("Rapporter & export");
    html += '<div class="fo-flikar" role="tablist">' +
        '<button type="button" role="tab" class="fo-flik' + (foFlik.rapport === "skapa" ? " vald" : "") + '" aria-selected="' + (foFlik.rapport === "skapa") + '" data-rapflik="skapa">Skapa rapport</button>' +
        '<button type="button" role="tab" class="fo-flik' + (foFlik.rapport === "arkiv" ? " vald" : "") + '" aria-selected="' + (foFlik.rapport === "arkiv") + '" data-rapflik="arkiv">Rapportarkiv <span>' + arkiv.length + '</span></button></div>';
    yta.innerHTML = html + '<div id="foRapYta"></div>';
    yta.querySelectorAll("[data-rapflik]").forEach(b => b.addEventListener("click", () => { foFlik.rapport = b.dataset.rapflik; foRita(); }));
    const inre = document.getElementById("foRapYta");
    if (foFlik.rapport === "arkiv") foRapArkiv(inre, leda); else foRapSkapa(inre, leda);
}

function foRapSkapa(yta, leda) {
    const p = foP, v = foRapVal;
    if (v.disc && !foDisc(p, v.disc)) v.disc = "";
    const disc = p.discipliner.filter(d => d.aktiv !== false).slice().sort((a, b) => (a.ordning || 0) - (b.ordning || 0));
    const data = foRapData(p, v);
    yta.innerHTML = '<div class="fo-rapskapa">' +
        '<div class="fo-rapval">' +
        '<div class="dashblock"><h3>Rapporttyp</h3><div class="fo-raptyper" role="radiogroup" aria-label="Rapporttyp">' +
        FO_RAPPORTER.filter(r => !r.dold).map(r => '<label class="fo-raptyp' + (r.id === v.typ ? " vald" : "") + '"><input type="radio" name="foRapTyp" value="' + r.id + '"' + (r.id === v.typ ? " checked" : "") + '>' +
            '<span><b>' + esc(r.namn) + '</b><small>' + esc(r.text) + '</small></span></label>').join("") + '</div></div>' +
        '<div class="dashblock"><h3>Omfattning och urval</h3>' +
        '<div class="falt"><label for="foRapDisc">Disciplin</label><select class="f" id="foRapDisc"><option value="">Alla discipliner</option>' +
        disc.map(d => '<option value="' + d.id + '"' + (d.id === v.disc ? " selected" : "") + '>' + esc(d.kod + " – " + d.namn) + '</option>').join("") + '</select></div>' +
        '<div class="fo-rapperiod"><div class="falt"><label for="foRapFran">Från</label><input class="f" type="date" id="foRapFran" value="' + esc(v.fran) + '"></div>' +
        '<div class="falt"><label for="foRapTill">Till</label><input class="f" type="date" id="foRapTill" value="' + esc(v.till) + '"></div></div>' +
        '<p class="hjalp" style="margin:-4px 0 10px">Tomt = hela projekttiden. Frågor räknas på registreringsdag, beslut på beslutsdag.</p>' +
        '<label class="fo-kryss"><input type="checkbox" id="foRapMak"' + (v.mak ? " checked" : "") + '> Ta med makulerade frågor</label></div>' +
        '<div class="dashblock"><h3>Hela projektet</h3><p class="hjalp">Hela projektet med historik i en fil, till exempel som säkerhetskopia. Bilagornas filer följer inte med.</p>' +
        '<button type="button" class="mknapp" id="foRapJson">Exportera projektet</button></div>' +
        '</div>' +
        '<div class="fo-rapforhand"><div class="fo-rapverktyg"><div><b>Förhandsgranskning</b><span class="hjalp"> · ' + data.antal + ' poster</span></div>' +
        '<div class="fo-knapprad"><button type="button" class="mknapp" id="foRapPdf" title="Öppnar utskrift – välj Spara som PDF">Skriv ut / PDF</button>' +
        '<button type="button" class="mknapp" id="foRapCsv" title="Öppnas i Excel">Exportera till Excel</button>' +
        (leda ? '<button type="button" class="p4-btn p4-btn-primar" id="foRapLas">Lås sammanställning …</button>' : "") + '</div></div>' +
        '<iframe class="fo-rapram" id="foRapRam" title="Förhandsgranskning"></iframe>' +
        (leda ? "" : '<p class="hjalp" style="margin-top:8px">Administratör och projekteringsledare kan låsa sammanställningen och lägga den i rapportarkivet.</p>') + '</div></div>';
    document.getElementById("foRapRam").srcdoc = foRapHtml(p, v);
    yta.querySelectorAll('input[name="foRapTyp"]').forEach(r => r.addEventListener("change", () => { v.typ = r.value; foRita(); }));
    document.getElementById("foRapDisc").addEventListener("change", e => { v.disc = e.target.value; foRita(); });
    document.getElementById("foRapFran").addEventListener("change", e => { v.fran = e.target.value; foRita(); });
    document.getElementById("foRapTill").addEventListener("change", e => { v.till = e.target.value; foRita(); });
    document.getElementById("foRapMak").addEventListener("change", e => { v.mak = e.target.checked; foRita(); });
    document.getElementById("foRapPdf").addEventListener("click", () => foRapOppnaFonster(foRapHtml(p, v), true));
    document.getElementById("foRapCsv").addEventListener("click", () => {
        foLaddaNer(foFilnamn(p.namn) + "-" + foFilnamn(foRapTyp(v.typ).namn).toLowerCase() + "-" + foIdag() + ".csv", foRapCsv(p, v), "text/csv;charset=utf-8");
        status("Rapporten exporterades. Öppna filen i Excel.");
    });
    document.getElementById("foRapJson").addEventListener("click", () => {
        foLaddaNer(foFilnamn(p.namn) + "-forma-" + foIdag() + ".json", JSON.stringify({ format: "wimo-forma", version: FO_VER, exporterad: foNu(), projekt: p }, null, 1), "application/json");
        status("Projektet exporterades.");
    });
    const las = document.getElementById("foRapLas"); if (las) las.addEventListener("click", foRapLasDialog);
}

// Registerläge: vad registret innehöll när sammanställningen låstes.
function foRapRegisterlage(p, tid) {
    const fr = p.fragor.filter(f => !f.makulerad);
    return foDag(tid) + " " + foKlocka(tid) + " – " + fr.length + " frågor (" + fr.filter(foAktiv).length + " aktiva, " + fr.filter(f => f.lage === "klar").length + " klara), " +
        p.beslut.length + " beslut, " + p.logg.length + " händelser i projektloggen";
}
let foRapNyVersion = "";
function foRapLasDialog() {
    const p = foP, v = Object.assign({}, foRapVal), typ = foRapTyp(v.typ);
    const fore = foRapNyVersion ? p.rapporter.find(x => x.id === foRapNyVersion) : null;
    const forslag = fore ? fore.titel.replace(/ \(version \d+\)$/, "") + " (version " + ((fore.version || 1) + 1) + ")" : (v.typ === "mote" ? ((foForum(p, v.forum) || {}).kort || "") + (v.motesnr || "") + " – Tekniska frågor " + v.datum : typ.namn + " " + foIdag());
    let signerare = fore ? fore.signerare.map(x => x.person ? { person: x.person } : null).filter(Boolean) : [];
    let ovriga = fore ? fore.signerare.filter(x => !x.person).map(x => x.namn + (x.roll ? ", " + x.roll : "")).join("\n") : "";
    const kropp = '<p class="hjalp" style="margin-top:0">Sammanställningen sparas som den ser ut nu, med rapport-ID, datum, registerläge och kontrollsumma. ' +
        'Senare ändringar i projektet påverkar den inte, och den kan inte ändras i efterhand – inte heller av en superuser.</p>' +
        (fore ? '<div class="notis">Ny version av ' + esc(fore.nr) + '. Den tidigare versionen och eventuella signerade dokument finns kvar.</div>' : "") +
        '<div class="falt"><label for="foRapTitel">Titel</label><input class="f" id="foRapTitel" value="' + esc(forslag) + '" maxlength="140"></div>' +
        '<div class="falt"><label>Avsedda signerande parter <span class="hjalp">(valfritt)</span></label><div id="foRapSignRuta"></div></div>' +
        '<div class="falt"><label for="foRapSignOvr">Övriga parter <span class="hjalp">en per rad, t.ex. Beställarens ombud, Exempel AB</span></label><textarea class="f" id="foRapSignOvr" rows="2">' + esc(ovriga) + '</textarea></div>' +
        '<div class="falt"><label for="foRapAnt">Anteckning <span class="hjalp">(valfritt)</span></label><textarea class="f" id="foRapAnt" rows="2" placeholder="Till exempel: Avslutad systemhandling">' + esc(fore ? fore.anteckning : "") + '</textarea></div>' +
        '<div class="notis">' + esc(typ.namn) + ' · ' + esc(foRapUrvalText(p, v)) + '</div><div id="foRapLasFel"></div>';
    let pagar = false;
    modal(fore ? "Ny version av " + fore.nr : "Lås sammanställning", "Läggs i rapportarkivet", kropp, [
        { txt: "Avbryt", fn: () => { foRapNyVersion = ""; stangModal(); } },
        { txt: "Lås", primar: true, fn: async () => {
            if (pagar) return;
            const titel = document.getElementById("foRapTitel").value.trim();
            if (!titel) { document.getElementById("foRapLasFel").innerHTML = '<div class="notis rod">Ge sammanställningen en titel.</div>'; return; }
            pagar = true;
            const anteckning = document.getElementById("foRapAnt").value.trim();
            const sign = signerare.map(x => { const pr = foPerson(p, x.person), ft = pr ? foForetag(p, pr.foretagId) : null;
                return { person: x.person, namn: foPersonNamn(p, x.person), roll: [pr && pr.befattning, ft && ft.namn].filter(Boolean).join(", ") }; })
                .concat(document.getElementById("foRapSignOvr").value.split("\n").map(r => r.trim()).filter(Boolean).map(r => { const d = r.split(","); return { person: "", namn: d[0].trim(), roll: d.slice(1).join(",").trim() }; }));
            const id = foId(), nr = "S-" + ((p.seq.rapport || 0) + 1), tid = foNu();
            const rapportId = (foFilnamn(p.nummer || "FORMA").toUpperCase()) + "-" + nr + "-" + id.slice(0, 6).toUpperCase();
            const registerlage = foRapRegisterlage(p, tid);
            const html = foRapHtml(p, v, { nr: nr, titel: titel, anteckning: anteckning, tid: tid, avNamn: foPersonNamn(p, foJagId()) || "", rapportId: rapportId,
                registerlage: registerlage, signerare: sign, version: fore ? (fore.version || 1) + 1 : 1, ersatterNr: fore ? fore.nr : "" });
            const kontroll = await foRapKontroll(html);
            const fil = new File([html], foFilnamn(nr + " " + titel) + ".html", { type: "text/html" });
            const meta = await foSparaFiler([fil]);
            if (!meta.length) { pagar = false; document.getElementById("foRapLasFel").innerHTML = '<div class="notis rod">Sammanställningen kunde inte sparas. Gör urvalet mindre och försök igen.</div>'; return; }
            const r = foGor("lasRapport", { id: id, typ: v.typ, titel: titel, anteckning: anteckning, urval: v, urvalText: foRapUrvalText(p, v), rapportId: rapportId, registerlage: registerlage,
                signerare: sign, ersatter: fore ? fore.id : "", antal: foRapData(p, v).antal, fil: meta[0], kontroll: kontroll }, true);
            if (!r) { pagar = false; return; }
            foRapNyVersion = "";
            // Mötessammanställningen kopplas till mötets protokoll, även om protokollet registreras senare.
            if (v.typ === "mote") {
                const pr = (foP.protokoll || []).find(x => x.forum === v.forum && x.datum === v.datum && !x.makulerad);
                if (pr) foGor("registreraProtokoll", Object.assign({}, pr, { sammanstallning: r.id }), true);
            }
            stangModal();
            foFlik.rapport = "arkiv";
            foRita();
            status("Sammanställning " + r.nr + " är låst och ligger i rapportarkivet." + (r.signerare.length ? " Skriv ut den med signaturfält under Skriv ut / PDF." : ""));
        } }
    ]);
    const ritaSign = () => {
        const el = document.getElementById("foRapSignRuta"); if (!el) return;
        el.innerHTML = foPartValjare("foRapSign", signerare, { disc: false, tomText: "Välj projektmedlemmar …", merText: "+ Fler" });
        foKopplaPartValjare(el, "foRapSign", signerare, (l) => { signerare = l; ritaSign(); });
    };
    ritaSign();
    setTimeout(() => { const t = document.getElementById("foRapTitel"); if (t) t.select(); }, 30);
}

function foRapStatus(r) {
    if (r.status === "makulerad") return '<span class="fo-lage mak"><i aria-hidden="true"></i>Makulerad</span>';
    const ers = r.ersattAv ? '<span class="fo-tagg t-rev" title="Det finns en nyare version">Ny version finns</span>' : "";
    if (r.signerade.length) return '<span class="fo-lage klar"><i aria-hidden="true"></i>Signerad' + (r.signerade.length > 1 ? " (" + r.signerade.length + ")" : "") + '</span>' + ers;
    if ((r.signerare || []).length) return '<span class="fo-lage ofullstandig"><i aria-hidden="true"></i>Inväntar signering</span>' + ers;
    return '<span class="fo-lage besvarad"><i aria-hidden="true"></i>Låst</span>' + ers;
}
function foRapArkiv(yta, leda) {
    const p = foP, l = (p.rapporter || []).slice().sort((a, b) => (b.tid || "").localeCompare(a.tid || ""));
    if (!l.length) {
        yta.innerHTML = foTomt("Inga låsta sammanställningar ännu", "Skapa en rapport under <b>Skapa rapport</b> och välj <b>Lås sammanställning</b>. " +
            "Den hamnar här med datum och nummer, och det externt signerade dokumentet kan sedan laddas upp och kopplas till den.");
        return;
    }
    yta.innerHTML = '<div class="fo-tabellram"><table class="lista fo-tabell"><thead><tr><th class="fo-nrkol">Nr</th><th>Sammanställning</th><th>Låst</th><th>Signerade dokument</th><th>Status</th></tr></thead><tbody>' +
        l.map(r => '<tr data-rad="' + r.id + '" data-rapport="' + r.id + '" tabindex="0" class="' + (r.status === "makulerad" ? "utford" : "") + '"><td class="fo-nrkol"><b>' + esc(r.nr) + '</b></td>' +
            '<td><span class="fo-fragetext">' + esc(r.titel) + '</span><small>' + esc(foRapTyp(r.typ).namn) + ' · ' + esc(r.urvalText || "") + '</small></td>' +
            '<td class="dat">' + foDatumKort(r.tid) + ' ' + foKlocka(r.tid) + '<small>' + esc(foPersonNamn(p, r.av) || "") + '</small></td>' +
            '<td>' + (r.signerade.length ? r.signerade.map(s => esc(s.namn)).join("<br>") : '<span class="hjalp">–</span>') + '</td>' +
            '<td>' + foRapStatus(r) + '</td></tr>').join("") + '</tbody></table></div>';
    yta.querySelectorAll("tr[data-rapport]").forEach(tr => {
        const r = () => p.rapporter.find(x => x.id === tr.dataset.rapport);
        tr.addEventListener("click", () => foRapVisa(r(), leda));
        tr.addEventListener("keydown", e => { if (e.key === "Enter") foRapVisa(r(), leda); });
    });
}
async function foRapLasFil(r) {
    const x = await foHamtaFil(r.fil);
    if (!x) { status("Sammanställningen finns inte på den här datorn och kunde inte hämtas från molnet.", true); return null; }
    try { return await (await fetch(x.data)).text(); } catch (e) { status("Sammanställningen kunde inte läsas.", true); return null; }
}
function foRapVisa(r, leda) {
    if (!r) return;
    const p = foP, kanLadda = leda && r.status !== "makulerad";
    const ersatter = r.ersatter ? p.rapporter.find(x => x.id === r.ersatter) : null, ersattAv = r.ersattAv ? p.rapporter.find(x => x.id === r.ersattAv) : null;
    const kropp = '<ul class="detalj">' + (r.rapportId ? '<li><span class="et">Rapport-ID</span><span>' + esc(r.rapportId) + '</span></li>' : "") +
        '<li><span class="et">Rapporttyp</span><span>' + esc(foRapTyp(r.typ).namn) + '</span></li>' +
        (r.registerlage ? '<li><span class="et">Registerläge</span><span>' + esc(r.registerlage) + '</span></li>' : "") +
        ((r.signerare || []).length ? '<li><span class="et">Ska signeras av</span><span>' + r.signerare.map(x => esc(x.namn + (x.roll ? ", " + x.roll : ""))).join("<br>") + '</span></li>' : "") +
        (ersatter ? '<li><span class="et">Ersätter</span><span>' + esc(ersatter.nr + " · " + ersatter.titel) + '</span></li>' : "") +
        (ersattAv ? '<li><span class="et">Ny version</span><span>' + esc(ersattAv.nr + " · " + ersattAv.titel) + '</span></li>' : "") +
        '<li><span class="et">Urval</span><span>' + esc(r.urvalText || "–") + '</span></li>' +
        '<li><span class="et">Låst</span><span>' + esc(foDag(r.tid) + " " + foKlocka(r.tid)) + " av " + esc(foPersonNamn(p, r.av) || "–") + '</span></li>' +
        (r.anteckning ? '<li><span class="et">Anteckning</span><span>' + esc(r.anteckning) + '</span></li>' : "") +
        '<li><span class="et">Status</span><span>' + foRapStatus(r) + '</span></li>' +
        (r.makulerad ? '<li><span class="et">Makulerad</span><span>' + esc(r.makulerad.orsak) + " · " + esc(foDag(r.makulerad.tid)) + '</span></li>' : "") +
        '<li><span class="et">Kontrollsumma</span><span class="fo-kontroll" id="foRapKoll" title="SHA-256">' + esc((r.kontroll || "–").slice(0, 16)) + (r.kontroll ? "…" : "") + '</span></li></ul>' +
        '<h4 class="fo-raph4">Signerade dokument</h4>' +
        (r.signerade.length ? '<ul class="fo-signlista">' + r.signerade.map(s => '<li><div id="foSig-' + esc(s.id) + '">' + foBilagorHtml([s]) + '</div><small>' +
            esc([s.parter ? "Signerat av " + s.parter : "", "uppladdat " + foDag(s.uppladdad) + " av " + (foPersonNamn(p, s.av) || "–")].filter(Boolean).join(" · ")) + '</small>' +
            (leda ? '<button type="button" class="p4d-lank" data-sigbort="' + esc(s.id) + '">Ta bort</button>' : "") + '</li>').join("") + '</ul>'
            : '<p class="hjalp">Inget signerat dokument ännu. Signeringen görs utanför Wimo. Ladda sedan upp det signerade dokumentet här.</p>') +
        (kanLadda ? '<div class="falt" style="margin-top:10px"><label for="foSigParter">Signerat av <span class="hjalp">(valfritt)</span></label><input class="f" id="foSigParter" placeholder="Till exempel: Beställare, A, K"></div>' +
            foFilZon("foSigFil", "Dra hit eller välj det signerade dokumentet (PDF)") : "");
    const knappar = [];
    if (leda && r.status !== "makulerad") knappar.push({ txt: "Makulera …", vanster: true, fn: () => {
        stangModal();
        foFragaOrsak("Makulera " + r.nr, "Sammanställningen ligger kvar i arkivet, märkt som makulerad. Den går inte att ändra.", "Makulera", (orsak) => {
            if (foGor("makuleraRapport", { id: r.id, orsak: orsak })) status(r.nr + " är makulerad.");
        });
    } });
    if (leda && r.status !== "makulerad" && !r.ersattAv) knappar.push({ txt: "Ny version …", vanster: true, fn: () => {
        stangModal(); foRapNyVersion = r.id; foRapVal = Object.assign({ typ: "fragor", disc: "", fran: "", till: "", mak: false }, r.urval || {}); foFlik.rapport = "skapa"; foRita();
        setTimeout(foRapLasDialog, 50);
    } });
    knappar.push({ txt: "Skriv ut / PDF", fn: async () => { const t = await foRapLasFil(r); if (t) foRapOppnaFonster(t, true); } });
    knappar.push({ txt: "Öppna sammanställningen", primar: true, fn: async () => { const t = await foRapLasFil(r); if (t) foRapOppnaFonster(t, false); } });
    modal(r.nr + " · " + r.titel, "Låst sammanställning", kropp, knappar);
    r.signerade.forEach(s => { const el = document.getElementById("foSig-" + s.id); if (el) foKopplaBilagor(el, [s]); });
    document.querySelectorAll("[data-sigbort]").forEach(b => b.addEventListener("click", () => {
        if (!confirm("Ta bort det signerade dokumentet från " + r.nr + "?")) return;
        if (foGor("taBortSignerad", { id: r.id, fil: b.dataset.sigbort })) { stangModal(); foRapVisa(foP.rapporter.find(x => x.id === r.id), leda); status("Dokumentet togs bort."); }
    }));
    const zon = document.getElementById("foSigFil");
    if (zon) foFilMottagare(zon, null, (meta) => {
        const parter = (document.getElementById("foSigParter") || {}).value || "";
        if (foGor("signeradRapport", { id: r.id, filer: meta, parter: parter })) {
            stangModal(); foRapVisa(foP.rapporter.find(x => x.id === r.id), leda);
            status("Det signerade dokumentet är kopplat till " + r.nr + ".");
        }
    });
    // Kontrollera att filen är oförändrad sedan den låstes.
    if (r.kontroll) foRapLasFil(r).then(async t => {
        const el = document.getElementById("foRapKoll");
        if (!el || t == null) return;
        const ok = (await foRapKontroll(t)) === r.kontroll;
        el.insertAdjacentHTML("beforeend", ok ? ' <span class="fo-kollok">stämmer</span>' : ' <span class="fo-kollfel">stämmer inte</span>');
    });
}
