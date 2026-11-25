/* ======================================================================
   Wimo Forma · frågelistan som personlig vy
   Grundkolumner Nr, Från/Till, Fråga, Svar, Svar senast och Status.
   Var och en väljer själv kolumner, ordning, bredd, sortering, gruppering
   och kompakt eller utförlig visning. Vyn sparas per användare.
   Aktiva, Mina, Klara och Alla är olika vyer av samma frågeregister.
   ====================================================================== */

const FO_LAGEORDNING = { obesvarad: 0, ofullstandig: 1, besvarad: 2, klar: 3 };
const FO_FKOL = {
    nr: { namn: "Nr", bredd: 62, sort: f => f.nr },
    frantill: { namn: "Från/Till", bredd: 190, sort: f => foPersonNamn(foP, foStallarePerson(f)) },
    fraga: { namn: "Fråga", bredd: 0, sort: f => f.text.toLowerCase() },
    svar: { namn: "Svar", bredd: 300, sort: f => (foSvarText(f) || (foHarSvar(f) ? "~" : "~~")).toLowerCase() },
    senast: { namn: "Svar senast", bredd: 112, sort: f => f.svarSenast || "9999" },
    status: { namn: "Status", bredd: 178, sort: f => (f.makulerad ? 9 : FO_LAGEORDNING[f.lage]) },
    stallare: { namn: "Frågeställare", bredd: 150, sort: f => foPersonNamn(foP, foStallarePerson(f)) },
    foretag: { namn: "Företag", bredd: 150, sort: f => foRadForetag(f) },
    disc: { namn: "Disciplin", bredd: 100, sort: f => foDiscText(foP, f.fran) },
    ansvarig: { namn: "Ska svara", bredd: 160, sort: f => foMottagareText(foP, f) },
    berorda: { namn: "Berörda", bredd: 140, sort: f => f.berorda.length + f.berordaP.length },
    regav: { namn: "Registrerad av", bredd: 140, sort: f => foPersonNamn(foP, f.av) },
    stalld: { namn: "Ställd", bredd: 100, sort: f => f.skapad || "" },
    svarsdatum: { namn: "Svarsdatum", bredd: 104, sort: f => (foSenasteSvar(f) || {}).tid || "" },
    mote: { namn: "Mötesforum", bredd: 130, sort: f => f.moten.map(id => (foForum(foP, id) || {}).kort || "").join(",") },
    plats: { namn: "Plats", bredd: 120, sort: f => foRadPlats(f) },
    bilagor: { namn: "Bilagor", bredd: 78, sort: f => f.bilagor.length },
    logg: { namn: "Beslutslogg", bredd: 104, sort: f => f.ilogg ? 0 : 1 },
    tid: { namn: "Tidspåverkan", bredd: 110, sort: f => foKonsAktiva(f, "tid").length },
    kostnad: { namn: "Kostnadspåverkan", bredd: 124, sort: f => foKonsAktiva(f, "kostnad").length }
};
const FO_FKOL_STD = ["nr", "frantill", "fraga", "svar", "senast", "status"];
const FO_GRUPPER = [["", "Ingen gruppering"], ["disc", "Frågeställarens disciplin"], ["foretag", "Frågeställarens företag"], ["stallare", "Frågeställare"],
    ["mottagare", "Ska svara"], ["lage", "Status"], ["mote", "Mötesforum"]];
let foListaAlla = false;

function foFragevyNyckel() { const k = foKonto(); return "wimo_forma_fragevy_" + ((k && (k.uid || k.epost)) || "lokal"); }
function foFragevy() {
    const v = foLasLs(foFragevyNyckel(), null) || {};
    const kol = Array.isArray(v.kol) ? v.kol.filter(k => FO_FKOL[k]) : FO_FKOL_STD.slice();
    if (!kol.includes("nr")) kol.unshift("nr");
    if (!kol.includes("fraga")) kol.splice(Math.min(2, kol.length), 0, "fraga");
    return { kol: kol, bredd: v.bredd || {}, tat: v.tat === "kompakt" ? "kompakt" : "utforlig", grupp: v.grupp || { klara: "disc" } };
}
function foSparaFragevy(v) { foSkrivLs(foFragevyNyckel(), v); }

function foRadForetag(f) { const x = foPerson(foP, foStallarePerson(f)), ft = x ? foForetag(foP, x.foretagId) : null; return ft ? ft.namn : ""; }
function foRadPlats(f) { return f.indelning.map(id => (foVarde(foP, id) || { varde: { namn: "" } }).varde.namn).filter(Boolean).join(", "); }
function foRadGruppNyckel(f, g) {
    const p = foP;
    if (g === "disc") { const d = foDisc(p, f.fran); return d ? [d.id, d.kod + " – " + d.namn, d.ordning || 0] : ["", "Utan disciplin", 999]; }
    if (g === "foretag") { const n = foRadForetag(f); return [n, n || "Utan företag", n ? 0 : 1]; }
    if (g === "stallare") { const n = foPersonNamn(p, foStallarePerson(f)); return [n, n || "Okänd", 0]; }
    if (g === "mottagare") { const n = foMottagareText(p, f, true); return [n, n || "Ingen mottagare", n ? 0 : 1]; }
    if (g === "lage") return f.makulerad ? ["mak", "Makulerad", 9] : [f.lage, FO_LAGE[f.lage].namn, FO_LAGEORDNING[f.lage]];
    if (g === "mote") { const fo = f.moten.map(id => foForum(p, id)).filter(Boolean); return fo.length ? [fo[0].id, fo.map(x => x.namn).join(", "), 0] : ["", "Inget möte", 1]; }
    if (g && g.startsWith("ind:")) {
        const ind = p.indelningar.find(i => i.id === g.slice(4));
        const v = ind ? ind.varden.find(x => f.indelning.includes(x.id)) : null;
        return v ? [v.id, v.namn, ind.varden.indexOf(v)] : ["", "Ingen " + (ind ? ind.namn.toLowerCase() : "plats"), 999];
    }
    return ["", "", 0];
}

/* ---------- celler ---------- */
function foDatumVecka(iso) { return iso ? foDatumKort(iso) + ' <span class="fo-vecka">v. ' + foVecka(iso) + '</span>' : ""; }
function foCell(k, f, ctx) {
    const p = foP;
    switch (k) {
        case "nr": return '<b class="fo-nrtal">' + f.nr + (ctx.nytt ? '<span class="fo-nyprick-rod" title="Ändrad sedan du tittade senast"><span class="sr">Ny</span></span>' : "") + '</b>' +
            (f.stjarna ? ' <span class="fo-stjarna" style="color:#b8860b" title="Sparas alltid">★</span>' : "");
        case "frantill": {
            const fr = foPersonNamn(p, foStallarePerson(f)), dk = foDiscText(p, f.fran);
            const mott = foMottagare(f);
            const till = mott.length ? mott.map(m => '<span class="' + (foHarSvarat(p, f, m) ? "fo-harsv" : "") + '" title="' + (foHarSvarat(p, f, m) ? "Har svarat" : "Har inte svarat") + '">' + esc(foPartText(p, m)) + '</span>').join(", ") : '<i class="fo-dampad">ingen</i>';
            return '<span class="fo-ft"><span class="fo-ftfran">' + esc(fr || "–") + (dk ? ' ' + foDiscChip(p, f.fran) : "") + '</span><span class="fo-fttill"><span class="fo-pil" aria-hidden="true">→</span> ' + till + '</span></span>';
        }
        case "fraga": return '<span class="fo-fragetext">' + esc(f.text) + '</span>' +
            (f.bilagor.length && !ctx.kol.includes("bilagor") ? ' <span class="fo-gemtal" title="' + f.bilagor.length + (f.bilagor.length === 1 ? " bilaga" : " bilagor") + '"><i class="fo-gem" aria-hidden="true"></i>' + f.bilagor.length + '</span>' : "") +
            (f.textVer.some(v => v.typ === "andring") ? ' <span class="fo-tagg t-rev" title="Frågan har reviderats">Rev</span>' : "");
        case "svar": {
            const slut = foSlutliga(f), sv = foSvarPoster(f);
            if (slut.length) return '<span class="fo-svartext">' + esc(slut.map(x => x.text).join("\n\n")) + '</span>' + (sv.length > slut.length ? '<small class="fo-svarantal">' + sv.length + ' svar i dialogen</small>' : "");
            if (sv.length) return '<span class="fo-svarprelim" title="Inget svar är valt som slutligt besked ännu">' + esc(sv[sv.length - 1].text) + '</span><small class="fo-svarantal">' +
                (sv.length === 1 ? "1 svar" : sv.length + " svar") + ' · slutligt svar inte valt</small>';
            return '<span class="fo-dampad">–</span>';
        }
        case "senast": return f.svarSenast ? '<span class="' + (ctx.sen ? "fo-sentext" : "") + '">' + foDatumVecka(f.svarSenast) + '</span>' : '<span class="fo-dampad">–</span>';
        case "status": return '<div class="fo-taggrad">' + (ctx.ok.length ? '<span class="fo-lage revision">Att kvittera</span>' : foLageChip(f)) +
            (ctx.sen ? '<span class="fo-tagg t-sen">Försenad</span>' : "") + (f.bradskande && foAktiv(f) ? '<span class="fo-tagg t-sen">Brådskande</span>' : "") + (ctx.kol.includes("tid") || ctx.kol.includes("kostnad") ? "" : foKonsTaggar(f)) +
            (f.moten.length && !ctx.kol.includes("mote") ? '<span class="fo-tagg t-mote" title="Tas upp på möte">Möte ' + f.moten.map(id => esc((foForum(p, id) || { kort: "?" }).kort)).join(" · ") + '</span>' : "") + '</div>';
        case "stallare": return esc(foPersonNamn(p, foStallarePerson(f)) || "–");
        case "foretag": return esc(foRadForetag(f) || "–");
        case "disc": return esc(foDiscText(p, f.fran) || "–");
        case "ansvarig": return esc(foMottagareText(p, f) || "–");
        case "berorda": return esc(f.berorda.map(id => foDiscText(p, id)).concat(f.berordaP.map(id => foPersonNamn(p, id))).join(", ") || "–");
        case "regav": return esc(foPersonNamn(p, f.av) || "–");
        case "stalld": return foDatumVecka(foDag(f.skapad));
        case "svarsdatum": { const s = foSenasteSvar(f); return s ? foDatumKort(s.tid) : '<span class="fo-dampad">–</span>'; }
        case "mote": return f.moten.length ? f.moten.map(id => esc((foForum(p, id) || { namn: "?" }).namn)).join(", ") : '<span class="fo-dampad">–</span>';
        case "plats": return esc(foRadPlats(f) || "–");
        case "logg": return foKanLoggaFraga(p, foJagId(), f) && !f.makulerad
            ? '<button type="button" class="fo-minknapp' + (f.ilogg ? " fo-pa" : "") + '" data-loggval="' + f.id + '" aria-pressed="' + !!f.ilogg + '" title="Inkludera i beslutsloggen">' + (f.ilogg ? "✓ Ingår" : "Inkludera") + '</button>'
            : (f.ilogg ? "✓ Ingår" : '<span class="fo-dampad">–</span>');
        case "bilagor": return f.bilagor.length ? '<span class="fo-gemtal"><i class="fo-gem" aria-hidden="true"></i>' + f.bilagor.length + '</span>' : '<span class="fo-dampad">–</span>';
        case "tid": case "kostnad": {
            const l = foKonsAktiva(f, k);
            return l.length ? '<span class="fo-tagg t-varn" title="' + esc(l.map(x => foPersonNamn(p, x.av) + (x.kommentar ? ": " + x.kommentar : "")).join("\n")) + '">Risk' + (l.length > 1 ? " ×" + l.length : "") + '</span>' : '<span class="fo-dampad">–</span>';
        }
    }
    return "";
}

/* ---------- tabellen ---------- */
function foFragaTabellVy(lista, vy) {
    const p = foP, jag = foJagId(), idag = foIdag(), v = foFragevy();
    const kol = v.kol, forum = foForumValbara(p);
    const grupp = v.grupp[vy] || "";
    const sortKol = (foFilter.sort || "").startsWith("kol:") ? foFilter.sort.split(":") : null;
    // gruppera (ordningen inom en grupp följer sorteringen)
    let rader = lista;
    let grupper = null;
    if (grupp) {
        const m = new Map();
        lista.forEach(f => { const [nyckel, namn, ordn] = foRadGruppNyckel(f, grupp); if (!m.has(nyckel)) m.set(nyckel, { namn, ordn, l: [] }); m.get(nyckel).l.push(f); });
        grupper = [...m.values()].sort((a, b) => a.ordn - b.ordn || a.namn.localeCompare(b.namn, "sv"));
        rader = [].concat(...grupper.map(g => g.l));
    }
    const max = foListaAlla ? Infinity : 300;
    const visas = rader.slice(0, max);
    const valj = typeof foValjLage !== "undefined" && foValjLage;
    const kolgrp = '<colgroup>' + (valj ? '<col style="width:42px">' : "") + kol.map(k => '<col data-kol="' + k + '"' + ((v.bredd[k] || FO_FKOL[k].bredd) ? ' style="width:' + (v.bredd[k] || FO_FKOL[k].bredd) + 'px"' : "") + '>').join("") + '<col style="width:148px"></colgroup>';
    const huvud = '<thead><tr>' + (valj ? '<th class="fo-valjkol"><span class="sr">Välj</span></th>' : "") + kol.map(k => {
        const s = sortKol && sortKol[1] === k ? sortKol[2] : "";
        return '<th class="fo-th-' + k + '" data-sortkol="' + k + '" aria-sort="' + (s === "asc" ? "ascending" : s === "desc" ? "descending" : "none") + '" tabindex="0" title="Sortera efter ' + esc(FO_FKOL[k].namn.toLowerCase()) + '">' +
            '<span class="fo-thtext">' + esc(FO_FKOL[k].namn) + (s ? '<i class="fo-sortpil" aria-hidden="true">' + (s === "asc" ? "↑" : "↓") + '</i>' : "") + '</span>' +
            '<span class="fo-kolgrep" data-kolgrep="' + k + '" aria-hidden="true"></span></th>';
    }).join("") + '<th class="fo-snabbkol"><span class="sr">Snabbval</span></th></tr></thead>';
    let html = "", gi = -1, kvar = visas.length;
    let i = 0;
    const radHtml = f => {
        const ok = foOkvitterade(f), sen = foForsenad(f, idag), nytt = foNytt(p, jag, f);
        const kanKlar = (f.lage === "besvarad" || f.lage === "ofullstandig") && foHarSvar(f) && !foOkvittSvar(f).length && foFragaAgare(p, jag, f) && !!jag;
        const ctx = { ok, sen, nytt, kol };
        return '<tr data-fraga="' + f.id + '" data-rad="' + f.id + '" class="' + (f.id === foFragaOppen ? "vald " : "") + (ok.length ? "okvitt " : "") + (nytt ? "olast " : "") + (f.makulerad ? "mak" : "") + '" tabindex="0">' +
            (valj ? '<td class="fo-valjkol"><input type="checkbox" data-valj="' + f.id + '"' + (foValdaFragor.has(f.id) ? " checked" : "") + ' aria-label="Välj fråga ' + f.nr + '"></td>' : "") +
            kol.map(k => '<td class="fo-td-' + k + (k === "nr" ? " fo-nrkol" : "") + '">' + foCell(k, f, ctx) + '</td>').join("") +
            // Klar och Möte står alltid på samma plats i kolumnen: saknas en knapp hålls platsen tom.
            '<td class="fo-snabbkol">' + (kanKlar ? '<button type="button" class="fo-minknapp klar" data-klar="' + f.id + '" title="Klarmarkera frågan">Klar</button>' : '<span class="fo-minknapp klar fo-platshallare" aria-hidden="true">Klar</span>') +
            (foKanSkriva(p, jag) && forum.length && !f.makulerad ? '<button type="button" class="fo-minknapp fo-hover' + (f.moten.length ? " pa" : "") + '" data-motesval="' + f.id + '" title="Markera för möte">' +
                (f.moten.length ? "På möte" : "+ Möte") + '</button>' : "") + '</td></tr>';
    };
    if (grupper) {
        for (const g of grupper) {
            if (i >= visas.length) break;
            html += '<tr class="fo-grupprad"><th colspan="' + (kol.length + 1 + (valj ? 1 : 0)) + '" scope="rowgroup">' + esc(g.namn) + ' <span>' + g.l.length + '</span></th></tr>';
            for (const f of g.l) { if (i >= visas.length) break; html += radHtml(f); i++; }
        }
    } else html = visas.map(radHtml).join("");
    void gi; void kvar;
    return '<div class="fo-tabellram fo-kolram"><table class="lista fo-tabell fo-fragetabell fo-kolvy ' + (v.tat === "kompakt" ? "kompakt" : "utforlig") + '">' + kolgrp + huvud + '<tbody>' + html + '</tbody></table></div>' +
        (rader.length > visas.length ? '<div class="fo-visafler"><button type="button" class="mknapp" id="foVisaAlla">Visa alla ' + rader.length + ' frågor</button><span class="hjalp">Visar de första ' + visas.length + '.</span></div>' : "");
}
// Sortering efter vald kolumn.
function foSorteraKol(lista, sort) {
    const [, k, dir] = sort.split(":");
    const fn = (FO_FKOL[k] || FO_FKOL.nr).sort, m = dir === "desc" ? -1 : 1;
    return lista.sort((a, b) => { const x = fn(a), y = fn(b); return (x < y ? -1 : x > y ? 1 : 0) * m || (a.nr - b.nr) * m; });
}
function foKopplaKolumner(rot) {
    rot.querySelectorAll("th[data-sortkol]").forEach(th => {
        const sortera = () => {
            const k = th.dataset.sortkol, nu = (foFilter.sort || "").split(":");
            foFilter.sort = nu[0] === "kol" && nu[1] === k ? (nu[2] === "asc" ? "kol:" + k + ":desc" : "std") : "kol:" + k + ":asc";
            foRita();
        };
        th.addEventListener("click", (e) => { if (!e.target.closest("[data-kolgrep]")) sortera(); });
        th.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); sortera(); } });
    });
    rot.querySelectorAll("[data-kolgrep]").forEach(g => g.addEventListener("pointerdown", (e) => {
        e.preventDefault(); e.stopPropagation();
        const k = g.dataset.kolgrep, col = rot.querySelector('col[data-kol="' + k + '"]'), th = g.closest("th");
        const start = e.clientX, b0 = th.getBoundingClientRect().width;
        document.body.classList.add("fo-drar-kol");
        const flytta = (ev) => { col.style.width = Math.max(48, Math.round(b0 + ev.clientX - start)) + "px"; };
        const slapp = () => {
            document.removeEventListener("pointermove", flytta); document.removeEventListener("pointerup", slapp);
            document.body.classList.remove("fo-drar-kol");
            const v = foFragevy(); v.bredd[k] = parseInt(col.style.width, 10); foSparaFragevy(v);
        };
        document.addEventListener("pointermove", flytta); document.addEventListener("pointerup", slapp);
    }));
    rot.querySelectorAll("[data-kolgrep]").forEach(g => g.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        const v = foFragevy(); delete v.bredd[g.dataset.kolgrep]; foSparaFragevy(v); foRita();
    }));
    const alla = rot.querySelector("#foVisaAlla"); if (alla) alla.addEventListener("click", () => { foListaAlla = true; foRita(); });
}

/* ---------- Anpassa vy ---------- */
function foVyDialog(vy) {
    const p = foP;
    let v = foFragevy();
    const grupper = FO_GRUPPER.concat(p.indelningar.map(i => ["ind:" + i.id, i.namn]));
    const rita = () => {
        const valda = v.kol, ovriga = Object.keys(FO_FKOL).filter(k => !valda.includes(k));
        const rad = (k, pa, i) => '<li class="fo-kolrad' + (pa ? " pa" : "") + '"><label class="fo-kryss"><input type="checkbox" data-kolpa="' + k + '"' + (pa ? " checked" : "") + (k === "nr" || k === "fraga" ? " disabled" : "") + '> ' + esc(FO_FKOL[k].namn) + '</label>' +
            (pa ? '<span class="fo-kolflytt"><button type="button" class="fo-minknapp" data-kolupp="' + k + '"' + (i === 0 ? " disabled" : "") + ' aria-label="Flytta ' + esc(FO_FKOL[k].namn) + ' åt vänster">↑</button>' +
                '<button type="button" class="fo-minknapp" data-kolner="' + k + '"' + (i === valda.length - 1 ? " disabled" : "") + ' aria-label="Flytta ' + esc(FO_FKOL[k].namn) + ' åt höger">↓</button></span>' : "") + '</li>';
        document.getElementById("foVyKropp").innerHTML =
            '<div class="fo-vygrid"><div><h4 class="fo-raph4" style="margin-top:0">Kolumner</h4><p class="hjalp" style="margin-top:0">Ordningen uppifrån och ned blir vänster till höger. Bredden ändrar du genom att dra i kolumnkanten i listan.</p>' +
            '<ol class="fo-kollista">' + valda.map((k, i) => rad(k, true, i)).join("") + '</ol><ul class="fo-kollista ovriga">' + ovriga.map(k => rad(k, false)).join("") + '</ul></div>' +
            '<div><h4 class="fo-raph4" style="margin-top:0">Visning</h4><div class="lage" id="foVyTat"><button type="button" data-tat="utforlig" class="' + (v.tat !== "kompakt" ? "vald" : "") + '">Utförlig</button>' +
            '<button type="button" data-tat="kompakt" class="' + (v.tat === "kompakt" ? "vald" : "") + '">Kompakt</button></div>' +
            '<p class="hjalp">Kompakt visar en rad per fråga. Utförlig visar mer av frågan och svaret.</p>' +
            '<h4 class="fo-raph4">Gruppera ' + ({ aktiva: "Aktiva frågor", mina: "Mina frågor", klara: "Klara frågor", alla: "Alla frågor" }[vy] || "") + '</h4>' +
            '<select class="f" id="foVyGrupp">' + grupper.map(([k, t]) => '<option value="' + k + '"' + ((v.grupp[vy] || "") === k ? " selected" : "") + '>' + esc(t) + '</option>').join("") + '</select>' +
            '<p class="hjalp">Grupperingen sparas för varje frågevy för sig.</p>' +
            '<button type="button" class="p4d-lank" id="foVyStd" style="margin-top:14px">Återställ standardvyn</button></div></div>';
        const k = document.getElementById("foVyKropp");
        k.querySelectorAll("[data-kolpa]").forEach(c => c.addEventListener("change", () => {
            const id = c.dataset.kolpa;
            v.kol = c.checked ? v.kol.concat(id) : v.kol.filter(x => x !== id); rita();
        }));
        k.querySelectorAll("[data-kolupp],[data-kolner]").forEach(b => b.addEventListener("click", () => {
            const id = b.dataset.kolupp || b.dataset.kolner, i = v.kol.indexOf(id), j = i + (b.dataset.kolupp ? -1 : 1);
            if (j < 0 || j >= v.kol.length) return;
            [v.kol[i], v.kol[j]] = [v.kol[j], v.kol[i]]; rita();
            const ny = k.querySelector('[data-' + (b.dataset.kolupp ? "kolupp" : "kolner") + '="' + id + '"]'); if (ny && !ny.disabled) ny.focus();
        }));
        k.querySelectorAll("[data-tat]").forEach(b => b.addEventListener("click", () => { v.tat = b.dataset.tat; rita(); }));
        k.querySelector("#foVyGrupp").addEventListener("change", (e) => { v.grupp = Object.assign({}, v.grupp, { [vy]: e.target.value }); });
        k.querySelector("#foVyStd").addEventListener("click", () => { v = { kol: FO_FKOL_STD.slice(), bredd: {}, tat: "utforlig", grupp: { klara: "disc" } }; rita(); });
    };
    modal("Anpassa vyn", "Din personliga frågelista – sparas för ditt konto på den här datorn", '<div id="foVyKropp"></div>', [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Spara vyn", primar: true, fn: () => { foSparaFragevy(v); stangModal(); foRita(); status("Din vy är sparad."); } }
    ]);
    rita();
}
