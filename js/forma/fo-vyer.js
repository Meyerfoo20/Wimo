/* ======================================================================
   Wimo Forma · vyer
   Översikt, frågeregistret (Aktiva, Klara, Alla), möten, åtgärder och
   beslutsloggen.
   ====================================================================== */

/* ======================= Översikt ======================= */
function foVyOversikt(yta) {
    const p = foP, jag = foJagId(), l = foLaget(p), ag = foAttGora(p, jag), idag = foIdag();
    const namn = jag ? (foPerson(p, jag).fornamn || foPersonNamn(p, jag)) : "";
    const kpi = (id, tal, rub, under, niva) => '<button type="button" class="kpi' + (niva ? " " + niva : "") + '" data-fokpi="' + id + '">' +
        '<span class="kpital">' + tal + '</span><span class="kpirub">' + rub + '</span>' + (under ? '<span class="kpiunder">' + under + '</span>' : "") + '</button>';
    const agRad = (f, varfor) => '<li data-fraga="' + f.id + '"><span class="fo-agnr">' + f.nr + '</span><span class="fo-agtext">' + esc(f.text) +
        '<small>' + varfor + '</small></span>' + foLageChip(f) + '</li>';
    const atgRad = (a) => '<li data-atg="' + a.id + '"><span class="fo-agnr">Å-' + a.nr + '</span><span class="fo-agtext">' + esc(a.text) +
        '<small>' + (a.senast ? (a.senast < idag ? '<b class="rodtal">Försenad</b> · klar senast ' + foDatumKort(a.senast) : "Klar senast " + foDatumKort(a.senast)) : "Utan datum") + '</small></span></li>';
    const grupper = [
        [ag.svara, "Frågor att svara på", f => (f.lage === "ofullstandig" ? "Svaret behöver kompletteras" : "Väntar på ditt svar") +
            (f.svarSenast ? " · svar senast " + foDatumKort(f.svarSenast) + (foForsenad(f, idag) ? ' · <b class="rodtal">försenad</b>' : "") : "")],
        [ag.kvittera, "Revisioner att kvittera", f => foOkvitterade(f).map(r => foRevNamn(r.nr) + " " + FO_REVTYP[r.typ].toLowerCase()).join(", ")],
        [ag.avsluta, "Besvarade frågor att avsluta", () => "Läs svaret och markera Klar, eller begär komplettering"]
    ];
    let att = grupper.filter(g => g[0].length).map(g => '<div class="fo-aggrupp"><h4>' + g[1] + ' <span class="antal">' + g[0].length + '</span></h4><ul class="atglista fo-aglista">' +
        g[0].slice(0, 8).map(f => agRad(f, g[2](f))).join("") + '</ul>' + (g[0].length > 8 ? '<p class="hjalp">och ' + (g[0].length - 8) + ' till</p>' : "") + '</div>').join("");
    if (ag.atgarder.length) att += '<div class="fo-aggrupp"><h4>Dina åtgärder <span class="antal">' + ag.atgarder.length + '</span></h4><ul class="atglista fo-aglista">' +
        ag.atgarder.slice(0, 8).map(atgRad).join("") + '</ul></div>';
    const forum = p.forum.filter(f => f.aktiv).map(f => ({ f: f, n: p.fragor.filter(x => foAktiv(x) && x.moten.includes(f.id)).length }))
        .sort((a, b) => (a.f.nastaMote || "9999").localeCompare(b.f.nastaMote || "9999"));
    const hand = p.logg.slice(foFlik.allaHand ? -40 : -6).reverse();
    const sett = (p.sett[jag] || {})["_logg"] || "";
    let html = foTopp("Översikt");
    html += '<div class="dashblock fo-attgora"><h3>' + (namn ? "Hej " + esc(namn) + ", det här väntar på dig" : "Att göra för dig") + '</h3>' +
        (att || '<p class="fo-klart">Inget väntar på dig just nu.' + (jag ? "" : " Du finns inte i projektets kontaktlista ännu — lägg till dig under Organisation.") + '</p>') + '</div>';
    html += '<div class="kpirad fo-kpirad">' +
        kpi("oppna", l.oppna, "Öppna frågor", l.klara + " klara") +
        kpi("vantar", l.vantar, "Väntar på svar", l.forsenade ? '<b class="rodtal">' + l.forsenade + " försenade</b>" : "inga försenade", l.forsenade ? "rod" : "") +
        kpi("kvittera", l.kvittera, "Att kvittera", "ändringar att ta del av", l.kvittera ? "orange" : "") +
        kpi("atg", l.atgOppna, "Öppna åtgärder", l.atgForsenade ? '<b class="rodtal">' + l.atgForsenade + " försenade</b>" : "inga försenade", l.atgForsenade ? "rod" : "") + '</div>';
    html += '<div class="fo-tvakol"><div class="dashblock"><h3>Kommande möten</h3>' + (forum.length ? '<ul class="atglista fo-motlista">' + forum.map(x =>
        '<li data-forum="' + x.f.id + '"><span class="fo-agnr">' + esc(x.f.kort) + '</span><span class="fo-agtext">' + esc(x.f.namn) +
        '<small>' + (x.f.nastaMote ? foDatumKort(x.f.nastaMote) + (x.f.tid ? " kl " + esc(x.f.tid) : "") : "Inget datum satt") + (x.f.plats ? " · " + esc(x.f.plats) : "") + '</small></span>' +
        '<span class="fo-antalchip">' + x.n + (x.n === 1 ? " fråga" : " frågor") + '</span></li>').join("") + '</ul>'
        : '<p class="hjalp" style="margin:0">Inga mötesforum ännu. Lägg upp projektets möten under <button type="button" class="p4d-lank" id="foTillForum">Organisation → Mötesforum</button>.</p>') + '</div>';
    html += '<div class="dashblock"><h3>Senaste händelser' + (hand.length ? '<button type="button" class="p4d-lank fo-hoger" id="foSett">Markera allt som sett</button>' : "") + '</h3>' +
        (hand.length ? '<ul class="fo-handelser">' + hand.map(h => '<li class="' + (h.tid > sett && h.av !== jag ? "ny" : "") + '"' + (h.obj ? ' data-obj="' + h.obj + '"' : "") + '>' +
            '<span class="fo-hnar">' + foNarText(h.tid) + '</span><span class="fo-htext">' + esc(h.text) + '<small>' + esc(foPersonNamn(p, h.av) || "") + '</small></span></li>').join("") + '</ul>' +
            (p.logg.length > 6 ? '<button type="button" class="p4d-lank fo-merlank" id="foFlerHand">' + (foFlik.allaHand ? "Visa färre" : "Visa fler") + '</button>' : "")
            : '<p class="hjalp" style="margin:0">Inget har hänt i projektet ännu.</p>') + '</div></div>';
    yta.innerHTML = html;
    yta.querySelectorAll("[data-fraga]").forEach(li => li.addEventListener("click", () => {
        const f = foFraga(p, li.dataset.fraga); foGaTill(f.lage === "klar" ? "klara" : "aktiva", f.id);
    }));
    yta.querySelectorAll("[data-atg]").forEach(li => li.addEventListener("click", () => { foFlik.atg = "mina"; foGaTill("atgarder"); setTimeout(() => foMarkeraRad(li.dataset.atg), 30); }));
    yta.querySelectorAll("[data-forum]").forEach(li => li.addEventListener("click", () => { foFlik.mote = li.dataset.forum; foGaTill("moten"); }));
    yta.querySelectorAll("[data-obj]").forEach(li => li.addEventListener("click", () => {
        const f = foFraga(p, li.dataset.obj);
        if (f) return foGaTill(f.lage === "klar" ? "klara" : "aktiva", f.id);
        if (foBeslut(p, li.dataset.obj)) { foGaTill("beslut"); setTimeout(() => foMarkeraRad(li.dataset.obj), 30); }
        else if (foAtgard(p, li.dataset.obj)) { foFlik.atg = "alla"; foGaTill("atgarder"); setTimeout(() => foMarkeraRad(li.dataset.obj), 30); }
    }));
    yta.querySelectorAll("[data-fokpi]").forEach(b => b.addEventListener("click", () => {
        const k = b.dataset.fokpi;
        if (["oppna", "vantar", "forsenade", "kvittera", "paverkar"].includes(k)) {
            foFilter.snabb = { oppna: "alla", vantar: "obesvarade", forsenade: "forsenade", kvittera: "kvittera", paverkar: "paverkar" }[k];
            foGaTill("aktiva");
        }
        if (k === "atg") { foFlik.atg = "oppna"; foGaTill("atgarder"); }
        if (k === "beslut") foGaTill("beslut");
        if (k === "moten") foGaTill("moten");
    }));
    const fh = document.getElementById("foFlerHand"); if (fh) fh.addEventListener("click", () => { foFlik.allaHand = !foFlik.allaHand; foRita(); });
    const tf = document.getElementById("foTillForum"); if (tf) tf.addEventListener("click", () => { foFlik.org = "forum"; foGaTill("org"); });
    const s = document.getElementById("foSett"); if (s) s.addEventListener("click", () => {
        foGor("sett", { ids: ["_logg"].concat(p.fragor.map(f => f.id), p.atgarder.map(a => a.id)) });
        status("Allt är markerat som sett.");
    });
}

/* ======================= Frågor ======================= */
const FO_UTKAST = "wimo_forma_utkast_";
function foVyFragor(yta) {
    const p = foP, jag = foJagId(), idag = foIdag(), vy = foVy;
    const kan = foKanSkriva(p, jag);
    const rub = vy === "aktiva" ? "Aktiva frågor" : vy === "klara" ? "Klara frågor" : "Alla frågor";
    // urval
    let lista = p.fragor.filter(f => vy === "alla" ? (foFilter.visaMak || !f.makulerad) : vy === "klara" ? (!f.makulerad && f.lage === "klar") : foAktiv(f));
    const snabb = {
        alla: () => true,
        mina: f => (f.lage === "obesvarad" || f.lage === "ofullstandig") && foArPart(p, jag, f.ansvarig),
        stallda: f => foArPart(p, jag, foStallare(f)) || f.av === jag,
        obesvarade: f => f.lage === "obesvarad" || f.lage === "ofullstandig",
        kvittera: f => foOkvitterade(f).length > 0,
        forsenade: f => foForsenad(f, idag),
        mote: f => f.moten.length > 0,
        paverkar: f => f.paverkar
    };
    const antal = {};
    Object.keys(snabb).forEach(k => { antal[k] = lista.filter(snabb[k]).length; });
    if (vy !== "aktiva" && !["alla", "stallda", "kvittera", "paverkar"].includes(foFilter.snabb)) foFilter.snabb = "alla";
    lista = lista.filter(snabb[foFilter.snabb] || snabb.alla);
    const q = foNormal(foFilter.sok).trim();
    if (q) {
        const nr = /^\d+$/.test(q) ? +q : null;
        lista = lista.filter(f => f.nr === nr || foNormal(f.text + " " + foSvarText(f) + " " + foPersonNamn(p, f.av)).includes(q));
    }
    if (foFilter.disc) lista = lista.filter(f => f.fran === foFilter.disc || (f.ansvarig && (f.ansvarig.disc === foFilter.disc || foPersonDisc(p, f.ansvarig.person).includes(foFilter.disc))) || f.berorda.includes(foFilter.disc));
    if (foFilter.plats) lista = lista.filter(f => f.indelning.includes(foFilter.plats));
    if (foFilter.lage && vy === "alla") lista = lista.filter(f => foFilter.lage === "mak" ? f.makulerad : !f.makulerad && f.lage === foFilter.lage);
    if (foFilter.mote) lista = lista.filter(f => f.moten.includes(foFilter.mote));
    const vikt = f => (foOkvitterade(f).length ? 0 : 1) * 10 + (foForsenad(f, idag) ? 0 : 1) * 5 + ({ ofullstandig: 0, obesvarad: 1, besvarad: 2, klar: 3 })[f.lage];
    const sorter = {
        std: (a, b) => vy === "aktiva" ? (vikt(a) - vikt(b) || b.nr - a.nr) : b.nr - a.nr,
        nr: (a, b) => a.nr - b.nr,
        nrfall: (a, b) => b.nr - a.nr,
        senast: (a, b) => (a.svarSenast || "9999").localeCompare(b.svarSenast || "9999") || a.nr - b.nr,
        andrad: (a, b) => (b.andrad || "").localeCompare(a.andrad || "")
    };
    lista.sort(sorter[foFilter.sort] || sorter.std);

    let html = foTopp(rub, '<button class="navknapp" type="button" id="foExport" title="Öppnas i Excel">Exportera</button>' +
        '<button class="navknapp" type="button" id="foSkrivUt">Skriv ut</button>');
    if (vy !== "klara" && kan) html += foNyFragaHtml();
    else if (vy !== "klara" && !kan) html += '<div class="notis">Du har läsbehörighet i projektet och kan inte registrera frågor.</div>';
    const chip = (k, txt) => '<button type="button" class="fo-snabb' + (foFilter.snabb === k ? " vald" : "") + '" data-snabb="' + k + '" aria-pressed="' + (foFilter.snabb === k) + '">' +
        txt + (k !== "alla" && antal[k] ? ' <span>' + antal[k] + '</span>' : "") + '</button>';
    const huvud = vy === "aktiva" ? ["alla", "mina", "kvittera", "forsenade"] : ["alla", "stallda", "kvittera"];
    const fler = (vy === "aktiva" ? ["stallda", "obesvarade", "mote", "paverkar"] : ["paverkar"]).filter(k => antal[k] || foFilter.snabb === k);
    const namnet = { alla: "Alla", mina: "Mina att svara på", stallda: "Ställda av mig", obesvarade: "Obesvarade", kvittera: "Att kvittera", forsenade: "Försenade", mote: "På mötesurval", paverkar: "Tid/kostnad" };
    const extraAktivt = foFilter.disc || foFilter.plats || foFilter.lage || foFilter.mote || foFilter.sort !== "std" || foFilter.visaMak || fler.includes(foFilter.snabb);
    const visaFler = foFilter.oppen || extraAktivt;
    html += '<div class="fo-verktygsrad"><label class="fo-sokfalt"><span class="p4-ik ik-sok" aria-hidden="true"></span><input class="f" id="foFSok" type="search" placeholder="Sök nummer eller text" value="' + esc(foFilter.sok) + '" data-behall></label>' +
        '<div class="fo-snabbrad">' + huvud.map(k => chip(k, namnet[k])).join("") + '</div>' +
        '<button type="button" class="fo-filterknapp' + (visaFler ? " oppen" : "") + '" id="foFlerFilter" aria-expanded="' + !!visaFler + '">Filter' + (extraAktivt ? ' <span class="fo-filterprick" aria-label="filter är valda"></span>' : "") + '</button></div>';
    html += '<div class="fo-filterrad' + (visaFler ? "" : " dold") + '" id="foFilterRad">' + (fler.length ? fler.map(k => chip(k, namnet[k])).join("") : "") +
        foDiscSelect("foFDisc", foFilter.disc, "Alla discipliner", ' aria-label="Disciplin"') +
        (p.indelningar.length ? foPlatsSelect("foFPlats", foFilter.plats, "Alla platser", ' aria-label="Plats"') : "") +
        (vy === "alla" ? '<select class="f" id="foFLage" aria-label="Läge"><option value="">Alla lägen</option>' + Object.keys(FO_LAGE).map(k =>
            '<option value="' + k + '"' + (foFilter.lage === k ? " selected" : "") + '>' + FO_LAGE[k].namn + '</option>').join("") +
            '<option value="mak"' + (foFilter.lage === "mak" ? " selected" : "") + '>Makulerade</option></select>' : "") +
        (p.forum.length ? foForumSelect("foFMote", foFilter.mote, "Alla möten", ' aria-label="Möte"') : "") +
        '<select class="f" id="foFSort" aria-label="Sortering">' + [["std", vy === "aktiva" ? "Det som brådskar först" : "Senaste först"], ["nrfall", "Nummer, fallande"], ["nr", "Nummer, stigande"],
            ["senast", "Svar senast"], ["andrad", "Senast ändrad"]].map(([v, t]) => '<option value="' + v + '"' + (foFilter.sort === v ? " selected" : "") + '>' + t + '</option>').join("") + '</select>' +
        (vy === "alla" ? '<label class="fo-kryss"><input type="checkbox" id="foFMak"' + (foFilter.visaMak ? " checked" : "") + '> Visa makulerade</label>' : "") +
        (extraAktivt ? '<button type="button" class="p4d-lank" id="foRensaFilter">Rensa filter</button>' : "") + '</div>';
    const filtrerat = foFilter.sok || foFilter.disc || foFilter.plats || foFilter.lage || foFilter.mote || foFilter.snabb !== "alla";
    if (!lista.length) {
        html += p.fragor.length || filtrerat
            ? foTomt("Inga frågor matchar", "Byt filter eller sökning.", filtrerat ? '<button type="button" class="mknapp" id="foRensa">Visa alla</button>' : "")
            : foTomt(vy === "klara" ? "Inga klara frågor ännu" : "Inga frågor ännu", vy === "klara" ? "När en besvarad fråga markeras Klar hamnar den här." :
                "Skriv den första frågan i rutan ovanför. Bara frågetexten behövs — datum, du som frågeställare och läget sätts automatiskt.");
    } else if (vy === "klara") {
        const grupper = {};
        lista.forEach(f => { const k = f.fran || "_"; (grupper[k] = grupper[k] || []).push(f); });
        Object.keys(grupper).sort((a, b) => ((foDisc(p, a) || { ordning: 99 }).ordning - (foDisc(p, b) || { ordning: 99 }).ordning)).forEach(k => {
            const d = foDisc(p, k);
            html += '<h3 class="fo-blockrub">' + (d ? esc(d.kod + " – " + d.namn) : "Utan frågeställande disciplin") + ' <span class="antal">' + grupper[k].length + '</span></h3>' +
                foFragaTabell(grupper[k]);
        });
    } else html += foFragaTabell(lista);
    if (lista.length > 6 || filtrerat) html += '<p class="dashfot fo-antal">' + lista.length + (lista.length === 1 ? " fråga" : " frågor") + (filtrerat ? " av " + p.fragor.filter(f => !f.makulerad).length : "") + '</p>';
    yta.innerHTML = html;

    // händelser
    yta.querySelectorAll("[data-snabb]").forEach(b => b.addEventListener("click", () => { foFilter.snabb = foFilter.snabb === b.dataset.snabb ? "alla" : b.dataset.snabb; foRita(); }));
    document.getElementById("foFlerFilter").addEventListener("click", () => { foFilter.oppen = !visaFler; foRita(); });
    const rf = document.getElementById("foRensaFilter"); if (rf) rf.addEventListener("click", () => { foFilter = { snabb: "alla", sok: foFilter.sok, disc: "", plats: "", lage: "", mote: "", sort: "std", visaMak: false, oppen: false }; foRita(); });
    const sok = document.getElementById("foFSok");
    let sokT = null;
    sok.addEventListener("input", () => { clearTimeout(sokT); sokT = setTimeout(() => { foFilter.sok = sok.value; foRitaBehall(); }, 160); });
    [["foFDisc", "disc"], ["foFPlats", "plats"], ["foFLage", "lage"], ["foFMote", "mote"], ["foFSort", "sort"]].forEach(([id, k]) => {
        const el = document.getElementById(id); if (el) el.addEventListener("change", () => { foFilter[k] = el.value; foRita(); });
    });
    const mak = document.getElementById("foFMak"); if (mak) mak.addEventListener("change", () => { foFilter.visaMak = mak.checked; foRita(); });
    const r = document.getElementById("foRensa"); if (r) r.addEventListener("click", () => { foFilter = { snabb: "alla", sok: "", disc: "", plats: "", lage: "", mote: "", sort: "std", visaMak: false }; foRita(); });
    document.getElementById("foExport").addEventListener("click", () => {
        foLaddaNer(foFilnamn(p.namn) + "-fragor-" + idag + ".csv", foCsvFragor(p, lista), "text/csv;charset=utf-8");
        status("Frågelistan exporterades (" + lista.length + " frågor). Öppna filen i Excel.");
    });
    document.getElementById("foSkrivUt").addEventListener("click", () => foSkrivUtFragor(lista, rub));
    foKopplaFragaTabell(yta);
    if (vy !== "klara" && kan) foKopplaNyFraga();
}

// Ritar om men behåller fokus och markör i sökfältet.
function foRitaBehall() {
    const a = document.activeElement, id = a && a.id, s = a && a.selectionStart, e = a && a.selectionEnd;
    foRita();
    const b = id && document.getElementById(id);
    if (b) { b.focus(); try { b.setSelectionRange(s, e); } catch (x) { } }
}

function foFragaTabell(lista) {
    const p = foP, jag = foJagId(), idag = foIdag();
    const forum = p.forum.filter(x => x.aktiv);
    return '<div class="fo-tabellram"><table class="lista fo-tabell fo-fragetabell"><thead><tr><th class="fo-nrkol">Nr</th><th>Fråga</th><th>Läge</th><th class="fo-snabbkol"><span class="sr">Snabbval</span></th></tr></thead><tbody>' +
        lista.map(f => {
            const ok = foOkvitterade(f), sen = foForsenad(f, idag), nytt = foNytt(p, jag, f);
            const kanKlar = f.lage === "besvarad" && !ok.length && (foArPart(p, jag, foStallare(f)) || foKanLeda(p, jag));
            const vem = (foDiscText(p, f.fran) || "–") + " → " + (foPartText(p, f.ansvarig) || "ingen ansvarig");
            const under = f.svar ? '<span class="fo-svarrad">' + esc(f.svar.text.split("\n")[0].slice(0, 140)) + '</span>'
                : '<span>' + esc(vem) + (f.svarSenast && foAktiv(f) ? " · svar senast " + foDatumKort(f.svarSenast) : "") + '</span>';
            const motenTxt = f.moten.map(id => esc((foForum(p, id) || { kort: "?" }).kort)).join(" · ");
            return '<tr data-fraga="' + f.id + '" data-rad="' + f.id + '" class="' + (f.id === foFragaOppen ? "vald " : "") + (ok.length ? "okvitt " : "") + (nytt ? "olast " : "") + (f.makulerad ? "mak" : "") + '" tabindex="0">' +
                '<td class="fo-nrkol"><b>' + f.nr + '</b>' + (nytt ? '<span class="fo-tagg t-ny" title="Ändrad sedan du tittade senast">Ny</span>' : "") + '</td>' +
                '<td class="fo-fragekol"><span class="fo-fragetext">' + esc(f.text) + '</span><small>' + under +
                (f.bilagor.length ? ' <span class="fo-gemtal" title="' + f.bilagor.length + (f.bilagor.length === 1 ? " bilaga" : " bilagor") + '"><i class="fo-gem" aria-hidden="true"></i>' + f.bilagor.length + '</span>' : "") + '</small></td>' +
                '<td class="fo-lagekol"><div class="fo-taggrad">' + (ok.length ? '<span class="fo-lage revision">Att kvittera</span>' : foLageChip(f)) +
                (sen ? '<span class="fo-tagg t-sen">Försenad</span>' : "") +
                (f.paverkar ? '<span class="fo-tagg t-varn" title="' + esc(FO_PAVERKAR_TEXT) + '">Tid/kostnad</span>' : "") +
                (f.moten.length ? '<span class="fo-tagg t-mote" title="Tas upp på möte">Möte ' + motenTxt + '</span>' : "") + '</div></td>' +
                '<td class="fo-snabbkol">' + (kanKlar ? '<button type="button" class="fo-minknapp klar" data-klar="' + f.id + '" title="Markera frågan som klar">Klar</button>' : "") +
                (foKanSkriva(p, jag) && forum.length && foAktiv(f) ? '<button type="button" class="fo-minknapp fo-hover' + (f.moten.length ? " pa" : "") + '" data-motesval="' + f.id + '" title="Markera för möte">' +
                    (f.moten.length ? "På möte" : "+ Möte") + '</button>' : "") + '</td></tr>';
        }).join("") + '</tbody></table></div>';
}
function foKopplaFragaTabell(rot) {
    rot.querySelectorAll("tr[data-fraga]").forEach(tr => {
        const oppna = () => { foFragaOppen = tr.dataset.fraga; foSattAdress(); foRita(); };
        tr.addEventListener("click", (e) => { if (!e.target.closest("button")) oppna(); });
        tr.addEventListener("keydown", (e) => { if (e.key === "Enter") oppna(); });
    });
    rot.querySelectorAll("[data-klar]").forEach(b => b.addEventListener("click", (e) => {
        e.stopPropagation();
        const f = foFraga(foP, b.dataset.klar);
        if (foGor("sattLage", { id: f.id, lage: "klar" })) status("Fråga " + f.nr + " är klar och flyttad till Klara frågor.");
    }));
    rot.querySelectorAll("[data-motesval]").forEach(b => b.addEventListener("click", (e) => {
        e.stopPropagation();
        const f = foFraga(foP, b.dataset.motesval), forum = foP.forum.filter(x => x.aktiv);
        // Ett forum: markera med ett klick (FRG-007). Flera: välj i en liten meny.
        if (forum.length === 1) return foGor("motesmarkering", { id: f.id, forum: forum[0].id });
        foMotesMeny(b, f);
    }));
}
function foMotesMeny(ankare, f) {
    const gammal = document.getElementById("foMotesMeny"); if (gammal) gammal.remove();
    const m = document.createElement("div");
    m.id = "foMotesMeny"; m.className = "fo-popmeny"; m.setAttribute("role", "menu");
    m.innerHTML = '<div class="fo-popruta">Markera fråga ' + f.nr + ' för</div>' + foP.forum.filter(x => x.aktiv).map(x =>
        '<button type="button" role="menuitemcheckbox" aria-checked="' + f.moten.includes(x.id) + '" data-forum="' + x.id + '" class="' + (f.moten.includes(x.id) ? "pa" : "") + '">' +
        '<span class="fo-bock" aria-hidden="true"></span>' + esc(x.namn) + '</button>').join("");
    document.body.appendChild(m);
    const r = ankare.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + "px";
    m.style.top = (r.bottom + 6 + m.offsetHeight > innerHeight ? r.top - m.offsetHeight - 6 : r.bottom + 6) + "px";
    const stang = (e) => {
        if (e && e.type === "pointerdown" && m.contains(e.target)) return;
        if (e && e.type === "keydown" && e.key !== "Escape") return;
        m.remove(); document.removeEventListener("pointerdown", stang, true); document.removeEventListener("keydown", stang, true);
    };
    m.querySelectorAll("[data-forum]").forEach(b => b.addEventListener("click", () => { stang(); foGor("motesmarkering", { id: f.id, forum: b.dataset.forum }); }));
    setTimeout(() => { document.addEventListener("pointerdown", stang, true); document.addEventListener("keydown", stang, true); }, 0);
    m.querySelector("button").focus();
}

/* ---------- snabbregistrering av ny fråga ---------- */
let foNyBilagor = [];
function foNyFragaHtml() {
    const p = foP, jag = foJag();
    const u = foLasLs(FO_UTKAST + foPid, {});
    const fran = u.fran !== undefined ? u.fran : (jag && jag.disc && jag.disc[0]) || "";
    const fler = u.fler || !!(u.plats || u.mote);
    return '<div class="fo-nyfraga' + (u.text ? " oppen" : "") + '" id="foNyRuta">' +
        '<div class="fo-nytopp"><textarea class="f" id="foNyText" rows="1" placeholder="Ställ en ny fråga …" data-behall>' + esc(u.text || "") + '</textarea>' +
        '<button type="button" class="p4-btn p4-btn-primar" id="foNyLagg">Lägg till</button></div>' +
        '<div class="fo-nydetalj">' +
        '<div class="fo-nyrad">' +
        '<label class="fo-litefalt fo-bred"><span>Vem ska svara?</span>' + foPartSelect("foNyAnsv", u.ansv ? foPartFran(u.ansv) : null, "Välj …") + '</label>' +
        '<label class="fo-litefalt"><span>Svar senast</span><input class="f" type="date" id="foNySenast" value="' + esc(u.senast || "") + '"></label>' +
        foFilZon("foNyFil", "Bifoga") +
        '<button type="button" class="p4d-lank fo-flerval" id="foNyFler" aria-expanded="' + fler + '">' + (fler ? "Färre val" : "Fler val") + '</button></div>' +
        '<div class="fo-nyrad fo-nyfler' + (fler ? "" : " dold") + '" id="foNyFlerRad">' +
        '<label class="fo-litefalt"><span>Från disciplin</span>' + foDiscSelect("foNyFran", fran, "–") + '</label>' +
        (p.indelningar.length ? '<label class="fo-litefalt"><span>Plats</span>' + foPlatsSelect("foNyPlats", u.plats || "", "–") + '</label>' : "") +
        (p.forum.length ? '<label class="fo-litefalt"><span>Ta upp på möte</span>' + foForumSelect("foNyMote", u.mote || "", "Inget") + '</label>' : "") + '</div>' +
        '<div id="foNyBilagor"></div><p class="fo-nytips">Ctrl+Enter sparar · klistra in skärmklipp med Ctrl+V</p></div></div>';
}
function foKopplaNyFraga() {
    const t = document.getElementById("foNyText");
    if (!t) return;
    const ruta = document.getElementById("foNyRuta");
    t.addEventListener("focus", () => ruta.classList.add("oppen"));
    document.getElementById("foNyFler").addEventListener("click", (e) => {
        const rad = document.getElementById("foNyFlerRad"), pa = rad.classList.toggle("dold") === false;
        e.target.textContent = pa ? "Färre val" : "Fler val"; e.target.setAttribute("aria-expanded", pa);
        const u = foLasLs(FO_UTKAST + foPid, {}); u.fler = pa; foSkrivLs(FO_UTKAST + foPid, u);
    });
    const spara = () => foSkrivLs(FO_UTKAST + foPid, { fler: !document.getElementById("foNyFlerRad").classList.contains("dold"), text: t.value, fran: document.getElementById("foNyFran").value, ansv: document.getElementById("foNyAnsv").value,
        plats: (document.getElementById("foNyPlats") || {}).value || "", senast: document.getElementById("foNySenast").value, mote: (document.getElementById("foNyMote") || {}).value || "" });
    const ritaBil = () => {
        const b = document.getElementById("foNyBilagor");
        b.innerHTML = foNyBilagor.length ? foBilagorHtml(foNyBilagor) + '<button type="button" class="p4d-lank" id="foNyBilBort">Ta bort bilagorna</button>' : "";
        foKopplaBilagor(b, foNyBilagor);
        const x = document.getElementById("foNyBilBort"); if (x) x.addEventListener("click", () => { foNyBilagor = []; ritaBil(); });
    };
    ritaBil();
    t.addEventListener("input", () => { spara(); t.style.height = "auto"; t.style.height = Math.min(260, t.scrollHeight + 2) + "px"; });
    ["foNyFran", "foNyAnsv", "foNyPlats", "foNySenast", "foNyMote"].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener("change", spara); });
    foFilMottagare(document.getElementById("foNyFil"), t, (meta) => { foNyBilagor = foNyBilagor.concat(meta); ritaBil(); });
    const lagg = () => {
        const text = t.value.trim();
        if (!text) { t.focus(); return status("Skriv frågan först.", true); }
        const plats = (document.getElementById("foNyPlats") || {}).value, mote = (document.getElementById("foNyMote") || {}).value;
        const f = foGor("nyFraga", { id: foId(), text: text, fran: document.getElementById("foNyFran").value, ansvarig: foPartFran(document.getElementById("foNyAnsv").value),
            indelning: plats ? [plats] : [], svarSenast: document.getElementById("foNySenast").value, moten: mote ? [mote] : [], bilagor: foNyBilagor.map(b => Object.assign({ del: "fraga" }, b)) }, true);
        if (!f) return;
        foNyBilagor = [];
        foSkrivLs(FO_UTKAST + foPid, { fran: document.getElementById("foNyFran").value, fler: !document.getElementById("foNyFlerRad").classList.contains("dold") });
        foRita();
        status("Fråga " + f.nr + " registrerad" + (f.ansvarig ? " och skickad till " + foPartText(foP, f.ansvarig) : "") + ".");
        const ny = document.getElementById("foNyText"); if (ny) ny.focus();
        setTimeout(() => foMarkeraRad(f.id), 30);
    };
    document.getElementById("foNyLagg").addEventListener("click", lagg);
    t.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); lagg(); } });
    if (t.value) { t.style.height = Math.min(260, t.scrollHeight + 2) + "px"; }
}

/* ---------- utskrift av frågeförteckning ---------- */
function foSkrivUtFragor(lista, rub) {
    const p = foP;
    const w = window.open("", "_blank");
    if (!w) return status("Webbläsaren stoppade utskriftsfönstret. Tillåt popup-fönster för Wimo.", true);
    const rader = lista.map(f => '<tr><td>' + f.nr + '</td><td>' + esc(f.text).replace(/\n/g, "<br>") + '<div class="m">' + esc(foDiscText(p, f.fran) || "–") + ' → ' + esc(foPartText(p, f.ansvarig) || "–") +
        (f.svarSenast ? " · svar senast " + f.svarSenast : "") + '</div></td><td>' + (f.svar ? esc(f.svar.text).replace(/\n/g, "<br>") : "–") + '</td><td>' + (f.makulerad ? "Makulerad" : FO_LAGE[f.lage].namn) + '</td></tr>').join("");
    w.document.write('<!DOCTYPE html><html lang="sv"><head><meta charset="utf-8"><title>' + esc(p.namn + " – " + rub) + '</title><style>' +
        'body{font:12px/1.4 Inter,system-ui,sans-serif;margin:24px;color:#181c19}h1{font-size:18px;margin:0 0 2px}p{margin:0 0 14px;color:#56615a}' +
        'table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#56615a}' +
        'td:first-child{font-weight:700;width:34px}.m{color:#56615a;font-size:11px;margin-top:3px}td:last-child{white-space:nowrap}</style></head><body>' +
        '<h1>' + esc(p.namn) + (p.nummer ? " · " + esc(p.nummer) : "") + '</h1><p>' + esc(rub) + " · " + lista.length + " frågor · utskrivet " + foIdag() + " " + foKlocka(foNu()) + '</p>' +
        '<table><thead><tr><th>Nr</th><th>Fråga</th><th>Svar</th><th>Läge</th></tr></thead><tbody>' + rader + '</tbody></table></body></html>');
    w.document.close();
    setTimeout(() => w.print(), 300);
}

/* ======================= Möten ======================= */
function foVyMoten(yta) {
    const p = foP, jag = foJagId(), forum = p.forum.filter(f => f.aktiv);
    if (!forum.length) {
        yta.innerHTML = foTopp("Möten") + foTomt("Inga mötesforum ännu",
            "Ett mötesforum är en återkommande mötestyp, till exempel Projekteringsmöte eller Samordningsmöte installation. När forumen finns kan frågor markeras för nästa möte med ett klick.",
            foKanLeda(p, jag) ? '<button type="button" class="p4-btn p4-btn-primar" id="foNyttForum">Lägg upp mötesforum</button>' : "");
        const b = document.getElementById("foNyttForum"); if (b) b.addEventListener("click", () => foForumDialog(null));
        return;
    }
    if (!forum.some(f => f.id === foFlik.mote)) foFlik.mote = forum[0].id;
    const fo = foForum(p, foFlik.mote);
    const aktiva = p.fragor.filter(foAktiv);
    const ordning = f => (foOkvitterade(f).length ? 0 : f.moten.includes(fo.id) ? 1 : f.lage === "ofullstandig" ? 2 : 3);
    const urval = aktiva.filter(f => f.moten.includes(fo.id)).sort((a, b) => ordning(a) - ordning(b) || a.nr - b.nr);
    const deltDisc = new Set();
    (fo.deltagare || []).forEach(pid => foPersonDisc(p, pid).forEach(d => deltDisc.add(d)));
    const forslag = aktiva.filter(f => !f.moten.includes(fo.id) && (foOkvitterade(f).length || f.lage === "ofullstandig" || foForsenad(f)) &&
        (!deltDisc.size || deltDisc.has(f.fran) || (f.ansvarig && (deltDisc.has(f.ansvarig.disc) || foPersonDisc(p, f.ansvarig.person).some(d => deltDisc.has(d))))));
    const behandlade = p.fragor.filter(f => f.behandlad[fo.id]).sort((a, b) => b.behandlad[fo.id].localeCompare(a.behandlad[fo.id])).slice(0, 12);
    const kanLeda = foKanLeda(p, jag), kan = foKanSkriva(p, jag);
    let html = foTopp("Möten", '<button class="navknapp" type="button" id="foStorskarm" title="Visa urvalet stort, för skärmen i mötesrummet">Storskärm</button>' +
        (kanLeda ? '<button class="navknapp" type="button" id="foForumAndra">Ändra forum</button>' : ""));
    html += '<div class="fo-flikar" role="tablist">' + forum.map(f => '<button type="button" role="tab" class="fo-flik' + (f.id === fo.id ? " vald" : "") + '" aria-selected="' + (f.id === fo.id) + '" data-forumflik="' + f.id + '">' +
        esc(f.namn) + ' <span>' + aktiva.filter(x => x.moten.includes(f.id)).length + '</span></button>').join("") + '</div>';
    html += '<div class="dashblock fo-motesinfo"><div class="fo-motesrad"><div><span class="fo-etikett">Nästa möte</span>' +
        (kanLeda ? '<input class="f" type="date" id="foNastaMote" value="' + esc(fo.nastaMote || "") + '">' : '<b>' + (fo.nastaMote ? foDatumKort(fo.nastaMote) : "Inget datum") + '</b>') + '</div>' +
        '<div><span class="fo-etikett">Tid och plats</span><b>' + esc([fo.tid ? "kl " + fo.tid : "", fo.plats].filter(Boolean).join(" · ") || "–") + '</b></div>' +
        '<div><span class="fo-etikett">Mötesledare</span><b>' + esc(foPersonNamn(p, fo.ledare) || "–") + '</b></div>' +
        '<div><span class="fo-etikett">Deltagare</span><b>' + (fo.deltagare || []).length + '</b></div></div></div>';
    html += '<h3 class="fo-blockrub">Frågor till nästa möte <span class="antal">' + urval.length + '</span></h3>';
    html += urval.length ? foMotesTabell(urval, fo, kan, true) : foTomt("Inga frågor markerade för " + fo.namn,
        "Markera en fråga med <b>+ Möte</b> i frågelistan, eller lägg till ett förslag nedan. Ordningen är reviderade först, sedan markerade, ofullständiga och obesvarade.");
    if (forslag.length) html += '<h3 class="fo-blockrub">Förslag till urvalet <span class="antal">' + forslag.length + '</span></h3><p class="hjalp fo-ingress">Frågor med okvitterad revision, ofullständigt svar eller försenat svar där mötets deltagare är berörda.</p>' +
        foMotesTabell(forslag, fo, kan, false);
    if (behandlade.length) html += '<h3 class="fo-blockrub">Senast behandlade</h3><ul class="atglista fo-aglista">' + behandlade.map(f =>
        '<li data-fraga="' + f.id + '"><span class="fo-agnr">' + f.nr + '</span><span class="fo-agtext">' + esc(f.text) + '<small>Behandlad ' + foDatumKort(f.behandlad[fo.id]) + '</small></span>' + foLageChip(f) + '</li>').join("") + '</ul>';
    yta.innerHTML = html;
    yta.querySelectorAll("[data-forumflik]").forEach(b => b.addEventListener("click", () => { foFlik.mote = b.dataset.forumflik; foRita(); }));
    const nm = document.getElementById("foNastaMote");
    if (nm) nm.addEventListener("change", () => { foGor("sparaForum", Object.assign({}, fo, { nastaMote: nm.value }), true); foVisaSparat(nm); foRitaNav(); });
    const fa = document.getElementById("foForumAndra"); if (fa) fa.addEventListener("click", () => foForumDialog(fo));
    document.getElementById("foStorskarm").addEventListener("click", () => foStorskarm(fo));
    yta.querySelectorAll("li[data-fraga], tr[data-fraga]").forEach(el => el.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        foFragaOppen = el.dataset.fraga; foSattAdress(); foRita();
    }));
    yta.querySelectorAll("[data-behandlad]").forEach(b => b.addEventListener("click", () => {
        const f = foFraga(p, b.dataset.behandlad);
        if (foGor("behandlad", { id: f.id, forum: fo.id, datum: fo.nastaMote && fo.nastaMote <= foIdag() ? fo.nastaMote : foIdag() }))
            status("Fråga " + f.nr + " markerad som behandlad på " + fo.namn + ".");
    }));
    yta.querySelectorAll("[data-tillurval]").forEach(b => b.addEventListener("click", () => foGor("motesmarkering", { id: b.dataset.tillurval, forum: fo.id, pa: true })));
    yta.querySelectorAll("[data-ururval]").forEach(b => b.addEventListener("click", () => foGor("motesmarkering", { id: b.dataset.ururval, forum: fo.id, pa: false })));
}
function foMotesTabell(lista, fo, kan, iUrval) {
    const p = foP;
    return '<div class="fo-tabellram"><table class="lista fo-tabell fo-motestabell"><thead><tr><th class="fo-nrkol">Nr</th><th>Fråga</th><th>Från → Ansvarig</th><th>Läge</th><th class="fo-snabbkol"><span class="sr">Åtgärd</span></th></tr></thead><tbody>' +
        lista.map(f => {
            const ok = foOkvitterade(f);
            return '<tr data-fraga="' + f.id + '" data-rad="' + f.id + '" class="' + (ok.length ? "okvitt" : "") + '"><td class="fo-nrkol"><b>' + f.nr + '</b>' +
                (ok.length ? '<span class="fo-revmark">' + foRevNamn(ok[ok.length - 1].nr) + '</span>' : "") + '</td>' +
                '<td class="fo-fragekol"><span class="fo-fragetext">' + esc(f.text) + '</span>' + (f.svar ? '<small>Svar: ' + esc(f.svar.text.slice(0, 160)) + (f.svar.text.length > 160 ? "…" : "") + '</small>' : "") + '</td>' +
                '<td class="fo-partkol"><b>' + esc(foDiscText(p, f.fran) || "–") + '</b> <span class="fo-pil" aria-hidden="true">→</span> <b>' + esc(foPartText(p, f.ansvarig) || "–") + '</b></td>' +
                '<td class="fo-lagekol"><div class="fo-taggrad">' + foLageChip(f) + (foForsenad(f) ? '<span class="fo-tagg t-sen">Försenad</span>' : "") + '</div></td>' +
                '<td class="fo-snabbkol">' + (kan ? (iUrval ? '<button type="button" class="fo-minknapp klar" data-behandlad="' + f.id + '">Behandlad</button>' +
                    '<button type="button" class="fo-minknapp" data-ururval="' + f.id + '" title="Ta bort ur urvalet">Ta bort</button>'
                    : '<button type="button" class="fo-minknapp" data-tillurval="' + f.id + '">+ Till urvalet</button>') : "") + '</td></tr>';
        }).join("") + '</tbody></table></div>';
}
// Storskärmsläge för mötesrummet: stor text, inga rullister i sidled (FRG-022, MOT-012).
function foStorskarm(fo) {
    const p = foP;
    const ordning = f => (foOkvitterade(f).length ? 0 : 1) * 10 + ({ ofullstandig: 1, obesvarad: 2, besvarad: 3, klar: 4 })[f.lage];
    const lista = p.fragor.filter(f => foAktiv(f) && f.moten.includes(fo.id)).sort((a, b) => ordning(a) - ordning(b) || a.nr - b.nr);
    let i = 0;
    const v = document.createElement("div");
    v.className = "fo-storskarm";
    v.setAttribute("role", "dialog");
    v.setAttribute("aria-label", "Storskärm · " + fo.namn);
    const rita = () => {
        const f = lista[i];
        v.innerHTML = '<div class="fo-ss-topp"><img src="img/wimo-vit.png?v=1" alt="Wimo"><span>' + esc(fo.namn) + (fo.nastaMote ? " · " + foDatumKort(fo.nastaMote) : "") + '</span>' +
            '<span class="fo-ss-pos">' + (lista.length ? (i + 1) + " av " + lista.length : "Inga frågor") + '</span><button type="button" data-stang>Stäng (Esc)</button></div>' +
            (f ? '<div class="fo-ss-kropp"><div class="fo-ss-nr">Fråga ' + f.nr + ' ' + foLageChip(f) + (foOkvitterade(f).length ? '<span class="fo-revmark">Reviderad</span>' : "") + '</div>' +
                '<div class="fo-ss-fraga">' + esc(f.text) + '</div><div class="fo-ss-meta">' + esc(foDiscText(p, f.fran) || "–") + ' → ' + esc(foPartText(p, f.ansvarig) || "–") + '</div>' +
                '<div class="fo-ss-svar"><span>Svar</span>' + (f.svar ? esc(f.svar.text) : '<i>Inget svar ännu</i>') + '</div></div>' +
                '<div class="fo-ss-lista">' + lista.map((x, j) => '<button type="button" data-j="' + j + '" class="' + (j === i ? "vald" : "") + '"><b>' + x.nr + '</b>' + esc(x.text) + '</button>').join("") + '</div>'
                : '<div class="fo-ss-kropp"><div class="fo-ss-fraga">Inga frågor är markerade för ' + esc(fo.namn) + '.</div></div>') +
            '<div class="fo-ss-fot">← → bläddra · Esc stäng</div>';
        v.querySelector("[data-stang]").addEventListener("click", stang);
        v.querySelectorAll("[data-j]").forEach(b => b.addEventListener("click", () => { i = +b.dataset.j; rita(); }));
    };
    const tangent = (e) => {
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); stang(); }
        if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") { e.preventDefault(); i = Math.min(lista.length - 1, i + 1); rita(); }
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); i = Math.max(0, i - 1); rita(); }
    };
    const stang = () => { v.remove(); document.removeEventListener("keydown", tangent, true); if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); };
    document.body.appendChild(v);
    rita();
    document.addEventListener("keydown", tangent, true);
    if (v.requestFullscreen) v.requestFullscreen().catch(() => { });
}

/* ======================= Åtgärder ======================= */
function foVyAtgarder(yta) {
    const p = foP, jag = foJagId(), idag = foIdag(), kan = foKanSkriva(p, jag);
    const urval = {
        mina: a => a.status === "oppen" && foArPart(p, jag, a.ansvarig),
        oppna: a => a.status === "oppen",
        forsenade: a => a.status === "oppen" && a.senast && a.senast < idag,
        klara: a => a.status === "klar",
        avbrutna: a => a.status === "makulerad",
        alla: a => a.status !== "makulerad"
    };
    const namn = { mina: "Mina öppna", oppna: "Alla öppna", forsenade: "Försenade", klara: "Klara", avbrutna: "Avbrutna", alla: "Alla" };
    if (!urval[foFlik.atg]) foFlik.atg = "mina";
    if (foFlik.atg === "mina" && !p.atgarder.some(urval.mina) && p.atgarder.some(urval.oppna)) foFlik.atg = "oppna";
    const lista = p.atgarder.filter(urval[foFlik.atg]).sort((a, b) => (a.status === "oppen" ? 0 : 1) - (b.status === "oppen" ? 0 : 1) || (a.senast || "9999").localeCompare(b.senast || "9999") || a.nr - b.nr);
    let html = foTopp("Åtgärder", '<button class="navknapp" type="button" id="foAtgExport">Exportera</button>');
    if (kan) html += '<div class="fo-nyfraga fo-nyatg"><input class="f" id="foAtgText" placeholder="Ny åtgärd … till exempel Revidera planritning plan 2" data-behall>' +
        '<div class="fo-nyrad"><label class="fo-litefalt fo-bred"><span>Ansvarig</span>' + foPartSelect("foAtgAnsv", null, "Välj ansvarig …") + '</label>' +
        '<label class="fo-litefalt"><span>Klar senast</span><input class="f" type="date" id="foAtgSenast"></label>' +
        '<button type="button" class="p4-btn p4-btn-primar" id="foAtgLagg">Lägg till åtgärd</button></div></div>';
    html += '<div class="fo-snabbrad">' + Object.keys(urval).map(k => '<button type="button" class="fo-snabb' + (foFlik.atg === k ? " vald" : "") + '" data-atgflik="' + k + '" aria-pressed="' + (foFlik.atg === k) + '">' +
        namn[k] + ' <span>' + p.atgarder.filter(urval[k]).length + '</span></button>').join("") + '</div>';
    html += lista.length ? '<div class="fo-tabellram"><table class="lista fo-tabell fo-atgtabell"><thead><tr><th class="fo-nrkol">Nr</th><th>Åtgärd</th><th>Ansvarig</th><th>Klar senast</th><th>Status</th><th class="fo-snabbkol"><span class="sr">Mer</span></th></tr></thead><tbody>' +
        lista.map(a => {
            const sen = a.status === "oppen" && a.senast && a.senast < idag;
            const kalla = (a.kopplingar || []).filter(k => k.typ !== "atgard").map(k => '<button type="button" class="p4d-lank" data-kalla="' + k.typ + ':' + k.id + '">' + esc(foObjNamn(p, k)) + '</button>').join(", ");
            return '<tr data-rad="' + a.id + '" class="' + (a.status !== "oppen" ? "utford" : "") + (sen ? " fo-sen" : "") + '"><td class="fo-nrkol"><b>Å-' + a.nr + '</b></td>' +
                '<td><span class="fo-fragetext">' + esc(a.text) + '</span>' + (kalla ? '<small>Från ' + kalla + '</small>' : "") + (a.makulerad ? '<small>Avbruten: ' + esc(a.makulerad.orsak) + '</small>' : "") + '</td>' +
                '<td>' + esc(foPartText(p, a.ansvarig) || "–") + '</td><td class="dat">' + (a.senast ? foDatumKort(a.senast) : "–") + (sen ? ' <span class="fo-tagg t-sen">Försenad</span>' : "") + '</td>' +
                '<td>' + (a.status === "makulerad" ? '<span class="fo-lage mak"><i></i>Avbruten</span>' : '<button type="button" class="fstat ' + (a.status === "klar" ? "klar" : "ej") + '" data-atgstat="' + a.id + '"' +
                    (kan ? "" : " disabled") + ' title="' + (a.status === "klar" ? "Öppna igen" : "Markera som klar") + '">' + (a.status === "klar" ? "✓ Klar" : "Öppen") + '</button>') + '</td>' +
                '<td class="fo-snabbkol">' + (kan ? '<button type="button" class="fo-minknapp" data-atgandra="' + a.id + '">Ändra</button>' : "") + '</td></tr>';
        }).join("") + '</tbody></table></div>'
        : foTomt(p.atgarder.length ? "Inga åtgärder här" : "Inga åtgärder ännu", p.atgarder.length ? "Välj ett annat urval ovanför." : "Skapa en åtgärd ovanför, eller från en fråga med <b>Ny åtgärd</b>.");
    yta.innerHTML = html;
    yta.querySelectorAll("[data-atgflik]").forEach(b => b.addEventListener("click", () => { foFlik.atg = b.dataset.atgflik; foRita(); }));
    yta.querySelectorAll("[data-atgstat]").forEach(b => b.addEventListener("click", () => {
        const a = foAtgard(p, b.dataset.atgstat);
        if (foGor("atgardStatus", { id: a.id, status: a.status === "klar" ? "oppen" : "klar" })) status("Åtgärd Å-" + a.nr + (a.status === "klar" ? " öppnad igen." : " är klar."));
    }));
    yta.querySelectorAll("[data-atgandra]").forEach(b => b.addEventListener("click", () => foAtgardDialog(foAtgard(p, b.dataset.atgandra))));
    yta.querySelectorAll("[data-kalla]").forEach(b => b.addEventListener("click", () => {
        const [typ, id] = b.dataset.kalla.split(":");
        if (typ === "fraga") { const f = foFraga(p, id); if (f) foGaTill(f.lage === "klar" ? "klara" : "aktiva", id); }
        if (typ === "beslut") { foGaTill("beslut"); setTimeout(() => foMarkeraRad(id), 30); }
    }));
    document.getElementById("foAtgExport").addEventListener("click", () => {
        const rad = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
        const csv = "﻿" + ["Nr", "Åtgärd", "Ansvarig", "Klar senast", "Status", "Källa"].map(rad).join(";") + "\r\n" + lista.map(a => ["Å-" + a.nr, a.text, foPartText(p, a.ansvarig), a.senast,
            a.status === "klar" ? "Klar" : a.status === "makulerad" ? "Avbruten" : "Öppen", (a.kopplingar || []).map(k => foObjNamn(p, k)).join(", ")].map(rad).join(";")).join("\r\n");
        foLaddaNer(foFilnamn(p.namn) + "-atgarder-" + idag + ".csv", csv, "text/csv;charset=utf-8");
    });
    const lagg = document.getElementById("foAtgLagg");
    if (lagg) {
        const t = document.getElementById("foAtgText");
        const gor = () => {
            const a = foGor("nyAtgard", { id: foId(), text: t.value, ansvarig: foPartFran(document.getElementById("foAtgAnsv").value), senast: document.getElementById("foAtgSenast").value });
            if (a) { status("Åtgärd Å-" + a.nr + " skapad."); setTimeout(() => { foMarkeraRad(a.id); const n = document.getElementById("foAtgText"); if (n) n.focus(); }, 30); }
        };
        lagg.addEventListener("click", gor);
        t.addEventListener("keydown", (e) => { if (e.key === "Enter") gor(); });
    }
}
function foAtgardDialog(a, kalla) {
    const p = foP, ny = !a;
    const kropp = (kalla ? '<p class="hjalp" style="margin-top:0">Källa: ' + esc(foObjNamn(p, kalla)) + ' — ' + esc(foObjText(p, kalla).slice(0, 120)) + '</p>' : "") +
        '<div class="falt"><label for="foAdText">Vad ska göras?</label><textarea class="f" id="foAdText" rows="3">' + esc(a ? a.text : "") + '</textarea></div>' +
        '<div class="tva"><div class="falt"><label for="foAdAnsv">Ansvarig</label>' + foPartSelect("foAdAnsv", a ? a.ansvarig : null, "Välj ansvarig …") + '</div>' +
        '<div class="falt"><label for="foAdSenast">Klar senast</label><input class="f" type="date" id="foAdSenast" value="' + esc(a ? a.senast : "") + '"></div></div>' +
        (a && a.hist.length ? '<details class="fo-histdet"><summary>Historik (' + a.hist.length + ')</summary><ul class="fo-hist">' + a.hist.slice().reverse().map(h =>
            '<li><span>' + foNarText(h.tid) + '</span>' + esc(h.text) + ' <small>' + esc(foPersonNamn(p, h.av)) + '</small></li>').join("") + '</ul></details>' : "");
    const knappar = [];
    if (a && a.status !== "makulerad") knappar.push({ txt: "Avbryt åtgärden", vanster: true, fara: true, fn: () => { stangModal(); foFragaOrsak("Avbryt åtgärd Å-" + a.nr, "Åtgärden döljs i listorna men finns kvar med historik och kan återställas.", "Avbryt åtgärden", o => foGor("atgardStatus", { id: a.id, status: "makulerad", orsak: o })); } });
    if (a && a.status === "makulerad") knappar.push({ txt: "Återställ", vanster: true, fn: () => { stangModal(); foGor("atgardStatus", { id: a.id, status: "oppen" }); } });
    knappar.push({ txt: "Stäng", fn: stangModal });
    knappar.push({ txt: ny ? "Skapa åtgärd" : "Spara", primar: true, fn: () => {
        const v = { text: document.getElementById("foAdText").value, ansvarig: foPartFran(document.getElementById("foAdAnsv").value), senast: document.getElementById("foAdSenast").value };
        const r = ny ? foGor("nyAtgard", Object.assign({ id: foId(), kalla: kalla || null }, v)) : foGor("atgardFalt", Object.assign({ id: a.id }, v));
        if (r) { stangModal(); status(ny ? "Åtgärd Å-" + r.nr + " skapad." : "Åtgärden sparades."); }
    } });
    modal(ny ? "Ny åtgärd" : "Åtgärd Å-" + a.nr, a ? (a.status === "klar" ? "Klar" : a.status === "makulerad" ? "Avbruten" : "Öppen") + " · skapad " + foDatumKort(a.skapad) + " av " + foPersonNamn(p, a.av) : "", kropp, knappar);
    setTimeout(() => { const t = document.getElementById("foAdText"); if (t) t.focus(); }, 30);
}

/* ======================= Beslutslogg ======================= */
function foVyBeslut(yta) {
    const p = foP, jag = foJagId();
    const urval = { gallande: b => b.status === "gallande", ersatta: b => b.status === "ersatt", alla: () => true };
    if (!urval[foFlik.beslut]) foFlik.beslut = "gallande";
    const lista = p.beslut.filter(urval[foFlik.beslut]).sort((a, b) => (b.datum || "").localeCompare(a.datum || "") || (b.skapad || "").localeCompare(a.skapad || ""));
    let html = foTopp("Beslutslogg", (foKanLeda(p, jag) ? '<button class="navknapp" type="button" id="foBeslutNy">+ Beslut utan fråga</button>' : "") +
        '<button class="navknapp" type="button" id="foBeslutExport">Exportera</button>');
    html += '<div class="fo-snabbrad">' + [["gallande", "Gällande"], ["ersatta", "Ersatta"], ["alla", "Alla"]].map(([k, t]) => '<button type="button" class="fo-snabb' + (foFlik.beslut === k ? " vald" : "") + '" data-beslutflik="' + k + '">' +
        t + ' <span>' + p.beslut.filter(urval[k]).length + '</span></button>').join("") + '</div>';
    html += lista.length ? '<div class="fo-tabellram"><table class="lista fo-tabell"><thead><tr><th class="fo-nrkol">Nr</th><th>Beslut</th><th>Källa</th><th>Beslutsfattare</th><th>Datum</th><th>Status</th></tr></thead><tbody>' +
        lista.map(b => {
            const f = b.fragaId ? foFraga(p, b.fragaId) : null, fo = b.forum ? foForum(p, b.forum) : null;
            const ers = b.ersattAv ? foBeslut(p, b.ersattAv) : null, ersatter = b.ersatter ? foBeslut(p, b.ersatter) : null;
            return '<tr data-rad="' + b.id + '" data-beslut="' + b.id + '" tabindex="0" class="' + (b.status === "ersatt" ? "utford" : "") + '"><td class="fo-nrkol"><b>' + esc(b.nr) + '</b></td>' +
                '<td><span class="fo-fragetext">' + esc(b.text) + '</span>' + (ersatter ? '<small>' + (b.satt === "kompletterar" ? "Kompletterar " : "Ersätter ") + esc(ersatter.nr) + '</small>' : "") +
                (b.paverkar ? ' <span class="fo-tagg t-varn">Tid/kostnad</span>' : "") + '</td>' +
                '<td>' + (f ? '<button type="button" class="p4d-lank" data-tillfraga="' + f.id + '">Fråga ' + f.nr + '</button>' : fo ? esc(fo.namn) : "–") + '</td>' +
                '<td>' + esc(foPersonNamn(p, b.fattare) || "–") + '</td><td class="dat">' + foDatumKort(b.datum) + '</td>' +
                '<td>' + (b.status === "gallande" ? '<span class="fo-lage besvarad"><i></i>Gällande</span>' : '<span class="fo-lage mak"><i></i>Ersatt' + (ers ? " av " + esc(ers.nr) : "") + '</span>') + '</td></tr>';
        }).join("") + '</tbody></table></div>'
        : foTomt(p.beslut.length ? "Inga beslut här" : "Inga beslut ännu", p.beslut.length ? "Välj ett annat urval." : "Beslut fastställs från en fråga (fliken Beslut i frågan), eller som beslut utan fråga, till exempel från ett möte.");
    yta.innerHTML = html;
    yta.querySelectorAll("[data-beslutflik]").forEach(b => b.addEventListener("click", () => { foFlik.beslut = b.dataset.beslutflik; foRita(); }));
    yta.querySelectorAll("[data-tillfraga]").forEach(b => b.addEventListener("click", (e) => { e.stopPropagation(); const f = foFraga(p, b.dataset.tillfraga); foGaTill(f.lage === "klar" ? "klara" : "aktiva", f.id); }));
    yta.querySelectorAll("tr[data-beslut]").forEach(tr => {
        tr.addEventListener("click", (e) => { if (!e.target.closest("button")) foBeslutVisa(foBeslut(p, tr.dataset.beslut)); });
        tr.addEventListener("keydown", (e) => { if (e.key === "Enter") foBeslutVisa(foBeslut(p, tr.dataset.beslut)); });
    });
    const ny = document.getElementById("foBeslutNy"); if (ny) ny.addEventListener("click", () => foBeslutDialog(null, null));
    document.getElementById("foBeslutExport").addEventListener("click", () => {
        const rad = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
        const csv = "﻿" + ["Nr", "Beslut", "Källa", "Beslutsfattare", "Datum", "Status", "Ersätter", "Ersatt av"].map(rad).join(";") + "\r\n" + lista.map(b => [b.nr, b.text,
            b.fragaId ? "Fråga " + (foFraga(p, b.fragaId) || {}).nr : (foForum(p, b.forum) || {}).namn || "", foPersonNamn(p, b.fattare), b.datum, b.status === "gallande" ? "Gällande" : "Ersatt",
            (foBeslut(p, b.ersatter) || {}).nr || "", (foBeslut(p, b.ersattAv) || {}).nr || ""].map(rad).join(";")).join("\r\n");
        foLaddaNer(foFilnamn(p.namn) + "-beslutslogg-" + foIdag() + ".csv", csv, "text/csv;charset=utf-8");
    });
}
function foBeslutVisa(b) {
    const p = foP, jag = foJagId(), f = b.fragaId ? foFraga(p, b.fragaId) : null;
    const ers = b.ersattAv ? foBeslut(p, b.ersattAv) : null, ersatter = b.ersatter ? foBeslut(p, b.ersatter) : null;
    const kropp = '<div class="fo-beslutvy"><p class="fo-beslutstext">' + esc(b.text) + '</p>' +
        '<ul class="detalj"><li><span class="et">Beslutsfattare</span><span>' + esc(foPersonNamn(p, b.fattare) || "–") + '</span></li>' +
        '<li><span class="et">Datum</span><span>' + esc(b.datum) + '</span></li>' +
        '<li><span class="et">Registrerat av</span><span>' + esc(foPersonNamn(p, b.av)) + " · " + foNarText(b.skapad) + '</span></li>' +
        '<li><span class="et">Status</span><span>' + (b.status === "gallande" ? "Gällande" : "Ersatt" + (ers ? " av " + esc(ers.nr) : "")) + '</span></li>' +
        (ersatter ? '<li><span class="et">' + (b.satt === "kompletterar" ? "Kompletterar" : "Ersätter") + '</span><span>' + esc(ersatter.nr) + " · " + esc(ersatter.text) + '</span></li>' : "") +
        (b.paverkar ? '<li><span class="et">Tid/kostnad</span><span>' + esc(FO_PAVERKAR_TEXT) + '</span></li>' : "") + '</ul>' +
        (b.underlag ? '<div class="fo-underlag"><h4>Underlag vid beslutstillfället</h4><p><b>Fråga ' + (f ? f.nr : "") + ':</b> ' + esc(b.underlag.fraga) + '</p>' +
            (b.underlag.svar ? '<p><b>Svar:</b> ' + esc(b.underlag.svar) + '</p>' : "") + '</div>' : "") + '</div>';
    const knappar = [];
    if (f) knappar.push({ txt: "Öppna fråga " + f.nr, vanster: true, fn: () => { stangModal(); foGaTill(f.lage === "klar" ? "klara" : "aktiva", f.id); } });
    if (b.status === "gallande" && foKanLeda(p, jag)) knappar.push({ txt: "Ersätt eller komplettera", fn: () => { stangModal(); foBeslutDialog(f, b); } });
    knappar.push({ txt: "Stäng", primar: true, fn: stangModal });
    modal("Beslut " + b.nr, f ? "Från fråga " + f.nr : b.forum ? "Från " + ((foForum(p, b.forum) || {}).namn || "möte") : "Beslut utan fråga", kropp, knappar);
}
// Nytt beslut: från en fråga, utan fråga (mötesbeslut), eller som ersätter/kompletterar ett tidigare.
function foBeslutDialog(f, tidigare) {
    const p = foP, jag = foJagId();
    const kropp = (f ? '<div class="fo-underlag"><h4>Underlag: fråga ' + f.nr + '</h4><p>' + esc(f.text) + '</p>' + (f.svar ? '<p><b>Svar:</b> ' + esc(f.svar.text) + '</p>' : '<p class="hjalp">Frågan har inget svar ännu.</p>') +
        '<p class="hjalp" style="margin:6px 0 0">Underlaget sparas med beslutet så som det ser ut nu.</p></div>' : "") +
        (tidigare ? '<div class="notis">' + esc(tidigare.nr) + ': ' + esc(tidigare.text) + '</div><div class="falt"><label>Det nya beslutet</label><div class="lage" id="foBdSatt">' +
            '<button type="button" data-satt="ersatter" class="vald">Ersätter ' + esc(tidigare.nr) + '</button><button type="button" data-satt="kompletterar">Kompletterar ' + esc(tidigare.nr) + '</button></div></div>' : "") +
        (!f && !tidigare && p.forum.length ? '<div class="falt"><label for="foBdForum">Möte (källa)</label>' + foForumSelect("foBdForum", "", "Inget möte") + '</div>' : "") +
        '<div class="falt"><label for="foBdText">Vad beslutades?</label><textarea class="f" id="foBdText" rows="4" placeholder="Till exempel: Schaktet flyttas 300 mm åt norr. A reviderar planritning plan 2."></textarea></div>' +
        '<div class="tva"><div class="falt"><label for="foBdFattare">Beslutsfattare</label>' + foPersonSelect("foBdFattare", jag, "–") + '</div>' +
        '<div class="falt"><label for="foBdDatum">Datum</label><input class="f" type="date" id="foBdDatum" value="' + foIdag() + '"></div></div>' +
        '<label class="fo-kryss"><input type="checkbox" id="foBdPaverkar"> Kan påverka tid eller kostnad</label><p class="hjalp" style="margin:4px 0 0">' + esc(FO_PAVERKAR_TEXT) + '</p>';
    modal(tidigare ? "Ersätt eller komplettera " + tidigare.nr : f ? "Fastställ beslut för fråga " + f.nr : "Beslut utan fråga",
        "Ett fastställt beslut kan inte ändras i efterhand.", kropp, [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Fastställ beslut", primar: true, fn: () => {
            const satt = tidigare ? (document.querySelector("#foBdSatt .vald") || { dataset: { satt: "ersatter" } }).dataset.satt : "";
            const b = foGor("nyttBeslut", { id: foId(), fragaId: f ? f.id : (tidigare ? tidigare.fragaId : ""), forum: (document.getElementById("foBdForum") || {}).value || (tidigare ? tidigare.forum : ""),
                text: document.getElementById("foBdText").value, fattare: document.getElementById("foBdFattare").value, datum: document.getElementById("foBdDatum").value,
                paverkar: document.getElementById("foBdPaverkar").checked, ersatter: tidigare ? tidigare.id : "", satt: satt });
            if (b) { stangModal(); status("Beslut " + b.nr + " fastställt."); }
        } }
    ]);
    document.querySelectorAll("#foBdSatt button").forEach(x => x.addEventListener("click", () => document.querySelectorAll("#foBdSatt button").forEach(y => y.classList.toggle("vald", y === x))));
    setTimeout(() => { const t = document.getElementById("foBdText"); if (t) t.focus(); }, 30);
}
