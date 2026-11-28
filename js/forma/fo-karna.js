/* ======================================================================
   Wimo Forma · kärnan
   Projektets datamodell, alla ändringar (operationer) och urval.

   Allt som ändrar ett Forma-projekt går genom foOp(typ, argument). En
   operation är en ren funktion av projektet och sina argument (id och tid
   bestäms innan den körs), så att den kan köras om ovanpå en nyare version
   från molnet om två personer sparar samtidigt. Inget här rör DOM:en.

   Formas data är helt fristående från Wimo Plan.
   ====================================================================== */

const FO_VER = 1;

const FO_LAGE = {
    obesvarad: { namn: "Obesvarad", kl: "obesvarad" },
    besvarad: { namn: "Besvarad", kl: "besvarad" },
    ofullstandig: { namn: "Ofullständigt svar", kl: "ofullstandig" },
    klar: { namn: "Klar", kl: "klar" }
};
const FO_ROLLER = {
    admin: "Administratör",
    pl: "Projekteringsledare",
    projektor: "Projektör",
    granskare: "Granskare",
    lasare: "Läsare"
};
const FO_REVTYP = { fraga: "Reviderad fråga", svar: "Reviderat svar", beslut: "Ändrat beslut" };
const FO_KONS = { tid: "Risk för tidspåverkan", kostnad: "Risk för kostnadspåverkan" };
const FO_KONS_BEKRAFTA = "Denna fråga har markerats med risk för tid- och/eller kostnadspåverkan. Har konsekvenserna kommunicerats och hanterats?";
const FO_PAVERKAR_TEXT = "Markeringen är en upplysning om att frågan kan påverka tid eller kostnad. Den är inte en underrättelse eller ett anspråk enligt avtal och ersätter inte ÄTA-anmälan eller hinderanmälan.";

/* ---------- små hjälpare ---------- */
function foNu() { return new Date().toISOString(); }
function foId() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function foDag(iso) { return iso ? String(iso).slice(0, 10) : ""; }
function foKlocka(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
}
function foIdag() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function foPlusDagar(iso, n) {
    const d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}
// Lägger till arbetsdagar (måndag–fredag).
function foPlusArbetsdagar(iso, n) {
    const d = new Date(iso + "T12:00:00");
    let k = 0;
    while (k < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) k++; }
    return d.toISOString().slice(0, 10);
}
// ISO-veckonummer.
function foVecka(iso) {
    if (!iso) return 0;
    const d = new Date(String(iso).slice(0, 10) + "T12:00:00");
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dag = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dag);
    const start = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - start) / 864e5 + 1) / 7);
}
function foNormal(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

/* ---------- ett tomt projekt ---------- */
// Förslag på kategorier för projektmedlemmar. De är bara exempel: användaren skapar, döper om,
// sorterar och tar bort fritt. Fasta id gör att alla datorer som lägger till dem i ett äldre
// projekt får samma kategorier.
const FO_STD_KATEGORIER = [["kat-bestallare", "Beställare"], ["kat-entreprenor", "Total-/generalentreprenör"], ["kat-ue", "Underentreprenörer"],
    ["kat-projektorer", "Projektörer"], ["kat-konsulter", "Övriga konsulter"]];

function foTomtProjekt(namn, skapare) {
    const p = {
        ver: FO_VER, namn: namn || "Nytt projekt", nummer: "", bestallare: "", entreprenor: "", beskrivning: "",
        plId: "", start: "", slut: "", demo: false,
        inst: { autoBesvarad: true, revStil: "bokstav", svarstid: 5 },
        discipliner: [], foretag: [], personer: [], indelningar: [], forum: [],
        kategorier: FO_STD_KATEGORIER.map(([id, n], i) => ({ id, namn: n, ordning: i + 1 })),
        fragor: [], beslut: [], atgarder: [], flode: [], rapporter: [], aviseringar: [], kvittkrav: [], logg: [], sett: {},
        seq: { fraga: 0, atgard: 0, rapport: 0, motesbeslut: {} }
    };
    if (skapare) {
        p.personer.push({ id: skapare.id || foId(), fornamn: skapare.fornamn || "", efternamn: skapare.efternamn || "",
            foretagId: "", befattning: "", disc: [], epost: skapare.epost || "", tel: "", roll: "admin", extern: false, aktiv: true, uid: skapare.uid || "" });
        p.plId = p.personer[0].id;
    }
    return p;
}

// Äldre eller ofullständiga projekt får alla fält som koden räknar med.
function foLaga(p) {
    if (!p || typeof p !== "object") return foTomtProjekt();
    const t = foTomtProjekt();
    Object.keys(t).forEach(k => { if (p[k] === undefined) p[k] = t[k]; });
    p.inst = Object.assign({}, t.inst, p.inst || {});
    p.seq = Object.assign({}, t.seq, p.seq || {});
    ["discipliner", "foretag", "personer", "indelningar", "forum", "fragor", "beslut", "atgarder", "logg", "kategorier", "flode", "rapporter", "aviseringar", "kvittkrav"].forEach(k => { if (!Array.isArray(p[k])) p[k] = []; });
    if (typeof foAvisInst === "function") foAvisInst(p);
    p.rapporter.forEach(r => { ["signerade", "hist"].forEach(k => { if (!Array.isArray(r[k])) r[k] = []; }); });
    p.flode.forEach(x => { ["bilagor", "personer", "disc", "lankar", "gillar", "kommentarer", "kopplingar"].forEach(k => { if (!Array.isArray(x[k])) x[k] = []; }); });
    p.personer.forEach(x => { if (!Array.isArray(x.kategorier)) x.kategorier = []; });
    p.fragor.forEach(f => foLagaFraga(f));
    p.atgarder.forEach(a => { if (!Array.isArray(a.hist)) a.hist = []; });
    p.ver = FO_VER;
    return p;
}

// En fråga i äldre format får de nya fälten. Inget tas bort: det gamla svaret blir första inlägget i dialogen.
function foLagaFraga(f) {
    ["textVer", "berorda", "berordaP", "indelning", "moten", "revs", "kopplingar", "bilagor", "hist", "dialog", "konsekvens"].forEach(k => { if (!Array.isArray(f[k])) f[k] = []; });
    if (!f.behandlad) f.behandlad = {};
    if (!Array.isArray(f.mottagare)) f.mottagare = f.ansvarig ? [f.ansvarig] : [];
    if (!f.stallare) f.stallare = f.av || "";
    // Ett svar i äldre format (ett enda svarsfält med versioner) blir ett inlägg i dialogen.
    if (f.svar && Array.isArray(f.svar.ver) && f.svar.ver.length) {
        const id = "s-" + f.id;
        let x = f.dialog.find(d => d.id === id);
        if (!x) {
            const forsta = f.svar.ver[0];
            x = { id: id, typ: "svar", tid: forsta.tid, av: forsta.av, lamnat: forsta.av, text: "", ver: [], slutligt: f.lage === "klar" };
            f.dialog.unshift(x);
            f.bilagor.forEach(b => { if (b.del === "svar") b.del = "d:" + id; });
            f.revs.forEach(r => { if (r.typ === "svar" && !r.post) r.post = id; });
        }
        if (f.svar.ver.length > x.ver.length) { x.ver = f.svar.ver.slice(); x.text = f.svar.text; }
    }
    f.svar = null;
    // Den tidigare gemensamma markeringen tid/kostnad blir två markeringar.
    if (f.paverkar && !f.konsekvens.length) {
        ["tid", "kostnad"].forEach(t => f.konsekvens.push({ id: "k-" + t + "-" + f.id, typ: t, av: f.stallare || f.av || "", tid: f.skapad || "",
            kommentar: "Markerad som tid/kostnad innan markeringarna delades upp", avskriven: null }));
    }
    foSynkFraga(f);
}
// Fält som räknas fram ur annat, för listor och äldre kod.
function foSynkFraga(f) {
    f.ansvarig = f.mottagare[0] || null;
    f.paverkar = f.konsekvens.some(k => !k.avskriven);
}

/* ---------- uppslag ---------- */
function foPerson(p, id) { return p.personer.find(x => x.id === id) || null; }
function foKategori(p, id) { return (p.kategorier || []).find(x => x.id === id) || null; }
function foKategorierSorterade(p) { return (p.kategorier || []).slice().sort((a, b) => a.ordning - b.ordning); }
function foDisc(p, id) { return p.discipliner.find(x => x.id === id) || null; }
function foForetag(p, id) { return p.foretag.find(x => x.id === id) || null; }
function foForum(p, id) { return p.forum.find(x => x.id === id) || null; }
function foFraga(p, id) { return p.fragor.find(x => x.id === id) || null; }
function foFragaNr(p, nr) { return p.fragor.find(x => x.nr === +nr) || null; }
function foBeslut(p, id) { return p.beslut.find(x => x.id === id) || null; }
function foAtgard(p, id) { return p.atgarder.find(x => x.id === id) || null; }
function foInlagg(p, id) { return (p.flode || []).find(x => x.id === id) || null; }
// Nämns personen i inlägget, direkt eller via sin disciplin?
function foInlaggNamner(p, personId, x) {
    if (!personId || !x) return false;
    return (x.personer || []).includes(personId) || (x.disc || []).some(d => foPersonDisc(p, personId).includes(d));
}
function foVarde(p, id) {
    for (const ind of p.indelningar) {
        const v = ind.varden.find(x => x.id === id);
        if (v) return { ind: ind, varde: v };
    }
    return null;
}
function foPersonNamn(p, id) {
    const x = foPerson(p, id);
    return x ? ((x.fornamn + " " + x.efternamn).trim() || x.epost || "Namnlös") : "";
}
function foDiscText(p, id) { const d = foDisc(p, id); return d ? d.kod : ""; }
// Färgad disciplinkod: färgen följer disciplinens plats i projektet (samma färg överallt, ljust och mörkt läge).
function foDiscFarg(p, id) { const i = p.discipliner.findIndex(d => d.id === id); return i < 0 ? 0 : i % 6 + 1; }
function foDiscChip(p, id, medNamn) {
    const d = foDisc(p, id);
    if (!d) return "";
    return '<span class="fo-dkod" data-dfarg="' + foDiscFarg(p, id) + '">' + esc(d.kod) + '</span>' + (medNamn ? " " + esc(d.namn) : "");
}
// Avatarer får en färg utifrån initialerna, så samma person känns igen i hela Forma.
function foFargaAvatarer(rot) {
    (rot || document).querySelectorAll(".fo-avatar:not([data-afarg])").forEach(el => {
        const t = el.textContent || "";
        let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
        el.setAttribute("data-afarg", String(h % 6 + 1));
    });
}
// Ansvarig/mottagare är antingen en disciplin { disc } eller en person { person }.
function foPartText(p, part, lang) {
    if (!part) return "";
    if (part.person) {
        const x = foPerson(p, part.person);
        if (!x) return "";
        const d = x.disc && x.disc[0] ? foDisc(p, x.disc[0]) : null;
        return foPersonNamn(p, x.id) + (d ? " (" + d.kod + ")" : "");
    }
    if (part.disc) {
        const d = foDisc(p, part.disc);
        return d ? (lang ? d.kod + " – " + d.namn : d.kod) : "";
    }
    return "";
}
function foPersonDisc(p, personId) { const x = foPerson(p, personId); return x ? (x.disc || []) : []; }
// Hör personen till parten (är personen, eller ingår i disciplinen)?
function foArPart(p, personId, part) {
    if (!part || !personId) return false;
    if (part.person) return part.person === personId;
    if (part.disc) return foPersonDisc(p, personId).includes(part.disc);
    return false;
}
function foRoll(p, personId) { const x = foPerson(p, personId); return x ? x.roll : "lasare"; }
function foKanLeda(p, personId) { return ["admin", "pl"].includes(foRoll(p, personId)); }
function foKanSkriva(p, personId) { return ["admin", "pl", "projektor"].includes(foRoll(p, personId)); }

// Vem får välja en fråga till beslutsloggen: frågeställarens eller mottagarens disciplin/person, projekteringsledare och superuser.
function foKanLoggaFraga(p, personId, f) {
    if (!personId) return true;
    if (!foKanSkriva(p, personId) && !foSuper(p, personId)) return false;
    if (foKanLeda(p, personId) || foSuper(p, personId) || foArStallare(p, personId, f) || foArMottagare(p, personId, f)) return true;
    const mina = foPersonDisc(p, personId);
    return mina.includes(f.fran) || foMottagare(f).some(m => m.disc && mina.includes(m.disc));
}
// Disciplin för en åtgärd: ansvarig disciplin, annars ansvarig persons första disciplin.
function foAtgardDisc(p, a) {
    if (!a.ansvarig) return "";
    if (a.ansvarig.disc) return a.ansvarig.disc;
    return a.ansvarig.person ? (foPersonDisc(p, a.ansvarig.person)[0] || "") : "";
}
// Beskedet i källfrågan har reviderats efter att åtgärden skapades (eller senast bedömdes).
function foAtgardInaktuell(p, a) {
    if (a.svarRev === null || a.svarRev === undefined || !a.kalla || a.kalla.typ !== "fraga") return false;
    const f = foFraga(p, a.kalla.id);
    return !!f && (f.revs || []).length > a.svarRev;
}

// Mötesforum som går att välja på frågor (mappar som markerats som forum).
function foForumValbara(p) { return p.forum.filter(f => f.aktiv && f.valbar !== false); }
function foForumSokvag(p, fo) { const l = []; for (let x = fo, n = 0; x && n < 20; n++) { l.unshift(x.namn); x = x.forelder ? foForum(p, x.forelder) : null; } return l.join(" / "); }
// Protokollbevakning: utgår från mötesdatum. Extra möten och revideringar nollställer inte bevakningen.
// Forma vet inte om mötet hållits – den säger "behöver följas upp", aldrig "protokoll saknas".
function foBevakning(p, fo, idag) {
    const b = fo.bevakning;
    if (!b || !b.pa) return null;
    const ord = (p.protokoll || []).filter(x => x.forum === fo.id && !x.makulerad && !x.extra).sort((a, c) => (c.datum || "").localeCompare(a.datum || ""));
    const senast = ord[0] ? ord[0].datum : "";
    if (b.pausTill && b.pausTill >= idag) return { senast, lage: "pausad", text: "Pausad till " + b.pausTill };
    if (!senast) return { senast, lage: "folj", text: "Inget protokoll registrerat ännu" };
    const grans = new Date(senast); grans.setDate(grans.getDate() + b.dagar + b.marginal);
    const g = grans.toISOString().slice(0, 10);
    return g < idag ? { senast, lage: "folj", text: "Behöver följas upp – senaste protokoll " + senast } : { senast, lage: "ok", text: "Inom intervallet – nästa väntas senast " + g };
}

// Aktuellt ansvar för en person: underlag för Ersätt och för avaktivering.
function foAnsvarFor(p, id) {
    const ar = (part) => part && part.person === id;
    const akt = p.fragor.filter(foAktiv);
    return {
        stallare: akt.filter(f => foStallarePerson(f) === id),
        mottagare: akt.filter(f => foMottagare(f).some(ar)),
        bedoma: akt.filter(f => foStallarePerson(f) === id && f.lage === "besvarad"),
        atgarder: p.atgarder.filter(x => x.status === "oppen" && ar(x.ansvarig)),
        avis: p.discipliner.filter(d => (d.avis || []).includes(id))
    };
}
// Anslutningsstatus (skild från befattning och behörighet): kontakt | inbjuden | aktiv | inaktiv
function foAnslutning(p, x, medlemmar) {
    if (x.aktiv === false) return "inaktiv";
    if (x.uid && (!medlemmar || medlemmar.includes(x.uid))) return "aktiv";
    if (x.inbjudan && x.inbjudan.utgar > Date.now()) return "inbjuden";
    return "kontakt";
}
const FO_ANSLUTNING = { kontakt: "Endast kontakt", inbjuden: "Inbjuden", aktiv: "Aktiv", inaktiv: "Inaktiv" };
// Uppmärksamhetssignaler för projekteringsledaren (inga hinder).
function foOrgVarningar(p) {
    const ut = [], inaktiv = (id) => { const x = foPerson(p, id); return !x || x.aktiv === false; };
    const utanAvis = p.discipliner.filter(d => d.aktiv && !(d.avis || []).some(id => !inaktiv(id)));
    if (utanAvis.length) ut.push((utanAvis.length === 1 ? "Disciplinen " + utanAvis[0].kod + " saknar" : utanAvis.length + " discipliner saknar") + " utsedd aviseringsmottagare" +
        (utanAvis.length > 1 ? " (" + utanAvis.map(d => d.kod).join(", ") + ")" : "") + ". Alla i disciplinen aviseras tills någon utses.");
    const fr = p.fragor.filter(f => foAktiv(f) && foMottagare(f).length && foMottagare(f).every(m => m.person && inaktiv(m.person)));
    if (fr.length) ut.push(fr.length + (fr.length === 1 ? " öppen fråga saknar" : " öppna frågor saknar") + " aktiv mottagare (" + fr.slice(0, 5).map(f => f.nr).join(", ") + (fr.length > 5 ? " …" : "") + ").");
    const at = p.atgarder.filter(x => x.status === "oppen" && x.ansvarig && x.ansvarig.person && inaktiv(x.ansvarig.person));
    if (at.length) ut.push(at.length + (at.length === 1 ? " öppen åtgärd är tilldelad" : " öppna åtgärder är tilldelade") + " en person som lämnat projektet.");
    return ut;
}

/* ---------- frågor: läge och urval ---------- */
function foForsenad(f, idag) {
    return !f.makulerad && f.svarSenast && f.svarSenast < (idag || foIdag()) && (f.lage === "obesvarad" || f.lage === "ofullstandig");
}
function foOkvitterade(f) { return f.revs.filter(r => !r.kvitt); }
// Frågeställaren är alltid en namngiven person. Registrerad av (f.av) kan vara någon annan.
function foStallarePerson(f) { return f.stallare || f.av || ""; }
function foStallare(f) { const s = foStallarePerson(f); return s ? { person: s } : (f.fran ? { disc: f.fran } : null); }
function foArStallare(p, personId, f) { return !!personId && foStallarePerson(f) === personId; }
// Superuser: administratör, eller person som fått rollen. Får hantera andras frågor men aldrig ändra historik.
function foSuper(p, personId) { const x = foPerson(p, personId); return !!x && (x.roll === "admin" || !!x.superuser); }
// Frågeställaren eller superuser (klarmarkera, återöppna, begära komplettering, välja slutligt svar).
function foFragaAgare(p, personId, f) { return !personId || foArStallare(p, personId, f) || foSuper(p, personId); }
function foMottagare(f) { return f.mottagare || (f.ansvarig ? [f.ansvarig] : []); }
function foArMottagare(p, personId, f) { return foMottagare(f).some(m => foArPart(p, personId, m)); }
function foArBerord(p, personId, f) { return (f.berordaP || []).includes(personId) || f.berorda.some(d => foPersonDisc(p, personId).includes(d)); }
function foMottagareText(p, f, lang) { return foMottagare(f).map(m => foPartText(p, m, lang)).filter(Boolean).join(", "); }
function foAktiv(f) { return !f.makulerad && f.lage !== "klar"; }
// Dialogen: svar och följdfrågor i tidsordning.
function foSvarPoster(f) { return (f.dialog || []).filter(x => x.typ === "svar"); }
function foSlutliga(f) { return foSvarPoster(f).filter(x => x.slutligt); }
function foHarSvar(f) { return foSvarPoster(f).length > 0; }
function foSenasteSvar(f) { const l = foSvarPoster(f); return l.length ? l[l.length - 1] : null; }
// Det slutliga beskedet (det frågeställaren valt). Tomt innan något valts.
function foSvarText(f) { return foSlutliga(f).map(x => x.text).join("\n\n"); }
// All text i dialogen, för sökning.
function foDialogText(f) { return (f.dialog || []).map(x => x.text).join(" "); }
function foPostLamnat(x) { return x.lamnat || x.av; }
// Har parten (person eller disciplin) lämnat något svar?
function foHarSvarat(p, f, part) { return foSvarPoster(f).some(x => foArPart(p, foPostLamnat(x), part)); }
function foKonsAktiva(f, typ) { return (f.konsekvens || []).filter(k => !k.avskriven && (!typ || k.typ === typ)); }
// Okvitterade revisioner som hindrar klarmarkering: ändrade svar som frågeställaren ska kvittera.
function foOkvittSvar(f) { return f.revs.filter(r => !r.kvitt && r.typ !== "fraga"); }

// Nästa steg i klartext, så att alla ser vem som ska göra vad (UX-005).
function foNastaSteg(p, f) {
    if (f.makulerad) return "Makulerad";
    const ok = foOkvitterade(f);
    if (ok.length) return "Kvitteras av " + (foPartText(p, ok[0].mottagare) || "mottagaren");
    const mt = foMottagareText(p, f);
    if (f.lage === "obesvarad") return mt ? "Svar från " + mt : "Välj vem som ska svara";
    if (f.lage === "ofullstandig") return "Komplettering från " + (mt || "mottagaren");
    if (f.lage === "besvarad") return "Bedöms av frågeställaren " + (foPersonNamn(p, foStallarePerson(f)) || "");
    return "Klar";
}

// Det som väntar på personen (Översikt → Att göra för dig).
function foAttGora(p, personId) {
    const ut = { svara: [], kvittera: [], avsluta: [], atgarder: [] };
    if (!personId) return ut;
    p.fragor.forEach(f => {
        if (f.makulerad) return;
        if ((f.lage === "obesvarad" || f.lage === "ofullstandig") && foArMottagare(p, personId, f)) ut.svara.push(f);
        if (foOkvitterade(f).some(r => foArPart(p, personId, r.mottagare))) ut.kvittera.push(f);
        if (f.lage === "besvarad" && foArStallare(p, personId, f) && !foOkvittSvar(f).length) ut.avsluta.push(f);
    });
    p.atgarder.forEach(a => { if (a.status === "oppen" && foArPart(p, personId, a.ansvarig)) ut.atgarder.push(a); });
    return ut;
}

// Mina frågor: aktiva frågor som jag har ställt, ska besvara eller behöver agera på (kvittera, avsluta).
function foMinFraga(p, personId, f) {
    if (!personId || f.makulerad || f.lage === "klar") return false;
    return foArStallare(p, personId, f) || foArMottagare(p, personId, f) ||
        foOkvitterade(f).some(r => foArPart(p, personId, r.mottagare));
}
// Klar fråga som jag ställt, skulle svara på eller registrerade (visas under Mina frågor → Klara).
function foMinKlar(p, personId, f) {
    if (!personId || f.makulerad || f.lage !== "klar") return false;
    return foArStallare(p, personId, f) || foArMottagare(p, personId, f) || f.av === personId;
}
// Kräver frågan något av mig just nu?
function foMinTur(p, personId, f) {
    if (!personId || f.makulerad) return false;
    return ((f.lage === "obesvarad" || f.lage === "ofullstandig") && foArMottagare(p, personId, f) && !(f.lage === "obesvarad" && foSvarPoster(f).some(x => foPostLamnat(x) === personId))) ||
        foOkvitterade(f).some(r => foArPart(p, personId, r.mottagare)) ||
        (f.lage === "besvarad" && foArStallare(p, personId, f) && !foOkvittSvar(f).length);
}

function foLaget(p, idag) {
    idag = idag || foIdag();
    const aktiva = p.fragor.filter(foAktiv);
    return {
        oppna: aktiva.length,
        vantar: aktiva.filter(f => f.lage === "obesvarad" || f.lage === "ofullstandig").length,
        forsenade: aktiva.filter(f => foForsenad(f, idag)).length,
        kvittera: p.fragor.filter(f => !f.makulerad && foOkvitterade(f).length).length,
        atgOppna: p.atgarder.filter(a => a.status === "oppen").length,
        atgForsenade: p.atgarder.filter(a => a.status === "oppen" && a.senast && a.senast < idag).length,
        beslut: p.beslut.filter(b => b.status === "gallande").length,
        paverkar: aktiva.filter(f => f.paverkar).length,
        klara: p.fragor.filter(f => !f.makulerad && f.lage === "klar").length
    };
}

// Har objektet ändrats sedan personen senast tittade?
function foNytt(p, personId, obj) {
    if (!personId || !obj) return false;
    const sett = (p.sett[personId] || {})[obj.id];
    const andrad = obj.andrad || obj.skapad;
    if (obj.av === personId && !sett) return false;
    return !sett || (andrad && andrad > sett);
}

/* ---------- textversioner: tillägg eller ändring ---------- */
// Är bara text tillagd i slutet är det ett tillägg, annars en ändring i sak (FRG-011).
function foKlassa(gammal, ny) {
    const a = String(gammal || "").replace(/\s+$/, ""), b = String(ny || "").replace(/\s+$/, "");
    if (!a) return "ny";
    if (a === b) return "samma";
    return b.startsWith(a) ? "tillagg" : "andring";
}

/* ---------- jämförelse ord för ord ---------- */
function foDiff(a, b) {
    const A = String(a || "").split(/(\s+)/), B = String(b || "").split(/(\s+)/);
    const n = A.length, m = B.length;
    if (n * m > 250000) return [{ t: "bort", s: a }, { t: "ny", s: b }];
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
        for (let j = m - 1; j >= 0; j--)
            L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const ut = [];
    const lagg = (t, s) => { if (ut.length && ut[ut.length - 1].t === t) ut[ut.length - 1].s += s; else ut.push({ t: t, s: s }); };
    let i = 0, j = 0;
    while (i < n && j < m) {
        if (A[i] === B[j]) { lagg("lika", A[i]); i++; j++; }
        else if (L[i + 1][j] >= L[i][j + 1]) lagg("bort", A[i++]);
        else lagg("ny", B[j++]);
    }
    while (i < n) lagg("bort", A[i++]);
    while (j < m) lagg("ny", B[j++]);
    return ut;
}

/* ======================================================================
   Operationer
   Varje operation får (p, a, ctx) där ctx = { av: personId, tid: ISO }.
   Den returnerar en text för loggen, eller kastar ett Error med ett
   begripligt meddelande om något inte går.
   ====================================================================== */
function foLogg(p, ctx, obj, text) {
    p.logg.push({ id: foId(), tid: ctx.tid, av: ctx.av, obj: obj || "", text: text });
    if (p.logg.length > 600) p.logg.splice(0, p.logg.length - 600);
}
function foHist(o, ctx, text) {
    if (!Array.isArray(o.hist)) o.hist = [];
    o.hist.push({ tid: ctx.tid, av: ctx.av, text: text });
}
function foKrav(v, text) { if (!v) throw new Error(text); }
function foRevNamn(nr) { return "R" + nr; }

const FO_OPS = {
    /* ---------- projekt ---------- */
    projektUppgifter(p, a, ctx) {
        ["namn", "nummer", "bestallare", "entreprenor", "beskrivning", "plId", "start", "slut"].forEach(k => { if (a[k] !== undefined) p[k] = a[k]; });
        foLogg(p, ctx, "", "Projektuppgifterna ändrades");
    },
    installning(p, a, ctx) {
        p.inst[a.nyckel] = a.varde;
        foLogg(p, ctx, "", "Inställningen ändrades: " + a.text);
    },
    sett(p, a, ctx) {
        if (!ctx.av) return;
        const s = p.sett[ctx.av] || (p.sett[ctx.av] = {});
        (a.ids || []).forEach(id => { s[id] = ctx.tid; });
        return null;
    },

    /* ---------- organisation ---------- */
    sparaDisc(p, a, ctx) {
        const kod = String(a.kod || "").trim().toUpperCase();
        foKrav(kod, "Ange en kortkod, till exempel A eller K.");
        foKrav(!p.discipliner.some(d => d.kod === kod && d.id !== a.id), "Kortkoden " + kod + " finns redan i projektet.");
        let d = a.id && foDisc(p, a.id);
        if (!d) { d = { id: a.id || foId(), ordning: p.discipliner.length + 1, aktiv: true }; p.discipliner.push(d); }
        d.kod = kod; d.namn = String(a.namn || "").trim() || kod;
        if (a.aktiv !== undefined) d.aktiv = !!a.aktiv;
        foLogg(p, ctx, "", "Disciplinen " + d.kod + " – " + d.namn + " sparades");
    },
    flyttaDisc(p, a, ctx) {
        const l = p.discipliner.slice().sort((x, y) => x.ordning - y.ordning);
        const i = l.findIndex(d => d.id === a.id), j = i + a.steg;
        if (i < 0 || j < 0 || j >= l.length) return null;
        [l[i], l[j]] = [l[j], l[i]];
        l.forEach((d, k) => { d.ordning = k + 1; });
        return null;
    },
    sparaForetag(p, a, ctx) {
        const namn = String(a.namn || "").trim();
        foKrav(namn, "Ange företagets namn.");
        let f = a.id && foForetag(p, a.id);
        if (!f) { f = { id: a.id || foId(), aktiv: true }; p.foretag.push(f); }
        f.namn = namn; f.orgnr = a.orgnr || ""; f.disc = a.disc || [];
        if (a.aktiv !== undefined) f.aktiv = !!a.aktiv;
        foLogg(p, ctx, "", "Företaget " + namn + " sparades");
    },
    sparaKategori(p, a, ctx) {
        const namn = String(a.namn || "").trim();
        foKrav(namn, "Ange kategorins namn.");
        foKrav(!p.kategorier.some(k => k.id !== a.id && k.namn.toLowerCase() === namn.toLowerCase()), "Det finns redan en kategori som heter " + namn + ".");
        let k = a.id && foKategori(p, a.id);
        const ny = !k;
        if (!k) { k = { id: a.id || foId(), ordning: p.kategorier.reduce((m, x) => Math.max(m, x.ordning), 0) + 1 }; p.kategorier.push(k); }
        const fore = k.namn;
        k.namn = namn;
        foLogg(p, ctx, "", ny ? "Kategorin " + namn + " skapades" : "Kategorin " + fore + " heter nu " + namn);
    },
    flyttaKategori(p, a, ctx) {
        const l = foKategorierSorterade(p), i = l.findIndex(k => k.id === a.id), j = i + (a.steg < 0 ? -1 : 1);
        foKrav(i >= 0, "Kategorin finns inte.");
        if (j < 0 || j >= l.length) return null;
        [l[i], l[j]] = [l[j], l[i]];
        l.forEach((k, n) => { k.ordning = n + 1; });
        return null;
    },
    taBortKategori(p, a, ctx) {
        const k = foKategori(p, a.id);
        foKrav(k, "Kategorin finns inte.");
        p.kategorier = p.kategorier.filter(x => x.id !== a.id);
        p.personer.forEach(x => { x.kategorier = (x.kategorier || []).filter(id => id !== a.id); });
        foLogg(p, ctx, "", "Kategorin " + k.namn + " togs bort");
    },
    sparaPerson(p, a, ctx) {
        foKrav(String(a.fornamn || a.efternamn || a.epost || "").trim(), "Ange namn eller e-post.");
        const ep = String(a.epost || "").trim().toLowerCase();
        foKrav(!ep || !p.personer.some(x => x.epost === ep && x.id !== a.id), "Det finns redan en kontakt med e-posten " + ep + ".");
        let x = a.id && foPerson(p, a.id);
        const ny = !x;
        if (!x) { x = { id: a.id || foId(), aktiv: true, uid: "" }; p.personer.push(x); }
        if (!ny && x.roll === "admin" && a.roll && a.roll !== "admin")
            foKrav(p.personer.some(y => y.id !== x.id && y.roll === "admin" && y.aktiv), "Projektet måste ha minst en administratör.");
        Object.assign(x, {
            fornamn: String(a.fornamn || "").trim(), efternamn: String(a.efternamn || "").trim(), foretagId: a.foretagId || "",
            befattning: String(a.befattning || "").trim(), disc: a.disc || [], epost: ep, tel: String(a.tel || "").trim(),
            roll: a.roll || x.roll || "projektor", extern: !!a.extern,
            kategorier: Array.isArray(a.kategorier) ? a.kategorier.filter(id => foKategori(p, id)) : (x.kategorier || [])
        });
        if (a.uid !== undefined) x.uid = a.uid;
        if (a.aktiv !== undefined) x.aktiv = !!a.aktiv;
        if (a.superuser !== undefined && !!a.superuser !== !!x.superuser) {
            foKrav(!ctx.av || foRoll(p, ctx.av) === "admin", "Bara administratören kan tilldela superuser.");
            x.superuser = !!a.superuser;
            foLogg(p, ctx, "", foPersonNamn(p, x.id) + (x.superuser ? " fick rollen superuser" : " är inte längre superuser"));
        }
        foLogg(p, ctx, "", (ny ? "Kontakten " : "Kontakten ") + foPersonNamn(p, x.id) + (ny ? " lades till" : " ändrades"));
    },
    kopplaKonto(p, a, ctx) {
        const x = foPerson(p, a.id);
        foKrav(x, "Kontakten finns inte.");
        x.uid = a.uid || "";
        return null;
    },
    // Inbjudan: personlig (kopplad till kontaktpostens e-post), tidsbegränsad och återkallbar.
    // Själva åtkomsten styrs av projektets inbjudningslista i molnet (se foBjudIn i fo-org.js).
    bjudIn(p, a, ctx) {
        const x = foPerson(p, a.id);
        foKrav(x, "Kontakten finns inte.");
        foKrav(x.epost, "Ange e-post på kontakten innan du bjuder in.");
        foKrav(x.aktiv !== false, "Kontakten är inaktiverad.");
        x.inbjudan = { tid: ctx.tid, av: ctx.av, utgar: a.utgar, epost: x.epost };
        foLogg(p, ctx, "", foPersonNamn(p, x.id) + " bjöds in till projektet");
    },
    aterkallaInbjudan(p, a, ctx) {
        const x = foPerson(p, a.id);
        foKrav(x && x.inbjudan, "Det finns ingen inbjudan att återkalla.");
        x.inbjudan = null;
        foLogg(p, ctx, "", "Inbjudan till " + foPersonNamn(p, x.id) + " återkallades");
    },
    // Ersätt projektmedlem: överför aktuellt ansvar. Historik och författarskap ändras aldrig.
    ersattPerson(p, a, ctx) {
        const fran = foPerson(p, a.fran), till = foPerson(p, a.till);
        foKrav(fran && till && fran.id !== till.id, "Välj två olika personer.");
        foKrav(till.aktiv !== false, "Den som tar över måste vara aktiv i projektet.");
        const val = a.delar || {}, ar = (part) => part && part.person === fran.id;
        const nyPart = { person: till.id };
        const namnT = foPersonNamn(p, till.id), namnF = foPersonNamn(p, fran.id);
        let n = 0;
        p.fragor.forEach(f => {
            if (!foAktiv(f)) return;
            let andrad = false;
            if (val.stallare && foStallarePerson(f) === fran.id) { f.stallare = till.id; andrad = true; foHist(f, ctx, "Frågeställaransvaret överfört från " + namnF + " till " + namnT); }
            if (val.mottagare && foMottagare(f).some(ar)) {
                f.mottagare = foMottagare(f).map(m => ar(m) ? nyPart : m).filter((m, i, l) => l.findIndex(y => JSON.stringify(y) === JSON.stringify(m)) === i);
                if (ar(f.ansvarig)) f.ansvarig = nyPart;
                andrad = true; foHist(f, ctx, "Svarsansvaret överfört från " + namnF + " till " + namnT);
            }
            if (andrad) { f.andrad = ctx.tid; n++; }
        });
        if (val.atgarder) p.atgarder.forEach(x => {
            if (x.status === "oppen" && ar(x.ansvarig)) { x.ansvarig = nyPart; x.andrad = ctx.tid; foHist(x, ctx, "Ansvaret överfört från " + namnF + " till " + namnT); n++; }
        });
        if (val.avis) p.discipliner.forEach(d => {
            if ((d.avis || []).includes(fran.id)) { d.avis = d.avis.filter(id => id !== fran.id); if (!d.avis.includes(till.id)) d.avis.push(till.id); n++; }
        });
        if (val.disc) (fran.disc || []).forEach(d => { if (!(till.disc || []).includes(d)) { till.disc = (till.disc || []).concat(d); n++; } });
        foLogg(p, ctx, "", "Ansvar överfört från " + namnF + " till " + namnT + " (" + n + " poster)");
        return n;
    },
    sparaIndelning(p, a, ctx) {
        const namn = String(a.namn || "").trim();
        foKrav(namn, "Ange indelningstypens namn, till exempel Byggnad.");
        let ind = a.id && p.indelningar.find(x => x.id === a.id);
        if (!ind) { ind = { id: a.id || foId(), varden: [] }; p.indelningar.push(ind); }
        ind.namn = namn;
        (a.varden || []).forEach(v => {
            const vn = String(v.namn || "").trim();
            if (!vn) return;
            const finns = ind.varden.find(x => x.id === v.id);
            if (finns) { finns.namn = vn; if (v.aktiv !== undefined) finns.aktiv = !!v.aktiv; }
            else ind.varden.push({ id: v.id || foId(), namn: vn, aktiv: true });
        });
        foLogg(p, ctx, "", "Indelningen " + namn + " sparades");
    },
    sparaForum(p, a, ctx) {
        const namn = String(a.namn || "").trim();
        foKrav(namn, "Ange mötesforumets namn, till exempel Projekteringsmöte.");
        let f = a.id && foForum(p, a.id);
        if (!f) { f = { id: a.id || foId(), aktiv: true, nastaMote: "" }; p.forum.push(f); }
        // Fri mappstruktur: forelder pekar på en annan mapp. valbar = kan väljas som mötesforum på frågor.
        let forelder = a.forelder !== undefined ? a.forelder || "" : f.forelder || "";
        for (let x = forelder, n = 0; x && n < 50; n++) { foKrav(x !== f.id, "En mapp kan inte ligga i sig själv."); x = (foForum(p, x) || {}).forelder; }
        Object.assign(f, { namn: namn, kort: String(a.kort || "").trim().toUpperCase() || namn.slice(0, 2).toUpperCase(),
            plats: a.plats || "", tid: a.tid || "", ledare: a.ledare || "", sekreterare: a.sekreterare || "", deltagare: a.deltagare || [],
            forelder: forelder, valbar: a.valbar !== undefined ? !!a.valbar : f.valbar !== false });
        if (a.bevakning !== undefined) f.bevakning = a.bevakning ? { pa: !!a.bevakning.pa, dagar: Math.max(1, +a.bevakning.dagar || 14), marginal: Math.max(0, +a.bevakning.marginal || 3),
            ansvarig: a.bevakning.ansvarig || "", pausTill: a.bevakning.pausTill || "" } : null;
        if (a.nastaMote !== undefined) f.nastaMote = a.nastaMote;
        if (a.aktiv !== undefined) f.aktiv = !!a.aktiv;
        foLogg(p, ctx, "", "Mötesforumet " + namn + " sparades");
    },

    // Protokoll: Forma är protokollcentral men lagrar inte filen än (dokumentmotorn är pausad).
    // Protokollet registreras med mötesnummer, datum, status och en länk till var filen ligger (Teams, SharePoint …).
    registreraProtokoll(p, a, ctx) {
        const fo = foForum(p, a.forum);
        foKrav(fo, "Välj mötesforum.");
        if (!Array.isArray(p.protokoll)) p.protokoll = [];
        let x = a.id && p.protokoll.find(y => y.id === a.id);
        const ny = !x;
        if (ny) { x = { id: a.id || foId(), forum: fo.id, skapad: ctx.tid, av: ctx.av, hist: [], kopplingar: [], version: 1 }; p.protokoll.push(x); }
        else if (a.lank !== undefined && a.lank !== x.lank) x.version = (x.version || 1) + 1;
        // Uppladdad protokollfil (PDF m.m.). Äldre klienter skickar inga bilagor: då behålls de som finns.
        let filText = "";
        if (Array.isArray(a.bilagor)) {
            const fore = (x.bilagor || []).map(b => b.id);
            const nya = a.bilagor.filter(b => b && b.id && b.namn).map(b => ({ id: b.id, namn: String(b.namn), typ: b.typ || "", storlek: +b.storlek || 0, tid: b.tid || ctx.tid }));
            const tillagda = nya.filter(b => !fore.includes(b.id)), borttagna = fore.filter(id => !nya.some(b => b.id === id));
            if (!ny && tillagda.length) x.version = (x.version || 1) + 1;
            if (tillagda.length) filText += " · fil: " + tillagda.map(b => b.namn).join(", ");
            if (borttagna.length) filText += " · " + borttagna.length + (borttagna.length === 1 ? " fil borttagen" : " filer borttagna");
            x.bilagor = nya;
        }
        Object.assign(x, { forum: fo.id, nr: String(a.nr || "").trim(), datum: a.datum || foDag(ctx.tid), lank: String(a.lank || "").trim(), status: a.status === "utkast" ? "utkast" : "slutligt",
            forare: a.forare || "", extra: !!a.extra, sammanstallning: a.sammanstallning !== undefined ? a.sammanstallning : x.sammanstallning || "", andrad: ctx.tid });
        foKrav(x.nr || x.datum, "Ange mötesnummer eller datum.");
        foHist(x, ctx, (ny ? "Protokoll registrerat" : "Protokollet ändrat" + (x.version > 1 ? " (version " + x.version + ")" : "")) + filText);
        foLogg(p, ctx, x.id, fo.namn + (x.nr ? " " + x.nr : "") + ": protokoll " + (ny ? "registrerat" : "ändrat"));
        return x;
    },
    taBortProtokoll(p, a, ctx) {
        const x = (p.protokoll || []).find(y => y.id === a.id);
        foKrav(x, "Protokollet finns inte.");
        foKrav(String(a.orsak || "").trim(), "Ange varför.");
        x.makulerad = { orsak: a.orsak.trim(), tid: ctx.tid, av: ctx.av };
        foHist(x, ctx, "Borttaget: " + a.orsak.trim());
        foLogg(p, ctx, x.id, "Protokoll borttaget");
    },
    /* ---------- projektflödet ---------- */
    // Inlägg för löpande information. Fästa inlägg ligger överst; kommentarerna är platta (ingen chatt i trådar).
    nyttInlagg(p, a, ctx) {
        const text = String(a.text || "").trim();
        const bilagor = Array.isArray(a.bilagor) ? a.bilagor : [];
        foKrav(text || bilagor.length, "Skriv något eller bifoga en fil.");
        const x = { id: a.id, tid: ctx.tid, skapad: ctx.tid, andrad: ctx.tid, av: ctx.av, text: text.slice(0, 8000), bilagor,
            personer: (a.personer || []).filter(id => foPerson(p, id)), disc: (a.disc || []).filter(id => foDisc(p, id)),
            lankar: (a.lankar || []).filter(l => foObj(p, l)).map(l => ({ typ: l.typ, id: l.id })),
            fast: false, gillar: [], kommentarer: [], kopplingar: [] };
        p.flode.push(x);
        foLogg(p, ctx, x.id, (foPersonNamn(p, ctx.av) || "Någon") + " publicerade i projektflödet");
        return x;
    },
    redigeraInlagg(p, a, ctx) {
        const x = foInlagg(p, a.id);
        foKrav(x, "Inlägget finns inte.");
        foKrav(x.av === ctx.av, "Bara den som skrev inlägget kan ändra det.");
        const text = String(a.text || "").trim();
        foKrav(text || x.bilagor.length, "Inlägget kan inte vara tomt.");
        x.text = text.slice(0, 8000);
        x.redigerad = ctx.tid;
        x.andrad = ctx.tid;
    },
    taBortInlagg(p, a, ctx) {
        const x = foInlagg(p, a.id);
        if (!x) return null;
        foKrav(x.av === ctx.av || foKanLeda(p, ctx.av), "Bara den som skrev inlägget eller en projekteringsledare kan ta bort det.");
        p.flode = p.flode.filter(y => y.id !== a.id);
        // kopplingar från frågor, åtgärder och beslut till inlägget tas bort
        [p.fragor, p.atgarder, p.beslut].forEach(l => l.forEach(o => { if (Array.isArray(o.kopplingar)) o.kopplingar = o.kopplingar.filter(k => !(k.typ === "inlagg" && k.id === a.id)); }));
        foLogg(p, ctx, "", "Ett inlägg i projektflödet togs bort");
    },
    fastInlagg(p, a, ctx) {
        const x = foInlagg(p, a.id);
        foKrav(x, "Inlägget finns inte.");
        foKrav(x.av === ctx.av || foKanLeda(p, ctx.av), "Bara den som skrev inlägget eller en projekteringsledare kan fästa det.");
        if (!!x.fast === !!a.pa) return null;
        x.fast = !!a.pa;
        x.fastAv = a.pa ? ctx.av : "";
        foLogg(p, ctx, x.id, a.pa ? "Ett inlägg fästes överst i projektflödet" : "Ett inlägg lossades i projektflödet");
    },
    gillaInlagg(p, a, ctx) {
        const x = foInlagg(p, a.id);
        if (!x || !ctx.av) return null;
        const har = x.gillar.includes(ctx.av);
        if (har === !!a.pa) return null;
        x.gillar = a.pa ? x.gillar.concat([ctx.av]) : x.gillar.filter(id => id !== ctx.av);
    },
    kommentera(p, a, ctx) {
        const x = foInlagg(p, a.id);
        foKrav(x, "Inlägget finns inte.");
        const text = String(a.text || "").trim();
        foKrav(text, "Skriv en kommentar.");
        if (x.kommentarer.some(k => k.id === a.kid)) return null;
        x.kommentarer.push({ id: a.kid, tid: ctx.tid, av: ctx.av, text: text.slice(0, 4000) });
        x.andrad = ctx.tid;
    },
    taBortKommentar(p, a, ctx) {
        const x = foInlagg(p, a.id);
        const k = x && x.kommentarer.find(y => y.id === a.kid);
        if (!k) return null;
        foKrav(k.av === ctx.av || foKanLeda(p, ctx.av), "Bara den som skrev kommentaren eller en projekteringsledare kan ta bort den.");
        x.kommentarer = x.kommentarer.filter(y => y.id !== a.kid);
    },

    /* ---------- frågor ---------- */
    nyFraga(p, a, ctx) {
        const text = String(a.text || "").trim();
        foKrav(text, "Skriv frågan.");
        // Numret är permanent och återanvänds aldrig, även om frågan makuleras (FRG-002).
        const hogst = p.fragor.reduce((m, f) => Math.max(m, f.nr), 0);
        p.seq.fraga = Math.max(p.seq.fraga, hogst) + 1;
        // Frågeställaren är en namngiven person, normalt den som registrerar. Registrerad av sätts alltid automatiskt.
        const stallare = a.stallare && foPerson(p, a.stallare) ? a.stallare : ctx.av;
        const mottagare = Array.isArray(a.mottagare) ? a.mottagare.filter(Boolean) : (a.ansvarig ? [a.ansvarig] : []);
        const fran = a.fran !== undefined ? a.fran : (foPersonDisc(p, stallare)[0] || "");
        const f = {
            id: a.id, nr: p.seq.fraga, skapad: ctx.tid, andrad: ctx.tid, av: ctx.av, stallare: stallare, text: text,
            textVer: [{ text: text, tid: ctx.tid, av: ctx.av, typ: "ny" }],
            fran: fran || "", mottagare: mottagare, ansvarig: null, berorda: a.berorda || [], berordaP: a.berordaP || [], indelning: a.indelning || [],
            svarSenast: a.svarSenast || "", lage: "obesvarad", moten: a.moten || [], behandlad: {},
            svar: null, dialog: [], revs: [], konsekvens: [], paverkar: false, kopplingar: [], bilagor: a.bilagor || [], makulerad: null, hist: []
        };
        const kons = (a.konsekvens || []).concat(a.paverkar ? ["tid", "kostnad"] : []);
        kons.forEach(t => { if (FO_KONS[t] && !f.konsekvens.some(k => k.typ === t)) f.konsekvens.push({ id: "k-" + t + "-" + f.id, typ: t, av: ctx.av, tid: ctx.tid, kommentar: "", avskriven: null }); });
        foSynkFraga(f);
        foHist(f, ctx, "Frågan registrerades" + (stallare !== ctx.av ? " för " + (foPersonNamn(p, stallare) || "frågeställaren") + " av " + (foPersonNamn(p, ctx.av) || "–") : ""));
        f.konsekvens.forEach(k => foHist(f, ctx, FO_KONS[k.typ] + " markerad"));
        p.fragor.push(f);
        foLogg(p, ctx, f.id, "Fråga " + f.nr + " registrerades");
        return f;
    },
    fragaFalt(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        const agare = foFragaAgare(p, ctx.av, f) || f.av === ctx.av || foKanLeda(p, ctx.av);
        const andr = [];
        if (a.stallare !== undefined && a.stallare !== foStallarePerson(f)) {
            foKrav(!ctx.av || foArStallare(p, ctx.av, f) || foSuper(p, ctx.av), "Bara frågeställaren eller en superuser kan överföra frågan.");
            foKrav(foPerson(p, a.stallare), "Välj en projektmedlem som frågeställare.");
            andr.push("Frågeställare: " + (foPersonNamn(p, foStallarePerson(f)) || "–") + " → " + foPersonNamn(p, a.stallare));
            f.stallare = a.stallare;
        }
        if (a.fran !== undefined && a.fran !== f.fran) { f.fran = a.fran; andr.push("Från: " + (foDiscText(p, a.fran) || "–")); }
        if (a.ansvarig !== undefined && a.mottagare === undefined) a.mottagare = a.ansvarig ? [a.ansvarig] : [];
        if (a.mottagare !== undefined && JSON.stringify(a.mottagare) !== JSON.stringify(f.mottagare)) {
            foKrav(agare, "Bara frågeställaren, den som registrerade frågan, projekteringsledare eller superuser kan ändra mottagare.");
            f.mottagare = a.mottagare.filter(Boolean);
            andr.push("Ska svara: " + (foMottagareText(p, f) || "–"));
        }
        if (a.svarSenast !== undefined && a.svarSenast !== f.svarSenast) { f.svarSenast = a.svarSenast; andr.push("Svar senast: " + (a.svarSenast || "–")); }
        if (a.berorda !== undefined && JSON.stringify(a.berorda) !== JSON.stringify(f.berorda)) { f.berorda = a.berorda; andr.push("Berörda discipliner: " + (a.berorda.map(id => foDiscText(p, id)).join(", ") || "–")); }
        if (a.berordaP !== undefined && JSON.stringify(a.berordaP) !== JSON.stringify(f.berordaP)) { f.berordaP = a.berordaP; andr.push("Berörda personer: " + (a.berordaP.map(id => foPersonNamn(p, id)).join(", ") || "–")); }
        if (a.indelning !== undefined && JSON.stringify(a.indelning) !== JSON.stringify(f.indelning)) { f.indelning = a.indelning; andr.push("Plats: " + (a.indelning.map(id => (foVarde(p, id) || { varde: { namn: "?" } }).varde.namn).join(", ") || "–")); }
        // Äldre klienter skickar paverkar: blir båda markeringarna.
        if (a.paverkar !== undefined && !!a.paverkar !== f.paverkar) {
            if (a.paverkar) ["tid", "kostnad"].forEach(t => { if (!foKonsAktiva(f, t).length) f.konsekvens.push({ id: foId(), typ: t, av: ctx.av, tid: ctx.tid, kommentar: "", avskriven: null }); });
            else foKonsAktiva(f).forEach(k => { k.avskriven = { av: ctx.av, tid: ctx.tid, orsak: "Markeringen togs bort" }; });
            andr.push(a.paverkar ? "Markerad: kan påverka tid och kostnad" : "Markeringarna tid/kostnad avskrevs");
        }
        if (!andr.length) return null;
        foSynkFraga(f);
        f.andrad = ctx.tid;
        andr.forEach(t => foHist(f, ctx, t));
        foLogg(p, ctx, f.id, "Fråga " + f.nr + ": " + andr.join(" · "));
    },
    motesmarkering(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        const fo = foForum(p, a.forum);
        foKrav(fo, "Mötesforumet finns inte.");
        const pa = a.pa === undefined ? !f.moten.includes(a.forum) : !!a.pa;
        if (pa === f.moten.includes(a.forum)) return null;
        f.moten = f.moten.filter(x => x !== a.forum);
        if (pa) f.moten.push(a.forum);
        f.andrad = ctx.tid;
        foHist(f, ctx, (pa ? "Markerad för " : "Avmarkerad för ") + fo.namn);
        foLogg(p, ctx, f.id, "Fråga " + f.nr + (pa ? " markerad för " : " avmarkerad för ") + fo.namn);
    },
    behandlad(p, a, ctx) {
        const f = foFraga(p, a.id), fo = foForum(p, a.forum);
        foKrav(f && fo, "Frågan eller forumet finns inte.");
        f.behandlad[a.forum] = a.datum || foDag(ctx.tid);
        f.moten = f.moten.filter(x => x !== a.forum);
        f.andrad = ctx.tid;
        foHist(f, ctx, "Behandlad på " + fo.namn + " " + f.behandlad[a.forum]);
        foLogg(p, ctx, f.id, "Fråga " + f.nr + " behandlad på " + fo.namn);
    },
    // Frågetexten. satt: rattelse (stavfel, ingen kvittering), tillagg (komplettering) eller revidering (ändring i sak, med orsak).
    // Äldre klienter skickar bara text; då avgörs det som tidigare (tillägg eller ändring).
    fragaText(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        foKrav(!ctx.av || f.av === ctx.av || foArStallare(p, ctx.av, f) || foSuper(p, ctx.av) || foKanLeda(p, ctx.av), "Bara frågeställaren, den som registrerade frågan eller en superuser kan ändra frågan.");
        const ny = String(a.text || "").trim();
        foKrav(ny, "Frågan kan inte vara tom.");
        const klass = foKlassa(f.text, ny);
        if (klass === "samma") return null;
        const satt = a.satt || (klass === "tillagg" ? "tillagg" : "revidering");
        const orsak = String(a.orsak || "").trim();
        if (satt === "revidering" && a.satt) foKrav(orsak, "Ange varför frågan revideras.");
        const typ = satt === "rattelse" ? "rattelse" : satt === "tillagg" ? "tillagg" : "andring";
        f.textVer.push({ text: ny, tid: ctx.tid, av: ctx.av, typ: typ, orsak: orsak });
        f.text = ny;
        f.andrad = ctx.tid;
        if (typ !== "rattelse") foMottagare(f).forEach(m => foNyRev(p, f, ctx, "fraga", typ, m, false, "", orsak));
        let extra = "";
        // En revidering i sak gör att tidigare svar och klarmarkering inte längre gäller utan ny bedömning.
        if (typ === "andring" && foHarSvar(f) && (f.lage === "besvarad" || f.lage === "klar")) {
            const varKlar = f.lage === "klar";
            foSlutliga(f).forEach(x => { x.slutligt = false; });
            f.lage = "ofullstandig";
            extra = varKlar ? " – frågan återöppnades och tidigare svar behöver bedömas mot den nya frågan" : " – tidigare svar behöver bedömas mot den nya frågan";
        }
        foHist(f, ctx, ({ rattelse: "Rättelse i frågan", tillagg: "Komplettering av frågan", andring: "Frågan reviderades" })[typ] + (orsak ? ": " + orsak : "") + extra);
        foLogg(p, ctx, f.id, "Fråga " + f.nr + ": " + ({ rattelse: "rättelse i frågan", tillagg: "komplettering av frågan", andring: "frågan reviderades" })[typ]);
    },
    // Nytt inlägg i dialogen: svar (även flera, från flera) eller följdfråga.
    // lamnat = den som lämnat beskedet, om det registreras på uppdrag (t.ex. ett muntligt besked).
    dialogPost(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        foKrav(!f.makulerad, "Frågan är makulerad.");
        const text = String(a.text || "").trim();
        const typ = a.typ === "foljd" ? "foljd" : "svar";
        foKrav(text, typ === "svar" ? "Skriv svaret." : "Skriv följdfrågan.");
        foKrav(!(f.dialog || []).some(x => x.id === a.post), "Inlägget finns redan.");
        const lamnat = a.lamnat && foPerson(p, a.lamnat) ? a.lamnat : ctx.av;
        const x = { id: a.post || foId(), typ: typ, tid: ctx.tid, av: ctx.av, lamnat: lamnat, text: text,
            ver: [{ text: text, tid: ctx.tid, av: ctx.av, typ: "ny" }], slutligt: false };
        // Svar eller besked lämnat på ett möte (frivilligt): forum och mötesdatum sparas i historiken.
        const mfo = a.mote && foForum(p, a.mote.forum);
        if (mfo) x.mote = { forum: mfo.id, datum: a.mote.datum || foDag(ctx.tid) };
        // Skickas även till (frivilligt): personer eller discipliner utöver de vanliga mottagarna.
        const till = (Array.isArray(a.till) ? a.till : []).filter(t => t && ((t.person && foPerson(p, t.person)) || (t.disc && foDisc(p, t.disc))))
            .map(t => t.person ? { person: t.person } : { disc: t.disc })
            .filter((t, i, l) => l.findIndex(u => (u.person || u.disc) === (t.person || t.disc)) === i);
        if (till.length) x.till = till;
        f.dialog.push(x);
        (a.bilagor || []).forEach(b => f.bilagor.push(Object.assign({}, b, { del: "d:" + x.id })));
        const fore = f.lage, pa = lamnat !== ctx.av ? " (lämnat av " + (foPersonNamn(p, lamnat) || "–") + ", registrerat av " + (foPersonNamn(p, ctx.av) || "–") + ")" : "";
        if (typ === "svar") {
            if (f.lage !== "besvarad") f.lage = "besvarad";
            foHist(f, ctx, "Svar lämnat" + (x.mote ? " på " + mfo.namn + " " + x.mote.datum : "") + pa + (fore === "klar" ? " – frågan återöppnades för ny bedömning" : ""));
        } else {
            if (foArStallare(p, lamnat, f) && (f.lage === "besvarad" || f.lage === "klar")) f.lage = "ofullstandig";
            foHist(f, ctx, "Följdfråga" + pa + (fore === "klar" && f.lage !== "klar" ? " – frågan återöppnades" : ""));
            // En följdfråga till fler: de nya blir mottagare (ska svara), om man får ändra mottagare.
            const agare = foFragaAgare(p, ctx.av, f) || f.av === ctx.av || foKanLeda(p, ctx.av);
            const nyaMott = agare ? till.filter(t => !foMottagare(f).some(m => (m.person || m.disc) === (t.person || t.disc))) : [];
            if (nyaMott.length) {
                f.mottagare = foMottagare(f).concat(nyaMott);
                foSynkFraga(f);
                foHist(f, ctx, "Ska svara: " + (foMottagareText(p, f) || "–"));
            }
        }
        if (till.length) foHist(f, ctx, (typ === "svar" ? "Svaret" : "Följdfrågan") + " skickades även till " + till.map(t => foPartText(p, t)).filter(Boolean).join(", "));
        f.andrad = ctx.tid;
        foLogg(p, ctx, f.id, "Fråga " + f.nr + ": " + (typ === "svar" ? "svar lämnat" : "följdfråga"));
        return x;
    },
    // Ändring av ett inlägg i dialogen. Tidigare versioner bevaras alltid.
    // rattelse: stavfel o.d. tillagg: komplettering. revidering: ändrat besked (orsak krävs).
    dialogAndra(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        const x = (f.dialog || []).find(d => d.id === a.post);
        foKrav(x, "Inlägget finns inte.");
        foKrav(!ctx.av || x.av === ctx.av || foSuper(p, ctx.av), "Bara den som skrev inlägget kan ändra det.");
        const ny = String(a.text || "").trim();
        foKrav(ny, "Texten kan inte vara tom.");
        if (ny === x.text) return null;
        const satt = ["rattelse", "tillagg", "revidering"].includes(a.satt) ? a.satt : (foKlassa(x.text, ny) === "tillagg" ? "tillagg" : "revidering");
        const orsak = String(a.orsak || "").trim();
        if (satt === "revidering" && a.satt) foKrav(orsak, "Ange varför beskedet ändras.");
        const typ = satt === "rattelse" ? "rattelse" : satt === "tillagg" ? "tillagg" : "andring";
        x.ver.push({ text: ny, tid: ctx.tid, av: ctx.av, typ: typ, orsak: orsak });
        x.text = ny;
        (a.bilagor || []).forEach(b => f.bilagor.push(Object.assign({}, b, { del: "d:" + x.id, ver: x.ver.length })));
        let extra = "";
        if (x.typ === "svar" && typ !== "rattelse") {
            foNyRev(p, f, ctx, "svar", typ, foStallare(f), f.lage === "klar", x.id, orsak);
            // Antingen är frågan klar eller inte: ändras det slutliga beskedet återöppnas frågan.
            if (f.lage === "klar" && x.slutligt) { f.lage = "besvarad"; extra = " – frågan återöppnades för ny bedömning"; }
        }
        f.andrad = ctx.tid;
        foHist(f, ctx, ({ rattelse: "Rättelse i ", tillagg: "Komplettering av ", andring: "Reviderat " })[typ] + (x.typ === "svar" ? "svar" : "följdfråga") +
            " från " + (foPersonNamn(p, foPostLamnat(x)) || "–") + (orsak ? ": " + orsak : "") + extra);
        foLogg(p, ctx, f.id, "Fråga " + f.nr + ": " + ({ rattelse: "rättelse", tillagg: "komplettering", andring: "reviderat besked" })[typ]);
    },
    // Äldre klienter: ett svarsfält. Samma person som skriver vidare på sitt senaste svar ger ett tillägg, annars ett nytt svar.
    svara(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        const ny = String(a.text || "").trim();
        foKrav(ny, "Skriv svaret.");
        const egen = foSvarPoster(f).filter(x => x.av === ctx.av).pop();
        if (egen && ny !== egen.text && ny.startsWith(egen.text.replace(/\s+$/, "")))
            return FO_OPS.dialogAndra(p, { id: f.id, post: egen.id, text: ny, satt: "tillagg", bilagor: a.bilagor }, ctx);
        if (egen && ny === egen.text) return null;
        FO_OPS.dialogPost(p, { id: f.id, post: a.post, typ: "svar", text: ny, bilagor: a.bilagor }, ctx);
    },
    // Frågeställaren väljer vilket eller vilka svar som tillsammans är det slutliga beskedet.
    slutligtSvar(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        foKrav(foFragaAgare(p, ctx.av, f), "Bara frågeställaren eller en superuser väljer det slutliga svaret.");
        const x = foSvarPoster(f).find(d => d.id === a.post);
        foKrav(x, "Svaret finns inte.");
        const pa = a.pa === undefined ? !x.slutligt : !!a.pa;
        if (pa === !!x.slutligt) return null;
        x.slutligt = pa;
        f.andrad = ctx.tid;
        foHist(f, ctx, (pa ? "Valt som slutligt svar: " : "Inte längre slutligt svar: ") + "svaret från " + (foPersonNamn(p, foPostLamnat(x)) || "–") + " " + foDag(x.tid));
        foLogg(p, ctx, f.id, "Fråga " + f.nr + ": slutligt svar " + (pa ? "valt" : "ändrat"));
    },
    // Läget. Bara frågeställaren (eller superuser) bedömer svaret: klar, ofullständigt eller återöppna.
    sattLage(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        foKrav(FO_LAGE[a.lage], "Okänt läge.");
        if (f.lage === a.lage) return null;
        foKrav(foFragaAgare(p, ctx.av, f), "Det är frågeställaren som bedömer svaret. Be " + (foPersonNamn(p, foStallarePerson(f)) || "frågeställaren") + " eller en superuser.");
        const fore = f.lage;
        const extra = [];
        if (a.lage === "klar") {
            foKrav(!foOkvittSvar(f).length, "Kvittera de ändrade svaren innan frågan klarmarkeras.");
            foKrav(foHarSvar(f), "Frågan har inget svar ännu.");
            if (Array.isArray(a.slutliga)) foSvarPoster(f).forEach(x => { x.slutligt = a.slutliga.includes(x.id); });
            if (!foSlutliga(f).length) {
                const sv = foSvarPoster(f);
                foKrav(sv.length === 1, "Välj vilket eller vilka svar som är det slutliga beskedet.");
                sv[0].slutligt = true;
            }
            extra.push("slutligt svar: " + foSlutliga(f).map(x => foPersonNamn(p, foPostLamnat(x)) || "–").join(", "));
            if (foKonsAktiva(f).length) {
                foKrav(a.bekraftaKonsekvens, FO_KONS_BEKRAFTA);
                extra.push("bekräftat att konsekvenser för " + [...new Set(foKonsAktiva(f).map(k => k.typ === "tid" ? "tid" : "kostnad"))].join(" och ") + " har kommunicerats och hanterats");
            }
        }
        if (a.lage === "besvarad") foKrav(fore === "klar" || fore === "ofullstandig", "Frågan blir Besvarad när ett svar lämnas.");
        if (a.lage === "obesvarad") foKrav(false, "Frågan blir Obesvarad bara när den skapas.");
        f.lage = a.lage;
        f.andrad = ctx.tid;
        const t = a.lage === "klar" ? "Frågan klarmarkerades" : fore === "klar" ? "Frågan återöppnades" :
            a.lage === "ofullstandig" ? "Svaret markerades som ofullständigt" : "Läget ändrades till " + FO_LAGE[a.lage].namn;
        const vem = ctx.av && !foArStallare(p, ctx.av, f) ? " (av superuser " + foPersonNamn(p, ctx.av) + ")" : "";
        foHist(f, ctx, t + vem + (extra.length ? " – " + extra.join("; ") : "") + (a.kommentar ? ": " + a.kommentar : ""));
        foLogg(p, ctx, f.id, "Fråga " + f.nr + ": " + t.charAt(0).toLowerCase() + t.slice(1));
    },
    // Risk för tid- eller kostnadspåverkan. Alla projektmedlemmar kan markera, flera kan bidra. Avskrivna finns kvar i historiken.
    konsekvensMarkera(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        foKrav(FO_KONS[a.typ], "Okänd markering.");
        foKrav(!ctx.av || foPerson(p, ctx.av), "Bara projektmedlemmar kan markera.");
        if (f.konsekvens.some(k => !k.avskriven && k.typ === a.typ && k.av === ctx.av)) return null;
        const k = { id: a.kid || foId(), typ: a.typ, av: ctx.av, tid: ctx.tid, kommentar: String(a.kommentar || "").trim(), avskriven: null };
        f.konsekvens.push(k);
        foSynkFraga(f);
        f.andrad = ctx.tid;
        foHist(f, ctx, FO_KONS[a.typ] + " markerad" + (k.kommentar ? ": " + k.kommentar : ""));
        foLogg(p, ctx, f.id, "Fråga " + f.nr + ": " + FO_KONS[a.typ].toLowerCase() + " markerad");
        return k;
    },
    konsekvensAvskriv(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        const k = f.konsekvens.find(x => x.id === a.kid);
        foKrav(k, "Markeringen finns inte.");
        if (k.avskriven) return null;
        foKrav(!ctx.av || k.av === ctx.av || foArStallare(p, ctx.av, f) || foSuper(p, ctx.av), "Bara den som markerade, frågeställaren eller en superuser kan skriva av markeringen.");
        const orsak = String(a.orsak || "").trim();
        foKrav(orsak, "Ange varför risken skrivs av.");
        k.avskriven = { av: ctx.av, tid: ctx.tid, orsak: orsak };
        foSynkFraga(f);
        f.andrad = ctx.tid;
        foHist(f, ctx, FO_KONS[k.typ] + " (markerad av " + (foPersonNamn(p, k.av) || "–") + ") avskriven: " + orsak);
        foLogg(p, ctx, f.id, "Fråga " + f.nr + ": " + FO_KONS[k.typ].toLowerCase() + " avskriven");
    },
    kvittera(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        const r = f.revs.find(x => x.id === a.rev);
        foKrav(r, "Revisionen finns inte.");
        if (r.kvitt) return null;
        r.kvitt = { av: ctx.av, tid: ctx.tid };
        f.andrad = ctx.tid;
        foHist(f, ctx, foRevNamn(r.nr) + " kvitterad (" + FO_REVTYP[r.typ].toLowerCase() + ")");
        foLogg(p, ctx, f.id, "Fråga " + f.nr + ": " + foRevNamn(r.nr) + " kvitterad");
    },
    bilagor(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        (a.bilagor || []).forEach(b => f.bilagor.push(Object.assign({ del: a.del || "fraga" }, b)));
        f.andrad = ctx.tid;
        foHist(f, ctx, (a.bilagor.length === 1 ? "Bilaga tillagd: " : a.bilagor.length + " bilagor tillagda: ") + a.bilagor.map(b => b.namn).join(", "));
        foLogg(p, ctx, f.id, "Fråga " + f.nr + ": bilaga tillagd");
    },
    makuleraFraga(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        foKrav(foFragaAgare(p, ctx.av, f) || f.av === ctx.av || foKanLeda(p, ctx.av), "Bara frågeställaren, den som registrerade frågan, projekteringsledare eller superuser kan makulera frågan.");
        foKrav(String(a.orsak || "").trim(), "Ange varför frågan makuleras.");
        f.makulerad = { orsak: a.orsak.trim(), tid: ctx.tid, av: ctx.av, lage: f.lage };
        f.andrad = ctx.tid;
        foHist(f, ctx, "Makulerad: " + a.orsak.trim());
        foLogg(p, ctx, f.id, "Fråga " + f.nr + " makulerades");
    },
    aterstallFraga(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f && f.makulerad, "Frågan är inte makulerad.");
        foKrav(foFragaAgare(p, ctx.av, f) || f.av === ctx.av || foKanLeda(p, ctx.av), "Bara frågeställaren, den som registrerade frågan, projekteringsledare eller superuser kan återställa frågan.");
        f.makulerad = null;
        f.andrad = ctx.tid;
        foHist(f, ctx, "Återställd från makulerad");
        foLogg(p, ctx, f.id, "Fråga " + f.nr + " återställdes");
    },
    // Inkludera i beslutsloggen: disciplinvis selektering. Ingen ny text, beslutsfattare eller motivering krävs.
    // Selekteringen är inte ett formellt beslut.
    beslutslogg(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        foKrav(foKanLoggaFraga(p, ctx.av, f), "Det är disciplinen som ställt eller besvarar frågan som väljer den till beslutsloggen.");
        if (!!a.pa === !!(f.ilogg && f.ilogg.pa)) return null;
        f.ilogg = a.pa ? { pa: true, av: ctx.av, tid: ctx.tid } : null;
        foHist(f, ctx, a.pa ? "Inkluderad i beslutsloggen" : "Borttagen från beslutsloggen");
        foLogg(p, ctx, f.id, "Fråga " + f.nr + (a.pa ? " inkluderad i" : " borttagen från") + " beslutsloggen");
    },
    // Stjärnmärkta frågor sparas alltid, även när projektet rensas för att rymmas i molnet.
    stjarna(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        f.stjarna = !!a.pa;
        foHist(f, ctx, a.pa ? "Stjärnmärkt (sparas alltid)" : "Stjärnmärkning borttagen");
    },
    // Tar bort gamla avslutade frågor (klara eller makulerade, utan stjärna) när projektet närmar sig molnets gräns.
    // Numret återanvänds aldrig, och en kort rad om varje rensad fråga finns kvar i p.rensade.
    rensaFragor(p, a, ctx) {
        const ids = (a.ids || []).filter(id => { const f = foFraga(p, id); return f && !f.stjarna && !foAktiv(f); });
        if (!ids.length) return null;
        if (!Array.isArray(p.rensade)) p.rensade = [];
        ids.forEach(id => { const f = foFraga(p, id); p.rensade.push({ id: f.id, nr: f.nr, text: f.text.slice(0, 80), tid: ctx.tid }); });
        p.fragor = p.fragor.filter(f => !ids.includes(f.id));
        [p.atgarder, p.beslut, p.flode || []].forEach(l => l.forEach(o => { if (Array.isArray(o.kopplingar)) o.kopplingar = o.kopplingar.filter(k => !(k.typ === "fraga" && ids.includes(k.id))); }));
        foLogg(p, ctx, "", ids.length + " gamla avslutade frågor rensades för att projektet ska rymmas i molnet");
        return ids.length;
    },

    /* ---------- kopplingar (dubbelriktade) ---------- */
    koppla(p, a, ctx) {
        const fran = foObj(p, a.fran), till = foObj(p, a.till);
        foKrav(fran && till, "Kopplingen kan inte göras.");
        foKrav(!(a.fran.typ === a.till.typ && a.fran.id === a.till.id), "En sak kan inte kopplas till sig själv.");
        const lagg = (o, mal) => {
            if (!Array.isArray(o.kopplingar)) o.kopplingar = [];
            if (!o.kopplingar.some(k => k.typ === mal.typ && k.id === mal.id)) o.kopplingar.push({ typ: mal.typ, id: mal.id });
        };
        lagg(fran, a.till); lagg(till, a.fran);
        if (fran.hist) foHist(fran, ctx, "Kopplad till " + foObjNamn(p, a.till));
        if (till.hist) foHist(till, ctx, "Kopplad till " + foObjNamn(p, a.fran));
        fran.andrad = till.andrad = ctx.tid;
        foLogg(p, ctx, a.fran.id, foObjNamn(p, a.fran) + " kopplad till " + foObjNamn(p, a.till));
    },
    kopplaBort(p, a, ctx) {
        const fran = foObj(p, a.fran), till = foObj(p, a.till);
        if (fran) fran.kopplingar = (fran.kopplingar || []).filter(k => !(k.typ === a.till.typ && k.id === a.till.id));
        if (till) till.kopplingar = (till.kopplingar || []).filter(k => !(k.typ === a.fran.typ && k.id === a.fran.id));
        if (fran && fran.hist) foHist(fran, ctx, "Kopplingen till " + foObjNamn(p, a.till) + " togs bort");
        if (till && till.hist) foHist(till, ctx, "Kopplingen till " + foObjNamn(p, a.fran) + " togs bort");
        foLogg(p, ctx, a.fran.id, "Koppling borttagen: " + foObjNamn(p, a.fran) + " – " + foObjNamn(p, a.till));
    },

    /* ---------- beslut ---------- */
    // Ett beslut är ett eget objekt som aldrig ändras. Rättelse = nytt beslut som ersätter (BES-001…004).
    nyttBeslut(p, a, ctx) {
        const text = String(a.text || "").trim();
        foKrav(text, "Skriv vad som beslutades.");
        foKrav(foKanLeda(p, ctx.av) || foSuper(p, ctx.av) || !ctx.av, "Bara administratör, projekteringsledare och superuser får fastställa beslut.");
        const f = a.fragaId ? foFraga(p, a.fragaId) : null;
        const kons = !!(f && foKonsAktiva(f).length);
        if (kons && ctx.av) foKrav(a.bekraftaKonsekvens, FO_KONS_BEKRAFTA);
        let nr;
        if (f) nr = "B" + f.nr + "." + (p.beslut.filter(b => b.fragaId === f.id).length + 1);
        else {
            const fo = a.forum ? foForum(p, a.forum) : null, kort = fo ? fo.kort : "P";
            p.seq.motesbeslut[kort] = (p.seq.motesbeslut[kort] || 0) + 1;
            nr = "B-" + kort + "." + p.seq.motesbeslut[kort];
        }
        const b = {
            id: a.id, nr: nr, fragaId: f ? f.id : "", forum: a.forum || "", text: text,
            underlag: f ? { fraga: f.text, svar: foSvarText(f) || (foSenasteSvar(f) || {}).text || "", slutligt: !!foSlutliga(f).length } : null,
            konsekvensBekraftad: kons ? { av: ctx.av, tid: ctx.tid } : null,
            fattare: a.fattare || ctx.av, datum: a.datum || foDag(ctx.tid), status: "gallande",
            ersatter: a.ersatter || "", ersattAv: "", satt: a.ersatter ? (a.satt || "ersatter") : "", paverkar: !!a.paverkar,
            skapad: ctx.tid, av: ctx.av, kopplingar: [], hist: []
        };
        if (a.ersatter) {
            const g = foBeslut(p, a.ersatter);
            foKrav(g && g.status === "gallande", "Beslutet som ska ersättas är inte gällande.");
            if (b.satt === "ersatter") { g.status = "ersatt"; g.ersattAv = b.id; foHist(g, ctx, "Ersatt av " + nr); }
            else foHist(g, ctx, "Kompletterat av " + nr);
            if (f) foNyRev(p, f, ctx, "beslut", "andring", foStallare(f));
        }
        foHist(b, ctx, "Beslutet fastställdes");
        p.beslut.push(b);
        if (kons) foHist(b, ctx, "Bekräftat vid beslut: konsekvenser för tid och/eller kostnad har kommunicerats och hanterats");
        if (f) { f.kopplingar.push({ typ: "beslut", id: b.id }); b.kopplingar.push({ typ: "fraga", id: f.id }); f.andrad = ctx.tid; foHist(f, ctx, "Beslut " + nr + " fastställt" + (kons ? " – konsekvenser för tid/kostnad bekräftade som kommunicerade och hanterade" : "")); }
        foLogg(p, ctx, b.id, "Beslut " + nr + " fastställt");
        return b;
    },

    /* ---------- rapporter: låsta sammanställningar ---------- */
    // Själva sammanställningen sparas som en fil när den låses och ändras aldrig efter det.
    // Här finns bara uppgifterna om den: nummer, urval, kontrollsumma och signerade dokument.
    lasRapport(p, a, ctx) {
        foKrav(foKanLeda(p, ctx.av) || !ctx.av, "Bara administratör och projekteringsledare kan låsa sammanställningar.");
        foKrav(a.fil && a.fil.id, "Sammanställningen saknar fil.");
        foKrav(String(a.titel || "").trim(), "Ge sammanställningen en titel.");
        foKrav(!p.rapporter.some(r => r.id === a.id), "Sammanställningen är redan låst.");
        p.seq.rapport = (p.seq.rapport || 0) + 1;
        const fore = a.ersatter ? p.rapporter.find(x => x.id === a.ersatter) : null;
        const r = { id: a.id, nr: "S-" + p.seq.rapport, rapportId: a.rapportId || "", typ: a.typ || "", titel: String(a.titel).trim(), anteckning: String(a.anteckning || "").trim(),
            urval: a.urval || {}, urvalText: a.urvalText || "", antal: a.antal || 0, fil: a.fil, kontroll: a.kontroll || "", registerlage: a.registerlage || "",
            signerare: Array.isArray(a.signerare) ? a.signerare.map(x => ({ person: x.person || "", namn: String(x.namn || "").trim(), roll: String(x.roll || "").trim() })).filter(x => x.namn) : [],
            ersatter: fore ? fore.id : "", ersattAv: "", version: fore ? (fore.version || 1) + 1 : 1,
            tid: ctx.tid, av: ctx.av, status: "last", signerade: [], hist: [] };
        foHist(r, ctx, "Låst" + (fore ? " som ny version av " + fore.nr : ""));
        if (fore) { fore.ersattAv = r.id; foHist(fore, ctx, "Ny version: " + r.nr + ". Den här versionen finns kvar oförändrad."); }
        p.rapporter.push(r);
        foLogg(p, ctx, r.id, "Sammanställning " + r.nr + " låst: " + r.titel);
        return r;
    },
    signeradRapport(p, a, ctx) {
        foKrav(foKanLeda(p, ctx.av) || !ctx.av, "Bara administratör och projekteringsledare kan ladda upp signerade dokument.");
        const r = p.rapporter.find(x => x.id === a.id);
        foKrav(r, "Sammanställningen finns inte.");
        foKrav(r.status !== "makulerad", "Sammanställningen är makulerad.");
        const filer = (a.filer || []).filter(x => x && x.id && !r.signerade.some(y => y.id === x.id));
        if (!filer.length) return null;
        filer.forEach(x => r.signerade.push(Object.assign({}, x, { parter: String(a.parter || "").trim(), av: ctx.av, uppladdad: ctx.tid })));
        foHist(r, ctx, "Signerat dokument uppladdat" + (a.parter ? " (" + String(a.parter).trim() + ")" : ""));
        foLogg(p, ctx, r.id, "Signerat dokument kopplat till " + r.nr);
    },
    taBortSignerad(p, a, ctx) {
        foKrav(foKanLeda(p, ctx.av) || !ctx.av, "Bara administratör och projekteringsledare kan ta bort signerade dokument.");
        const r = p.rapporter.find(x => x.id === a.id);
        foKrav(r, "Sammanställningen finns inte.");
        const i = r.signerade.findIndex(x => x.id === a.fil);
        if (i < 0) return null;
        const namn = r.signerade[i].namn;
        r.signerade.splice(i, 1);
        foHist(r, ctx, "Signerat dokument borttaget: " + namn);
        foLogg(p, ctx, r.id, "Signerat dokument borttaget från " + r.nr);
    },
    makuleraRapport(p, a, ctx) {
        foKrav(foKanLeda(p, ctx.av) || !ctx.av, "Bara administratör och projekteringsledare kan makulera sammanställningar.");
        const r = p.rapporter.find(x => x.id === a.id);
        foKrav(r, "Sammanställningen finns inte.");
        foKrav(String(a.orsak || "").trim(), "Ange varför sammanställningen makuleras.");
        if (r.status === "makulerad") return null;
        r.status = "makulerad"; r.makulerad = { orsak: String(a.orsak).trim(), tid: ctx.tid, av: ctx.av };
        foHist(r, ctx, "Makulerad: " + r.makulerad.orsak);
        foLogg(p, ctx, r.id, "Sammanställning " + r.nr + " makulerad");
    },

    /* ---------- åtgärder ---------- */
    nyAtgard(p, a, ctx) {
        const text = String(a.text || "").trim();
        foKrav(text, "Skriv vad som ska göras.");
        p.seq.atgard = Math.max(p.seq.atgard, p.atgarder.reduce((m, x) => Math.max(m, x.nr), 0)) + 1;
        const kallaF = a.kalla && a.kalla.typ === "fraga" ? foFraga(p, a.kalla.id) : null;
        const x = { id: a.id, nr: p.seq.atgard, text: text, ansvarig: a.ansvarig || null, senast: a.senast || "", status: "oppen",
            kalla: a.kalla || null, skapad: ctx.tid, andrad: ctx.tid, av: ctx.av, kopplingar: [], hist: [], makulerad: null,
            // uppföljningsansvarig: som standard den som skapar åtgärden
            uppfoljare: a.uppfoljare !== undefined ? a.uppfoljare : (ctx.av || null), kontroll: !!a.kontroll, resultat: null,
            // vilken svarsversion åtgärden bygger på (för att upptäcka reviderade besked)
            svarRev: kallaF ? (kallaF.revs || []).length : null };
        foHist(x, ctx, "Åtgärden skapades");
        p.atgarder.push(x);
        if (a.kalla) {
            const k = foObj(p, a.kalla);
            if (k) { k.kopplingar = k.kopplingar || []; k.kopplingar.push({ typ: "atgard", id: x.id }); x.kopplingar.push({ typ: a.kalla.typ, id: a.kalla.id }); if (k.hist) foHist(k, ctx, "Åtgärd Å-" + x.nr + " skapad"); }
        }
        foLogg(p, ctx, x.id, "Åtgärd Å-" + x.nr + " skapades");
        return x;
    },
    atgardFalt(p, a, ctx) {
        const x = foAtgard(p, a.id);
        foKrav(x, "Åtgärden finns inte.");
        const andr = [];
        if (a.text !== undefined && a.text.trim() && a.text.trim() !== x.text) { x.text = a.text.trim(); andr.push("Texten ändrades"); }
        if (a.ansvarig !== undefined && JSON.stringify(a.ansvarig) !== JSON.stringify(x.ansvarig)) { x.ansvarig = a.ansvarig; andr.push("Ansvarig: " + (foPartText(p, a.ansvarig) || "–")); }
        if (a.senast !== undefined && a.senast !== x.senast) { x.senast = a.senast; andr.push("Klar senast: " + (a.senast || "–")); }
        if (a.uppfoljare !== undefined && a.uppfoljare !== x.uppfoljare) { x.uppfoljare = a.uppfoljare || null; andr.push("Följs upp av: " + (foPersonNamn(p, a.uppfoljare) || "–")); }
        if (a.kontroll !== undefined && !!a.kontroll !== !!x.kontroll) { x.kontroll = !!a.kontroll; andr.push(a.kontroll ? "Kräver kontroll av uppföljningsansvarig" : "Kräver inte kontroll"); }
        if (a.revOk && x.svarRev !== null) { const f = foFraga(p, (x.kalla || {}).id); if (f) { x.svarRev = (f.revs || []).length; andr.push("Bedömd mot det reviderade beskedet"); } }
        if (!andr.length) return null;
        x.andrad = ctx.tid;
        andr.forEach(t => foHist(x, ctx, t));
        foLogg(p, ctx, x.id, "Åtgärd Å-" + x.nr + ": " + andr.join(" · "));
    },
    atgardStatus(p, a, ctx) {
        const x = foAtgard(p, a.id);
        foKrav(x, "Åtgärden finns inte.");
        if (a.status === "makulerad") {
            foKrav(String(a.orsak || "").trim(), "Ange varför åtgärden avbryts.");
            x.makulerad = { orsak: a.orsak.trim(), tid: ctx.tid, av: ctx.av, status: x.status };
            x.status = "makulerad";
            foHist(x, ctx, "Avbruten: " + a.orsak.trim());
        } else if (x.status === "makulerad") {
            x.status = (x.makulerad && x.makulerad.status) || "oppen";
            x.makulerad = null;
            foHist(x, ctx, "Återställd");
        } else {
            // Kräver åtgärden kontroll går den till "Väntar på kontroll" tills uppföljningsansvarig godkänner.
            let ny = a.status;
            if (ny === "klar" && x.kontroll && x.uppfoljare && ctx.av !== x.uppfoljare && x.status === "oppen") ny = "kontroll";
            if (ny === "klar" && x.status === "kontroll") foKrav(!ctx.av || ctx.av === x.uppfoljare || foKanLeda(p, ctx.av), "Det är " + (foPersonNamn(p, x.uppfoljare) || "uppföljningsansvarig") + " som kontrollerar och avslutar åtgärden.");
            if (x.status === ny) return null;
            x.status = ny;
            if ((ny === "klar" || ny === "kontroll") && (a.kommentar || (a.bilagor || []).length)) x.resultat = { text: String(a.kommentar || "").trim(), bilagor: a.bilagor || [], tid: ctx.tid, av: ctx.av };
            foHist(x, ctx, ny === "klar" ? "Markerad som klar" + (a.kommentar ? ": " + String(a.kommentar).trim() : "") : ny === "kontroll" ? "Utförd – väntar på kontroll" + (a.kommentar ? ": " + String(a.kommentar).trim() : "") : "Öppnad igen");
        }
        x.andrad = ctx.tid;
        foLogg(p, ctx, x.id, "Åtgärd Å-" + x.nr + ": " + x.hist[x.hist.length - 1].text.toLowerCase());
    }
};

// Revision att kvittera på en fråga. Numreras R1, R2 … per fråga.
function foNyRev(p, f, ctx, typ, ver, mottagare, efterAvslut, post, orsak) {
    // Den som själv är mottagare behöver inte kvittera sin egen ändring.
    const egen = mottagare && foArPart(p, ctx.av, mottagare) && mottagare.person;
    f.revs.push({ id: foId(), nr: f.revs.length + 1, typ: typ, ver: ver, tid: ctx.tid, av: ctx.av, mottagare: mottagare || null,
        kvitt: egen || !mottagare ? { av: ctx.av, tid: ctx.tid, auto: true } : null, efterAvslut: !!efterAvslut, post: post || "", orsak: orsak || "" });
}

/* ---------- objekt i allmänhet (för kopplingar och sök) ---------- */
function foObj(p, ref) {
    if (!ref) return null;
    if (ref.typ === "fraga") return foFraga(p, ref.id);
    if (ref.typ === "beslut") return foBeslut(p, ref.id);
    if (ref.typ === "atgard") return foAtgard(p, ref.id);
    if (ref.typ === "inlagg") return foInlagg(p, ref.id);
    if (ref.typ === "protokoll") return (p.protokoll || []).find(x => x.id === ref.id) || null;
    return null;
}
function foObjNamn(p, ref) {
    const o = foObj(p, ref);
    if (!o) return "(borttagen)";
    if (ref.typ === "fraga") return "Fråga " + o.nr;
    if (ref.typ === "beslut") return "Beslut " + o.nr;
    if (ref.typ === "atgard") return "Åtgärd Å-" + o.nr;
    if (ref.typ === "inlagg") return "Inlägg av " + (foPersonNamn(p, o.av) || "okänd") + " i projektflödet";
    if (ref.typ === "protokoll") return "Protokoll " + ((foForum(p, o.forum) || {}).kort || "") + (o.nr ? " " + o.nr : "") + " " + (o.datum || "");
    return "";
}
function foObjText(p, ref) { const o = foObj(p, ref); return o ? o.text : ""; }

/* ---------- kör en operation ---------- */
// Kastar Error om operationen inte går. Returnerar det operationen returnerade.
/* Behörighet per ändring, i kärnan och inte bara i gränssnittet. Läsare får bara markera som
   sett och kvittera det som riktats till dem. Projektets uppgifter, organisation och
   inställningar ändras av administratör och projekteringsledare. */
const FO_NY_SAMLING = { nyFraga: "fragor", nyttBeslut: "beslut", nyAtgard: "atgarder", nyttInlagg: "flode" };
const FO_LASARE_FAR = ["sett", "kvittera", "kvitteraKrav", "kopplaKonto"];
const FO_BARA_LEDA = ["bjudIn", "aterkallaInbjudan", "ersattPerson", "projektUppgifter", "installning", "sparaDisc", "flyttaDisc", "sparaForetag", "sparaKategori", "flyttaKategori",
    "taBortKategori", "sparaPerson", "sparaIndelning", "sparaForum", "taBortProtokoll"];
function foBehorOp(p, op, ctx) {
    if (!ctx.av) return;
    const x = foPerson(p, ctx.av);
    if (!x) return;
    foKrav(x.aktiv !== false || op.typ === "sett", "Ditt medlemskap i projektet är avslutat.");
    if (x.roll === "lasare") foKrav(FO_LASARE_FAR.includes(op.typ), "Du har läsbehörighet i projektet och kan inte ändra projektinformation.");
    // Egna kontaktuppgifter får man ändra, men inte sin egen roll.
    const egen = op.typ === "sparaPerson" && op.a && op.a.id === ctx.av && (op.a.roll === undefined || op.a.roll === x.roll) && !op.a.superuser === !x.superuser;
    if (FO_BARA_LEDA.includes(op.typ) && !egen) foKrav(foKanLeda(p, ctx.av), "Bara administratör och projekteringsledare kan ändra det här.");
}
function foKorOp(p, op) {
    const fn = FO_OPS[op.typ];
    if (!fn) throw new Error("Okänd ändring: " + op.typ);
    const ctx = { av: op.av || "", tid: op.tid || foNu() };
    foBehorOp(p, op, ctx);
    // Samma nya post två gånger (dubbelklick, eller samma ändring skickad igen) blir ingen dubblett.
    if (FO_NY_SAMLING[op.typ] && op.a && op.a.id && (p[FO_NY_SAMLING[op.typ]] || []).some(x => x.id === op.a.id)) return null;
    const fore = typeof foAvisFore === "function" ? foAvisFore(p, op) : null;
    const svar = fn(p, op.a || {}, ctx);
    // Aviseringar räknas fram ur ändringen (samma resultat varje gång ändringen körs).
    if (typeof foAvisHak === "function") foAvisHak(p, op, ctx, svar, fore);
    return svar;
}

/* ---------- global sök ---------- */
function foSok(p, q, max) {
    q = foNormal(q).trim();
    if (!q) return [];
    const ut = [], nr = /^\d+$/.test(q) ? +q : null;
    const traff = (s) => foNormal(s).includes(q);
    p.fragor.forEach(f => {
        if (f.makulerad) return;
        if (nr !== null && f.nr === nr) ut.push({ typ: "fraga", id: f.id, rubrik: "Fråga " + f.nr, text: f.text, vikt: 0 });
        else if (traff(f.text) || traff(foDialogText(f))) ut.push({ typ: "fraga", id: f.id, rubrik: "Fråga " + f.nr, text: f.text, vikt: 2 });
    });
    p.beslut.forEach(b => { if (traff(b.nr) || traff(b.text)) ut.push({ typ: "beslut", id: b.id, rubrik: "Beslut " + b.nr, text: b.text, vikt: traff(b.nr) ? 1 : 2 }); });
    p.atgarder.forEach(a => { if (a.status !== "makulerad" && (traff("a-" + a.nr) || traff("å-" + a.nr) || traff(a.text))) ut.push({ typ: "atgard", id: a.id, rubrik: "Åtgärd Å-" + a.nr, text: a.text, vikt: 2 }); });
    (p.flode || []).forEach(x => {
        if (traff(x.text) || x.kommentarer.some(k => traff(k.text)))
            ut.push({ typ: "inlagg", id: x.id, rubrik: "Projektflödet · " + (foPersonNamn(p, x.av) || ""), text: x.text, vikt: 3 });
    });
    p.personer.forEach(x => {
        const n = foPersonNamn(p, x.id), ft = foForetag(p, x.foretagId);
        if (traff(n) || traff(x.epost) || (ft && traff(ft.namn))) ut.push({ typ: "person", id: x.id, rubrik: n, text: [ft && ft.namn, x.epost].filter(Boolean).join(" · "), vikt: 3 });
    });
    return ut.sort((a, b) => a.vikt - b.vikt).slice(0, max || 12);
}

/* ---------- export ---------- */
function foCsvFragor(p, lista) {
    const rad = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const huvud = ["Nr", "Fråga", "Frågeställare", "Företag", "Från disciplin", "Ska svara", "Berörda", "Plats", "Svar senast", "Vecka", "Status",
        "Slutligt svar", "Antal svar", "Senaste svar", "Senaste svar av", "Svarsdatum", "Möte", "Risk för tidspåverkan", "Risk för kostnadspåverkan", "Ställd", "Registrerad av"];
    const rader = lista.map(f => {
        const sv = foSenasteSvar(f), ft = foForetag(p, (foPerson(p, foStallarePerson(f)) || {}).foretagId);
        return [f.nr, f.text, foPersonNamn(p, foStallarePerson(f)), ft ? ft.namn : "", foDiscText(p, f.fran), foMottagareText(p, f),
            f.berorda.map(id => foDiscText(p, id)).concat((f.berordaP || []).map(id => foPersonNamn(p, id))).join(", "),
            f.indelning.map(id => (foVarde(p, id) || { varde: { namn: "" } }).varde.namn).join(", "), f.svarSenast, f.svarSenast ? foVecka(f.svarSenast) : "",
            f.makulerad ? "Makulerad" : FO_LAGE[f.lage].namn, foSvarText(f), foSvarPoster(f).length, sv ? sv.text : "", sv ? foPersonNamn(p, foPostLamnat(sv)) : "", sv ? foDag(sv.tid) : "",
            f.moten.map(id => (foForum(p, id) || {}).namn || "").join(", "), foKonsAktiva(f, "tid").length ? "Ja" : "", foKonsAktiva(f, "kostnad").length ? "Ja" : "",
            foDag(f.skapad), foPersonNamn(p, f.av)].map(rad).join(";");
    });
    return "\uFEFF" + huvud.map(rad).join(";") + "\r\n" + rader.join("\r\n");
}

/* ---------- demoprojekt (påhittade uppgifter, tydligt märkt) ---------- */
function foDemoProjekt(jag) {
    const p = foTomtProjekt("DEMO – Kvarteret Exempel");
    p.demo = true; p.nummer = "DEMO-01"; p.bestallare = "Demobeställaren AB (påhittat)"; p.entreprenor = "Demobygg AB (påhittat)";
    p.beskrivning = "Demoprojekt med påhittade uppgifter för att prova Wimo Forma.";
    p.start = foPlusDagar(foIdag(), -40); p.slut = foPlusDagar(foIdag(), 200);
    const ctx = (av, dagar) => ({ av: av, tid: new Date(Date.now() + (dagar || 0) * 864e5).toISOString() });
    const D = {};
    [["A", "Arkitekt"], ["K", "Konstruktör"], ["KP", "Prefabkonstruktör"], ["VS", "Värme och sanitet"], ["E", "El"], ["B", "Brand"]]
        .forEach(([k, n], i) => { const id = foId(); D[k] = id; p.discipliner.push({ id: id, kod: k, namn: n, ordning: i + 1, aktiv: true }); });
    const F = {};
    [["Demo Arkitekter AB", ["A"]], ["Demo Konstruktion AB", ["K"]], ["Demo Prefab AB", ["KP"]], ["Demo Installation AB", ["VS", "E"]], ["Demo Brandkonsult AB", ["B"]], ["Demobygg AB", []]]
        .forEach(([n, d]) => { const id = foId(); F[n] = id; p.foretag.push({ id: id, namn: n, orgnr: "", disc: d.map(k => D[k]), aktiv: true }); });
    const P = {};
    const person = (nyckel, fn, en, ft, disc, roll, epost, bef) => {
        const id = foId(); P[nyckel] = id;
        p.personer.push({ id: id, fornamn: fn, efternamn: en, foretagId: F[ft] || "", befattning: bef || "Uppdragsansvarig", disc: disc.map(k => D[k]),
            epost: epost, tel: "", roll: roll, extern: false, aktiv: true, uid: "" });
    };
    person("pl", jag && jag.fornamn ? jag.fornamn : "Petra", jag && jag.fornamn ? (jag.efternamn || "") : "Projekteringsledare", "Demobygg AB", [], "admin",
        jag && jag.epost ? jag.epost : "petra@demo.invalid", "Projekteringsledare");
    if (jag && jag.uid) p.personer[0].uid = jag.uid;
    person("a", "Anna", "Arkitekt", "Demo Arkitekter AB", ["A"], "projektor", "anna@demo.invalid");
    person("k", "Karl", "Konstruktör", "Demo Konstruktion AB", ["K"], "projektor", "karl@demo.invalid");
    person("kp", "Erik", "Prefab", "Demo Prefab AB", ["KP"], "projektor", "erik@demo.invalid");
    person("vs", "Vera", "VVS", "Demo Installation AB", ["VS"], "projektor", "vera@demo.invalid");
    person("b", "Bo", "Brand", "Demo Brandkonsult AB", ["B"], "projektor", "bo@demo.invalid");
    p.plId = P.pl;
    // demo: personerna i exempelkategorierna (Erik både som projektör och underentreprenör)
    const kat = { pl: ["kat-entreprenor"], a: ["kat-projektorer"], k: ["kat-projektorer"], kp: ["kat-projektorer", "kat-ue"], vs: ["kat-projektorer"], b: ["kat-konsulter"] };
    Object.keys(kat).forEach(n => { const x = foPerson(p, P[n]); if (x) x.kategorier = kat[n]; });
    const byggnad = { id: foId(), namn: "Byggnad", varden: [{ id: foId(), namn: "Hus A", aktiv: true }, { id: foId(), namn: "Hus B", aktiv: true }] };
    const etapp = { id: foId(), namn: "Etapp", varden: [{ id: foId(), namn: "Etapp 1", aktiv: true }, { id: foId(), namn: "Etapp 2", aktiv: true }] };
    p.indelningar.push(byggnad, etapp);
    const pm = { id: foId(), namn: "Projekteringsmöte", kort: "PM", plats: "Platskontoret, Demogatan 1", tid: "09:00", ledare: P.pl, sekreterare: P.pl,
        deltagare: [P.pl, P.a, P.k, P.kp, P.vs, P.b], aktiv: true, nastaMote: foPlusDagar(foIdag(), 2) };
    const si = { id: foId(), namn: "Samordningsmöte installation", kort: "SI", plats: "Teams", tid: "13:00", ledare: P.vs, sekreterare: P.vs,
        deltagare: [P.pl, P.vs, P.k], aktiv: true, nastaMote: foPlusDagar(foIdag(), 6) };
    p.forum.push(pm, si);
    const op = (typ, a, c) => foKorOp(p, { typ: typ, a: a, av: c.av, tid: c.tid });
    const f1 = op("nyFraga", { id: foId(), text: "Kan schaktet för VS i trapphus B flyttas 300 mm åt norr för att undvika balken i plan 2?",
        fran: D.K, ansvarig: { person: P.a }, indelning: [byggnad.varden[1].id], svarSenast: foPlusDagar(foIdag(), -6), moten: [pm.id] }, ctx(P.k, -9));
    op("svara", { id: f1.id, text: "Ja, schaktet kan flyttas 300 mm. Ny placering redovisas i nästa revision av planritningen." }, ctx(P.a, -7));
    op("nyttBeslut", { id: foId(), fragaId: f1.id, text: "Schaktet i trapphus B flyttas 300 mm åt norr. A reviderar planritning plan 2.", fattare: P.pl }, ctx(P.pl, -6));
    const f2 = op("nyFraga", { id: foId(), text: "Krävs EI60 mot trapphus B på plan 2 när schaktet flyttas?", fran: D.B, ansvarig: { disc: D.A },
        indelning: [byggnad.varden[1].id], svarSenast: foPlusDagar(foIdag(), -2), moten: [pm.id], konsekvens: ["kostnad"] }, ctx(P.b, -5));
    op("konsekvensMarkera", { id: f2.id, kid: foId(), typ: "tid", kommentar: "Ny brandcellsgräns kan kräva omprojektering av dörrpartier, cirka en vecka." }, ctx(P.pl, -4));
    const f3 = op("nyFraga", { id: foId(), text: "Kan håltagning i HD/F-bjälklag plan 3 göras efter montage?", fran: D.KP, ansvarig: { person: P.k },
        indelning: [byggnad.varden[0].id], svarSenast: foPlusDagar(foIdag(), 5), berorda: [D.VS, D.E] }, ctx(P.kp, -4));
    op("svara", { id: f3.id, text: "Nej, håltagning ska göras på fabrik. Erik skickar håltagningsritning senast fredag." }, ctx(P.k, -3));
    op("svara", { id: f3.id, text: "Nej, håltagning ska göras på fabrik. Erik skickar håltagningsritning senast fredag.\n\nGäller alla håltag större än 150 mm." }, ctx(P.k, -1));
    const f4 = op("nyFraga", { id: foId(), text: "Vilken ljudklass gäller för lägenhetsavskiljande väggar mot trapphus, och påverkar det väggtjockleken?", fran: D.A,
        mottagare: [{ disc: D.K }, { person: P.a }], berordaP: [P.vs], indelning: [byggnad.varden[0].id], svarSenast: foPlusDagar(foIdag(), 8), moten: [si.id] }, ctx(P.pl, -2));
    op("dialogPost", { id: f4.id, post: foId(), typ: "svar", text: "Ljudklass B enligt SS 25267. Väggtypen V3 klarar kravet utan ändrad tjocklek." }, ctx(P.k, -1));
    // Registrerad av projekteringsledaren för Veras räkning.
    const f5 = op("nyFraga", { id: foId(), text: "Ska dagvattenledningen under hus A dimensioneras för 20-årsregn?", stallare: P.vs, fran: D.VS, mottagare: [{ person: P.pl }] }, ctx(P.pl, -12));
    op("svara", { id: f5.id, text: "Ja, enligt kommunens krav. Se dagvattenutredningen daterad i mars." }, ctx(P.pl, -11));
    op("sattLage", { id: f5.id, lage: "klar" }, ctx(P.vs, -10));
    op("nyAtgard", { id: foId(), text: "Revidera planritning plan 2 med ny schaktplacering", ansvarig: { person: P.a }, senast: foPlusDagar(foIdag(), 3),
        kalla: { typ: "fraga", id: f1.id } }, ctx(P.pl, -6));
    op("nyAtgard", { id: foId(), text: "Skicka håltagningsritning HD/F plan 3 till prefableverantören", ansvarig: { person: P.kp }, senast: foPlusDagar(foIdag(), -1),
        kalla: { typ: "fraga", id: f3.id } }, ctx(P.k, -3));
    op("nyAtgard", { id: foId(), text: "Ta fram brandskyddsbeskrivning rev B", ansvarig: { disc: D.B }, senast: foPlusDagar(foIdag(), 12) }, ctx(P.pl, -2));
    // Muntligt besked som registreras av någon annan än den som lämnade det.
    const f6 = op("nyFraga", { id: foId(), text: "Behövs sprinkler i soprummet i hus B?", fran: "", mottagare: [{ disc: D.B }], svarSenast: foPlusDagar(foIdag(), 3) }, ctx(P.pl, -3));
    op("dialogPost", { id: f6.id, post: foId(), typ: "svar", lamnat: P.b, text: "Muntligt besked på platsbesöket: nej, det räcker med brandcell EI60 och brandlarm." }, ctx(P.pl, -2));
    op("dialogPost", { id: f6.id, post: foId(), typ: "foljd", text: "Kan du bekräfta det skriftligt och ange vilken dörrklass som gäller?" }, ctx(P.pl, -2));
    void f2;
    // projektflödet
    const i1 = op("nyttInlagg", { id: foId(), text: "Projekteringsmötena flyttas till tisdagar kl. 9 från och med nästa vecka. Agendan skickas senast fredagen innan.",
        personer: [], disc: [] }, ctx(P.pl, -6));
    op("fastInlagg", { id: i1.id, pa: true }, ctx(P.pl, -6));
    [P.a, P.k, P.vs].forEach((x, n) => op("gillaInlagg", { id: i1.id, pa: true }, ctx(x, -6 + n * 0.1)));
    const i2 = op("nyttInlagg", { id: foId(), text: "Nya planritningar plan 1–3, rev B, är klara. Schaktet i trapphus B är flyttat enligt #1.",
        disc: [D.K, D.VS], personer: [] }, ctx(P.a, -2));
    op("kommentera", { id: i2.id, kid: foId(), text: "Tack! Vi uppdaterar ventilationen i trapphus B i veckan." }, ctx(P.vs, -1.8));
    op("gillaInlagg", { id: i2.id, pa: true }, ctx(P.k, -1.9));
    op("nyttInlagg", { id: foId(), text: "Leveransen av stomritningar för hus B förskjuts en vecka. Orsak: ändrad håltagning i HD/F.",
        personer: [P.pl], disc: [D.KP] }, ctx(P.k, -0.3));
    // Det man själv har skapat i demot räknas som sett, så att bara det andra har gjort syns som nytt.
    const nu = new Date().toISOString(), sett = p.sett[P.pl] = { _logg: nu };
    [f1, f5, f4, f6].forEach(f => { sett[f.id] = nu; });
    p.atgarder.forEach(a => { sett[a.id] = nu; });
    return p;
}
