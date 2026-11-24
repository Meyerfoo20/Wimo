/* ======================================================================
   Wimo · Tidplan: flera tidplaner i ett projekt
   Tidplan i menyn visar en lista med projektets tidplaner. Varje tidplan har
   egna aktiviteter (a.tpid) och egna baslinjer, och egna inställningar för vad
   som syns (kolumner, helger, samband, resurspanel och tidsskala).
   Tidplanerna beskrivs i state.tidplan.planer: [{ id, namn, skapad, visa, visaRev }].
   Projektets första tidplan har id "" och behöver ingen post i listan.
   ====================================================================== */

let tpListaVisas = true;       // true = listan med tidplaner, false = en öppen tidplan
let tpPlanPid = null;          // projektet som den valda tidplanen gäller

const TP_PLAN_VISA_STD = { dolda: [], helger: false, samband: true, resurser: "normal", zoom: "vecka" };

function tpPlanerLista() {
    const tp = state && state.tidplan;
    return tp && Array.isArray(tp.planer) ? tp.planer.filter(x => x && typeof x === "object" && typeof x.id === "string") : [];
}
function tpPlanMeta(id) { return tpPlanerLista().find(x => x.id === (id || "")) || null; }
function tpPlanNamn(id) {
    const m = tpPlanMeta(id);
    return (m && m.namn) || (id ? "Tidplan" : "Huvudtidplan");
}
// Alla tidplaner i projektet: den första alltid först, sedan de andra i den ordning de skapades.
function tpPlaner() {
    const egna = tpPlanerLista().filter(x => x.id);
    return [{ id: "", namn: tpPlanNamn("") }].concat(egna.map(x => ({ id: x.id, namn: tpPlanNamn(x.id) })));
}

// Den valda tidplanen gäller per projekt och sparas i den här webbläsaren.
function tpValjPlan(id) {
    if (!state) return;
    if (id && !tpPlanMeta(id)) id = "";
    tpSattPlan(id || "");
    tpPlanPid = state.id;
    try { localStorage.setItem("wimo_tidplan_vald_" + state.id, id || ""); } catch (e) { }
}
// Byter man projekt, eller tar någon annan bort tidplanen, väljs en som finns.
function tpSakerstallPlan() {
    if (!state) return;
    if (tpPlanPid !== state.id) {
        let id = "";
        try { id = localStorage.getItem("wimo_tidplan_vald_" + state.id) || ""; } catch (e) { }
        tpSattPlan(id && tpPlanMeta(id) ? id : "");
        tpPlanPid = state.id;
        tpListaVisas = true;
    } else if (tpAktivPlan() && !tpPlanMeta(tpAktivPlan())) {
        tpSattPlan("");
        tpListaVisas = true;
    }
}

/* ---------- listan ---------- */

function tpPlanSammanfattning(id) {
    const akt = tpAllaAktiviteter(state).filter(a => (a.tpid || "") === id);
    let fran = null, till = null;
    akt.forEach(a => (a.perioder || []).forEach(q => {
        const s = tpStart(q), e = tpSlut(q);
        if (!fran || s < fran) fran = s;
        if (!till || e > till) till = e;
    }));
    return { antal: akt.length, fran, till };
}

function tpRitaPlanlista(el) {
    const kan = tpKanAndra();
    const kort = tpPlaner().map(pl => {
        const s = tpPlanSammanfattning(pl.id);
        const period = s.fran ? "v" + veckonr(s.fran) + "–v" + veckonr(s.till) + " · " + kortDatum(s.fran) + " – " + kortDatum(s.till) : "Inga datum ännu";
        return '<div class="tp-plankort" role="listitem">' +
            '<button type="button" class="tp-planoppna" data-tpplan="' + esc(pl.id) + '">' +
            '<span class="tp-plannamn">' + esc(pl.namn) + "</span>" +
            '<span class="tp-planinfo">' + s.antal + (s.antal === 1 ? " aktivitet" : " aktiviteter") + "</span>" +
            '<span class="tp-planinfo">' + esc(period) + "</span></button>" +
            (kan ? '<button type="button" class="mknapp tp-planinst" data-tpplaninst="' + esc(pl.id) + '">Inställningar</button>' : "") +
            "</div>";
    }).join("");
    el.classList.remove("tp-tabsmal");
    el.innerHTML =
        '<div class="p4-hero tp-hero"><div class="p4-hero-text">' +
        '<h1 class="g-rubrik">Tidplaner</h1>' +
        '<div class="g-meta">' + esc(state.projekt || "Projekt") + " · " + tpPlaner().length + (tpPlaner().length === 1 ? " tidplan" : " tidplaner") + "</div></div>" +
        (kan ? '<div class="tp-verktyg"><button type="button" class="mknapp primar" data-tpnyplan>+ Ny tidplan</button></div>' : "") + "</div>" +
        '<div class="tp-planlista" role="list">' + kort +
        (kan ? '<button type="button" class="tp-plannykort" data-tpnyplan><span>+ Ny tidplan</span><small>Egen tidplan med egna aktiviteter</small></button>' : "") +
        "</div>";
}

/* ---------- skapa och ändra ---------- */

function tpPlanDialog(id) {
    const ny = id === undefined;
    const meta = ny ? null : tpPlanMeta(id);
    const namn = ny ? "" : tpPlanNamn(id);
    const visa = Object.assign({}, TP_PLAN_VISA_STD, (meta && meta.visa) || {});
    const dolda = new Set(visa.dolda || []);
    const kol = TP_KOLUMNER.filter(k => k.valbar && k.kraver !== "bas");
    const kryss = (id, txt, pa, hjalp) => '<label class="kryssrad"><input type="checkbox" id="' + id + '"' + (pa ? " checked" : "") + "> <span><b>" + txt + "</b>" + (hjalp ? "<small>" + hjalp + "</small>" : "") + "</span></label>";
    const kropp =
        '<label class="falt"><span>Namn</span><input class="f" id="tpPlNamn" maxlength="60" value="' + esc(namn) + '" placeholder="T.ex. Hus A, Stomme eller Installationer" autocomplete="off"></label>' +
        '<div class="tp-plval"><div class="tp-plrub">Kolumner i tabellen</div><div class="tp-plkol">' +
        kol.map(k => '<label class="kryssrad"><input type="checkbox" data-tpplkol="' + k.id + '"' + (dolda.has(k.id) ? "" : " checked") + "> <span>" + esc(k.lang || k.namn) + "</span></label>").join("") +
        "</div></div>" +
        '<div class="tp-plval"><div class="tp-plrub">I kalendern</div>' +
        kryss("tpPlHelger", "Helger", visa.helger, "Visa lördag och söndag") +
        kryss("tpPlSamband", "Samband", visa.samband, "Pilar mellan aktiviteter som hänger ihop") +
        kryss("tpPlResurser", "Resurspanel", visa.resurser !== "ihop", "Bemanning per vecka under tidplanen") +
        '<label class="falt tp-plzoom"><span>Tidsskala när tidplanen öppnas</span><select class="f" id="tpPlZoom">' +
        Object.keys(TP_ZOOM).map(z => '<option value="' + z + '"' + (visa.zoom === z ? " selected" : "") + ">" + TP_ZOOM[z].namn + "</option>").join("") + "</select></label></div>" +
        '<div class="notis rod dold" id="tpPlFel"></div>';
    const knappar = [{ txt: "Avbryt", fn: stangModal }];
    if (!ny && id) knappar.unshift({ txt: "Ta bort tidplanen", fara: true, vanster: true, fn: () => tpTaBortPlan(id) });
    knappar.push({ txt: ny ? "Skapa tidplan" : "Spara", primar: true, fn: () => tpSparaPlan(id) });
    modal(ny ? "Ny tidplan" : "Inställningar för " + namn, ny ? "En egen tidplan med egna aktiviteter. Det du väljer här går att ändra sedan." : "Det du väljer här gäller för alla som öppnar tidplanen.", kropp, knappar);
    setTimeout(() => { const f = document.getElementById("tpPlNamn"); if (f) { f.focus(); f.select(); } }, 30);
}

function tpSparaPlan(id) {
    const ny = id === undefined;
    const fel = (t) => { const f = document.getElementById("tpPlFel"); f.textContent = t; f.classList.remove("dold"); };
    const namn = document.getElementById("tpPlNamn").value.trim();
    if (!namn) return fel("Skriv ett namn på tidplanen.");
    const dubbel = tpPlaner().find(p => p.namn.toLowerCase() === namn.toLowerCase() && p.id !== id);
    if (dubbel) return fel("Det finns redan en tidplan som heter " + dubbel.namn + ".");
    const visa = {
        dolda: [...document.querySelectorAll("[data-tpplkol]")].filter(x => !x.checked).map(x => x.dataset.tpplkol),
        helger: document.getElementById("tpPlHelger").checked,
        samband: document.getElementById("tpPlSamband").checked,
        resurser: document.getElementById("tpPlResurser").checked ? "normal" : "ihop",
        zoom: document.getElementById("tpPlZoom").value
    };
    const tp = state.tidplan;
    if (!Array.isArray(tp.planer)) tp.planer = [];
    const nyttId = ny ? "pl" + uid() : id;
    let meta = tp.planer.find(x => x && x.id === nyttId);
    if (!meta) { meta = { id: nyttId, skapad: new Date().toISOString() }; tp.planer.push(meta); }
    meta.namn = namn;
    meta.visa = visa;
    meta.visaRev = Date.now();
    spara();
    stangModal();
    // den som ändrade ser ändringen direkt
    if (tpAktivPlan() === nyttId || ny) tpVy.pid = null;
    if (ny) {
        tpValjPlan(nyttId);
        tpListaVisas = false;
        tpVy.pid = null;
        status("Tidplanen " + namn + " är skapad");
    } else status("Inställningarna för " + namn + " är sparade");
    ritaTidplan();
}

function tpTaBortPlan(id) {
    const namn = tpPlanNamn(id);
    const akt = tpAllaAktiviteter(state).filter(a => (a.tpid || "") === id);
    modal("Ta bort " + namn + "?", "",
        '<p class="fraga">' + (akt.length ? "Tidplanens " + akt.length + (akt.length === 1 ? " aktivitet" : " aktiviteter") + " tas också bort. " : "") + "Det går inte att ångra.</p>",
        [{ txt: "Avbryt", fn: stangModal },
         { txt: "Ta bort", fara: true, fn: () => {
            const tp = state.tidplan;
            if (akt.length) {
                const patch = { ok: true, fel: null, historik: [],
                    andringar: akt.map(x => ({ typ: "taBort", objekt: "tpaktivitet", id: x.id })),
                    fore: akt.map(x => ({ objekt: "tpaktivitet", id: x.id, varde: JSON.parse(JSON.stringify(x)) })) };
                appliceraPatch(patch, { tavla: T(), projekt: state });
            }
            tp.planer = (tp.planer || []).filter(x => x && x.id !== id);
            if (Array.isArray(tp.baslinjer)) tp.baslinjer = tp.baslinjer.filter(b => (b.tpid || "") !== id);
            try { localStorage.removeItem("wimo_tidplanvy_" + state.id + "_" + id); } catch (e) { }
            if (tpAktivPlan() === id) tpValjPlan("");
            tpListaVisas = true;
            spara();
            stangModal();
            status(namn + " är borttagen");
            ritaTidplan();
         } }]);
}

/* ---------- klick ---------- */

document.addEventListener("click", (e) => {
    if (!e.target.closest || !e.target.closest("#tidplan, #overlay")) return;
    const oppna = e.target.closest("[data-tpplan]");
    if (oppna) {
        tpValjPlan(oppna.dataset.tpplan);
        tpListaVisas = false;
        tpScroll = null;
        ritaTidplan();
        window.scrollTo({ top: 0 });
        return;
    }
    if (e.target.closest("[data-tpplanlista]")) {
        if (tpRedigerar) tpAvsluta(true);
        document.body.classList.remove("tp-fullvy");
        tpListaVisas = true;
        ritaTidplan();
        window.scrollTo({ top: 0 });
        return;
    }
    const inst = e.target.closest("[data-tpplaninst]");
    if (inst) { if (tpKanAndra()) tpPlanDialog(inst.dataset.tpplaninst); return; }
    if (e.target.closest("[data-tpnyplan]")) { if (tpKanAndra()) tpPlanDialog(); }
});
