/* ======================================================================
   Wimo Forma · gemensamma delar i gränssnittet
   Rubrikrad, lägesetiketter, val av ansvarig, bilagor och små dialoger.
   ====================================================================== */

// Sidans rubrik: projektet som liten rad ovanför, sidans namn stort.
function foTopp(rubrik, hoger) {
    return '<div class="fo-sidtopp"><div class="fo-sidrub"><div class="fo-ogon">' + esc(foP ? foP.namn : "Wimo Forma") +
        (foP && foP.demo ? ' <span class="fo-demochip" title="Alla uppgifter i projektet är påhittade">Demo</span>' : "") + '</div>' +
        '<h1>' + esc(rubrik) + '</h1></div>' + (hoger ? '<div class="fo-sidknappar">' + hoger + '</div>' : "") + '</div>';
}

// Läget visas alltid med text och symbol, aldrig bara färg (UX-003).
function foLageChip(f) {
    if (f.makulerad) return '<span class="fo-lage mak"><i aria-hidden="true"></i>Makulerad</span>';
    const l = FO_LAGE[f.lage];
    return '<span class="fo-lage ' + l.kl + '"><i aria-hidden="true"></i>' + l.namn + '</span>';
}
function foTomt(rubrik, text, knapp) {
    return '<div class="fo-tomt"><b>' + esc(rubrik) + '</b><span>' + text + '</span>' + (knapp || "") + '</div>';
}
function foDatumKort(iso) {
    if (!iso) return "";
    const d = new Date(String(iso).length > 10 ? iso : iso + "T12:00:00");
    return d.getDate() + " " + ["jan", "feb", "mars", "apr", "maj", "juni", "juli", "aug", "sep", "okt", "nov", "dec"][d.getMonth()] +
        (d.getFullYear() !== new Date().getFullYear() ? " " + d.getFullYear() : "");
}
function foNarText(iso) {
    if (!iso) return "";
    const dag = foDag(iso), idag = foIdag();
    if (dag === idag) return "idag " + foKlocka(iso);
    if (dag === foPlusDagar(idag, -1)) return "igår " + foKlocka(iso);
    return foDatumKort(iso) + " " + foKlocka(iso);
}

/* ---------- välj ansvarig: disciplin eller person ---------- */
function foPartVarde(part) { return !part ? "" : part.person ? "p:" + part.person : part.disc ? "d:" + part.disc : ""; }
function foPartFran(v) { return !v ? null : v.startsWith("p:") ? { person: v.slice(2) } : v.startsWith("d:") ? { disc: v.slice(2) } : null; }
function foPartSelect(id, part, tomText, attr) {
    const p = foP, v = foPartVarde(part);
    const disc = p.discipliner.filter(d => d.aktiv || "d:" + d.id === v).sort((a, b) => a.ordning - b.ordning);
    const pers = p.personer.filter(x => x.aktiv || "p:" + x.id === v).sort((a, b) => foPersonNamn(p, a.id).localeCompare(foPersonNamn(p, b.id), "sv"));
    return '<select class="f" id="' + id + '"' + (attr || "") + '><option value="">' + esc(tomText || "Välj ansvarig …") + '</option>' +
        (disc.length ? '<optgroup label="Disciplin">' + disc.map(d => '<option value="d:' + d.id + '"' + (v === "d:" + d.id ? " selected" : "") + '>' +
            esc(d.kod + " – " + d.namn) + '</option>').join("") + '</optgroup>' : "") +
        (pers.length ? '<optgroup label="Person">' + pers.map(x => {
            const dk = (x.disc || []).map(i => foDiscText(p, i)).filter(Boolean).join(", ");
            return '<option value="p:' + x.id + '"' + (v === "p:" + x.id ? " selected" : "") + '>' + esc(foPersonNamn(p, x.id) + (dk ? " (" + dk + ")" : "")) + '</option>';
        }).join("") + '</optgroup>' : "") + '</select>';
}
function foDiscSelect(id, valt, tomText, attr) {
    const disc = foP.discipliner.filter(d => d.aktiv || d.id === valt).sort((a, b) => a.ordning - b.ordning);
    return '<select class="f" id="' + id + '"' + (attr || "") + '><option value="">' + esc(tomText || "–") + '</option>' +
        disc.map(d => '<option value="' + d.id + '"' + (d.id === valt ? " selected" : "") + '>' + esc(d.kod + " – " + d.namn) + '</option>').join("") + '</select>';
}
function foPersonSelect(id, valt, tomText, attr) {
    const pers = foP.personer.filter(x => x.aktiv || x.id === valt).sort((a, b) => foPersonNamn(foP, a.id).localeCompare(foPersonNamn(foP, b.id), "sv"));
    return '<select class="f" id="' + id + '"' + (attr || "") + '><option value="">' + esc(tomText || "–") + '</option>' +
        pers.map(x => '<option value="' + x.id + '"' + (x.id === valt ? " selected" : "") + '>' + esc(foPersonNamn(foP, x.id)) + '</option>').join("") + '</select>';
}
function foPlatsSelect(id, valt, tomText, attr) {
    const inds = foP.indelningar.filter(i => i.varden.some(v => v.aktiv));
    return '<select class="f" id="' + id + '"' + (attr || "") + '><option value="">' + esc(tomText || "–") + '</option>' +
        inds.map(i => '<optgroup label="' + esc(i.namn) + '">' + i.varden.filter(v => v.aktiv || v.id === valt).map(v =>
            '<option value="' + v.id + '"' + (v.id === valt ? " selected" : "") + '>' + esc(v.namn) + '</option>').join("") + '</optgroup>').join("") + '</select>';
}
function foForumSelect(id, valt, tomText, attr) {
    return '<select class="f" id="' + id + '"' + (attr || "") + '><option value="">' + esc(tomText || "Inget") + '</option>' +
        foP.forum.filter(f => f.aktiv || f.id === valt).map(f => '<option value="' + f.id + '"' + (f.id === valt ? " selected" : "") + '>' + esc(f.namn) + '</option>').join("") + '</select>';
}
// Etiketter för risk för tid- och kostnadspåverkan.
function foKonsTaggar(f) {
    const t = foKonsAktiva(f, "tid").length, k = foKonsAktiva(f, "kostnad").length;
    return (t ? '<span class="fo-tagg t-varn" title="' + esc(FO_KONS.tid + " – " + FO_PAVERKAR_TEXT) + '">Tid</span>' : "") +
        (k ? '<span class="fo-tagg t-varn" title="' + esc(FO_KONS.kostnad + " – " + FO_PAVERKAR_TEXT) + '">Kostnad</span>' : "");
}
// Flera mottagare/berörda: valda som etiketter med ×, och en lista för att lägga till fler.
// status(part) kan ge extra text i etiketten (t.ex. om parten har svarat).
function foPartValjare(id, valda, val) {
    val = val || {};
    const p = foP, v = valda.map(foPartVarde);
    const disc = val.disc === false ? [] : p.discipliner.filter(d => d.aktiv && !v.includes("d:" + d.id)).sort((a, b) => a.ordning - b.ordning);
    const pers = val.pers === false ? [] : p.personer.filter(x => x.aktiv && !v.includes("p:" + x.id)).sort((a, b) => foPersonNamn(p, a.id).localeCompare(foPersonNamn(p, b.id), "sv"));
    const chips = valda.map(part => {
        let st = val.status ? val.status(part) : "";
        if (part.disc && typeof foDiscSaknarAvis === "function" && foDiscSaknarAvis(p, part.disc))
            st += '<i class="fo-saknar" title="Disciplinen saknar utsedda aviseringsmottagare. Alla i disciplinen aviseras. Välj mottagare under Projektinställningar → Aviseringar.">alla aviseras</i>';
        return '<span class="fo-partchip' + (part.disc ? " disc" : "") + '">' + esc(foPartText(p, part, true) || "?") + (st ? " " + st : "") +
            (val.lasa ? "" : '<button type="button" class="fo-partbort" data-partbort="' + esc(foPartVarde(part)) + '" aria-label="Ta bort ' + esc(foPartText(p, part)) + '">×</button>') + '</span>';
    }).join("");
    const sel = val.lasa ? "" : '<select class="f fo-partlagg" aria-label="' + esc(val.etikett || "Lägg till") + '"><option value="">' + esc(valda.length ? (val.merText || "+ Lägg till …") : (val.tomText || "Välj …")) + '</option>' +
        (disc.length ? '<optgroup label="Disciplin">' + disc.map(d => '<option value="d:' + d.id + '">' + esc(d.kod + " – " + d.namn) + '</option>').join("") + '</optgroup>' : "") +
        (pers.length ? '<optgroup label="Person">' + pers.map(x => {
            const dk = (x.disc || []).map(i => foDiscText(p, i)).filter(Boolean).join(", ");
            return '<option value="p:' + x.id + '">' + esc(foPersonNamn(p, x.id) + (dk ? " (" + dk + ")" : "")) + '</option>';
        }).join("") + '</optgroup>' : "") + '</select>';
    return '<div class="fo-partval" id="' + id + '">' + chips + sel + (!valda.length && val.lasa ? '<span class="hjalp">–</span>' : "") + '</div>';
}
function foKopplaPartValjare(rot, id, valda, klar) {
    const el = rot.querySelector("#" + id);
    if (!el) return;
    el.querySelectorAll("[data-partbort]").forEach(b => b.addEventListener("click", () => klar(valda.filter(x => foPartVarde(x) !== b.dataset.partbort))));
    const s = el.querySelector(".fo-partlagg");
    if (s) s.addEventListener("change", () => { const n = foPartFran(s.value); if (n) klar(valda.concat([n])); });
}

// Knapprad där flera kan vara valda (berörda discipliner, plats, möten).
function foValChips(namn, alternativ, valda) {
    if (!alternativ.length) return '<span class="hjalp">Inga att välja ännu.</span>';
    return '<div class="fo-valchips" data-val="' + namn + '">' + alternativ.map(a =>
        '<button type="button" class="fo-valchip' + (valda.includes(a.id) ? " pa" : "") + '" data-id="' + a.id + '" aria-pressed="' + valda.includes(a.id) + '">' +
        esc(a.namn) + '</button>').join("") + '</div>';
}

/* ---------- bilagor ---------- */
function foBilagorHtml(lista, del) {
    const l = lista.filter(b => !del || (b.del || "fraga") === del);
    if (!l.length) return "";
    return '<div class="fo-bilagor">' + l.map(b => {
        const bild = /^image\//.test(b.typ);
        return '<button type="button" class="fo-bilaga' + (bild ? " bild" : "") + '" data-fil="' + b.id + '" title="Öppna ' + esc(b.namn) + '">' +
            (bild ? '<span class="fo-tumme" data-tumme="' + b.id + '"></span>' : '<span class="fo-filik" aria-hidden="true">' + esc(foFilTyp(b)) + '</span>') +
            '<span class="fo-filnamn">' + esc(b.namn) + '</span><span class="fo-filstorlek">' + foStorlek(b.storlek || 0) + '</span></button>';
    }).join("") + '</div>';
}
function foFilTyp(b) {
    const m = /\.([a-z0-9]{1,5})$/i.exec(b.namn || "");
    return m ? m[1].toUpperCase() : (b.typ || "FIL").split("/").pop().toUpperCase().slice(0, 4);
}
// Kopplar klick (öppna) och tumnaglar för bilagor i rot.
function foKopplaBilagor(rot, lista) {
    rot.querySelectorAll("[data-fil]").forEach(knapp => {
        const meta = lista.find(b => b.id === knapp.dataset.fil);
        if (!meta) return;
        knapp.addEventListener("click", async () => {
            const x = await foHamtaFil(meta);
            if (!x) return status("Filen finns inte på den här datorn och kunde inte hämtas från molnet.", true);
            foVisaFil(meta, x.data);
        });
        const tumme = knapp.querySelector("[data-tumme]");
        if (tumme) foHamtaFil(meta).then(x => { if (x) tumme.style.backgroundImage = "url(" + x.data + ")"; });
    });
}
function foVisaFil(meta, data) {
    const bild = /^image\//.test(meta.typ), pdf = meta.typ === "application/pdf";
    const v = document.createElement("div");
    v.className = "fo-visare";
    v.setAttribute("role", "dialog");
    v.setAttribute("aria-label", meta.namn);
    v.innerHTML = '<div class="fo-visare-topp"><b>' + esc(meta.namn) + '</b><span>' + foStorlek(meta.storlek || 0) + '</span>' +
        '<a class="mknapp" download="' + esc(meta.namn) + '" href="' + data + '">Ladda ner</a><button type="button" class="mknapp primar" data-stang>Stäng</button></div>' +
        '<div class="fo-visare-yta">' + (bild ? '<img src="' + data + '" alt="' + esc(meta.namn) + '">' : pdf ? '<iframe src="' + data + '" title="' + esc(meta.namn) + '"></iframe>' :
            '<p class="hjalp">Filen kan inte visas här. Ladda ner den för att öppna den.</p>') + '</div>';
    document.body.appendChild(v);
    const stang = () => { v.remove(); document.removeEventListener("keydown", tangent, true); };
    const tangent = (e) => { if (e.key === "Escape") { e.stopPropagation(); stang(); } };
    v.querySelector("[data-stang]").addEventListener("click", stang);
    v.addEventListener("click", (e) => { if (e.target === v) stang(); });
    document.addEventListener("keydown", tangent, true);
    v.querySelector("[data-stang]").focus();
}
// Fält som tar emot filer: välj, dra och släpp, klistra in (Ctrl+V) i textrutan.
function foFilMottagare(zon, textruta, klar) {
    const inp = zon.querySelector("input[type=file]");
    const ta = async (filer) => {
        filer = [...filer].filter(f => f && f.size);
        if (!filer.length) return;
        zon.classList.add("laddar");
        try { const meta = await foSparaFiler(filer); if (meta.length) klar(meta); }
        finally { zon.classList.remove("laddar"); }
    };
    if (inp) inp.addEventListener("change", () => { ta(inp.files); inp.value = ""; });
    ["dragenter", "dragover"].forEach(t => zon.addEventListener(t, (e) => { e.preventDefault(); zon.classList.add("over"); }));
    ["dragleave", "drop"].forEach(t => zon.addEventListener(t, (e) => { e.preventDefault(); zon.classList.remove("over"); }));
    zon.addEventListener("drop", (e) => ta(e.dataTransfer.files));
    const klistra = (e) => {
        const filer = [...(e.clipboardData ? e.clipboardData.files : [])];
        if (filer.length) { e.preventDefault(); ta(filer); }
    };
    if (textruta) textruta.addEventListener("paste", klistra);
    zon.addEventListener("paste", klistra);
}
function foFilZon(id, text) {
    return '<label class="fo-filzon" id="' + id + '" tabindex="0"><input type="file" multiple hidden accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.dwg,.ifc,.txt">' +
        '<span class="fo-gem" aria-hidden="true"></span><span>' + esc(text || "Dra hit, klistra in eller välj bild/PDF") + '</span></label>';
}

/* ---------- dialog med orsak (makulera, avbryta) ---------- */
function foFragaOrsak(rubrik, text, knappText, klar) {
    modal(rubrik, "", '<p class="hjalp" style="margin-top:0">' + text + '</p><div class="falt"><label for="foOrsak">Orsak</label>' +
        '<textarea class="f" id="foOrsak" rows="3" placeholder="Skriv varför"></textarea></div><div id="foOrsakFel"></div>', [
        { txt: "Avbryt", fn: stangModal },
        { txt: knappText, primar: true, fara: true, fn: () => {
            const o = document.getElementById("foOrsak").value.trim();
            if (!o) { document.getElementById("foOrsakFel").innerHTML = '<div class="notis rod">Ange en orsak.</div>'; return; }
            stangModal(); klar(o);
        } }
    ]);
    setTimeout(() => { const t = document.getElementById("foOrsak"); if (t) t.focus(); }, 30);
}

/* ---------- ladda ner text som fil ---------- */
function foLaddaNer(namn, text, typ) {
    const blob = new Blob([text], { type: typ || "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = namn;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function foFilnamn(s) { return String(s || "forma").replace(/[^\wåäöÅÄÖ\- ]+/g, "").trim().replace(/\s+/g, "-") || "forma"; }

/* ---------- "Sparat" för fält som sparas direkt (SYS-016) ---------- */
function foVisaSparat(el) {
    if (!el) return;
    let m = el.parentElement.querySelector(".fo-sparat");
    if (!m) { m = document.createElement("span"); m.className = "fo-sparat"; m.setAttribute("role", "status"); el.parentElement.appendChild(m); }
    m.textContent = "Sparat";
    m.classList.remove("syns"); void m.offsetWidth; m.classList.add("syns");
}
