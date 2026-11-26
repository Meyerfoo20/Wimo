/* ======================================================================
   Wimo Forma · organisation, projektinställningar och projektlistan
   ====================================================================== */

/* ======================= Projektmedlemmar ======================= */
// Projektets gemensamma kontaktlista. Personerna grupperas i kategorier som användaren
// själv skapar, döper om, sorterar och tar bort. En person kan stå i flera kategorier.
function foVyOrg(yta) {
    const p = foP, jag = foJagId(), leda = foKanLeda(p, jag);
    const moln = foArMolnProjekt(), molnMedl = moln && foMolnMeta ? foMolnMeta.medlemmar : null;
    const flikar = [["personer", "Personer", p.personer.filter(x => x.aktiv).length], ["foretag", "Företag", p.foretag.filter(x => x.aktiv).length],
        ["disc", "Discipliner", p.discipliner.filter(x => x.aktiv).length], ["forum", "Mötesforum", p.forum.filter(x => x.aktiv).length], ["ind", "Indelningar", p.indelningar.length]];
    if (!flikar.some(f => f[0] === foFlik.org)) foFlik.org = "personer";
    const nyText = { personer: "+ Ny kontakt", foretag: "+ Nytt företag", disc: "+ Ny disciplin", forum: "+ Nytt mötesforum", ind: "+ Ny indelning" }[foFlik.org];
    let html = foTopp("Projektmedlemmar", leda ? '<button class="navknapp" type="button" id="foOrgNy">' + nyText + '</button>' : "");
    html += '<div class="fo-flikar" role="tablist">' + flikar.map(([k, t, n]) => '<button type="button" role="tab" class="fo-flik' + (foFlik.org === k ? " vald" : "") + '" aria-selected="' + (foFlik.org === k) + '" data-orgflik="' + k + '">' +
        t + ' <span>' + n + '</span></button>').join("") + '</div>';
    if (foFlik.org === "personer") {
        const l = p.personer.slice().sort((a, b) => (b.aktiv - a.aktiv) || foPersonNamn(p, a.id).localeCompare(foPersonNamn(p, b.id), "sv"));
        const kat = foKategorierSorterade(p);
        html += '<div class="fo-filterrad"><label class="fo-sokfalt"><span class="p4-ik ik-sok" aria-hidden="true"></span><input class="f" id="foOrgSok" type="search" placeholder="Sök namn, företag, roll, disciplin eller e-post" data-behall></label>' +
            (leda ? '<button type="button" class="mknapp" id="foKategorier">Kategorier …</button>' +
                '<button type="button" class="mknapp" id="foErsatt">Ersätt projektmedlem …</button>' : "") +
            (leda && moln && l.some(x => x.aktiv !== false && x.epost && foAnslutning(p, x, molnMedl) === "kontakt")
                ? '<button type="button" class="mknapp" id="foBjudAlla">Bjud in alla som inte anslutit</button>' : "") + "</div>";
        const varn = leda ? foOrgVarningar(p) : [];
        if (varn.length) html += '<div class="notis fo-orgvarn"><b>Att se över</b><ul>' + varn.map(v => "<li>" + esc(v) + "</li>").join("") + "</ul></div>";
        const rad = (x) => {
            const ft = foForetag(p, x.foretagId);
            const roller = String(x.befattning || "").split(",").map(r => r.trim()).filter(Boolean);
            return '<tr data-rad="' + x.id + '" class="' + (x.aktiv ? "" : "utford") + '" data-sok="' + esc(foNormal([foPersonNamn(p, x.id), ft && ft.namn, x.befattning, x.epost, (x.disc || []).map(d => foDiscText(p, d)).join(" ")].join(" "))) + '">' +
                '<td class="fo-personcell"><span class="fo-avatar liten" aria-hidden="true">' + esc(foInitialer(p, x.id)) + '</span><span><b>' + esc(foPersonNamn(p, x.id)) + '</b>' + (x.id === jag ? ' <span class="hjalp">(du)</span>' : "") + (x.extern ? ' <span class="fo-chip">Extern</span>' : "") + (x.aktiv ? "" : ' <span class="fo-chip">Inaktiv</span>') +
                (roller.length ? '<small>' + roller.map(r => esc(r)).join(" · ") + "</small>" : "") + '</span></td>' +
                '<td>' + esc(ft ? ft.namn : "–") + '</td>' +
                '<td>' + ((x.disc || []).map(d => foDiscChip(p, d)).filter(Boolean).join(" ") || "–") + '</td>' +
                '<td>' + (x.epost ? '<a href="mailto:' + esc(x.epost) + '">' + esc(x.epost) + '</a>' : "–") + (x.tel ? '<small><a href="tel:' + esc(x.tel.replace(/\s/g, "")) + '">' + esc(x.tel) + '</a></small>' : "") + '</td>' +
                '<td>' + esc(FO_ROLLER[x.roll] || "–") + '<small class="fo-ansl fo-ansl-' + foAnslutning(p, x, molnMedl) + '">' + FO_ANSLUTNING[foAnslutning(p, x, molnMedl)] +
                    (foAnslutning(p, x, molnMedl) === "inbjuden" ? " till " + foDatumKort(new Date(x.inbjudan.utgar).toISOString()) : "") + '</small></td>' +
                '<td class="fo-snabbkol">' + (leda && moln && x.aktiv !== false && x.epost && ["kontakt", "inbjuden"].includes(foAnslutning(p, x, molnMedl))
                    ? '<button type="button" class="fo-minknapp" data-bjudin="' + x.id + '">' + (x.inbjudan ? "Skicka om" : "Bjud in") + '</button>' : "") +
                    (leda ? '<button type="button" class="fo-minknapp" data-person="' + x.id + '">Ändra</button>' : "") + '</td></tr>';
        };
        const tabell = (rader) => '<div class="fo-tabellram"><table class="lista fo-tabell fo-persontabell"><thead><tr><th>Namn och roller</th><th>Företag</th><th>Disciplin</th><th>E-post och telefon</th><th>Behörighet</th><th class="fo-snabbkol"><span class="sr">Ändra</span></th></tr></thead><tbody>' +
            rader.map(rad).join("") + "</tbody></table></div>";
        if (!l.length) html += foTomt("Inga personer ännu", "Lägg till projektets deltagare. En kontakt behöver inget Wimo-konto.");
        else {
            // en grupp per kategori, i den ordning användaren har valt; en person kan stå i flera
            const grupper = kat.map(k => ({ k, rader: l.filter(x => (x.kategorier || []).includes(k.id)) }));
            const utan = l.filter(x => !(x.kategorier || []).some(id => foKategori(p, id)));
            const tomma = grupper.filter(g => !g.rader.length);
            html += '<div id="foPersonGrupper">' + grupper.filter(g => g.rader.length).map(g => '<section class="fo-katgrupp" data-katgrupp="' + g.k.id + '"><h3 class="fo-blockrub">' + esc(g.k.namn) +
                ' <span class="antal">' + g.rader.length + "</span></h3>" + tabell(g.rader) + "</section>").join("") +
                (utan.length ? '<section class="fo-katgrupp" data-katgrupp=""><h3 class="fo-blockrub">' + (kat.length ? "Utan kategori" : "Alla personer") + ' <span class="antal">' + utan.length + "</span></h3>" + tabell(utan) + "</section>" : "") +
                // tomma kategorier tar ingen plats: de står på en rad längst ner
                (tomma.length ? '<p class="hjalp fo-kattomma">Inga personer i ' + tomma.map(g => "<b>" + esc(g.k.namn) + "</b>").join(", ") + "." +
                    (leda ? " Välj kategori när du lägger till eller ändrar en person." : "") + "</p>" : "") +
                "</div>";
        }
    }
    if (foFlik.org === "foretag") {
        const l = p.foretag.slice().sort((a, b) => (b.aktiv - a.aktiv) || a.namn.localeCompare(b.namn, "sv"));
        html += l.length ? '<div class="fo-tabellram"><table class="lista fo-tabell"><thead><tr><th>Företag</th><th>Discipliner</th><th>Personer</th><th class="fo-snabbkol"><span class="sr">Ändra</span></th></tr></thead><tbody>' +
            l.map(f => '<tr data-rad="' + f.id + '" class="' + (f.aktiv ? "" : "utford") + '"><td><b>' + esc(f.namn) + '</b>' + (f.orgnr ? '<small>' + esc(f.orgnr) + '</small>' : "") + '</td>' +
                '<td>' + esc((f.disc || []).map(d => foDiscText(p, d)).filter(Boolean).join(", ") || "–") + '</td>' +
                '<td>' + esc(p.personer.filter(x => x.foretagId === f.id && x.aktiv).map(x => foPersonNamn(p, x.id)).join(", ") || "–") + '</td>' +
                '<td class="fo-snabbkol">' + (leda ? '<button type="button" class="fo-minknapp" data-foretag="' + f.id + '">Ändra</button>' : "") + '</td></tr>').join("") + '</tbody></table></div>'
            : foTomt("Inga företag ännu", "Lägg upp konsulter, entreprenörer och beställare som deltar i projekteringen.");
    }
    if (foFlik.org === "disc") {
        const l = p.discipliner.slice().sort((a, b) => a.ordning - b.ordning);
        html += l.length ? '<div class="fo-tabellram"><table class="lista fo-tabell"><thead><tr><th>Kod</th><th>Disciplin</th><th>Frågor</th><th>Personer</th><th class="fo-snabbkol"><span class="sr">Ändra</span></th></tr></thead><tbody>' +
            l.map((d, i) => '<tr data-rad="' + d.id + '" class="' + (d.aktiv ? "" : "utford") + '"><td>' + foDiscChip(p, d.id) + '</td><td>' + esc(d.namn) + (d.aktiv ? "" : ' <span class="fo-chip">Inaktiv</span>') + '</td>' +
                '<td>' + p.fragor.filter(f => !f.makulerad && (f.fran === d.id || foMottagare(f).some(m => m.disc === d.id))).length + '</td>' +
                '<td>' + p.personer.filter(x => x.aktiv && (x.disc || []).includes(d.id)).length + '</td>' +
                '<td class="fo-snabbkol">' + (leda ? '<button type="button" class="fo-minknapp fo-ikonknapp" data-discupp="' + d.id + '"' + (i ? "" : " disabled") + ' aria-label="Flytta upp">↑</button>' +
                    '<button type="button" class="fo-minknapp fo-ikonknapp" data-discner="' + d.id + '"' + (i < l.length - 1 ? "" : " disabled") + ' aria-label="Flytta ner">↓</button>' +
                    '<button type="button" class="fo-minknapp" data-disc="' + d.id + '">Ändra</button>' : "") + '</td></tr>').join("") + '</tbody></table></div>'
            : foTomt("Inga discipliner ännu", "Discipliner är teknikområdena i projekteringen, till exempel A Arkitekt, K Konstruktör och VS Värme och sanitet.",
                leda ? '<button type="button" class="mknapp" id="foStdDisc">Lägg till vanliga discipliner</button>' : "");
    }
    if (foFlik.org === "forum") {
        html += p.forum.length ? '<div class="fo-tabellram"><table class="lista fo-tabell"><thead><tr><th>Kort</th><th>Mötesforum</th><th>Tid och plats</th><th>Mötesledare</th><th>Deltagare</th><th class="fo-snabbkol"><span class="sr">Ändra</span></th></tr></thead><tbody>' +
            p.forum.map(f => '<tr data-rad="' + f.id + '" class="' + (f.aktiv ? "" : "utford") + '"><td><b>' + esc(f.kort) + '</b></td><td>' + esc(f.namn) + (f.nastaMote ? '<small>Nästa möte ' + foDatumKort(f.nastaMote) + '</small>' : "") + '</td>' +
                '<td>' + esc([f.tid, f.plats].filter(Boolean).join(" · ") || "–") + '</td><td>' + esc(foPersonNamn(p, f.ledare) || "–") + '</td><td>' + (f.deltagare || []).length + '</td>' +
                '<td class="fo-snabbkol">' + (leda ? '<button type="button" class="fo-minknapp" data-forum="' + f.id + '">Ändra</button>' : "") + '</td></tr>').join("") + '</tbody></table></div>'
            : foTomt("Inga mötesforum ännu", "Ett mötesforum är en återkommande mötestyp med egna deltagare, till exempel Projekteringsmöte.");
    }
    if (foFlik.org === "ind") {
        html += p.indelningar.length ? '<div class="fo-indlista">' + p.indelningar.map(ind => '<div class="dashblock"><h3>' + esc(ind.namn) +
            (leda ? '<button type="button" class="fo-minknapp fo-hoger" data-ind="' + ind.id + '">Ändra</button>' : "") + '</h3><div class="fo-valchips">' +
            ind.varden.map(v => '<span class="fo-valchip' + (v.aktiv ? "" : " av") + '">' + esc(v.namn) + '</span>').join("") + '</div></div>').join("") + '</div>'
            : foTomt("Inga indelningar ännu", "Indelningar delar upp projektet, till exempel Byggnad (Hus A, Hus B) eller Etapp. En fråga kan märkas med flera värden.");
    }
    yta.innerHTML = html;
    yta.querySelectorAll("[data-orgflik]").forEach(b => b.addEventListener("click", () => { foFlik.org = b.dataset.orgflik; foRita(); }));
    const ny = document.getElementById("foOrgNy");
    if (ny) ny.addEventListener("click", () => ({ personer: () => foPersonDialog(null), foretag: () => foForetagDialog(null), disc: () => foDiscDialog(null), forum: () => foForumDialog(null), ind: () => foIndDialog(null) })[foFlik.org]());
    yta.querySelectorAll("[data-person]").forEach(b => b.addEventListener("click", () => foPersonDialog(foPerson(p, b.dataset.person))));
    yta.querySelectorAll("[data-foretag]").forEach(b => b.addEventListener("click", () => foForetagDialog(foForetag(p, b.dataset.foretag))));
    yta.querySelectorAll("[data-disc]").forEach(b => b.addEventListener("click", () => foDiscDialog(foDisc(p, b.dataset.disc))));
    yta.querySelectorAll("[data-discupp]").forEach(b => b.addEventListener("click", () => foGor("flyttaDisc", { id: b.dataset.discupp, steg: -1 })));
    yta.querySelectorAll("[data-discner]").forEach(b => b.addEventListener("click", () => foGor("flyttaDisc", { id: b.dataset.discner, steg: 1 })));
    yta.querySelectorAll("[data-forum]").forEach(b => b.addEventListener("click", () => foForumDialog(foForum(p, b.dataset.forum))));
    yta.querySelectorAll("[data-ind]").forEach(b => b.addEventListener("click", () => foIndDialog(p.indelningar.find(x => x.id === b.dataset.ind))));
    const std = document.getElementById("foStdDisc");
    if (std) std.addEventListener("click", () => {
        [["A", "Arkitekt"], ["K", "Konstruktör"], ["VS", "Värme och sanitet"], ["V", "Ventilation"], ["E", "El"], ["B", "Brand"], ["L", "Landskap"], ["G", "Geoteknik"]]
            .forEach(([k, n]) => foGor("sparaDisc", { id: foId(), kod: k, namn: n }, true));
        foRita(); status("Åtta vanliga discipliner lades till. Ta bort eller byt namn på dem som inte passar.");
    });
    yta.querySelectorAll("[data-bjudin]").forEach(b => b.addEventListener("click", () => foBjudIn([b.dataset.bjudin])));
    const alla = document.getElementById("foBjudAlla");
    if (alla) alla.addEventListener("click", () => foBjudIn(p.personer.filter(x => x.aktiv !== false && x.epost && foAnslutning(p, x, molnMedl) === "kontakt").map(x => x.id)));
    const ers = document.getElementById("foErsatt");
    if (ers) ers.addEventListener("click", () => foErsattDialog(null));
    const katKnapp = document.getElementById("foKategorier");
    if (katKnapp) katKnapp.addEventListener("click", foKategoriDialog);
    const sok = document.getElementById("foOrgSok");
    if (sok) sok.addEventListener("input", () => {
        const q = foNormal(sok.value).trim();
        document.querySelectorAll(".fo-persontabell tbody tr").forEach(tr => { tr.hidden = !!q && !tr.dataset.sok.includes(q); });
        // dölj tomma grupper medan man söker
        document.querySelectorAll(".fo-katgrupp").forEach(g => { g.hidden = !!q && !g.querySelector("tbody tr:not([hidden])"); });
    });
}

function foPersonDialog(x) {
    const p = foP, ny = !x;
    const kropp = '<div class="tva"><div class="falt"><label for="foPdFn">Förnamn</label><input class="f" id="foPdFn" value="' + esc(x ? x.fornamn : "") + '"></div>' +
        '<div class="falt"><label for="foPdEn">Efternamn</label><input class="f" id="foPdEn" value="' + esc(x ? x.efternamn : "") + '"></div></div>' +
        '<div class="tva"><div class="falt"><label for="foPdFt">Företag</label><select class="f" id="foPdFt"><option value="">–</option>' + p.foretag.filter(f => f.aktiv || (x && f.id === x.foretagId)).map(f =>
            '<option value="' + f.id + '"' + (x && x.foretagId === f.id ? " selected" : "") + '>' + esc(f.namn) + '</option>').join("") + '</select></div>' +
        '<div class="falt"><label for="foPdBef">Roller <span class="hjalp">flera med komma</span></label><input class="f" id="foPdBef" value="' + esc(x ? x.befattning : "") + '" placeholder="Uppdragsansvarig, BIM-samordnare"></div></div>' +
        '<div class="falt"><label>Kategorier <span class="hjalp">en person kan stå i flera</span></label>' + (foKategorierSorterade(p).length
            ? foValChips("pkat", foKategorierSorterade(p).map(k => ({ id: k.id, namn: k.namn })), x ? x.kategorier || [] : [])
            : '<p class="hjalp" style="margin:0">Inga kategorier ännu. Skapa dem under Kategorier … i Projektmedlemmar.</p>') + "</div>" +
        '<div class="falt"><label>Discipliner</label>' + foValChips("pdisc", p.discipliner.filter(d => d.aktiv).sort((a, b) => a.ordning - b.ordning).map(d => ({ id: d.id, namn: d.kod + " " + d.namn })), x ? x.disc || [] : []) + '</div>' +
        '<div class="tva"><div class="falt"><label for="foPdEp">E-post</label><input class="f" id="foPdEp" type="email" value="' + esc(x ? x.epost : "") + '"></div>' +
        '<div class="falt"><label for="foPdTel">Telefon</label><input class="f" id="foPdTel" type="tel" value="' + esc(x ? x.tel : "") + '"></div></div>' +
        '<div class="tva"><div class="falt"><label for="foPdRoll">Behörighet i Forma</label><select class="f" id="foPdRoll">' + Object.keys(FO_ROLLER).map(r =>
            '<option value="' + r + '"' + ((x ? x.roll : "projektor") === r ? " selected" : "") + '>' + FO_ROLLER[r] + '</option>').join("") + '</select></div>' +
        '<div class="falt"><label>&nbsp;</label><label class="fo-kryss"><input type="checkbox" id="foPdExt"' + (x && x.extern ? " checked" : "") + '> Extern deltagare</label></div></div>' +
        (foRoll(p, foJagId()) === "admin" ? '<label class="fo-kryss fo-installning"><input type="checkbox" id="foPdSuper"' + (x && x.superuser ? " checked" : "") + '><span><b>Superuser</b>' +
            '<small>Får hantera andras frågor: överföra ägarskap, ändra mottagare, klarmarkera och återöppna – till exempel när frågeställaren lämnat projektet. Alla ingrepp syns i historiken. Historik och låsta sammanställningar kan aldrig ändras.</small></span></label>' : "") +
        '<p class="hjalp" style="margin:0">Behörighet: administratör och projekteringsledare ändrar register och fastställer beslut. Projektör registrerar och besvarar frågor. Granskare och läsare kan läsa och kvittera.</p>' +
        '<p class="hjalp" style="margin:6px 0 0">Kontakten kan finnas utan Wimo-konto. Bjud in från listan när personen ska få tillgång. När hen loggar in med samma e-post kopplas kontot till den här kontakten, utan att någon ny kontakt skapas.</p>';
    const knappar = [];
    if (x) knappar.push({ txt: x.aktiv ? "Avsluta medlemskap" : "Aktivera igen", vanster: true, fara: !!x.aktiv, fn: () => { stangModal(); x.aktiv ? foAvslutaDialog(x) : foAktiveraIgen(x); } });
    if (x && x.inbjudan) knappar.push({ txt: "Återkalla inbjudan", vanster: true, fn: () => { stangModal(); foAterkalla(x); } });
    knappar.push({ txt: "Avbryt", fn: stangModal });
    knappar.push({ txt: ny ? "Lägg till" : "Spara", primar: true, fn: () => {
        const v = foLasPersonForm(); v.id = x ? x.id : foId();
        if (foGor("sparaPerson", v)) { stangModal(); status(ny ? "Kontakten lades till." : "Kontakten sparades."); foSynkaAtkomst(foPerson(foP, v.id)); }
    } });
    modal(ny ? "Ny kontakt" : foPersonNamn(p, x.id), ny ? "En kontakt behöver inget Wimo-konto." : (FO_ROLLER[x.roll] || ""), kropp, knappar);
    foKopplaValChips(document.getElementById("overlay"));
    setTimeout(() => { const t = document.getElementById("foPdFn"); if (t) t.focus(); }, 30);
}
// Kategorierna: skapa, döp om, sortera och ta bort. Personerna behåller sina övriga kategorier.
function foKategoriDialog() {
    const p = foP, l = foKategorierSorterade(p);
    const kropp = '<ul class="fo-katlista">' + l.map((k, i) => {
        const n = p.personer.filter(x => (x.kategorier || []).includes(k.id)).length;
        return '<li><input class="f" data-katnamn="' + k.id + '" value="' + esc(k.namn) + '" aria-label="Kategorins namn"><span class="hjalp">' + n + (n === 1 ? " person" : " personer") + "</span>" +
            '<button type="button" class="fo-minknapp fo-ikonknapp" data-katflytt="' + k.id + '|-1"' + (i ? "" : " disabled") + ' aria-label="Flytta upp">↑</button>' +
            '<button type="button" class="fo-minknapp fo-ikonknapp" data-katflytt="' + k.id + '|1"' + (i < l.length - 1 ? "" : " disabled") + ' aria-label="Flytta ner">↓</button>' +
            '<button type="button" class="fo-minknapp fo-farlank" data-kattabort="' + k.id + '">Ta bort</button></li>';
    }).join("") + "</ul>" +
        '<div class="fo-katny"><input class="f" id="foKatNy" placeholder="Ny kategori, t.ex. Myndigheter" maxlength="60"><button type="button" class="mknapp" id="foKatLagg">Lägg till</button></div>' +
        '<p class="hjalp" style="margin:10px 0 0">Kategorierna är era egna. Tar du bort en kategori finns personerna kvar i kontaktlistan.</p>';
    modal("Kategorier", "Grupperna i Projektmedlemmar", kropp, [{ txt: "Klar", primar: true, fn: () => { stangModal(); foRita(); } }]);
    const rot = document.getElementById("overlay");
    rot.querySelectorAll("[data-katnamn]").forEach(inp => inp.addEventListener("change", () => {
        if (!foGor("sparaKategori", { id: inp.dataset.katnamn, namn: inp.value }, true)) inp.value = (foKategori(foP, inp.dataset.katnamn) || {}).namn || "";
        else foVisaSparat(inp);
    }));
    rot.querySelectorAll("[data-katflytt]").forEach(b => b.addEventListener("click", () => {
        const [id, steg] = b.dataset.katflytt.split("|");
        if (foGor("flyttaKategori", { id, steg: +steg }, true)) foKategoriDialog();
    }));
    rot.querySelectorAll("[data-kattabort]").forEach(b => b.addEventListener("click", () => {
        const k = foKategori(foP, b.dataset.kattabort);
        if (k && confirm("Ta bort kategorin " + k.namn + "? Personerna finns kvar.")) { if (foGor("taBortKategori", { id: k.id }, true)) foKategoriDialog(); }
    }));
    const ny = document.getElementById("foKatNy"), lagg = () => {
        if (!ny.value.trim()) return ny.focus();
        if (foGor("sparaKategori", { id: foId(), namn: ny.value }, true)) foKategoriDialog();
        setTimeout(() => { const n = document.getElementById("foKatNy"); if (n) n.focus(); }, 30);
    };
    document.getElementById("foKatLagg").addEventListener("click", lagg);
    ny.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); lagg(); } });
}

function foLasPersonForm() {
    return { fornamn: document.getElementById("foPdFn").value, efternamn: document.getElementById("foPdEn").value, foretagId: document.getElementById("foPdFt").value,
        befattning: document.getElementById("foPdBef").value.split(",").map(r => r.trim()).filter(Boolean).join(", "), disc: foValda("pdisc"), kategorier: foValda("pkat"), epost: document.getElementById("foPdEp").value,
        tel: document.getElementById("foPdTel").value, roll: document.getElementById("foPdRoll").value, extern: document.getElementById("foPdExt").checked,
        superuser: document.getElementById("foPdSuper") ? document.getElementById("foPdSuper").checked : undefined };
}
function foKopplaValChips(rot) {
    if (!rot) return;
    rot.querySelectorAll(".fo-valchips .fo-valchip").forEach(b => b.addEventListener("click", () => {
        if (b.closest(".fo-valchips").dataset.enkel) b.closest(".fo-valchips").querySelectorAll(".fo-valchip").forEach(x => { if (x !== b) { x.classList.remove("pa"); x.setAttribute("aria-pressed", "false"); } });
        b.classList.toggle("pa"); b.setAttribute("aria-pressed", b.classList.contains("pa"));
    }));
}
function foValda(namn) { return [...document.querySelectorAll('.fo-valchips[data-val="' + namn + '"] .fo-valchip.pa')].map(b => b.dataset.id); }

function foForetagDialog(f) {
    const p = foP, ny = !f;
    modal(ny ? "Nytt företag" : f.namn, "", '<div class="falt"><label for="foFdNamn">Namn</label><input class="f" id="foFdNamn" value="' + esc(f ? f.namn : "") + '"></div>' +
        '<div class="falt"><label for="foFdOrg">Organisationsnummer (frivilligt)</label><input class="f" id="foFdOrg" value="' + esc(f ? f.orgnr : "") + '"></div>' +
        '<div class="falt"><label>Discipliner</label>' + foValChips("fdisc", p.discipliner.filter(d => d.aktiv).map(d => ({ id: d.id, namn: d.kod + " " + d.namn })), f ? f.disc || [] : []) + '</div>', [
        ...(f ? [{ txt: f.aktiv ? "Inaktivera" : "Aktivera igen", vanster: true, fn: () => { if (foGor("sparaForetag", { id: f.id, namn: f.namn, orgnr: f.orgnr, disc: f.disc, aktiv: !f.aktiv })) stangModal(); } }] : []),
        { txt: "Avbryt", fn: stangModal },
        { txt: ny ? "Lägg till" : "Spara", primar: true, fn: () => {
            if (foGor("sparaForetag", { id: f ? f.id : foId(), namn: document.getElementById("foFdNamn").value, orgnr: document.getElementById("foFdOrg").value, disc: foValda("fdisc") })) stangModal();
        } }]);
    foKopplaValChips(document.getElementById("overlay"));
    setTimeout(() => document.getElementById("foFdNamn").focus(), 30);
}
function foDiscDialog(d) {
    const ny = !d;
    modal(ny ? "Ny disciplin" : d.kod + " – " + d.namn, "Kortkoden är unik i projektet och syns i alla listor.",
        '<div class="tva"><div class="falt"><label for="foDdKod">Kortkod</label><input class="f" id="foDdKod" maxlength="6" value="' + esc(d ? d.kod : "") + '" placeholder="K"></div>' +
        '<div class="falt"><label for="foDdNamn">Namn</label><input class="f" id="foDdNamn" value="' + esc(d ? d.namn : "") + '" placeholder="Konstruktör"></div></div>', [
        ...(d ? [{ txt: d.aktiv ? "Inaktivera" : "Aktivera igen", vanster: true, fn: () => { if (foGor("sparaDisc", { id: d.id, kod: d.kod, namn: d.namn, aktiv: !d.aktiv })) stangModal(); } }] : []),
        { txt: "Avbryt", fn: stangModal },
        { txt: ny ? "Lägg till" : "Spara", primar: true, fn: () => {
            if (foGor("sparaDisc", { id: d ? d.id : foId(), kod: document.getElementById("foDdKod").value, namn: document.getElementById("foDdNamn").value })) stangModal();
        } }]);
    setTimeout(() => document.getElementById("foDdKod").focus(), 30);
}
function foForumDialog(f, forelder) {
    const p = foP, ny = !f, b = (f && f.bevakning) || { pa: false, dagar: 14, marginal: 3, ansvarig: f ? f.sekreterare : "", pausTill: "" };
    // en mapp kan inte flyttas in i sig själv eller sina undermappar
    const under = (id) => { const ut = new Set([id]); let andrat = true; while (andrat) { andrat = false; p.forum.forEach(x => { if (x.forelder && ut.has(x.forelder) && !ut.has(x.id)) { ut.add(x.id); andrat = true; } }); } return ut; };
    const ej = f ? under(f.id) : new Set();
    const mappar = p.forum.filter(x => x.aktiv && !ej.has(x.id)).sort((a, c) => foForumSokvag(p, a).localeCompare(foForumSokvag(p, c), "sv"));
    const fl = f ? f.forelder || "" : forelder || "";
    modal(ny ? "Ny mapp eller mötesforum" : f.namn, "Fri mappstruktur. En mapp kan även vara ett mötesforum som frågor markeras för.",
        '<div class="tva"><div class="falt"><label for="foMdNamn">Namn</label><input class="f" id="foMdNamn" value="' + esc(f ? f.namn : "") + '" placeholder="Projekteringsmöte"></div>' +
        '<div class="falt"><label for="foMdKort">Kortnamn</label><input class="f" id="foMdKort" maxlength="6" value="' + esc(f ? f.kort : "") + '" placeholder="PM"></div></div>' +
        '<div class="falt"><label for="foMdFor">Ligger i</label><select class="f" id="foMdFor"><option value="">Översta nivån</option>' + mappar.map(x => '<option value="' + x.id + '"' + (x.id === fl ? " selected" : "") + '>' + esc(foForumSokvag(p, x)) + '</option>').join("") + '</select></div>' +
        '<label class="fo-kryss"><input type="checkbox" id="foMdValbar"' + (!f || f.valbar !== false ? " checked" : "") + '> Mötesforum – kan väljas på frågor och får en egen frågesammanställning</label>' +
        '<div class="tva"><div class="falt"><label for="foMdPlats">Plats</label><input class="f" id="foMdPlats" value="' + esc(f ? f.plats : "") + '" placeholder="Platskontoret"></div>' +
        '<div class="falt"><label for="foMdTid">Tid</label><input class="f" id="foMdTid" type="time" value="' + esc(f ? f.tid : "") + '"></div></div>' +
        '<div class="tva"><div class="falt"><label for="foMdLed">Mötesledare</label>' + foPersonSelect("foMdLed", f ? f.ledare : "", "–") + '</div>' +
        '<div class="falt"><label for="foMdSek">Protokollförare</label>' + foPersonSelect("foMdSek", f ? f.sekreterare : "", "–") + '</div></div>' +
        '<div class="falt"><label for="foMdNasta">Nästa möte</label><input class="f" id="foMdNasta" type="date" value="' + esc(f ? f.nastaMote : "") + '"></div>' +
        '<details class="fo-histdet"' + (b.pa ? " open" : "") + '><summary>Protokollbevakning</summary><label class="fo-kryss"><input type="checkbox" id="foMdBev"' + (b.pa ? " checked" : "") + '> Bevaka att protokoll registreras</label>' +
        '<div class="tva"><div class="falt"><label for="foMdDagar">Mötesintervall (dagar)</label><input class="f" id="foMdDagar" type="number" min="1" value="' + b.dagar + '"></div>' +
        '<div class="falt"><label for="foMdMarg">Marginal (dagar)</label><input class="f" id="foMdMarg" type="number" min="0" value="' + b.marginal + '"></div></div>' +
        '<div class="tva"><div class="falt"><label for="foMdBevAnsv">Protokollansvarig</label>' + foPersonSelect("foMdBevAnsv", b.ansvarig, "–") + '</div>' +
        '<div class="falt"><label for="foMdPaus">Pausad till och med</label><input class="f" id="foMdPaus" type="date" value="' + esc(b.pausTill || "") + '"></div></div>' +
        '<p class="hjalp" style="margin:0">Forma vet inte om ett möte hållits. Ligger forumet utanför intervallet visas det som att det behöver följas upp.</p></details>', [
        ...(f ? [{ txt: f.aktiv ? "Inaktivera" : "Aktivera igen", vanster: true, fn: () => { if (foGor("sparaForum", Object.assign({}, f, { aktiv: !f.aktiv }))) stangModal(); } }] : []),
        { txt: "Avbryt", fn: stangModal },
        { txt: ny ? "Lägg till" : "Spara", primar: true, fn: () => {
            const v = id => document.getElementById(id).value;
            if (foGor("sparaForum", Object.assign({}, f || {}, { id: f ? f.id : foId(), namn: v("foMdNamn"), kort: v("foMdKort"), forelder: v("foMdFor"), valbar: document.getElementById("foMdValbar").checked,
                plats: v("foMdPlats"), tid: v("foMdTid"), ledare: v("foMdLed"), sekreterare: v("foMdSek"), nastaMote: v("foMdNasta"),
                bevakning: { pa: document.getElementById("foMdBev").checked, dagar: v("foMdDagar"), marginal: v("foMdMarg"), ansvarig: v("foMdBevAnsv"), pausTill: v("foMdPaus") } }))) stangModal();
        } }]);
    setTimeout(() => document.getElementById("foMdNamn").focus(), 30);
}
function foIndDialog(ind) {
    const ny = !ind;
    const varden = ind ? ind.varden.slice() : [];
    const rita = () => {
        const el = document.getElementById("foIdVarden");
        el.innerHTML = varden.map((v, i) => '<div class="fo-vardrad"><input class="f" data-vi="' + i + '" value="' + esc(v.namn) + '">' +
            '<label class="fo-kryss"><input type="checkbox" data-va="' + i + '"' + (v.aktiv !== false ? " checked" : "") + '> Aktiv</label></div>').join("") +
            '<button type="button" class="p4d-lank" id="foIdNyttVarde">+ Lägg till värde</button>';
        el.querySelectorAll("[data-vi]").forEach(i => i.addEventListener("input", () => { varden[+i.dataset.vi].namn = i.value; }));
        el.querySelectorAll("[data-va]").forEach(i => i.addEventListener("change", () => { varden[+i.dataset.va].aktiv = i.checked; }));
        document.getElementById("foIdNyttVarde").addEventListener("click", () => { varden.push({ id: foId(), namn: "", aktiv: true }); rita(); const s = el.querySelectorAll("[data-vi]"); s[s.length - 1].focus(); });
    };
    modal(ny ? "Ny indelning" : ind.namn, "Värden kan läggas till och ändras under hela projektet.",
        '<div class="falt"><label for="foIdNamn">Indelningstyp</label><input class="f" id="foIdNamn" value="' + esc(ind ? ind.namn : "") + '" placeholder="Byggnad, Etapp eller Delområde"></div>' +
        '<div class="falt"><label>Värden</label><div id="foIdVarden"></div></div>', [
        { txt: "Avbryt", fn: stangModal },
        { txt: ny ? "Lägg till" : "Spara", primar: true, fn: () => {
            if (foGor("sparaIndelning", { id: ind ? ind.id : foId(), namn: document.getElementById("foIdNamn").value, varden: varden })) stangModal();
        } }]);
    if (!varden.length) varden.push({ id: foId(), namn: "", aktiv: true });
    rita();
    setTimeout(() => document.getElementById("foIdNamn").focus(), 30);
}

/* ======================= Projektinställningar ======================= */
function foVyInst(yta) {
    const p = foP, jag = foJagId(), leda = foKanLeda(p, jag), admin = foRoll(p, jag) === "admin";
    const post = foLista.find(x => x.id === foPid) || {};
    const moln = !!post.moln;
    const dis = leda ? "" : " disabled";
    let html = foTopp("Projektinställningar");
    html += '<div class="fo-tvakol"><div class="dashblock"><h3>Projektuppgifter</h3>' +
        '<div class="falt"><label for="foIuNamn">Projektnamn</label><input class="f" id="foIuNamn" data-uf="namn" value="' + esc(p.namn) + '"' + dis + '></div>' +
        '<div class="tva"><div class="falt"><label for="foIuNr">Projektnummer</label><input class="f" id="foIuNr" data-uf="nummer" value="' + esc(p.nummer) + '"' + dis + '></div>' +
        '<div class="falt"><label for="foIuPl">Projekteringsledare</label>' + foPersonSelect("foIuPl", p.plId, "–", ' data-uf="plId"' + dis) + '</div></div>' +
        '<div class="tva"><div class="falt"><label for="foIuBest">Beställare</label><input class="f" id="foIuBest" data-uf="bestallare" value="' + esc(p.bestallare) + '"' + dis + '></div>' +
        '<div class="falt"><label for="foIuEnt">Entreprenör</label><input class="f" id="foIuEnt" data-uf="entreprenor" value="' + esc(p.entreprenor) + '"' + dis + '></div></div>' +
        '<div class="tva"><div class="falt"><label for="foIuStart">Start</label><input class="f" type="date" id="foIuStart" data-uf="start" value="' + esc(p.start) + '"' + dis + '></div>' +
        '<div class="falt"><label for="foIuSlut">Slut</label><input class="f" type="date" id="foIuSlut" data-uf="slut" value="' + esc(p.slut) + '"' + dis + '></div></div>' +
        '<div class="falt"><label for="foIuBesk">Beskrivning</label><textarea class="f" id="foIuBesk" data-uf="beskrivning" rows="3"' + dis + '>' + esc(p.beskrivning) + '</textarea></div>' +
        '<p class="hjalp" style="margin:0">Ändringar sparas direkt.</p></div>';
    html += '<div><div class="dashblock"><h3>Arbetsflöde</h3>' +
        '<div class="falt"><label for="foIaSvarstid">Förinställd svarstid för nya frågor</label><div class="fo-svarstid"><input class="f" type="number" min="0" max="60" id="foIaSvarstid" value="' + (+p.inst.svarstid || 0) + '"' + dis + '><span>arbetsdagar</span></div>' +
        '<p class="hjalp" style="margin:4px 0 0">Fyller i Svar senast när en fråga skapas. Går att ändra eller ta bort på varje fråga. 0 = ingen förinställd svarstid.</p></div>' +
        '<p class="hjalp" style="margin:10px 0 0">Ett kompletterande svar på ett ofullständigt svar ger alltid Besvarad, så att frågeställaren gör en ny bedömning. Bara frågeställaren (eller en superuser) klarmarkerar.</p>' +
        '<p class="hjalp" style="margin:10px 0 0">Historik, revisionsmarkering och kvittering av ändringar i sak går inte att stänga av. Det är så spårbarheten bevaras.</p></div>';
    html += '<div class="dashblock"><h3>Åtkomst</h3>' + (moln
        ? '<p class="hjalp" style="margin-top:0">Projektet sparas i molnet. De som har åtkomst ser och arbetar i samma projekt.</p>' + foMedlemHtml(admin)
        : '<p class="hjalp" style="margin-top:0">Projektet sparas bara i den här webbläsaren. ' + (foMoln() && window.p4FormaMoln.farSkapa() ? "Flytta det till molnet för att dela det med andra och nå det från fler datorer." : foMoln() ? "Be huvudadmin om behörigheten Får skapa projekt för att kunna dela det i molnet." : "Logga in för att kunna dela projektet i molnet.") + '</p>' +
            (foMoln() && window.p4FormaMoln.farSkapa() ? '<button type="button" class="mknapp" id="foTillMoln">Flytta till molnet</button>' : "")) + '</div>';
    html += '<div class="dashblock"><h3>Data</h3><p class="hjalp" style="margin-top:0">Export av frågor och hela projektet finns under <button type="button" class="p4d-lank" data-fovy-lank="rapporter">Rapporter & export</button>.</p>' +
        (admin || !moln ? '<div class="fo-farozon"><button type="button" class="fo-farlank" id="foTaBort">' + (moln ? "Ta bort projektet för alla" : "Ta bort projektet från den här datorn") + '</button></div>' : "") + '</div>' +
        foKopiorHtml(moln, leda, admin) + '</div></div>';
    html += foAvisInstHtml(p, leda);
    yta.innerHTML = html;
    foKopplaAvisInst(yta, p, leda);
    yta.querySelectorAll("[data-uf]").forEach(el => el.addEventListener("change", () => {
        const a = {}; a[el.dataset.uf] = el.value;
        if (el.dataset.uf === "namn" && !el.value.trim()) { el.value = p.namn; return status("Projektet måste ha ett namn.", true); }
        if (foGor("projektUppgifter", a, true)) { foVisaSparat(el); foRitaHeader(); }
    }));
    const st = document.getElementById("foIaSvarstid");
    if (st) st.addEventListener("change", () => {
        const n = Math.max(0, Math.min(60, Math.round(+st.value || 0))); st.value = n;
        if (foGor("installning", { nyckel: "svarstid", varde: n, text: n ? "förinställd svarstid " + n + " arbetsdagar" : "ingen förinställd svarstid" }, true)) foVisaSparat(st);
    });
    yta.querySelectorAll("[data-fovy-lank]").forEach(b => b.addEventListener("click", () => foGaTill(b.dataset.fovyLank)));
    const tb = document.getElementById("foTaBort");
    if (tb) tb.addEventListener("click", () => {
        modal("Ta bort " + p.namn + "?", moln ? "Projektet tas bort för alla som har åtkomst. En sista säkerhetskopia sparas i molnet och kan återställas av Wimo." : "Projektet tas bort från den här webbläsaren.",
            '<p class="hjalp">Exportera projektet först om du vill spara en kopia. Skriv projektets namn för att bekräfta.</p><input class="f" id="foTbNamn" placeholder="' + esc(p.namn) + '">', [
            { txt: "Avbryt", fn: stangModal },
            { txt: "Ta bort", primar: true, fara: true, fn: async () => {
                if (document.getElementById("foTbNamn").value.trim() !== p.namn) return status("Skriv projektets namn exakt för att ta bort det.", true);
                stangModal();
                const id = foPid;
                if (moln && foKo.length) return status("Vänta tills dina ändringar är sparade i molnet innan du tar bort projektet.", true);
                if (moln) { try { await window.p4FormaMoln.radera(id); } catch (e) { return status("Projektet kunde inte tas bort i molnet. Kontrollera att du är administratör och har nät.", true); } }
                foTaBortLokalt(id);
                foGaTill("projekt");
                status("Projektet är borttaget.");
            } }]);
    });
    foKopiorKoppla(yta, admin);
    const tm = document.getElementById("foTillMoln");
    if (tm) tm.addEventListener("click", async () => {
        tm.disabled = true;
        try {
            const gammal = foPid, data = JSON.parse(JSON.stringify(p));
            const k = foKonto();
            const mig = data.personer.find(x => x.roll === "admin");
            if (mig && k && k.uid && !data.personer.some(x => x.uid === k.uid)) { mig.uid = k.uid; if (!mig.epost) mig.epost = (k.epost || "").toLowerCase(); }
            const id = await foSkapaProjekt(data.namn, data, true);
            foTaBortLokalt(gammal);
            foOppnaProjekt(id);
            foRita();
            status("Projektet ligger nu i molnet. Lägg till personer under Åtkomst.");
        } catch (e) { console.warn(e); tm.disabled = false; status("Projektet kunde inte flyttas till molnet. Kontrollera nätet och att Firestore-reglerna för Forma är publicerade.", true); }
    });
    foKopplaMedlemmar();
}
function foMedlemHtml(admin) {
    const m = foMolnMeta || { medlemmar: [], admins: [] };
    const personer = window.p4FormaMoln.personer();
    const namn = (uid) => { const x = personer.find(y => y.uid === uid); const pp = foP.personer.find(y => y.uid === uid); return x ? (x.namn || x.epost) : pp ? foPersonNamn(foP, pp.id) : "Wimo-konto"; };
    const ej = personer.filter(x => !m.medlemmar.includes(x.uid));
    return '<ul class="fo-medlemmar">' + m.medlemmar.map(uid => '<li><span>' + esc(namn(uid)) + (m.admins.includes(uid) ? ' <span class="fo-chip">Administratör</span>' : "") + '</span>' +
        (admin && uid !== window.p4FormaMoln.uid() ? '<button type="button" class="fo-minknapp" data-tabortmedlem="' + uid + '">Ta bort</button>' : "") + '</li>').join("") + '</ul>' +
        (admin ? (ej.length ? '<div class="fo-nyrad"><select class="f" id="foNyMedlem"><option value="">Välj person med Wimo-konto …</option>' + ej.map(x =>
            '<option value="' + x.uid + '">' + esc((x.namn || "") + (x.epost ? " – " + x.epost : "")) + '</option>').join("") + '</select>' +
            '<button type="button" class="mknapp" id="foLaggMedlem">Ge åtkomst</button></div>' : '<p class="hjalp">Alla Wimo-konton du kan se har redan åtkomst.</p>') +
            '<p class="hjalp" style="margin:8px 0 0">Listan visar Wimo-konton i dina Plan-projekt. Den som får åtkomst läggs in som kontakt med rollen Projektör första gången hen öppnar projektet.</p>' : "");
}
function foKopplaMedlemmar() {
    const lagg = document.getElementById("foLaggMedlem");
    const m = foMolnMeta || { medlemmar: [], admins: [] };
    if (lagg) lagg.addEventListener("click", async () => {
        const uid = document.getElementById("foNyMedlem").value;
        if (!uid) return status("Välj en person först.", true);
        try { await window.p4FormaMoln.medlemmar(foPid, m.medlemmar.concat(uid), m.admins); status("Personen har fått åtkomst till projektet."); }
        catch (e) { status("Åtkomsten kunde inte sparas. Bara projektets administratör kan ändra den.", true); }
    });
    document.querySelectorAll("[data-tabortmedlem]").forEach(b => b.addEventListener("click", async () => {
        const uid = b.dataset.tabortmedlem;
        try { await window.p4FormaMoln.medlemmar(foPid, m.medlemmar.filter(x => x !== uid), m.admins.filter(x => x !== uid)); status("Åtkomsten är borttagen."); }
        catch (e) { status("Åtkomsten kunde inte ändras.", true); }
    }));
}

/* ======================= Alla projekt ======================= */
function foVyProjekt(yta) {
    const lista = foAllaProjekt();
    const moln = foMoln(), farSkapa = moln && window.p4FormaMoln.farSkapa();
    let html = foTopp("Alla projekt", '<button class="navknapp" type="button" id="foImport">Importera</button>');
    html += '<p class="hjalp fo-ingress">Forma-projekten är skilda från projekten i Wimo Plan. Varje projekt har sina egna frågor, beslut, åtgärder, möten och kontakter.</p>';
    html += '<div class="fo-projektgrid">' + lista.map(x => {
        const lok = foLasLs(foLsProjekt(x.id), null), d = lok && lok.data;
        const n = d ? (d.fragor || []).filter(f => !f.makulerad && f.lage !== "klar").length : null;
        return '<button type="button" class="fo-projektkort' + (x.id === foPid ? " aktiv" : "") + '" data-projekt="' + x.id + '"><b>' + esc(x.namn) + '</b>' +
            '<span>' + (x.moln ? "I molnet" : "Bara på den här datorn") + (x.demo || (d && d.demo) ? " · demo" : "") + '</span>' +
            (n !== null ? '<small>' + n + (n === 1 ? " aktiv fråga" : " aktiva frågor") + '</small>' : '<small>Öppna för att hämta</small>') + '</button>';
    }).join("") +
        '<div class="fo-projektkort ny"><b>Nytt projekt</b><input class="f" id="foNyttNamn" placeholder="Projektets namn">' +
        (moln ? '<label class="fo-kryss"><input type="checkbox" id="foNyttMoln"' + (farSkapa ? " checked" : " disabled") + '> Spara i molnet och dela med andra</label>' +
            (farSkapa ? "" : '<small>Du behöver behörigheten Får skapa projekt av huvudadmin för att skapa molnprojekt.</small>') : '<small>Logga in för att spara projekt i molnet.</small>') +
        '<button type="button" class="p4-btn p4-btn-primar" id="foSkapa">Skapa projekt</button></div></div>';
    html += '<div class="dashblock fo-demoblock"><h3>Prova med påhittade uppgifter</h3><p class="hjalp" style="margin:0 0 10px">Demoprojektet har discipliner, personer, möten, frågor, beslut och åtgärder så att du kan prova allt. Det är tydligt märkt Demo och sparas bara på den här datorn.</p>' +
        '<button type="button" class="mknapp" id="foSkapaDemo">Skapa demoprojekt</button></div>';
    yta.innerHTML = html;
    yta.querySelectorAll("[data-projekt]").forEach(b => b.addEventListener("click", () => {
        foOppnaProjekt(b.dataset.projekt);
        foFilter = { snabb: "alla", sok: "", disc: "", plats: "", lage: "", mote: "", sort: "std", visaMak: false };
        foGaTill("oversikt");
    }));
    const skapa = async () => {
        const namn = document.getElementById("foNyttNamn").value.trim();
        if (!namn) { document.getElementById("foNyttNamn").focus(); return status("Skriv projektets namn.", true); }
        const iMoln = !!(document.getElementById("foNyttMoln") || {}).checked;
        try {
            const id = await foSkapaProjekt(namn, null, iMoln);
            foOppnaProjekt(id);
            foFlik.org = "disc";
            foGaTill("org");
            status("Projektet " + namn + " är skapat. Börja med discipliner och personer.");
        } catch (e) { console.warn(e); status("Projektet kunde inte skapas i molnet. Kontrollera nätet och att Firestore-reglerna för Forma är publicerade.", true); }
    };
    document.getElementById("foSkapa").addEventListener("click", skapa);
    document.getElementById("foNyttNamn").addEventListener("keydown", (e) => { if (e.key === "Enter") skapa(); });
    document.getElementById("foSkapaDemo").addEventListener("click", async () => {
        const k = foKonto(), n = foDelaNamn(k ? k.namn : "");
        const p = foDemoProjekt(k ? { fornamn: n.fornamn, efternamn: n.efternamn, epost: (k.epost || "").toLowerCase(), uid: k.uid } : null);
        const id = await foSkapaProjekt(p.namn, p, false);
        foOppnaProjekt(id);
        foGaTill("oversikt");
        status("Demoprojektet är skapat. Alla uppgifter är påhittade.");
    });
    document.getElementById("foImport").addEventListener("click", () => {
        const inp = document.createElement("input");
        inp.type = "file"; inp.accept = ".json,application/json";
        inp.addEventListener("change", async () => {
            const fil = inp.files[0]; if (!fil) return;
            try {
                const x = JSON.parse(await fil.text());
                if (x.format !== "wimo-forma" || !x.projekt) throw new Error("fel format");
                const p = foLaga(x.projekt);
                const id = await foSkapaProjekt(p.namn + " (importerat)", p, false);
                foOppnaProjekt(id); foGaTill("oversikt");
                status("Projektet importerades och sparas på den här datorn.");
            } catch (e) { status("Filen är inte en export från Wimo Forma.", true); }
        });
        inp.click();
    });
}

/* ======================= Säkerhetskopior ======================= */
const FO_KOPIA_ORSAK = { dygn: "Daglig kopia", krympt: "Före en större minskning", manuell: "Manuell kopia",
    "fore-rensaFragor": "Före arkivering av gamla frågor", "fore-aterstallning": "Före återställning", "fore-borttagning": "Före borttagning av projektet",
    "fore-ersattPerson": "Före Ersätt person", "fore-tpErsatt": "Före ändring i tidplan", "fore-tpTaBort": "Före borttagning i tidplan", "fore-tpAvbrytRev": "Före avbruten revidering" };
const foKopiaOrsak = (o) => FO_KOPIA_ORSAK[o] || (String(o || "").startsWith("fore-taBort") ? "Före borttagning" : "Före ändring");
function foKopiaTid(ms) { const d = new Date(ms); return isNaN(d) ? "" : d.toLocaleString("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function foKopiorHtml(moln, leda, admin) {
    const ej = foEjSparade().filter(x => x.projekt === foPid);
    let h = '<div class="dashblock"><h3>Säkerhetskopior</h3>';
    if (!moln) h += '<p class="hjalp" style="margin:0">Projektet sparas bara på den här datorn. Exportera det regelbundet under Rapporter & export, eller flytta det till molnet för automatiska säkerhetskopior.</p>';
    else {
        const k = ((foMolnMeta && foMolnMeta.kopior) || []).slice().sort((a, b) => b.tid - a.tid);
        h += '<p class="hjalp" style="margin-top:0">Molnet sparar en exakt kopia av projektet minst en gång per dygn och alltid före rensning och borttagningar. Kopiorna kan inte ändras eller tas bort. En kopia kan laddas ner och öppnas med Importera under Alla projekt.</p>';
        h += k.length ? '<table class="fo-kopior"><tbody>' + k.slice(0, 12).map(x => '<tr><td>' + esc(foKopiaTid(x.tid)) + '</td><td>' + esc(foKopiaOrsak(x.orsak)) + '</td><td class="fo-kopia-knappar">' +
            (leda ? '<button type="button" class="p4d-lank" data-fokopia-ner="' + esc(x.id) + '">Ladda ner</button>' : "") +
            (admin ? '<button type="button" class="p4d-lank" data-fokopia-ater="' + esc(x.id) + '" data-tid="' + x.tid + '">Återställ</button>' : "") + '</td></tr>').join("") + '</tbody></table>' +
            (k.length > 12 ? '<p class="hjalp" style="margin:6px 0 0">' + (k.length - 12) + ' äldre kopior finns också.</p>' : "")
            : '<p class="hjalp">Ingen kopia ännu. Den första tas vid nästa ändring.</p>';
        if (leda) h += '<button type="button" class="mknapp" id="foKopiaNu" style="margin-top:10px">Säkerhetskopiera nu</button>';
    }
    if (ej.length) h += '<div class="fo-ejsparade"><b>' + ej.length + (ej.length === 1 ? " ändring" : " ändringar") + ' kunde inte sparas</b><p class="hjalp" style="margin:4px 0 8px">Någon annan hann ändra samma sak först, eller så togs åtkomsten bort. Texten finns kvar här på datorn.</p>' +
        '<button type="button" class="p4d-lank" id="foEjNer">Ladda ner</button> <button type="button" class="p4d-lank" id="foEjRensa">Rensa listan</button></div>';
    return h + '</div>';
}
function foKopiorKoppla(yta, admin) {
    const pid = foPid;
    yta.querySelectorAll("[data-fokopia-ner]").forEach(b => b.addEventListener("click", async () => {
        b.disabled = true;
        try {
            const k = await window.p4FormaMoln.kopia(pid, b.dataset.fokopiaNer);
            if (!k || !k.data) throw new Error("saknas");
            foLaddaNer(foFilnamn(k.namn || foP.namn) + "-kopia-" + k.id + ".json", JSON.stringify({ format: "wimo-forma", version: FO_VER, exporterad: foNu(), kopia: { id: k.id, rev: k.rev, orsak: k.orsak }, projekt: k.data }, null, 1), "application/json");
        } catch (e) { console.warn(e); status("Kopian kunde inte hämtas. Kontrollera nätet.", true); }
        b.disabled = false;
    }));
    yta.querySelectorAll("[data-fokopia-ater]").forEach(b => b.addEventListener("click", () => {
        if (foKo.length) return status("Vänta tills dina ändringar är sparade i molnet innan du återställer.", true);
        modal("Återställ projektet?", "Till kopian från " + foKopiaTid(+b.dataset.tid),
            '<p class="hjalp">Projektet återställs för alla. Den nuvarande versionen sparas först som en ny kopia, så återställningen kan ångras. Skriv ÅTERSTÄLL för att bekräfta.</p><input class="f" id="foAterBekr" placeholder="ÅTERSTÄLL">', [
            { txt: "Avbryt", fn: stangModal },
            { txt: "Återställ", primar: true, fara: true, fn: async () => {
                if (document.getElementById("foAterBekr").value.trim().toUpperCase() !== "ÅTERSTÄLL") return status("Skriv ÅTERSTÄLL för att bekräfta.", true);
                stangModal();
                try { await window.p4FormaMoln.aterstall(pid, b.dataset.fokopiaAter); status("Projektet är återställt. Den tidigare versionen finns kvar som kopia."); }
                catch (e) { console.warn(e); status("Projektet kunde inte återställas. Kontrollera nätet och att du är administratör.", true); }
            } }]);
    }));
    const nu = document.getElementById("foKopiaNu");
    if (nu) nu.addEventListener("click", async () => {
        if (foKo.length) return status("Vänta tills dina ändringar är sparade i molnet.", true);
        nu.disabled = true;
        try { await window.p4FormaMoln.kopieraNu(pid); status("En säkerhetskopia är sparad i molnet."); }
        catch (e) { console.warn(e); status("Kopian kunde inte sparas. Försök igen om en stund.", true); }
        nu.disabled = false;
    });
    const en = document.getElementById("foEjNer");
    if (en) en.addEventListener("click", () => foLaddaNer(foFilnamn(foP.namn) + "-ej-sparade-" + foIdag() + ".json", JSON.stringify(foEjSparade().filter(x => x.projekt === pid), null, 1), "application/json"));
    const er = document.getElementById("foEjRensa");
    if (er) er.addEventListener("click", () => modal("Rensa listan?", "Ändringar som inte kunde sparas", '<p class="hjalp">Ladda ner listan först om du vill behålla texten.</p>', [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Rensa", primar: true, fara: true, fn: () => { foSkrivLs(FO_LS_EJSPARADE, foEjSparade().filter(x => x.projekt !== pid)); stangModal(); foRita(); } }]));
}

/* ======================= Hjälp ======================= */
function foHjalp() {
    modal("Hjälp för Wimo Forma", "Projekteringens frågor, svar, beslut och åtgärder", '<div class="fo-hjalp">' +
        '<h4>Byta mellan Plan och Forma</h4><p>Klicka på Wimo-loggan uppe till vänster och välj modul. Modulerna har var sin data och påverkar inte varandra.</p>' +
        '<h4>Ställa en fråga</h4><p>Skriv frågan i rutan överst i Aktiva frågor och tryck <kbd>Ctrl</kbd>+<kbd>Enter</kbd>. Bara texten behövs. Klistra in skärmklipp med <kbd>Ctrl</kbd>+<kbd>V</kbd>. Varje fråga får ett nummer som aldrig återanvänds.</p>' +
        '<h4>Fråga och svar</h4><p>En fråga kan riktas till flera som <b>ska svara</b> och till <b>berörda</b> som bara behöver känna till den. Flera kan svara, och frågeställaren kan ställa följdfrågor i samma fråga. Frågeställaren väljer vilket eller vilka svar som är det <b>slutliga beskedet</b> – det visas i frågelistan. Ett besked som någon lämnat muntligt kan registreras åt personen och märks då som registrerat av någon annan.</p>' +
        '<h4>Lägen</h4><p><b>Obesvarad</b> → <b>Besvarad</b> när ett svar lämnas → <b>Klar</b> när frågeställaren bedömer att frågan är tillräckligt besvarad. Alla mottagare behöver inte svara. Är svaret inte tillräckligt väljer frågeställaren <b>Svaret är ofullständigt</b>; nästa svar ger Besvarad igen. Bara frågeställaren eller en superuser klarmarkerar och återöppnar.</p>' +
        '<h4>Rätta, komplettera och revidera</h4><p>Allt som skrivs sparas som versioner. <b>Rätta</b> är för stavfel. <b>Komplettera</b> lägger till information. <b>Revidera</b> är en ändring i sak: orsak krävs och motparten kvitterar. Revideras det slutliga svaret i en klar fråga öppnas frågan igen. Kvittering betyder att man tagit del av ändringen, inte att man godkänner den.</p>' +
        '<h4>Tid och kostnad</h4><p>Alla projektmedlemmar kan markera <b>risk för tidspåverkan</b> och <b>risk för kostnadspåverkan</b>, även på andras frågor. Vid klarmarkering och beslut måste man bekräfta att konsekvenserna har kommunicerats och hanterats. Markeringen är en upplysning – inte ÄTA, underrättelse eller ekonomiskt godkännande.</p>' +
        '<h4>Beslut</h4><p>Ett svar blir aldrig automatiskt ett beslut. Administratör och projekteringsledare fastställer beslut från frågan. Ett beslut ändras aldrig — det ersätts eller kompletteras av ett nytt.</p>' +
        '<h4>Möten</h4><p>Markera frågor för nästa möte med <b>+ Möte</b>. Under Möten finns urvalet per forum, förslag på frågor som borde tas upp och en storskärmsvy för mötesrummet.</p>' +
        '<h4>Kortkommandon</h4><ul class="detalj"><li><span class="et"><kbd>N</kbd></span><span>Ny fråga</span></li><li><span class="et"><kbd>Ctrl</kbd>+<kbd>K</kbd> eller <kbd>/</kbd></span><span>Sök i projektet</span></li>' +
        '<li><span class="et"><kbd>Esc</kbd></span><span>Stäng frågan</span></li></ul></div>', [{ txt: "Stäng", primar: true, fn: stangModal }]);
}

/* ======================= Inbjudan, avslut och ersättning =======================
   Ingen server: inbjudan sparas som e-post + utgångstid på projektet i molnet. Bara den som
   loggar in med just den e-postadressen (bekräftad) kan gå med. Mejlet skickas från ditt eget
   mejlprogram. */
const FO_INBJUDAN_DAGAR = 14;
function foArMolnProjekt() { const l = foLista.find(x => x.id === foPid); return !!(l && l.moln && foMoln()); }
async function foBjudIn(ids) {
    if (!foArMolnProjekt()) return status("Projektet måste ligga i molnet för att någon ska kunna bjudas in.", true);
    const utgar = Date.now() + FO_INBJUDAN_DAGAR * 864e5, klara = [];
    for (const id of ids) {
        const x = foPerson(foP, id);
        if (!x || !x.epost) continue;
        try { await window.p4FormaMoln.inbjud(foPid, x.epost, utgar); }
        catch (e) { status("Inbjudan till " + foPersonNamn(foP, id) + " kunde inte sparas. Bara projektets administratör kan bjuda in.", true); continue; }
        if (foGor("bjudIn", { id: id, utgar: utgar }, true)) klara.push(x);
    }
    foRita();
    if (!klara.length) return;
    const lank = location.origin + location.pathname + "#forma/p:" + foPid;
    const amne = "Inbjudan till " + foP.namn + " i Wimo Forma";
    const text = "Hej!\n\nDu är inbjuden till projektet " + foP.namn + " i Wimo Forma.\n\nÖppna länken och logga in, eller skapa ett konto, med just den här e-postadressen:\n" + lank +
        "\n\nHar du skapat ett nytt konto behöver du först bekräfta e-postadressen via mejlet från Wimo.\nInbjudan gäller i " + FO_INBJUDAN_DAGAR + " dagar.\n";
    const till = klara.map(x => x.epost).join(",");
    modal("Skicka inbjudan", klara.length === 1 ? foPersonNamn(foP, klara[0].id) : klara.length + " personer",
        '<p>Inbjudan är sparad och gäller i ' + FO_INBJUDAN_DAGAR + ' dagar. Skicka nu mejlet från ditt mejlprogram, eller kopiera texten.</p>' +
        '<textarea class="f" id="foInbText" rows="8" readonly>' + esc(text) + '</textarea>' +
        '<p class="hjalp">Bara den som loggar in med inbjudans e-postadress får tillgång. En vidarebefordrad inbjudan ger ingen åtkomst.</p>',
        [{ txt: "Kopiera text", vanster: true, fn: () => { navigator.clipboard.writeText(text).then(() => status("Texten är kopierad.")); } },
         { txt: "Stäng", fn: stangModal },
         { txt: "Öppna i mejlprogrammet", primar: true, fn: () => { location.href = "mailto:" + (klara.length === 1 ? till : "") + "?" + (klara.length > 1 ? "bcc=" + encodeURIComponent(till) + "&" : "") + "subject=" + encodeURIComponent(amne) + "&body=" + encodeURIComponent(text); stangModal(); } }]);
}
async function foAterkalla(x) {
    try { if (foArMolnProjekt() && x.epost) await window.p4FormaMoln.aterkalla(foPid, x.inbjudan.epost || x.epost); }
    catch (e) { return status("Inbjudan kunde inte återkallas.", true); }
    if (foGor("aterkallaInbjudan", { id: x.id })) status("Inbjudan är återkallad.");
}
// Behörigheten Administratör ska också gälla i molnet (vem som får ändra åtkomst).
async function foSynkaAtkomst(x) {
    if (!x || !x.uid || !foArMolnProjekt() || !foMolnMeta) return;
    const m = foMolnMeta, admin = x.roll === "admin" && x.aktiv !== false;
    if (admin === m.admins.includes(x.uid) || !m.medlemmar.includes(x.uid)) return;
    try { await window.p4FormaMoln.medlemmar(foPid, m.medlemmar, admin ? m.admins.concat(x.uid) : m.admins.filter(u => u !== x.uid)); } catch (e) { console.warn(e); }
}
function foAnsvarText(a) {
    const r = [];
    if (a.stallare.length) r.push(a.stallare.length + " öppna frågor som frågeställare" + (a.bedoma.length ? " (" + a.bedoma.length + " svar väntar på bedömning)" : ""));
    if (a.mottagare.length) r.push(a.mottagare.length + " obesvarade/öppna frågor att svara på");
    if (a.atgarder.length) r.push(a.atgarder.length + " öppna åtgärder");
    if (a.avis.length) r.push("aviseringsmottagare för " + a.avis.map(d => d.kod).join(", "));
    return r;
}
// Avslutat medlemskap: åtkomsten upphör direkt. Kontaktposten och historiken finns kvar.
function foAvslutaDialog(x) {
    const p = foP, kvar = foAnsvarText(foAnsvarFor(p, x.id));
    modal("Avsluta medlemskap", foPersonNamn(p, x.id),
        '<p>Personens tillgång till projektet upphör direkt. Kontakten, allt hen har gjort och historiken finns kvar. Wimo-kontot och andra projekt påverkas inte.</p>' +
        (kvar.length ? '<div class="notis"><b>Kvarstående ansvar</b><ul>' + kvar.map(t => "<li>" + esc(t) + "</li>").join("") + '</ul>Du kan föra över det till någon annan nu eller senare.</div>' : ""),
        [{ txt: "Avbryt", fn: stangModal },
         ...(kvar.length ? [{ txt: "Avsluta och ersätt …", fn: () => { stangModal(); foAvsluta(x).then(ok => ok && foErsattDialog(x.id)); } }] : []),
         { txt: "Avsluta medlemskap", primar: true, fara: true, fn: () => { stangModal(); foAvsluta(x); } }]);
}
async function foAvsluta(x) {
    // Säkerheten först: ta bort åtkomsten i molnet innan något annat.
    if (foArMolnProjekt() && foMolnMeta) {
        const m = foMolnMeta;
        try {
            if (x.uid && m.medlemmar.includes(x.uid)) await window.p4FormaMoln.medlemmar(foPid, m.medlemmar.filter(u => u !== x.uid), m.admins.filter(u => u !== x.uid));
            if (x.inbjudan && x.epost) await window.p4FormaMoln.aterkalla(foPid, x.inbjudan.epost || x.epost);
        } catch (e) { status("Åtkomsten kunde inte tas bort. Bara projektets administratör kan göra det. Inget har ändrats.", true); return false; }
    }
    if (x.inbjudan) foGor("aterkallaInbjudan", { id: x.id }, true);
    const ok = foGor("sparaPerson", Object.assign({}, x, { aktiv: false }));
    if (ok) status(foPersonNamn(foP, x.id) + " har inte längre tillgång till projektet. Historiken finns kvar.");
    return !!ok;
}
function foAktiveraIgen(x) {
    if (foGor("sparaPerson", Object.assign({}, x, { aktiv: true })))
        status("Kontakten är aktiv igen." + (x.uid && foArMolnProjekt() ? " Bjud in personen igen för att ge tillgång till projektet." : ""));
}
// Ersätt projektmedlem: välj avgående, övertagande och vilka ansvar som följer med.
function foErsattDialog(franId) {
    const p = foP;
    const opt = (l, v) => '<option value="">Välj …</option>' + l.map(x => '<option value="' + x.id + '"' + (x.id === v ? " selected" : "") + '>' + esc(foPersonNamn(p, x.id)) + (x.aktiv === false ? " (avslutad)" : "") + '</option>').join("");
    const alla = p.personer.slice().sort((a, b) => foPersonNamn(p, a.id).localeCompare(foPersonNamn(p, b.id), "sv"));
    const kropp = '<div class="tva"><div class="falt"><label for="foErsFran">Avgående</label><select class="f" id="foErsFran">' + opt(alla, franId) + '</select></div>' +
        '<div class="falt"><label for="foErsTill">Tar över</label><select class="f" id="foErsTill">' + opt(alla.filter(x => x.aktiv !== false), "") + '</select></div></div>' +
        '<div id="foErsDelar"></div>' +
        '<p class="hjalp">Bara aktuellt ansvar förs över. Ställda frågor, lämnade svar, kvitteringar och låsta sammanställningar behåller sin ursprungliga person. Behörigheter och åtkomst ändras inte här.</p>';
    modal("Ersätt projektmedlem", "", kropp, [{ txt: "Avbryt", fn: stangModal }, { txt: "För över", primar: true, fn: () => {
        const fran = document.getElementById("foErsFran").value, till = document.getElementById("foErsTill").value;
        if (!fran || !till) return status("Välj båda personerna.", true);
        const delar = {}; document.querySelectorAll("[data-ersdel]").forEach(k => { delar[k.dataset.ersdel] = k.checked; });
        const n = foGor("ersattPerson", { fran: fran, till: till, delar: delar });
        if (n !== null) { stangModal(); status(n ? n + " ansvar fördes över till " + foPersonNamn(foP, till) + "." : "Det fanns inget aktuellt ansvar att föra över."); }
    } }]);
    const rita = () => {
        const fran = document.getElementById("foErsFran").value, el = document.getElementById("foErsDelar");
        if (!fran) { el.innerHTML = ""; return; }
        const a = foAnsvarFor(p, fran), x = foPerson(p, fran);
        const rad = (k, n, t) => '<label class="fo-kryss"><input type="checkbox" data-ersdel="' + k + '"' + (n ? " checked" : " disabled") + '> ' + esc(t) + ' <span class="hjalp">' + n + '</span></label>';
        el.innerHTML = '<div class="falt"><label>Ansvar som förs över</label>' +
            rad("stallare", a.stallare.length, "Öppna frågor som frågeställare (bedöma och klarmarkera)") +
            rad("mottagare", a.mottagare.length, "Öppna frågor att besvara") +
            rad("atgarder", a.atgarder.length, "Öppna åtgärder") +
            rad("avis", a.avis.length, "Aviseringsmottagare för discipliner") +
            rad("disc", (x.disc || []).length, "Discipliner") + "</div>";
    };
    document.getElementById("foErsFran").addEventListener("change", rita);
    rita();
}
