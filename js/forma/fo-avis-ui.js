/* ======================================================================
   Wimo Forma · aviseringar i gränssnittet
   Min översikt (alla projekt), klockan i toppraden, Påminn och Påminn flera,
   Begär kvittering, uppföljning för projekteringsledaren, projektets regler,
   personliga inställningar och mejlkön.
   ====================================================================== */

/* ---------- alla mina projekt ---------- */
let foAllaData = {};          // id → { id, namn, p, moln, hamtad }
let foAllaLaddar = null, foAllaTid = 0;
// Vem är jag i ett visst projekt (samma regel som foJagId, men för vilket projekt som helst).
function foJagIdI(p) {
    if (!p) return "";
    const k = foKonto();
    if (k && k.uid) { const x = p.personer.find(y => y.uid === k.uid); if (x) return x.id; }
    if (k && k.epost) { const x = p.personer.find(y => y.epost && y.epost === k.epost.toLowerCase()); if (x) return x.id; }
    if (!k || (!k.uid && !k.epost)) { const a = p.personer.find(y => y.roll === "admin" && y.aktiv); if (a) return a.id; }
    return "";
}
async function foLaddaAlla(tvinga) {
    if (foAllaLaddar) return foAllaLaddar;
    if (!tvinga && Date.now() - foAllaTid < 120000) return foAllaData;
    foAllaLaddar = (async () => {
        const ut = {};
        for (const x of foAllaProjekt()) {
            try {
                let p = null;
                if (x.id === foPid && foP) p = foP;
                else if (x.moln && foMoln()) { const d = await window.p4FormaMoln.hamta(x.id); p = d && d.data ? foLaga(typeof d.data === "string" ? JSON.parse(d.data) : d.data) : null; }
                if (!p) { const lok = foLasLs(foLsProjekt(x.id), null); p = lok && lok.data ? foLaga(lok.data) : null; }
                if (p) ut[x.id] = { id: x.id, namn: p.namn || x.namn, p: p, moln: !!x.moln };
            } catch (e) { console.warn("Forma: kunde inte läsa " + x.namn, e); }
        }
        foAllaData = ut; foAllaTid = Date.now();
        return ut;
    })();
    try { return await foAllaLaddar; } finally { foAllaLaddar = null; }
}
// Projekten med det öppna projektet alltid färskt.
function foAllaNu() {
    const ut = Object.assign({}, foAllaData);
    if (foP && foPid) ut[foPid] = { id: foPid, namn: foP.namn, p: foP, moln: !!(foLista.find(x => x.id === foPid) || {}).moln };
    return Object.values(ut).sort((a, b) => a.namn.localeCompare(b.namn, "sv"));
}
// Öppnar ett objekt i ett (annat) projekt.
function foOppnaObj(pid, obj, fid) {
    if (pid && pid !== foPid) {
        if (!foOppnaProjekt(pid)) return status("Projektet kunde inte öppnas.", true);
        foFilter = { snabb: "alla", sok: "", disc: "", plats: "", lage: "", mote: "", sort: "std", visaMak: false };
    }
    const p = foP;
    const typ = obj ? obj.typ : fid ? "fraga" : "";
    const id = obj ? obj.id : fid;
    if (typ === "fraga") { const f = foFraga(p, id); if (f) return foGaTill(f.lage === "klar" ? "klara" : "aktiva", f.id); }
    if (typ === "beslut") { foGaTill("beslut"); return setTimeout(() => { const b = foBeslut(foP, id); if (b) foBeslutVisa(b); }, 30); }
    if (typ === "atgard") { foFlik.atg = "alla"; foGaTill("atgarder"); return setTimeout(() => foMarkeraRad(id), 30); }
    if (typ === "inlagg") { foGaTill("flode"); return setTimeout(() => foVisaInlagg(id), 30); }
    if (typ === "forum") { foFlik.mote = id; return foGaTill("moten"); }
    if (typ === "protokoll") { const x = (p.protokoll || []).find(y => y.id === id); if (x) foFlik.mote = x.forum; return foGaTill("moten"); }
    foGaTill("oversikt");
}

/* ---------- arbetsytan som lista ---------- */
// Personlig prioritering: stjärnor på uppgifter. Påverkar bara den egna översikten.
let foPrio = null;
function foPrioNyckel() { const k = foKonto(); return "wimo_forma_prio_" + ((k && (k.uid || k.epost)) || "lokal"); }
function foPrioLas() {
    if (foPrio) return foPrio;
    foPrio = foLasLs(foPrioNyckel(), {});
    if (foMoln() && window.p4FormaMoln.privatLas) window.p4FormaMoln.privatLas().then(d => {
        if (d && d.prio && typeof d.prio === "object") { foPrio = Object.assign({}, d.prio, foPrio); foSkrivLs(foPrioNyckel(), foPrio); if (foVy === "min") foRita(); }
    }).catch(() => { });
    return foPrio;
}
function foPrioSpara() {
    foSkrivLs(foPrioNyckel(), foPrio);
    if (foMoln() && window.p4FormaMoln.privatSattFalt) window.p4FormaMoln.privatSattFalt({ prio: foPrio }).catch(e => console.warn(e));
}
function foArbNyckel(pid, x) { return pid + "|" + x.kat + "|" + (x.fid || x.aid || x.kid || (x.obj ? x.obj.id : "") || x.nr); }
function foArbRad(pid, p, x, opt) {
    opt = opt || {};
    const t = [];
    if (opt.projekt) t.push('<span class="fo-arbproj">' + esc(opt.projekt) + '</span>');
    if (x.forsenad) t.push('<b class="rodtal">Försenad' + (x.dagarSen ? " " + x.dagarSen + (x.dagarSen === 1 ? " arbetsdag" : " arbetsdagar") : "") + '</b>');
    else if (x.sistaDag) t.push('<b class="fo-orangetal">Sista dag idag</b>');
    else if (x.senast) t.push((x.kat === "atgard" || x.kat === "invAtgard" ? "Klar senast " : "Svar senast ") + foDatumKort(x.senast) + " v. " + foVecka(x.senast));
    if (x.bradskande) t.push('<b class="rodtal">Brådskande</b>');
    if (x.vad) t.push(esc(x.vad));
    if (x.ejSlutligt) t.push("välj slutligt svar");
    if (x.mottagare) t.push((x.kat && x.kat.startsWith("inv") ? "hos " : "väntar på ") + esc(x.mottagare));
    const nr = x.nr ? x.nr : "";
    const nyckel = foArbNyckel(pid, x), prio = opt.stjarna && !!(foPrioLas()[nyckel]);
    const svar = x.svar ? '<span class="fo-arbsvar"><b>' + esc(foPersonNamn(p, x.svar.av) || "–") + '</b> · ' + foNarText(x.svar.tid) + (x.svar.bilagor ? " · " + x.svar.bilagor + (x.svar.bilagor === 1 ? " bilaga" : " bilagor") : "") +
        '<span>' + esc(String(x.svar.text).slice(0, 220)) + (x.svar.text.length > 220 ? "…" : "") + '</span></span>' : "";
    return '<li data-arb="' + esc(pid) + '|' + esc(x.fid || "") + '|' + esc(x.aid || "") + '|' + esc(x.obj ? x.obj.typ + ":" + x.obj.id : "") + '"><span class="fo-agnr">' + esc(String(nr)) + '</span>' +
        '<span class="fo-agtext">' + esc(String(x.text || "").slice(0, 200)) + svar + '<small>' + t.join(" · ") + '</small></span>' +
        (opt.stjarna ? '<button type="button" class="fo-prioknapp' + (prio ? " pa" : "") + '" data-prio="' + esc(nyckel) + '" aria-pressed="' + prio + '" title="' + (prio ? "Ta bort från mina prioriterade" : "Prioritera (syns bara för dig)") + '">' + (prio ? "★" : "☆") + '</button>' : "") + '</li>';
}
function foArbHtml(pid, p, lista, max, opt) {
    const ordning = ["eskalera", "kvittera", "svara", "komplettera", "bedoma", "kontrollera", "atgard", "protokoll", "invSvar", "invKompl", "invAtgard", "invKvitt"];
    const rub = Object.assign({}, FO_ARB_RUB, typeof FO_INV_RUB !== "undefined" ? FO_INV_RUB : {});
    return ordning.filter(k => lista.some(x => x.kat === k)).map(k => {
        const l = lista.filter(x => x.kat === k);
        return '<div class="fo-aggrupp"><h4>' + rub[k] + ' <span class="antal">' + l.length + '</span></h4><ul class="atglista fo-aglista">' +
            l.slice(0, max || 8).map(x => foArbRad(x.pid || pid, x.p || p, x, Object.assign({}, opt, { projekt: opt && opt.visaProjekt ? x.pnamn : "" }))).join("") + '</ul>' +
            (l.length > (max || 8) ? '<p class="hjalp">och ' + (l.length - (max || 8)) + ' till</p>' : "") + '</div>';
    }).join("");
}
function foKopplaArb(rot) {
    rot.querySelectorAll("[data-arb]").forEach(li => li.addEventListener("click", (e) => {
        if (e.target.closest("[data-prio]")) return;
        const [pid, fid, aid, obj] = li.dataset.arb.split("|");
        if (aid) return foOppnaObj(pid, { typ: "atgard", id: aid });
        if (fid) return foOppnaObj(pid, { typ: "fraga", id: fid });
        if (obj) { const [typ, id] = obj.split(":"); return foOppnaObj(pid, { typ, id }); }
    }));
    rot.querySelectorAll("[data-prio]").forEach(b => b.addEventListener("click", (e) => {
        e.stopPropagation();
        const k = b.dataset.prio, pr = foPrioLas();
        if (pr[k]) delete pr[k]; else pr[k] = foNu();
        foPrioSpara(); foRita();
    }));
}

/* ---------- Min översikt: vad behöver jag göra, i alla projekt? ----------
   Tre områden: Att göra, Inväntar och Nytt. Allt räknas fram ur projekten –
   samma underlag som klockan och det dagliga mejlet. */
let foMinFilter = { proj: "", omr: "gora" };
function foStartsidaNyckel() { const k = foKonto(); return "wimo_forma_start_" + ((k && (k.uid || k.epost)) || "lokal"); }
function foVyMin(yta) {
    const rita = () => {
        const alla = foAllaNu().map(x => ({ x, jag: foJagIdI(x.p) }));
        const proj = alla.filter(o => !foMinFilter.proj || o.x.id === foMinFilter.proj);
        const med = (o, l) => l.map(y => Object.assign(y, { pid: o.x.id, p: o.x.p, pnamn: o.x.namn }));
        const gora = [].concat(...proj.map(o => med(o, foArbetsyta(o.x.p, o.jag))));
        const inv = [].concat(...proj.map(o => med(o, foInvantar(o.x.p, o.jag))));
        const nytt = foMinaAviseringar().filter(x => !(FO_AVIS_TYPER[x.a.typ] || {}).agera && (!foMinFilter.proj || x.pid === foMinFilter.proj)).slice(0, 30);
        const pr = foPrioLas(), prio = gora.concat(inv).filter(x => pr[foArbNyckel(x.pid, x)]);
        const n = k => gora.filter(k).length;
        const flerProj = alla.length > 1;
        let html = '<div class="fo-sidtopp"><div class="fo-sidrub"><div class="fo-ogon">' + (foMinFilter.proj ? esc((alla.find(o => o.x.id === foMinFilter.proj) || { x: { namn: "" } }).x.namn) : "Alla dina projekt") + '</div><h1>Min översikt</h1></div>' +
            '<div class="fo-sidknappar"><button class="navknapp" type="button" id="foMinUppd">Uppdatera</button><button class="navknapp" type="button" id="foMinInst">Inställningar</button></div></div>';
        html += '<div class="kpirad fo-kpirad fo-kpifem">' +
            '<button type="button" class="kpi' + (n(x => x.forsenad) ? " rod" : "") + '" data-minomr="gora"><span class="kpital">' + n(x => x.forsenad) + '</span><span class="kpirub">Försenade</span><span class="kpiunder">svar och åtgärder</span></button>' +
            '<button type="button" class="kpi" data-minomr="gora"><span class="kpital">' + n(x => x.kat === "svara" || x.kat === "komplettera") + '</span><span class="kpirub">Att besvara</span></button>' +
            '<button type="button" class="kpi" data-minomr="gora"><span class="kpital">' + n(x => x.kat === "bedoma") + '</span><span class="kpirub">Svar att bedöma</span></button>' +
            '<button type="button" class="kpi' + (n(x => x.kat === "kvittera") ? " orange" : "") + '" data-minomr="gora"><span class="kpital">' + n(x => x.kat === "kvittera") + '</span><span class="kpirub">Att kvittera</span></button>' +
            '<button type="button" class="kpi" data-minomr="inv"><span class="kpital">' + inv.length + '</span><span class="kpirub">Inväntar</span><span class="kpiunder">från andra</span></button></div>';
        // projektfilter och områden
        html += '<div class="fo-snabbrad">' + [["gora", "Att göra", gora.length], ["inv", "Inväntar", inv.length], ["nytt", "Nytt", nytt.filter(x => x.ny).length]].map(([k, t, a]) =>
            '<button type="button" class="fo-snabb' + (foMinFilter.omr === k ? " vald" : "") + '" data-minomr="' + k + '" aria-pressed="' + (foMinFilter.omr === k) + '">' + t + ' <span>' + a + '</span></button>').join("") +
            (flerProj ? '<label class="fo-litefalt fo-minproj-val"><span class="sr">Projekt</span><select class="f" id="foMinProj"><option value="">Alla projekt (' + alla.length + ')</option>' +
                alla.map(o => '<option value="' + esc(o.x.id) + '"' + (foMinFilter.proj === o.x.id ? " selected" : "") + '>' + esc(o.x.namn) + ' (' + foArbetsyta(o.x.p, o.jag).length + ')</option>').join("") + '</select></label>' : "") + '</div>';
        if (prio.length) html += '<div class="dashblock fo-minprio"><h3>Mina prioriterade <span class="antal">' + prio.length + '</span></h3><ul class="atglista fo-aglista">' +
            prio.map(x => foArbRad(x.pid, x.p, x, { stjarna: true, projekt: flerProj ? x.pnamn : "" })).join("") + '</ul></div>';
        const tom = (t) => '<div class="dashblock"><p class="fo-klart">' + t + '</p></div>';
        if (foMinFilter.omr === "gora") html += gora.length ? '<div class="dashblock fo-minlista">' + foArbHtml("", null, gora, 12, { stjarna: true, visaProjekt: flerProj }) + '</div>' : tom("Inget väntar på dig just nu.");
        if (foMinFilter.omr === "inv") html += inv.length ? '<div class="dashblock fo-minlista">' + foArbHtml("", null, inv, 12, { stjarna: true, visaProjekt: flerProj }) + '</div>' : tom("Du väntar inte på något från andra just nu.");
        if (foMinFilter.omr === "nytt") html += nytt.length ? '<div class="dashblock fo-minlista"><ul class="fo-klockalista fo-nyttlista">' + nytt.map((x, i) => '<li class="' + (x.ny ? "ny" : "") + '" data-nytt="' + i + '" tabindex="0">' +
            '<span class="fo-avatar liten" aria-hidden="true">' + esc(foInitialer(x.p, x.a.av)) + '</span><span>' + esc(x.a.text) + '<small>' + (flerProj ? esc(x.pnamn) + " · " : "") + foNarText(x.a.tid) + '</small></span></li>').join("") + '</ul></div>'
            : tom("Inget nytt sedan du var inne senast.");
        const utan = alla.filter(o => !o.jag);
        if (utan.length) html += '<p class="hjalp">Du finns inte i kontaktlistan i ' + utan.map(o => esc(o.x.namn)).join(", ") + '. Be projektets administratör lägga till dig med din e-post.</p>';
        html += '<p class="hjalp fo-ingress">Uppgifterna står kvar tills de är hanterade – att läsa en avisering räcker inte. Stjärnorna syns bara för dig.</p>';
        yta.innerHTML = html;
        foKopplaArb(yta);
        yta.querySelectorAll("[data-minomr]").forEach(b => b.addEventListener("click", () => { foMinFilter.omr = b.dataset.minomr; rita(); }));
        const ps = document.getElementById("foMinProj"); if (ps) ps.addEventListener("change", () => { foMinFilter.proj = ps.value; rita(); });
        yta.querySelectorAll("[data-nytt]").forEach(li => li.addEventListener("click", () => { const x = nytt[+li.dataset.nytt]; foOppnaObj(x.pid, x.a.obj); }));
        document.getElementById("foMinUppd").addEventListener("click", () => { foLaddaAlla(true).then(() => { if (foVy === "min") foRita(); }); status("Hämtar dina projekt …"); });
        document.getElementById("foMinInst").addEventListener("click", foMinInstDialog);
    };
    rita();
    if (Date.now() - foAllaTid > 120000) foLaddaAlla().then(() => { if (foVy === "min" && document.getElementById("forma") === yta) rita(); foRitaNav(); foRitaKlocka(); });
}
// Startsida och aviseringar
function foMinInstDialog() {
    const start = foLasLs(foStartsidaNyckel(), "min");
    modal("Inställningar", "Gäller bara dig",
        '<div class="falt"><label>Startsida när du öppnar Forma</label>' +
        '<label class="fo-kryss"><input type="radio" name="foStart" value="min"' + (start !== "oversikt" ? " checked" : "") + '> Min översikt – alla dina projekt</label>' +
        '<label class="fo-kryss"><input type="radio" name="foStart" value="oversikt"' + (start === "oversikt" ? " checked" : "") + '> Projektöversikt för senast använda projekt</label></div>', [
        { txt: "Aviseringar …", vanster: true, fn: () => { stangModal(); foAvisInstDialog(); } },
        { txt: "Avbryt", fn: stangModal },
        { txt: "Spara", primar: true, fn: () => {
            const v = (document.querySelector('input[name="foStart"]:checked') || {}).value || "min";
            foSkrivLs(foStartsidaNyckel(), v);
            if (foMoln() && window.p4FormaMoln.privatSattFalt) window.p4FormaMoln.privatSattFalt({ inst: { start: v } }).catch(() => { });
            stangModal(); status("Startsidan är sparad.");
        } }]);
}

/* ---------- uppföljning för projekteringsledaren ---------- */
function foUppfoljningHtml(p) {
    const idag = foIdag(), inst = foAvisInst(p);
    const disc = p.discipliner.filter(d => d.aktiv !== false).slice().sort((a, b) => (a.ordning || 0) - (b.ordning || 0));
    const rad = disc.map(d => {
        const l = p.fragor.filter(f => !f.makulerad && (f.lage === "obesvarad" || f.lage === "ofullstandig") && foMottagare(f).some(m => m.disc === d.id || foPersonDisc(p, m.person).includes(d.id)));
        const sen = l.filter(f => f.svarSenast && f.svarSenast < idag);
        const max = sen.reduce((m, f) => Math.max(m, foArbetsdagarMellan(f.svarSenast, idag)), 0);
        const esk = sen.filter(f => foArbetsdagarMellan(f.svarSenast, idag) >= inst.eskalera).length;
        return { d, n: l.length, sen: sen.length, max, esk };
    }).filter(r => r.n);
    if (!rad.length) return "";
    return '<div class="dashblock fo-uppfoljning"><h3>Frågor per disciplin</h3><div class="fo-tabellram"><table class="lista fo-tabell"><thead><tr><th>Disciplin</th><th>Obesvarade</th><th>Försenade</th><th>Längst försenad</th><th>Att uppmärksamma</th></tr></thead><tbody>' +
        rad.map(r => '<tr><td>' + foDiscChip(p, r.d.id, true) + (foDiscSaknarAvis(p, r.d.id) ? ' <span class="fo-tagg t-sen" title="Disciplinen saknar utsedda aviseringsmottagare – alla i disciplinen aviseras">Saknar mottagare</span>' : "") + '</td>' +
            '<td><button type="button" class="p4d-lank" data-uppf="' + r.d.id + '|obesvarade">' + r.n + '</button></td>' +
            '<td>' + (r.sen ? '<button type="button" class="p4d-lank rodtal" data-uppf="' + r.d.id + '|forsenade">' + r.sen + '</button>' : "0") + '</td>' +
            '<td>' + (r.max ? r.max + (r.max === 1 ? " arbetsdag" : " arbetsdagar") : "–") + '</td>' +
            '<td>' + (r.esk ? '<b class="rodtal">' + r.esk + '</b> <small>(' + inst.eskalera + '+ dagar)</small>' : "–") + '</td></tr>').join("") +
        '</tbody></table></div><p class="hjalp" style="margin:8px 0 0">Klicka på en siffra för att se frågorna. Forma eskalerar inte automatiskt till någon annan – det är du som avgör om du vill påminna.</p></div>';
}
function foKvittOversiktHtml(p) {
    const oppna = (p.kvittkrav || []).filter(k => !k.stangd && k.till.some(id => !k.kvitt[id]));
    if (!oppna.length) return "";
    return '<div class="dashblock"><h3>Kvitteringar som återstår <span class="antal">' + oppna.length + '</span></h3><ul class="atglista fo-aglista">' +
        oppna.slice(0, 8).map(k => {
            const klara = k.till.filter(id => k.kvitt[id]).length;
            return '<li data-kvobj="' + k.obj.typ + ':' + k.obj.id + '"><span class="fo-agnr">' + klara + '/' + k.till.length + '</span><span class="fo-agtext">' + esc(k.titel) +
                '<small>Återstår: ' + esc(k.till.filter(id => !k.kvitt[id]).map(id => foPersonNamn(p, id)).join(", ")) + '</small></span></li>';
        }).join("") + '</ul></div>';
}
function foKopplaUppfoljning(rot) {
    rot.querySelectorAll("[data-uppf]").forEach(b => b.addEventListener("click", () => {
        const [disc, snabb] = b.dataset.uppf.split("|");
        foFilter = { snabb: snabb, sok: "", disc: disc, plats: "", lage: "", mote: "", sort: "senast", visaMak: false, oppen: true };
        foGaTill("aktiva");
    }));
    rot.querySelectorAll("[data-kvobj]").forEach(li => li.addEventListener("click", () => { const [typ, id] = li.dataset.kvobj.split(":"); foOppnaObj("", { typ, id }); }));
}

/* ---------- klockan i toppraden ---------- */
function foSettAvisNyckel() { const k = foKonto(); return "wimo_forma_avislast_" + ((k && (k.uid || k.epost)) || "lokal"); }
function foMinaAviseringar() {
    const sett = foLasLs(foSettAvisNyckel(), {});
    const ut = [];
    foAllaNu().forEach(x => {
        const jag = foJagIdI(x.p);
        if (!jag) return;
        (x.p.aviseringar || []).filter(a => a.till.includes(jag)).forEach(a => ut.push({ a, pid: x.id, pnamn: x.namn, p: x.p, ny: a.tid > (sett[x.id] || "") }));
    });
    return ut.sort((a, b) => b.a.tid.localeCompare(a.a.tid));
}
function foRitaKlocka() {
    const b = document.getElementById("foKlocka");
    if (!b) return;
    const n = foMinaAviseringar().filter(x => x.ny).length;
    const t = document.getElementById("foKlockaTal");
    t.textContent = n > 99 ? "99+" : n; t.classList.toggle("dold", !n);
    b.setAttribute("aria-label", n ? n + " nya aviseringar" : "Aviseringar");
}
let foKlockaFlik = "agera";
function foOppnaKlocka() {
    const gammal = document.getElementById("foKlockaMeny"); if (gammal) { gammal.remove(); return; }
    const m = document.createElement("div");
    setTimeout(() => foFargaAvatarer(m), 0);
    m.id = "foKlockaMeny"; m.className = "fo-klockameny"; m.setAttribute("role", "dialog"); m.setAttribute("aria-label", "Aviseringar");
    document.body.appendChild(m);
    const rita = () => {
        const alla = foMinaAviseringar();
        const agera = alla.filter(x => (FO_AVIS_TYPER[x.a.typ] || {}).agera), info = alla.filter(x => !(FO_AVIS_TYPER[x.a.typ] || {}).agera);
        const l = (foKlockaFlik === "agera" ? agera : info).slice(0, 40);
        m.innerHTML = '<div class="fo-klockatopp"><b>Aviseringar</b><button type="button" class="p4d-lank" id="foKlockaLast">Markera som lästa</button></div>' +
            '<div class="fo-flikar" role="tablist"><button type="button" role="tab" class="fo-flik' + (foKlockaFlik === "agera" ? " vald" : "") + '" data-kflik="agera">Kräver åtgärd <span>' + agera.filter(x => x.ny).length + '</span></button>' +
            '<button type="button" role="tab" class="fo-flik' + (foKlockaFlik === "info" ? " vald" : "") + '" data-kflik="info">Information <span>' + info.filter(x => x.ny).length + '</span></button></div>' +
            (l.length ? '<ul class="fo-klockalista">' + l.map((x, i) => '<li class="' + (x.ny ? "ny" : "") + '" data-ki="' + i + '" tabindex="0"><span class="fo-avatar liten" aria-hidden="true">' + esc(foInitialer(x.p, x.a.av)) + '</span><span>' +
                '<b>' + esc((FO_AVIS_TYPER[x.a.typ] || { namn: "" }).namn) + '</b>' + esc(x.a.text) + '<small>' + (x.pid !== foPid ? esc(x.pnamn) + " · " : "") + esc(foPersonNamn(x.p, x.a.av) || "") + " · " + foNarText(x.a.tid) + '</small></span></li>').join("") + '</ul>'
                : '<p class="hjalp fo-klocktom">' + (foKlockaFlik === "agera" ? "Inget som kräver åtgärd." : "Ingen ny information.") + '</p>') +
            '<div class="fo-klockafot"><button type="button" class="p4d-lank" id="foKlockaMin">Min översikt</button><button type="button" class="p4d-lank" id="foKlockaInst">Inställningar</button></div>' +
            '<p class="fo-klockahjalp">Att läsa en avisering markerar inte uppgiften som hanterad.</p>';
        m.querySelectorAll("[data-kflik]").forEach(b => b.addEventListener("click", () => { foKlockaFlik = b.dataset.kflik; rita(); }));
        m.querySelectorAll("[data-ki]").forEach(li => { const x = l[+li.dataset.ki]; const ga = () => { stang(); foOppnaObj(x.pid, x.a.obj || (x.a.fragor && x.a.fragor.length ? { typ: "fraga", id: x.a.fragor[0] } : null)); };
            li.addEventListener("click", ga); li.addEventListener("keydown", e => { if (e.key === "Enter") ga(); }); });
        m.querySelector("#foKlockaLast").addEventListener("click", () => { foMarkeraAvisLasta(); rita(); });
        m.querySelector("#foKlockaMin").addEventListener("click", () => { stang(); foGaTill("min"); });
        m.querySelector("#foKlockaInst").addEventListener("click", () => { stang(); foAvisInstDialog(); });
    };
    const b = document.getElementById("foKlocka"), r = b.getBoundingClientRect();
    m.style.top = (r.bottom + 8) + "px"; m.style.right = Math.max(8, innerWidth - r.right) + "px";
    const stang = (e) => {
        if (e && e.type === "pointerdown" && (m.contains(e.target) || b.contains(e.target))) return;
        if (e && e.type === "keydown" && e.key !== "Escape") return;
        m.remove(); document.removeEventListener("pointerdown", stang, true); document.removeEventListener("keydown", stang, true);
    };
    setTimeout(() => { document.addEventListener("pointerdown", stang, true); document.addEventListener("keydown", stang, true); }, 0);
    rita();
    if (Date.now() - foAllaTid > 120000) foLaddaAlla().then(() => { if (document.getElementById("foKlockaMeny")) rita(); foRitaKlocka(); });
}
function foMarkeraAvisLasta() {
    const s = foLasLs(foSettAvisNyckel(), {}), nu = foNu();
    foAllaNu().forEach(x => { s[x.id] = nu; });
    foSkrivLs(foSettAvisNyckel(), s);
    foRitaKlocka();
}

/* ---------- personliga inställningar ---------- */
const FO_AVIS_PERS_STD = { daglig: true, tid: 7, direkt: true, info: false };
async function foAvisInstDialog() {
    let v = Object.assign({}, FO_AVIS_PERS_STD);
    const moln = foMoln();
    try { v = Object.assign(v, moln ? await window.p4FormaMoln.avisInst() : foLasLs("wimo_forma_avisinst", {})); } catch (e) { }
    const obl = Object.keys(FO_AVIS_TYPER).filter(k => FO_AVIS_TYPER[k].obl).map(k => FO_AVIS_TYPER[k].namn);
    const kropp = (moln ? "" : '<div class="notis">Logga in för att få mejl. Inställningarna sparas annars bara på den här datorn.</div>') +
        '<label class="fo-kryss fo-installning"><input type="checkbox" id="foAiDaglig"' + (v.daglig ? " checked" : "") + '><span><b>Daglig sammanställning</b><small>Ett mejl per arbetsdag med det du behöver hantera i alla dina projekt. Inget mejl om inget väntar.</small></span></label>' +
        '<div class="falt" style="margin:6px 0 12px 27px"><label for="foAiTid">Tidpunkt</label><select class="f" id="foAiTid" style="max-width:160px">' + [5, 6, 7, 8, 9, 10, 11].map(h => '<option value="' + h + '"' + (+v.tid === h ? " selected" : "") + '>kl ' + String(h).padStart(2, "0") + ':00</option>').join("") + '</select></div>' +
        '<label class="fo-kryss fo-installning"><input type="checkbox" id="foAiDirekt"' + (v.direkt ? " checked" : "") + '><span><b>Viktiga direktaviseringar</b><small>Till exempel särskilt brådskande frågor och begärda kvitteringar.</small></span></label>' +
        '<label class="fo-kryss fo-installning"><input type="checkbox" id="foAiInfo"' + (v.info ? " checked" : "") + '><span><b>Allmän projektinformation via mejl</b><small>Annars syns den bara i Forma.</small></span></label>' +
        '<div class="notis" style="margin-top:12px"><b>Alltid direkt med mejl:</b> ' + esc(obl.join(", ")) + '. De går inte att stänga av, så att viktiga besked inte faller mellan stolarna.</div>' +
        '<p class="hjalp">Uppgifterna och historiken finns alltid kvar i Forma, oavsett vad du väljer här.</p>';
    modal("Mina aviseringar", "Gäller alla dina Forma-projekt", kropp, [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Spara", primar: true, fn: async () => {
            const ny = { daglig: document.getElementById("foAiDaglig").checked, tid: +document.getElementById("foAiTid").value, direkt: document.getElementById("foAiDirekt").checked, info: document.getElementById("foAiInfo").checked };
            try { if (moln) await window.p4FormaMoln.sparaAvisInst(ny); else foSkrivLs("wimo_forma_avisinst", ny); stangModal(); status("Dina aviseringsinställningar är sparade."); }
            catch (e) { status("Inställningarna kunde inte sparas. Försök igen.", true); }
        } }
    ]);
}

/* ---------- Påminn ---------- */
function foKanPaminna(p, jag, f) { return !!jag && !f.makulerad && (foArStallare(p, jag, f) || foKanLeda(p, jag) || foSuper(p, jag) || p.plId === jag); }
function foSenastPaminnelse(p, f) {
    const s = (f.paminnelser || [])[(f.paminnelser || []).length - 1];
    return s ? "Senast påmind " + foNarText(s.tid) + " av " + (foPersonNamn(p, s.av) || "–") : "";
}
function foPaminnDialog(fragor) {
    const p = foP, jag = foJagId(), en = fragor.length === 1, f0 = fragor[0];
    // Per mottagare: bara de frågor som berör hen.
    const per = {};
    fragor.forEach(f => {
        const ej = foMottagare(f).filter(m => !foHarSvarat(p, f, m) || f.lage === "ofullstandig");
        foAvisPersoner(p, ej.length ? ej : foMottagare(f)).filter(id => id !== jag).forEach(id => { (per[id] = per[id] || []).push(f); });
    });
    const mott = Object.keys(per);
    if (!mott.length) return status("Det finns ingen att påminna – kontrollera vem som ska svara.", true);
    const utanEpost = mott.filter(id => !(foPerson(p, id) || {}).epost);
    const kropp = (en ? '<div class="fo-underlag"><h4>Fråga ' + f0.nr + '</h4><p>' + esc(f0.text) + '</p>' + (f0.svarSenast ? '<p class="hjalp" style="margin:4px 0 0">Svar senast ' + foDatumKort(f0.svarSenast) + " v. " + foVecka(f0.svarSenast) + '</p>' : "") + '</div>' : "") +
        '<div class="falt"><label>Mottagare</label><div class="fo-pammott">' + mott.map(id => '<label class="fo-kryss"><input type="checkbox" value="' + id + '" checked> ' + esc(foPersonNamn(p, id)) +
            (!en ? ' <span class="hjalp">– ' + per[id].length + (per[id].length === 1 ? " fråga: " : " frågor: ") + per[id].map(f => f.nr).join(", ") + '</span>' : "") +
            (!(foPerson(p, id) || {}).epost ? ' <span class="fo-tagg t-sen">Saknar e-post</span>' : "") + '</label>').join("") + '</div></div>' +
        '<div class="falt"><label for="foPamText">Meddelande <span class="hjalp">(valfritt)</span></label><textarea class="f" id="foPamText" rows="3" placeholder="' + (en ? "Till exempel: Vi behöver svaret inför projekteringsmötet på tisdag." : "Till exempel: Inför projekteringsmötet – återkom gärna senast måndag.") + '"></textarea></div>' +
        '<p class="hjalp" style="margin:0">' + (en ? "Påminnelsen skickas direkt med mejl med länk till frågan." : "Varje mottagare får ett mejl med bara sina frågor.") + ' Den syns också i Forma och sparas i frågans historik.</p>' +
        (utanEpost.length ? '<div class="notis rod" style="margin-top:10px">' + esc(utanEpost.map(id => foPersonNamn(p, id)).join(", ")) + ' saknar e-post i Projektmedlemmar och får bara påminnelsen i Forma.</div>' : "");
    modal(en ? "Påminn om fråga " + f0.nr : "Påminn om " + fragor.length + " frågor", "", kropp, [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Skicka påminnelse", primar: true, fn: () => {
            const valda = [...document.querySelectorAll(".fo-pammott input:checked")].map(i => i.value);
            if (!valda.length) return status("Välj minst en mottagare.", true);
            const medd = document.getElementById("foPamText").value.trim();
            // Påminn flera: bara frågor som har någon av de valda mottagarna.
            const fl = en ? [f0.id] : fragor.filter(f => valda.some(id => per[id] && per[id].includes(f))).map(f => f.id);
            const r = foGor("paminn", { fragor: fl, till: en ? valda : undefined, meddelande: medd });
            if (r) { stangModal(); foValjLage = false; foValdaFragor = new Set(); foRita(); status("Påminnelse skickad till " + r.mottagare + (r.mottagare === 1 ? " person." : " personer.")); }
        } }
    ]);
}

/* ---------- Begär kvittering ---------- */
function foKvittDialog(obj, titel, forval) {
    const p = foP;
    let valda = (forval || []).map(id => ({ person: id }));
    modal("Begär kvittering", titel, '<p class="hjalp" style="margin-top:0">Kvittering betyder att personen bekräftar att hen tagit del av informationen – inte att hen godkänner innehållet eller dess konsekvenser.</p>' +
        '<div class="falt"><label>Vem ska kvittera?</label><div id="foKvMottRuta"></div></div>' +
        '<div class="falt"><label for="foKvText">Meddelande <span class="hjalp">(valfritt)</span></label><textarea class="f" id="foKvText" rows="2" placeholder="Till exempel: Nya förutsättningar för fasaden – läs innan ni fortsätter."></textarea></div>', [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Begär kvittering", primar: true, fn: () => {
            const till = foAvisPersoner(p, valda);
            if (!till.length) return status("Välj minst en person.", true);
            const k = foGor("begarKvittering", { obj: obj, titel: titel, till: till, meddelande: document.getElementById("foKvText").value.trim() });
            if (k) { stangModal(); status("Kvittering begärd av " + k.till.length + (k.till.length === 1 ? " person." : " personer.")); }
        } }
    ]);
    const ritaM = () => {
        const el = document.getElementById("foKvMottRuta"); if (!el) return;
        el.innerHTML = foPartValjare("foKvMott", valda, { tomText: "Välj personer eller discipliner …", merText: "+ Fler" });
        foKopplaPartValjare(el, "foKvMott", valda, (l) => { valda = l; ritaM(); });
    };
    ritaM();
}
// Status för kvitteringar på ett objekt: vem har kvitterat, vem återstår.
function foKvittHtml(obj) {
    const p = foP, jag = foJagId(), leda = foKanLeda(p, jag) || foSuper(p, jag);
    const l = foKvittKravFor(p, obj);
    if (!l.length) return "";
    const ver = foObjVersion(p, obj);
    return '<div class="fo-kvittlista">' + l.slice().reverse().map(k => {
        const rader = k.till.map(id => {
            const kv = k.kvitt[id], an = k.annat[id];
            return '<li><span>' + esc(foPersonNamn(p, id) || "–") + '</span>' +
                (kv ? '<span class="fo-kvok">Kvitterat ' + foNarText(kv.tid) + '</span>' : an ? '<span class="fo-kvannat" title="Dokumenterat av ' + esc(foPersonNamn(p, an.av)) + '. Inte en personlig kvittering.">Kommunicerat: ' + esc(an.hur) + '</span>' : '<span class="fo-kvvant">Återstår</span>') +
                (!kv && id === jag ? '<button type="button" class="p4-btn p4-btn-liten" data-kvittera-krav="' + k.id + '">Kvittera</button>' : "") +
                (!kv && !an && leda && id !== jag ? '<button type="button" class="fo-minknapp" data-kvannat="' + k.id + '|' + id + '" title="Dokumentera att informationen kommunicerats på annat sätt, t.ex. på ett möte">Annat sätt …</button>' : "") + '</li>';
        }).join("");
        const ater = k.till.filter(id => !k.kvitt[id]).length;
        return '<div class="fo-kvitt"><div class="fo-kvitttopp"><b>' + esc(k.titel) + '</b><small>Begärd ' + foNarText(k.tid) + (k.av ? " av " + esc(foPersonNamn(p, k.av)) : " automatiskt") + ' · ' + (k.till.length - ater) + ' av ' + k.till.length + ' har kvitterat</small></div>' +
            (k.version && ver && k.version !== ver ? '<p class="fo-kvver">Informationen har ändrats efter att kvitteringen begärdes. Begär en ny kvittering om ändringen är väsentlig.</p>' : "") +
            '<ul>' + rader + '</ul>' + (ater && leda ? '<button type="button" class="fo-minknapp" data-kvpaminn="' + k.id + '">Påminn de som återstår</button>' : "") + '</div>';
    }).join("") + '</div>';
}
function foKopplaKvitt(rot) {
    rot.querySelectorAll("[data-kvittera-krav]").forEach(b => b.addEventListener("click", () => {
        if (foGor("kvitteraKrav", { kid: b.dataset.kvitteraKrav })) status("Kvitterat. Det betyder att du tagit del av informationen, inte att du godkänner den.");
    }));
    rot.querySelectorAll("[data-kvannat]").forEach(b => b.addEventListener("click", () => {
        const [kid, person] = b.dataset.kvannat.split("|");
        foFragaOrsak("Kommunicerat på annat sätt", "Dokumentera hur " + esc(foPersonNamn(foP, person)) + " fått informationen. Det sparas som din dokumentation, inte som personens kvittering.", "Spara",
            hur => foGor("kvittAnnat", { kid, person, hur }));
        const l = document.querySelector('label[for="foOrsak"]'); if (l) l.textContent = "Hur och när";
    }));
    rot.querySelectorAll("[data-kvpaminn]").forEach(b => b.addEventListener("click", () => {
        const k = (foP.kvittkrav || []).find(x => x.id === b.dataset.kvpaminn);
        if (k && foGor("kvittPaminn", { kid: k.id })) status("Påminnelse skickad till de som inte har kvitterat.");
    }));
}
Object.assign(FO_OPS, {
    kvittPaminn(p, a, ctx) {
        const k = (p.kvittkrav || []).find(x => x.id === a.kid);
        foKrav(k, "Kvitteringen finns inte.");
        foKrav(!ctx.av || foKanLeda(p, ctx.av) || foSuper(p, ctx.av) || k.av === ctx.av, "Bara den som begärde kvitteringen eller projekteringsledaren kan påminna.");
        const ater = k.till.filter(id => !k.kvitt[id]);
        foKrav(ater.length, "Alla har kvitterat.");
        foAvisera(p, ctx, "paminnelse", k.obj, ater, "Påminnelse: kvittera " + k.titel, { kid: k.id });
        const o = foObj(p, k.obj); if (o && o.hist) foHist(o, ctx, "Påminnelse om kvittering till " + ater.map(id => foPersonNamn(p, id)).join(", "));
    }
});

/* ---------- välja flera frågor i listan (Påminn flera) ---------- */
let foValjLage = false, foValdaFragor = new Set();
function foValjRadHtml() {
    if (!foValjLage) return "";
    return '<div class="fo-valjrad" role="region" aria-label="Valda frågor"><b>' + foValdaFragor.size + (foValdaFragor.size === 1 ? " fråga vald" : " frågor valda") + '</b>' +
        '<button type="button" class="p4-btn p4-btn-primar" id="foValjPaminn"' + (foValdaFragor.size ? "" : " disabled") + '>Påminn …</button>' +
        '<button type="button" class="p4d-lank" id="foValjAlla">Välj alla i listan</button><button type="button" class="p4d-lank" id="foValjAvbryt">Avbryt</button></div>';
}
function foKopplaValj(rot, lista) {
    rot.querySelectorAll("[data-valj]").forEach(c => c.addEventListener("change", (e) => {
        e.stopPropagation();
        if (c.checked) foValdaFragor.add(c.dataset.valj); else foValdaFragor.delete(c.dataset.valj);
        const r = rot.querySelector(".fo-valjrad b"); if (r) r.textContent = foValdaFragor.size + (foValdaFragor.size === 1 ? " fråga vald" : " frågor valda");
        const k = rot.querySelector("#foValjPaminn"); if (k) k.disabled = !foValdaFragor.size;
    }));
    rot.querySelectorAll("td.fo-valjkol").forEach(td => td.addEventListener("click", e => e.stopPropagation()));
    const a = rot.querySelector("#foValjAvbryt"); if (a) a.addEventListener("click", () => { foValjLage = false; foValdaFragor = new Set(); foRita(); });
    const alla = rot.querySelector("#foValjAlla"); if (alla) alla.addEventListener("click", () => { lista.forEach(f => foValdaFragor.add(f.id)); foRita(); });
    const pm = rot.querySelector("#foValjPaminn"); if (pm) pm.addEventListener("click", () => foPaminnDialog([...foValdaFragor].map(id => foFraga(foP, id)).filter(Boolean)));
    const v = rot.querySelector("#foValjKnapp"); if (v) v.addEventListener("click", () => { foValjLage = !foValjLage; foValdaFragor = new Set(); foRita(); });
}

/* ---------- projektets aviseringsregler (Projektinställningar) ---------- */
function foAvisInstHtml(p, leda) {
    const inst = foAvisInst(p), dis = leda ? "" : " disabled";
    const rad = Object.keys(FO_AVIS_TYPER).map(k => {
        const t = FO_AVIS_TYPER[k], regel = foAvisRegel(p, k);
        return '<tr><td>' + esc(t.namn) + '</td><td>' + (t.obl ? '<span class="fo-oblig">Direkt · obligatorisk</span>' :
            '<select class="f fo-litenselect" data-avisregel="' + k + '"' + dis + '>' + Object.keys(FO_AVIS_MEJL).map(m => '<option value="' + m + '"' + (regel === m ? " selected" : "") + '>' + FO_AVIS_MEJL[m] + '</option>').join("") + '</select>') + '</td>' +
            '<td>' + (t.kvitt ? '<label class="fo-kryss"><input type="checkbox" data-aviskvitt="' + k + '"' + (foAvisKvittKrav(p, k) ? " checked" : "") + dis + '> Kvittering</label>' : '<span class="hjalp">–</span>') + '</td></tr>';
    }).join("");
    const disc = p.discipliner.filter(d => d.aktiv !== false).slice().sort((a, b) => (a.ordning || 0) - (b.ordning || 0));
    const utanEpost = p.personer.filter(x => x.aktiv && !x.epost);
    return '<div class="dashblock fo-avisinst"><h3>Aviseringar och kvitteringar</h3>' +
        '<p class="hjalp" style="margin-top:0">Grundinställningar som fungerar direkt. Ändringar gäller framåt – redan begärda kvitteringar och historik finns kvar. Allt syns alltid i Forma, oavsett mejlinställning.</p>' +
        '<div class="fo-tabellram"><table class="lista fo-tabell"><thead><tr><th>Händelse</th><th>Mejl</th><th>Krav</th></tr></thead><tbody>' + rad + '</tbody></table></div>' +
        '<div class="tva" style="margin-top:12px"><div class="falt"><label for="foAvFore">Uppmärksamma mottagaren</label><div class="fo-svarstid"><input class="f" type="number" min="0" max="10" id="foAvFore" value="' + inst.fore + '"' + dis + '><span>arbetsdagar före svarsdatum</span></div></div>' +
        '<div class="falt"><label for="foAvEsk">Uppmärksamma projekteringsledaren efter</label><div class="fo-svarstid"><input class="f" type="number" min="1" max="30" id="foAvEsk" value="' + inst.eskalera + '"' + dis + '><span>arbetsdagars försening</span></div></div></div>' +
        '<div class="falt"><label>Aviseras alltid vid risk för tid- eller kostnadspåverkan</label><div id="foAvKonsRuta"></div><p class="hjalp" style="margin:4px 0 0">Utöver frågeställaren, de som ska svara och projekteringsledaren. Till exempel beställarens projektledare eller kalkyl.</p></div>' +
        '<h4 class="fo-raph4">Aviseringsmottagare per disciplin</h4><p class="hjalp" style="margin-top:0">Frågor till en disciplin aviseras till disciplinens utsedda mottagare. Saknas sådana aviseras alla i disciplinen.</p>' +
        '<div class="fo-tabellram"><table class="lista fo-tabell"><tbody>' + disc.map(d => '<tr><td style="width:160px"><b>' + esc(d.kod) + '</b> ' + esc(d.namn) +
            (foDiscSaknarAvis(p, d.id) ? '<br><span class="fo-tagg t-sen">Saknar mottagare</span>' : "") + '</td><td><div id="foAvDisc_' + d.id + '"></div></td></tr>').join("") + '</tbody></table></div>' +
        (utanEpost.length ? '<div class="notis rod" style="margin-top:12px"><b>Saknar e-post:</b> ' + utanEpost.map(x => esc(foPersonNamn(p, x.id))).join(", ") + '. De får aviseringar i Forma men inga mejl. Lägg till e-post under Projektmedlemmar.</div>' : "") +
        '<div class="fo-knapprad" style="margin-top:12px"><button type="button" class="mknapp" id="foMejllogg">Utskickslogg</button><button type="button" class="mknapp" id="foMinaAvis">Mina aviseringar</button></div></div>';
}
function foKopplaAvisInst(rot, p, leda) {
    rot.querySelectorAll("[data-avisregel]").forEach(s => s.addEventListener("change", () => { if (foGor("avisRegler", { regel: { typ: s.dataset.avisregel, mejl: s.value } }, true)) foVisaSparat(s); }));
    rot.querySelectorAll("[data-aviskvitt]").forEach(c => c.addEventListener("change", () => { if (foGor("avisRegler", { kvitt: { typ: c.dataset.aviskvitt, pa: c.checked } }, true)) foVisaSparat(c); }));
    const fo = rot.querySelector("#foAvFore"); if (fo) fo.addEventListener("change", () => { if (foGor("avisRegler", { fore: fo.value }, true)) foVisaSparat(fo); });
    const es = rot.querySelector("#foAvEsk"); if (es) es.addEventListener("change", () => { if (foGor("avisRegler", { eskalera: es.value }, true)) foVisaSparat(es); });
    const ritaKons = () => {
        const el = rot.querySelector("#foAvKonsRuta"); if (!el) return;
        const v = foAvisInst(foP).konsMottagare.map(id => ({ person: id }));
        el.innerHTML = foPartValjare("foAvKons", v, { disc: false, lasa: !leda, tomText: "Lägg till personer …", merText: "+ Fler" });
        foKopplaPartValjare(el, "foAvKons", v, (l) => { foGor("avisRegler", { konsMottagare: l.map(x => x.person) }, true); ritaKons(); });
    };
    ritaKons();
    p.discipliner.forEach(d => {
        const rita = () => {
            const el = rot.querySelector("#foAvDisc_" + d.id); if (!el) return;
            const dd = foDisc(foP, d.id), v = (dd.avis || []).map(id => ({ person: id }));
            el.innerHTML = foPartValjare("foAvDiscV_" + d.id, v, { disc: false, lasa: !leda, tomText: "Alla i disciplinen – välj mottagare …", merText: "+ Fler" });
            foKopplaPartValjare(el, "foAvDiscV_" + d.id, v, (l) => { foGor("discAvis", { id: d.id, personer: l.map(x => x.person) }, true); rita(); });
        };
        rita();
    });
    const ml = rot.querySelector("#foMejllogg"); if (ml) ml.addEventListener("click", foMejlloggDialog);
    const ma = rot.querySelector("#foMinaAvis"); if (ma) ma.addEventListener("click", foAvisInstDialog);
}

/* ---------- mejlkön ---------- */
// Den som utförde en ändring lägger direktmejlen i kön. Servern skickar, loggar, försöker igen vid fel och
// skyddar mot dubbletter (id per händelse och mottagare). Ett misslyckat mejl tar aldrig bort uppgiften i Forma.
function foMejlLank(pid, a) {
    const bas = location.origin + location.pathname;
    const f = a.obj && a.obj.typ === "fraga" ? foFraga(foP, a.obj.id) : (a.fragor && a.fragor.length === 1 ? foFraga(foP, a.fragor[0]) : null);
    return bas + "#forma/p:" + pid + "/" + (f ? (f.lage === "klar" ? "klara" : "aktiva") + "/f" + f.nr : a.typ === "paminnelse" ? "mina" : "oversikt");
}
let foKoarMejl = false;
async function foKoaMejl() {
    if (foKoarMejl || !foP || !foPid) return;
    const post = foLista.find(x => x.id === foPid);
    const jag = foJagId();
    if (!jag) return;
    const nyckel = "wimo_forma_mejlkoad_" + foPid, koade = new Set(foLasLs(nyckel, []));
    const grans = new Date(Date.now() - 3 * 864e5).toISOString();
    const nya = (foP.aviseringar || []).filter(a => a.av === jag && a.tid > grans && !koade.has(a.id) && foAvisRegel(foP, a.typ) === "direkt");
    if (!nya.length) return;
    // Lokala projekt och demoprojekt har ingen server – där finns aviseringarna bara i Forma.
    if (!post || !post.moln || !foMoln()) { nya.forEach(a => koade.add(a.id)); foSkrivLs(nyckel, [...koade].slice(-500)); return; }
    foKoarMejl = true;
    try {
        for (const a of nya) {
            let ok = true;
            for (const pid of a.till) {
                const x = foPerson(foP, pid);
                if (!x) continue;
                const fragor = (a.fragor || (a.obj && a.obj.typ === "fraga" ? [a.obj.id] : [])).map(id => foFraga(foP, id)).filter(Boolean)
                    .map(f => ({ nr: f.nr, text: f.text.slice(0, 300), senast: f.svarSenast || "", lank: location.origin + location.pathname + "#forma/p:" + foPid + "/aktiva/f" + f.nr }));
                const data = { projekt: foPid, projektNamn: foP.namn, typ: a.typ, handelse: a.id, obligatorisk: !!FO_AVIS_TYPER[a.typ].obl,
                    till: { person: pid, namn: foPersonNamn(foP, pid), epost: x.epost || "", uid: x.uid || "" },
                    amne: (FO_AVIS_TYPER[a.typ].namn + (a.nr ? " – fråga " + a.nr : "") + " · " + foP.namn).slice(0, 200),
                    text: a.text, meddelande: a.meddelande || "", avNamn: foPersonNamn(foP, a.av) || "", lank: foMejlLank(foPid, a), fragor: fragor };
                try { await window.p4FormaMoln.koaMejl(foPid + "_" + a.id + "_" + pid, data); }
                catch (e) { ok = false; console.warn("Forma mejlkö:", e); }
            }
            if (ok) koade.add(a.id);
        }
    } finally {
        foSkrivLs(nyckel, [...koade].slice(-500));
        foKoarMejl = false;
    }
}
const FO_MEJLSTATUS = { planerad: "Planerad", skickad: "Skickad", levererad: "Levererad", misslyckad: "Misslyckad", studsade: "Studsade", avstangd: "Avstängd av mottagaren", saknarEpost: "Saknar e-post" };
async function foMejlloggDialog() {
    const post = foLista.find(x => x.id === foPid);
    if (!post || !post.moln || !foMoln()) return modal("Utskickslogg", foP.namn, '<p class="hjalp">Projektet sparas bara på den här datorn. Mejl skickas bara för projekt i molnet. Aviseringarna finns i Forma.</p>', [{ txt: "Stäng", primar: true, fn: stangModal }]);
    modal("Utskickslogg", foP.namn, '<p class="hjalp">Hämtar …</p>', [{ txt: "Stäng", primar: true, fn: stangModal }]);
    let l = [];
    try { l = await window.p4FormaMoln.mejllogg(foPid); } catch (e) { const k = document.querySelector("#overlay .kropp"); if (k) k.innerHTML = '<p class="hjalp">Loggen kunde inte hämtas.</p>'; return; }
    const tid = x => x.skapad && x.skapad.seconds ? new Date(x.skapad.seconds * 1000).toISOString() : (x.skapad && x.skapad.__ts ? new Date(x.skapad.__ts).toISOString() : "");
    l.sort((a, b) => tid(b).localeCompare(tid(a)));
    const fel = l.filter(x => x.status === "misslyckad" || x.status === "studsade" || x.status === "saknarEpost");
    const html = (fel.length ? '<div class="notis rod">' + fel.length + (fel.length === 1 ? " utskick har problem" : " utskick har problem") + '. Kontrollera e-postadresserna under Projektmedlemmar.</div>' : "") +
        (l.length ? '<div class="fo-tabellram"><table class="lista fo-tabell"><thead><tr><th>Tid</th><th>Mottagare</th><th>Ämne</th><th>Status</th></tr></thead><tbody>' + l.slice(0, 200).map(x =>
            '<tr><td class="dat">' + (tid(x) ? foDatumKort(tid(x)) + " " + foKlocka(tid(x)) : "–") + '</td><td>' + esc((x.till && x.till.namn) || "–") + '<small>' + esc((x.till && x.till.epost) || "saknar e-post") + '</small></td>' +
            '<td>' + esc(x.amne || "") + '</td><td><span class="fo-mejlstatus s-' + esc(x.status || "") + '">' + esc(FO_MEJLSTATUS[x.status] || x.status || "–") + '</span>' + (x.forsok > 1 ? '<small>' + x.forsok + ' försök</small>' : "") + (x.fel ? '<small>' + esc(String(x.fel).slice(0, 120)) + '</small>' : "") + '</td></tr>').join("") + '</tbody></table></div>'
            : '<p class="hjalp">Inga direktmejl har köats i projektet ännu. Den dagliga sammanställningen loggas per användare.</p>') +
        '<p class="hjalp">Planerad = i kön. Skickad = mejltjänsten har tagit emot mejlet. Levererad = mottagarens server har tagit emot det (när mejltjänsten kan bekräfta det).</p>';
    const k = document.querySelector("#overlay .kropp");
    if (k) k.innerHTML = html; else { stangModal(); modal("Utskickslogg", foP.namn, html, [{ txt: "Stäng", primar: true, fn: stangModal }]); }
}
