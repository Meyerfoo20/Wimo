/* ======================================================================
   Wimo Forma · skalet
   Modulväxlaren (klick på Wimo-loggan), Formas sidomeny, header,
   adresser (#forma/…) och vilken vy som visas.
   ====================================================================== */

const FO_LS_MODUL = "wimo-modul";
let foVy = "oversikt";          // vyn som visas
let foFragaOppen = "";          // id för frågan i sidopanelen
let foFilter = { snabb: "alla", sok: "", disc: "", plats: "", lage: "", mote: "", sort: "std", visaMak: false };
let foFlik = { atg: "mina", org: "personer", mote: "", beslut: "gallande" };

function foModulAktiv() { return document.body.classList.contains("modul-forma"); }

// Just nu får bara huvudadmin använda Forma och byta modul. Alla andra har bara Plan.
function foFarForma() { return !!(window.p4FormaMoln && window.p4FormaMoln.redo() && window.p4FormaMoln.arAdmin()); }
function foUppdateraBehorighet() {
    const far = foFarForma();
    document.body.classList.toggle("fo-kan-byta", far);
    const brand = document.getElementById("p4Brand");
    if (brand) {
        if (far) { brand.setAttribute("role", "button"); brand.setAttribute("aria-haspopup", "menu"); brand.setAttribute("aria-expanded", "false"); brand.title = "Byt modul: Wimo Plan eller Wimo Forma"; }
        else { brand.removeAttribute("role"); brand.removeAttribute("aria-haspopup"); brand.removeAttribute("aria-expanded"); brand.title = "Till tavlan"; }
    }
    if (!far && foModulAktiv()) foVaxlaModul("plan", true);
    return far;
}

/* ---------- modulväxlaren ---------- */
function foVaxlaModul(modul, tyst) {
    const forma = modul === "forma" && foFarForma();
    document.body.classList.toggle("modul-forma", forma);
    document.body.classList.remove("p4-kontovy");
    try { localStorage.setItem(FO_LS_MODUL, forma ? "forma" : "plan"); } catch (e) { }
    const n = document.getElementById("p4ModulNamn");
    if (n) n.textContent = forma ? "Forma" : "Plan";
    document.title = forma ? "Wimo Forma" : "Wimo";
    const fot = document.querySelector(".p4-footer-brand p");
    if (fot) fot.textContent = forma
        ? "Projekteringens frågor, svar, beslut och åtgärder på ett ställe. Ett nummer per fråga, hela historiken kvar och alla ser vem som ska göra vad."
        : "Digital fyraveckorstavla för produktionsplanering. Fyra veckor framåt, ett kort per arbetsmoment — från tidplanen till vad laget gör på onsdag morgon.";
    if (forma) {
        try { if (typeof stangModal === "function") stangModal(); } catch (e) { }
        if (!location.hash.startsWith("#forma")) history.replaceState(null, "", "#forma/" + foVy);
        foLasAdress();
        foRita();
        if (!tyst) window.scrollTo({ top: 0 });
    } else {
        foStangPanel(true);
        if (location.hash.startsWith("#forma")) history.replaceState(null, "", location.pathname + location.search);
        if (typeof window.p4MarkeraNav === "function") window.p4MarkeraNav();
    }
}
function foModulMeny() {
    if (!foFarForma()) return false;
    const finns = document.getElementById("p4Modulmeny");
    if (finns) { finns.remove(); return; }
    const brand = document.getElementById("p4Brand");
    const r = brand.getBoundingClientRect();
    const m = document.createElement("div");
    m.id = "p4Modulmeny";
    m.className = "p4-modulmeny";
    m.setAttribute("role", "menu");
    const forma = foModulAktiv();
    m.innerHTML = '<div class="p4-modulrubrik">Byt modul</div>' +
        '<button type="button" role="menuitemradio" aria-checked="' + !forma + '" data-modul="plan" class="' + (forma ? "" : "vald") + '">' +
        '<span class="p4-modulikon plan" aria-hidden="true"></span><span><b>Wimo Plan</b><small>Fyraveckorstavla, tidplan, avrop och produktion</small></span></button>' +
        '<button type="button" role="menuitemradio" aria-checked="' + forma + '" data-modul="forma" class="' + (forma ? "vald" : "") + '">' +
        '<span class="p4-modulikon forma" aria-hidden="true"></span><span><b>Wimo Forma</b><small>Projektering: frågor, svar, beslut, åtgärder och möten</small></span></button>';
    document.body.appendChild(m);
    m.style.left = Math.max(8, r.left) + "px";
    m.style.top = (r.bottom + 8) + "px";
    m.querySelectorAll("[data-modul]").forEach(b => b.addEventListener("click", () => {
        m.remove();
        brand.setAttribute("aria-expanded", "false");
        foVaxlaModul(b.dataset.modul);
    }));
    brand.setAttribute("aria-expanded", "true");
    const f = m.querySelector(".vald") || m.querySelector("button");
    f.focus();
    const stang = (e) => {
        if (e.type === "keydown" && e.key !== "Escape") {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const b = [...m.querySelectorAll("button")], i = b.indexOf(document.activeElement);
                b[(i + (e.key === "ArrowDown" ? 1 : b.length - 1)) % b.length].focus();
            }
            return;
        }
        if (e.type === "pointerdown" && (m.contains(e.target) || brand.contains(e.target))) return;
        m.remove();
        brand.setAttribute("aria-expanded", "false");
        document.removeEventListener("pointerdown", stang, true);
        document.removeEventListener("keydown", stang, true);
        if (e.type === "keydown") { e.stopPropagation(); brand.focus(); }
    };
    setTimeout(() => { document.addEventListener("pointerdown", stang, true); document.addEventListener("keydown", stang, true); }, 0);
}

/* ---------- adresser: #forma/vy och #forma/vy/f12 ---------- */
const FO_VYER = ["oversikt", "aktiva", "klara", "alla", "moten", "atgarder", "beslut", "org", "inst", "projekt"];
function foLasAdress() {
    const h = decodeURIComponent(location.hash || "");
    if (!h.startsWith("#forma")) return;
    const d = h.replace(/^#forma\/?/, "").split("/");
    if (FO_VYER.includes(d[0])) foVy = d[0];
    const fr = d.find(x => /^f\d+$/.test(x));
    const f = fr && foP ? foFragaNr(foP, fr.slice(1)) : null;
    foFragaOppen = f ? f.id : "";
}
function foSattAdress(ersatt) {
    if (!foModulAktiv()) return;
    const f = foFragaOppen && foP ? foFraga(foP, foFragaOppen) : null;
    const h = "#forma/" + foVy + (f ? "/f" + f.nr : "");
    if (location.hash === h) return;
    if (ersatt) history.replaceState(null, "", h); else history.pushState(null, "", h);
}
window.addEventListener("popstate", () => {
    if (location.hash.startsWith("#forma")) {
        if (!foFarForma()) return;
        if (!foModulAktiv()) { foVaxlaModul("forma", true); return; }
        foLasAdress(); foRita();
    }
});
function foGaTill(vy, fragaId) {
    foVy = vy;
    foFragaOppen = fragaId || "";
    foSattAdress();
    document.body.classList.remove("p4-kontovy", "p4-menyoppen");
    foRita();
    window.scrollTo({ top: 0 });
}

/* ---------- sidomenyn ---------- */
function foNavHtml() {
    const p = foP, l = p ? foLaget(p) : null, jag = foJagId();
    const ag = p ? foAttGora(p, jag) : null;
    const nAg = ag ? ag.svara.length + ag.kvittera.length + ag.avsluta.length + ag.atgarder.length : 0;
    const knapp = (vy, ik, txt, badge, ljus) => '<button class="p4-nav' + (foVy === vy ? " aktiv" : "") + '" type="button" data-fovy="' + vy + '"' +
        (foVy === vy ? ' aria-current="page"' : "") + '><span class="p4-ik ' + ik + '"></span><span>' + txt + '</span>' +
        (badge ? '<span class="p4-badge' + (ljus ? " p4-badge-ljus" : "") + '">' + badge + '</span>' : "") + '</button>';
    const ingen = !p;
    return '<div class="p4-navgrupp">' + knapp("oversikt", "ik-dash", "Översikt", nAg || "", true) + '</div>' +
        (ingen ? "" :
        '<div class="p4-navgrupp"><div class="p4-navrubrik">Frågor</div>' +
        knapp("aktiva", "ik-fo-fraga", "Aktiva frågor", l.oppna || "", true) +
        knapp("klara", "ik-fo-klar", "Klara frågor", l.klara || "", true) +
        knapp("alla", "ik-fo-register", "Alla frågor", "", true) + '</div>' +
        '<div class="p4-navgrupp"><div class="p4-navrubrik">Projekt</div>' +
        knapp("moten", "ik-mote", "Möten", p.fragor.filter(f => foAktiv(f) && f.moten.length).length || "", true) +
        knapp("atgarder", "ik-lista", "Åtgärder", l.atgForsenade ? l.atgForsenade : (l.atgOppna || ""), !l.atgForsenade) +
        knapp("beslut", "ik-fo-beslut", "Beslutslogg", "", true) +
        knapp("org", "ik-folk", "Organisation", "", true) + '</div>') +
        '<div class="p4-navgrupp"><div class="p4-navrubrik">Data</div>' +
        (ingen ? "" : knapp("inst", "ik-fo-inst", "Projektinställningar", "", true)) +
        knapp("projekt", "ik-fo-projekt", "Alla projekt", "", true) +
        '<button class="p4-nav" type="button" data-fonav="konto"><span class="p4-ik ik-konto"></span><span>Mitt konto</span></button></div>' +
        '<div class="p4-navgrupp"><div class="p4-navrubrik">Stöd</div>' +
        '<button class="p4-nav" type="button" data-fonav="hjalp"><span class="p4-ik ik-hjalp"></span><span>Hjälp för Forma</span></button>' +
        '<button class="p4-nav" type="button" data-fonav="forslag"><span class="p4-ik ik-forslag"></span><span>Förslag</span></button></div>';
}
function foRitaNav() {
    const nav = document.getElementById("foNav");
    if (!nav) return;
    nav.innerHTML = foNavHtml();
    nav.querySelectorAll("[data-fovy]").forEach(b => b.addEventListener("click", () => foGaTill(b.dataset.fovy)));
    nav.querySelectorAll("[data-fonav]").forEach(b => b.addEventListener("click", () => {
        document.body.classList.remove("p4-menyoppen");
        const v = b.dataset.fonav;
        if (v === "konto" && window.p4OppnaKonto) { foStangPanel(true); window.p4OppnaKonto(); nav.querySelectorAll(".p4-nav").forEach(x => x.classList.toggle("aktiv", x === b)); }
        if (v === "hjalp") foHjalp();
        if (v === "forslag") { foVaxlaModul("plan"); setTimeout(() => { const f = document.querySelector('[data-nav="forslag"]'); if (f) f.click(); }, 0); }
    }));
}

/* ---------- header ---------- */
function foRitaHeader() {
    const k = document.getElementById("foProjektText");
    if (k) k.textContent = foP ? foP.namn : "Välj projekt";
    const d = document.getElementById("foDemo");
    if (d) d.classList.toggle("dold", !(foP && foP.demo));
    const ny = document.getElementById("foNyFraga");
    if (ny) ny.classList.toggle("dold", !foP || !foKanSkriva(foP, foJagId()));
    foVisaSynk();
}

/* ---------- rita det som syns ---------- */
let foRitar = false;
function foRita() {
    if (!foModulAktiv() || foRitar) return;
    foRitar = true;
    try {
        if (!foP && foPid) foOppnaProjekt(foPid);
        if (!foP) {
            const sist = (() => { try { return localStorage.getItem(FO_LS_AKTIV); } catch (e) { return ""; } })();
            if (sist && foAllaProjekt().some(x => x.id === sist)) foOppnaProjekt(sist);
        }
        if (!foP && foVy !== "projekt") foVy = "projekt";
        if (document.body.classList.contains("p4-kontovy")) { foRitaHeader(); return; }
        foRitaHeader();
        foRitaNav();
        const yta = document.getElementById("forma");
        if (!yta) return;
        const sc = window.scrollY;
        const vyer = { oversikt: foVyOversikt, aktiva: foVyFragor, klara: foVyFragor, alla: foVyFragor, moten: foVyMoten,
            atgarder: foVyAtgarder, beslut: foVyBeslut, org: foVyOrg, inst: foVyInst, projekt: foVyProjekt };
        (vyer[foVy] || foVyOversikt)(yta);
        window.scrollTo({ top: sc });
        if (foFragaOppen && foP && foFraga(foP, foFragaOppen)) foRitaPanel();
        else foStangPanel(true);
        foSattAdress(true);
    } finally { foRitar = false; }
}

/* ---------- projektväljaren ---------- */
function foProjektMeny() {
    foGaTill("projekt");
}

/* ---------- global sök i headern ---------- */
function foKopplaSok() {
    const inp = document.getElementById("foSok");
    if (!inp) return;
    let lista = null, val = -1, traffar = [];
    const stang = () => { if (lista) { lista.remove(); lista = null; } val = -1; };
    const oppna = (t) => {
        if (!foP) return;
        if (t.typ === "fraga") { const f = foFraga(foP, t.id); foGaTill(f && f.lage === "klar" ? "klara" : "aktiva", t.id); }
        if (t.typ === "beslut") { foGaTill("beslut"); setTimeout(() => foMarkeraRad(t.id), 30); }
        if (t.typ === "atgard") { foFlik.atg = "alla"; foGaTill("atgarder"); setTimeout(() => foMarkeraRad(t.id), 30); }
        if (t.typ === "person") { foFlik.org = "personer"; foGaTill("org"); setTimeout(() => foMarkeraRad(t.id), 30); }
        inp.value = ""; stang(); inp.blur();
    };
    const ritaLista = () => {
        traffar = foP ? foSok(foP, inp.value, 9) : [];
        if (!inp.value.trim()) return stang();
        if (!lista) {
            lista = document.createElement("div");
            lista.className = "fo-soklista";
            lista.setAttribute("role", "listbox");
            document.body.appendChild(lista);
        }
        const r = inp.closest(".p4-sok").getBoundingClientRect();
        lista.style.left = Math.max(8, Math.min(r.left, innerWidth - 440)) + "px";
        lista.style.top = (r.bottom + 6) + "px";
        lista.style.width = Math.max(r.width, 380) + "px";
        lista.innerHTML = traffar.length ? traffar.map((t, i) => '<button type="button" role="option" data-i="' + i + '" class="' + (i === val ? "vald" : "") + '">' +
            '<span class="fo-sokrub">' + esc(t.rubrik) + '</span><span class="fo-soktext">' + esc(t.text) + '</span></button>').join("")
            : '<div class="fo-soktom">Inga träffar på ”' + esc(inp.value.trim()) + '”.</div>';
        lista.querySelectorAll("[data-i]").forEach(b => b.addEventListener("mousedown", (e) => { e.preventDefault(); oppna(traffar[+b.dataset.i]); }));
    };
    inp.addEventListener("input", () => { val = -1; ritaLista(); });
    inp.addEventListener("blur", () => setTimeout(stang, 120));
    inp.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { inp.value = ""; stang(); inp.blur(); return; }
        if (!lista || !traffar.length) return;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            val = (val + (e.key === "ArrowDown" ? 1 : traffar.length - 1)) % traffar.length;
            ritaLista();
        }
        if (e.key === "Enter") { e.preventDefault(); oppna(traffar[val < 0 ? 0 : val]); }
    });
}
function foMarkeraRad(id) {
    const r = document.querySelector('#forma [data-rad="' + id + '"]');
    if (!r) return;
    r.classList.add("fo-blink");
    r.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => r.classList.remove("fo-blink"), 1800);
}

/* ---------- kortkommandon i Forma ---------- */
document.addEventListener("keydown", (e) => {
    if (!foModulAktiv() || e.altKey) return;
    if (["p4-utloggad", "p4-laddar", "p4-vantar"].some(k => document.body.classList.contains(k))) return;
    const a = document.activeElement, skriv = a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); const s = document.getElementById("foSok"); if (s) { s.focus(); s.select(); } return; }
    if (e.ctrlKey || e.metaKey || skriv || document.getElementById("overlay")) return;
    if (e.key === "Escape" && foFragaOppen) { e.preventDefault(); foStangPanel(); return; }
    if (e.key === "/") { e.preventDefault(); const s = document.getElementById("foSok"); if (s) s.focus(); return; }
    if (e.key.toLowerCase() === "n" && foP && foKanSkriva(foP, foJagId())) { e.preventDefault(); foNyFragaFokus(); }
}, true);

function foNyFragaFokus() {
    if (!["aktiva", "alla"].includes(foVy)) foGaTill("aktiva");
    setTimeout(() => { const t = document.getElementById("foNyText"); if (t) { t.focus(); t.scrollIntoView({ block: "center" }); } }, 30);
}

/* ---------- start ---------- */
function foStarta() {
    foLasLista();
    foUppdateraBehorighet();
    const pk = document.getElementById("foProjektknapp");
    if (pk) pk.addEventListener("click", foProjektMeny);
    const ny = document.getElementById("foNyFraga");
    if (ny) ny.addEventListener("click", foNyFragaFokus);
    foKopplaSok();
    let modul = "plan";
    try { modul = localStorage.getItem(FO_LS_MODUL) || "plan"; } catch (e) { }
    if (location.hash.startsWith("#forma")) modul = "forma";
    foStartModul = modul;
    const sist = (() => { try { return localStorage.getItem(FO_LS_AKTIV); } catch (e) { return ""; } })();
    if (sist && foLista.some(x => x.id === sist)) foOppnaProjekt(sist);
    foStartaMolnLista();
    if (modul === "forma" && foFarForma()) foVaxlaModul("forma", true);
}
// Modulen man hade senast öppnas när kontot är klart, om man är huvudadmin.
let foStartModul = "plan";
window.addEventListener("wimo-konto", () => {
    const far = foUppdateraBehorighet();
    if (far && foStartModul === "forma" && !foModulAktiv()) foVaxlaModul("forma", true);
    if (!far && location.hash.startsWith("#forma")) history.replaceState(null, "", location.pathname + location.search);
});
