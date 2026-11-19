/* ======================================================================
   Wimo · Tidplan: uppföljning – baslinje, framdrift och avstämningslinje

   - Framdrift: "Klart %" per aktivitet i tabellen. Staplarna fylls i så långt
     som är klart. En grupps framdrift räknas fram ur underaktiviteterna.
   - Baslinje: en sparad ögonblicksbild av alla perioder. Den visas som ett grått
     streck under staplarna, och kolumnen "Mot baslinjen" visar hur många
     arbetsdagar slutet har flyttats.
   - Avstämningslinje: en linje vid avstämningsdatumet som böjer åt vänster där
     en aktivitet ligger efter och åt höger där den ligger före.
   Beräkningarna finns i core/tpberakning.js.
   ====================================================================== */

const TP_MAX_BASLINJER = 10;
const tpBaslinjer = () => (state && state.tidplan && Array.isArray(state.tidplan.baslinjer)) ? state.tidplan.baslinjer : [];
const tpAktivBas = () => tpVy.bas ? tpBaslinjer().find(b => b.id === tpVy.bas) || null : null;
const tpAvstDatum = () => tpVy.avstDatum || IDAG;
const tpUfTid = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.getDate() + "/" + (d.getMonth() + 1) + " " + d.getFullYear() + " kl. " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
const tpUfDagar = (n) => { const v = Math.round(Math.abs(n) * 10) / 10; return String(v).replace(".", ",") + (v === 1 ? " arbetsdag" : " arbetsdagar"); };

// Aktivitetens arbetsdagar och framdrift; för en grupp alla underaktiviteters dagar.
function tpUfLaget(a, r) {
    const kal = tpKal(), barn = (r && r.barnKarta) || tpBarn();
    const grupp = !!(r && r.grupp);
    const perioder = grupp ? [a].concat(tpAllaUnder(barn, a.id)).reduce((l, x) => l.concat(x.perioder || []), []) : (a.perioder || []);
    const dagar = tpArbetsdagLista(kal, perioder);
    const klart = grupp ? tpGruppKlart(kal, barn, a) : tpKlart(a);
    return { dagar, klart: klart === null ? 0 : klart, harKlart: grupp ? klart !== null : typeof a.klart === "number" };
}

// Avvikelse mot planen vid avstämningsdatumet, i arbetsdagar (positivt = före).
function tpUfLage(l, datum) {
    if (!l.dagar.length) return null;
    const forvantat = l.dagar.filter(d => d < datum).length, faktiskt = l.klart / 100 * l.dagar.length;
    return { dagar: faktiskt - forvantat, forvantatProcent: forvantat / l.dagar.length * 100 };
}

/* ---------- tabellen ---------- */

function tpUfCell(a, k, r) {
    if (k.id === "klart") {
        const l = tpUfLaget(a, r);
        const p = Math.round(l.klart), visa = r.grupp ? (l.harKlart && l.dagar.length ? p + " %" : "") : (typeof a.klart === "number" ? p + " %" : "");
        let kl = "", titel = r.grupp ? "Räknas fram ur underaktiviteterna, vägt med arbetsdagar" : "Hur stor del som är klar. Skriv t.ex. 50";
        if (tpVy.avst && visa) {
            const lage = tpUfLage(l, tpAvstDatum());
            if (lage && tpIAvstamning(l.dagar, l.klart, tpAvstDatum())) {
                if (lage.dagar <= -.5) kl = " efter";
                else if (lage.dagar >= .5) kl = " fore";
                titel = (lage.dagar <= -.5 ? tpUfDagar(lage.dagar) + " efter" : lage.dagar >= .5 ? tpUfDagar(lage.dagar) + " före" : "Enligt plan") +
                    " · borde vara " + Math.round(lage.forvantatProcent) + " % klart " + kortDatum(tpAvstDatum());
            }
        }
        return '<div class="tp-c tp-e tp-tal tp-klartc' + (r.grupp ? " tp-summa-tal" : "") + kl + '" tabindex="-1" data-tpfalt="klart" style="--p:' + (visa ? p : 0) + '%" title="' + esc(titel) + '">' + visa + "</div>";
    }
    // basavvik: slutdatum jämfört med baslinjen
    const bas = tpAktivBas(), kal = tpKal(), barn = r.barnKarta || tpBarn();
    if (!bas) return '<div class="tp-c tp-tal"></div>';
    const nu = r.grupp ? tpSpann(kal, barn, a) : (a.perioder || []).length ? tpSpann(kal, new Map(), a) : null;
    const forr = tpBasSpann(kal, barn, bas, a, r.grupp);
    if (!nu && !forr) return '<div class="tp-c tp-tal"></div>';
    if (!forr) return '<div class="tp-c tp-tal tp-basny" title="Fanns inte när baslinjen ' + esc(bas.namn) + ' sparades">Ny</div>';
    if (!nu) return '<div class="tp-c tp-tal tp-basny" title="Har inga perioder längre">–</div>';
    const n = tpForskjutning(kal, nu.till, forr.till), s = tpForskjutning(kal, nu.fran, forr.fran);
    const titel = "Baslinje " + bas.namn + ": " + dagEtikett(forr.fran) + " – " + dagEtikett(forr.till) + "\nNu: " + dagEtikett(nu.fran) + " – " + dagEtikett(nu.till) +
        "\nSlutet " + (n > 0 ? tpUfDagar(n) + " senare" : n < 0 ? tpUfDagar(n) + " tidigare" : "som i baslinjen") + (s ? ", starten " + (s > 0 ? tpUfDagar(s) + " senare" : tpUfDagar(s) + " tidigare") : "");
    return '<div class="tp-c tp-tal tp-basavv' + (n > 0 ? " senare" : n < 0 ? " tidigare" : " noll") + '" title="' + esc(titel) + '">' + (n > 0 ? "+" + n + " d" : n < 0 ? "−" + Math.abs(n) + " d" : "0") + "</div>";
}

// Klart % i en cell: "50", "50 %", "50%" eller tomt. Returnerar undefined vid fel.
function tpUfTolkaKlart(v) {
    const s = String(v).trim().replace(",", ".").replace(/\s|%$/g, "");
    if (s === "") return null;
    if (!/^\d+(\.\d+)?$/.test(s) || +s > 100) {
        status("Skriv hur många procent som är klart, 0–100", true);
        return undefined;
    }
    return Math.round(+s);
}

/* ---------- staplarna ---------- */

// Hur långt in i perioden framdriften når, i px från stapelns vänsterkant (0 = inget).
function tpUfFyll(a, q, ax, k0, k1) {
    const klart = tpKlart(a);
    if (!klart) return 0;
    const kal = tpKal(), dagar = tpArbetsdagLista(kal, a.perioder), pt = tpFramdriftsPunkt(dagar, klart);
    if (!pt) return 0;
    const qd = kal.dagarI(q.start, q.arbDagar);
    if (pt.dag < qd[0]) return 0;
    if (pt.dag > qd[qd.length - 1]) return (k1 - k0 + 1) * TP_DW;
    return Math.max(0, (tpKol(ax, pt.dag) - k0 + pt.del) * TP_DW);
}

// Baslinjens grå streck under staplarna.
function tpUfBasStaplar(a, ax, r) {
    const bas = tpAktivBas();
    if (!bas) return "";
    const kal = tpKal(), barn = (r && r.barnKarta) || tpBarn();
    const lista = r && r.grupp ? [tpBasSpann(kal, barn, bas, a, true)].filter(Boolean) : tpBasPerioder(bas, a.id).map(q => ({ fran: kal.narmasteArbetsdag(q.start, 1), till: kal.slut(q.start, q.arbDagar) }));
    return lista.map(sp => {
        const k0 = tpKol(ax, sp.fran), k1 = tpKol(ax, sp.till);
        return '<i class="tp-bas' + (r && r.grupp ? " grupp" : "") + '" style="left:' + (k0 * TP_DW) + "px;width:" + ((k1 - k0 + 1) * TP_DW) + 'px" title="' + esc("Baslinje " + bas.namn + ": " + dagEtikett(sp.fran) + " – " + dagEtikett(sp.till)) + '"></i>';
    }).join("");
}

/* ---------- avstämningslinjen ---------- */

function tpUfAvstamning(ax, rader, rh, toppen) {
    if (!tpVy.avst || !rader.length) return "";
    const kal = tpKal(), datum = tpAvstDatum(), dagen = kal.narmasteArbetsdag(datum, 1);
    if (ax.index[dagen] === undefined && (dagen < ax.dagar[0] || dagen > ax.dagar[ax.dagar.length - 1])) return "";
    const sx = tpKol(ax, dagen) * TP_DW, H = rader.length * rh;
    const pkt = [[sx, 0]], prickar = [];
    rader.forEach((r, i) => {
        const l = tpUfLaget(r.a, r), y = i * rh + rh / 2;
        if (!tpIAvstamning(l.dagar, l.klart, dagen)) return;
        const pt = tpFramdriftsPunkt(l.dagar, l.klart), x = (tpKol(ax, pt.dag) + pt.del) * TP_DW;
        const lage = tpUfLage(l, dagen);
        pkt.push([sx, y - rh * .42], [x, y], [sx, y + rh * .42]);
        const txt = (r.a.namn || "Aktivitet") + ": " + Math.round(l.klart) + " % klart, borde vara " + Math.round(lage.forvantatProcent) + " %" +
            (lage.dagar <= -.5 ? " · " + tpUfDagar(lage.dagar) + " efter" : lage.dagar >= .5 ? " · " + tpUfDagar(lage.dagar) + " före" : " · enligt plan");
        prickar.push('<circle cx="' + x.toFixed(1) + '" cy="' + y + '" r="3.5" class="' + (lage.dagar <= -.5 ? "efter" : lage.dagar >= .5 ? "fore" : "") + '"><title>' + esc(txt) + "</title></circle>");
    });
    pkt.push([sx, H]);
    return '<svg class="tp-avst" style="top:' + toppen + "px;height:" + H + 'px" width="' + ax.dagar.length * TP_DW + '" height="' + H + '" aria-hidden="true">' +
        '<polyline points="' + pkt.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ") + '"/>' + prickar.join("") + "</svg>" +
        '<div class="tp-avst-etikett" style="left:' + sx + 'px" title="Avstämningsdatum">Avstämning ' + esc(kortDatum(datum)) + "</div>";
}

/* ---------- menyn: baslinjer och avstämning ---------- */

function tpUfSparaBaslinje(namn) {
    const tp = state.tidplan;
    const lista = tpBaslinjer().slice();
    if (lista.length >= TP_MAX_BASLINJER) { status("Högst " + TP_MAX_BASLINJER + " baslinjer. Ta bort en gammal först.", true); return null; }
    const bas = tpNyBaslinje(tpAktiviteter(state), namn, new Date().toISOString());
    const fore = tpBaslinjer().slice(), efter = lista.concat([bas]);
    tp.baslinjer = efter;
    tpHistLagg({ txt: "Sparade baslinjen " + namn, angra: () => { tp.baslinjer = fore; }, gor: () => { tp.baslinjer = efter; } });
    tpVy.bas = bas.id;
    tpVySpara();
    spara();
    return bas;
}

function tpUfAndraBaslinjer(ny, txt) {
    const tp = state.tidplan, fore = tpBaslinjer().slice();
    tp.baslinjer = ny;
    tpHistLagg({ txt, angra: () => { tp.baslinjer = fore; }, gor: () => { tp.baslinjer = ny; } });
    spara();
}

function tpUfMeny(knapp) {
    const gammal = document.getElementById("tpUfMeny");
    if (gammal) { gammal.remove(); return; }
    const v = document.createElement("div");
    v.id = "tpUfMeny";
    v.className = "p4d-pop tp-ufmeny";
    v.setAttribute("role", "dialog");
    v.setAttribute("aria-label", "Uppföljning");
    document.body.appendChild(v);
    let laget = null;   // { typ: "ny" } eller { typ: "namn", id }
    const rita = () => {
        const kan = tpKanAndra(), lista = tpBaslinjer(), aktiv = tpVy.bas;
        const rad = (b) => {
            if (laget && laget.typ === "namn" && laget.id === b.id)
                return '<div class="tp-uf-bas redigerar"><input class="f" id="tpUfNamn" value="' + esc(b.namn) + '" aria-label="Baslinjens namn"><button type="button" class="mknapp primar" data-tpuf="spara-namn">Spara</button><button type="button" class="p4d-lank" data-tpuf="avbryt">Avbryt</button></div>';
            return '<label class="tp-uf-bas' + (aktiv === b.id ? " vald" : "") + '"><input type="radio" name="tpUfBas" value="' + esc(b.id) + '"' + (aktiv === b.id ? " checked" : "") + ">" +
                '<span class="tp-uf-basnamn"><b>' + esc(b.namn) + "</b><small>Sparad " + esc(tpUfTid(b.sparad)) + "</small></span>" +
                (kan ? '<button type="button" class="p4d-lank" data-tpuf="namn" data-id="' + esc(b.id) + '">Byt namn</button><button type="button" class="p4d-lank fara" data-tpuf="bort" data-id="' + esc(b.id) + '">Ta bort</button>' : "") + "</label>";
        };
        const forslag = "Baslinje " + kortDatum(IDAG);
        v.innerHTML =
            '<div class="tp-uf-sektion"><div class="tp-uf-rubrik">Baslinje</div>' +
            '<p class="tp-uf-hjalp">En sparad bild av planen. Jämför med den för att se vad som har flyttats sedan dess.</p>' +
            '<label class="tp-uf-bas' + (!aktiv ? " vald" : "") + '"><input type="radio" name="tpUfBas" value=""' + (!aktiv ? " checked" : "") + '><span class="tp-uf-basnamn"><b>Visa ingen</b></span></label>' +
            lista.slice().reverse().map(rad).join("") +
            (kan ? (laget && laget.typ === "ny"
                ? '<div class="tp-uf-bas redigerar"><input class="f" id="tpUfNamn" value="' + esc(forslag) + '" aria-label="Namn på baslinjen"><button type="button" class="mknapp primar" data-tpuf="spara-ny">Spara</button><button type="button" class="p4d-lank" data-tpuf="avbryt">Avbryt</button></div>'
                : '<button type="button" class="mknapp tp-uf-ny" data-tpuf="ny"' + (lista.length >= TP_MAX_BASLINJER ? " disabled title=\"Högst " + TP_MAX_BASLINJER + " baslinjer\"" : "") + ">+ Spara planen som baslinje</button>") : "") +
            "</div>" +
            '<div class="tp-uf-sektion"><div class="tp-uf-rubrik">Avstämning</div>' +
            '<label class="tp-kryss"><input type="checkbox" id="tpUfAvst"' + (tpVy.avst ? " checked" : "") + "> Visa avstämningslinje</label>" +
            '<label class="tp-uf-datum">Datum <input class="f" type="date" id="tpUfAvstDatum" value="' + esc(tpAvstDatum()) + '">' +
            (tpVy.avstDatum && tpVy.avstDatum !== IDAG ? '<button type="button" class="p4d-lank" data-tpuf="idag">Idag</button>' : "") + "</label>" +
            '<p class="tp-uf-hjalp">Fyll i <b>Klart %</b> i tabellen. Linjen böjer åt vänster där en aktivitet ligger efter och åt höger där den ligger före.</p></div>' +
            '<div class="tp-uf-sektion"><div class="tp-uf-rubrik">Samband</div>' +
            '<label class="tp-kryss"><input type="checkbox" id="tpUfSb"' + (tpVy.samband !== false ? " checked" : "") + "> Visa samband som pilar</label>" +
            '<p class="tp-uf-hjalp">Dra från pricken vid en stapels slut till en annan stapel. Inget flyttas automatiskt.</p>' +
            '<button type="button" class="mknapp tp-uf-ny" data-tpuf="sbkoll">Kontrollera samband</button></div>';
        const n = v.querySelector("#tpUfNamn");
        if (n) { n.focus(); n.select(); }
        placera();
    };
    const placera = () => {
        const r = knapp.getBoundingClientRect();
        v.style.top = (r.bottom + 6) + "px";
        v.style.left = Math.max(8, Math.min(r.left, innerWidth - v.offsetWidth - 8)) + "px";
    };
    const stang = () => { v.remove(); document.removeEventListener("pointerdown", bort, true); document.removeEventListener("keydown", tangent, true); };
    v.addEventListener("change", (e) => {
        if (e.target.name === "tpUfBas") {
            tpVy.bas = e.target.value || null;
            tpVySpara();
            if (tpVy.bas && tpVy.dolda.has("basavvik")) tpVy.dolda.delete("basavvik");
            ritaTidplan(); rita();
            if (tpVy.bas) status("Grå streck under staplarna visar baslinjen. Kolumnen Mot bas visar hur slutet har flyttats.");
        }
        if (e.target.id === "tpUfAvst") {
            tpVy.avst = e.target.checked;
            // utan Klart-kolumnen går linjen inte att använda: visa den
            if (tpVy.avst && tpVy.dolda.has("klart")) { tpVy.dolda.delete("klart"); status("Kolumnen Klart % visas igen"); }
            tpVySpara(); ritaTidplan(); rita();
        }
        if (e.target.id === "tpUfSb") { tpVy.samband = e.target.checked; tpVySpara(); ritaTidplan(); rita(); }
        if (e.target.id === "tpUfAvstDatum" && /^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
            tpVy.avstDatum = e.target.value === IDAG ? null : e.target.value;
            tpVy.avst = true;
            tpVySpara(); ritaTidplan(); rita();
        }
    });
    v.addEventListener("click", (e) => {
        const b = e.target.closest("[data-tpuf]");
        if (!b) return;
        e.preventDefault();
        const typ = b.dataset.tpuf;
        if (typ === "ny") { laget = { typ: "ny" }; return rita(); }
        if (typ === "sbkoll") { stang(); return typeof tpSbDialog === "function" && tpSbDialog(); }
        if (typ === "avbryt") { laget = null; return rita(); }
        if (typ === "idag") { tpVy.avstDatum = null; tpVySpara(); ritaTidplan(); return rita(); }
        if (typ === "namn") { laget = { typ: "namn", id: b.dataset.id }; return rita(); }
        if (typ === "spara-ny") {
            const namn = (v.querySelector("#tpUfNamn").value || "").trim() || "Baslinje " + kortDatum(IDAG);
            if (tpUfSparaBaslinje(namn)) { laget = null; ritaTidplan(); rita(); status("Baslinjen " + namn + " är sparad. Grå streck under staplarna visar den."); }
            return;
        }
        if (typ === "spara-namn") {
            const namn = (v.querySelector("#tpUfNamn").value || "").trim();
            if (!namn) return v.querySelector("#tpUfNamn").focus();
            tpUfAndraBaslinjer(tpBaslinjer().map(x => x.id === laget.id ? Object.assign({}, x, { namn }) : x), "Bytte namn på baslinjen");
            laget = null; ritaTidplan(); return rita();
        }
        if (typ === "bort") {
            const x = tpBaslinjer().find(y => y.id === b.dataset.id);
            if (!x) return;
            tpUfAndraBaslinjer(tpBaslinjer().filter(y => y.id !== x.id), "Tog bort baslinjen " + x.namn);
            if (tpVy.bas === x.id) { tpVy.bas = null; tpVySpara(); }
            ritaTidplan(); rita();
            status("Baslinjen " + x.namn + " togs bort · Ctrl+Z ångrar");
        }
    });
    v.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.target.id === "tpUfNamn") { e.preventDefault(); const s = v.querySelector('[data-tpuf^="spara-"]'); if (s) s.click(); }
    });
    const tangent = (e) => { if (e.key === "Escape") { if (laget) { laget = null; rita(); } else { stang(); knapp.focus(); } e.stopPropagation(); } };
    const bort = (e) => { if (!v.contains(e.target) && !knapp.contains(e.target)) stang(); };
    setTimeout(() => { document.addEventListener("pointerdown", bort, true); document.addEventListener("keydown", tangent, true); }, 0);
    rita();
    const f = v.querySelector("input"); if (f && !laget) f.focus();
}
