/* ======================================================================
   Wimo Forma · vyer
   Översikt, frågeregistret (Aktiva, Klara, Alla), möten, åtgärder och
   beslutsloggen.
   ====================================================================== */

/* ======================= Översikt ======================= */
function foVyOversikt(yta) {
    const p = foP, jag = foJagId(), l = foLaget(p), idag = foIdag(), leda = foKanLeda(p, jag) || foSuper(p, jag) || p.plId === jag;
    const namn = jag ? (foPerson(p, jag).fornamn || foPersonNamn(p, jag)) : "";
    const kpi = (id, tal, rub, under, niva) => '<button type="button" class="kpi' + (niva ? " " + niva : "") + '" data-fokpi="' + id + '">' +
        '<span class="kpital">' + tal + '</span><span class="kpirub">' + rub + '</span>' + (under ? '<span class="kpiunder">' + under + '</span>' : "") + '</button>';
    // Samma arbetsyta som Min översikt och det dagliga mejlet.
    let att = foArbHtml(foPid, p, foArbetsyta(p, jag, idag), 8);
    // inlägg i projektflödet som nämner mig och som jag inte har sett
    const namnd = (p.flode || []).filter(x => x.av !== jag && foInlaggNamner(p, jag, x) && foNytt(p, jag, x)).sort((a, b) => (b.tid || "").localeCompare(a.tid || ""));
    if (namnd.length) att += '<div class="fo-aggrupp"><h4>Du är nämnd i projektflödet <span class="antal">' + namnd.length + '</span></h4><ul class="atglista fo-aglista">' +
        namnd.slice(0, 5).map(x => '<li data-inlagglank="' + x.id + '"><span class="fo-agnr fo-avatar liten">' + esc(foInitialer(p, x.av)) + '</span><span class="fo-agtext">' + esc(String(x.text || "(bilaga)").slice(0, 160)) +
            '<small>' + esc(foPersonNamn(p, x.av)) + " · " + foNarText(x.tid) + '</small></span></li>').join("") + '</ul></div>';
    const forum = foForumValbara(p).map(f => ({ f: f, n: p.fragor.filter(x => foAktiv(x) && x.moten.includes(f.id)).length }))
        .sort((a, b) => (a.f.nastaMote || "9999").localeCompare(b.f.nastaMote || "9999"));
    const hand = p.logg.slice(foFlik.allaHand ? -40 : -6).reverse();
    const sett = (p.sett[jag] || {})["_logg"] || "";
    let html = foTopp("Projektöversikt");
    html += '<div class="dashblock fo-attgora"><h3>' + (namn ? "Hej " + esc(namn) + ", det här väntar på dig" : "Att göra för dig") + '</h3>' +
        (att || '<p class="fo-klart">Inget väntar på dig just nu.' + (jag ? "" : " Du finns inte i projektets kontaktlista ännu — lägg till dig under Projektmedlemmar.") + '</p>') + '</div>';
    html += '<div class="kpirad fo-kpirad">' +
        kpi("oppna", l.oppna, "Öppna frågor", l.klara + " klara") +
        kpi("vantar", l.vantar, "Väntar på svar", l.forsenade ? '<b class="rodtal">' + l.forsenade + " försenade</b>" : "inga försenade", l.forsenade ? "rod" : "") +
        kpi("kvittera", l.kvittera, "Att kvittera", "ändringar att ta del av", l.kvittera ? "orange" : "") +
        kpi("atg", l.atgOppna, "Öppna åtgärder", l.atgForsenade ? '<b class="rodtal">' + l.atgForsenade + " försenade</b>" : "inga försenade", l.atgForsenade ? "rod" : "") + '</div>';
    if (leda) html += foUppfoljningHtml(p) + foKvittOversiktHtml(p);
    // gemensam lägesbild: åtgärder per disciplin (klickbara staplar) och avvikelser i protokollbevakningen
    html += foAtgStaplar(p, idag).replace('class="dashblock fo-atgstaplar"', 'class="dashblock fo-atgstaplar" data-oversikt');
    const bevFolj = p.forum.filter(fo => fo.aktiv).map(fo => ({ fo, b: foBevakning(p, fo, idag) })).filter(x => x.b && x.b.lage === "folj");
    const sistaProt = (p.protokoll || []).filter(x => !x.makulerad).sort((a, b) => (b.datum || "").localeCompare(a.datum || "")).slice(0, 4);
    // projektflödet: det fästa och det senaste
    const flode = (p.flode || []).slice().sort((a, b) => (b.fast - a.fast) || (b.tid || "").localeCompare(a.tid || "")).slice(0, 4);
    html += '<div class="dashblock fo-oflode"><h3>Projektflöde <button type="button" class="p4d-lank fo-hoger" data-tillflode>' + (flode.length ? "Visa flödet" : "Skriv det första inlägget") + "</button></h3>" +
        (flode.length ? '<ul class="atglista fo-aglista">' + flode.map(x => '<li data-inlagglank="' + x.id + '"><span class="fo-agnr fo-avatar liten">' + esc(foInitialer(p, x.av)) + '</span><span class="fo-agtext">' +
            (x.fast ? '<span class="fo-fastmark">Fäst</span> ' : "") + esc(String(x.text || "(bilaga)").slice(0, 180)) +
            '<small>' + esc(foPersonNamn(p, x.av)) + " · " + foNarText(x.tid) + (x.kommentarer.length ? " · " + x.kommentarer.length + (x.kommentarer.length === 1 ? " kommentar" : " kommentarer") : "") + '</small></span></li>').join("") + "</ul>"
            : '<p class="hjalp" style="margin:0">Här delar projektet löpande information: nya ritningar, protokoll, ändrade leveranstider.</p>') + "</div>";
    if (sistaProt.length || bevFolj.length) html += '<div class="dashblock"><h3>Protokoll' + '<button type="button" class="p4d-lank fo-hoger" data-tillmoten>Möten & protokoll</button></h3>' +
        (bevFolj.length ? '<p class="hjalp" style="margin:0 0 6px">Behöver följas upp: ' + bevFolj.map(x => esc(x.fo.namn)).join(", ") + '</p>' : "") +
        '<ul class="atglista fo-aglista">' + sistaProt.map(x => '<li data-forum="' + x.forum + '"><span class="fo-agnr">' + esc((foForum(p, x.forum) || {}).kort || "") + '</span><span class="fo-agtext">' +
            esc((foForum(p, x.forum) || {}).namn || "") + (x.nr ? " " + esc(x.nr) : "") + '<small>' + esc(x.datum || "") + (x.status === "utkast" ? " · utkast" : "") + '</small></span></li>').join("") + '</ul></div>';
    html += '<div class="fo-tvakol"><div class="dashblock"><h3>Kommande möten</h3>' + (forum.length ? '<ul class="atglista fo-motlista">' + forum.map(x =>
        '<li data-forum="' + x.f.id + '"><span class="fo-agnr">' + esc(x.f.kort) + '</span><span class="fo-agtext">' + esc(x.f.namn) +
        '<small>' + (x.f.nastaMote ? foDatumKort(x.f.nastaMote) + (x.f.tid ? " kl " + esc(x.f.tid) : "") : "Inget datum satt") + (x.f.plats ? " · " + esc(x.f.plats) : "") + '</small></span>' +
        '<span class="fo-antalchip">' + x.n + (x.n === 1 ? " fråga" : " frågor") + '</span></li>').join("") + '</ul>'
        : '<p class="hjalp" style="margin:0">Inga mötesforum ännu. Lägg upp projektets möten under <button type="button" class="p4d-lank" id="foTillForum">Projektmedlemmar → Mötesforum</button>.</p>') + '</div>';
    html += '<div class="dashblock"><h3>Senaste händelser' + (hand.length ? '<button type="button" class="p4d-lank fo-hoger" id="foSett">Markera allt som sett</button>' : "") + '</h3>' +
        (hand.length ? '<ul class="fo-handelser">' + hand.map(h => '<li class="' + (h.tid > sett && h.av !== jag ? "ny" : "") + '"' + (h.obj ? ' data-obj="' + h.obj + '"' : "") + '>' +
            '<span class="fo-hnar">' + foNarText(h.tid) + '</span><span class="fo-htext">' + esc(h.text) + '<small>' + esc(foPersonNamn(p, h.av) || "") + '</small></span></li>').join("") + '</ul>' +
            (p.logg.length > 6 ? '<button type="button" class="p4d-lank fo-merlank" id="foFlerHand">' + (foFlik.allaHand ? "Visa färre" : "Visa fler") + '</button>' : "")
            : '<p class="hjalp" style="margin:0">Inget har hänt i projektet ännu.</p>') + '</div></div>';
    yta.innerHTML = html;
    foKopplaArb(yta);
    foKopplaUppfoljning(yta);
    yta.querySelectorAll("[data-inlagglank]").forEach(li => li.addEventListener("click", () => foVisaInlagg(li.dataset.inlagglank)));
    yta.querySelectorAll("[data-tillflode]").forEach(b => b.addEventListener("click", () => foGaTill("flode")));
    yta.querySelectorAll("[data-fraga]").forEach(li => li.addEventListener("click", () => {
        const f = foFraga(p, li.dataset.fraga); foGaTill(f.lage === "klar" ? "klara" : "aktiva", f.id);
    }));
    yta.querySelectorAll("[data-atg]").forEach(li => li.addEventListener("click", () => { foFlik.atg = "mina"; foGaTill("atgarder"); setTimeout(() => foMarkeraRad(li.dataset.atg), 30); }));
    yta.querySelectorAll("[data-forum]").forEach(li => li.addEventListener("click", () => { foFlik.mote = li.dataset.forum; foGaTill("moten"); }));
    yta.querySelectorAll("[data-tillmoten]").forEach(b => b.addEventListener("click", () => foGaTill("moten")));
    yta.querySelectorAll("[data-stapel]").forEach(b => b.addEventListener("click", () => { foFlik.atg = "st:" + b.dataset.stapel; foGaTill("atgarder"); }));
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
    const rub = { aktiva: "Aktiva frågor", mina: "Mina frågor", klara: "Klara frågor", alla: "Alla frågor" }[vy] || "Frågor";
    // urval – de fyra frågevyerna ser ut och fungerar likadant, bara grundurvalet skiljer
    let lista = p.fragor.filter(f => vy === "alla" ? (foFilter.visaMak || !f.makulerad) : vy === "klara" ? (!f.makulerad && f.lage === "klar") :
        vy === "mina" ? foMinFraga(p, jag, f) : foAktiv(f));
    const snabb = {
        alla: () => true,
        mina: f => (f.lage === "obesvarad" || f.lage === "ofullstandig") && foArMottagare(p, jag, f),
        mintur: f => foMinTur(p, jag, f),
        avsluta: f => f.lage === "besvarad" && foArStallare(p, jag, f) && !foOkvittSvar(f).length,
        stallda: f => foArStallare(p, jag, f),
        berord: f => foArBerord(p, jag, f) && !foArMottagare(p, jag, f) && !foArStallare(p, jag, f),
        obesvarade: f => f.lage === "obesvarad" || f.lage === "ofullstandig",
        kvittera: f => foOkvitterade(f).length > 0,
        forsenade: f => foForsenad(f, idag),
        mote: f => f.moten.length > 0,
        paverkar: f => f.paverkar,
        tid: f => foKonsAktiva(f, "tid").length > 0,
        kostnad: f => foKonsAktiva(f, "kostnad").length > 0,
        ejslutligt: f => foHarSvar(f) && !foSlutliga(f).length && !f.makulerad
    };
    const antal = {};
    Object.keys(snabb).forEach(k => { antal[k] = lista.filter(snabb[k]).length; });
    const huvud = vy === "aktiva" ? ["alla", "mina", "kvittera", "forsenade"] : vy === "mina" ? ["alla", "mintur", "stallda", "mina"] : ["alla", "stallda", "kvittera"];
    const flerMojliga = vy === "aktiva" ? ["stallda", "obesvarade", "ejslutligt", "mote", "tid", "kostnad"] : vy === "mina" ? ["avsluta", "kvittera", "forsenade", "berord", "tid", "kostnad"] : ["tid", "kostnad"];
    if (!huvud.concat(flerMojliga).includes(foFilter.snabb)) foFilter.snabb = "alla";
    lista = lista.filter(snabb[foFilter.snabb] || snabb.alla);
    const q = foNormal(foFilter.sok).trim();
    if (q) {
        const nr = /^\d+$/.test(q) ? +q : null;
        lista = lista.filter(f => f.nr === nr || foNormal(f.text + " " + foDialogText(f) + " " + foPersonNamn(p, foStallarePerson(f)) + " " + foMottagareText(p, f)).includes(q));
    }
    if (foFilter.disc) lista = lista.filter(f => f.fran === foFilter.disc || foMottagare(f).some(m => m.disc === foFilter.disc || foPersonDisc(p, m.person).includes(foFilter.disc)) || f.berorda.includes(foFilter.disc));
    if (foFilter.plats) lista = lista.filter(f => f.indelning.includes(foFilter.plats));
    if (foFilter.lage && vy === "alla") lista = lista.filter(f => foFilter.lage === "mak" ? f.makulerad : !f.makulerad && f.lage === foFilter.lage);
    if (foFilter.mote) lista = lista.filter(f => f.moten.includes(foFilter.mote));
    const vikt = f => (foOkvitterade(f).length ? 0 : 1) * 10 + (foForsenad(f, idag) ? 0 : 1) * 5 + ({ ofullstandig: 0, obesvarad: 1, besvarad: 2, klar: 3 })[f.lage];
    const sorter = {
        std: (a, b) => (vy === "aktiva" || vy === "mina") ? (vikt(a) - vikt(b) || b.nr - a.nr) : b.nr - a.nr,
        nr: (a, b) => a.nr - b.nr,
        nrfall: (a, b) => b.nr - a.nr,
        senast: (a, b) => (a.svarSenast || "9999").localeCompare(b.svarSenast || "9999") || a.nr - b.nr,
        andrad: (a, b) => (b.andrad || "").localeCompare(a.andrad || "")
    };
    if ((foFilter.sort || "").startsWith("kol:")) foSorteraKol(lista, foFilter.sort);
    else lista.sort(sorter[foFilter.sort] || sorter.std);

    const kanPam = foKanLeda(p, jag) || foSuper(p, jag) || p.plId === jag || p.fragor.some(f => foArStallare(p, jag, f));
    let html = foTopp(rub, (vy !== "klara" && kanPam ? '<button class="navknapp p4-tonknapp' + (foValjLage ? " pa" : "") + '" type="button" id="foValjKnapp" aria-pressed="' + foValjLage + '" title="Välj flera frågor och skicka en gemensam påminnelse">' + (foValjLage ? "Avsluta val" : "Påminn flera") + '</button>' : "") +
        '<button class="navknapp p4-tonknapp" type="button" id="foAnpassaVy" title="Välj kolumner, ordning, gruppering och visning">Anpassa vy</button>' +
        '<button class="navknapp p4-tonknapp" type="button" id="foExport" title="Öppnas i Excel">Exportera</button>' +
        '<button class="navknapp p4-tonknapp" type="button" id="foSkrivUt" title="Skriv ut eller spara som PDF">Skriv ut / PDF</button>');
    if (vy !== "klara" && kan) html += foNyFragaHtml();
    else if (vy !== "klara" && !kan) html += '<div class="notis">Du har läsbehörighet i projektet och kan inte registrera frågor.</div>';
    const chip = (k, txt) => '<button type="button" class="fo-snabb' + (foFilter.snabb === k ? " vald" : "") + '" data-snabb="' + k + '" aria-pressed="' + (foFilter.snabb === k) + '">' +
        txt + (k !== "alla" && antal[k] ? ' <span>' + antal[k] + '</span>' : "") + '</button>';
    const fler = flerMojliga.filter(k => antal[k] || foFilter.snabb === k);
    const namnet = { alla: "Alla", mina: "Att svara på", mintur: "Väntar på mig", avsluta: "Att avsluta", stallda: "Ställda av mig", obesvarade: "Obesvarade",
        kvittera: "Att kvittera", forsenade: "Försenade", mote: "På mötesurval", paverkar: "Tid/kostnad", tid: "Risk tid", kostnad: "Risk kostnad",
        berord: "Berör mig", ejslutligt: "Slutligt svar ej valt" };
    const extraAktivt = foFilter.disc || foFilter.plats || foFilter.lage || foFilter.mote || (foFilter.sort !== "std" && !(foFilter.sort || "").startsWith("kol:")) || foFilter.visaMak || fler.includes(foFilter.snabb);
    const visaFler = foFilter.oppen || extraAktivt;
    html += '<div class="fo-verktygsrad"><label class="fo-sokfalt"><span class="p4-ik ik-sok" aria-hidden="true"></span><input class="f" id="foFSok" type="search" placeholder="Sök nummer eller text" value="' + esc(foFilter.sok) + '" data-behall></label>' +
        '<div class="fo-snabbrad">' + huvud.map(k => chip(k, namnet[k])).join("") + '</div>' +
        '<button type="button" class="fo-filterknapp' + (visaFler ? " oppen" : "") + '" id="foFlerFilter" aria-expanded="' + !!visaFler + '"><span class="fo-filterik" aria-hidden="true"></span>Filter' + (extraAktivt ? ' <span class="fo-filterprick" aria-label="filter är valda"></span>' : "") + '</button></div>';
    html += '<div class="fo-filterrad' + (visaFler ? "" : " dold") + '" id="foFilterRad">' + (fler.length ? fler.map(k => chip(k, namnet[k])).join("") : "") +
        foDiscSelect("foFDisc", foFilter.disc, "Alla discipliner", ' aria-label="Disciplin"') +
        (p.indelningar.length ? foPlatsSelect("foFPlats", foFilter.plats, "Alla platser", ' aria-label="Plats"') : "") +
        (vy === "alla" ? '<select class="f" id="foFLage" aria-label="Läge"><option value="">Alla lägen</option>' + Object.keys(FO_LAGE).map(k =>
            '<option value="' + k + '"' + (foFilter.lage === k ? " selected" : "") + '>' + FO_LAGE[k].namn + '</option>').join("") +
            '<option value="mak"' + (foFilter.lage === "mak" ? " selected" : "") + '>Makulerade</option></select>' : "") +
        (p.forum.length ? foForumSelect("foFMote", foFilter.mote, "Alla möten", ' aria-label="Möte"') : "") +
        '<select class="f" id="foFSort" aria-label="Sortering">' + ((foFilter.sort || "").startsWith("kol:") ? '<option value="' + esc(foFilter.sort) + '" selected>Efter kolumnen ' + esc((FO_FKOL[foFilter.sort.split(":")[1]] || { namn: "" }).namn) + '</option>' : "") + [["std", (vy === "aktiva" || vy === "mina") ? "Det som brådskar först" : "Senaste först"], ["nrfall", "Nummer, fallande"], ["nr", "Nummer, stigande"],
            ["senast", "Svar senast"], ["andrad", "Senast ändrad"]].map(([v, t]) => '<option value="' + v + '"' + (foFilter.sort === v ? " selected" : "") + '>' + t + '</option>').join("") + '</select>' +
        (vy === "alla" ? '<label class="fo-kryss"><input type="checkbox" id="foFMak"' + (foFilter.visaMak ? " checked" : "") + '> Visa makulerade</label>' : "") +
        (extraAktivt ? '<button type="button" class="p4d-lank" id="foRensaFilter">Rensa filter</button>' : "") + '</div>';
    const filtrerat = foFilter.sok || foFilter.disc || foFilter.plats || foFilter.lage || foFilter.mote || foFilter.snabb !== "alla";
    if (!lista.length) {
        html += vy === "mina" && !filtrerat ? foTomt("Inga frågor för dig just nu", "Här samlas aktiva frågor som du har ställt, ska besvara eller behöver kvittera eller avsluta.")
            : p.fragor.length || filtrerat
            ? foTomt("Inga frågor matchar", "Byt filter eller sökning.", filtrerat ? '<button type="button" class="mknapp" id="foRensa">Visa alla</button>' : "")
            : foTomt(vy === "klara" ? "Inga klara frågor ännu" : "Inga frågor ännu", vy === "klara" ? "När en besvarad fråga markeras Klar hamnar den här." :
                "Skriv den första frågan i rutan ovanför. Bara frågetexten behövs — datum, du som frågeställare och läget sätts automatiskt.");
    } else html += foValjRadHtml() + foFragaTabellVy(lista, vy);
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
    document.getElementById("foAnpassaVy").addEventListener("click", () => foVyDialog(vy));
    foKopplaFragaTabell(yta);
    foKopplaKolumner(yta);
    foKopplaValj(yta, lista);
    if (vy !== "klara" && kan) foKopplaNyFraga();
}

// Ritar om men behåller fokus och markör i sökfältet.
function foRitaBehall() {
    const a = document.activeElement, id = a && a.id, s = a && a.selectionStart, e = a && a.selectionEnd;
    foRita();
    const b = id && document.getElementById(id);
    if (b) { b.focus(); try { b.setSelectionRange(s, e); } catch (x) { } }
}

function foKopplaFragaTabell(rot) {
    rot.querySelectorAll("tr[data-fraga]").forEach(tr => {
        const oppna = () => { foFragaOppen = tr.dataset.fraga; foSattAdress(); foRita(); };
        tr.addEventListener("click", (e) => { if (!e.target.closest("button")) oppna(); });
        tr.addEventListener("keydown", (e) => { if (e.key === "Enter") oppna(); });
    });
    rot.querySelectorAll("[data-klar]").forEach(b => b.addEventListener("click", (e) => {
        e.stopPropagation();
        foKlarDialog(foFraga(foP, b.dataset.klar));
    }));
    rot.querySelectorAll("[data-loggval]").forEach(b => b.addEventListener("click", (e) => {
        e.stopPropagation();
        const f = foFraga(foP, b.dataset.loggval);
        if (f) foGor("beslutslogg", { id: f.id, pa: !f.ilogg });
    }));
    rot.querySelectorAll("[data-motesval]").forEach(b => b.addEventListener("click", (e) => {
        e.stopPropagation();
        const f = foFraga(foP, b.dataset.motesval), forum = foForumValbara(foP);
        // Ett forum: markera med ett klick (FRG-007). Flera: välj i en liten meny.
        if (forum.length === 1) return foGor("motesmarkering", { id: f.id, forum: forum[0].id });
        foMotesMeny(b, f);
    }));
}
function foMotesMeny(ankare, f) {
    const gammal = document.getElementById("foMotesMeny"); if (gammal) gammal.remove();
    const m = document.createElement("div");
    m.id = "foMotesMeny"; m.className = "fo-popmeny"; m.setAttribute("role", "menu");
    m.innerHTML = '<div class="fo-popruta">Markera fråga ' + f.nr + ' för</div>' + foForumValbara(foP).map(x =>
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
// Snabbregistrering: bara frågetexten krävs. Frågeställare (jag), nummer, datum och svarstid sätts automatiskt.
function foNyUtkast() {
    const u = foLasLs(FO_UTKAST + foPid, {});
    if (!Array.isArray(u.mott)) u.mott = u.ansv ? [u.ansv] : [];
    if (!Array.isArray(u.moten)) u.moten = u.mote ? [u.mote] : [];
    if (!Array.isArray(u.berorda)) u.berorda = [];
    if (!Array.isArray(u.kons)) u.kons = [];
    return u;
}
function foStdSvarSenast() { const n = +((foP && foP.inst && foP.inst.svarstid) || 0); return n > 0 ? foPlusArbetsdagar(foIdag(), n) : ""; }
function foNyFragaHtml() {
    const p = foP, jag = foJag(), u = foNyUtkast();
    const stallare = u.stallare && foPerson(p, u.stallare) ? u.stallare : (jag ? jag.id : "");
    const fran = u.fran !== undefined ? u.fran : (foPersonDisc(p, stallare)[0] || "");
    const senast = u.senast !== undefined ? u.senast : foStdSvarSenast();
    const fler = u.fler || !!(u.plats || u.moten.length || u.berorda.length || u.kons.length || (stallare && jag && stallare !== jag.id));
    const forum = foForumValbara(p);
    return '<div class="fo-nyfraga' + (u.text ? " oppen" : "") + '" id="foNyRuta">' +
        '<div class="fo-nytopp"><textarea class="f" id="foNyText" rows="1" placeholder="Ställ en ny fråga …" data-behall>' + esc(u.text || "") + '</textarea>' +
        '<button type="button" class="p4-btn p4-btn-primar" id="foNyLagg">Lägg till</button></div>' +
        '<div class="fo-nydetalj">' +
        '<div class="fo-nyrad">' +
        '<div class="fo-litefalt fo-bred"><span>Ska svara</span><div id="foNyMottRuta">' + foPartValjare("foNyMott", u.mott.map(foPartFran).filter(Boolean), { tomText: "Välj vem som ska svara …", merText: "+ Fler" }) + '</div></div>' +
        '<label class="fo-litefalt"><span>Svar senast <em class="fo-vecka" id="foNyVecka">' + (senast ? "v. " + foVecka(senast) : "") + '</em></span><input class="f" type="date" id="foNySenast" value="' + esc(senast) + '"></label>' +
        foFilZon("foNyFil", "Bifoga") +
        '<button type="button" class="p4d-lank fo-flerval" id="foNyFler" aria-expanded="' + fler + '">' + (fler ? "Färre val" : "Fler val") + '</button></div>' +
        '<div class="fo-nyrad fo-nyfler' + (fler ? "" : " dold") + '" id="foNyFlerRad">' +
        '<label class="fo-litefalt"><span>Frågeställare</span>' + foPersonSelect("foNyStallare", stallare, "–") + '</label>' +
        '<label class="fo-litefalt"><span>Från disciplin</span>' + foDiscSelect("foNyFran", fran, "–") + '</label>' +
        (p.indelningar.length ? '<label class="fo-litefalt"><span>Plats</span>' + foPlatsSelect("foNyPlats", u.plats || "", "–") + '</label>' : "") +
        '<div class="fo-litefalt fo-bred"><span>Berörda</span><div id="foNyBerRuta">' + foPartValjare("foNyBer", u.berorda.map(foPartFran).filter(Boolean), { tomText: "Lägg till berörda …", merText: "+ Fler" }) + '</div></div>' +
        (forum.length ? '<div class="fo-litefalt fo-bred"><span>Ta upp på möte</span>' + foValChips("nymoten", forum.map(x => ({ id: x.id, namn: x.namn })), u.moten) + '</div>' : "") +
        '<div class="fo-litefalt fo-bred"><span>Markeringar</span>' + foValChips("nykons", [{ id: "tid", namn: "Risk för tidspåverkan" }, { id: "kostnad", namn: "Risk för kostnadspåverkan" }, { id: "bradskande", namn: "Särskilt brådskande – mejlas direkt" }], u.kons) + '</div>' +
        (stallare && jag && stallare !== jag.id ? '<p class="hjalp fo-litenhjalp fo-bred">Frågan registreras för ' + esc(foPersonNamn(p, stallare)) + ' och hamnar under dennes Mina frågor. Du står som registrerad av.</p>' : "") +
        '</div>' +
        '<div id="foNyBilagor"></div><p class="fo-nytips">Ctrl+Enter sparar · klistra in skärmklipp med Ctrl+V · svarstiden är förvald enligt projektets inställning</p></div></div>';
}
function foKopplaNyFraga() {
    const t = document.getElementById("foNyText");
    if (!t) return;
    const ruta = document.getElementById("foNyRuta");
    const u = () => foNyUtkast();
    const sparaU = (andr) => foSkrivLs(FO_UTKAST + foPid, Object.assign(u(), andr));
    t.addEventListener("focus", () => ruta.classList.add("oppen"));
    document.getElementById("foNyFler").addEventListener("click", (e) => {
        const rad = document.getElementById("foNyFlerRad"), pa = rad.classList.toggle("dold") === false;
        e.target.textContent = pa ? "Färre val" : "Fler val"; e.target.setAttribute("aria-expanded", pa);
        sparaU({ fler: pa });
    });
    const ritaOm = (behallFokus) => {
        const v = t.value, a = document.activeElement && document.activeElement.id;
        foRita();
        const n = document.getElementById("foNyText"); if (n) { n.value = v; document.getElementById("foNyRuta").classList.add("oppen"); }
        if (behallFokus && a) { const el = document.getElementById(a); if (el) el.focus(); }
    };
    foKopplaPartValjare(ruta, "foNyMott", u().mott.map(foPartFran).filter(Boolean), (l) => { sparaU({ text: t.value, mott: l.map(foPartVarde) }); ritaOm(); const s = document.querySelector("#foNyMott .fo-partlagg"); if (s) s.focus(); });
    foKopplaPartValjare(ruta, "foNyBer", u().berorda.map(foPartFran).filter(Boolean), (l) => { sparaU({ text: t.value, berorda: l.map(foPartVarde) }); ritaOm(); const s = document.querySelector("#foNyBer .fo-partlagg"); if (s) s.focus(); });
    ruta.querySelectorAll(".fo-valchips").forEach(g => g.querySelectorAll(".fo-valchip").forEach(b => b.addEventListener("click", () => {
        const nyckel = g.dataset.val === "nymoten" ? "moten" : "kons", l = u()[nyckel], id = b.dataset.id;
        const ny = l.includes(id) ? l.filter(x => x !== id) : l.concat(id);
        b.classList.toggle("pa", ny.includes(id)); b.setAttribute("aria-pressed", ny.includes(id));
        sparaU({ text: t.value, [nyckel]: ny });
    })));
    const spara = () => sparaU({ text: t.value, fran: document.getElementById("foNyFran").value, senast: document.getElementById("foNySenast").value,
        plats: (document.getElementById("foNyPlats") || {}).value || "", stallare: document.getElementById("foNyStallare").value });
    const ritaBil = () => {
        const b = document.getElementById("foNyBilagor");
        b.innerHTML = foNyBilagor.length ? foBilagorHtml(foNyBilagor) + '<button type="button" class="p4d-lank" id="foNyBilBort">Ta bort bilagorna</button>' : "";
        foKopplaBilagor(b, foNyBilagor);
        const x = document.getElementById("foNyBilBort"); if (x) x.addEventListener("click", () => { foNyBilagor = []; ritaBil(); });
    };
    ritaBil();
    t.addEventListener("input", () => { spara(); t.style.height = "auto"; t.style.height = Math.min(260, t.scrollHeight + 2) + "px"; });
    ["foNyFran", "foNySenast", "foNyPlats"].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener("change", () => {
        spara();
        if (id === "foNySenast") document.getElementById("foNyVecka").textContent = el.value ? "v. " + foVecka(el.value) : "";
    }); });
    const st = document.getElementById("foNyStallare");
    st.addEventListener("change", () => {
        const d = foPersonDisc(foP, st.value)[0] || "";
        sparaU({ text: t.value, stallare: st.value, fran: d });
        ritaOm();
    });
    foFilMottagare(document.getElementById("foNyFil"), t, (meta) => { foNyBilagor = foNyBilagor.concat(meta); ritaBil(); });
    const lagg = () => {
        const text = t.value.trim();
        if (!text) { t.focus(); return status("Skriv frågan först.", true); }
        const x = u(), plats = (document.getElementById("foNyPlats") || {}).value;
        const mott = x.mott.map(foPartFran).filter(Boolean), ber = x.berorda.map(foPartFran).filter(Boolean);
        const f = foGor("nyFraga", { id: foId(), text: text, stallare: document.getElementById("foNyStallare").value || undefined, fran: document.getElementById("foNyFran").value,
            mottagare: mott, berorda: ber.filter(b => b.disc).map(b => b.disc), berordaP: ber.filter(b => b.person).map(b => b.person),
            indelning: plats ? [plats] : [], svarSenast: document.getElementById("foNySenast").value, moten: x.moten.filter(id => foForum(foP, id)), konsekvens: x.kons.filter(k => k !== "bradskande"), bradskande: x.kons.includes("bradskande"),
            bilagor: foNyBilagor.map(b => Object.assign({ del: "fraga" }, b)) }, true);
        if (!f) return;
        foNyBilagor = [];
        // Behåll vanliga val till nästa fråga, men inte texten, mottagarna eller markeringarna.
        foSkrivLs(FO_UTKAST + foPid, { fler: x.fler, fran: x.fran, moten: [], plats: "" });
        foRita();
        status("Fråga " + f.nr + " registrerad" + (foMottagare(f).length ? " och skickad till " + foMottagareText(foP, f) : "") + ".");
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
    const rader = lista.map(f => '<tr><td>' + f.nr + '</td><td>' + esc(f.text).replace(/\n/g, "<br>") + '<div class="m">' + esc(foPersonNamn(p, foStallarePerson(f)) || "–") + (f.fran ? " (" + esc(foDiscText(p, f.fran)) + ")" : "") + ' → ' + esc(foMottagareText(p, f) || "–") +
        (f.svarSenast ? " · svar senast " + f.svarSenast + " (v. " + foVecka(f.svarSenast) + ")" : "") + '</div></td><td>' + (foSvarText(f) ? esc(foSvarText(f)).replace(/\n/g, "<br>") : foHarSvar(f) ? '<i>' + foSvarPoster(f).length + ' svar, slutligt svar inte valt</i>' : "–") + '</td><td>' + (f.makulerad ? "Makulerad" : FO_LAGE[f.lage].namn) + '</td></tr>').join("");
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
    const p = foP, jag = foJagId(), idag = foIdag(), allaF = p.forum.filter(f => f.aktiv);
    const kanLeda = foKanLeda(p, jag), kan = foKanSkriva(p, jag);
    if (!allaF.length) {
        yta.innerHTML = foTopp("Möten & protokoll") + foTomt("Ingen mötesstruktur ännu",
            "Skapa projektets egna mappar och mötesforum, till exempel Projekteringsmöten, Teknikmöten och Övriga möten. Frågor kan sedan markeras för ett eller flera forum.",
            kanLeda ? '<button type="button" class="p4-btn p4-btn-primar" id="foNyttForum">Skapa mapp eller mötesforum</button>' : "");
        const b = document.getElementById("foNyttForum"); if (b) b.addEventListener("click", () => foForumDialog(null));
        return;
    }
    if (!allaF.some(f => f.id === foFlik.mote)) foFlik.mote = (foForumValbara(p)[0] || allaF[0]).id;
    const fo = foForum(p, foFlik.mote), valbar = fo.valbar !== false;
    // mappträdet
    const barn = id => allaF.filter(x => x.forelder === id).sort((a, c) => a.namn.localeCompare(c.namn, "sv"));
    const rot = allaF.filter(x => !x.forelder || !allaF.some(y => y.id === x.forelder)).sort((a, c) => a.namn.localeCompare(c.namn, "sv"));
    const nod = (x, d) => '<li><button type="button" class="fo-mapp' + (x.id === fo.id ? " vald" : "") + '" data-forumflik="' + x.id + '" style="padding-left:' + (8 + d * 14) + 'px">' +
        '<span class="fo-mappik" aria-hidden="true">' + (x.valbar !== false ? "◆" : "▸") + '</span>' + esc(x.namn) +
        (x.valbar !== false ? ' <span class="antal">' + p.fragor.filter(f => !f.makulerad && f.moten.includes(x.id)).length + '</span>' : "") + '</button>' +
        (barn(x.id).length ? '<ul>' + barn(x.id).map(y => nod(y, d + 1)).join("") + '</ul>' : "") + '</li>';
    let html = foTopp("Möten & protokoll", (valbar ? '<button class="navknapp" type="button" id="foStorskarm" title="Mötesvy för skärmdelning eller storbildsskärm">Mötesvy</button>' +
        '<button class="navknapp" type="button" id="foForumLank" title="Permanent länk till forumets frågelista, till exempel under Tekniska frågor i protokollet">Kopiera länk</button>' : "") +
        (kanLeda ? '<button class="navknapp" type="button" id="foForumAndra">Ändra</button>' : ""));
    // bevakning (projekteringsledarens översikt)
    const bev = allaF.map(x => ({ x, b: foBevakning(p, x, idag) })).filter(y => y.b);
    if (kanLeda && bev.length) html += '<div class="dashblock fo-bevakning"><h3>Protokollbevakning</h3><table class="lista fo-tabell"><thead><tr><th>Forum</th><th>Intervall</th><th>Senaste protokoll</th><th>Protokollansvarig</th><th>Läge</th></tr></thead><tbody>' +
        bev.map(({ x, b }) => '<tr><td>' + esc(x.namn) + '</td><td>' + x.bevakning.dagar + ' dagar</td><td>' + esc(b.senast || "–") + '</td><td>' + esc(foPersonNamn(p, x.bevakning.ansvarig) || "–") + '</td>' +
            '<td><span class="fo-lage ' + (b.lage === "ok" ? "klar" : b.lage === "pausad" ? "mak" : "ofullstandig") + '"><i></i>' + esc(b.text) + '</span></td></tr>').join("") + '</tbody></table></div>';
    html += '<div class="fo-motesyta"><nav class="fo-mapptrad" aria-label="Mötesstruktur"><ul>' + rot.map(x => nod(x, 0)).join("") + '</ul>' +
        (kanLeda ? '<button type="button" class="p4d-lank" id="foNyMapp">+ Ny mapp eller forum</button>' : "") + '</nav><div class="fo-motesinnehall">';
    html += '<h2 class="fo-mapprub">' + esc(foForumSokvag(p, fo)) + '</h2>';
    if (valbar) {
        const ordning = f => (foOkvitterade(f).length ? 0 : f.lage === "ofullstandig" ? 1 : f.lage === "obesvarad" ? 2 : f.lage === "besvarad" ? 3 : 4);
        const urval = p.fragor.filter(f => !f.makulerad && f.moten.includes(fo.id)).sort((a, b) => ordning(a) - ordning(b) || a.nr - b.nr);
        const aktiva = p.fragor.filter(foAktiv);
        const deltDisc = new Set();
        (fo.deltagare || []).forEach(pid => foPersonDisc(p, pid).forEach(d => deltDisc.add(d)));
        const forslag = aktiva.filter(f => !f.moten.includes(fo.id) && (foOkvitterade(f).length || f.lage === "ofullstandig" || foForsenad(f)) &&
            (!deltDisc.size || deltDisc.has(f.fran) || foMottagare(f).some(m => deltDisc.has(m.disc) || foPersonDisc(p, m.person).some(d => deltDisc.has(d)))));
        const behandlade = p.fragor.filter(f => f.behandlad[fo.id]).sort((a, b) => b.behandlad[fo.id].localeCompare(a.behandlad[fo.id])).slice(0, 12);
        const motesDag = fo.nastaMote && fo.nastaMote <= idag ? fo.nastaMote : idag;
        html += '<div class="dashblock fo-motesinfo"><div class="fo-motesrad"><div><span class="fo-etikett">Nästa möte</span>' +
            (kanLeda ? '<input class="f" type="date" id="foNastaMote" value="' + esc(fo.nastaMote || "") + '">' : '<b>' + (fo.nastaMote ? foDatumKort(fo.nastaMote) : "Inget datum") + '</b>') + '</div>' +
            '<div><span class="fo-etikett">Tid och plats</span><b>' + esc([fo.tid ? "kl " + fo.tid : "", fo.plats].filter(Boolean).join(" · ") || "–") + '</b></div>' +
            '<div><span class="fo-etikett">Mötesledare</span><b>' + esc(foPersonNamn(p, fo.ledare) || "–") + '</b></div>' +
            '<div><span class="fo-etikett">Protokollförare</span><b>' + esc(foPersonNamn(p, fo.sekreterare) || "–") + '</b></div></div></div>';
        html += '<h3 class="fo-blockrub">Tekniska frågor <span class="antal">' + urval.length + '</span>' +
            (kanLeda ? ' <button type="button" class="mknapp fo-hoger" id="foArkMote" title="Lås en ögonblicksbild av frågorna som behandlades på mötet">Arkivera mötets tekniska frågor</button>' : "") + '</h3>';
        html += urval.length ? foMotesTabell(urval, fo, kan, true) : foTomt("Inga frågor markerade för " + fo.namn,
            "Markera en fråga med <b>+ Möte</b> i frågelistan. Även besvarade och klara frågor kan tas upp. Frågor som inte markeras som behandlade följer med till nästa möte.");
        if (forslag.length) html += '<h3 class="fo-blockrub">Förslag <span class="antal">' + forslag.length + '</span></h3><p class="hjalp fo-ingress">Frågor med okvitterad revision, ofullständigt eller försenat svar.</p>' +
            foMotesTabell(forslag, fo, kan, false);
        if (behandlade.length) html += '<h3 class="fo-blockrub">Senast behandlade</h3><ul class="atglista fo-aglista">' + behandlade.map(f =>
            '<li data-fraga="' + f.id + '"><span class="fo-agnr">' + f.nr + '</span><span class="fo-agtext">' + esc(f.text) + '<small>Behandlad ' + foDatumKort(f.behandlad[fo.id]) + '</small></span>' + foLageChip(f) + '</li>').join("") + '</ul>';
        foMotesDag = motesDag;
    }
    // protokoll i mappen och dess undermappar
    const iMapp = new Set([fo.id]); let andrat = true;
    while (andrat) { andrat = false; allaF.forEach(x => { if (x.forelder && iMapp.has(x.forelder) && !iMapp.has(x.id)) { iMapp.add(x.id); andrat = true; } }); }
    const prot = (p.protokoll || []).filter(x => !x.makulerad && iMapp.has(x.forum)).sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));
    html += '<h3 class="fo-blockrub">Protokoll <span class="antal">' + prot.length + '</span>' + (kan ? ' <button type="button" class="mknapp fo-hoger" id="foNyttProt">Registrera protokoll</button>' : "") + '</h3>';
    html += prot.length ? '<div class="fo-tabellram"><table class="lista fo-tabell"><thead><tr><th>Möte</th><th>Datum</th><th>Forum</th><th>Status</th><th>Protokoll</th><th>Tekniska frågor</th><th class="fo-snabbkol"></th></tr></thead><tbody>' +
        prot.map(x => { const r = x.sammanstallning ? p.rapporter.find(y => y.id === x.sammanstallning) : null;
            return '<tr><td><b>' + esc(x.nr || "–") + '</b>' + (x.extra ? ' <span class="fo-chip">Extra</span>' : "") + (x.version > 1 ? '<small>Version ' + x.version + '</small>' : "") + '</td><td class="dat">' + esc(x.datum || "–") + '</td>' +
                '<td>' + esc((foForum(p, x.forum) || {}).namn || "–") + '</td><td>' + (x.status === "utkast" ? "Utkast" : "Slutligt") + '</td>' +
                '<td>' + (x.lank && /^https?:\/\//i.test(x.lank) ? '<a href="' + esc(x.lank) + '" target="_blank" rel="noopener">Öppna</a>' : esc(x.lank || "–")) + '</td>' +
                '<td>' + (r ? '<button type="button" class="p4d-lank" data-visarap="' + r.id + '">' + esc(r.nr) + '</button>' : "–") + '</td>' +
                '<td class="fo-snabbkol">' + (kan ? '<button type="button" class="fo-minknapp" data-prot="' + x.id + '">Ändra</button>' : "") + '</td></tr>'; }).join("") + '</tbody></table></div>'
        : '<p class="hjalp">Inga protokoll registrerade här. Protokollfilen ligger kvar där ni har den i dag (Teams, SharePoint …). Registrera mötesnummer, datum och länk så hamnar protokollet i Formas översikt och bevakning.</p>';
    html += '</div></div>';
    yta.innerHTML = html;
    yta.querySelectorAll("[data-forumflik]").forEach(b => b.addEventListener("click", () => { foFlik.mote = b.dataset.forumflik; foSattAdress(true); foRita(); }));
    const nm = document.getElementById("foNastaMote");
    if (nm) nm.addEventListener("change", () => { foGor("sparaForum", Object.assign({}, fo, { nastaMote: nm.value }), true); foVisaSparat(nm); foRitaNav(); });
    const fa = document.getElementById("foForumAndra"); if (fa) fa.addEventListener("click", () => foForumDialog(fo));
    const nmapp = document.getElementById("foNyMapp"); if (nmapp) nmapp.addEventListener("click", () => foForumDialog(null, fo.id));
    const ss = document.getElementById("foStorskarm"); if (ss) ss.addEventListener("click", () => foStorskarm(fo));
    const lk = document.getElementById("foForumLank"); if (lk) lk.addEventListener("click", () => {
        const l = location.origin + location.pathname + "#forma/p:" + foPid + "/moten/m:" + fo.id;
        navigator.clipboard.writeText(l).then(() => status("Länken till " + fo.namn + " är kopierad. Den leder alltid till den aktuella frågelistan.")).catch(() => modal("Länk", fo.namn, '<input class="f" readonly value="' + esc(l) + '">', [{ txt: "Stäng", fn: stangModal }]));
    });
    const ark = document.getElementById("foArkMote"); if (ark) ark.addEventListener("click", () => foArkiveraMote(fo));
    const np = document.getElementById("foNyttProt"); if (np) np.addEventListener("click", () => foProtokollDialog(null, fo));
    yta.querySelectorAll("[data-prot]").forEach(b => b.addEventListener("click", () => foProtokollDialog((p.protokoll || []).find(x => x.id === b.dataset.prot), fo)));
    yta.querySelectorAll("[data-visarap]").forEach(b => b.addEventListener("click", () => { const r = p.rapporter.find(x => x.id === b.dataset.visarap); if (r && typeof foRapVisa === "function") foRapVisa(r, kanLeda); }));
    yta.querySelectorAll("li[data-fraga], tr[data-fraga]").forEach(el => el.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        foFragaOppen = el.dataset.fraga; foSattAdress(); foRita();
    }));
    yta.querySelectorAll("[data-behandlad]").forEach(b => b.addEventListener("click", () => {
        const f = foFraga(p, b.dataset.behandlad);
        if (foGor("behandlad", { id: f.id, forum: fo.id, datum: foMotesDag }))
            status("Fråga " + f.nr + " markerad som behandlad på " + fo.namn + ". Behandlad betyder inte att frågan är klar.");
    }));
    yta.querySelectorAll("[data-tillurval]").forEach(b => b.addEventListener("click", () => foGor("motesmarkering", { id: b.dataset.tillurval, forum: fo.id, pa: true })));
    yta.querySelectorAll("[data-ururval]").forEach(b => b.addEventListener("click", () => foGor("motesmarkering", { id: b.dataset.ururval, forum: fo.id, pa: false })));
}
let foMotesDag = "";
// Lås en ögonblicksbild av de frågor som behandlades på mötet (återanvänder rapportarkivet).
function foArkiveraMote(fo) {
    const p = foP, datum = foMotesDag || foIdag();
    const datumLista = [...new Set(p.fragor.filter(f => f.behandlad && f.behandlad[fo.id]).map(f => f.behandlad[fo.id]))].sort().reverse();
    const senast = (p.protokoll || []).filter(x => x.forum === fo.id && !x.makulerad).sort((a, b) => (b.datum || "").localeCompare(a.datum || ""))[0];
    const nrForslag = senast && /\d+/.test(senast.nr) ? senast.nr.replace(/\d+/, n => +n + (senast.datum === datum ? 0 : 1)) : "";
    modal("Arkivera mötets tekniska frågor", fo.namn,
        '<p class="hjalp" style="margin-top:0">Sammanställningen innehåller frågorna som markerats som behandlade på mötesdatumet, med svar, status och beslut. Den låses och ändras aldrig, även om frågorna ändras senare.</p>' +
        '<div class="tva"><div class="falt"><label for="foAmNr">Mötesnummer</label><input class="f" id="foAmNr" value="' + esc(nrForslag) + '" placeholder="15"></div>' +
        '<div class="falt"><label for="foAmDat">Mötesdatum</label><input class="f" type="date" id="foAmDat" value="' + esc(datumLista.includes(datum) ? datum : datumLista[0] || datum) + '"></div></div>' +
        '<p class="hjalp" id="foAmAntal"></p>', [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Förhandsgranska", fn: () => { const v = varden(); foRapOppnaFonster(foRapHtml(p, v, null), false); } },
        { txt: "Fortsätt", primar: true, fn: () => { const v = varden(); stangModal(); foRapVal = v; foRapNyVersion = ""; foRapLasDialog(); } }]);
    const varden = () => ({ typ: "mote", forum: fo.id, datum: document.getElementById("foAmDat").value, motesnr: document.getElementById("foAmNr").value.trim() });
    const antal = () => { const v = varden(); document.getElementById("foAmAntal").textContent = p.fragor.filter(f => !f.makulerad && f.behandlad && f.behandlad[fo.id] === v.datum).length + " frågor behandlades detta datum."; };
    document.getElementById("foAmDat").addEventListener("change", antal); antal();
}
// Protokoll: registreras med nummer, datum och länk. Inga obligatoriska fält utöver nummer eller datum.
function foProtokollDialog(x, fo) {
    const p = foP, ny = !x;
    const valbara = p.forum.filter(f => f.aktiv).sort((a, b) => foForumSokvag(p, a).localeCompare(foForumSokvag(p, b), "sv"));
    const forum = x ? x.forum : fo.id;
    modal(ny ? "Registrera protokoll" : "Protokoll " + (x.nr || x.datum), "Filen ligger kvar där ni har den. Forma håller ordning, bevakning och avisering.",
        '<div class="falt"><label for="foPrFo">Mötesforum / mapp</label><select class="f" id="foPrFo">' + valbara.map(f => '<option value="' + f.id + '"' + (f.id === forum ? " selected" : "") + '>' + esc(foForumSokvag(p, f)) + '</option>').join("") + '</select></div>' +
        '<div class="tva"><div class="falt"><label for="foPrNr">Mötesnummer</label><input class="f" id="foPrNr" value="' + esc(x ? x.nr : "") + '" placeholder="PM15"></div>' +
        '<div class="falt"><label for="foPrDat">Mötesdatum</label><input class="f" type="date" id="foPrDat" value="' + esc(x ? x.datum : foMotesDag || foIdag()) + '"></div></div>' +
        '<div class="falt"><label for="foPrLank">Länk till protokollet <span class="hjalp">(Teams, SharePoint …)</span></label><input class="f" id="foPrLank" value="' + esc(x ? x.lank : "") + '" placeholder="https://"></div>' +
        '<div class="tva"><div class="falt"><label for="foPrSt">Status</label><select class="f" id="foPrSt"><option value="slutligt">Slutligt</option><option value="utkast"' + (x && x.status === "utkast" ? " selected" : "") + '>Utkast</option></select></div>' +
        '<div class="falt"><label for="foPrForare">Protokollförare</label>' + foPersonSelect("foPrForare", x ? x.forare : (fo && fo.sekreterare) || foJagId(), "–") + '</div></div>' +
        '<label class="fo-kryss"><input type="checkbox" id="foPrExtra"' + (x && x.extra ? " checked" : "") + '> Extra möte (påverkar inte bevakningen)</label>' +
        '<label class="fo-kryss"><input type="checkbox" id="foPrDirekt"> Viktigt – avisera projektgruppen direkt i stället för i dagens sammanställning</label>', [
        ...(x && foKanLeda(p, foJagId()) ? [{ txt: "Ta bort", vanster: true, fara: true, fn: () => { stangModal(); foFragaOrsak("Ta bort protokoll", "Protokollet döljs men finns kvar i historiken.", "Ta bort", o => foGor("taBortProtokoll", { id: x.id, orsak: o })); } }] : []),
        { txt: "Avbryt", fn: stangModal },
        { txt: ny ? "Registrera" : "Spara", primar: true, fn: () => {
            const v = id => document.getElementById(id).value;
            const fid = v("foPrFo"), dat = v("foPrDat");
            const rap = p.rapporter.find(r => r.typ === "mote" && r.urval && r.urval.forum === fid && r.urval.datum === dat && !r.ersattAv);
            const r = foGor("registreraProtokoll", { id: x ? x.id : foId(), forum: fid, nr: v("foPrNr"), datum: dat, lank: v("foPrLank"), status: v("foPrSt"), forare: v("foPrForare"),
                extra: document.getElementById("foPrExtra").checked, direkt: document.getElementById("foPrDirekt").checked, sammanstallning: x && x.sammanstallning ? x.sammanstallning : rap ? rap.id : "" });
            if (r) { stangModal(); status(ny ? "Protokollet är registrerat. Projektgruppen informeras." : "Protokollet är ändrat."); }
        } }]);
}
function foMotesTabell(lista, fo, kan, iUrval) {
    const p = foP;
    return '<div class="fo-tabellram"><table class="lista fo-tabell fo-motestabell"><thead><tr><th class="fo-nrkol">Nr</th><th>Fråga</th><th>Från → Ansvarig</th><th>Läge</th><th class="fo-snabbkol"><span class="sr">Åtgärd</span></th></tr></thead><tbody>' +
        lista.map(f => {
            const ok = foOkvitterade(f);
            return '<tr data-fraga="' + f.id + '" data-rad="' + f.id + '" class="' + (ok.length ? "okvitt" : "") + '"><td class="fo-nrkol"><b>' + f.nr + '</b>' +
                (ok.length ? '<span class="fo-revmark">' + foRevNamn(ok[ok.length - 1].nr) + '</span>' : "") + '</td>' +
                '<td class="fo-fragekol"><span class="fo-fragetext">' + esc(f.text) + '</span>' + (foHarSvar(f) ? '<small>' + (foSvarText(f) ? "Svar: " : "Senaste svar (ej slutligt): ") + esc((foSvarText(f) || foSenasteSvar(f).text).slice(0, 160)) + ((foSvarText(f) || foSenasteSvar(f).text).length > 160 ? "…" : "") + '</small>' : "") + '</td>' +
                '<td class="fo-partkol"><b>' + esc(foPersonNamn(p, foStallarePerson(f)) || foDiscText(p, f.fran) || "–") + '</b> <span class="fo-pil" aria-hidden="true">→</span> <b>' + esc(foMottagareText(p, f) || "–") + '</b></td>' +
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
    const lista = p.fragor.filter(f => !f.makulerad && f.moten.includes(fo.id)).sort((a, b) => ordning(a) - ordning(b) || a.nr - b.nr);
    const jag = foJagId(), kan = foKanSkriva(foP, jag), leda = foKanLeda(foP, jag) || foSuper(foP, jag), datum = foMotesDag || foIdag();
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
                '<div class="fo-ss-fraga">' + esc(f.text) + '</div><div class="fo-ss-meta">' + esc(foPersonNamn(p, foStallarePerson(f)) || foDiscText(p, f.fran) || "–") + ' → ' + esc(foMottagareText(p, f) || "–") + '</div>' +
                '<div class="fo-ss-svar"><span>Svar</span>' + (foSvarText(f) ? esc(foSvarText(f)) : foHarSvar(f) ? esc(foSenasteSvar(f).text) + ' <i>(inte valt som slutligt)</i>' : '<i>Inget svar ännu</i>') + '</div>' +
                (f.bilagor.length ? '<div class="fo-ss-bil">' + foBilagorHtml(f.bilagor) + '</div>' : "") +
                (f.behandlad[fo.id] ? '<div class="fo-ss-meta">Behandlad ' + esc(f.behandlad[fo.id]) + '</div>' : "") +
                (kan ? '<div class="fo-ss-verktyg"><textarea class="f" id="foSsSvar" rows="2" placeholder="Registrera svar eller besked från mötet … (registreras i ditt namn, som lämnat på ' + esc(fo.namn) + ' ' + esc(datum) + ')"></textarea>' +
                    '<div class="fo-ss-knappar"><button type="button" data-ss="svar">Spara svar</button><button type="button" data-ss="behandlad">' + (f.behandlad[fo.id] === datum ? "✓ Behandlad" : "Markera behandlad") + '</button>' +
                    '<button type="button" data-ss="atgard">Åtgärd …</button>' + (leda ? '<button type="button" data-ss="beslut">Fastställ beslut …</button>' : "") + '</div></div>' : "") + '</div>' +
                '<div class="fo-ss-lista">' + lista.map((x, j) => '<button type="button" data-j="' + j + '" class="' + (j === i ? "vald" : "") + '"><b>' + x.nr + '</b>' + esc(x.text) + '</button>').join("") + '</div>'
                : '<div class="fo-ss-kropp"><div class="fo-ss-fraga">Inga frågor är markerade för ' + esc(fo.namn) + '.</div></div>') +
            '<div class="fo-ss-fot">← → bläddra · Esc stäng</div>';
        v.querySelector("[data-stang]").addEventListener("click", stang);
        v.querySelectorAll("[data-j]").forEach(b => b.addEventListener("click", () => { i = +b.dataset.j; rita(); }));
        if (f && typeof foKopplaBilagor === "function") { const bl = v.querySelector(".fo-ss-bil"); if (bl) foKopplaBilagor(bl, f.bilagor); }
        v.querySelectorAll("[data-ss]").forEach(b => b.addEventListener("click", () => {
            const vad = b.dataset.ss;
            if (vad === "svar") {
                const t = document.getElementById("foSsSvar");
                if (!t.value.trim()) return status("Skriv svaret först.", true);
                if (foGor("dialogPost", { id: f.id, post: foId(), typ: "svar", text: t.value.trim(), mote: { forum: fo.id, datum: datum } }, true)) { status("Svaret är registrerat i ditt namn, lämnat på " + fo.namn + "."); rita(); }
            }
            if (vad === "behandlad" && f.behandlad[fo.id] !== datum) {
                // markera utan att ta bort frågan ur mötesvyn medan mötet pågår
                if (foGor("behandlad", { id: f.id, forum: fo.id, datum: datum }, true)) { status("Fråga " + f.nr + " behandlad."); rita(); }
            }
            if (vad === "atgard" || vad === "beslut") {
                stang();
                foFragaOppen = f.id; foSattAdress(); foRita();
                setTimeout(() => vad === "atgard" ? foAtgardDialog(null, { typ: "fraga", id: f.id }) : foBeslutDialog(f, null), 60);
            }
        }));
    };
    const tangent = (e) => {
        if (e.target && e.target.id === "foSsSvar" && e.key !== "Escape") return;
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

/* ======================= Åtgärder =======================
   En åtgärd – flera vyer: projektets lista, disciplinens, mina, att följa upp och källfrågan.
   Status: oppen → (kontroll) → klar. Försening räknas fram ur Klar senast. */
let foPrivat = null, foPrivatLaddar = false;
function foPrivatLadda() {
    if (foPrivat !== null || foPrivatLaddar) return;
    if (!foMoln()) { foPrivat = foLasLs("wimo_forma_privat", []); return; }
    foPrivatLaddar = true;
    window.p4FormaMoln.privatHamta().then(l => { foPrivat = l; }).catch(e => { console.warn(e); foPrivat = []; })
        .finally(() => { foPrivatLaddar = false; if (foModulAktiv()) foRita(); });
}
async function foPrivatSpara() {
    if (!foMoln()) return foSkrivLs("wimo_forma_privat", foPrivat);
    try { await window.p4FormaMoln.privatSpara(foPrivat); } catch (e) { status("Den privata uppgiften kunde inte sparas.", true); }
}
// Grafisk uppföljning per disciplin: grön utförd, gul inom tid, grå utan datum, röd försenad. Varje del är klickbar.
function foAtgStaplar(p, idag) {
    const disc = p.discipliner.filter(d => d.aktiv).sort((a, b) => a.ordning - b.ordning);
    const rader = disc.map(d => ({ id: d.id, namn: d.kod + " " + d.namn, chip: foDiscChip(p, d.id, true), l: p.atgarder.filter(a => a.status !== "makulerad" && foAtgardDisc(p, a) === d.id) }))
        .concat([{ id: "-", namn: "Utan disciplin", l: p.atgarder.filter(a => a.status !== "makulerad" && !foAtgardDisc(p, a)) }]).filter(r => r.l.length);
    if (!rader.length) return "";
    const del = (a) => a.status === "klar" ? "klar" : a.senast && a.senast < idag ? "sen" : a.senast ? "inom" : "utan";
    const alla = p.atgarder.filter(a => a.status !== "makulerad");
    const n = (l, k) => l.filter(a => del(a) === k).length;
    const txt = { klar: "utförda", inom: "inom tid", utan: "utan datum", sen: "försenade" };
    return '<div class="dashblock fo-atgstaplar"><h3>Åtgärder per disciplin <span class="hjalp">' + alla.length + " totalt · " + n(alla, "klar") + " utförda · " +
        (alla.length - n(alla, "klar")) + " kvarstående · " + n(alla, "sen") + " försenade</span></h3>" +
        rader.map(r => '<div class="fo-stapelrad"><span class="fo-stapelnamn">' + (r.chip || esc(r.namn)) + '</span><div class="fo-stapel" role="group" aria-label="' + esc(r.namn) + '">' +
            ["klar", "inom", "utan", "sen"].filter(k => n(r.l, k)).map(k => '<button type="button" class="fo-stapeldel s-' + k + '" style="flex:' + n(r.l, k) + '" data-stapel="' + r.id + ":" + k + '" title="' +
                n(r.l, k) + " " + txt[k] + '">' + n(r.l, k) + '</button>').join("") + '</div><span class="fo-stapeltext">' + ["klar", "inom", "utan", "sen"].filter(k => n(r.l, k)).map(k => n(r.l, k) + " " + txt[k]).join(", ") + "</span></div>").join("") + "</div>";
}
function foVyAtgarder(yta) {
    const p = foP, jag = foJagId(), idag = foIdag(), kan = foKanSkriva(p, jag), minaDisc = foPersonDisc(p, jag);
    foPrivatLadda();
    const oppen = a => a.status === "oppen" || a.status === "kontroll";
    const urval = {
        mina: a => oppen(a) && foArPart(p, jag, a.ansvarig),
        disc: a => oppen(a) && minaDisc.includes(foAtgardDisc(p, a)),
        folj: a => oppen(a) && a.uppfoljare === jag && !foArPart(p, jag, a.ansvarig),
        oppna: oppen,
        forsenade: a => oppen(a) && a.senast && a.senast < idag,
        klara: a => a.status === "klar",
        avbrutna: a => a.status === "makulerad",
        alla: a => a.status !== "makulerad"
    };
    const namn = { mina: "Mina", disc: "Min disciplin", folj: "Att följa upp", oppna: "Alla öppna", forsenade: "Försenade", klara: "Utförda", avbrutna: "Avbrutna", alla: "Alla", privata: "Privata" };
    // klick i stapeln: disc-id:del
    let stapel = null;
    if (String(foFlik.atg || "").startsWith("st:")) { const [, d, k] = foFlik.atg.split(":"); stapel = { d, k }; }
    if (!stapel && !urval[foFlik.atg] && foFlik.atg !== "privata") foFlik.atg = "mina";
    if (foFlik.atg === "mina" && !p.atgarder.some(urval.mina) && p.atgarder.some(urval.oppna)) foFlik.atg = "oppna";
    const iStapel = a => a.status !== "makulerad" && (stapel.d === "-" ? !foAtgardDisc(p, a) : foAtgardDisc(p, a) === stapel.d) &&
        (stapel.k === "klar" ? a.status === "klar" : a.status !== "klar" && (stapel.k === "sen" ? a.senast && a.senast < idag : stapel.k === "inom" ? a.senast && a.senast >= idag : !a.senast));
    const filt = stapel ? iStapel : urval[foFlik.atg] || (() => false);
    const lista = p.atgarder.filter(filt).sort((a, b) => (oppen(a) ? 0 : 1) - (oppen(b) ? 0 : 1) || (a.senast || "9999").localeCompare(b.senast || "9999") || a.nr - b.nr);
    let html = foTopp("Åtgärder", '<button class="navknapp" type="button" id="foAtgExport">Exportera</button>');
    if (kan || foFlik.atg === "privata") html += '<div class="fo-nyfraga fo-nyatg"><input class="f" id="foAtgText" placeholder="' + (foFlik.atg === "privata" ? "Ny privat uppgift … syns bara för dig" : "Ny åtgärd … till exempel Revidera planritning plan 2") + '" data-behall>' +
        '<div class="fo-nyrad">' + (foFlik.atg === "privata" ? "" : '<label class="fo-litefalt fo-bred"><span>Ansvarig</span>' + foPartSelect("foAtgAnsv", null, "Välj ansvarig …") + '</label>') +
        '<label class="fo-litefalt"><span>Klar senast</span><input class="f" type="date" id="foAtgSenast"></label>' +
        '<button type="button" class="p4-btn p4-btn-primar" id="foAtgLagg">' + (foFlik.atg === "privata" ? "Lägg till" : "Lägg till åtgärd") + '</button></div></div>';
    html += foAtgStaplar(p, idag);
    html += '<div class="fo-snabbrad">' + Object.keys(namn).filter(k => k !== "disc" || minaDisc.length).map(k => '<button type="button" class="fo-snabb' + (foFlik.atg === k ? " vald" : "") + '" data-atgflik="' + k + '" aria-pressed="' + (foFlik.atg === k) + '">' +
        namn[k] + ' <span>' + (k === "privata" ? (foPrivat || []).filter(x => !x.klar).length : p.atgarder.filter(urval[k]).length) + '</span></button>').join("") +
        (stapel ? '<button type="button" class="fo-snabb vald" data-atgflik="oppna">' + esc(stapel.d === "-" ? "Utan disciplin" : foDiscText(p, stapel.d)) + " · " + { klar: "utförda", inom: "inom tid", utan: "utan datum", sen: "försenade" }[stapel.k] + ' ✕</button>' : "") + '</div>';
    if (foFlik.atg === "privata") {
        const l = (foPrivat || []).slice().sort((a, b) => (a.klar - b.klar) || (a.senast || "9999").localeCompare(b.senast || "9999"));
        html += foPrivat === null ? '<p class="hjalp">Hämtar …</p>' : l.length ? '<div class="fo-tabellram"><table class="lista fo-tabell"><thead><tr><th>Uppgift</th><th>Projekt</th><th>Klar senast</th><th>Status</th><th class="fo-snabbkol"></th></tr></thead><tbody>' +
            l.map(x => '<tr class="' + (x.klar ? "utford" : "") + '"><td>' + esc(x.text) + '</td><td>' + esc((foAllaProjekt().find(y => y.id === x.pid) || {}).namn || "–") + '</td><td class="dat">' + (x.senast ? foDatumVecka(x.senast) : "–") +
                (!x.klar && x.senast && x.senast < idag ? ' <span class="fo-tagg t-sen">Försenad</span>' : "") + '</td><td><button type="button" class="fstat ' + (x.klar ? "klar" : "ej") + '" data-privstat="' + x.id + '">' + (x.klar ? "✓ Klar" : "Öppen") + '</button></td>' +
                '<td class="fo-snabbkol"><button type="button" class="fo-minknapp" data-privbort="' + x.id + '">Ta bort</button></td></tr>').join("") + '</tbody></table></div>'
            : foTomt("Inga privata uppgifter", "Privata uppgifter syns bara för dig, i alla dina projekt. De ingår inte i projektets listor, rapporter eller export.");
    } else html += lista.length ? '<div class="fo-tabellram"><table class="lista fo-tabell fo-atgtabell"><thead><tr><th class="fo-nrkol">Nr</th><th>Åtgärd</th><th>Ansvarig</th><th>Disciplin</th><th>Klar senast</th><th>Status</th><th>Följs upp av</th><th class="fo-snabbkol"><span class="sr">Mer</span></th></tr></thead><tbody>' +
        lista.map(a => {
            const sen = oppen(a) && a.senast && a.senast < idag;
            const kalla = (a.kopplingar || []).filter(k => k.typ !== "atgard").map(k => '<button type="button" class="p4d-lank" data-kalla="' + k.typ + ':' + k.id + '">' + esc(foObjNamn(p, k)) + '</button>').join(", ");
            const kanKlar = kan && (a.status !== "kontroll" || a.uppfoljare === jag || foKanLeda(p, jag));
            const st = a.status === "makulerad" ? '<span class="fo-lage mak"><i></i>Avbruten</span>' :
                '<button type="button" class="fstat ' + (a.status === "klar" ? "klar" : "ej") + '" data-atgstat="' + a.id + '"' + (kanKlar ? "" : " disabled") + ' title="' +
                (a.status === "klar" ? "Öppna igen" : a.status === "kontroll" ? "Godkänn och avsluta" : "Markera som utförd") + '">' + (a.status === "klar" ? "✓ Utförd" : a.status === "kontroll" ? "Väntar på kontroll" : "Öppen") + '</button>';
            return '<tr data-rad="' + a.id + '" class="' + (!oppen(a) ? "utford" : "") + (sen ? " fo-sen" : "") + '"><td class="fo-nrkol"><b>Å-' + a.nr + '</b></td>' +
                '<td><span class="fo-fragetext">' + esc(a.text) + '</span>' + (kalla ? '<small>Från ' + kalla + '</small>' : "") +
                (foAtgardInaktuell(p, a) ? '<small class="fo-varntext">Beskedet i källfrågan har reviderats sedan åtgärden skapades. Bedöm om åtgärden behöver ändras.</small>' : "") +
                (a.resultat && a.resultat.text ? '<small>Resultat: ' + esc(a.resultat.text) + '</small>' : "") + (a.makulerad ? '<small>Avbruten: ' + esc(a.makulerad.orsak) + '</small>' : "") + '</td>' +
                '<td>' + esc(foPartText(p, a.ansvarig) || "–") + '</td><td>' + (foDiscChip(p, foAtgardDisc(p, a)) || "–") + '</td>' +
                '<td class="dat">' + (a.senast ? foDatumVecka(a.senast) : "–") + (sen ? ' <span class="fo-tagg t-sen">Försenad</span>' : "") + '</td>' +
                '<td>' + st + (a.kontroll && a.status === "oppen" ? '<small>Kontrolleras</small>' : "") + '</td><td>' + esc(foPersonNamn(p, a.uppfoljare) || "–") + '</td>' +
                '<td class="fo-snabbkol">' + (kan ? '<button type="button" class="fo-minknapp" data-atgandra="' + a.id + '">Ändra</button>' : "") + '</td></tr>';
        }).join("") + '</tbody></table></div>'
        : foTomt(p.atgarder.length ? "Inga åtgärder här" : "Inga åtgärder ännu", p.atgarder.length ? "Välj ett annat urval ovanför." : "Skapa en åtgärd ovanför, när du svarar på en fråga eller när du klarmarkerar en fråga.");
    yta.innerHTML = html;
    yta.querySelectorAll("[data-atgflik]").forEach(b => b.addEventListener("click", () => { foFlik.atg = b.dataset.atgflik; foRita(); }));
    yta.querySelectorAll("[data-stapel]").forEach(b => b.addEventListener("click", () => { foFlik.atg = "st:" + b.dataset.stapel; foRita(); }));
    yta.querySelectorAll("[data-atgstat]").forEach(b => b.addEventListener("click", () => {
        const a = foAtgard(p, b.dataset.atgstat);
        const r = foGor("atgardStatus", { id: a.id, status: a.status === "klar" ? "oppen" : "klar" });
        if (r) { const x = foAtgard(foP, a.id); status("Åtgärd Å-" + a.nr + (x.status === "klar" ? " är utförd." : x.status === "kontroll" ? " är utförd och väntar på kontroll av " + foPersonNamn(foP, x.uppfoljare) + "." : " är öppen igen.")); }
    }));
    yta.querySelectorAll("[data-privstat]").forEach(b => b.addEventListener("click", () => { const x = foPrivat.find(y => y.id === b.dataset.privstat); x.klar = !x.klar; foPrivatSpara(); foRita(); }));
    yta.querySelectorAll("[data-privbort]").forEach(b => b.addEventListener("click", () => { foPrivat = foPrivat.filter(y => y.id !== b.dataset.privbort); foPrivatSpara(); foRita(); }));
    yta.querySelectorAll("[data-atgandra]").forEach(b => b.addEventListener("click", () => foAtgardDialog(foAtgard(p, b.dataset.atgandra))));
    yta.querySelectorAll("[data-kalla]").forEach(b => b.addEventListener("click", () => {
        const [typ, id] = b.dataset.kalla.split(":");
        if (typ === "fraga") { const f = foFraga(p, id); if (f) foGaTill(f.lage === "klar" ? "klara" : "aktiva", id); }
        if (typ === "beslut") { foGaTill("beslut"); setTimeout(() => foMarkeraRad(id), 30); }
    }));
    document.getElementById("foAtgExport").addEventListener("click", () => {
        if (foFlik.atg === "privata") return status("Privata uppgifter ingår inte i projektets export.", true);
        const rad = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
        const csv = "﻿" + ["Nr", "Åtgärd", "Ansvarig", "Disciplin", "Klar senast", "Status", "Följs upp av", "Resultat", "Källa"].map(rad).join(";") + "\r\n" + lista.map(a => ["Å-" + a.nr, a.text, foPartText(p, a.ansvarig),
            foDiscText(p, foAtgardDisc(p, a)), a.senast, a.status === "klar" ? "Utförd" : a.status === "kontroll" ? "Väntar på kontroll" : a.status === "makulerad" ? "Avbruten" : "Öppen",
            foPersonNamn(p, a.uppfoljare), a.resultat ? a.resultat.text : "", (a.kopplingar || []).map(k => foObjNamn(p, k)).join(", ")].map(rad).join(";")).join("\r\n");
        foLaddaNer(foFilnamn(p.namn) + "-atgarder-" + idag + ".csv", csv, "text/csv;charset=utf-8");
    });
    const lagg = document.getElementById("foAtgLagg");
    if (lagg) {
        const t = document.getElementById("foAtgText");
        const gor = () => {
            if (foFlik.atg === "privata") {
                if (!t.value.trim()) return status("Skriv uppgiften först.", true);
                foPrivat = (foPrivat || []).concat({ id: foId(), pid: foPid, text: t.value.trim(), senast: document.getElementById("foAtgSenast").value, klar: false, skapad: foNu() });
                foPrivatSpara(); foRita(); status("Den privata uppgiften är sparad. Den syns bara för dig.");
                return;
            }
            const a = foGor("nyAtgard", { id: foId(), text: t.value, ansvarig: foPartFran(document.getElementById("foAtgAnsv").value), senast: document.getElementById("foAtgSenast").value });
            if (a) { status("Åtgärd Å-" + a.nr + " skapad."); setTimeout(() => { foMarkeraRad(a.id); const n = document.getElementById("foAtgText"); if (n) n.focus(); }, 30); }
        };
        lagg.addEventListener("click", gor);
        t.addEventListener("keydown", (e) => { if (e.key === "Enter") gor(); });
    }
}
function foAtgardDialog(a, kalla, efter) {
    const p = foP, ny = !a, jag = foJagId();
    const pers = p.personer.filter(x => x.aktiv !== false).sort((x, y) => foPersonNamn(p, x.id).localeCompare(foPersonNamn(p, y.id), "sv"));
    const uppf = a ? a.uppfoljare : jag;
    const kropp = (kalla ? '<p class="hjalp" style="margin-top:0">Källa: ' + esc(foObjNamn(p, kalla)) + ' — ' + esc(foObjText(p, kalla).slice(0, 120)) + '</p>' : "") +
        (a && foAtgardInaktuell(p, a) ? '<div class="notis"><b>Beskedet har reviderats</b> efter att åtgärden skapades. Åtgärden återöppnas inte automatiskt. Bedöm om den behöver ändras, om en ny åtgärd behövs, eller om inget mer krävs.' +
            '<p style="margin:6px 0 0"><button type="button" class="mknapp" id="foAdRevOk">Inget ytterligare arbete krävs</button> <button type="button" class="mknapp" id="foAdRevNy">Skapa ny åtgärd</button></p></div>' : "") +
        '<div class="falt"><label for="foAdText">Vad ska göras?</label><textarea class="f" id="foAdText" rows="3">' + esc(a ? a.text : (kalla && kalla.forslag) || "") + '</textarea></div>' +
        '<div class="tva"><div class="falt"><label for="foAdAnsv">Utförs av</label>' + foPartSelect("foAdAnsv", a ? a.ansvarig : (kalla && kalla.ansvarig) || null, "Välj ansvarig …") + '</div>' +
        '<div class="falt"><label for="foAdSenast">Klar senast</label><input class="f" type="date" id="foAdSenast" value="' + esc(a ? a.senast : "") + '"></div></div>' +
        '<details class="fo-histdet"' + (a && (a.kontroll || (a.uppfoljare && a.uppfoljare !== a.av)) ? " open" : "") + '><summary>Uppföljning</summary>' +
        '<div class="falt"><label for="foAdUppf">Följs upp av</label><select class="f" id="foAdUppf"><option value="">Ingen</option>' + pers.map(x => '<option value="' + x.id + '"' + (x.id === uppf ? " selected" : "") + '>' + esc(foPersonNamn(p, x.id)) + '</option>').join("") + '</select></div>' +
        '<label class="fo-kryss"><input type="checkbox" id="foAdKontroll"' + (a && a.kontroll ? " checked" : "") + '> Resultatet ska kontrolleras av den som följer upp innan åtgärden avslutas</label></details>' +
        (a && a.status !== "makulerad" && a.status !== "klar" ? '<div class="falt"><label for="foAdRes">Resultat <span class="hjalp">(frivilligt, när den utförs)</span></label><input class="f" id="foAdRes" placeholder="Till exempel: Reviderad ritning A-40-1-201 rev C"></div>' : "") +
        (a && a.resultat ? '<p class="hjalp">Resultat: ' + esc(a.resultat.text || "–") + " · " + esc(foPersonNamn(p, a.resultat.av)) + " " + foNarText(a.resultat.tid) + '</p>' : "") +
        (a && a.hist.length ? '<details class="fo-histdet"><summary>Historik (' + a.hist.length + ')</summary><ul class="fo-hist">' + a.hist.slice().reverse().map(h =>
            '<li><span>' + foNarText(h.tid) + '</span>' + esc(h.text) + ' <small>' + esc(foPersonNamn(p, h.av)) + '</small></li>').join("") + '</ul></details>' : "");
    const knappar = [];
    if (a && a.status !== "makulerad") knappar.push({ txt: "Avbryt åtgärden", vanster: true, fara: true, fn: () => { stangModal(); foFragaOrsak("Avbryt åtgärd Å-" + a.nr, "Åtgärden döljs i listorna men finns kvar med historik och kan återställas.", "Avbryt åtgärden", o => foGor("atgardStatus", { id: a.id, status: "makulerad", orsak: o })); } });
    if (a && a.status === "makulerad") knappar.push({ txt: "Återställ", vanster: true, fn: () => { stangModal(); foGor("atgardStatus", { id: a.id, status: "oppen" }); } });
    knappar.push({ txt: "Stäng", fn: stangModal });
    if (a && (a.status === "oppen" || a.status === "kontroll")) knappar.push({ txt: a.status === "kontroll" ? "Godkänn och avsluta" : "Markera utförd", fn: () => {
        const res = (document.getElementById("foAdRes") || {}).value || "";
        if (foGor("atgardStatus", { id: a.id, status: "klar", kommentar: res })) { stangModal(); status("Åtgärd Å-" + a.nr + " är markerad som utförd."); }
    } });
    knappar.push({ txt: ny ? "Skapa åtgärd" : "Spara", primar: true, fn: () => {
        const v = { text: document.getElementById("foAdText").value, ansvarig: foPartFran(document.getElementById("foAdAnsv").value), senast: document.getElementById("foAdSenast").value,
            uppfoljare: document.getElementById("foAdUppf").value || null, kontroll: document.getElementById("foAdKontroll").checked };
        const k = kalla ? { typ: kalla.typ, id: kalla.id } : null;
        const r = ny ? foGor("nyAtgard", Object.assign({ id: foId(), kalla: k }, v)) : foGor("atgardFalt", Object.assign({ id: a.id }, v));
        if (r) { stangModal(); status(ny ? "Åtgärd Å-" + r.nr + " skapad." : "Åtgärden sparades."); if (efter) efter(r); }
    } });
    modal(ny ? "Ny åtgärd" : "Åtgärd Å-" + a.nr, a ? ({ klar: "Utförd", makulerad: "Avbruten", kontroll: "Väntar på kontroll" }[a.status] || "Öppen") + " · skapad " + foDatumKort(a.skapad) + " av " + foPersonNamn(p, a.av) : "", kropp, knappar);
    const ok = document.getElementById("foAdRevOk");
    if (ok) ok.addEventListener("click", () => { stangModal(); if (foGor("atgardFalt", { id: a.id, revOk: true })) status("Noterat: inget ytterligare arbete krävs för Å-" + a.nr + "."); });
    const nyk = document.getElementById("foAdRevNy");
    if (nyk) nyk.addEventListener("click", () => { stangModal(); foGor("atgardFalt", { id: a.id, revOk: true }, true); foAtgardDialog(null, a.kalla); });
    setTimeout(() => { const t = document.getElementById("foAdText"); if (t) t.focus(); }, 30);
}

/* ======================= Beslutslogg ======================= */
// Den selekterade beslutsloggen: frågor och svar som disciplinerna valt att lyfta fram. Levande – visar gällande besked.
let foLoggDisc = "";
function foBeskedText(f) { const s = foSlutliga(f); return (s.length ? s : [foSenasteSvar(f)].filter(Boolean)).map(x => x.text).join(" · "); }
function foVyLogg(yta) {
    const p = foP;
    const disc = p.discipliner.filter(d => d.aktiv).sort((a, b) => a.ordning - b.ordning);
    const iDisc = f => !foLoggDisc || f.fran === foLoggDisc || foMottagare(f).some(m => (m.disc === foLoggDisc) || (m.person && foPersonDisc(p, m.person).includes(foLoggDisc)));
    const l = p.fragor.filter(f => f.ilogg && !f.makulerad && iDisc(f)).sort((a, b) => a.nr - b.nr);
    let html = foTopp("Beslutslogg", '<button class="navknapp" type="button" id="foLoggExport">Exportera</button>');
    html += foBeslutFlikar(p) + '<div class="fo-filterrad"><label class="fo-litefalt"><span>Disciplin</span><select class="f" id="foLoggDisc"><option value="">Gemensam (alla)</option>' +
        disc.map(d => '<option value="' + d.id + '"' + (foLoggDisc === d.id ? " selected" : "") + '>' + esc(d.kod + " " + d.namn) + '</option>').join("") + '</select></label>' +
        '<p class="hjalp" style="margin:0">Frågor som disciplinerna valt att lyfta fram. Att en fråga ingår är inte ett formellt beslut. Alla frågor finns kvar i frågeregistret.</p></div>';
    html += l.length ? '<div class="fo-tabellram"><table class="lista fo-tabell"><thead><tr><th class="fo-nrkol">Nr</th><th>Fråga</th><th>Gällande besked</th><th>Från</th><th>Status</th></tr></thead><tbody>' +
        l.map(f => {
            const okv = foOkvittSvar(f).length, rev = (f.revs || []).filter(r => r.typ === "svar").length;
            return '<tr data-rad="' + f.id + '" data-tillfraga="' + f.id + '" tabindex="0"><td class="fo-nrkol"><b>' + f.nr + '</b></td><td><span class="fo-fragetext">' + esc(f.text) + '</span></td>' +
                '<td>' + esc(foBeskedText(f) || "–") + (rev ? ' <span class="fo-tagg t-varn">' + foRevNamn(rev) + '</span>' : "") + '</td><td>' + esc(foDiscText(p, f.fran) || foPersonNamn(p, foStallarePerson(f)) || "–") + '</td>' +
                '<td>' + (okv || (rev && f.lage !== "klar") ? '<span class="fo-lage revision">Ändrat besked – ej bedömt</span>' : foLageChip(f)) + '</td></tr>';
        }).join("") + '</tbody></table></div>'
        : foTomt("Inga frågor i beslutsloggen" + (foLoggDisc ? " för disciplinen" : ""), "Välj <b>Inkludera i beslutsloggen</b> i en fråga, eller använd kolumnen Beslutslogg i frågelistan för att gå igenom flera på en gång.");
    yta.innerHTML = html;
    foKopplaBeslutFlikar(yta);
    document.getElementById("foLoggDisc").addEventListener("change", (e) => { foLoggDisc = e.target.value; foRita(); });
    yta.querySelectorAll("tr[data-tillfraga]").forEach(tr => tr.addEventListener("click", () => { const f = foFraga(p, tr.dataset.tillfraga); foGaTill(f.lage === "klar" ? "klara" : "aktiva", f.id); }));
    document.getElementById("foLoggExport").addEventListener("click", () => {
        const rad = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
        const csv = "\ufeff" + ["Nr", "Fråga", "Gällande besked", "Från", "Status", "Inkluderad av"].map(rad).join(";") + "\r\n" + l.map(f => [f.nr, f.text, foBeskedText(f),
            foDiscText(p, f.fran), FO_LAGE[f.lage] ? FO_LAGE[f.lage].namn : f.lage, foPersonNamn(p, f.ilogg.av)].map(rad).join(";")).join("\r\n");
        foLaddaNer(foFilnamn(p.namn) + "-beslutslogg" + (foLoggDisc ? "-" + foFilnamn(foDiscText(p, foLoggDisc)) : "") + "-" + foIdag() + ".csv", csv, "text/csv;charset=utf-8");
    });
}
function foBeslutFlikar(p) {
    const n = p.fragor.filter(f => f.ilogg && !f.makulerad).length;
    return '<div class="fo-flikar" role="tablist"><button type="button" role="tab" class="fo-flik' + (foFlik.beslut === "logg" ? " vald" : "") + '" data-beslutflik="logg">Beslutslogg <span>' + n + '</span></button>' +
        '<button type="button" role="tab" class="fo-flik' + (foFlik.beslut !== "logg" ? " vald" : "") + '" data-beslutflik="gallande">Formella beslut <span>' + p.beslut.filter(b => b.status === "gallande").length + '</span></button></div>';
}
function foKopplaBeslutFlikar(yta) { yta.querySelectorAll(".fo-flikar [data-beslutflik]").forEach(b => b.addEventListener("click", () => { foFlik.beslut = b.dataset.beslutflik; foRita(); })); }
function foVyBeslut(yta) {
    if (!foFlik.beslut) foFlik.beslut = "logg";
    if (foFlik.beslut === "logg") return foVyLogg(yta);
    const p = foP, jag = foJagId();
    const urval = { gallande: b => b.status === "gallande", ersatta: b => b.status === "ersatt", alla: () => true };
    if (!urval[foFlik.beslut]) foFlik.beslut = "gallande";
    const lista = p.beslut.filter(urval[foFlik.beslut]).sort((a, b) => (b.datum || "").localeCompare(a.datum || "") || (b.skapad || "").localeCompare(a.skapad || ""));
    let html = foTopp("Beslutslogg", (foKanLeda(p, jag) ? '<button class="navknapp" type="button" id="foBeslutNy">+ Beslut utan fråga</button>' : "") +
        '<button class="navknapp" type="button" id="foBeslutExport">Exportera</button>');
    html += foBeslutFlikar(p);
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
            (b.underlag.svar ? '<p><b>Svar:</b> ' + esc(b.underlag.svar) + '</p>' : "") + '</div>' : "") +
        (foKvittKravFor(p, { typ: "beslut", id: b.id }).length ? '<h4 class="fo-raph4">Kvitteringar</h4>' + foKvittHtml({ typ: "beslut", id: b.id }) : "") + '</div>';
    const knappar = [];
    if (foKanSkriva(p, jag)) knappar.push({ txt: "Begär kvittering", fn: () => { stangModal(); foKvittDialog({ typ: "beslut", id: b.id }, "Beslut " + b.nr + ": " + b.text.slice(0, 120), f ? foPersonerIFraga(p, f, true).filter(id => id !== jag) : []); } });
    if (f) knappar.push({ txt: "Öppna fråga " + f.nr, vanster: true, fn: () => { stangModal(); foGaTill(f.lage === "klar" ? "klara" : "aktiva", f.id); } });
    if (b.status === "gallande" && foKanLeda(p, jag)) knappar.push({ txt: "Ersätt eller komplettera", fn: () => { stangModal(); foBeslutDialog(f, b); } });
    knappar.push({ txt: "Stäng", primar: true, fn: stangModal });
    modal("Beslut " + b.nr, f ? "Från fråga " + f.nr : b.forum ? "Från " + ((foForum(p, b.forum) || {}).namn || "möte") : "Beslut utan fråga", kropp, knappar);
    foKopplaKvitt(document.getElementById("overlay"));
}
// Nytt beslut: från en fråga, utan fråga (mötesbeslut), eller som ersätter/kompletterar ett tidigare.
function foBeslutDialog(f, tidigare, kalla, forslag) {
    const p = foP, jag = foJagId();
    const kropp = (f ? '<div class="fo-underlag"><h4>Underlag: fråga ' + f.nr + '</h4><p>' + esc(f.text) + '</p>' + (foSvarText(f) ? '<p><b>Slutligt svar:</b> ' + esc(foSvarText(f)) + '</p>' : foHarSvar(f) ? '<p><b>Senaste svar (inte valt som slutligt):</b> ' + esc(foSenasteSvar(f).text) + '</p>' : '<p class="hjalp">Frågan har inget svar ännu.</p>') +
        '<p class="hjalp" style="margin:6px 0 0">Underlaget sparas med beslutet så som det ser ut nu. Besked = svar från projektör. Beslut = fastställt av angiven beslutsfattare.</p></div>' : "") +
        (f && foKonsAktiva(f).length ? '<div class="notis fo-konsnotis"><b>' + esc(FO_KONS_BEKRAFTA) + '</b><ul>' + foKonsAktiva(f).map(k => '<li>' + esc(FO_KONS[k.typ]) + " – " + esc(foPersonNamn(p, k.av) || "–") + (k.kommentar ? ": " + esc(k.kommentar) : "") + '</li>').join("") + '</ul></div>' : "") +
        (tidigare ? '<div class="notis">' + esc(tidigare.nr) + ': ' + esc(tidigare.text) + '</div><div class="falt"><label>Det nya beslutet</label><div class="lage" id="foBdSatt">' +
            '<button type="button" data-satt="ersatter" class="vald">Ersätter ' + esc(tidigare.nr) + '</button><button type="button" data-satt="kompletterar">Kompletterar ' + esc(tidigare.nr) + '</button></div></div>' : "") +
        (!f && !tidigare && p.forum.length ? '<div class="falt"><label for="foBdForum">Möte (källa)</label>' + foForumSelect("foBdForum", "", "Inget möte") + '</div>' : "") +
        '<div class="falt"><label for="foBdText">Vad beslutades?</label><textarea class="f" id="foBdText" rows="4" placeholder="Till exempel: Schaktet flyttas 300 mm åt norr. A reviderar planritning plan 2."></textarea></div>' +
        '<div class="tva"><div class="falt"><label for="foBdFattare">Beslutsfattare</label>' + foPersonSelect("foBdFattare", jag, "–") + '</div>' +
        '<div class="falt"><label for="foBdDatum">Datum</label><input class="f" type="date" id="foBdDatum" value="' + foIdag() + '"></div></div>' +
        '<label class="fo-kryss"><input type="checkbox" id="foBdPaverkar"' + (f && foKonsAktiva(f).length ? " checked" : "") + '> Beslutet kan påverka tid eller kostnad</label><p class="hjalp" style="margin:4px 0 0">' + esc(FO_PAVERKAR_TEXT) + '</p>' +
        '<div id="foBdKonsRuta" class="fo-bdkons' + (f && foKonsAktiva(f).length ? "" : " dold") + '"><label class="fo-kryss"><input type="checkbox" id="foBdKons"> Ja, konsekvenserna för tid och/eller kostnad har kommunicerats och hanterats</label></div><div id="foBdFel"></div>';
    modal(tidigare ? "Ersätt eller komplettera " + tidigare.nr : f ? "Fastställ beslut för fråga " + f.nr : "Beslut utan fråga",
        "Ett fastställt beslut kan inte ändras i efterhand.", kropp, [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Fastställ beslut", primar: true, fn: () => {
            const satt = tidigare ? (document.querySelector("#foBdSatt .vald") || { dataset: { satt: "ersatter" } }).dataset.satt : "";
            const behov = !!(f && foKonsAktiva(f).length);
            if (behov && !document.getElementById("foBdKons").checked) { document.getElementById("foBdFel").innerHTML = '<div class="notis rod">Bekräfta att konsekvenserna har kommunicerats och hanterats.</div>'; return; }
            const b = foGor("nyttBeslut", { id: foId(), fragaId: f ? f.id : (tidigare ? tidigare.fragaId : ""), forum: (document.getElementById("foBdForum") || {}).value || (tidigare ? tidigare.forum : ""),
                text: document.getElementById("foBdText").value, fattare: document.getElementById("foBdFattare").value, datum: document.getElementById("foBdDatum").value,
                paverkar: document.getElementById("foBdPaverkar").checked, ersatter: tidigare ? tidigare.id : "", satt: satt, bekraftaKonsekvens: behov ? true : undefined });
            if (b) {
                if (kalla) foGor("koppla", { fran: kalla, till: { typ: "beslut", id: b.id } }, true);
                stangModal(); status("Beslut " + b.nr + " fastställt."); foRita();
            }
        } }
    ]);
    document.querySelectorAll("#foBdSatt button").forEach(x => x.addEventListener("click", () => document.querySelectorAll("#foBdSatt button").forEach(y => y.classList.toggle("vald", y === x))));
    setTimeout(() => { const t = document.getElementById("foBdText"); if (t) { if (forslag) t.value = forslag; t.focus(); } }, 30);
}


/* ---------- Dokument och Tidplaner: kommer i nästa steg ---------- */
function foVyKommer(yta) {
    const d = {
        dokument: ["Dokument", "Projektets dokument samlade på ett ställe, i en mappstruktur som ni bygger själva: beställarens projekteringsförutsättningar och FFU, ritningar, modeller och övriga handlingar.",
            ["Fria mappar och undermappar – inga låsta mappar", "Stora filer som ritningar och modeller", "Protokoll från möten utanför Forma läggs i mötesforumets mapp, så att det bara finns ett protokollarkiv"]],
        tidplaner: ["Tidplaner", "Projekteringens tidplaner, med samma tidplaneverktyg som i Wimo Plan.",
            ["Flera tidplaner i samma projekt", "Egna aktiviteter och egna visningsval i varje tidplan", "Kopplingar till frågor, möten och beslut"]],
        amk: ["Arbetsmiljö & kvalitet", "Stöd för projektörerna, projekteringsledaren och BAS-P i arbetsmiljö- och kvalitetsarbetet under projekteringen – med egna mallar och utan dubbeladministration eller separata dokumentarkiv.",
            ["Arbetsmiljö & BAS-P: gemensamt, levande riskregister, riskbedömningar, riskreducerande åtgärder, ansvar och uppföljning, arbetsmiljöplan och överlämning till BAS-U",
             "Egenkontroller: projektörernas egna kontroller, disciplinvisa checklistor och uppföljning av genomförda och återstående kontroller",
             "Kvalitetssäkring: intern granskning, samgranskning och uppföljning av granskningssynpunkter inför handlingsleveranser"]]
    }[foVy] || ["Kommer snart", "", []];
    yta.innerHTML = foTopp(d[0]) + '<div class="dashblock fo-kommer"><h3>Byggs i nästa steg</h3><p>' + esc(d[1]) + "</p>" +
        (d[2].length ? "<ul>" + d[2].map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>" : "") + "</div>";
}

/* Rapporter & export finns i fo-rapport.js */

/* ======================= Uppföljning (projekteringsledaren) =======================
   Projektöversikten visar hur projektet ligger till. Uppföljningen visar var
   projekteringsledaren behöver agera. Allt räknas fram ur de vanliga registren.
   Identifierade avvikelser som redan hanteras (på möte eller med öppen åtgärd)
   visas för sig, så att de syns utan att dränka det som ingen har uppmärksammat. */
let foUppf = { disc: "", person: "", mote: null };
function foVyUppfoljning(yta) {
    const p = foP, jag = foJagId(), idag = foIdag();
    const disc = p.discipliner.filter(d => d.aktiv).sort((a, b) => a.ordning - b.ordning);
    const pers = p.personer.filter(x => x.aktiv !== false).sort((a, b) => foPersonNamn(p, a.id).localeCompare(foPersonNamn(p, b.id), "sv"));
    const iDisc = f => !foUppf.disc || foRapFragaDisc(p, f, foUppf.disc);
    const iPers = f => !foUppf.person || foMottagare(f).some(m => foArPart(p, foUppf.person, m)) || foStallarePerson(f) === foUppf.person;
    const fr = p.fragor.filter(f => !f.makulerad && iDisc(f) && iPers(f));
    const atgOk = a => (!foUppf.disc || foAtgardDisc(p, a) === foUppf.disc) && (!foUppf.person || foArPart(p, foUppf.person, a.ansvarig));
    const hanteras = f => f.moten.length > 0 || (f.kopplingar || []).some(k => k.typ === "atgard" && (foAtgard(p, k.id) || {}).status === "oppen");
    const sen = fr.filter(f => foForsenad(f, idag));
    const senNy = sen.filter(f => !hanteras(f)), senHant = sen.filter(hanteras);
    const ejBedomda = fr.filter(f => f.lage === "besvarad" && foSenasteSvar(f) && foArbetsdagarMellan(foDag(foSenasteSvar(f).tid), idag) >= 2);
    const atgSen = p.atgarder.filter(a => (a.status === "oppen" || a.status === "kontroll") && a.senast && a.senast < idag && atgOk(a));
    const risk = fr.filter(f => foAktiv(f) && foKonsAktiva(f).length);
    const prot = p.forum.filter(fo => fo.aktiv).map(fo => ({ fo, b: foBevakning(p, fo, idag) })).filter(x => x.b && x.b.lage === "folj");
    const radF = (f, extra) => '<li data-fraga="' + f.id + '"><span class="fo-agnr">' + f.nr + '</span><span class="fo-agtext">' + esc(f.text) +
        '<small>' + [esc(foMottagareText(p, f) || "ingen mottagare"), f.svarSenast ? (foForsenad(f, idag) ? '<b class="rodtal">' + foArbetsdagarMellan(f.svarSenast, idag) + " arbetsdagar sen</b>" : "Svar senast " + foDatumKort(f.svarSenast)) : "", extra || ""].filter(Boolean).join(" · ") + '</small></span>' + foLageChip(f) + '</li>';
    const radA = a => '<li data-atg="' + a.id + '"><span class="fo-agnr">Å-' + a.nr + '</span><span class="fo-agtext">' + esc(a.text) + '<small>' + esc(foPartText(p, a.ansvarig) || "ingen ansvarig") +
        (a.senast ? ' · <b class="rodtal">Klar senast ' + foDatumKort(a.senast) + '</b>' : "") + '</small></span></li>';
    const block = (rub, n, inre, knapp, hjalp) => '<div class="dashblock"><h3>' + rub + ' <span class="antal">' + n + '</span>' + (knapp || "") + '</h3>' + (hjalp ? '<p class="hjalp" style="margin:0 0 6px">' + hjalp + '</p>' : "") +
        (n ? inre : '<p class="fo-klart">Inget här.</p>') + '</div>';
    let html = foTopp("Uppföljning", '<button class="navknapp" type="button" id="foForbMote">Förbered möte</button>');
    html += '<div class="fo-filterrad"><label class="fo-litefalt"><span>Disciplin</span><select class="f" id="foUpDisc"><option value="">Alla</option>' + disc.map(d => '<option value="' + d.id + '"' + (foUppf.disc === d.id ? " selected" : "") + '>' + esc(d.kod + " " + d.namn) + '</option>').join("") + '</select></label>' +
        '<label class="fo-litefalt"><span>Person</span><select class="f" id="foUpPers"><option value="">Alla</option>' + pers.map(x => '<option value="' + x.id + '"' + (foUppf.person === x.id ? " selected" : "") + '>' + esc(foPersonNamn(p, x.id)) + '</option>').join("") + '</select></label></div>';
    if (foUppf.mote) html += foForbereddMoteHtml(p, idag);
    else {
        html += '<div class="fo-tvakol">' +
            block("Försenade frågor som ingen hanterar", senNy.length, '<ul class="atglista fo-aglista">' + senNy.map(f => radF(f)).join("") + '</ul>',
                senNy.length ? '<button type="button" class="mknapp fo-hoger" id="foUpPaminn">Påminn alla</button>' : "", "Passerat svarsdatum, inte markerade för möte och utan öppen åtgärd.") +
            block("Försenade men under hantering", senHant.length, '<ul class="atglista fo-aglista">' + senHant.map(f => radF(f, f.moten.length ? "på möte" : "öppen åtgärd")).join("") + '</ul>', "", "Tas upp på möte eller har en öppen åtgärd. Syns här så att de inte glöms.") + '</div>';
        html += '<div class="fo-tvakol">' +
            block("Svar som inte bedömts", ejBedomda.length, '<ul class="atglista fo-aglista">' + ejBedomda.map(f => radF(f, "frågeställare " + esc(foPersonNamn(p, foStallarePerson(f))))).join("") + '</ul>', "", "Besvarade sedan minst två arbetsdagar utan att frågeställaren bedömt svaret.") +
            block("Åtgärder med passerat slutdatum", atgSen.length, '<ul class="atglista fo-aglista">' + atgSen.map(radA).join("") + '</ul>') + '</div>';
        html += '<div class="fo-tvakol">' +
            block("Risk för tid- eller kostnadspåverkan", risk.length, '<ul class="atglista fo-aglista">' + risk.map(f => radF(f, foKonsAktiva(f).map(k => FO_KONS[k.typ]).join(", "))).join("") + '</ul>') +
            block("Protokoll att följa upp", prot.length, '<ul class="atglista fo-aglista">' + prot.map(x => '<li data-forum="' + x.fo.id + '"><span class="fo-agnr">' + esc(x.fo.kort) + '</span><span class="fo-agtext">' + esc(x.fo.namn) +
                '<small>' + esc(x.b.text) + (x.fo.bevakning.ansvarig ? " · ansvarig " + esc(foPersonNamn(p, x.fo.bevakning.ansvarig)) : "") + '</small></span></li>').join("") + '</ul>', "", "Forma vet inte om mötet hållits – det här är en påminnelse att stämma av.") + '</div>';
        // tidplanernas leveranser: passerat utan bekräftelse skiljs från konstaterade förseningar och risker
        const lev = foTpLeveranser(p, idag).filter(l => !foUppf.disc || foTpAnsvDisc(p, l.rad.ansv) === foUppf.disc).filter(l => !foUppf.person || (l.rad.ansv && foArPart(p, foUppf.person, l.rad.ansv)));
        const omTva = foTpPlus(idag, 14);
        const radL = l => '<li data-tidplan="' + l.tp.id + '"><span class="fo-agnr">' + (l.rad.ansv && l.rad.ansv.disc ? esc(foDiscText(p, l.rad.ansv.disc)) : "") + '</span><span class="fo-agtext">' + esc(l.rad.namn) +
            '<small>' + esc(l.tp.namn) + ' · ' + esc(foTpAnsvText(p, l.rad.ansv) || "ingen ansvarig") + ' · fastställt ' + foDatumKort(l.slut) + (l.u.prognos ? ' · prognos ' + foDatumKort(l.u.prognos) : "") +
            (l.u.konsekvens ? ' · ' + esc(FO_TP_KONS[l.u.konsekvens]) : "") + '</small></span><span class="fo-lage ' + FO_TP_LAGE[l.status].kl + '"><i></i>' + FO_TP_LAGE[l.status].namn + '</span></li>';
        const levAvv = lev.filter(l => ["sen", "risk", "passerad"].includes(l.status)), levKom = lev.filter(l => (l.status === "ej" || l.status === "plan") && l.slut >= idag && l.slut <= omTva);
        html += '<div class="fo-tvakol">' +
            block("Leveranser att följa upp", levAvv.length, '<ul class="atglista fo-aglista">' + levAvv.map(radL).join("") + '</ul>', "", "Passerat utan bekräftelse betyder inte att leveransen är sen – bara att ingen har rapporterat.") +
            block("Kommande leveranser (14 dagar)", levKom.length, '<ul class="atglista fo-aglista">' + levKom.map(radL).join("") + '</ul>') + '</div>';
        html += foKvittOversiktHtml(p);
    }
    yta.innerHTML = html;
    document.getElementById("foUpDisc").addEventListener("change", e => { foUppf.disc = e.target.value; foRita(); });
    document.getElementById("foUpPers").addEventListener("change", e => { foUppf.person = e.target.value; foRita(); });
    document.getElementById("foForbMote").addEventListener("click", foForbMoteDialog);
    const pm = document.getElementById("foUpPaminn"); if (pm) pm.addEventListener("click", () => foPaminnDialog(senNy));
    const avs = document.getElementById("foMoteAvsluta"); if (avs) avs.addEventListener("click", () => { foUppf.mote = null; foRita(); });
    const mv = document.getElementById("foMoteVy"); if (mv) mv.addEventListener("click", () => { const fo = foForum(p, foUppf.mote.forum); if (fo) foStorskarm(fo); });
    yta.querySelectorAll("[data-fraga]").forEach(li => li.addEventListener("click", () => { foFragaOppen = li.dataset.fraga; foSattAdress(); foRita(); }));
    yta.querySelectorAll("[data-atg]").forEach(li => li.addEventListener("click", () => foAtgardDialog(foAtgard(p, li.dataset.atg))));
    yta.querySelectorAll("[data-forum]").forEach(li => li.addEventListener("click", () => { foFlik.mote = li.dataset.forum; foGaTill("moten"); }));
    yta.querySelectorAll("[data-tidplan]").forEach(li => li.addEventListener("click", () => { foTpVal = li.dataset.tidplan; foGaTill("tidplaner"); }));
    foKopplaUppfoljning(yta);
}
// Förbered möte: välj forum, tidshorisont och områden. Sammanställningen bygger på de vanliga registren.
function foForbMoteDialog() {
    const p = foP, forum = foForumValbara(p), v = foUppf.mote || { forum: (forum[0] || {}).id || "", dagar: 14, omr: { fragor: true, sena: true, atg: true, risk: true, beslut: true, lev: true } };
    if (!forum.length) return status("Skapa ett mötesforum först, under Möten & protokoll.", true);
    const kr = (k, t) => '<label class="fo-kryss"><input type="checkbox" data-omr="' + k + '"' + (v.omr[k] ? " checked" : "") + '> ' + t + '</label>';
    modal("Förbered möte", "Sammanställs från frågor, åtgärder och beslut – inget registreras två gånger",
        '<div class="tva"><div class="falt"><label for="foFmFo">Mötesforum</label><select class="f" id="foFmFo">' + forum.map(f => '<option value="' + f.id + '"' + (f.id === v.forum ? " selected" : "") + '>' + esc(f.namn) + '</option>').join("") + '</select></div>' +
        '<div class="falt"><label for="foFmDagar">Blicka framåt (dagar)</label><input class="f" id="foFmDagar" type="number" min="1" value="' + v.dagar + '"></div></div>' +
        '<div class="falt"><label>Visa</label>' + kr("fragor", "Frågor markerade för mötet") + kr("sena", "Frågor med passerad svarstid") + kr("atg", "Åtgärder som är sena eller ska vara klara inom perioden") +
        kr("risk", "Risker för tid och kostnad") + kr("beslut", "Ändrade beslut") + kr("lev", "Leveranser i tidplanerna") + '</div>', [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Visa sammanställning", primar: true, fn: () => {
            const omr = {}; document.querySelectorAll("[data-omr]").forEach(k => { omr[k.dataset.omr] = k.checked; });
            foUppf.mote = { forum: document.getElementById("foFmFo").value, dagar: Math.max(1, +document.getElementById("foFmDagar").value || 14), omr: omr };
            stangModal(); if (foVy !== "uppfoljning") foGaTill("uppfoljning"); else foRita();
        } }]);
}
function foForbereddMoteHtml(p, idag) {
    const v = foUppf.mote, fo = foForum(p, v.forum);
    if (!fo) { foUppf.mote = null; return ""; }
    const slut = new Date(idag); slut.setDate(slut.getDate() + v.dagar); const s = slut.toISOString().slice(0, 10);
    const fran = new Date(idag); fran.setDate(fran.getDate() - v.dagar); const f0 = fran.toISOString().slice(0, 10);
    const iDisc = f => !foUppf.disc || foRapFragaDisc(p, f, foUppf.disc);
    const markerade = p.fragor.filter(f => !f.makulerad && f.moten.includes(fo.id) && iDisc(f)).sort((a, b) => a.nr - b.nr);
    const sena = p.fragor.filter(f => foForsenad(f, idag) && !f.moten.includes(fo.id) && iDisc(f));
    const atg = p.atgarder.filter(a => (a.status === "oppen" || a.status === "kontroll") && a.senast && a.senast <= s && (!foUppf.disc || foAtgardDisc(p, a) === foUppf.disc)).sort((a, b) => a.senast.localeCompare(b.senast));
    const risk = p.fragor.filter(f => foAktiv(f) && foKonsAktiva(f).length && iDisc(f));
    const bes = p.beslut.filter(b => b.ersatter && (b.datum || "") >= f0);
    const lista = (rub, l, rad) => '<div class="dashblock"><h3>' + rub + ' <span class="antal">' + l.length + '</span></h3>' + (l.length ? '<ul class="atglista fo-aglista">' + l.map(rad).join("") + '</ul>' : '<p class="fo-klart">Inget här.</p>') + '</div>';
    const rf = f => '<li data-fraga="' + f.id + '"><span class="fo-agnr">' + f.nr + '</span><span class="fo-agtext">' + esc(f.text) + '<small>' + esc(foMottagareText(p, f) || "–") +
        (foForsenad(f, idag) ? ' · <b class="rodtal">försenad</b>' : "") + '</small></span>' + foLageChip(f) + '</li>';
    let html = '<div class="dashblock fo-forbtopp"><h3>Mötesförberedelse: ' + esc(fo.namn) + (fo.nastaMote ? " · " + foDatumKort(fo.nastaMote) : "") +
        '<button type="button" class="mknapp fo-hoger" id="foMoteVy">Öppna mötesvy</button><button type="button" class="mknapp" id="foMoteAvsluta">Stäng</button></h3>' +
        '<p class="hjalp" style="margin:0">Åtgärder fram till ' + foDatumKort(s) + ', ändrade beslut sedan ' + foDatumKort(f0) + (foUppf.disc ? ", disciplin " + esc(foDiscText(p, foUppf.disc)) : "") + '. Ändringar du gör sparas direkt i de vanliga registren.</p></div>';
    if (v.omr.fragor) html += lista("Frågor markerade för " + esc(fo.namn), markerade, rf);
    if (v.omr.sena) html += lista("Frågor med passerad svarstid", sena, rf);
    if (v.omr.atg) html += lista("Åtgärder att följa upp", atg, a => '<li data-atg="' + a.id + '"><span class="fo-agnr">Å-' + a.nr + '</span><span class="fo-agtext">' + esc(a.text) + '<small>' +
        esc(foPartText(p, a.ansvarig) || "–") + ' · ' + (a.senast < idag ? '<b class="rodtal">Klar senast ' + foDatumKort(a.senast) + '</b>' : "Klar senast " + foDatumKort(a.senast)) + '</small></span></li>');
    if (v.omr.risk) html += lista("Risker för tid och kostnad", risk, rf);
    if (v.omr.lev !== false) html += lista("Leveranser i tidplanerna", foTpLeveranser(p, idag).filter(l => l.status !== "klar" && l.slut <= s && (!foUppf.disc || foTpAnsvDisc(p, l.rad.ansv) === foUppf.disc)).sort((a, b) => a.slut.localeCompare(b.slut)),
        l => '<li data-tidplan="' + l.tp.id + '"><span class="fo-agnr"></span><span class="fo-agtext">' + esc(l.rad.namn) + '<small>' + esc(foTpAnsvText(p, l.rad.ansv) || "–") + ' · ' + foDatumKort(l.slut) + '</small></span><span class="fo-lage ' + FO_TP_LAGE[l.status].kl + '"><i></i>' + FO_TP_LAGE[l.status].namn + '</span></li>');
    if (v.omr.beslut) html += lista("Ändrade beslut", bes, b => '<li><span class="fo-agnr">' + esc(b.nr) + '</span><span class="fo-agtext">' + esc(b.text) + '<small>' + (b.satt === "kompletterar" ? "Kompletterar " : "Ersätter ") + esc((foBeslut(p, b.ersatter) || {}).nr || "") + " · " + esc(b.datum || "") + '</small></span></li>');
    return html;
}
