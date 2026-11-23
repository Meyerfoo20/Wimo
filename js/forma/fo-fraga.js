/* ======================================================================
   Wimo Forma · en fråga i sidopanelen
   Fråga och svar (med tillägg, ändring och versioner), revisioner att
   kvittera, uppgifter som sparas direkt, beslut, kopplingar och historik.
   ====================================================================== */

let foPanelFlik = "fraga";
let foRedigerar = null;   // { del: "fraga" | "svar", lage: "tillagg" | "andra" | "ny" } medan man skriver

function foStangPanel(tyst) {
    const pan = document.getElementById("foPanel");
    const varOppen = !!foFragaOppen;
    foFragaOppen = "";
    foRedigerar = null;
    if (pan) { pan.classList.remove("oppen"); pan.setAttribute("aria-hidden", "true"); pan.innerHTML = ""; }
    document.body.classList.remove("fo-panelopen");
    document.querySelectorAll("#forma tr.vald").forEach(tr => tr.classList.remove("vald"));
    if (!tyst && varOppen) foSattAdress();
}

function foRitaPanel() {
    const p = foP, f = foFraga(p, foFragaOppen);
    let pan = document.getElementById("foPanel");
    if (!pan) {
        pan = document.createElement("aside");
        pan.id = "foPanel";
        pan.className = "fo-panel";
        pan.setAttribute("aria-label", "Fråga");
        document.body.appendChild(pan);
    }
    if (!f) return foStangPanel(true);
    // Behåll det man håller på att skriva när panelen ritas om (t.ex. när någon annan sparar).
    const pagar = {};
    pan.querySelectorAll("textarea[data-behall], input[data-behall]").forEach(el => { pagar[el.id] = el.value; });
    const fokus = document.activeElement && pan.contains(document.activeElement) ? document.activeElement.id : "";
    const jag = foJagId(), kan = foKanSkriva(p, jag), leda = foKanLeda(p, jag);
    const ok = foOkvitterade(f);
    const nBeslut = p.beslut.filter(b => b.fragaId === f.id).length;
    const nKopp = f.kopplingar.length;
    let html = '<div class="fo-panelhuvud"><div class="fo-paneltitel"><h2>Fråga ' + f.nr + '</h2>' + foLageChip(f) +
        (f.paverkar ? '<span class="fo-paverkar" title="' + esc(FO_PAVERKAR_TEXT) + '">Tid/kostnad</span>' : "") + '</div>' +

        '<button type="button" class="fo-stang" id="foPanelStang" aria-label="Stäng frågan">×</button></div>' +
        '<div class="fo-nasta"><span>Nästa steg</span><b>' + esc(foNastaSteg(p, f)) + '</b></div>' +
        '<div class="fo-flikar fo-panelflikar" role="tablist">' + [["fraga", "Fråga och svar"], ["beslut", "Beslut" + (nBeslut ? " (" + nBeslut + ")" : "")],
            ["kopplat", "Kopplat" + (nKopp ? " (" + nKopp + ")" : "")], ["historik", "Historik"]].map(([k, t]) =>
            '<button type="button" role="tab" class="fo-flik' + (foPanelFlik === k ? " vald" : "") + '" aria-selected="' + (foPanelFlik === k) + '" data-pflik="' + k + '">' + t + '</button>').join("") + '</div>' +
        '<div class="fo-panelkropp">';
    if (foPanelFlik === "fraga") html += foPanelFraga(f, ok, kan, leda, jag);
    if (foPanelFlik === "beslut") html += foPanelBeslut(f, leda);
    if (foPanelFlik === "kopplat") html += foPanelKopplat(f, kan);
    if (foPanelFlik === "historik") html += foPanelHistorik(f);
    html += '</div>';
    pan.innerHTML = html;
    pan.classList.add("oppen");
    pan.setAttribute("aria-hidden", "false");
    document.body.classList.add("fo-panelopen");
    document.querySelectorAll("#forma tr[data-fraga]").forEach(tr => tr.classList.toggle("vald", tr.dataset.fraga === f.id));
    Object.keys(pagar).forEach(id => { const el = document.getElementById(id); if (el) el.value = pagar[id]; });
    if (fokus) { const el = document.getElementById(fokus); if (el) el.focus(); }
    foKopplaPanel(pan, f, kan, leda, jag);
    // Markera som sett (FRG-028).
    const sett = (p.sett[jag] || {})[f.id];
    if (jag && (!sett || (f.andrad && f.andrad > sett))) setTimeout(() => { if (foFragaOppen === f.id) foGor("sett", { ids: [f.id] }, true); }, 600);
}

/* ---------- fliken Fråga och svar ---------- */
function foPanelFraga(f, ok, kan, leda, jag) {
    const p = foP;
    let h = "";
    // Revisioner som väntar på kvittering, med jämförelse av före och efter.
    if (ok.length) h += '<div class="fo-revruta"><h3>' + (ok.length === 1 ? "En ändring väntar på kvittering" : ok.length + " ändringar väntar på kvittering") + '</h3>' +
        ok.map(r => {
            const forra = foRevForeEfter(f, r);
            const minTur = foArPart(p, jag, r.mottagare) || leda;
            return '<div class="fo-rev"><div class="fo-revtopp"><span class="fo-revmark">' + foRevNamn(r.nr) + '</span><b>' + (r.ver === "tillagg" ? "Tillägg i " : "Ändring i ") +
                ({ fraga: "frågan", svar: "svaret", beslut: "beslut" })[r.typ] + '</b>' + (r.efterAvslut ? '<span class="fo-efteravslut">Ändring efter avslut</span>' : "") +
                '<span class="fo-revvem">' + esc(foPersonNamn(p, r.av)) + " · " + foNarText(r.tid) + '</span></div>' +
                (forra ? '<div class="fo-diff">' + foDiffHtml(forra.fore, forra.efter) + '</div>' : "") +
                '<div class="fo-revfot"><span title="Kvittering betyder att man tagit del av ändringen, inte att man godkänner den.">Kvitteras av <b>' + esc(foPartText(p, r.mottagare) || "–") + '</b></span>' +
                (minTur ? '<button type="button" class="p4-btn p4-btn-liten" data-kvittera="' + r.id + '">Kvittera</button>' : "") + '</div></div>';
        }).join("") + '</div>';
    // Frågan
    const fv = f.textVer[f.textVer.length - 1];
    h += '<section class="fo-del"><div class="fo-delrub"><h3>Fråga</h3><span>ställd av ' + esc(foPersonNamn(p, f.av) || "–") + (f.fran ? " (" + esc(foDiscText(p, f.fran)) + ")" : "") + " · " + foNarText(f.skapad) +
        (f.textVer.length > 1 ? ' · <button type="button" class="p4d-lank" data-versioner="fraga">' + f.textVer.length + ' versioner</button>' : "") + '</span></div>';
    if (foRedigerar && foRedigerar.del === "fraga") h += foSkrivRuta("fraga", f.text, foRedigerar.lage);
    else h += '<div class="fo-text">' + foTextHtml(f.text) + '</div>' + (kan && !f.makulerad && (f.av === jag || leda) ? '<div class="fo-textknappar">' +
        '<button type="button" class="fo-minknapp" data-skriv="fraga:tillagg" title="Skrivs efter frågan och syns i historiken">+ Lägg till</button><button type="button" class="fo-minknapp" data-skriv="fraga:andra" title="Sparas som ny version' + (f.ansvarig ? " och kvitteras av ansvarig" : "") + '">Ändra</button>' +
        (kan && !f.makulerad ? foFilZon("foFilFraga", "Bifoga") : "") + '</div>' : (kan && !f.makulerad ? '<div class="fo-textknappar">' + foFilZon("foFilFraga", "Bifoga") + '</div>' : ""));
    void fv;
    h += foBilagorHtml(f.bilagor, "fraga") + '</section>';
    // Uppgifter (sparas direkt): det viktigaste syns, resten under Fler uppgifter.
    const lasa = !kan || !!f.makulerad;
    const forum = p.forum.filter(x => x.aktiv || f.moten.includes(x.id));
    h += '<section class="fo-del fo-uppgifter"><div class="fo-ugrid">' +
        '<label class="fo-litefalt"><span>Vem ska svara?</span>' + foPartSelect("foPAnsv", f.ansvarig, "Välj …", lasa ? " disabled" : "") + '</label>' +
        '<label class="fo-litefalt"><span>Svar senast</span><input class="f" type="date" id="foPSenast" value="' + esc(f.svarSenast || "") + '"' + (lasa ? " disabled" : "") + '></label></div>' +
        (forum.length ? '<div class="fo-litefalt fo-motesval"><span>Ta upp på möte</span>' + foValChips("moten", forum.map(x => ({ id: x.id, namn: x.namn })), f.moten) + '</div>' : "") +
        '<details class="fo-fler"' + (f.berorda.length || f.indelning.length || f.paverkar ? " open" : "") + '><summary>Fler uppgifter</summary>' +
        '<label class="fo-litefalt"><span>Från disciplin</span>' + foDiscSelect("foPFran", f.fran, "–", lasa ? " disabled" : "") + '</label>' +
        '<div class="fo-litefalt"><span>Berörda discipliner</span>' + foValChips("berorda", p.discipliner.filter(d => d.aktiv || f.berorda.includes(d.id)).sort((a, b) => a.ordning - b.ordning).map(d => ({ id: d.id, namn: d.kod })), f.berorda) + '</div>' +
        p.indelningar.map(ind => '<div class="fo-litefalt"><span>' + esc(ind.namn) + '</span>' + foValChips("ind:" + ind.id, ind.varden.filter(v => v.aktiv || f.indelning.includes(v.id)).map(v => ({ id: v.id, namn: v.namn })), f.indelning) + '</div>').join("") +
        '<label class="fo-kryss" title="' + esc(FO_PAVERKAR_TEXT) + '"><input type="checkbox" id="foPPaverkar"' + (f.paverkar ? " checked" : "") + (lasa ? " disabled" : "") + '> Kan påverka tid eller kostnad</label></details></section>';
    // Svaret
    h += '<section class="fo-del"><div class="fo-delrub"><h3>Svar</h3>' + (f.svar ? '<span>' + esc(foPersonNamn(p, f.svar.ver[f.svar.ver.length - 1].av)) + " · " + foNarText(f.svar.ver[f.svar.ver.length - 1].tid) +
        (f.svar.ver.length > 1 ? ' · <button type="button" class="p4d-lank" data-versioner="svar">' + f.svar.ver.length + ' versioner</button>' : "") + '</span>' : "") + '</div>';
    const kanSvara = kan && !f.makulerad && (foArPart(p, jag, f.ansvarig) || leda || !f.ansvarig || foPersonDisc(p, jag).some(d => f.berorda.includes(d)));
    if (!f.svar) h += kanSvara ? foSkrivRuta("svar", "", "ny") : '<p class="hjalp">Inget svar ännu. ' + (f.ansvarig ? esc(foPartText(p, f.ansvarig)) + " svarar." : "Frågan har ingen ansvarig.") + '</p>';
    else if (foRedigerar && foRedigerar.del === "svar") h += foSkrivRuta("svar", f.svar.text, foRedigerar.lage);
    else h += '<div class="fo-text fo-svar">' + foTextHtml(f.svar.text) + '</div>' + (kanSvara ? '<div class="fo-textknappar"><button type="button" class="fo-minknapp" data-skriv="svar:tillagg" title="Skrivs efter svaret och kvitteras av frågeställaren">+ Lägg till</button>' +
        '<button type="button" class="fo-minknapp" data-skriv="svar:andra" title="Sparas som ny version och kvitteras av frågeställaren">Ändra</button></div>' : "");
    h += foBilagorHtml(f.bilagor, "svar") + '</section>';
    // Läget och nästa steg
    const stallare = foArPart(p, jag, foStallare(f)) || f.av === jag;
    const knappar = [];
    if (!f.makulerad) {
        if (f.lage === "besvarad" && (stallare || leda)) {
            knappar.push('<button type="button" class="p4-btn p4-btn-primar" data-lage="klar"' + (ok.length ? ' disabled title="Kvittera revisionerna först"' : "") + '>Klar</button>');
            knappar.push('<button type="button" class="p4-btn p4-btn-ljus" data-lage="ofullstandig">Svaret är ofullständigt</button>');
        }
        if (f.lage === "klar" && (stallare || leda || kan)) knappar.push('<button type="button" class="p4-btn p4-btn-ljus" data-lage="besvarad">Öppna igen</button>');
        if (kan) knappar.push('<button type="button" class="p4-btn p4-btn-ljus" id="foPAtg">Ny åtgärd</button>');
        if (leda) knappar.push('<button type="button" class="p4-btn p4-btn-ljus" id="foPBeslut">Fastställ beslut</button>');
    }
    if (leda) knappar.push(f.makulerad ? '<button type="button" class="p4-btn p4-btn-ljus" id="foPAterstall">Återställ frågan</button>' : '<button type="button" class="fo-farlank" id="foPMak">Makulera frågan</button>');
    if (f.makulerad) h += '<div class="notis rod">Makulerad ' + foNarText(f.makulerad.tid) + " av " + esc(foPersonNamn(p, f.makulerad.av)) + ': ' + esc(f.makulerad.orsak) + '</div>';
    if (knappar.length) h += '<div class="fo-panelknappar">' + knappar.join("") + '</div>';
    return h;
}
function foSkrivRuta(del, text, lage) {
    const id = "foSkriv_" + del;
    const ny = lage === "ny", tillagg = lage === "tillagg";
    const rub = ny ? "" : tillagg ? "Tillägg – skrivs efter nuvarande text" : "Ändra texten – sparas som ny version";
    return '<div class="fo-skrivruta" data-skrivruta="' + del + '">' + (rub ? '<div class="fo-skrivrub">' + rub + '</div>' : "") +
        (tillagg ? '<div class="fo-text fo-dampad">' + foTextHtml(text) + '</div>' : "") +
        '<textarea class="f" id="' + id + '" rows="' + (ny ? 4 : 5) + '" data-behall placeholder="' + (del === "svar" ? "Skriv svaret …" : "Skriv …") + '">' + (lage === "andra" ? esc(text) : "") + '</textarea>' +
        (del === "svar" ? '<div id="foSvarBil"></div>' : "") +
        '<div class="fo-skrivknappar"><button type="button" class="p4-btn p4-btn-primar" data-sparatext="' + del + '" title="Ctrl+Enter">' + (ny ? "Spara svar" : "Spara") + '</button>' +
        (ny ? "" : '<button type="button" class="p4-btn p4-btn-ljus" data-avbrytskriv>Avbryt</button>') + (del === "svar" ? foFilZon("foFilSvar", "Bifoga") : "") + '</div></div>';
}
let foSvarBilagor = [];

function foTextHtml(t) { return esc(t).replace(/\n/g, "<br>"); }
function foDiffHtml(a, b) {
    return foDiff(a, b).map(d => d.t === "lika" ? esc(d.s) : d.t === "ny" ? '<ins>' + esc(d.s) + '</ins>' : '<del>' + esc(d.s) + '</del>').join("").replace(/\n/g, "<br>");
}
// Texten före och efter en revision.
function foRevForeEfter(f, r) {
    const lista = r.typ === "fraga" ? f.textVer : r.typ === "svar" && f.svar ? f.svar.ver : null;
    if (!lista) return null;
    const i = lista.findIndex(v => v.tid === r.tid);
    if (i < 1) return null;
    return { fore: lista[i - 1].text, efter: lista[i].text };
}

/* ---------- fliken Beslut ---------- */
function foPanelBeslut(f, leda) {
    const p = foP, l = p.beslut.filter(b => b.fragaId === f.id).sort((a, b) => (a.skapad || "").localeCompare(b.skapad || ""));
    let h = '<p class="hjalp" style="margin-top:0">Ett svar blir aldrig automatiskt ett beslut. Beslut fastställs här av administratör eller projekteringsledare, och kan senare ersättas eller kompletteras — aldrig ändras.</p>';
    h += l.length ? '<ul class="fo-beslutlista">' + l.map(b => '<li data-visabeslut="' + b.id + '" class="' + (b.status === "ersatt" ? "ersatt" : "") + '"><b>' + esc(b.nr) + '</b><span>' + esc(b.text) +
        '<small>' + esc(foPersonNamn(p, b.fattare)) + " · " + esc(b.datum) + " · " + (b.status === "gallande" ? "Gällande" : "Ersatt") + '</small></span></li>').join("") + '</ul>'
        : '<p class="hjalp">Inga beslut på frågan ännu.</p>';
    if (leda && !f.makulerad) h += '<button type="button" class="p4-btn p4-btn-primar" id="foPBeslut2">Fastställ beslut</button>';
    return h;
}

/* ---------- fliken Kopplat ---------- */
function foPanelKopplat(f, kan) {
    const p = foP;
    let h = '<p class="hjalp" style="margin-top:0">Koppla frågan till relaterade frågor, beslut och åtgärder. Kopplingen syns åt båda hållen.</p>';
    h += f.kopplingar.length ? '<ul class="fo-kopplingar">' + f.kopplingar.map(k => '<li><button type="button" class="p4d-lank" data-gakopp="' + k.typ + ':' + k.id + '">' + esc(foObjNamn(p, k)) + '</button>' +
        '<span>' + esc(foObjText(p, k).slice(0, 140)) + '</span>' + (kan ? '<button type="button" class="fo-minknapp" data-kopptabort="' + k.typ + ':' + k.id + '">Ta bort</button>' : "") + '</li>').join("") + '</ul>'
        : '<p class="hjalp">Inga kopplingar ännu.</p>';
    if (kan) h += '<div class="fo-kopplaform"><input class="f" id="foKoppSok" placeholder="Sök fråga, beslut eller åtgärd – nummer eller text" data-behall><div id="foKoppTraff"></div></div>';
    return h;
}

/* ---------- fliken Historik ---------- */
function foPanelHistorik(f) {
    const p = foP;
    const rader = f.hist.slice().reverse().map(h => '<li><span class="fo-hnar">' + foNarText(h.tid) + '</span><span class="fo-htext">' + esc(h.text) + '<small>' + esc(foPersonNamn(p, h.av) || "–") + '</small></span></li>').join("");
    const ver = (lista, rub) => lista.length > 1 ? '<h4 class="fo-verrub">' + rub + '</h4><ol class="fo-versioner">' + lista.map((v, i) => '<li><div class="fo-vertopp"><b>Version ' + (i + 1) + '</b> ' +
        ({ ny: "", tillagg: "· tillägg", andring: "· ändring i sak" })[v.typ || "ny"] + ' <span>' + esc(foPersonNamn(p, v.av)) + " · " + foNarText(v.tid) + '</span></div>' +
        '<div class="fo-text">' + (i ? foDiffHtml(lista[i - 1].text, v.text) : foTextHtml(v.text)) + '</div></li>').join("") + '</ol>' : "";
    return '<p class="hjalp" style="margin-top:0">Historiken kan inte ändras. Varje version av frågan och svaret finns kvar.</p>' +
        '<ul class="fo-handelser fo-histlista">' + rader + '</ul>' + ver(f.textVer, "Frågans versioner") + (f.svar ? ver(f.svar.ver, "Svarets versioner") : "");
}

/* ---------- händelser i panelen ---------- */
function foKopplaPanel(pan, f, kan, leda, jag) {
    const p = foP;
    pan.querySelector("#foPanelStang").addEventListener("click", () => foStangPanel());
    pan.querySelectorAll("[data-pflik]").forEach(b => b.addEventListener("click", () => { foPanelFlik = b.dataset.pflik; foRitaPanel(); }));
    pan.querySelectorAll("[data-kvittera]").forEach(b => b.addEventListener("click", () => {
        if (foGor("kvittera", { id: f.id, rev: b.dataset.kvittera })) status("Revisionen är kvitterad.");
    }));
    pan.querySelectorAll("[data-versioner]").forEach(b => b.addEventListener("click", () => { foPanelFlik = "historik"; foRitaPanel(); }));
    pan.querySelectorAll("[data-skriv]").forEach(b => b.addEventListener("click", () => {
        const [del, lage] = b.dataset.skriv.split(":");
        foRedigerar = { del: del, lage: lage };
        foRitaPanel();
        const t = document.getElementById("foSkriv_" + del); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
    }));
    pan.querySelectorAll("[data-avbrytskriv]").forEach(b => b.addEventListener("click", () => { foRedigerar = null; foSvarBilagor = []; foRitaPanel(); }));
    pan.querySelectorAll("[data-sparatext]").forEach(b => {
        const del = b.dataset.sparatext, t = document.getElementById("foSkriv_" + del);
        const spara = () => {
            const lage = foRedigerar && foRedigerar.del === del ? foRedigerar.lage : "ny";
            const gammal = del === "fraga" ? f.text : (f.svar ? f.svar.text : "");
            const val = t.value.trim();
            if (!val) { t.focus(); return status(lage === "tillagg" ? "Skriv tillägget." : "Texten kan inte vara tom.", true); }
            const ny = lage === "tillagg" ? gammal.replace(/\s+$/, "") + "\n\n" + val : val;
            const typ = foKlassa(gammal, ny);
            if (typ === "samma") { foRedigerar = null; return foRitaPanel(); }
            const r = del === "fraga" ? foGor("fragaText", { id: f.id, text: ny }, true) : foGor("svara", { id: f.id, text: ny, bilagor: foSvarBilagor }, true);
            if (!r) return;
            foRedigerar = null; foSvarBilagor = [];
            foRita();
            status(del === "svar" ? (typ === "ny" ? "Svaret är sparat. Frågan är Besvarad." : typ === "tillagg" ? "Tillägget är sparat och syns i historiken." : "Ändringen är sparad som en ny version och ska kvitteras.")
                : (typ === "tillagg" ? "Tillägget i frågan är sparat." : "Frågan är ändrad och sparad som en ny version."));
        };
        b.addEventListener("click", spara);
        if (t) t.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); spara(); } });
    });
    // bilagor
    foKopplaBilagor(pan, f.bilagor);
    const zf = pan.querySelector("#foFilFraga");
    if (zf) foFilMottagare(zf, null, (meta) => { foGor("bilagor", { id: f.id, del: "fraga", bilagor: meta }); status(meta.length === 1 ? "Bilagan lades till." : meta.length + " bilagor lades till."); });
    const zs = pan.querySelector("#foFilSvar");
    if (zs) {
        const ritaSb = () => { const el = document.getElementById("foSvarBil"); if (el) { el.innerHTML = foBilagorHtml(foSvarBilagor); foKopplaBilagor(el, foSvarBilagor); } };
        ritaSb();
        foFilMottagare(zs, document.getElementById("foSkriv_svar"), (meta) => { foSvarBilagor = foSvarBilagor.concat(meta); ritaSb(); });
    }
    // uppgifter som sparas direkt
    const direkt = (id, fn) => { const el = pan.querySelector("#" + id); if (el) el.addEventListener("change", () => { if (foGor("fragaFalt", Object.assign({ id: f.id }, fn(el)), true)) { foRitaUtanPanel(); foVisaSparat(el); } }); };
    direkt("foPFran", el => ({ fran: el.value }));
    direkt("foPAnsv", el => ({ ansvarig: foPartFran(el.value) }));
    direkt("foPSenast", el => ({ svarSenast: el.value }));
    direkt("foPPaverkar", el => ({ paverkar: el.checked }));
    pan.querySelectorAll(".fo-valchips").forEach(grupp => grupp.querySelectorAll(".fo-valchip").forEach(b => b.addEventListener("click", () => {
        if (!kan || f.makulerad) return;
        const val = grupp.dataset.val, id = b.dataset.id;
        if (val === "moten") { foGor("motesmarkering", { id: f.id, forum: id }); return; }
        if (val === "berorda") { const l = f.berorda.includes(id) ? f.berorda.filter(x => x !== id) : f.berorda.concat(id); foGor("fragaFalt", { id: f.id, berorda: l }); return; }
        if (val.startsWith("ind:")) { const l = f.indelning.includes(id) ? f.indelning.filter(x => x !== id) : f.indelning.concat(id); foGor("fragaFalt", { id: f.id, indelning: l }); }
    })));
    // läge och åtgärder
    pan.querySelectorAll("[data-lage]").forEach(b => b.addEventListener("click", () => {
        const lage = b.dataset.lage;
        if (lage === "ofullstandig") {
            modal("Svaret är ofullständigt", "Fråga " + f.nr, '<div class="falt"><label for="foOfKom">Vad saknas? (frivilligt)</label><textarea class="f" id="foOfKom" rows="3"></textarea></div>' +
                '<p class="hjalp">Frågan går tillbaka till ' + esc(foPartText(p, f.ansvarig) || "ansvarig") + ' för komplettering.</p>', [
                { txt: "Avbryt", fn: stangModal },
                { txt: "Begär komplettering", primar: true, fn: () => { const k = document.getElementById("foOfKom").value.trim(); stangModal(); if (foGor("sattLage", { id: f.id, lage: "ofullstandig", kommentar: k })) status("Komplettering begärd."); } }]);
            return;
        }
        if (foGor("sattLage", { id: f.id, lage: lage })) status(lage === "klar" ? "Fråga " + f.nr + " är klar och flyttad till Klara frågor." : "Fråga " + f.nr + " är öppnad igen.");
    }));
    const atg = pan.querySelector("#foPAtg"); if (atg) atg.addEventListener("click", () => foAtgardDialog(null, { typ: "fraga", id: f.id }));
    ["#foPBeslut", "#foPBeslut2"].forEach(s => { const b = pan.querySelector(s); if (b) b.addEventListener("click", () => foBeslutDialog(f, null)); });
    pan.querySelectorAll("[data-visabeslut]").forEach(li => li.addEventListener("click", () => foBeslutVisa(foBeslut(p, li.dataset.visabeslut))));
    const mak = pan.querySelector("#foPMak"); if (mak) mak.addEventListener("click", () => foFragaOrsak("Makulera fråga " + f.nr,
        "Frågan döljs i listorna men finns kvar med nummer, filer och historik. Numret återanvänds aldrig, och frågan kan återställas.", "Makulera", o => foGor("makuleraFraga", { id: f.id, orsak: o })));
    const at = pan.querySelector("#foPAterstall"); if (at) at.addEventListener("click", () => foGor("aterstallFraga", { id: f.id }));
    // kopplingar
    pan.querySelectorAll("[data-gakopp]").forEach(b => b.addEventListener("click", () => {
        const [typ, id] = b.dataset.gakopp.split(":");
        if (typ === "fraga") { const g = foFraga(p, id); if (g) foGaTill(g.lage === "klar" ? "klara" : foVy === "klara" ? "aktiva" : foVy, id); }
        if (typ === "beslut") foBeslutVisa(foBeslut(p, id));
        if (typ === "atgard") foAtgardDialog(foAtgard(p, id));
    }));
    pan.querySelectorAll("[data-kopptabort]").forEach(b => b.addEventListener("click", () => {
        const [typ, id] = b.dataset.kopptabort.split(":");
        foGor("kopplaBort", { fran: { typ: "fraga", id: f.id }, till: { typ: typ, id: id } });
    }));
    const ks = pan.querySelector("#foKoppSok");
    if (ks) ks.addEventListener("input", () => {
        const tr = foSok(p, ks.value, 8).filter(t => t.typ !== "person" && !(t.typ === "fraga" && t.id === f.id) && !f.kopplingar.some(k => k.typ === t.typ && k.id === t.id));
        const el = pan.querySelector("#foKoppTraff");
        el.innerHTML = ks.value.trim() ? (tr.length ? tr.map(t => '<button type="button" class="fo-kopptraff" data-koppla="' + t.typ + ':' + t.id + '"><b>' + esc(t.rubrik) + '</b><span>' + esc(t.text.slice(0, 110)) + '</span></button>').join("")
            : '<p class="hjalp">Inga träffar.</p>') : "";
        el.querySelectorAll("[data-koppla]").forEach(x => x.addEventListener("click", () => {
            const [typ, id] = x.dataset.koppla.split(":");
            ks.value = "";
            if (foGor("koppla", { fran: { typ: "fraga", id: f.id }, till: { typ: typ, id: id } })) status("Kopplingen är sparad.");
        }));
    });
}
// Uppdaterar listan bakom panelen utan att panelen ritas om (fokus stannar i fältet).
function foRitaUtanPanel() {
    const yta = document.getElementById("forma"), sc = window.scrollY;
    const vyer = { oversikt: foVyOversikt, aktiva: foVyFragor, klara: foVyFragor, alla: foVyFragor, moten: foVyMoten, atgarder: foVyAtgarder, beslut: foVyBeslut };
    if (vyer[foVy]) vyer[foVy](yta);
    foRitaNav();
    window.scrollTo({ top: sc });
    const pan = document.getElementById("foPanel"), f = foFraga(foP, foFragaOppen);
    if (pan && f) {
        const n = pan.querySelector(".fo-nasta b"); if (n) n.textContent = foNastaSteg(foP, f);
    }
}
