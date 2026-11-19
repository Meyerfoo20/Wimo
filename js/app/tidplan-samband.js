/* ======================================================================
   Wimo · Tidplan: samband mellan aktiviteter

   - Skapa: dra från pricken vid stapelns slut till en annan stapel, eller
     lägg till föregångare i perioddialogen (dubbelklick på stapeln).
   - Visa: tunna pilar mellan staplarna. Ett samband som inte håller blir rött.
   - Inget flyttas automatiskt. Knappen "N samband bryts" visar vad som
     behöver flyttas, och man godkänner först. Allt kan ångras.
   Beräkningarna finns i core/tpberakning.js.
   ====================================================================== */

const tpSbVisa = () => tpVy.samband !== false;
let tpSbBrottLista = [], tpSbBrottIds = new Set();
const tpSbTypNamn = (t) => (TP_SAMBANDSTYPER.find(x => x[0] === t) || [, "Slut → start"])[1];
const tpSbDagar = (n) => Math.abs(n) + (Math.abs(n) === 1 ? " arbetsdag" : " arbetsdagar");

// Räknas en gång per omritning: vilka samband som inte håller.
function tpSbForbered() {
    tpSbBrottLista = tpSambandBrott(tpKal(), tpAktiviteter(state));
    tpSbBrottIds = new Set(tpSbBrottLista.map(b => b.efter.id));
}

// Förklaring i klartext: "Tak börjar tidigast dagen efter att Stomme är klar"
function tpSbForklaring(fore, efter, typ, glapp) {
    const f = fore.namn || "föregångaren", e = efter.namn || "aktiviteten", g = Math.round(glapp || 0);
    const om = (bas, ord) => g === 0 ? bas : g > 0 ? bas + ", plus " + tpSbDagar(g) + " " + ord : bas + ", men får överlappa " + tpSbDagar(g);
    if (typ === "SS") return om(e + " börjar tidigast samtidigt som " + f, "efter");
    if (typ === "FF") return om(e + " blir klar tidigast samtidigt som " + f, "efter");
    if (typ === "SF") return om(e + " blir klar tidigast när " + f + " börjar", "efter");
    return om(e + " börjar tidigast dagen efter att " + f + " är klar", "emellan");
}

/* ---------- pilarna ---------- */

// Pilens väg: ut åt sidan från föregångaren, in mot efterföljaren från rätt håll. Börjar efterföljaren
// strax efter föregångarens slut går pilen ner på dess ovansida, annars en omväg mellan raderna.
// steg = hur långt pilen går ut åt sidan (px på skärmen, mm i utskrift).
function tpSbVag(x1, y1, x2, y2, franSlut, tillStart, eSlut, rh, steg) {
    const ut1 = x1 + (franSlut ? steg : -steg), in2 = tillStart ? x2 - steg * 1.1 : x2 + steg * 1.1;
    let mx = null;
    if (franSlut && tillStart) mx = ut1 <= in2 ? ut1 : null;          // FS
    else if (!franSlut && tillStart) mx = Math.min(ut1, in2);          // SS
    else if (franSlut && !tillStart) mx = Math.max(ut1, in2);          // FF
    else mx = in2 <= ut1 ? ut1 : null;                                 // SF
    const f = (v) => Math.round(v * 100) / 100;
    if (mx !== null) return "M" + f(x1) + " " + f(y1) + "H" + f(mx) + "V" + f(y2) + "H" + f(x2);
    const xm = Math.max(ut1, x2 + steg * 1.25), kant = y2 > y1 ? y2 - rh / 2 + rh * .11 : y2 + rh / 2 - rh * .11;
    if (tillStart && xm <= eSlut - steg * .75) return "M" + f(x1) + " " + f(y1) + "H" + f(xm) + "V" + f(kant);
    const ym = y2 > y1 ? y1 + rh / 2 : y1 - rh / 2;
    return "M" + f(x1) + " " + f(y1) + "H" + f(ut1) + "V" + f(ym) + "H" + f(in2) + "V" + f(y2) + "H" + f(x2);
}

function tpSbPilar(ax, rader, rh, hh) {
    if (!tpSbVisa()) return "";
    const kal = tpKal(), index = new Map(rader.map((r, i) => [r.a.id, i]));
    const x = (iso, slutet) => (tpKol(ax, iso) + (slutet ? 1 : 0)) * TP_DW;
    const ut = [];
    rader.forEach((r, i) => tpSamband(r.a).forEach(s => {
        const fi = index.get(s.fran);
        if (fi === undefined) return;
        const fore = rader[fi].a, f = tpEgetSpann(kal, fore), e = tpEgetSpann(kal, r.a);
        if (!f || !e) return;
        const franSlut = s.typ === "FS" || s.typ === "FF", tillStart = s.typ === "FS" || s.typ === "SS";
        const x1 = x(franSlut ? f.till : f.fran, franSlut), y1 = hh + fi * rh + rh / 2;
        const x2 = x(tillStart ? e.fran : e.till, !tillStart), y2 = hh + i * rh + rh / 2;
        const d = tpSbVag(x1, y1, x2, y2, franSlut, tillStart, x(e.till, true), rh, 8);
        const n = tpSambandBehov(kal, fore, r.a, s), nyckel = r.a.id + "|" + s.id;
        const titel = (fore.namn || "") + " → " + (r.a.namn || "") + " · " + tpSbTypNamn(s.typ) + (s.glapp ? " " + (s.glapp > 0 ? "+" : "−") + Math.abs(s.glapp) + " d" : "") +
            (n ? "\n" + (r.a.namn || "Aktiviteten") + " ligger " + tpSbDagar(n) + " för tidigt" : "") + (tpKanAndra() ? "\nKlicka för att ändra" : "");
        ut.push('<g class="tp-sb' + (n ? " brott" : "") + '" data-tpsb="' + esc(nyckel) + '"><path class="hit" d="' + d + '"><title>' + esc(titel) + '</title></path><path class="linje" d="' + d + '" marker-end="url(#tpSbPil' + (n ? "R" : "") + ')"/></g>');
    }));
    if (!ut.length) return "";
    return '<svg class="tp-sbpilar" width="' + ax.dagar.length * TP_DW + '" height="' + (hh + rader.length * rh) + '" aria-hidden="true">' +
        '<defs><marker id="tpSbPil" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 8 4 0 8z" class="spets"/></marker>' +
        '<marker id="tpSbPilR" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 8 4 0 8z" class="spets brott"/></marker></defs>' +
        ut.join("") + "</svg>";
}

// Knappen i verktygsraden när något samband inte håller.
function tpSbKnapp() {
    const n = tpSbBrottLista.length;
    if (!n || !tpSbVisa()) return "";
    return '<button type="button" class="tp-sbvarning" data-tpgor="samband" title="Visa vad som behöver flyttas för att sambanden ska hålla">' +
        '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M8 2.5 14.5 13.5h-13z"/><path d="M8 6.5v3.2M8 11.6v.1"/></svg>' +
        n + (n === 1 ? " samband bryts" : " samband bryts") + "</button>";
}

/* ---------- skapa, ändra och ta bort ---------- */

function tpSbKanKopplas(a) {
    if (!a) return "Aktiviteten finns inte";
    if (tpBarn().has(a.id)) return (a.namn || "Gruppen") + " är en grupp. Koppla till en av aktiviteterna i den.";
    if (!(a.perioder || []).length) return (a.namn || "Aktiviteten") + " har ingen period än.";
    return null;
}

function tpSbSkapa(franId, tillId, typ, glapp) {
    const fran = tpHitta(franId), till = tpHitta(tillId);
    const fel = tpSbKanKopplas(fran) || tpSbKanKopplas(till);
    if (fel) return status(fel, true), false;
    if (franId === tillId) return status("En aktivitet kan inte hänga på sig själv", true), false;
    if (tpSamband(till).some(s => s.fran === franId)) return status((till.namn || "Aktiviteten") + " hänger redan på " + (fran.namn || "den"), true), false;
    if (tpSambandSlinga(tpAktiviteter(state), franId, tillId)) return status("Det skulle bli en slinga: " + (fran.namn || "") + " hänger redan på " + (till.namn || ""), true), false;
    const s = { id: uid(), fran: franId, typ: typ || "FS", glapp: glapp || 0 };
    if (!tpKor(opTpAndraAktivitet(till, { samband: tpSamband(till).concat([s]) }), "Samband " + (fran.namn || "") + " → " + (till.namn || ""))) return false;
    const n = tpSambandBehov(tpKal(), fran, till, s);
    status(n ? "Samband skapat. " + (till.namn || "Aktiviteten") + " ligger " + tpSbDagar(n) + " för tidigt – klicka på den röda pilen för att åtgärda."
        : "Samband skapat: " + (fran.namn || "") + " → " + (till.namn || "") + ". Klicka på pilen för att ändra typ eller glapp.");
    return true;
}

function tpSbAndra(tillId, sid, falt) {
    const a = tpHitta(tillId);
    if (!a) return;
    const ny = tpSamband(a).map(s => s.id === sid ? Object.assign({}, s, falt) : s);
    tpKor(opTpAndraAktivitet(a, { samband: ny }), "Ändrade samband till " + (a.namn || "aktivitet"));
}
function tpSbTaBort(tillId, sid) {
    const a = tpHitta(tillId);
    if (!a) return;
    const s = tpSamband(a).find(x => x.id === sid), fore = s && tpHitta(s.fran);
    if (tpKor(opTpAndraAktivitet(a, { samband: tpSamband(a).filter(x => x.id !== sid) }), "Tog bort samband"))
        status("Sambandet " + ((fore && fore.namn) || "") + " → " + (a.namn || "") + " togs bort · Ctrl+Z ångrar");
}

// Liten ruta vid pilen: typ, glapp och åtgärd.
function tpSbPopover(nyckel, x, y) {
    document.getElementById("tpSbPop")?.remove();
    const [tillId, sid] = nyckel.split("|"), a = tpHitta(tillId), s = a && tpSamband(a).find(z => z.id === sid), fore = s && tpHitta(s.fran);
    if (!s || !fore) return;
    const kan = tpKanAndra(), v = document.createElement("div");
    v.id = "tpSbPop"; v.className = "p4d-pop tp-sbpop"; v.setAttribute("role", "dialog"); v.setAttribute("aria-label", "Samband");
    const rita = () => {
        const nu = tpSamband(tpHitta(tillId)).find(z => z.id === sid);
        if (!nu) return v.remove();
        const n = tpSambandBehov(tpKal(), tpHitta(nu.fran), tpHitta(tillId), nu);
        v.innerHTML = '<div class="tp-sbpop-rubrik"><b>' + esc(fore.namn || "") + "</b> → <b>" + esc(a.namn || "") + "</b></div>" +
            (kan ? '<div class="tp-sbpop-rad"><select class="f" data-sbtyp aria-label="Typ av samband">' + TP_SAMBANDSTYPER.map(([k, t]) => '<option value="' + k + '"' + (k === nu.typ ? " selected" : "") + ">" + t + "</option>").join("") + "</select>" +
                '<label class="tp-sbglapp"><input class="f" type="number" step="1" data-sbglapp value="' + (nu.glapp || 0) + '" aria-label="Glapp i arbetsdagar"> arbetsdagar</label></div>' : "") +
            '<p class="tp-sbpop-txt">' + esc(tpSbForklaring(fore, a, nu.typ, nu.glapp)) + ".</p>" +
            (n ? '<div class="tp-sbpop-brott">' + esc((a.namn || "Aktiviteten") + " ligger " + tpSbDagar(n) + " för tidigt.") + (kan ? '<button type="button" class="mknapp primar" data-sb="atgarda">Visa vad som flyttas…</button>' : "") + "</div>" : "") +
            (kan ? '<div class="tp-sbpop-knappar"><button type="button" class="p4d-lank fara" data-sb="bort">Ta bort samband</button><button type="button" class="mknapp" data-sb="klar">Klar</button></div>' : "");
    };
    document.body.appendChild(v);
    rita();
    v.style.left = Math.max(8, Math.min(x + 10, innerWidth - v.offsetWidth - 8)) + "px";
    v.style.top = Math.max(8, Math.min(y + 10, innerHeight - v.offsetHeight - 8)) + "px";
    const stang = () => { v.remove(); document.removeEventListener("pointerdown", bort, true); document.removeEventListener("keydown", tangent, true); };
    v.addEventListener("change", (e) => {
        if (e.target.matches("[data-sbtyp]")) tpSbAndra(tillId, sid, { typ: e.target.value });
        if (e.target.matches("[data-sbglapp]")) tpSbAndra(tillId, sid, { glapp: Math.round(+e.target.value || 0) });
        rita();
    });
    v.addEventListener("click", (e) => {
        const b = e.target.closest("[data-sb]");
        if (!b) return;
        if (b.dataset.sb === "bort") { stang(); tpSbTaBort(tillId, sid); }
        if (b.dataset.sb === "klar") stang();
        if (b.dataset.sb === "atgarda") { stang(); tpSbDialog([tillId]); }
    });
    const tangent = (e) => { if (e.key === "Escape") { stang(); e.stopPropagation(); } };
    const bort = (e) => { if (!v.contains(e.target)) stang(); };
    setTimeout(() => { document.addEventListener("pointerdown", bort, true); document.addEventListener("keydown", tangent, true); }, 0);
    const f = v.querySelector("select, button"); if (f) f.focus();
}

// Förhandsvisning: vad som behöver flyttas för att sambanden ska hålla. Inget sker förrän man godkänner.
function tpSbDialog(bara) {
    tpSbForbered();
    const kal = tpKal(), brott = tpSbBrottLista.filter(b => !bara || bara.indexOf(b.efter.id) >= 0);
    if (!brott.length) {
        const antal = tpAktiviteter(state).reduce((n, a) => n + tpSamband(a).length, 0);
        return modal("Samband", "", '<p class="fraga">' + (antal ? "Alla " + antal + (antal === 1 ? " samband håller." : " samband håller.") : "Inga samband än.") + "</p>" +
            '<p class="hjalp">Skapa ett samband genom att dra från pricken vid en stapels slut till en annan stapel, eller lägg till föregångare när du dubbelklickar på en stapel.</p>', [{ txt: "Stäng", primar: true, fn: stangModal }]);
    }
    const forslag = tpSambandForslag(kal, tpAktiviteter(state), bara || brott.map(b => b.efter.id));
    const rad = (b) => "<li><b>" + esc(b.efter.namn || "Aktivitet") + "</b> ligger " + tpSbDagar(b.dagar) + " för tidigt <span class=\"hjalp\">(" + esc(b.fore.namn || "") + " · " + esc(tpSbTypNamn(b.s.typ)) + ")</span></li>";
    const flytt = (f) => {
        const fore = tpEgetSpann(kal, f.a), efter = tpEgetSpann(kal, Object.assign({}, f.a, { perioder: f.a.perioder.map(q => Object.assign({}, q, { start: (f.perioder.find(p => p.id === q.id) || q).start })) }));
        return "<tr><td>" + esc(f.a.namn || "Aktivitet") + "</td><td>" + kortDatum(fore.fran) + "–" + kortDatum(fore.till) + " → <b>" + kortDatum(efter.fran) + "–" + kortDatum(efter.till) + "</b></td><td class=\"tp-tal\">+" + tpSbDagar(f.dagar) + "</td></tr>";
    };
    modal("Samband som inte håller", "", '<ul class="tp-sblista">' + brott.map(rad).join("") + "</ul>" +
        (forslag.length ? '<p class="fraga" style="margin-top:14px">Förslag: flytta ' + forslag.length + (forslag.length === 1 ? " aktivitet" : " aktiviteter") + " framåt</p>" +
            '<table class="lista tp-sbflytt"><tbody>' + forslag.map(flytt).join("") + "</tbody></table>" +
            '<p class="hjalp">Perioderna behåller sitt antal arbetsdagar. Inget annat ändras, och allt kan ångras med Ctrl+Z.</p>' : ""), [
        { txt: "Avbryt", fn: stangModal },
        forslag.length ? { txt: "Flytta " + forslag.length + (forslag.length === 1 ? " aktivitet" : " aktiviteter"), primar: true, fn: () => {
            stangModal();
            tpKorSerie("Flyttade " + forslag.length + " efter samband", (kor) => forslag.forEach(f => {
                const a = tpHitta(f.a.id);
                if (a) f.perioder.forEach(q => kor(opTpAndraPeriod(a, q.id, { start: q.start })));
            }));
            status(forslag.length + (forslag.length === 1 ? " aktivitet flyttades" : " aktiviteter flyttades") + " · Ctrl+Z ångrar");
        } } : null
    ].filter(Boolean));
}

/* ---------- dra från pricken för att koppla ---------- */

(function () {
    const yta = document.getElementById("tidplan");
    if (!yta) return;
    let k = null;
    const avbryt = () => {
        if (!k) return;
        k.linje.remove();
        document.querySelectorAll("#tidplan .tp-stapel.sbmal").forEach(x => x.classList.remove("sbmal"));
        document.body.classList.remove("tp-drar");
        window.removeEventListener("pointermove", flytta);
        window.removeEventListener("pointerup", slapp);
        window.removeEventListener("keydown", tangent, true);
        k = null;
    };
    const malUnder = (e) => {
        const el = document.elementFromPoint(e.clientX, e.clientY), st = el && el.closest("#tidplan .tp-stapel");
        if (!st || st.dataset.tpper.split("|")[0] === k.fran) return null;
        return st;
    };
    const flytta = (e) => {
        const r = k.inre.getBoundingClientRect();
        k.linjeEl.setAttribute("x2", e.clientX - r.left);
        k.linjeEl.setAttribute("y2", e.clientY - r.top);
        const st = malUnder(e);
        document.querySelectorAll("#tidplan .tp-stapel.sbmal").forEach(x => { if (x !== st) x.classList.remove("sbmal"); });
        if (st) st.classList.add("sbmal");
    };
    const slapp = (e) => {
        const st = malUnder(e), fran = k.fran;
        avbryt();
        if (st) tpSbSkapa(fran, st.dataset.tpper.split("|")[0], "FS", 0);
    };
    const tangent = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); avbryt(); } };
    yta.addEventListener("pointerdown", (e) => {
        const p = e.target.closest("[data-tpkoppla]");
        if (!p || e.button !== 0 || !tpKanAndra()) return;
        e.preventDefault(); e.stopPropagation();
        const st = p.closest(".tp-stapel"), inre = st.closest(".tp-kalinre"), r = inre.getBoundingClientRect(), b = p.getBoundingClientRect();
        const fran = st.dataset.tpper.split("|")[0], fel = tpSbKanKopplas(tpHitta(fran));
        if (fel) return status(fel, true);
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "tp-sbdrag");
        svg.setAttribute("width", inre.scrollWidth); svg.setAttribute("height", inre.scrollHeight);
        const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
        const x1 = b.left + b.width / 2 - r.left, y1 = b.top + b.height / 2 - r.top;
        l.setAttribute("x1", x1); l.setAttribute("y1", y1); l.setAttribute("x2", x1); l.setAttribute("y2", y1);
        svg.appendChild(l); inre.appendChild(svg);
        k = { fran, inre, linje: svg, linjeEl: l };
        document.body.classList.add("tp-drar");
        window.addEventListener("pointermove", flytta);
        window.addEventListener("pointerup", slapp);
        window.addEventListener("keydown", tangent, true);
        status("Släpp på stapeln som ska börja efter " + (tpHitta(fran).namn || "den här") + " · Esc avbryter");
    }, true);
    // klick på en pil öppnar rutan
    yta.addEventListener("click", (e) => {
        const g = e.target.closest("[data-tpsb]");
        if (!g) return;
        e.stopPropagation();
        tpSbPopover(g.dataset.tpsb, e.clientX, e.clientY);
    });
})();

/* ---------- föregångare i perioddialogen ---------- */

// Arbetskopia av aktivitetens samband medan dialogen är öppen.
function tpSbDialogDel(a, kan) {
    let lista = tpSamband(a).filter(s => tpHitta(s.fran)).map(s => Object.assign({}, s));
    const mojliga = () => tpAktiviteter(state).filter(x => x.id !== a.id && !tpBarn().has(x.id) && (x.perioder || []).length);
    const html = () => {
        const val = mojliga();
        return '<div class="tp-pd-sb">' + (lista.length ? lista.map((s, i) => '<div class="tp-pd-sbrad" data-sbi="' + i + '">' +
            '<select class="f" data-sbfran aria-label="Föregångare">' + val.map(x => '<option value="' + esc(x.id) + '"' + (x.id === s.fran ? " selected" : "") + ">" + esc(x.namn || "Aktivitet") + "</option>").join("") + "</select>" +
            '<select class="f" data-sbtyp aria-label="Typ">' + TP_SAMBANDSTYPER.map(([k, t]) => '<option value="' + k + '"' + (k === s.typ ? " selected" : "") + ">" + t + "</option>").join("") + "</select>" +
            '<label class="tp-sbglapp"><input class="f" type="number" step="1" data-sbglapp value="' + (s.glapp || 0) + '" aria-label="Glapp i arbetsdagar"> d</label>' +
            '<button type="button" class="tp-pd-x" data-sbbort aria-label="Ta bort sambandet">×</button>' +
            '<div class="tp-pd-sbtxt">' + esc(tpSbForklaring(tpHitta(s.fran) || {}, a, s.typ, s.glapp)) + "</div></div>").join("")
            : '<p class="hjalp" style="margin:0">Inga föregångare. Lägg till en om ' + esc(a.namn || "aktiviteten") + " måste vänta på något annat.</p>") +
            (kan && val.length ? '<button type="button" class="p4d-lank" data-sbny>+ Lägg till föregångare</button>' : "") + "</div>";
    };
    const koppla = (rot) => {
        const omrita = () => { rot.innerHTML = html(); };
        rot.addEventListener("change", (e) => {
            const r = e.target.closest("[data-sbi]");
            if (!r) return;
            const s = lista[+r.dataset.sbi];
            if (e.target.matches("[data-sbfran]")) {
                const ny = e.target.value;
                if (tpSambandSlinga(tpAktiviteter(state).map(x => x.id === a.id ? Object.assign({}, x, { samband: lista.filter(z => z !== s) }) : x), ny, a.id)) {
                    status("Det skulle bli en slinga: " + (tpHitta(ny).namn || "") + " hänger redan på " + (a.namn || ""), true);
                    return omrita();
                }
                s.fran = ny;
            }
            if (e.target.matches("[data-sbtyp]")) s.typ = e.target.value;
            if (e.target.matches("[data-sbglapp]")) s.glapp = Math.round(+e.target.value || 0);
            omrita();
        });
        rot.addEventListener("click", (e) => {
            if (e.target.closest("[data-sbbort]")) { lista.splice(+e.target.closest("[data-sbi]").dataset.sbi, 1); return omrita(); }
            if (e.target.closest("[data-sbny]")) {
                const upptagna = new Set(lista.map(s => s.fran));
                const forsta = mojliga().find(x => !upptagna.has(x.id) && !tpSambandSlinga(tpAktiviteter(state), x.id, a.id));
                if (!forsta) return status("Det finns ingen aktivitet att koppla till utan att det blir en slinga", true);
                lista.push({ id: uid(), fran: forsta.id, typ: "FS", glapp: 0 });
                omrita();
                const s = rot.querySelectorAll("[data-sbfran]"); s[s.length - 1].focus();
            }
        });
        omrita();
    };
    // nya listan, eller null om inget ändrats; dubbletter tas bort
    const varde = () => {
        const sett = new Set(), ren = lista.filter(s => s.fran && !sett.has(s.fran) && sett.add(s.fran));
        return JSON.stringify(ren) === JSON.stringify(tpSamband(a)) ? null : ren;
    };
    return { koppla, varde };
}
