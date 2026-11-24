/* ======================================================================
   Wimo · Tidplan: högerklicksmeny på raderna
   Högerklick på en rad (i tabellen eller i kalendern bredvid) öppnar en meny för
   att infoga rader mitt i, lägga till underaktivitet, flytta, kopiera och ta bort.
   Är flera rader markerade och man högerklickar på en av dem gäller menyn alla markerade.
   Tangentbord: Skift+F10 eller menytangenten på en rad, pilar för att välja, Enter, Esc.
   ====================================================================== */

let tpMenyRad = null;          // raden menyn gäller

function tpStangMeny() {
    const m = document.getElementById("tpHmeny");
    if (m) m.remove();
    document.querySelectorAll(".tp-menyrad").forEach(el => el.classList.remove("tp-menyrad"));
    tpMenyRad = null;
}

function tpMenyPunkter(id) {
    const flera = tpMark.size > 1 && tpMark.has(id);
    const a = tpHitta(id);
    const r = tpRaderAlla().find(x => x.a.id === id);
    const n = flera ? tpMark.size : 1;
    const rader = flera ? n + " rader" : "raden";
    return [
        { gor: "ovan", txt: "Infoga rad ovanför", kort: "Ctrl+Enter" },
        { gor: "nedan", txt: "Infoga rad nedanför", kort: "Ctrl+Skift+Enter" },
        flera ? null : { gor: "under", txt: "Lägg till underaktivitet", kort: "Ctrl+Alt+Enter" },
        "-",
        flera ? null : { gor: "upp", txt: "Flytta upp", kort: "Alt+↑" },
        flera ? null : { gor: "ned", txt: "Flytta ned", kort: "Alt+↓" },
        { gor: "indrag", txt: flera ? "Gör till underaktiviteter" : "Gör till underaktivitet", kort: "Alt+Skift+→" },
        (flera || (r && r.niva > 0)) ? { gor: "utdrag", txt: "Lyft ut ur gruppen", kort: "Alt+Skift+←" } : null,
        "-",
        { gor: "kopiera", txt: flera ? "Kopiera " + rader : "Kopiera raden", kort: "Ctrl+C" },
        tpUrklipp && tpUrklipp.rader.length ? { gor: "klistra", txt: "Klistra in nedanför", kort: "Ctrl+V" } : null,
        "-",
        { gor: "radera", txt: flera ? "Ta bort " + rader : "Ta bort " + (a && a.namn ? "”" + a.namn + "”" : "raden"), kort: flera ? "Delete" : "Ctrl+Delete", fara: true }
    ].filter(Boolean).filter((p, i, l) => p !== "-" || (i > 0 && l[i - 1] !== "-" && i < l.length - 1));
}

function tpOppnaMeny(id, x, y) {
    tpStangMeny();
    if (!tpKanAndra() || !tpHitta(id)) return;
    tpMenyRad = id;
    document.querySelectorAll('[data-tprad="' + CSS.escape(id) + '"], [data-tpspar="' + CSS.escape(id) + '"]').forEach(el => el.classList.add("tp-menyrad"));
    const m = document.createElement("div");
    m.id = "tpHmeny";
    m.className = "tp-hmeny";
    m.setAttribute("role", "menu");
    m.innerHTML = tpMenyPunkter(id).map(p => p === "-" ? '<div class="tp-hmeny-linje" role="separator"></div>' :
        '<button type="button" role="menuitem" class="tp-hmeny-val' + (p.fara ? " fara" : "") + '" data-tpmeny="' + p.gor + '">' +
        "<span>" + esc(p.txt) + "</span><kbd>" + esc(p.kort) + "</kbd></button>").join("");
    document.body.appendChild(m);
    // håll menyn inom fönstret
    const b = m.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(x, innerWidth - b.width - 8)) + "px";
    m.style.top = Math.max(8, y + b.height > innerHeight - 8 ? y - b.height : y) + "px";
    const forsta = m.querySelector("[data-tpmeny]");
    if (forsta) forsta.focus({ preventScroll: true });
}

function tpMenyGor(gor) {
    const id = tpMenyRad;
    tpStangMeny();
    if (!id || !tpHitta(id)) return;
    const flera = tpMark.size > 1 && tpMark.has(id);
    if (flera) return tpMarkGor(gor);
    if (gor === "ovan") return tpRadGor(id, "infoga");
    if (gor === "nedan") return tpRadGor(id, "infogaNedan");
    if (gor === "under" || gor === "upp" || gor === "ned" || gor === "radera") return tpRadGor(id, gor);
    if (gor === "indrag" || gor === "utdrag") return tpIndrag([id], gor === "indrag" ? 1 : -1);
    if (gor === "kopiera") { const r = tpRaderAlla().find(x => x.a.id === id); return r ? tpKopiera([r]) : null; }
    if (gor === "klistra") return tpKlistraInRader(id);
}

/* ---------- händelser ---------- */

document.addEventListener("contextmenu", (e) => {
    if (!e.target.closest || !tidplanOppen() || tpListaVisas) return;
    if (e.target.closest("input, textarea, [contenteditable]") || tpRedigerar) return;      // vanlig meny när man skriver
    const el = e.target.closest('#tidplan .tp-tabell [data-tprad], #tidplan .tp-kalrad[data-tpspar]');
    if (!el) return;
    const id = el.dataset.tprad || el.dataset.tpspar;
    if (!id || id === "ny" || !tpKanAndra()) return;
    e.preventDefault();
    tpOppnaMeny(id, e.clientX, e.clientY);
});

document.addEventListener("click", (e) => {
    const m = document.getElementById("tpHmeny");
    if (!m) return;
    const val = e.target.closest && e.target.closest("[data-tpmeny]");
    if (val && m.contains(val)) { e.preventDefault(); return tpMenyGor(val.dataset.tpmeny); }
    if (!m.contains(e.target)) tpStangMeny();
}, true);

document.addEventListener("keydown", (e) => {
    const m = document.getElementById("tpHmeny");
    if (m) {
        const val = [...m.querySelectorAll("[data-tpmeny]")], i = val.indexOf(document.activeElement);
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); const id = tpMenyRad; tpStangMeny(); if (id) tpFokus(id, "namn"); return; }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault(); e.stopPropagation();
            val[(i + (e.key === "ArrowDown" ? 1 : -1) + val.length) % val.length].focus();
            return;
        }
        if (e.key === "Home" || e.key === "End") { e.preventDefault(); val[e.key === "Home" ? 0 : val.length - 1].focus(); return; }
        if (e.key === "Tab") { e.preventDefault(); tpStangMeny(); return; }
        return;
    }
    // Skift+F10 / menytangenten på en rad öppnar menyn vid raden
    if ((e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) && tidplanOppen() && !tpListaVisas && !tpRedigerar) {
        const cell = document.activeElement && document.activeElement.closest && document.activeElement.closest("#tidplan [data-tprad]");
        if (!cell || cell.dataset.tprad === "ny") return;
        e.preventDefault();
        const b = document.activeElement.getBoundingClientRect();
        tpOppnaMeny(cell.dataset.tprad, b.left + 12, b.bottom);
    }
}, true);

window.addEventListener("resize", tpStangMeny);
document.addEventListener("scroll", (e) => { if (!e.target.closest || !e.target.closest("#tpHmeny")) tpStangMeny(); }, true);
