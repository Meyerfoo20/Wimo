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
    setTimeout(() => foFargaAvatarer(), 0);
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
        foKonsTaggar(f) + (f.bradskande ? '<span class="fo-tagg t-sen">Brådskande</span>' : "") + '</div>' +

        '<button type="button" class="fo-stang" id="foPanelStang" aria-label="Stäng frågan">×</button></div>' +
        '<div class="fo-nasta"><span>Nästa steg</span><b>' + esc(foNastaSteg(p, f)) + '</b>' + (foSenastPaminnelse(p, f) ? '<small class="fo-senastpam">' + esc(foSenastPaminnelse(p, f)) + '</small>' : "") + '</div>' +
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
    const agare = foFragaAgare(p, jag, f) && !!jag;
    const superu = foSuper(p, jag);
    const kanFraga = kan && !f.makulerad && (f.av === jag || foArStallare(p, jag, f) || superu || leda);
    const kanMott = kan && !f.makulerad && (agare || f.av === jag || leda);
    let h = "";
    // Revisioner som väntar på kvittering, med jämförelse av före och efter.
    if (ok.length) h += '<div class="fo-revruta"><h3>' + (ok.length === 1 ? "En ändring väntar på kvittering" : ok.length + " ändringar väntar på kvittering") + '</h3>' +
        ok.map(r => {
            const forra = foRevForeEfter(f, r);
            const minTur = foArPart(p, jag, r.mottagare) || superu;
            return '<div class="fo-rev"><div class="fo-revtopp"><span class="fo-revmark">' + foRevNamn(r.nr) + '</span><b>' + (r.ver === "tillagg" ? "Komplettering av " : "Revidering av ") +
                ({ fraga: "frågan", svar: "svar", beslut: "beslut" })[r.typ] + '</b>' + (r.efterAvslut ? '<span class="fo-efteravslut">Efter klarmarkering</span>' : "") +
                '<span class="fo-revvem">' + esc(foPersonNamn(p, r.av)) + " · " + foNarText(r.tid) + '</span></div>' +
                (r.orsak ? '<div class="fo-revorsak">Orsak: ' + esc(r.orsak) + '</div>' : "") +
                (forra ? '<div class="fo-diff">' + foDiffHtml(forra.fore, forra.efter) + '</div>' : "") +
                '<div class="fo-revfot"><span title="Kvittering betyder att man tagit del av ändringen, inte att man godkänner den.">Kvitteras av <b>' + esc(foPartText(p, r.mottagare) || "–") + '</b></span>' +
                (minTur ? '<button type="button" class="p4-btn p4-btn-liten" data-kvittera="' + r.id + '">Kvittera</button>' : "") + '</div></div>';
        }).join("") + '</div>';
    // Frågan
    const st = foPerson(p, foStallarePerson(f)), ft = st ? foForetag(p, st.foretagId) : null;
    const reg = f.av && f.av !== foStallarePerson(f) ? ' · registrerad av ' + esc(foPersonNamn(p, f.av)) : "";
    h += '<section class="fo-del"><div class="fo-delrub"><h3>Fråga</h3><span>' + esc(foPersonNamn(p, foStallarePerson(f)) || "–") +
        (ft || f.fran ? " (" + esc([ft && ft.namn, foDiscText(p, f.fran)].filter(Boolean).join(" · ")) + ")" : "") + " · " + foNarText(f.skapad) + reg +
        (f.textVer.length > 1 ? ' · <button type="button" class="p4d-lank" data-versioner="fraga">' + f.textVer.length + ' versioner</button>' : "") + '</span></div>';
    if (foRedigerar && foRedigerar.del === "fraga") h += foSkrivRuta("fraga", f.text, foRedigerar.lage);
    else h += '<div class="fo-text">' + foTextHtml(f.text) + '</div>' + (kan && !f.makulerad ? '<div class="fo-textknappar">' +
        (kanFraga ? foAndraKnappar("fraga") : "") + foFilZon("foFilFraga", "Bifoga") + '</div>' : "");
    h += foBilagorHtml(f.bilagor, "fraga") + '</section>';

    // Uppgifter (sparas direkt)
    const lasa = !kan || !!f.makulerad;
    const forum = p.forum.filter(x => (x.aktiv && x.valbar !== false) || f.moten.includes(x.id));
    const svaratStatus = part => foHarSvarat(p, f, part) ? '<i class="fo-harsvarat" title="Har svarat">svarat</i>' : '<i class="fo-ejsvarat" title="Har inte svarat">väntar</i>';
    h += '<section class="fo-del fo-uppgifter">' +
        '<div class="fo-litefalt"><span>Ska svara</span>' + foPartValjare("foPMott", foMottagare(f), { lasa: !kanMott, status: svaratStatus, tomText: "Välj vem som ska svara …", merText: "+ Fler mottagare …" }) + '</div>' +
        '<div class="fo-ugrid"><label class="fo-litefalt"><span>Svar senast' + (f.svarSenast ? ' <em class="fo-vecka">v. ' + foVecka(f.svarSenast) + '</em>' : "") + '</span><input class="f" type="date" id="foPSenast" value="' + esc(f.svarSenast || "") + '"' + (lasa ? " disabled" : "") + '></label></div>' +
        (forum.length ? '<div class="fo-litefalt fo-motesval"><span>Ta upp på möte</span>' + foValChips("moten", forum.map(x => ({ id: x.id, namn: x.namn })), f.moten) + '</div>' : "") +
        '<details class="fo-fler"' + (f.berorda.length || f.berordaP.length || f.indelning.length ? " open" : "") + '><summary>Fler uppgifter</summary>' +
        '<label class="fo-litefalt"><span>Frågeställare</span>' + foPersonSelect("foPStallare", foStallarePerson(f), "–", (lasa || !(foArStallare(p, jag, f) || superu)) ? " disabled" : "") + '</label>' +
        (!lasa && (foArStallare(p, jag, f) || superu) ? '<p class="hjalp fo-litenhjalp">Byter du frågeställare flyttas frågan till den personens Mina frågor. Ändringen syns i historiken.</p>' : "") +
        '<label class="fo-litefalt"><span>Från disciplin</span>' + foDiscSelect("foPFran", f.fran, "–", lasa ? " disabled" : "") + '</label>' +
        '<div class="fo-litefalt"><span>Berörda <small>– behöver känna till frågan men inte svara</small></span>' + foPartValjare("foPBerorda", f.berorda.map(d => ({ disc: d })).concat(f.berordaP.map(x => ({ person: x }))), { lasa: lasa, tomText: "Lägg till berörda …" }) + '</div>' +
        p.indelningar.map(ind => '<div class="fo-litefalt"><span>' + esc(ind.namn) + '</span>' + foValChips("ind:" + ind.id, ind.varden.filter(v => v.aktiv || f.indelning.includes(v.id)).map(v => ({ id: v.id, namn: v.namn })), f.indelning) + '</div>').join("") +
        '<p class="hjalp fo-litenhjalp">Registrerad ' + foNarText(f.skapad) + ' av ' + esc(foPersonNamn(p, f.av) || "–") + '.</p></details></section>';

    // Tid- och kostnadspåverkan
    h += foKonsHtml(f, jag, superu);

    // Dialogen
    const poster = f.dialog || [];
    const nSvar = foSvarPoster(f).length, nSlut = foSlutliga(f).length;
    h += '<section class="fo-del fo-dialog"><div class="fo-delrub"><h3>Svar och dialog</h3><span>' + (nSvar ? nSvar + (nSvar === 1 ? " svar" : " svar") : "Inga svar ännu") +
        (nSvar && !nSlut ? " · slutligt svar inte valt" : nSlut ? " · " + (nSlut === 1 ? "slutligt svar valt" : nSlut + " svar utgör det slutliga beskedet") : "") + '</span></div>';
    h += poster.length ? '<ol class="fo-poster">' + poster.map(x => foPostHtml(f, x, jag, agare, superu, kan)).join("") + '</ol>' : "";
    if (kan && !f.makulerad) h += foSvarsruta(f, jag);
    else if (!poster.length) h += '<p class="hjalp">Inget svar ännu.' + (foMottagare(f).length ? " " + esc(foMottagareText(p, f)) + " svarar." : "") + '</p>';
    h += '</section>';

    // Kvitteringar som begärts på frågan
    const kv = foKvittHtml({ typ: "fraga", id: f.id });
    if (kv) h += '<section class="fo-del"><div class="fo-delrub"><h3>Kvitteringar</h3><span>Kvittering är inte ett godkännande</span></div>' + kv + '</section>';
    // Läget och nästa steg
    const knappar = [];
    if (!f.makulerad) {
        if (agare && (f.lage === "besvarad" || f.lage === "ofullstandig") && nSvar) knappar.push('<button type="button" class="p4-btn p4-btn-primar" data-lage="klar"' +
            (foOkvittSvar(f).length ? ' disabled title="Kvittera de ändrade svaren först"' : "") + '>Klar</button>');
        if (agare && (f.lage === "besvarad" || f.lage === "ofullstandig") && nSvar && !foOkvittSvar(f).length) {
            knappar.push('<button type="button" class="p4-btn p4-btn-ljus" data-lage="klaratg" title="Klarmarkera frågan och skapa en åtgärd för det som ska utföras">Klar och skapa åtgärd</button>');
            knappar.push('<button type="button" class="p4-btn p4-btn-ljus" id="foPKopplaAtg" title="Koppla en åtgärd som redan finns">Koppla åtgärd</button>');
        }
        if (agare && f.lage === "besvarad") knappar.push('<button type="button" class="p4-btn p4-btn-ljus" data-lage="ofullstandig">Svaret är ofullständigt</button>');
        if (agare && f.lage === "klar") knappar.push('<button type="button" class="p4-btn p4-btn-ljus" data-lage="besvarad">Återöppna</button>');
        if (foAktiv(f) && foKanPaminna(p, jag, f)) knappar.push('<button type="button" class="p4-btn p4-btn-ljus" id="foPPaminn" title="Skickar ett mejl direkt till dem som ska svara">Påminn</button>');
        if (kan) knappar.push('<button type="button" class="p4-btn p4-btn-ljus" id="foPKvitt" title="Be personer bekräfta att de tagit del av frågan och svaret">Begär kvittering</button>');
        if (foAktiv(f) && foKanPaminna(p, jag, f)) knappar.push('<button type="button" class="p4-btn p4-btn-ljus' + (f.bradskande ? " fo-pa" : "") + '" id="foPBrad" aria-pressed="' + !!f.bradskande + '" title="' + (f.bradskande ? "Ta bort markeringen" : "Mejlas direkt till dem som ska svara") + '">' + (f.bradskande ? "Brådskande ✓" : "Markera brådskande") + '</button>');
        if (kan) knappar.push('<button type="button" class="p4-btn p4-btn-ljus" id="foPAtg">Ny åtgärd</button>');
        if (leda || superu) knappar.push('<button type="button" class="p4-btn p4-btn-ljus" id="foPBeslut">Fastställ beslut</button>');
    }
    if (!f.makulerad && foKanLoggaFraga(p, jag, f)) knappar.push('<button type="button" class="p4-btn p4-btn-ljus' + (f.ilogg ? " fo-pa" : "") + '" id="foPLogg" aria-pressed="' + !!f.ilogg + '" title="' +
        (f.ilogg ? "Ta bort från beslutsloggen" : "Lyft fram frågan och svaret i beslutsloggen. Det är inte ett formellt beslut.") + '">' + (f.ilogg ? "I beslutsloggen ✓" : "Inkludera i beslutsloggen") + '</button>');
    if (kan) knappar.push('<button type="button" class="p4-btn p4-btn-ljus' + (f.stjarna ? " fo-pa" : "") + '" id="foPStjarna" aria-pressed="' + !!f.stjarna + '" title="' + (f.stjarna ? "Ta bort stjärnan" : "Stjärnmärkta frågor sparas alltid. Gamla avslutade frågor utan stjärna kan rensas när projektet blir stort.") + '">' + (f.stjarna ? "★ Sparas alltid" : "☆ Spara alltid") + '</button>');
    if (leda || superu) knappar.push(f.makulerad ? '<button type="button" class="p4-btn p4-btn-ljus" id="foPAterstall">Återställ frågan</button>' : '<button type="button" class="fo-farlank" id="foPMak">Makulera frågan</button>');
    if (f.makulerad) h += '<div class="notis rod">Makulerad ' + foNarText(f.makulerad.tid) + " av " + esc(foPersonNamn(p, f.makulerad.av)) + ': ' + esc(f.makulerad.orsak) + '</div>';
    if (!f.makulerad && !agare && (f.lage === "besvarad" || f.lage === "ofullstandig")) h += '<p class="hjalp fo-bedoms">Det är frågeställaren ' + esc(foPersonNamn(p, foStallarePerson(f)) || "") + ' som bedömer svaret och klarmarkerar frågan.</p>';
    if (knappar.length) h += '<div class="fo-panelknappar">' + knappar.join("") + '</div>';
    return h;
}
function foAndraKnappar(del, post) {
    const d = post ? ' data-post="' + post + '"' : "";
    return '<button type="button" class="fo-minknapp" data-skriv="' + del + ':rattelse"' + d + ' title="Rätta stavfel och liknande. Ingen kvittering krävs, men rättelsen syns i historiken.">Rätta</button>' +
        '<button type="button" class="fo-minknapp" data-skriv="' + del + ':tillagg"' + d + ' title="Lägg till information. Skrivs efter nuvarande text.">Komplettera</button>' +
        '<button type="button" class="fo-minknapp" data-skriv="' + del + ':revidering"' + d + ' title="Ändra i sak. Orsak krävs och ändringen ska kvitteras.">Revidera</button>';
}
function foPostHtml(f, x, jag, agare, superu, kan) {
    const p = foP, lamnat = foPostLamnat(x), uppdrag = lamnat !== x.av;
    const redigerar = foRedigerar && foRedigerar.del === "post" && foRedigerar.post === x.id;
    const sista = x.ver[x.ver.length - 1];
    const andrad = x.ver.length > 1 ? ' · <button type="button" class="p4d-lank" data-versioner="post">' + ({ rattelse: "rättad", tillagg: "kompletterad", andring: "reviderad" })[sista.typ] + " " + foNarText(sista.tid) + '</button>' : "";
    return '<li class="fo-post ' + x.typ + (x.slutligt ? " slutligt" : "") + '" data-post="' + x.id + '"><div class="fo-posttopp"><span class="fo-avatar" aria-hidden="true">' + esc(foInitialer(p, lamnat)) + '</span>' +
        '<div class="fo-postvem"><b>' + esc(foPersonNamn(p, lamnat) || "–") + '</b><span class="fo-posttyp">' + (x.typ === "svar" ? "Svar" : "Följdfråga") + '</span>' +
        (x.slutligt ? '<span class="fo-slutmark">Slutligt svar</span>' : "") +
        '<small>' + foNarText(x.tid) + andrad + (uppdrag ? ' · <span class="fo-uppdrag" title="Beskedet är registrerat av någon annan än den som lämnade det. Det är inte digitalt bekräftat av ' + esc(foPersonNamn(p, lamnat)) + '.">registrerat av ' + esc(foPersonNamn(p, x.av)) + '</span>' : "") + '</small></div>' +
        (x.typ === "svar" && agare && !f.makulerad ? '<button type="button" class="fo-minknapp fo-slutknapp' + (x.slutligt ? " pa" : "") + '" data-slutligt="' + x.id + '" aria-pressed="' + !!x.slutligt + '" title="Svaren du väljer utgör tillsammans det slutliga beskedet och visas i frågelistan">' + (x.slutligt ? "Slutligt ✓" : "Välj som slutligt") + '</button>' : "") +
        '</div>' +
        (redigerar ? foSkrivRuta("post", x.text, foRedigerar.lage, x.id) : '<div class="fo-text">' + foTextHtml(x.text) + '</div>' +
            (kan && !f.makulerad && (x.av === jag || superu) ? '<div class="fo-textknappar fo-postknappar">' + foAndraKnappar("post", x.id) + '</div>' : "")) +
        foBilagorHtml(f.bilagor, "d:" + x.id) + '</li>';
}
function foSvarsruta(f, jag) {
    const p = foP;
    const stallare = foArStallare(p, jag, f);
    const typ = foSvarTyp[f.id] || (stallare && foHarSvar(f) ? "foljd" : "svar");
    const lamnat = foSvarLamnat[f.id] || "";
    return '<div class="fo-skrivruta fo-svarsruta" data-skrivruta="ny"><div class="fo-svartyp" role="radiogroup" aria-label="Typ av inlägg">' +
        '<button type="button" role="radio" aria-checked="' + (typ === "svar") + '" class="' + (typ === "svar" ? "vald" : "") + '" data-svartyp="svar">Svar</button>' +
        '<button type="button" role="radio" aria-checked="' + (typ === "foljd") + '" class="' + (typ === "foljd" ? "vald" : "") + '" data-svartyp="foljd">Följdfråga</button></div>' +
        '<textarea class="f" id="foSkriv_ny" rows="3" data-behall placeholder="' + (typ === "svar" ? "Skriv ett svar …" : "Skriv en följdfråga …") + '"></textarea>' +
        '<div id="foSvarBil"></div>' +
        (lamnat !== "" ? '<div class="fo-uppdragrad"><label class="fo-litefalt"><span>Beskedet lämnades av</span>' + foPersonSelect("foSvarLamnat", lamnat, "Välj person …") + '</label>' +
            '<p class="hjalp fo-litenhjalp">Till exempel ett muntligt besked. Det syns att du registrerade det och att det inte är bekräftat digitalt av personen.</p></div>' : "") +
        (typ === "svar" && foKanSkriva(p, jag) ? '<details class="fo-svaratg"><summary>+ Åtgärd åt mig</summary><div class="fo-nyrad"><input class="f" id="foSvarAtg" placeholder="Vad behöver du göra? Till exempel Uppdatera dörruppställningen">' +
            '<label class="fo-litefalt"><span>Klar senast</span><input class="f" type="date" id="foSvarAtgDat"></label></div></details>' : "") +
        '<div class="fo-skrivknappar"><button type="button" class="p4-btn p4-btn-primar" data-sparatext="ny" title="Ctrl+Enter">' + (typ === "svar" ? "Skicka svar" : "Skicka följdfråga") + '</button>' +
        foFilZon("foFilSvar", "Bifoga") + (lamnat === "" ? '<button type="button" class="p4d-lank fo-uppdraglank" id="foSvarUppdrag">Registrera åt någon annan</button>' : "") + '</div></div>';
}
let foSvarTyp = {}, foSvarLamnat = {};
function foKonsHtml(f, jag, superu) {
    const p = foP, alla = f.konsekvens || [];
    const rad = k => '<li class="' + (k.avskriven ? "avskriven" : "") + '"><b>' + esc(FO_KONS[k.typ]) + '</b><span>' + esc(foPersonNamn(p, k.av) || "–") + " · " + foNarText(k.tid) +
        (k.kommentar ? " – " + esc(k.kommentar) : "") + (k.avskriven ? '<br><i>Avskriven ' + foNarText(k.avskriven.tid) + " av " + esc(foPersonNamn(p, k.avskriven.av) || "–") + ": " + esc(k.avskriven.orsak) + '</i>' : "") + '</span>' +
        (!k.avskriven && !f.makulerad && jag && (k.av === jag || foArStallare(p, jag, f) || superu) ? '<button type="button" class="fo-minknapp" data-konsav="' + k.id + '">Skriv av</button>' : "") + '</li>';
    const aktiva = alla.filter(k => !k.avskriven), avskrivna = alla.filter(k => k.avskriven);
    const kanMarkera = jag && !f.makulerad;
    return '<section class="fo-del fo-kons' + (aktiva.length ? " aktiv" : "") + '"><div class="fo-delrub"><h3>Tid och kostnad</h3>' +
        '<span title="' + esc(FO_PAVERKAR_TEXT) + '">Upplysning, inte ÄTA eller underrättelse</span></div>' +
        (aktiva.length ? '<ul class="fo-konslista">' + aktiva.map(rad).join("") + '</ul>' : '<p class="hjalp" style="margin:0 0 8px">Ingen har markerat risk för tid- eller kostnadspåverkan.</p>') +
        (avskrivna.length ? '<details class="fo-fler"><summary>Avskrivna markeringar (' + avskrivna.length + ')</summary><ul class="fo-konslista">' + avskrivna.map(rad).join("") + '</ul></details>' : "") +
        (kanMarkera ? '<div class="fo-textknappar"><button type="button" class="fo-minknapp" data-konsny="tid">+ Risk för tidspåverkan</button><button type="button" class="fo-minknapp" data-konsny="kostnad">+ Risk för kostnadspåverkan</button></div>' : "") +
        '</section>';
}
function foSkrivRuta(del, text, lage, post) {
    const id = "foSkriv_" + (del === "post" ? "post" : del);
    const tillagg = lage === "tillagg", rev = lage === "revidering";
    const rub = { rattelse: "Rätta – stavfel och liknande. Syns i historiken, ingen kvittering.", tillagg: "Komplettera – skrivs efter nuvarande text",
        revidering: "Revidera – ändring i sak. Tidigare version sparas och ändringen ska kvitteras." }[lage] || "";
    return '<div class="fo-skrivruta" data-skrivruta="' + del + '"' + (post ? ' data-postid="' + post + '"' : "") + '>' + (rub ? '<div class="fo-skrivrub">' + rub + '</div>' : "") +
        (tillagg ? '<div class="fo-text fo-dampad">' + foTextHtml(text) + '</div>' : "") +
        '<textarea class="f" id="' + id + '" rows="5" data-behall placeholder="' + (tillagg ? "Skriv kompletteringen …" : "Skriv …") + '">' + (tillagg ? "" : esc(text)) + '</textarea>' +
        (rev ? '<label class="fo-litefalt"><span>Orsak till revideringen</span><input class="f" id="foSkrivOrsak" data-behall placeholder="Till exempel: ändrad förutsättning från beställaren"></label>' : "") +
        (del === "post" ? '<div id="foPostBil"></div>' : "") +
        '<div class="fo-skrivknappar"><button type="button" class="p4-btn p4-btn-primar" data-sparatext="' + del + '" title="Ctrl+Enter">Spara</button>' +
        '<button type="button" class="p4-btn p4-btn-ljus" data-avbrytskriv>Avbryt</button>' + (del === "post" && lage !== "rattelse" ? foFilZon("foFilPost", "Bifoga") : "") + '</div></div>';
}
let foSvarBilagor = [], foPostBilagor = [];

function foTextHtml(t) { return esc(t).replace(/\n/g, "<br>"); }
function foDiffHtml(a, b) {
    return foDiff(a, b).map(d => d.t === "lika" ? esc(d.s) : d.t === "ny" ? '<ins>' + esc(d.s) + '</ins>' : '<del>' + esc(d.s) + '</del>').join("").replace(/\n/g, "<br>");
}
// Texten före och efter en revision.
function foRevForeEfter(f, r) {
    let lista = null;
    if (r.typ === "fraga") lista = f.textVer;
    else if (r.typ === "svar") { const x = (f.dialog || []).find(d => d.id === r.post) || foSvarPoster(f)[0]; lista = x ? x.ver : null; }
    if (!lista) return null;
    const i = lista.findIndex(v => v.tid === r.tid);
    if (i < 1) return null;
    return { fore: lista[i - 1].text, efter: lista[i].text };
}

// Klarmarkering: väljer slutligt svar och bekräftar konsekvenser när det behövs.
function foKlarDialog(f, efter) {
    const p = foP, sv = foSvarPoster(f), valda = foSlutliga(f).map(x => x.id);
    const behoverVal = !valda.length && sv.length > 1, kons = foKonsAktiva(f);
    if (!behoverVal && !kons.length) {
        if (foGor("sattLage", { id: f.id, lage: "klar" })) { status("Fråga " + f.nr + " är klar och flyttad till Klara frågor."); if (efter) efter(); }
        return;
    }
    const kropp = (sv.length > 1 ? '<div class="falt"><label>Slutligt besked</label><p class="hjalp" style="margin-top:0">Välj det eller de svar som tillsammans gäller. De visas i frågelistan.</p>' +
        sv.map(x => '<label class="fo-klarsvar"><input type="checkbox" value="' + x.id + '"' + (valda.includes(x.id) ? " checked" : "") + '><span><b>' + esc(foPersonNamn(p, foPostLamnat(x)) || "–") + '</b> · ' + foNarText(x.tid) +
            '<small>' + esc(x.text.slice(0, 220)) + (x.text.length > 220 ? "…" : "") + '</small></span></label>').join("") + '</div>' : "") +
        (kons.length ? '<div class="notis fo-konsnotis"><b>' + esc(FO_KONS_BEKRAFTA) + '</b><ul>' + kons.map(k => '<li>' + esc(FO_KONS[k.typ]) + " – " + esc(foPersonNamn(p, k.av) || "–") + (k.kommentar ? ": " + esc(k.kommentar) : "") + '</li>').join("") + '</ul>' +
            '<label class="fo-kryss"><input type="checkbox" id="foKlarKons"> Ja, konsekvenserna har kommunicerats och hanterats</label>' +
            '<p class="hjalp" style="margin:6px 0 0">Bekräftelsen sparas i historiken. Den är inte ett ekonomiskt godkännande.</p></div>' : "") + '<div id="foKlarFel"></div>';
    modal("Klarmarkera fråga " + f.nr, "", kropp, [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Klar", primar: true, fn: () => {
            const slutliga = [...document.querySelectorAll(".fo-klarsvar input:checked")].map(i => i.value);
            const fel = document.getElementById("foKlarFel");
            if (sv.length > 1 && !slutliga.length) { fel.innerHTML = '<div class="notis rod">Välj minst ett svar som slutligt besked.</div>'; return; }
            if (kons.length && !document.getElementById("foKlarKons").checked) { fel.innerHTML = '<div class="notis rod">Bekräfta att konsekvenserna har kommunicerats och hanterats.</div>'; return; }
            stangModal();
            if (foGor("sattLage", { id: f.id, lage: "klar", slutliga: sv.length > 1 ? slutliga : undefined, bekraftaKonsekvens: kons.length ? true : undefined })) {
                status("Fråga " + f.nr + " är klar och flyttad till Klara frågor.");
                if (efter) efter();
            }
        } }
    ]);
}
function foKonsDialog(f, typ) {
    modal(FO_KONS[typ], "Fråga " + f.nr, '<p class="hjalp" style="margin-top:0">' + esc(FO_PAVERKAR_TEXT) + '</p>' +
        '<div class="falt"><label for="foKonsKom">Din bedömning <span class="hjalp">(valfritt)</span></label><textarea class="f" id="foKonsKom" rows="3" placeholder="Till exempel: kräver ny håltagning på fabrik, cirka 2 veckor"></textarea></div>', [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Markera", primar: true, fn: () => {
            const k = document.getElementById("foKonsKom").value.trim();
            stangModal();
            if (foGor("konsekvensMarkera", { id: f.id, typ: typ, kid: foId(), kommentar: k })) status(FO_KONS[typ] + " markerad. Den syns i frågelistan och i historiken.");
        } }]);
    setTimeout(() => { const t = document.getElementById("foKonsKom"); if (t) t.focus(); }, 30);
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
        ({ ny: "", tillagg: "· komplettering", andring: "· revidering", rattelse: "· rättelse" })[v.typ || "ny"] + ' <span>' + esc(foPersonNamn(p, v.av)) + " · " + foNarText(v.tid) + '</span></div>' +
        (v.orsak ? '<div class="fo-revorsak">Orsak: ' + esc(v.orsak) + '</div>' : "") +
        '<div class="fo-text">' + (i ? foDiffHtml(lista[i - 1].text, v.text) : foTextHtml(v.text)) + '</div></li>').join("") + '</ol>' : "";
    return '<p class="hjalp" style="margin-top:0">Historiken kan inte ändras, inte heller av en superuser. Varje version av frågan och svaren finns kvar.</p>' +
        '<ul class="fo-handelser fo-histlista">' + rader + '</ul>' + ver(f.textVer, "Frågans versioner") +
        (f.dialog || []).filter(x => x.ver.length > 1).map(x => ver(x.ver, (x.typ === "svar" ? "Svar" : "Följdfråga") + " från " + esc(foPersonNamn(p, foPostLamnat(x)) || "–") + " " + foDag(x.tid))).join("");
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
        foRedigerar = { del: del, lage: lage, post: b.dataset.post || "" };
        foPostBilagor = [];
        foRitaPanel();
        const t = document.getElementById("foSkriv_" + del); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
    }));
    pan.querySelectorAll("[data-avbrytskriv]").forEach(b => b.addEventListener("click", () => { foRedigerar = null; foPostBilagor = []; foRitaPanel(); }));
    // ändra frågan eller ett inlägg
    pan.querySelectorAll('[data-sparatext="fraga"], [data-sparatext="post"]').forEach(b => {
        const del = b.dataset.sparatext, t = document.getElementById("foSkriv_" + del);
        const spara = () => {
            const lage = foRedigerar ? foRedigerar.lage : "revidering";
            const x = del === "post" ? (f.dialog || []).find(d => d.id === foRedigerar.post) : null;
            const gammal = del === "fraga" ? f.text : (x ? x.text : "");
            const val = t.value.trim();
            if (!val) { t.focus(); return status(lage === "tillagg" ? "Skriv kompletteringen." : "Texten kan inte vara tom.", true); }
            const ny = lage === "tillagg" ? gammal.replace(/\s+$/, "") + "\n\n" + val : val;
            if (ny === gammal) { foRedigerar = null; return foRitaPanel(); }
            const oEl = document.getElementById("foSkrivOrsak"), orsak = oEl ? oEl.value.trim() : "";
            if (lage === "revidering" && !orsak) { if (oEl) oEl.focus(); return status("Ange orsaken till revideringen.", true); }
            const r = del === "fraga" ? foGor("fragaText", { id: f.id, text: ny, satt: lage, orsak: orsak }, true)
                : foGor("dialogAndra", { id: f.id, post: x.id, text: ny, satt: lage, orsak: orsak, bilagor: foPostBilagor }, true);
            if (!r) return;
            foRedigerar = null; foPostBilagor = [];
            foRita();
            status({ rattelse: "Rättelsen är sparad och syns i historiken.", tillagg: "Kompletteringen är sparad.", revidering: "Revideringen är sparad som en ny version och ska kvitteras." }[lage]);
        };
        b.addEventListener("click", spara);
        if (t) t.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); spara(); } });
    });
    // nytt svar eller följdfråga
    const nyKnapp = pan.querySelector('[data-sparatext="ny"]'), nyT = document.getElementById("foSkriv_ny");
    if (nyKnapp && nyT) {
        const skicka = () => {
            const text = nyT.value.trim();
            if (!text) { nyT.focus(); return status("Skriv något först.", true); }
            const typ = (pan.querySelector("[data-svartyp].vald") || {}).dataset.svartyp || "svar";
            const lEl = document.getElementById("foSvarLamnat"), lamnat = lEl ? lEl.value : "";
            if (lEl && !lamnat) { lEl.focus(); return status("Välj vem som lämnade beskedet.", true); }
            const x = foGor("dialogPost", { id: f.id, post: foId(), typ: typ, text: text, lamnat: lamnat || undefined, bilagor: foSvarBilagor }, true);
            if (!x) return;
            foSvarBilagor = []; delete foSvarLamnat[f.id]; delete foSvarTyp[f.id];
            nyT.value = "";
            // Svar och åtgärd i samma arbetsmoment (frivilligt)
            const atgT = document.getElementById("foSvarAtg");
            const atg = atgT && atgT.value.trim() ? foGor("nyAtgard", { id: foId(), text: atgT.value.trim(), ansvarig: { person: foJagId() }, senast: document.getElementById("foSvarAtgDat").value, kalla: { typ: "fraga", id: f.id } }, true) : null;
            foRita();
            if (atg) { status("Svaret är skickat och åtgärd Å-" + atg.nr + " ligger i din att göra-lista."); return; }
            foRita();
            status(typ === "svar" ? "Svaret är skickat. Frågeställaren bedömer det." : "Följdfrågan är skickad.");
        };
        nyKnapp.addEventListener("click", skicka);
        nyT.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); skicka(); } });
    }
    pan.querySelectorAll("[data-svartyp]").forEach(b => b.addEventListener("click", () => {
        const t = document.getElementById("foSkriv_ny"), v = t ? t.value : "";
        foSvarTyp[f.id] = b.dataset.svartyp; foRitaPanel();
        const n = document.getElementById("foSkriv_ny"); if (n) { n.value = v; n.focus(); }
    }));
    const upp = pan.querySelector("#foSvarUppdrag");
    if (upp) upp.addEventListener("click", () => {
        const t = document.getElementById("foSkriv_ny"), v = t ? t.value : "";
        foSvarLamnat[f.id] = "_"; foRitaPanel();
        const n = document.getElementById("foSkriv_ny"); if (n) n.value = v;
        const s = document.getElementById("foSvarLamnat"); if (s) { s.value = ""; s.focus(); }
    });
    // slutligt svar
    pan.querySelectorAll("[data-slutligt]").forEach(b => b.addEventListener("click", () => {
        if (foGor("slutligtSvar", { id: f.id, post: b.dataset.slutligt })) status("Det slutliga beskedet är uppdaterat och visas i frågelistan.");
    }));
    // tid och kostnad
    pan.querySelectorAll("[data-konsny]").forEach(b => b.addEventListener("click", () => foKonsDialog(f, b.dataset.konsny)));
    pan.querySelectorAll("[data-konsav]").forEach(b => b.addEventListener("click", () => foFragaOrsak("Skriv av markeringen",
        "Markeringen finns kvar i historiken som avskriven.", "Skriv av", o => foGor("konsekvensAvskriv", { id: f.id, kid: b.dataset.konsav, orsak: o }))));
    // bilagor
    foKopplaBilagor(pan, f.bilagor);
    const zf = pan.querySelector("#foFilFraga");
    if (zf) foFilMottagare(zf, null, (meta) => { foGor("bilagor", { id: f.id, del: "fraga", bilagor: meta }); status(meta.length === 1 ? "Bilagan lades till." : meta.length + " bilagor lades till."); });
    const zs = pan.querySelector("#foFilSvar");
    if (zs) {
        const ritaSb = () => { const el = document.getElementById("foSvarBil"); if (el) { el.innerHTML = foBilagorHtml(foSvarBilagor); foKopplaBilagor(el, foSvarBilagor); } };
        ritaSb();
        foFilMottagare(zs, document.getElementById("foSkriv_ny"), (meta) => { foSvarBilagor = foSvarBilagor.concat(meta); ritaSb(); });
    }
    const zp = pan.querySelector("#foFilPost");
    if (zp) {
        const ritaPb = () => { const el = document.getElementById("foPostBil"); if (el) { el.innerHTML = foBilagorHtml(foPostBilagor); foKopplaBilagor(el, foPostBilagor); } };
        ritaPb();
        foFilMottagare(zp, document.getElementById("foSkriv_post"), (meta) => { foPostBilagor = foPostBilagor.concat(meta); ritaPb(); });
    }
    // uppgifter som sparas direkt
    const direkt = (id, fn) => { const el = pan.querySelector("#" + id); if (el) el.addEventListener("change", () => { if (foGor("fragaFalt", Object.assign({ id: f.id }, fn(el)), true)) { foRitaUtanPanel(); foVisaSparat(el); } }); };
    direkt("foPFran", el => ({ fran: el.value }));
    direkt("foPSenast", el => ({ svarSenast: el.value }));
    const stEl = pan.querySelector("#foPStallare");
    if (stEl) stEl.addEventListener("change", () => {
        if (!stEl.value) { stEl.value = foStallarePerson(f); return; }
        if (foGor("fragaFalt", { id: f.id, stallare: stEl.value })) status("Frågan är överförd till " + foPersonNamn(p, stEl.value) + ".");
    });
    foKopplaPartValjare(pan, "foPMott", foMottagare(f), (lista) => foGor("fragaFalt", { id: f.id, mottagare: lista }));
    foKopplaPartValjare(pan, "foPBerorda", f.berorda.map(d => ({ disc: d })).concat(f.berordaP.map(x => ({ person: x }))), (lista) =>
        foGor("fragaFalt", { id: f.id, berorda: lista.filter(x => x.disc).map(x => x.disc), berordaP: lista.filter(x => x.person).map(x => x.person) }));
    pan.querySelectorAll(".fo-valchips").forEach(grupp => grupp.querySelectorAll(".fo-valchip").forEach(b => b.addEventListener("click", () => {
        if (!kan || f.makulerad) return;
        const val = grupp.dataset.val, id = b.dataset.id;
        if (val === "moten") { foGor("motesmarkering", { id: f.id, forum: id }); return; }
        if (val.startsWith("ind:")) { const l = f.indelning.includes(id) ? f.indelning.filter(x => x !== id) : f.indelning.concat(id); foGor("fragaFalt", { id: f.id, indelning: l }); }
    })));
    // läge och åtgärder
    pan.querySelectorAll("[data-lage]").forEach(b => b.addEventListener("click", () => {
        const lage = b.dataset.lage;
        if (lage === "klar") return foKlarDialog(f);
        if (lage === "klaratg") return foKlarDialog(f, () => foAtgardDialog(null, { typ: "fraga", id: f.id, ansvarig: (foMottagare(f)[0] || null) }));
        if (lage === "ofullstandig") {
            modal("Svaret är ofullständigt", "Fråga " + f.nr, '<div class="falt"><label for="foOfKom">Vad saknas? (frivilligt)</label><textarea class="f" id="foOfKom" rows="3"></textarea></div>' +
                '<p class="hjalp">Frågan går tillbaka till ' + esc(foMottagareText(p, f) || "mottagaren") + ' för komplettering. Vill du fråga något specifikt kan du också skriva en följdfråga.</p>', [
                { txt: "Avbryt", fn: stangModal },
                { txt: "Begär komplettering", primar: true, fn: () => { const k = document.getElementById("foOfKom").value.trim(); stangModal(); if (foGor("sattLage", { id: f.id, lage: "ofullstandig", kommentar: k })) status("Komplettering begärd."); } }]);
            return;
        }
        if (foGor("sattLage", { id: f.id, lage: lage })) status("Fråga " + f.nr + " är återöppnad och ligger under Aktiva frågor.");
    }));
    const atg = pan.querySelector("#foPAtg"); if (atg) atg.addEventListener("click", () => foAtgardDialog(null, { typ: "fraga", id: f.id }));
    const pam = pan.querySelector("#foPPaminn"); if (pam) pam.addEventListener("click", () => foPaminnDialog([f]));
    const kvb = pan.querySelector("#foPKvitt"); if (kvb) kvb.addEventListener("click", () => foKvittDialog({ typ: "fraga", id: f.id }, "Fråga " + f.nr + ": " + f.text.slice(0, 120), foPersonerIFraga(p, f, true).filter(id => id !== jag)));
    const brad = pan.querySelector("#foPBrad"); if (brad) brad.addEventListener("click", () => { if (foGor("bradskande", { id: f.id, pa: !f.bradskande })) status(f.bradskande ? "Frågan är markerad som brådskande och mejlas direkt till dem som ska svara." : "Markeringen brådskande är borttagen."); });
    foKopplaKvitt(pan);
    ["#foPBeslut", "#foPBeslut2"].forEach(s => { const b = pan.querySelector(s); if (b) b.addEventListener("click", () => foBeslutDialog(f, null)); });
    pan.querySelectorAll("[data-visabeslut]").forEach(li => li.addEventListener("click", () => foBeslutVisa(foBeslut(p, li.dataset.visabeslut))));
    const logg = pan.querySelector("#foPLogg"); if (logg) logg.addEventListener("click", () => { if (foGor("beslutslogg", { id: f.id, pa: !f.ilogg })) status(f.ilogg ? "Fråga " + f.nr + " är borttagen från beslutsloggen." : "Fråga " + f.nr + " ingår nu i beslutsloggen."); });
    const kat = pan.querySelector("#foPKopplaAtg"); if (kat) kat.addEventListener("click", () => { foPanelFlik = "kopplat"; foRitaPanel(); });
    const stj = pan.querySelector("#foPStjarna"); if (stj) stj.addEventListener("click", () => foGor("stjarna", { id: f.id, pa: !f.stjarna }));
    const mak = pan.querySelector("#foPMak"); if (mak) mak.addEventListener("click", () => foFragaOrsak("Makulera fråga " + f.nr,
        "Frågan döljs i listorna men finns kvar med nummer, filer och historik. Numret återanvänds aldrig, och frågan kan återställas.", "Makulera", o => foGor("makuleraFraga", { id: f.id, orsak: o })));
    const at = pan.querySelector("#foPAterstall"); if (at) at.addEventListener("click", () => foGor("aterstallFraga", { id: f.id }));
    // kopplingar
    pan.querySelectorAll("[data-gakopp]").forEach(b => b.addEventListener("click", () => {
        const [typ, id] = b.dataset.gakopp.split(":");
        if (typ === "fraga") { const g = foFraga(p, id); if (g) foGaTill(g.lage === "klar" ? "klara" : foVy === "klara" ? "aktiva" : foVy, id); }
        if (typ === "beslut") foBeslutVisa(foBeslut(p, id));
        if (typ === "atgard") foAtgardDialog(foAtgard(p, id));
        if (typ === "inlagg") foVisaInlagg(id);
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
