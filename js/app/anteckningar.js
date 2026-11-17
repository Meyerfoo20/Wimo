/* ======================================================================
   Wimo · Anteckningar
   Samlar alla anteckningar som skrivits på posterna i projektet, i en lista
   efter datum. Klickar man på en visas hela anteckningen, och den går att
   mejla vidare. Anteckningarna ligger kvar på sina poster – sidan läser bara.
   ====================================================================== */

const anVy = { lage: "lista", tavla: null, typ: "", sok: "", id: null, tid: null };

function oppnaAnteckningar() {
    try { stangStart(); } catch (e) { }
    try { stangDash(); } catch (e) { }
    try { stangGantt(); } catch (e) { }
    try { stangBackup(); } catch (e) { }
    try { stangHjalp(); } catch (e) { }
    try { stangDagbok(); } catch (e) { }
    try { stangForslag(); } catch (e) { }
    try { stangTidplan(); } catch (e) { }
    document.body.classList.remove("p4-kontovy");
    document.body.classList.add("dashlage");
    document.getElementById("anteckningar").classList.remove("dold");
    anVy.lage = "lista";
    anVy.tavla = null;
    ritaAnteckningar();
}
function stangAnteckningar() {
    const el = document.getElementById("anteckningar");
    if (!el || el.classList.contains("dold"))
        return;
    el.classList.add("dold");
    let annan = false;
    try { annan = dashOppen() || startOppen() || ganttOppen() || backupOppen() || hjalpOppen() || dagbokOppen() || forslagOppen() || tidplanOppen(); } catch (e) { }
    if (!annan)
        document.body.classList.remove("dashlage");
}
function anteckningarOppen() { const el = document.getElementById("anteckningar"); return !!el && !el.classList.contains("dold"); }

// De andra sidorna stänger Anteckningar när de öppnas.
["oppnaGantt", "oppnaDash", "oppnaStart", "oppnaBackup", "oppnaHjalp", "oppnaDagbok", "oppnaForslag", "oppnaTidplan"].forEach(namn => {
    const urs = window[namn];
    if (typeof urs !== "function")
        return;
    window[namn] = function () { stangAnteckningar(); return urs.apply(this, arguments); };
});

/* ---------- data ---------- */

// null = följ aktiv tavla, "" = alla tavlor
function anVisadTavla() { return anVy.tavla === null ? (state.tavlor.length > 1 ? T().id : "") : anVy.tavla; }

function anAlla() {
    const vt = anVisadTavla(), ut = [];
    state.tavlor.forEach(t => {
        if (vt && t.id !== vt) return;
        (t.kort || []).forEach(k => {
            if (k.virtuell || !(k.not || "").trim()) return;
            ut.push({ t, k });
        });
    });
    return ut.sort((a, b) => (b.k.dag || "").localeCompare(a.k.dag || "") || (a.k.tid || "").localeCompare(b.k.tid || ""));
}
function anHitta(tid, id) {
    const t = state.tavlor.find(x => x.id === tid);
    const k = t && t.kort.find(x => x.id === id);
    return k ? { t, k } : null;
}
function anNamn(x) { return kortText(x.k, x.t, state); }

/* ---------- ritning ---------- */

function ritaAnteckningar() {
    const el = document.getElementById("anteckningar");
    if (!el || !state) return;
    if (anVy.lage === "visa") {
        const x = anHitta(anVy.tid, anVy.id);
        if (x && (x.k.not || "").trim()) return ritaEnAnteckning(el, x);
        anVy.lage = "lista";
    }
    const alla = anAlla();
    const typer = [...new Set(alla.map(x => x.k.typ))];
    const sok = anVy.sok.toLowerCase();
    const lista = alla.filter(x => (!anVy.typ || x.k.typ === anVy.typ) &&
        (!sok || (anNamn(x) + " " + x.k.not + " " + (x.k.vem || "")).toLowerCase().indexOf(sok) >= 0));
    let html = "", senaste = "";
    lista.forEach(x => {
        if (x.k.dag !== senaste) {
            senaste = x.k.dag;
            html += '<li class="db-manad">' + esc(dbLangtDatum(x.k.dag)) + " · v" + veckonr(x.k.dag) + "</li>";
        }
        const forsta = x.k.not.trim().split(/\r?\n/)[0];
        html += '<li><button type="button" class="db-rad an-rad" data-an="' + esc(x.t.id) + "|" + esc(x.k.id) + '">' +
            '<span class="an-typ t-' + esc(x.k.typ) + '">' + esc(TYPNAMN[x.k.typ] || x.k.typ) + "</span>" +
            '<span class="db-mitt"><b>' + esc(anNamn(x)) + "</b><small>" + esc(forsta) + "</small></span>" +
            '<span class="an-hoger">' + (state.tavlor.length > 1 && !anVisadTavla() ? '<span class="db-tagg">' + esc(x.t.namn) + "</span>" : "") +
            '<span class="db-pil" aria-hidden="true">›</span></span></button></li>';
    });
    el.innerHTML =
        '<section class="db-sida">' +
        '<header class="db-topp"><div><h2>Anteckningar' + (state.projekt ? ' <span class="db-projnamn">· ' + esc(state.projekt) + "</span>" : "") + "</h2><p>" +
        (alla.length ? alla.length + (alla.length === 1 ? " post har anteckningar" : " poster har anteckningar")
            : "Här samlas allt som skrivs under Anteckningar på posterna, till exempel mötesanteckningar.") + "</p></div></header>" +
        '<div class="db-verktyg">' +
        tavelFilterHtml("anTavla", anVisadTavla()) +
        (typer.length > 1 ? '<select class="f dashval" id="anTyp" aria-label="Visa typ"><option value="">Alla typer</option>' +
            typer.map(t => '<option value="' + esc(t) + '"' + (anVy.typ === t ? " selected" : "") + ">" + esc(TYPNAMN[t] || t) + "</option>").join("") + "</select>" : "") +
        '<input class="f db-sok" id="anSok" type="search" placeholder="Sök i anteckningarna" value="' + esc(anVy.sok) + '"></div>' +
        (lista.length ? '<ul class="db-lista">' + html + "</ul>"
            : '<div class="db-tom"><b>' + (alla.length ? "Inga anteckningar matchar" : "Inga anteckningar än") + "</b><p>" +
            (alla.length ? "Ändra sökningen eller filtret." : "Öppna en post på tavlan och skriv under Anteckningar, så hamnar den här.") + "</p></div>") +
        "</section>";
    const tf = document.getElementById("anTavla");
    if (tf) tf.addEventListener("change", () => { anVy.tavla = tf.value; ritaAnteckningar(); });
    const ty = document.getElementById("anTyp");
    if (ty) ty.addEventListener("change", () => { anVy.typ = ty.value; ritaAnteckningar(); });
    const s = document.getElementById("anSok");
    s.addEventListener("input", () => {
        anVy.sok = s.value;
        const pos = s.selectionStart;
        ritaAnteckningar();
        const ny = document.getElementById("anSok");
        ny.focus(); ny.setSelectionRange(pos, pos);
    });
    el.querySelectorAll("[data-an]").forEach(b => b.addEventListener("click", () => {
        const [tid, id] = b.dataset.an.split("|");
        anVy.lage = "visa"; anVy.tid = tid; anVy.id = id;
        ritaAnteckningar();
        window.scrollTo({ top: 0 });
    }));
}

function ritaEnAnteckning(el, x) {
    const k = x.k, t = x.t;
    const info = [
        ["Typ", TYPNAMN[k.typ] || k.typ],
        ["Dag", dagEtikett(k.dag)],
        state.tavlor.length > 1 ? ["Tavla", t.namn] : null,
        k.tid ? ["Klockslag", tidText(k)] : null,
        k.plats ? ["Plats", k.plats] : null,
        k.vem ? ["Vem", k.vem] : null
    ].filter(Boolean);
    el.innerHTML =
        '<section class="db-sida db-en">' +
        '<div class="db-tillbaka"><button type="button" class="mknapp" data-ang="lista">← Alla anteckningar</button></div>' +
        '<header class="db-entopp"><div><span class="db-proj">' + esc(TYPNAMN[k.typ] || k.typ) + " · " + esc(state.projekt) + "</span><h2>" + esc(anNamn(x)) + "</h2>" +
        "<p>" + esc(dbLangtDatum(k.dag)) + " · vecka " + veckonr(k.dag) + "</p></div>" +
        '<div class="db-enknappar">' +
        '<button type="button" class="mknapp" data-ang="post">Visa posten på tavlan</button>' +
        '<button type="button" class="mknapp primar p4-mailknapp" data-ang="maila"><span class="p4-mailikon" aria-hidden="true"></span>Maila</button>' +
        "</div></header>" +
        '<section class="db-kort an-kort"><dl class="an-info">' + info.map(r => "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>").join("") + "</dl>" +
        '<h3>Anteckningar</h3><div class="an-text">' + esc(k.not) + "</div></section>" +
        "</section>";
    el.querySelector('[data-ang="lista"]').addEventListener("click", () => { anVy.lage = "lista"; ritaAnteckningar(); });
    el.querySelector('[data-ang="post"]').addEventListener("click", () => {
        stangAnteckningar();
        if (window.p4MarkeraNav) window.p4MarkeraNav();
        if (state.aktiv !== t.id) { state.aktiv = t.id; spara(); }
        const v = Math.floor((iso2d(k.dag) - iso2d(tavlaStart())) / 86400000 / 7);
        vyOffset = v >= 0 && v < 4 ? 0 : v;
        rita();
        visaKort(k);
    });
    const mk = el.querySelector('[data-ang="maila"]');
    mk.addEventListener("click", () => valjMottagare(k, t, mk, till => mailaAnteckning(k, t, k.not.trim(), till)));
}
