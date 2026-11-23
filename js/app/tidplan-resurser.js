/* ======================================================================
   Wimo · Tidplan: bemanning per period och resurspanelen

   Resurstyperna är yrkesgrupperna i projektets resursbank, så samma lista
   gäller på tavlan och i tidplanen. Beräkningarna finns i core/tpberakning.js.

   - Dubbelklick (eller Enter) på en stapel öppnar perioden: datum, färg och bemanning.
     Fast bemanning är standard. Varierande bemanning = flera delar i samma period.
   - Resurspanelen under tidplanen visar behovet per dag och resurstyp på samma
     tidsaxel. Den uppdateras medan man drar. Över registrerad kapacitet (antal
     aktiva personer i yrkesgruppen) markeras dagen – vanliga variationer gör det inte.
   ====================================================================== */

const tpResTyper = () => ((state.resurser && state.resurser.kategorier) || []).filter(k => k && k.id);
// Kapacitet = aktiva personer i yrkesgruppen i resursbanken (0 = okänd, då varnas inte).
function tpKapacitet(typId) {
    return ((state.resurser && state.resurser.personer) || []).filter(x => x.kategoriId === typId && x.aktiv !== false).length;
}
const tpTecken = (n) => n > 0 ? "+" : n < 0 ? "−" : "";
const tpTal = (n) => tpTimmarText(Math.round(n * 10) / 10);

/* ---------- resurspanelen ---------- */

let tpRpAx = null, tpRpBredd = 0;

function tpRpRader(ax, behov) {
    const typer = tpResTyper(), kal = tpKal(), h = kal.inst.arbTimmarPerDag;
    // typer med behov först i resursbankens ordning, sedan okända (borttagna) typer
    const ids = typer.map(t => t.id).filter(id => behov.has(id)).concat([...behov.keys()].filter(id => !typer.some(t => t.id === id)));
    const namn = (id) => { const t = typer.find(x => x.id === id); return t ? t.namn : "Borttagen yrkesgrupp"; };
    const vanster = [], hoger = [];
    const cell = (i, n, cls, titel) => '<span class="tp-rp-c ' + cls + '" style="left:' + (i * TP_DW) + 'px" title="' + esc(titel) + '">' + (TP_DW >= 18 ? n : "") + "</span>";
    const tot = new Map();
    let totPd = 0;
    ids.forEach((id, nr) => {
        const r = behov.get(id), kap = tpKapacitet(id);
        totPd += r.persondagar;
        const celler = [];
        ax.dagar.forEach((d, i) => {
            const n = r.perDag.get(d);
            if (!n) return;
            tot.set(d, (tot.get(d) || 0) + n);
            const over = kap > 0 && n > kap;
            const niva = Math.min(4, Math.ceil(n / Math.max(1, r.max) * 4));
            celler.push(cell(i, tpTal(n), "n" + niva + (over ? " over" : ""), dagEtikett(d) + " · " + namn(id) + ": " + tpTal(n) + " pers" + (kap ? " av " + kap + " i resursbanken" : "") + (over ? " – fler än det finns" : "")));
        });
        const overDagar = kap ? [...r.perDag.values()].filter(n => n > kap).length : 0;
        vanster.push('<div class="tp-rp-rad"><span class="tp-rp-nr">' + (nr + 1) + '</span><span class="tp-rp-namn" title="' + esc(namn(id)) + '">' + esc(namn(id)) + "</span>" +
            '<span class="tp-rp-tal" title="' + esc(tpTal(r.persondagar) + " persondagar = " + tpTal(r.persondagar * h) + " timmar") + '">' + tpTal(r.persondagar) + "</span>" +
            '<span class="tp-rp-tal' + (overDagar ? " over" : "") + '" title="' + esc("Som mest " + tpTal(r.max) + " samtidigt" + (r.maxDag ? " (" + dagEtikett(r.maxDag) + ")" : "") + (kap ? ". " + kap + " i resursbanken" + (overDagar ? ", " + overDagar + " dagar över" : "") : "")) + '">' + tpTal(r.max) + (kap ? "<small>/" + kap + "</small>" : "") + "</span></div>");
        hoger.push('<div class="tp-rp-rad">' + celler.join("") + "</div>");
    });
    if (ids.length > 1) {
        const mx = Math.max(0, ...tot.values());
        vanster.push('<div class="tp-rp-rad tp-rp-tot"><span class="tp-rp-nr"></span><span class="tp-rp-namn">Totalt</span><span class="tp-rp-tal">' + tpTal(totPd) + '</span><span class="tp-rp-tal">' + tpTal(mx) + "</span></div>");
        hoger.push('<div class="tp-rp-rad tp-rp-tot">' + ax.dagar.map((d, i) => tot.get(d) ? cell(i, tpTal(tot.get(d)), "tot", dagEtikett(d) + " · totalt " + tpTal(tot.get(d)) + " pers") : "").join("") + "</div>");
    }
    if (!ids.length) {
        const txt = tpResTyper().length ? "Ingen bemanning än. Dubbelklicka på en stapel och lägg in resurser, så syns behovet här dag för dag."
            : "Ingen bemanning än. Dubbelklicka på en stapel för att lägga in resurser – yrkesgrupperna kommer från resursbanken.";
        vanster.push('<div class="tp-rp-tom">' + esc(txt) + "</div>");
        hoger.push('<div class="tp-rp-tom"></div>');
    }
    const over = ids.some(id => { const kap = tpKapacitet(id); return kap > 0 && behov.get(id).max > kap; });
    return { vanster: vanster.join(""), hoger: hoger.join(""), antal: ids.length, over };
}

function tpResursPanel(ax, bredd, tabBredd) {
    tpRpAx = ax; tpRpBredd = bredd;
    const lage = tpVy.resurser, behov = tpResursbehov(tpKal(), tpAktiviteter(state));
    const r = tpRpRader(ax, behov);
    const ihop = lage === "ihop";
    return '<section class="tp-respanel lage-' + lage + '" style="--tp-tab:' + tabBredd + '" aria-label="Resursbehov">' +
        '<div class="tp-rp-yta">' +
        '<div class="tp-rp-vanster">' +
        '<div class="tp-rp-huvud"><button type="button" class="tp-rp-fall" data-tprp="fall" aria-expanded="' + !ihop + '" title="' + (ihop ? "Visa" : "Fäll ihop") + ' resurspanelen">' + TP_PIL_H + "</button>" +
        "<b>Resurser</b>" + (r.antal ? ' <span class="tp-rp-antal">' + r.antal + "</span>" : "") +
        (ihop ? "" : '<button type="button" class="tp-rp-stor" data-tprp="stor" title="' + (lage === "stor" ? "Mindre" : "Större") + ' resurspanel">' + (lage === "stor" ? "Mindre" : "Större") + "</button>") +
        (r.over ? '<span class="tp-rp-forklaring"><i aria-hidden="true"></i>Fler än i resursbanken</span>' : "") +
        '<span class="tp-rp-kolrubrik forsta" title="Ackumulerade persondagar">Pd</span><span class="tp-rp-kolrubrik" title="Största samtidiga behov (av antal i resursbanken)">Max</span>' +
        "</div>" +
        (ihop ? "" : '<div class="tp-rp-rader" data-tprpv>' + r.vanster + "</div>") + "</div>" +
        '<div class="tp-rp-kal" data-tprpkal><div class="tp-rp-inre" style="width:' + bredd + "px;--dw:" + TP_DW + "px;--dpv:" + ax.dpv + '">' +
        '<div class="tp-rp-huvud"></div>' + (ihop ? "" : '<div class="tp-rp-rader" data-tprph>' + r.hoger + "</div>") + "</div></div>" +
        "</div></section>";
}

// Kopplar resurspanelen: samma horisontella scroll som kalendern, fäll ihop och förstora.
function tpResursKoppla() {
    const yta = document.getElementById("tidplan");
    const kal = yta && yta.querySelector(".tp-kalender"), rp = yta && yta.querySelector("[data-tprpkal]");
    if (!kal || !rp) return;
    rp.scrollLeft = kal.scrollLeft;
    let las = false;
    const synk = (fran, till) => () => { if (las) return; las = true; till.scrollLeft = fran.scrollLeft; requestAnimationFrame(() => { las = false; }); };
    kal.addEventListener("scroll", synk(kal, rp), { passive: true });
    rp.addEventListener("scroll", synk(rp, kal), { passive: true });
    yta.querySelectorAll("[data-tprp]").forEach(b => b.addEventListener("click", () => {
        if (b.dataset.tprp === "fall") tpVy.resurser = tpVy.resurser === "ihop" ? "normal" : "ihop";
        else tpVy.resurser = tpVy.resurser === "stor" ? "normal" : "stor";
        tpVySpara();
        ritaTidplan();
    }));
}

// Medan man drar: räkna om med de dragna periodernas nya datum (bara panelens rader ritas om).
let tpRpVantar = null;
function tpResursLive(andrade) {
    if (!tpRpAx || tpVy.resurser === "ihop") return;
    tpRpVantar = andrade;
    if (tpResursLive.ram) return;
    tpResursLive.ram = requestAnimationFrame(() => {
        tpResursLive.ram = null;
        const andr = tpRpVantar || [], ids = new Set(andr.map(x => x.q.id));
        const behov = tpResursbehov(tpKal(), tpAktiviteter(state), (a, q) => ids.has(q.id), andr.map(x => x.q));
        const r = tpRpRader(tpRpAx, behov);
        const v = document.querySelector("#tidplan [data-tprpv]"), h = document.querySelector("#tidplan [data-tprph]");
        if (v) v.innerHTML = r.vanster;
        if (h) h.innerHTML = r.hoger;
    });
}

/* ---------- perioden: datum, färg och bemanning ---------- */

function tpPeriodDialog(a, q) {
    const kan = tpKanAndra(), kal = tpKal(), h = kal.inst.arbTimmarPerDag;
    let typer = tpResTyper();
    // arbetskopia av bemanningen: [{ resursTyp, varierande, segment: [{ franDag, antal }] }]
    let bem = (q.bemanning || []).map(b => ({ resursTyp: b.resursTyp, varierande: tpVarierande(b), segment: (b.segment || [{ franDag: 1, antal: 0 }]).map(s => Object.assign({}, s)) }));
    let farg = q.farg || "";
    const barn = tpBarn(), kalk = typeof a.kalkTimmar === "number" ? a.kalkTimmar : null;
    const ar = (a.foralder || barn.has(a.id));
    const fargKnappar = () => '<button type="button" class="tp-pd-farg' + (!farg ? " vald" : "") + '" data-pdfarg="" title="Samma som aktiviteten" aria-label="Samma som aktiviteten"><span class="tpc-' + tpFarg(a) + '"></span>Som aktiviteten</button>' +
        TP_FARGER.map(([k, n]) => '<button type="button" class="tp-pd-farg rund tpc-' + k + (farg === k ? " vald" : "") + '" data-pdfarg="' + k + '" title="' + n + '" aria-label="' + n + '"></button>').join("");
    const typVal = (v) => '<select class="f" data-pdtyp aria-label="Resurstyp">' + (v ? "" : '<option value="">Välj yrkesgrupp…</option>') +
        typer.map(t => '<option value="' + esc(t.id) + '"' + (t.id === v ? " selected" : "") + ">" + esc(t.namn) + "</option>").join("") +
        (v && !typer.some(t => t.id === v) ? '<option value="' + esc(v) + '" selected>Borttagen yrkesgrupp</option>' : "") + "</select>";
    const radHtml = (b, i, dagar) => {
        const pd = tpPeriodPersondagar(kal, { start: "2000-01-03", arbDagar: dagar, bemanning: [b] }).tot;
        const seg = b.segment.slice().sort((x, y) => x.franDag - y.franDag);
        return '<div class="tp-pd-bem" data-pdrad="' + i + '">' +
            '<div class="tp-pd-bemtopp">' + typVal(b.resursTyp) +
            '<div class="tp-nav tp-pd-lage" role="radiogroup" aria-label="Bemanning"><button type="button" role="radio" data-pdlage="fast" class="' + (!b.varierande ? "vald" : "") + '" aria-checked="' + !b.varierande + '">Fast</button>' +
            '<button type="button" role="radio" data-pdlage="var" class="' + (b.varierande ? "vald" : "") + '" aria-checked="' + b.varierande + '">Varierande</button></div>' +
            (!b.varierande ? '<label class="tp-pd-antal"><input class="f" type="number" min="0" step="1" data-pdantal="0" value="' + (seg[0] ? seg[0].antal : 0) + '"> pers</label>' : "") +
            '<span class="tp-pd-sum">' + tpTal(pd) + " pd · " + tpTal(pd * h) + " h</span>" +
            '<button type="button" class="tp-pd-x" data-pdbort="' + i + '" title="Ta bort resursen" aria-label="Ta bort resursen">×</button></div>' +
            (b.varierande ? '<table class="tp-pd-seg"><thead><tr><th>Från arbetsdag</th><th>Till</th><th>Personer</th><th></th></tr></thead><tbody>' +
                seg.map((sg, j) => {
                    const till = seg[j + 1] ? seg[j + 1].franDag - 1 : dagar, utanfor = sg.franDag > dagar;
                    return '<tr' + (utanfor ? ' class="utanfor" title="Ligger utanför perioden och räknas inte"' : "") + "><td>" +
                        (j === 0 ? "1" : '<input class="f" type="number" min="2" step="1" data-pdfran="' + j + '" value="' + sg.franDag + '">') + "</td><td>" + (utanfor ? "–" : till) + "</td>" +
                        '<td><input class="f" type="number" min="0" step="1" data-pdantal="' + j + '" value="' + sg.antal + '"></td><td>' +
                        (j > 0 ? '<button type="button" class="tp-pd-x" data-pdsegbort="' + j + '" aria-label="Ta bort delen">×</button>' : "") + "</td></tr>";
                }).join("") + "</tbody></table>" +
                '<button type="button" class="p4d-lank" data-pdsegny>+ Ny del från en senare dag</button>' : "") + "</div>";
    };
    const kropp = '<div class="tp-pd">' +
        '<label class="falt"><span>Namn på stapeln <span class="hjalp">visas i slutet av stapeln</span></span>' +
        '<input class="f" id="pdNamn" maxlength="80" value="' + esc(q.namn || "") + '" placeholder="' + esc(a.namn || "Aktivitetens namn") + '" autocomplete="off"></label>' +
        '<div class="tp-pd-datum"><label class="falt"><span>Start</span><input class="f" type="date" id="pdStart" value="' + esc(q.start) + '"></label>' +
        '<label class="falt"><span>Arbetsdagar</span><input class="f" type="number" min="1" step="1" id="pdDagar" value="' + q.arbDagar + '"></label>' +
        '<div class="tp-pd-info" id="pdInfo"></div></div>' +
        '<div class="falt"><label>Färg</label><div class="tp-pd-farger" id="pdFarger">' + fargKnappar() + "</div></div>" +
        '<div class="falt"><label>Bemanning</label><div id="pdBem"></div>' +
        '<div class="tp-pd-ny"><button type="button" class="mknapp" id="pdNyBem">+ Lägg till resurs</button>' +
        '<span class="tp-pd-nytyp"><input class="f" id="pdNyTyp" placeholder="Ny yrkesgrupp" aria-label="Ny yrkesgrupp"><button type="button" class="p4d-lank" id="pdNyTypKnapp">Lägg till i resursbanken</button></span></div></div>' +
        '<div id="pdHjalp"></div>' +
        (typeof tpTvPeriodDel === "function" ? '<div class="falt"><label>Fyraveckorstavlan</label><div id="pdTavlaDel">' + tpTvPeriodDel(a, q) + "</div></div>" : "") +
        (typeof tpSbDialogDel === "function" && !tpBarn().has(a.id) ? '<div class="falt"><label>Föregångare <span class="hjalp">för ' + esc(a.namn || "aktiviteten") + "</span></label><div id=\"pdSamband\"></div></div>" : "") +
        (ar ? '<label class="tp-kryss tp-pd-undantag"><input type="checkbox" id="pdUtanfor"' + (q.utanforSammanstallning ? " checked" : "") + "> Räkna inte med perioden i gruppens tidsspann</label>" : "") +
        '<div class="tp-pd-totalt" id="pdTotalt"></div><div id="pdFel"></div></div>';
    modal((a.namn || "Aktivitet") + " · period", "", kropp, [
        kan ? { txt: "Ta bort perioden", vanster: true, fara: true, fn: () => { stangModal(); tpKor(opTpTaBortPeriod(a, q.id), "Tog bort en period på " + (a.namn || "aktivitet")); } } : null,
        { txt: kan ? "Avbryt" : "Stäng", fn: stangModal },
        kan ? { txt: "Spara", primar: true, fn: () => spara_() } : null
    ].filter(Boolean));
    const $ = (id) => document.getElementById(id);
    const sbDel = $("pdSamband") ? tpSbDialogDel(a, kan) : null;
    if ($("pdTavlaDel")) tpTvPeriodKoppla($("pdTavlaDel"), a, q, stangModal);
    if (sbDel) sbDel.koppla($("pdSamband"));
    if (!kan) document.querySelectorAll("#overlay .tp-pd input, #overlay .tp-pd select, #overlay .tp-pd button").forEach(x => { x.disabled = true; });
    const dagarNu = () => Math.max(1, Math.round(+$("pdDagar").value) || 1);
    const startNu = () => /^\d{4}-\d{2}-\d{2}$/.test($("pdStart").value) ? $("pdStart").value : q.start;
    function ritaBem() {
        const dagar = dagarNu();
        $("pdBem").innerHTML = bem.length ? bem.map((b, i) => radHtml(b, i, dagar)).join("") : '<p class="hjalp" style="margin:0">Ingen bemanning. Tidplanen fungerar utan – lägg till resurser om du vill följa resursbehovet.</p>';
        const st = startNu(), sl = kal.slut(st, dagar), kd = Math.round((iso2d(sl) - iso2d(kal.narmasteArbetsdag(st, 1))) / 864e5) + 1;
        $("pdInfo").innerHTML = "Slutar <b>" + esc(dagEtikett(sl)) + "</b> · " + kd + " kalenderdagar" + (kal.narmasteArbetsdag(st, 1) !== st ? '<br><span class="tp-pd-varn">Starten är en ledig dag – perioden börjar ' + esc(kortDatum(kal.narmasteArbetsdag(st, 1))) + "</span>" : "");
        const pd = tpPeriodPersondagar(kal, { start: st, arbDagar: dagar, bemanning: bem.filter(b => b.resursTyp) }).tot;
        const av = tpAvvikelse(kalk, pd * h);
        $("pdTotalt").innerHTML = pd ? "Perioden: <b>" + tpTal(pd) + " persondagar · " + tpTal(pd * h) + " h</b> (" + h + " h per dag)" +
            (av ? " · kalkyl " + tpTal(kalk) + " h, " + tpTecken(av.timmar) + tpTal(Math.abs(av.timmar)) + " h" + (av.procent !== null ? " (" + tpTecken(av.procent) + Math.abs(Math.round(av.procent)) + " %)" : "") : "") : "";
        // beräkningshjälp: bara förslag
        const pers = kalk ? tpPersonerFor(kalk, dagar, h) : null;
        $("pdHjalp").innerHTML = pers ? '<div class="tp-pd-hjalp"><b>Beräkningshjälp</b><span>Kalkylen ' + tpTal(kalk) + " h på " + dagar + " arbetsdagar motsvarar <b>" + tpTal(pers) + " personer</b> (" + h + " h/dag)." +
            " Med " + Math.max(1, Math.round(pers)) + " personer räcker det till " + tpTal(tpDagarFor(kalk, Math.max(1, Math.round(pers)), h)) + " arbetsdagar.</span>" +
            '<small>Förslaget ändrar inget förrän du väljer det, och räknar inte med torktider och liknande.</small>' +
            (kan && typer.length ? '<button type="button" class="mknapp" id="pdAnvand">Använd ' + Math.max(1, Math.round(pers)) + " pers</button>" : "") + "</div>" : "";
        const anv = $("pdAnvand");
        if (anv) anv.onclick = () => {
            const n = Math.max(1, Math.round(pers));
            if (!bem.length) bem.push({ resursTyp: typer[0].id, varierande: false, segment: [{ franDag: 1, antal: n }] });
            else { bem[0].varierande = false; bem[0].segment = [{ franDag: 1, antal: n }]; }
            ritaBem();
        };
    }
    ritaBem();
    $("pdStart").addEventListener("input", ritaBem);
    $("pdDagar").addEventListener("input", ritaBem);
    $("pdFarger").addEventListener("click", (e) => {
        const b = e.target.closest("[data-pdfarg]");
        if (!b) return;
        farg = b.dataset.pdfarg;
        $("pdFarger").innerHTML = fargKnappar();
    });
    $("pdNyBem").addEventListener("click", () => {
        bem.push({ resursTyp: typer[0] ? typer[0].id : "", varierande: false, segment: [{ franDag: 1, antal: 1 }] });
        ritaBem();
        const s = document.querySelectorAll("#pdBem [data-pdtyp]"); if (s.length) s[s.length - 1].focus();
    });
    $("pdNyTypKnapp").addEventListener("click", () => {
        const n = $("pdNyTyp").value.trim();
        if (!n) return $("pdNyTyp").focus();
        const patch = opNyaKategorier([n]);
        if (!patch.ok || !appliceraPatch(patch, { tavla: T(), projekt: state })) return;
        spara();
        typer = tpResTyper();
        bem.push({ resursTyp: patch.andringar[0].id, varierande: false, segment: [{ franDag: 1, antal: 1 }] });
        $("pdNyTyp").value = "";
        ritaBem();
        status("Yrkesgruppen " + n + " lades till i resursbanken");
    });
    $("pdBem").addEventListener("change", (e) => {
        const rad = e.target.closest("[data-pdrad]");
        if (!rad) return;
        const b = bem[+rad.dataset.pdrad];
        if (e.target.dataset.pdtyp !== undefined) b.resursTyp = e.target.value;
        ritaBem();
    });
    $("pdBem").addEventListener("input", (e) => {
        const rad = e.target.closest("[data-pdrad]");
        if (!rad) return;
        const b = bem[+rad.dataset.pdrad], seg = b.segment.slice().sort((x, y) => x.franDag - y.franDag);
        if (e.target.dataset.pdantal !== undefined) seg[+e.target.dataset.pdantal].antal = Math.max(0, +e.target.value || 0);
        if (e.target.dataset.pdfran !== undefined) seg[+e.target.dataset.pdfran].franDag = Math.max(2, Math.round(+e.target.value) || 2);
        b.segment = seg;
        const sum = rad.querySelector(".tp-pd-sum"), pd = tpPeriodPersondagar(kal, { start: "2000-01-03", arbDagar: dagarNu(), bemanning: [b] }).tot;
        if (sum) sum.textContent = tpTal(pd) + " pd · " + tpTal(pd * h) + " h";
        const tot = bem.filter(x => x.resursTyp), p2 = tpPeriodPersondagar(kal, { start: startNu(), arbDagar: dagarNu(), bemanning: tot }).tot;
        const av = tpAvvikelse(kalk, p2 * h);
        $("pdTotalt").innerHTML = p2 ? "Perioden: <b>" + tpTal(p2) + " persondagar · " + tpTal(p2 * h) + " h</b> (" + h + " h per dag)" +
            (av ? " · kalkyl " + tpTal(kalk) + " h, " + tpTecken(av.timmar) + tpTal(Math.abs(av.timmar)) + " h" + (av.procent !== null ? " (" + tpTecken(av.procent) + Math.abs(Math.round(av.procent)) + " %)" : "") : "") : "";
    });
    $("pdBem").addEventListener("click", (e) => {
        const rad = e.target.closest("[data-pdrad]");
        if (!rad) return;
        const i = +rad.dataset.pdrad, b = bem[i];
        const lage = e.target.closest("[data-pdlage]");
        if (lage) {
            b.varierande = lage.dataset.pdlage === "var";
            if (b.varierande && b.segment.length === 1) {
                // föreslå en andra del från mitten av perioden, med samma antal (användaren ändrar)
                const mitt = Math.max(2, Math.ceil(dagarNu() / 2) + 1);
                if (dagarNu() >= 2) b.segment.push({ franDag: mitt, antal: b.segment[0].antal });
            }
            if (!b.varierande) b.segment = [b.segment.slice().sort((x, y) => x.franDag - y.franDag)[0] || { franDag: 1, antal: 0 }];
            return ritaBem();
        }
        if (e.target.closest("[data-pdbort]")) { bem.splice(i, 1); return ritaBem(); }
        const sb = e.target.closest("[data-pdsegbort]");
        if (sb) { const seg = b.segment.slice().sort((x, y) => x.franDag - y.franDag); seg.splice(+sb.dataset.pdsegbort, 1); b.segment = seg; return ritaBem(); }
        if (e.target.closest("[data-pdsegny]")) {
            const seg = b.segment.slice().sort((x, y) => x.franDag - y.franDag), sista = seg[seg.length - 1];
            const fran = Math.min(dagarNu(), sista.franDag + Math.max(1, Math.floor((dagarNu() - sista.franDag + 1) / 2)));
            if (fran <= sista.franDag) return status("Perioden är för kort för fler delar", true);
            seg.push({ franDag: fran, antal: sista.antal });
            b.segment = seg;
            return ritaBem();
        }
    });
    function spara_() {
        const start = $("pdStart").value, dagar = Math.round(+$("pdDagar").value);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return ($("pdFel").innerHTML = '<div class="notis rod">Ange ett startdatum.</div>');
        if (!(dagar >= 1)) return ($("pdFel").innerHTML = '<div class="notis rod">Perioden måste ha minst en arbetsdag.</div>');
        if (bem.some(b => !b.resursTyp)) return ($("pdFel").innerHTML = '<div class="notis rod">Välj yrkesgrupp för varje resurs, eller ta bort raden.</div>');
        const falt = { start, arbDagar: dagar, farg, namn: $("pdNamn").value.trim(), bemanning: tpRensaBemanning(bem.map(b => ({ resursTyp: b.resursTyp, segment: b.varierande ? b.segment : [b.segment.slice().sort((x, y) => x.franDag - y.franDag)[0]] })), dagar) };
        if (ar) falt.utanforSammanstallning = !!($("pdUtanfor") && $("pdUtanfor").checked);
        stangModal();
        tpValdPeriod = a.id + "|" + q.id;
        const nyaSb = sbDel ? sbDel.varde() : null;
        if (nyaSb) tpKorSerie("Ändrade " + (a.namn || "aktivitet"), (kor) => { kor(opTpAndraPeriod(a, q.id, falt)); kor(opTpAndraAktivitet(tpHitta(a.id), { samband: nyaSb })); });
        else tpKor(opTpAndraPeriod(a, q.id, falt), "Ändrade perioden på " + (a.namn || "aktivitet"));
        if (tpSegmentUtanfor(falt.bemanning, dagar)) status("En del av bemanningen börjar efter periodens sista dag och räknas inte", true);
        tpFokusStapel();
    }
    document.querySelector("#overlay .tp-pd").addEventListener("keydown", (e) => {
        if (e.key === "Enter" && kan && e.target.matches("input.f") && e.target.id !== "pdNyTyp") { e.preventDefault(); spara_(); }
        if (e.key === "Enter" && e.target.id === "pdNyTyp") { e.preventDefault(); $("pdNyTypKnapp").click(); }
    });
    setTimeout(() => { const f = $("pdDagar"); if (f && kan) { f.focus(); f.select(); } }, 30);
}
