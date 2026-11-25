/* ======================================================================
   Wimo Forma · Projektflöde
   En gemensam yta för löpande information i projektet: korta inlägg med bilder,
   filer, taggade personer och discipliner och länkar till frågor, åtgärder och beslut.
   - Fästa inlägg ligger överst.
   - Kommentarerna är platta – flödet ska inte bli ett chattverktyg.
   - Det som behöver hanteras vidare görs om till en fråga, åtgärd eller ett beslut
     med ett klick; inlägget visar sedan vad det blev, så att inget försvinner i flödet.
   ====================================================================== */

let foFlodeFilter = { sok: "", vad: "alla", disc: "" };
const foFlodeUtkast = { text: "", bilagor: [], personer: [], disc: [], lankar: [], oppen: "" };
const foKommentarUtkast = {};          // inläggs-id → text som håller på att skrivas
let foFlodeRedigerar = "";             // inlägget som redigeras
const foKommOppen = new Set();         // inlägg där man har tryckt Kommentera

const FO_TUMME = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/><path d="M7 10l4-7a2.5 2.5 0 0 1 2.5 3l-1 4h5.6a2 2 0 0 1 2 2.4l-1.3 6.8A2.5 2.5 0 0 1 16.3 21H7"/></svg>';
const FO_PRATBUBBLA = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/></svg>';

function foInitialer(p, id) {
    const x = foPerson(p, id);
    const n = x ? ((x.fornamn || "").charAt(0) + (x.efternamn || "").charAt(0)) || (x.epost || "?").charAt(0) : "?";
    return n.toUpperCase();
}
function foAvsandare(p, id) {
    const x = foPerson(p, id);
    if (!x) return "";
    const ft = foForetag(p, x.foretagId);
    return [ft && ft.namn, (x.disc || []).map(d => (foDisc(p, d) || {}).kod).filter(Boolean).join(", ")].filter(Boolean).join(" · ");
}

// Texten: radbrytningar behålls, webbadresser blir länkar och #12 / Å-3 blir länkar till fråga 12 och åtgärd Å-3.
function foFlodeText(p, text) {
    return esc(text || "")
        .replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (u) => '<a href="' + u + '" target="_blank" rel="noopener">' + u + "</a>")
        .replace(/(^|[\s(])#(\d{1,5})\b/g, (m, fore, nr) => { const f = foFragaNr(p, nr); return f ? fore + '<button type="button" class="fo-reflank" data-gakopp="fraga:' + f.id + '">Fråga ' + nr + "</button>" : m; })
        .replace(/(^|[\s(])[ÅA]-(\d{1,5})\b/g, (m, fore, nr) => { const a = p.atgarder.find(x => x.nr === +nr); return a ? fore + '<button type="button" class="fo-reflank" data-gakopp="atgard:' + a.id + '">Å-' + nr + "</button>" : m; });
}

function foLankChip(p, l, blev) {
    const o = foObj(p, l);
    if (!o) return "";
    return '<button type="button" class="fo-lankchip' + (blev ? " blev" : "") + '" data-gakopp="' + l.typ + ":" + l.id + '" title="' + esc(String(o.text || "").slice(0, 140)) + '">' +
        (blev ? "Blev " + foObjNamn(p, l).toLowerCase() : esc(foObjNamn(p, l))) + "</button>";
}

/* ---------- ett inlägg ---------- */
function foInlaggHtml(p, x, jag, nytt) {
    const egen = x.av === jag, leda = foKanLeda(p, jag), kan = !!jag;
    const gillat = x.gillar.includes(jag);
    const taggar = x.personer.map(id => '<span class="fo-tagg2">@' + esc(foPersonNamn(p, id)) + "</span>")
        .concat(x.disc.map(id => { const d = foDisc(p, id); return d ? '<span class="fo-tagg2">@' + esc(d.kod + " " + d.namn) + "</span>" : ""; })).join("");
    const lankar = x.lankar.map(l => foLankChip(p, l, false)).join("");
    const blev = x.kopplingar.filter(k => k.typ !== "inlagg").map(k => foLankChip(p, k, true)).join("");
    const meny = [];
    if (kan && (egen || leda)) meny.push('<button type="button" data-inlgor="fast">' + (x.fast ? "Lossa från toppen" : "Fäst överst") + "</button>");
    if (egen) meny.push('<button type="button" data-inlgor="andra">Ändra texten</button>');
    if (kan && foKanSkriva(p, jag)) meny.push('<button type="button" data-inlgor="fraga">Gör till fråga</button>', '<button type="button" data-inlgor="atgard">Gör till åtgärd</button>');
    if (kan && leda) meny.push('<button type="button" data-inlgor="beslut">Gör till beslut</button>');
    if (kan && foKanSkriva(p, jag)) meny.push('<button type="button" data-inlgor="kvitt">Begär kvittering</button>');
    if (kan && (egen || leda)) meny.push('<button type="button" class="fara" data-inlgor="tabort">Ta bort inlägget</button>');
    const red = foFlodeRedigerar === x.id;
    return '<article class="fo-inlagg' + (x.fast ? " fast" : "") + (nytt ? " nytt" : "") + '" data-rad="' + x.id + '" data-inlagg="' + x.id + '">' +
        '<header class="fo-inlhuvud"><span class="fo-avatar" aria-hidden="true">' + esc(foInitialer(p, x.av)) + "</span>" +
        '<div class="fo-inlvem"><b>' + esc(foPersonNamn(p, x.av) || "Okänd") + "</b>" + (foAvsandare(p, x.av) ? "<small>" + esc(foAvsandare(p, x.av)) + "</small>" : "") +
        '<time datetime="' + esc(x.tid) + '">' + foNarText(x.tid) + (x.redigerad ? " · ändrad" : "") + (nytt ? ' · <b class="fo-nyord">ny</b>' : "") + "</time></div>" +
        (x.fast ? '<span class="fo-fastmark">Fäst</span>' : "") +
        (meny.length ? '<details class="fo-inlmeny"><summary aria-label="Fler val">⋯</summary><div class="fo-inlmenyval">' + meny.join("") + "</div></details>" : "") + "</header>" +
        (red ? '<div class="fo-inlred"><textarea class="f" id="foInlRed" rows="4">' + esc(x.text) + '</textarea><div class="fo-knapprad"><button type="button" class="mknapp" data-inlgor="avbrytandra">Avbryt</button><button type="button" class="mknapp primar" data-inlgor="sparaandra">Spara</button></div></div>'
            : (x.text ? '<div class="fo-inltext">' + foFlodeText(p, x.text) + "</div>" : "")) +
        (taggar ? '<div class="fo-inltaggar">' + taggar + "</div>" : "") +
        foBilagorHtml(x.bilagor) +
        (lankar || blev ? '<div class="fo-inllankar">' + lankar + blev + "</div>" : "") +
        foKvittHtml({ typ: "inlagg", id: x.id }) +
        '<footer class="fo-inlfot">' +
        '<button type="button" class="fo-gilla' + (gillat ? " pa" : "") + '" data-inlgor="gilla" aria-pressed="' + gillat + '"' + (kan ? "" : " disabled") +
        ' title="' + esc(x.gillar.map(id => foPersonNamn(p, id)).join(", ") || "Ingen har gillat ännu") + '">' + FO_TUMME + "<span>" + (x.gillar.length || "") + "</span><span class=\"sr\">gillar</span></button>" +
        '<button type="button" class="fo-kommknapp" data-inlgor="kommentera">' + FO_PRATBUBBLA + "<span>" + (x.kommentarer.length ? x.kommentarer.length + (x.kommentarer.length === 1 ? " kommentar" : " kommentarer") : "Kommentera") + "</span></button></footer>" +
        (x.kommentarer.length ? '<ol class="fo-kommentarer">' + x.kommentarer.map(k => '<li><span class="fo-avatar liten" aria-hidden="true">' + esc(foInitialer(p, k.av)) + "</span>" +
            '<div><b>' + esc(foPersonNamn(p, k.av) || "Okänd") + "</b> <time>" + foNarText(k.tid) + "</time>" +
            (k.av === jag || leda ? '<button type="button" class="fo-kommbort" data-kommbort="' + k.id + '" aria-label="Ta bort kommentaren">×</button>' : "") +
            '<p>' + foFlodeText(p, k.text) + "</p></div></li>").join("") + "</ol>" : "") +
        (kan && (x.kommentarer.length || foKommOppen.has(x.id) || foKommentarUtkast[x.id]) ? '<div class="fo-kommskriv"><textarea class="f" rows="1" id="foKomm_' + x.id + '" data-kommtill="' + x.id + '" placeholder="Skriv en kommentar … (Enter skickar)">' + esc(foKommentarUtkast[x.id] || "") + "</textarea></div>" : "") +
        "</article>";
}

/* ---------- skrivrutan ---------- */
function foSkrivrutaHtml(p, jag) {
    const u = foFlodeUtkast;
    const valda = u.personer.map(id => '<button type="button" class="fo-tagg2 valbar" data-taborttagg="p:' + id + '">@' + esc(foPersonNamn(p, id)) + " ×</button>")
        .concat(u.disc.map(id => { const d = foDisc(p, id); return d ? '<button type="button" class="fo-tagg2 valbar" data-taborttagg="d:' + id + '">@' + esc(d.kod + " " + d.namn) + " ×</button>" : ""; }))
        .concat(u.lankar.map(l => '<button type="button" class="fo-lankchip valbar" data-tabortlank="' + l.typ + ":" + l.id + '">' + esc(foObjNamn(p, l)) + " ×</button>")).join("");
    const oppen = !!(u.text || u.bilagor.length || u.personer.length || u.disc.length || u.lankar.length || u.oppen);
    return '<div class="fo-skriv' + (oppen ? " oppen" : "") + '" id="foSkriv">' +
        '<div class="fo-skrivrad"><span class="fo-avatar" aria-hidden="true">' + esc(foInitialer(p, jag)) + "</span>" +
        '<textarea class="f" id="foFlodeText" rows="' + (oppen ? 3 : 1) + '" placeholder="Dela information med projektet …">' + esc(u.text) + "</textarea></div>" +
        '<div class="fo-skrivdetalj">' +
        (valda ? '<div class="fo-skrivvalda">' + valda + "</div>" : "") +
        (u.bilagor.length ? '<div class="fo-skrivbilagor">' + u.bilagor.map(b => '<span class="fo-skrivfil">' + esc(b.namn) + ' <button type="button" data-taborfil="' + b.id + '" aria-label="Ta bort ' + esc(b.namn) + '">×</button></span>').join("") + "</div>" : "") +
        (u.oppen === "tagga" ? '<div class="fo-skrivpanel"><div class="fo-plrub">Tagga personer</div>' +
            foValChips("flpers", p.personer.filter(x => x.aktiv && x.id !== jag).map(x => ({ id: x.id, namn: foPersonNamn(p, x.id) })), u.personer) +
            (p.discipliner.some(d => d.aktiv) ? '<div class="fo-plrub">Tagga discipliner</div>' + foValChips("fldisc", p.discipliner.filter(d => d.aktiv).sort((a, b) => a.ordning - b.ordning).map(d => ({ id: d.id, namn: d.kod + " " + d.namn })), u.disc) : "") +
            "</div>" : "") +
        (u.oppen === "lanka" ? '<div class="fo-skrivpanel"><input class="f" id="foLankSok" placeholder="Sök fråga, åtgärd eller beslut – nummer eller text" autocomplete="off"><div id="foLankTraff" class="fo-lanktraff"></div></div>' : "") +
        '<div class="fo-skrivknappar"><label class="mknapp fo-bifoga" tabindex="0"><input type="file" multiple hidden id="foFlodeFil" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.dwg,.ifc,.txt"><span class="fo-gem" aria-hidden="true"></span> Bifoga</label>' +
        '<button type="button" class="mknapp' + (u.oppen === "tagga" ? " vald" : "") + '" data-skrivpanel="tagga">@ Tagga</button>' +
        '<button type="button" class="mknapp' + (u.oppen === "lanka" ? " vald" : "") + '" data-skrivpanel="lanka">Länka</button>' +
        '<span class="fo-skrivtips">Skriv #12 för att länka fråga 12. Klistra in skärmklipp med Ctrl+V.</span>' +
        '<button type="button" class="mknapp primar" id="foPublicera">Publicera</button></div></div></div>';
}

/* ---------- vyn ---------- */
function foVyFlode(yta) {
    const p = foP, jag = foJagId();
    // behåll fokus och markör när vyn ritas om (t.ex. när någon annan publicerar)
    const ae = document.activeElement, aeId = ae && yta.contains(ae) && ae.id, s0 = aeId && ae.selectionStart, s1 = aeId && ae.selectionEnd;
    const q = foNormal(foFlodeFilter.sok).trim();
    let lista = (p.flode || []).slice();
    if (foFlodeFilter.vad === "namner") lista = lista.filter(x => foInlaggNamner(p, jag, x));
    if (foFlodeFilter.vad === "mina") lista = lista.filter(x => x.av === jag);
    if (foFlodeFilter.vad === "fasta") lista = lista.filter(x => x.fast);
    if (foFlodeFilter.disc) lista = lista.filter(x => x.disc.includes(foFlodeFilter.disc) || (foPerson(p, x.av) && (foPerson(p, x.av).disc || []).includes(foFlodeFilter.disc)));
    if (q) lista = lista.filter(x => foNormal([x.text, foPersonNamn(p, x.av)].concat(x.kommentarer.map(k => k.text)).join(" ")).includes(q));
    lista.sort((a, b) => (b.tid || "").localeCompare(a.tid || ""));
    const fasta = lista.filter(x => x.fast), ovriga = lista.filter(x => !x.fast);
    const nya = new Set(lista.filter(x => x.av !== jag && foNytt(p, jag, x)).map(x => x.id));
    const antal = { namner: (p.flode || []).filter(x => foInlaggNamner(p, jag, x)).length, mina: (p.flode || []).filter(x => x.av === jag).length, fasta: (p.flode || []).filter(x => x.fast).length };
    const chip = (k, t) => '<button type="button" class="fo-snabb' + (foFlodeFilter.vad === k ? " vald" : "") + '" data-flodevad="' + k + '" aria-pressed="' + (foFlodeFilter.vad === k) + '">' + t + (antal[k] ? " <span>" + antal[k] + "</span>" : "") + "</button>";
    const filtrerat = q || foFlodeFilter.vad !== "alla" || foFlodeFilter.disc;
    let html = foTopp("Projektflöde");
    html += jag ? foSkrivrutaHtml(p, jag) : '<div class="notis">Du finns inte i projektets kontaktlista ännu och kan inte publicera. Be en projekteringsledare lägga till dig under Projektmedlemmar.</div>';
    html += '<div class="fo-verktygsrad"><label class="fo-sokfalt"><span class="p4-ik ik-sok" aria-hidden="true"></span><input class="f" id="foFlodeSok" type="search" placeholder="Sök i flödet" value="' + esc(foFlodeFilter.sok) + '"></label>' +
        '<div class="fo-snabbrad">' + chip("alla", "Alla") + chip("namner", "Nämner mig") + chip("mina", "Mina inlägg") + chip("fasta", "Fästa") + "</div>" +
        (p.discipliner.some(d => d.aktiv) ? foDiscSelect("foFlodeDisc", foFlodeFilter.disc, "Alla discipliner", ' aria-label="Disciplin"') : "") + "</div>";
    if (!lista.length) html += filtrerat ? foTomt("Inga inlägg matchar", "Byt filter eller sökning.")
        : foTomt("Inget i flödet ännu", "Dela det som projektet behöver veta: nya ritningar, ett protokoll, en ändrad leveranstid. Frågor som ska besvaras ställer du under Frågor & svar.");
    else {
        if (fasta.length) html += '<h3 class="fo-blockrub">Fäst överst <span class="antal">' + fasta.length + "</span></h3>" + '<div class="fo-flode">' + fasta.map(x => foInlaggHtml(p, x, jag, nya.has(x.id))).join("") + "</div>";
        if (ovriga.length) html += (fasta.length ? '<h3 class="fo-blockrub">Senaste</h3>' : "") + '<div class="fo-flode">' + ovriga.map(x => foInlaggHtml(p, x, jag, nya.has(x.id))).join("") + "</div>";
    }
    yta.innerHTML = html;
    foKopplaFlode(yta, p, jag);
    foKopplaBilagor(yta, (p.flode || []).flatMap(x => x.bilagor));
    if (aeId) { const el = document.getElementById(aeId); if (el) { el.focus(); try { el.setSelectionRange(s0, s1); } catch (e) { } } }
    // det som syns är sett
    if (jag && nya.size) setTimeout(() => { if (foVy === "flode" && foP) { foGor("sett", { ids: [...nya] }, true); foRitaNav(); } }, 1500);
}

function foKopplaFlode(yta, p, jag) {
    const u = foFlodeUtkast;
    const text = document.getElementById("foFlodeText");
    if (text) {
        const vaxa = () => { text.style.height = "auto"; text.style.height = Math.min(text.scrollHeight + 2, 360) + "px"; };
        text.addEventListener("focus", () => { const r = document.getElementById("foSkriv"); if (r && !r.classList.contains("oppen")) { r.classList.add("oppen"); text.rows = 3; } });
        text.addEventListener("input", () => { u.text = text.value; vaxa(); });
        text.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); foPubliceraInlagg(); } });
        // skärmklipp som klistras in i texten, filer som släpps på rutan och Bifoga hamnar i inlägget
        foFilMottagare(document.getElementById("foSkriv"), null, (meta) => { u.text = text.value; u.bilagor = u.bilagor.concat(meta); foRita(); });
        if (u.text) vaxa();
    }
    const fil = document.getElementById("foFlodeFil");
    if (fil) fil.closest("label").addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fil.click(); } });
    const pub = document.getElementById("foPublicera");
    if (pub) pub.addEventListener("click", foPubliceraInlagg);
    yta.querySelectorAll("[data-skrivpanel]").forEach(b => b.addEventListener("click", () => { u.oppen = u.oppen === b.dataset.skrivpanel ? "" : b.dataset.skrivpanel; foRita(); if (u.oppen === "lanka") setTimeout(() => { const s = document.getElementById("foLankSok"); if (s) s.focus(); }, 20); }));
    yta.querySelectorAll('.fo-valchips[data-val="flpers"] .fo-valchip, .fo-valchips[data-val="fldisc"] .fo-valchip').forEach(b => b.addEventListener("click", () => {
        const lista = b.closest(".fo-valchips").dataset.val === "flpers" ? u.personer : u.disc;
        const i = lista.indexOf(b.dataset.id);
        if (i >= 0) lista.splice(i, 1); else lista.push(b.dataset.id);
        foRita();
    }));
    yta.querySelectorAll("[data-taborttagg]").forEach(b => b.addEventListener("click", () => {
        const [t, id] = b.dataset.taborttagg.split(":");
        if (t === "p") u.personer = u.personer.filter(x => x !== id); else u.disc = u.disc.filter(x => x !== id);
        foRita();
    }));
    yta.querySelectorAll("[data-tabortlank]").forEach(b => b.addEventListener("click", () => { const [t, id] = b.dataset.tabortlank.split(":"); u.lankar = u.lankar.filter(l => !(l.typ === t && l.id === id)); foRita(); }));
    yta.querySelectorAll("[data-taborfil]").forEach(b => b.addEventListener("click", () => { u.bilagor = u.bilagor.filter(x => x.id !== b.dataset.taborfil); foRita(); }));
    const ls = document.getElementById("foLankSok");
    if (ls) ls.addEventListener("input", () => {
        const t = foSok(p, ls.value, 8).filter(x => ["fraga", "atgard", "beslut"].includes(x.typ) && !u.lankar.some(l => l.typ === x.typ && l.id === x.id));
        const box = document.getElementById("foLankTraff");
        box.innerHTML = t.length ? t.map((x, i) => '<button type="button" data-lankval="' + i + '"><b>' + esc(x.rubrik) + "</b> " + esc(String(x.text || "").slice(0, 90)) + "</button>").join("") : (ls.value.trim() ? '<p class="hjalp">Inga träffar.</p>' : "");
        box.querySelectorAll("[data-lankval]").forEach(b => b.addEventListener("click", () => { const x = t[+b.dataset.lankval]; u.lankar.push({ typ: x.typ, id: x.id }); foRita(); }));
    });
    // filter
    const sok = document.getElementById("foFlodeSok");
    let sokT = null;
    if (sok) sok.addEventListener("input", () => { clearTimeout(sokT); sokT = setTimeout(() => { foFlodeFilter.sok = sok.value; foRitaBehall(); }, 160); });
    yta.querySelectorAll("[data-flodevad]").forEach(b => b.addEventListener("click", () => { foFlodeFilter.vad = foFlodeFilter.vad === b.dataset.flodevad ? "alla" : b.dataset.flodevad; foRita(); }));
    const disc = document.getElementById("foFlodeDisc");
    if (disc) disc.addEventListener("change", () => { foFlodeFilter.disc = disc.value; foRita(); });
    // inläggen
    yta.querySelectorAll("[data-gakopp]").forEach(b => b.addEventListener("click", () => {
        const [typ, id] = b.dataset.gakopp.split(":");
        if (typ === "fraga") { const f = foFraga(p, id); if (f) foGaTill(f.lage === "klar" ? "klara" : "aktiva", id); }
        if (typ === "beslut") foBeslutVisa(foBeslut(p, id));
        if (typ === "atgard") foAtgardDialog(foAtgard(p, id));
    }));
    foKopplaKvitt(yta);
    yta.querySelectorAll("[data-inlgor]").forEach(b => b.addEventListener("click", () => {
        const art = b.closest("[data-inlagg]"), x = art && foInlagg(foP, art.dataset.inlagg);
        if (x) foInlaggGor(x, b.dataset.inlgor);
    }));
    yta.querySelectorAll("[data-kommbort]").forEach(b => b.addEventListener("click", () => {
        const id = b.closest("[data-inlagg]").dataset.inlagg;
        if (confirm("Ta bort kommentaren?")) foGor("taBortKommentar", { id, kid: b.dataset.kommbort });
    }));
    yta.querySelectorAll("[data-kommtill]").forEach(t => {
        const id = t.dataset.kommtill;
        const vaxa = () => { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight + 2, 200) + "px"; };
        t.addEventListener("input", () => { foKommentarUtkast[id] = t.value; vaxa(); });
        t.addEventListener("keydown", (e) => {
            if (e.key !== "Enter" || e.shiftKey) return;
            e.preventDefault();
            if (!t.value.trim()) return;
            const text = t.value;
            delete foKommentarUtkast[id];
            if (!foGor("kommentera", { id, kid: foId(), text })) foKommentarUtkast[id] = text;
        });
        if (t.value) vaxa();
    });
    const red = document.getElementById("foInlRed");
    if (red) { red.focus(); red.setSelectionRange(red.value.length, red.value.length); }
}

function foPubliceraInlagg() {
    const u = foFlodeUtkast;
    const t = document.getElementById("foFlodeText");
    if (t) u.text = t.value;
    if (!u.text.trim() && !u.bilagor.length) { if (t) t.focus(); return status("Skriv något eller bifoga en fil.", true); }
    const x = foGor("nyttInlagg", { id: foId(), text: u.text, bilagor: u.bilagor, personer: u.personer, disc: u.disc, lankar: u.lankar }, true);
    if (!x) return;
    Object.assign(u, { text: "", bilagor: [], personer: [], disc: [], lankar: [], oppen: "" });
    foFlodeFilter = { sok: "", vad: "alla", disc: foFlodeFilter.disc };
    foRita();
    status("Inlägget är publicerat.");
}

function foInlaggGor(x, gor) {
    const p = foP;
    const kalla = { typ: "inlagg", id: x.id };
    if (gor === "gilla") return foGor("gillaInlagg", { id: x.id, pa: !x.gillar.includes(foJagId()) });
    if (gor === "kvitt") return foKvittDialog({ typ: "inlagg", id: x.id }, "Inlägg av " + (foPersonNamn(p, x.av) || "–") + ": " + String(x.text || "").slice(0, 120), (x.personer || []).concat(foAvisPersoner(p, (x.disc || []).map(d => ({ disc: d })))));
    if (gor === "kommentera") {
        if (!document.getElementById("foKomm_" + x.id)) { foKommOppen.add(x.id); foRita(); }
        const t = document.getElementById("foKomm_" + x.id); if (t) t.focus(); return;
    }
    if (gor === "fast") return foGor("fastInlagg", { id: x.id, pa: !x.fast });
    if (gor === "andra") { foFlodeRedigerar = x.id; return foRita(); }
    if (gor === "avbrytandra") { foFlodeRedigerar = ""; return foRita(); }
    if (gor === "sparaandra") { const t = document.getElementById("foInlRed"); if (foGor("redigeraInlagg", { id: x.id, text: t.value }, true)) { foFlodeRedigerar = ""; foRita(); } return; }
    if (gor === "tabort") { if (confirm("Ta bort inlägget? Det går inte att ångra.")) foGor("taBortInlagg", { id: x.id }); return; }
    if (gor === "atgard") { foAtgardDialog(null, kalla); setTimeout(() => { const t = document.getElementById("foAdText"); if (t && !t.value) t.value = x.text; }, 40); return; }
    if (gor === "beslut") return foBeslutDialog(null, null, kalla, x.text);
    if (gor === "fraga") {
        const kropp = '<div class="falt"><label for="foOmFText">Frågan</label><textarea class="f" id="foOmFText" rows="4">' + esc(x.text) + "</textarea></div>" +
            '<div class="tva"><div class="falt"><label for="foOmFAnsv">Vem ska svara?</label>' + foPartSelect("foOmFAnsv", x.disc[0] ? { disc: x.disc[0] } : x.personer[0] ? { person: x.personer[0] } : null, "Välj …") + "</div>" +
            '<div class="falt"><label for="foOmFSenast">Svar senast</label><input class="f" type="date" id="foOmFSenast"></div></div>' +
            '<p class="hjalp" style="margin:0">Inlägget ligger kvar i flödet och visar att det blev en fråga.' + (x.bilagor.length ? " Bilagorna följer med." : "") + "</p>";
        modal("Gör till fråga", "Inlägg av " + foPersonNamn(p, x.av) + " " + foNarText(x.tid), kropp, [
            { txt: "Avbryt", fn: stangModal },
            { txt: "Skapa fråga", primar: true, fn: () => {
                const fid = foId();
                const f = foGor("nyFraga", { id: fid, text: document.getElementById("foOmFText").value, ansvarig: foPartFran(document.getElementById("foOmFAnsv").value),
                    svarSenast: document.getElementById("foOmFSenast").value, bilagor: x.bilagor.map(b => Object.assign({}, b, { del: "fraga" })) }, true);
                if (!f) return;
                foGor("koppla", { fran: kalla, till: { typ: "fraga", id: fid } }, true);
                stangModal(); foRita(); status("Fråga " + f.nr + " skapad från inlägget.");
            } }
        ]);
        setTimeout(() => { const t = document.getElementById("foOmFText"); if (t) t.focus(); }, 30);
    }
}

// Visa ett inlägg i flödet (från sökningen, en koppling eller översikten).
function foVisaInlagg(id) {
    foFlodeFilter = { sok: "", vad: "alla", disc: "" };
    foGaTill("flode");
    setTimeout(() => foMarkeraRad(id), 40);
}

// stäng ⋯-menyerna vid klick utanför
document.addEventListener("click", (e) => {
    document.querySelectorAll(".fo-inlmeny[open]").forEach(d => { if (!d.contains(e.target)) d.removeAttribute("open"); });
});
