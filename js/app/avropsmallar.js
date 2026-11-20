/* ======================================================================
   Wimo · Avrop: beställningsmallar

   Projektinställningar → Avrop och beställningar:
   - det som gäller alla avrop i projektet: märkning (projektnummer),
     leveransadress, lastzoner, kontaktperson på plats och beställare
   - mallar: leverantör, typ, lastzon och produktrader (produkt, övrigt,
     dimension, antal, enhet) – allt utom leveransdatum och leveranstid

   När man skapar ett avrop väljer man en mall och fyller bara i datum och
   leveranstid. Beställningen sparas på avropet (k.avrop.best) som en kopia,
   så att den inte ändras om mallen ändras senare, och följer med i mejlet.
   ====================================================================== */

const AVR_LEVTIDER = ["Morgon", "Förmiddag", "Eftermiddag"];
const AVR_ENHETER = ["st", "ton", "kg", "m", "m²", "m³", "lpm", "pall", "förp", "rulle", "säck"];

function avrInst() {
    const a = state.avropInst || {};
    return {
        markning: a.markning || "", adress: a.adress || "",
        zoner: Array.isArray(a.zoner) ? a.zoner.filter(Boolean) : [],
        kontakt: Object.assign({ namn: "", tel: "" }, a.kontakt || {}),
        bestallare: Object.assign({ namn: "", epost: "" }, a.bestallare || {}),
        mallar: Array.isArray(a.mallar) ? a.mallar : []
    };
}
const avrTomRad = () => ({ produkt: "", ovrigt: "", dimension: "", antal: "", enhet: "" });
const avrRadTom = (r) => !((r.produkt || "").trim() || (r.ovrigt || "").trim() || (r.dimension || "").trim() || String(r.antal || "").trim());
const avrKopia = (o) => JSON.parse(JSON.stringify(o));

// En beställning: kopia av projektets uppgifter + mallens innehåll. Datum och leveranstid fylls i vid avropet.
function avrNyBest(mall) {
    const p = avrInst();
    return {
        mallId: mall ? mall.id : null, mallNamn: mall ? mall.namn : "",
        markning: p.markning, adress: (mall && mall.adress) || p.adress,
        lastzon: (mall && mall.lastzon) || p.zoner[0] || "", levTid: "",
        kontakt: avrKopia(p.kontakt), bestallare: avrKopia(p.bestallare),
        rader: mall && mall.rader && mall.rader.length ? avrKopia(mall.rader) : [avrTomRad()],
        meddelande: (mall && mall.meddelande) || ""
    };
}

/* ---------- beställningen: redigering (Snabb post, Ändra beställning) ---------- */

function avrBestHtml(best) {
    const p = avrInst(), zoner = p.zoner.slice();
    if (best.lastzon && zoner.indexOf(best.lastzon) < 0) zoner.push(best.lastzon);
    const info = [best.markning ? "Märkning <b>" + esc(best.markning) + "</b>" : "", best.adress ? esc(best.adress) : "",
        best.kontakt && best.kontakt.namn ? "Kontakt " + esc(best.kontakt.namn) + (best.kontakt.tel ? " " + esc(best.kontakt.tel) : "") : ""].filter(Boolean);
    return '<div class="avr-best">' +
        (info.length ? '<p class="avr-info">' + info.join(" · ") + "</p>" : '<p class="avr-info hjalp">Märkning, adress och kontaktperson fylls i under Projektinställningar → Avrop och beställningar.</p>') +
        '<div class="avr-tva">' +
        '<div class="falt"><label>Leveranstid</label><div class="lage avr-levtid">' + AVR_LEVTIDER.map(x => '<button type="button" data-avrtid="' + x + '"' + (best.levTid === x ? ' class="vald"' : "") + ">" + x + "</button>").join("") + "</div></div>" +
        '<div class="falt"><label>Lastzon</label>' + (zoner.length
            ? '<select class="f" data-avr="lastzon"><option value="">Ingen</option>' + zoner.map(z => '<option' + (z === best.lastzon ? " selected" : "") + ">" + esc(z) + "</option>").join("") + "</select>"
            : '<input class="f" data-avr="lastzon" value="' + esc(best.lastzon || "") + '" placeholder="T.ex. Zon 1">') + "</div></div>" +
        '<div class="falt"><label>Produkter</label>' + avrRaderHtml(best.rader) + "</div>" +
        '<div class="falt"><label>Meddelande till leverantören <span class="hjalp">valfritt</span></label><textarea class="f" rows="2" data-avr="meddelande" placeholder="T.ex. ring 30 min innan">' + esc(best.meddelande || "") + "</textarea></div>" +
        "</div>";
}

function avrRaderHtml(rader) {
    return '<div class="avr-rader"><div class="avr-rad avr-radhuvud"><span>Produkt</span><span>Övrigt</span><span>Dimension</span><span>Antal</span><span>Enhet</span><span></span></div>' +
        rader.map((r, i) => '<div class="avr-rad" data-avrrad="' + i + '">' +
            '<input class="f" data-avrf="produkt" value="' + esc(r.produkt || "") + '" placeholder="T.ex. A-järn armering" aria-label="Produkt">' +
            '<input class="f" data-avrf="ovrigt" value="' + esc(r.ovrigt || "") + '" aria-label="Övrigt">' +
            '<input class="f" data-avrf="dimension" value="' + esc(r.dimension || "") + '" placeholder="12 L 6000" aria-label="Dimension">' +
            '<input class="f" data-avrf="antal" inputmode="decimal" value="' + esc(String(r.antal || "")) + '" aria-label="Antal">' +
            '<input class="f" data-avrf="enhet" list="avrEnheter" value="' + esc(r.enhet || "") + '" placeholder="st" aria-label="Enhet">' +
            '<button type="button" class="avr-x" data-avrbort="' + i + '" aria-label="Ta bort raden" title="Ta bort raden">×</button></div>').join("") +
        '<datalist id="avrEnheter">' + AVR_ENHETER.map(e => '<option value="' + e + '">').join("") + "</datalist>" +
        '<button type="button" class="p4d-lank" data-avrny>+ Lägg till produkt</button></div>';
}

// Kopplar redigeringen: ändringar skrivs direkt i objektet (best eller mall).
function avrBestKoppla(rot, obj, omrita) {
    rot.addEventListener("input", (e) => {
        const r = e.target.closest("[data-avrrad]");
        if (r && e.target.dataset.avrf) obj.rader[+r.dataset.avrrad][e.target.dataset.avrf] = e.target.value;
        else if (e.target.dataset.avr) obj[e.target.dataset.avr] = e.target.value;
    });
    rot.addEventListener("change", (e) => { if (e.target.dataset.avr) obj[e.target.dataset.avr] = e.target.value; });
    rot.addEventListener("click", (e) => {
        const tid = e.target.closest("[data-avrtid]");
        if (tid) {
            obj.levTid = obj.levTid === tid.dataset.avrtid ? "" : tid.dataset.avrtid;
            rot.querySelectorAll("[data-avrtid]").forEach(b => b.classList.toggle("vald", b.dataset.avrtid === obj.levTid));
            return;
        }
        const bort = e.target.closest("[data-avrbort]");
        if (bort) { obj.rader.splice(+bort.dataset.avrbort, 1); if (!obj.rader.length) obj.rader.push(avrTomRad()); return omrita(); }
        if (e.target.closest("[data-avrny]")) {
            obj.rader.push(avrTomRad());
            omrita();
            const f = rot.querySelectorAll('[data-avrf="produkt"]'); if (f.length) f[f.length - 1].focus();
        }
    });
    // Enter i sista radens fält ger en ny rad
    rot.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" || !e.target.dataset.avrf) return;
        e.preventDefault(); e.stopPropagation();
        const r = e.target.closest("[data-avrrad]");
        if (+r.dataset.avrrad === obj.rader.length - 1) { obj.rader.push(avrTomRad()); omrita(); }
        const f = rot.querySelectorAll('[data-avrrad="' + (+r.dataset.avrrad + 1) + '"] [data-avrf="produkt"]'); if (f.length) f[0].focus();
    });
}

// Rensad beställning att spara: tomma rader bort.
function avrRensa(best) {
    const b = avrKopia(best);
    b.rader = (b.rader || []).filter(r => !avrRadTom(r)).map(r => ({ produkt: (r.produkt || "").trim(), ovrigt: (r.ovrigt || "").trim(), dimension: (r.dimension || "").trim(), antal: String(r.antal || "").trim(), enhet: (r.enhet || "").trim() }));
    b.meddelande = (b.meddelande || "").trim();
    return b;
}

/* ---------- beställningen: visning och mejl ---------- */

const avrRadText = (r) => [r.produkt, r.ovrigt, r.dimension, [r.antal, r.enhet].filter(Boolean).join(" ")].filter(Boolean).join(" · ");

function avrBestDetalj(best, k) {
    const lev = typeof avropsLeverans === "function" ? avropsLeverans(k, T()) : null;
    const rad = (a, b) => b ? "<li><span>" + a + "</span><span>" + b + "</span></li>" : "";
    return '<div class="avr-detalj"><ul class="detalj">' +
        rad("Leverans", lev ? esc(dagEtikett(lev.dag)) + (best.levTid ? " · " + esc(best.levTid) : "") : best.levTid ? esc(best.levTid) : '<span class="avr-saknas">Inget leveransdatum</span>') +
        rad("Lastzon", esc(best.lastzon || "")) + rad("Märkning", esc(best.markning || "")) + rad("Leveransadress", esc(best.adress || "")) +
        rad("Kontaktperson", esc([best.kontakt && best.kontakt.namn, best.kontakt && best.kontakt.tel].filter(Boolean).join(", "))) + "</ul>" +
        (best.rader && best.rader.length ? '<table class="lista avr-tabell"><thead><tr><th>Produkt</th><th>Övrigt</th><th>Dimension</th><th class="tal">Antal</th><th>Enhet</th></tr></thead><tbody>' +
            best.rader.map(r => "<tr><td>" + esc(r.produkt) + "</td><td>" + esc(r.ovrigt) + "</td><td>" + esc(r.dimension) + '</td><td class="tal">' + esc(r.antal) + "</td><td>" + esc(r.enhet) + "</td></tr>").join("") + "</tbody></table>" : '<p class="hjalp">Inga produkter.</p>') +
        (best.meddelande ? '<p class="avr-medd">' + esc(best.meddelande) + "</p>" : "") + "</div>";
}

// Raderna i mejlet, i samma ordning som beställningsmallen.
function avrMejlRader(best, k, t) {
    const p = projektForTavla(t) || state, a = k.avrop || {}, f = a.foretagId && ftgPost(p, a.foretagId);
    const lev = avropsLeverans(k, t), ut = [];
    const s = (namn, v) => { if (v) ut.push(namn + ": " + v); };
    s("Märkning / projektnummer", best.markning);
    s("Leverantör", f ? f.namn : a.leverantor);
    s("Önskat leveransdatum", lev ? mailDag(lev.dag, "") : "");
    s("Önskad leveranstid", best.levTid);
    s("Lossningszon", best.lastzon);
    s("Leveransadress", best.adress);
    s("Kontaktperson på plats", [best.kontakt && best.kontakt.namn, best.kontakt && best.kontakt.tel].filter(Boolean).join(", "));
    s("Beställare", [best.bestallare && best.bestallare.namn, best.bestallare && best.bestallare.epost].filter(Boolean).join(", "));
    s("Beställningsdatum", mailDagNamn(d2iso(new Date())));
    const rader = (best.rader || []).filter(r => !avrRadTom(r));
    if (rader.length) { ut.push("", "Produkter:"); rader.forEach(r => ut.push("- " + avrRadText(r))); }
    if (best.meddelande) ut.push("", best.meddelande);
    return ut;
}

/* ---------- ändra beställningen på ett befintligt avrop ---------- */

function avrBestDialog(k, efter) {
    const ny = !(k.avrop && k.avrop.best);
    const best = ny ? avrNyBest(null) : avrKopia(k.avrop.best);
    const mallar = avrInst().mallar;
    const kropp = (mallar.length ? '<div class="falt"><label for="abMall">' + (ny ? "Utgå från mall" : "Byt till mall") + '</label><select class="f" id="abMall"><option value="">' + (ny ? "Ingen mall" : "Behåll") + "</option>" +
        mallar.map(m => '<option value="' + esc(m.id) + '">' + esc(m.namn) + "</option>").join("") + "</select></div>" : "") +
        '<div id="abBest"></div>';
    modal(ny ? "Lägg till beställning" : "Ändra beställning", kortText(k, T(), projektForTavla(T())), kropp, [
        !ny ? { txt: "Ta bort beställningen", vanster: true, fara: true, fn: () => { delete k.avrop.best; stangModal(); spara(); rita(); status("Beställningen togs bort från avropet"); if (efter) efter(); } } : null,
        { txt: "Avbryt", fn: () => { stangModal(); if (efter) efter(); } },
        { txt: "Spara", primar: true, fn: () => {
            const b = avrRensa(obj);
            if (!k.avrop) k.avrop = { slag: "material", txt: k.text || "", leverantor: "", levDag: "", levKortId: null, foretagId: null };
            k.avrop.best = b;
            stangModal(); spara(); rita();
            status("Beställningen sparad");
            if (efter) efter();
        } }
    ].filter(Boolean));
    let obj = best;
    const rot = document.getElementById("abBest");
    const omrita = () => { rot.innerHTML = avrBestHtml(obj); };
    // hållaren pekar alltid på aktuell beställning (byts när man väljer mall)
    const hall = {};
    ["rader", "levTid", "lastzon", "meddelande"].forEach(n => Object.defineProperty(hall, n, { get: () => obj[n], set: (v) => { obj[n] = v; } }));
    avrBestKoppla(rot, hall, omrita);
    omrita();
    const ms = document.getElementById("abMall");
    if (ms) ms.addEventListener("change", () => {
        const m = mallar.find(x => x.id === ms.value);
        if (!m) return;
        const levTid = obj.levTid;
        obj = avrNyBest(m); obj.levTid = levTid;
        omrita();
    });
}

/* ---------- projektinställningar: avrop och beställningar ---------- */

function avropInstDialog() {
    const arb = avrKopia(avrInst());
    let oppen = null;   // id på mallen som redigeras
    const nya = new Set();   // mallar som skapats i den här dialogen
    const tomMall = () => ({ id: uid(), namn: "", slag: "material", foretagId: null, leverantor: "", lastzon: "", adress: "", rader: [avrTomRad()], meddelande: "" });
    // inga mallar än: börja med en tom mall öppen, så man kan fylla i direkt
    if (!arb.mallar.length) { const n = tomMall(); arb.mallar.push(n); nya.add(n.id); oppen = n.id; }
    const kan = typeof arProjektAdmin !== "function" || !state.id || arProjektAdmin(state.id);
    const mallMeta = (m) => {
        const f = m.foretagId && ftgPost(state, m.foretagId);
        const n = (m.rader || []).filter(r => !avrRadTom(r)).length;
        return [m.slag === "ue" ? "UE" : "Material", f ? f.namn : m.leverantor, n + (n === 1 ? " produkt" : " produkter"), m.lastzon].filter(Boolean).join(" · ");
    };
    const mallRad = (m) => oppen === m.id
        ? '<li class="avr-mall oppen" data-mall="' + esc(m.id) + '">' +
            '<div class="avr-mallrubrik">' + (nya.has(m.id) ? "Ny mall" : "Ändra mall") + "</div>" +
            '<div class="avr-tva"><div class="falt"><label>Mallens namn</label><input class="f" data-m="namn" value="' + esc(m.namn) + '" placeholder="T.ex. Armering NP Nilsson"></div>' +
            '<div class="falt"><label>Typ</label><div class="lage"><button type="button" data-mslag="material"' + (m.slag !== "ue" ? ' class="vald"' : "") + '>Material</button><button type="button" data-mslag="ue"' + (m.slag === "ue" ? ' class="vald"' : "") + ">UE / extern resurs</button></div></div></div>" +
            '<div class="avr-tva"><div class="falt"><label>Leverantör</label><span class="avr-ftg">' + foretagValjare(state, m.slag === "ue" ? "ue" : "leverantor", m.foretagId || null, "mallftg", m.foretagId ? "" : (m.leverantor || "")) + "</span></div>" +
            '<div class="falt"><label>Lastzon</label>' + (arb.zoner.length ? '<select class="f" data-m="lastzon"><option value="">Projektets första (' + esc(arb.zoner[0]) + ")</option>" + arb.zoner.map(z => "<option" + (z === m.lastzon ? " selected" : "") + ">" + esc(z) + "</option>").join("") + "</select>"
                : '<input class="f" data-m="lastzon" value="' + esc(m.lastzon || "") + '" placeholder="T.ex. Zon 1">') + "</div></div>" +
            '<div class="falt"><label>Leveransadress <span class="hjalp">om den skiljer sig från projektets</span></label><input class="f" data-m="adress" value="' + esc(m.adress || "") + '" placeholder="' + esc(arb.adress || "Samma som projektet") + '"></div>' +
            '<div class="falt"><label>Produkter</label><div data-mrader>' + avrRaderHtml(m.rader) + "</div></div>" +
            '<div class="falt"><label>Meddelande till leverantören <span class="hjalp">valfritt</span></label><textarea class="f" rows="2" data-m="meddelande">' + esc(m.meddelande || "") + "</textarea></div>" +
            '<div class="avr-mallknappar">' + (nya.has(m.id) && arb.mallar.length > 1 ? '<button type="button" class="p4d-lank" data-mgor="bort">Avbryt</button>' : "") +
            '<button type="button" class="mknapp" data-mgor="klar">Klar med mallen</button></div></li>'
        : '<li class="avr-mall" data-mall="' + esc(m.id) + '"><span class="avr-mallnamn"><b>' + esc(m.namn || "Namnlös mall") + "</b><small>" + esc(mallMeta(m)) + "</small></span>" +
            (kan ? '<button type="button" class="p4d-lank" data-mgor="andra">Ändra</button><button type="button" class="p4d-lank" data-mgor="kopiera">Kopiera</button><button type="button" class="p4d-lank fara" data-mgor="bort">Ta bort</button>' : "") + "</li>";
    const ritaMallar = () => {
        document.getElementById("avrMallar").innerHTML = (arb.mallar.length ? '<ul class="avr-mallista">' + arb.mallar.map(mallRad).join("") + "</ul>"
            : '<p class="hjalp" style="margin:0 0 8px">Inga mallar.</p>') +
            (kan && !oppen ? '<button type="button" class="mknapp" data-mgor="ny">+ ' + (arb.mallar.length ? "Skapa en mall till" : "Skapa en mall") + "</button>" : "");
        const v = document.querySelector("#avrMallar .avr-mall.oppen");
        if (v) {
            kopplaForetagValjare(v, state, (sel, id, sk, txt) => { const m = arb.mallar.find(x => x.id === oppen); m.foretagId = id; m.leverantor = id ? "" : (txt || ""); });
            const f = v.querySelector('[data-m="namn"]'); if (f && !f.value) f.focus();
        }
    };
    const kropp = '<section class="avr-sektion"><div class="avr-sekrubrik"><b>Projektets uppgifter</b><span>Fylls i en gång och står på alla beställningar i projektet.</span></div>' +
        '<div class="avr-tva"><div class="falt"><label for="avrMark">Märkning / projektnummer</label><input class="f" id="avrMark" value="' + esc(arb.markning) + '" placeholder="T.ex. 5261922"></div>' +
        '<div class="falt"><label for="avrAdr">Leveransadress</label><input class="f" id="avrAdr" value="' + esc(arb.adress) + '" placeholder="Gata, ort"></div></div>' +
        '<div class="falt"><label for="avrZon">Lastzoner <span class="hjalp">separera med komma</span></label><input class="f" id="avrZon" value="' + esc(arb.zoner.join(", ")) + '" placeholder="Zon 1, Zon 2, Zon 3"></div>' +
        '<div class="avr-tva"><div class="falt"><label for="avrKNamn">Kontaktperson på plats</label><input class="f" id="avrKNamn" value="' + esc(arb.kontakt.namn) + '" placeholder="Namn"></div>' +
        '<div class="falt"><label for="avrKTel">Telefon</label><input class="f" id="avrKTel" value="' + esc(arb.kontakt.tel) + '" placeholder="070-123 45 67"></div></div>' +
        '<div class="avr-tva"><div class="falt"><label for="avrBNamn">Beställare</label><input class="f" id="avrBNamn" value="' + esc(arb.bestallare.namn) + '" placeholder="Namn"></div>' +
        '<div class="falt"><label for="avrBEpost">E-post</label><input class="f" id="avrBEpost" type="email" value="' + esc(arb.bestallare.epost) + '" placeholder="namn@foretag.se"></div></div>' +
        "</section>" +
        '<section class="avr-sektion"><div class="avr-sekrubrik"><b>Mallar</b><span>En mall per sak ni beställer ofta, t.ex. "Armering NP Nilsson". Leveransdatum och leveranstid väljer man när avropet skapas.</span></div>' +
        '<div id="avrMallar"></div></section>';
    modal("Avrop och beställningar", state.projekt, kropp, [
        { txt: "Avbryt", fn: stangModal },
        kan ? { txt: "Spara", primar: true, fn: () => {
            const $ = (id) => document.getElementById(id).value.trim();
            const orord = (m) => !(m.namn || "").trim() && !m.foretagId && !(m.leverantor || "").trim() && (m.rader || []).every(avrRadTom);
            arb.mallar = arb.mallar.filter(m => !orord(m));
            const utanNamn = arb.mallar.find(m => !(m.namn || "").trim());
            if (utanNamn) { oppen = utanNamn.id; ritaMallar(); const f = document.querySelector('#avrMallar [data-m="namn"]'); if (f) f.focus(); return status("Ge mallen ett namn innan du sparar", true); }
            const ny = {
                markning: $("avrMark"), adress: $("avrAdr"),
                zoner: $("avrZon").split(/[,;]/).map(z => z.trim()).filter(Boolean),
                kontakt: { namn: $("avrKNamn"), tel: $("avrKTel") }, bestallare: { namn: $("avrBNamn"), epost: $("avrBEpost") },
                mallar: arb.mallar.map(m => Object.assign(avrRensa({ rader: m.rader, meddelande: m.meddelande }), {
                    id: m.id, namn: (m.namn || "").trim() || "Namnlös mall", slag: m.slag === "ue" ? "ue" : "material",
                    foretagId: m.foretagId || null, leverantor: m.foretagId ? "" : (m.leverantor || ""),
                    lastzon: (m.lastzon || "").trim(), adress: (m.adress || "").trim() }))
            };
            state.avropInst = ny;
            stangModal(); spara(); rita();
            status("Avropsinställningarna sparades" + (ny.mallar.length ? " · " + ny.mallar.length + (ny.mallar.length === 1 ? " mall" : " mallar") : ""));
        } } : { txt: "Stäng", fn: stangModal }
    ].filter(Boolean));
    const m = document.querySelector("#overlay .modal"); if (m) m.style.maxWidth = "820px";
    if (!kan) document.querySelectorAll("#overlay .kropp input, #overlay .kropp textarea").forEach(x => { x.readOnly = true; });
    const box = document.getElementById("avrMallar");
    // lastzonerna används direkt i mallarna, även innan man sparat
    document.getElementById("avrZon").addEventListener("input", (e) => {
        arb.zoner = e.target.value.split(/[,;]/).map(z => z.trim()).filter(Boolean);
        if (oppen) ritaMallar();
    });
    box.addEventListener("click", (e) => {
        const g = e.target.closest("[data-mgor]"), li = e.target.closest("[data-mall]");
        const mall = li && arb.mallar.find(x => x.id === li.dataset.mall);
        if (e.target.closest("[data-mslag]") && mall) { mall.slag = e.target.closest("[data-mslag]").dataset.mslag; return ritaMallar(); }
        if (!g) return;
        const gor = g.dataset.mgor;
        if (gor === "ny") { const n = tomMall(); arb.mallar.push(n); nya.add(n.id); oppen = n.id; return ritaMallar(); }
        if (gor === "klar") {
            if (mall && !(mall.namn || "").trim()) { const f = li.querySelector('[data-m="namn"]'); f.focus(); return status("Ge mallen ett namn", true); }
            if (mall) nya.delete(mall.id);
            oppen = null; return ritaMallar();
        }
        if (gor === "andra") { oppen = mall.id; return ritaMallar(); }
        if (gor === "kopiera") { const n = Object.assign(avrKopia(mall), { id: uid(), namn: mall.namn + " (kopia)" }); arb.mallar.splice(arb.mallar.indexOf(mall) + 1, 0, n); nya.add(n.id); oppen = n.id; return ritaMallar(); }
        if (gor === "bort") { arb.mallar.splice(arb.mallar.indexOf(mall), 1); if (oppen === mall.id) oppen = null; return ritaMallar(); }
    });
    box.addEventListener("input", (e) => {
        const li = e.target.closest("[data-mall]"), mall = li && arb.mallar.find(x => x.id === li.dataset.mall);
        if (mall && e.target.dataset.m) mall[e.target.dataset.m] = e.target.value;
    });
    box.addEventListener("change", (e) => {
        const li = e.target.closest("[data-mall]"), mall = li && arb.mallar.find(x => x.id === li.dataset.mall);
        if (mall && e.target.dataset.m) mall[e.target.dataset.m] = e.target.value;
    });
    // produktraderna i den öppna mallen
    const proxy = { get rader() { const m = arb.mallar.find(x => x.id === oppen); return m ? m.rader : []; } };
    avrBestKoppla(box, proxy, ritaMallar);
    ritaMallar();
}
