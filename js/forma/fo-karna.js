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
const FO_PAVERKAR_TEXT = "Markeringen är en upplysning om att frågan kan påverka tid eller kostnad. Den är inte en underrättelse eller ett anspråk enligt avtal.";

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
function foNormal(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }

/* ---------- ett tomt projekt ---------- */
function foTomtProjekt(namn, skapare) {
    const p = {
        ver: FO_VER, namn: namn || "Nytt projekt", nummer: "", bestallare: "", entreprenor: "", beskrivning: "",
        plId: "", start: "", slut: "", demo: false,
        inst: { autoBesvarad: true, revStil: "bokstav" },
        discipliner: [], foretag: [], personer: [], indelningar: [], forum: [],
        fragor: [], beslut: [], atgarder: [], logg: [], sett: {},
        seq: { fraga: 0, atgard: 0, motesbeslut: {} }
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
    ["discipliner", "foretag", "personer", "indelningar", "forum", "fragor", "beslut", "atgarder", "logg"].forEach(k => { if (!Array.isArray(p[k])) p[k] = []; });
    p.fragor.forEach(f => {
        ["textVer", "berorda", "indelning", "moten", "revs", "kopplingar", "bilagor", "hist"].forEach(k => { if (!Array.isArray(f[k])) f[k] = []; });
        if (!f.behandlad) f.behandlad = {};
        if (!f.ansvarig) f.ansvarig = null;
    });
    p.atgarder.forEach(a => { if (!Array.isArray(a.hist)) a.hist = []; });
    p.ver = FO_VER;
    return p;
}

/* ---------- uppslag ---------- */
function foPerson(p, id) { return p.personer.find(x => x.id === id) || null; }
function foDisc(p, id) { return p.discipliner.find(x => x.id === id) || null; }
function foForetag(p, id) { return p.foretag.find(x => x.id === id) || null; }
function foForum(p, id) { return p.forum.find(x => x.id === id) || null; }
function foFraga(p, id) { return p.fragor.find(x => x.id === id) || null; }
function foFragaNr(p, nr) { return p.fragor.find(x => x.nr === +nr) || null; }
function foBeslut(p, id) { return p.beslut.find(x => x.id === id) || null; }
function foAtgard(p, id) { return p.atgarder.find(x => x.id === id) || null; }
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

/* ---------- frågor: läge och urval ---------- */
function foForsenad(f, idag) {
    return !f.makulerad && f.svarSenast && f.svarSenast < (idag || foIdag()) && (f.lage === "obesvarad" || f.lage === "ofullstandig");
}
function foOkvitterade(f) { return f.revs.filter(r => !r.kvitt); }
// Frågeställaren som part: personen som ställde frågan, annars från-disciplinen.
function foStallare(f) { return f.av ? { person: f.av } : (f.fran ? { disc: f.fran } : null); }
function foAktiv(f) { return !f.makulerad && f.lage !== "klar"; }
function foSvarText(f) { return f.svar ? f.svar.text : ""; }

// Nästa steg i klartext, så att alla ser vem som ska göra vad (UX-005).
function foNastaSteg(p, f) {
    if (f.makulerad) return "Makulerad";
    const ok = foOkvitterade(f);
    if (ok.length) return "Kvitteras av " + (foPartText(p, ok[0].mottagare) || "mottagaren");
    if (f.lage === "obesvarad") return f.ansvarig ? "Svar från " + foPartText(p, f.ansvarig) : "Välj ansvarig";
    if (f.lage === "ofullstandig") return "Komplettering från " + (foPartText(p, f.ansvarig) || "ansvarig");
    if (f.lage === "besvarad") return "Avslutas av " + (foPartText(p, foStallare(f)) || "frågeställaren");
    return "Klar";
}

// Det som väntar på personen (Översikt → Att göra för dig).
function foAttGora(p, personId) {
    const ut = { svara: [], kvittera: [], avsluta: [], atgarder: [] };
    if (!personId) return ut;
    p.fragor.forEach(f => {
        if (f.makulerad) return;
        if ((f.lage === "obesvarad" || f.lage === "ofullstandig") && foArPart(p, personId, f.ansvarig)) ut.svara.push(f);
        if (foOkvitterade(f).some(r => foArPart(p, personId, r.mottagare))) ut.kvittera.push(f);
        if (f.lage === "besvarad" && foArPart(p, personId, foStallare(f)) && !foOkvitterade(f).length) ut.avsluta.push(f);
    });
    p.atgarder.forEach(a => { if (a.status === "oppen" && foArPart(p, personId, a.ansvarig)) ut.atgarder.push(a); });
    return ut;
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
            roll: a.roll || x.roll || "projektor", extern: !!a.extern
        });
        if (a.uid !== undefined) x.uid = a.uid;
        if (a.aktiv !== undefined) x.aktiv = !!a.aktiv;
        foLogg(p, ctx, "", (ny ? "Kontakten " : "Kontakten ") + foPersonNamn(p, x.id) + (ny ? " lades till" : " ändrades"));
    },
    kopplaKonto(p, a, ctx) {
        const x = foPerson(p, a.id);
        foKrav(x, "Kontakten finns inte.");
        x.uid = a.uid || "";
        return null;
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
        Object.assign(f, { namn: namn, kort: String(a.kort || "").trim().toUpperCase() || namn.slice(0, 2).toUpperCase(),
            plats: a.plats || "", tid: a.tid || "", ledare: a.ledare || "", sekreterare: a.sekreterare || "", deltagare: a.deltagare || [] });
        if (a.nastaMote !== undefined) f.nastaMote = a.nastaMote;
        if (a.aktiv !== undefined) f.aktiv = !!a.aktiv;
        foLogg(p, ctx, "", "Mötesforumet " + namn + " sparades");
    },

    /* ---------- frågor ---------- */
    nyFraga(p, a, ctx) {
        const text = String(a.text || "").trim();
        foKrav(text, "Skriv frågan.");
        // Numret är permanent och återanvänds aldrig, även om frågan makuleras (FRG-002).
        const hogst = p.fragor.reduce((m, f) => Math.max(m, f.nr), 0);
        p.seq.fraga = Math.max(p.seq.fraga, hogst) + 1;
        const f = {
            id: a.id, nr: p.seq.fraga, skapad: ctx.tid, andrad: ctx.tid, av: ctx.av, text: text,
            textVer: [{ text: text, tid: ctx.tid, av: ctx.av, typ: "ny" }],
            fran: a.fran || "", ansvarig: a.ansvarig || null, berorda: a.berorda || [], indelning: a.indelning || [],
            svarSenast: a.svarSenast || "", lage: "obesvarad", moten: a.moten || [], behandlad: {},
            svar: null, revs: [], paverkar: !!a.paverkar, kopplingar: [], bilagor: a.bilagor || [], makulerad: null, hist: []
        };
        foHist(f, ctx, "Frågan registrerades");
        p.fragor.push(f);
        foLogg(p, ctx, f.id, "Fråga " + f.nr + " registrerades");
        return f;
    },
    fragaFalt(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        const andr = [];
        if (a.fran !== undefined && a.fran !== f.fran) { f.fran = a.fran; andr.push("Från: " + (foDiscText(p, a.fran) || "–")); }
        if (a.ansvarig !== undefined && JSON.stringify(a.ansvarig) !== JSON.stringify(f.ansvarig)) {
            f.ansvarig = a.ansvarig; andr.push("Ansvarig: " + (foPartText(p, a.ansvarig) || "–"));
        }
        if (a.svarSenast !== undefined && a.svarSenast !== f.svarSenast) { f.svarSenast = a.svarSenast; andr.push("Svar senast: " + (a.svarSenast || "–")); }
        if (a.berorda !== undefined) { f.berorda = a.berorda; andr.push("Berörda: " + (a.berorda.map(id => foDiscText(p, id)).join(", ") || "–")); }
        if (a.indelning !== undefined) { f.indelning = a.indelning; andr.push("Plats: " + (a.indelning.map(id => (foVarde(p, id) || { varde: { namn: "?" } }).varde.namn).join(", ") || "–")); }
        if (a.paverkar !== undefined && !!a.paverkar !== f.paverkar) { f.paverkar = !!a.paverkar; andr.push(a.paverkar ? "Markerad: kan påverka tid eller kostnad" : "Markeringen tid/kostnad togs bort"); }
        if (!andr.length) return null;
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
    // Frågetexten: tillägg eller ändring, alltid som ny version (FRG-010, FRG-011).
    fragaText(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        const ny = String(a.text || "").trim();
        foKrav(ny, "Frågan kan inte vara tom.");
        const typ = foKlassa(f.text, ny);
        if (typ === "samma") return null;
        f.textVer.push({ text: ny, tid: ctx.tid, av: ctx.av, typ: typ });
        f.text = ny;
        f.andrad = ctx.tid;
        // Den som ska svara kvitterar att frågan ändrats, om det finns någon ansvarig.
        if (f.ansvarig) foNyRev(p, f, ctx, "fraga", typ, f.ansvarig);
        foHist(f, ctx, (typ === "tillagg" ? "Tillägg i frågan" : "Frågan ändrades i sak"));
        foLogg(p, ctx, f.id, "Fråga " + f.nr + ": " + (typ === "tillagg" ? "tillägg i frågan" : "frågan ändrades"));
    },
    // Svar: första svaret, tillägg eller ändring. Tidigare versioner bevaras (FRG-009).
    svara(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        const ny = String(a.text || "").trim();
        foKrav(ny, "Skriv svaret.");
        const gammal = f.svar ? f.svar.text : "";
        const typ = foKlassa(gammal, ny);
        if (typ === "samma") return null;
        if (!f.svar) f.svar = { text: "", ver: [] };
        f.svar.ver.push({ text: ny, tid: ctx.tid, av: ctx.av, typ: typ });
        f.svar.text = ny;
        if (a.bilagor && a.bilagor.length) f.bilagor = f.bilagor.concat(a.bilagor.map(b => Object.assign({}, b, { del: "svar", ver: f.svar.ver.length })));
        const varKlar = f.lage === "klar";
        // Ett nytt svar på ofullständigt svar ger Besvarad direkt, om projektet är inställt så (ORG-017).
        if (f.lage === "obesvarad" || (f.lage === "ofullstandig" && p.inst.autoBesvarad) || varKlar) f.lage = "besvarad";
        if (typ !== "ny") foNyRev(p, f, ctx, "svar", typ, foStallare(f), varKlar);
        f.andrad = ctx.tid;
        const t = typ === "ny" ? "Frågan besvarades" : typ === "tillagg" ? "Tillägg i svaret" : "Svaret ändrades i sak";
        foHist(f, ctx, t + (varKlar ? " (efter avslut — frågan återöppnades)" : ""));
        foLogg(p, ctx, f.id, "Fråga " + f.nr + ": " + t.charAt(0).toLowerCase() + t.slice(1));
    },
    sattLage(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f, "Frågan finns inte.");
        foKrav(FO_LAGE[a.lage], "Okänt läge.");
        if (a.lage === "klar") foKrav(!foOkvitterade(f).length, "Kvittera revisionerna innan frågan avslutas.");
        if (f.lage === a.lage) return null;
        const fore = f.lage;
        f.lage = a.lage;
        f.andrad = ctx.tid;
        const t = a.lage === "klar" ? "Frågan avslutades" : fore === "klar" ? "Frågan återöppnades" :
            a.lage === "ofullstandig" ? "Svaret markerades som ofullständigt" : "Läget ändrades till " + FO_LAGE[a.lage].namn;
        foHist(f, ctx, t + (a.kommentar ? ": " + a.kommentar : ""));
        foLogg(p, ctx, f.id, "Fråga " + f.nr + ": " + t.charAt(0).toLowerCase() + t.slice(1));
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
        foKrav(String(a.orsak || "").trim(), "Ange varför frågan makuleras.");
        f.makulerad = { orsak: a.orsak.trim(), tid: ctx.tid, av: ctx.av, lage: f.lage };
        f.andrad = ctx.tid;
        foHist(f, ctx, "Makulerad: " + a.orsak.trim());
        foLogg(p, ctx, f.id, "Fråga " + f.nr + " makulerades");
    },
    aterstallFraga(p, a, ctx) {
        const f = foFraga(p, a.id);
        foKrav(f && f.makulerad, "Frågan är inte makulerad.");
        f.makulerad = null;
        f.andrad = ctx.tid;
        foHist(f, ctx, "Återställd från makulerad");
        foLogg(p, ctx, f.id, "Fråga " + f.nr + " återställdes");
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
        foKrav(foKanLeda(p, ctx.av) || !ctx.av, "Bara administratör och projekteringsledare får fastställa beslut.");
        const f = a.fragaId ? foFraga(p, a.fragaId) : null;
        let nr;
        if (f) nr = "B" + f.nr + "." + (p.beslut.filter(b => b.fragaId === f.id).length + 1);
        else {
            const fo = a.forum ? foForum(p, a.forum) : null, kort = fo ? fo.kort : "P";
            p.seq.motesbeslut[kort] = (p.seq.motesbeslut[kort] || 0) + 1;
            nr = "B-" + kort + "." + p.seq.motesbeslut[kort];
        }
        const b = {
            id: a.id, nr: nr, fragaId: f ? f.id : "", forum: a.forum || "", text: text,
            underlag: f ? { fraga: f.text, svar: foSvarText(f) } : null,
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
        if (f) { f.kopplingar.push({ typ: "beslut", id: b.id }); b.kopplingar.push({ typ: "fraga", id: f.id }); f.andrad = ctx.tid; foHist(f, ctx, "Beslut " + nr + " fastställt"); }
        foLogg(p, ctx, b.id, "Beslut " + nr + " fastställt");
        return b;
    },

    /* ---------- åtgärder ---------- */
    nyAtgard(p, a, ctx) {
        const text = String(a.text || "").trim();
        foKrav(text, "Skriv vad som ska göras.");
        p.seq.atgard = Math.max(p.seq.atgard, p.atgarder.reduce((m, x) => Math.max(m, x.nr), 0)) + 1;
        const x = { id: a.id, nr: p.seq.atgard, text: text, ansvarig: a.ansvarig || null, senast: a.senast || "", status: "oppen",
            kalla: a.kalla || null, skapad: ctx.tid, andrad: ctx.tid, av: ctx.av, kopplingar: [], hist: [], makulerad: null };
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
            if (x.status === a.status) return null;
            x.status = a.status;
            foHist(x, ctx, a.status === "klar" ? "Markerad som klar" : "Öppnad igen");
        }
        x.andrad = ctx.tid;
        foLogg(p, ctx, x.id, "Åtgärd Å-" + x.nr + ": " + x.hist[x.hist.length - 1].text.toLowerCase());
    }
};

// Revision att kvittera på en fråga. Numreras R1, R2 … per fråga.
function foNyRev(p, f, ctx, typ, ver, mottagare, efterAvslut) {
    // Den som själv är mottagare behöver inte kvittera sin egen ändring.
    const egen = mottagare && foArPart(p, ctx.av, mottagare) && mottagare.person;
    f.revs.push({ id: foId(), nr: f.revs.length + 1, typ: typ, ver: ver, tid: ctx.tid, av: ctx.av, mottagare: mottagare || null,
        kvitt: egen || !mottagare ? { av: ctx.av, tid: ctx.tid, auto: true } : null, efterAvslut: !!efterAvslut });
}

/* ---------- objekt i allmänhet (för kopplingar och sök) ---------- */
function foObj(p, ref) {
    if (!ref) return null;
    if (ref.typ === "fraga") return foFraga(p, ref.id);
    if (ref.typ === "beslut") return foBeslut(p, ref.id);
    if (ref.typ === "atgard") return foAtgard(p, ref.id);
    return null;
}
function foObjNamn(p, ref) {
    const o = foObj(p, ref);
    if (!o) return "(borttagen)";
    if (ref.typ === "fraga") return "Fråga " + o.nr;
    if (ref.typ === "beslut") return "Beslut " + o.nr;
    if (ref.typ === "atgard") return "Åtgärd Å-" + o.nr;
    return "";
}
function foObjText(p, ref) { const o = foObj(p, ref); return o ? o.text : ""; }

/* ---------- kör en operation ---------- */
// Kastar Error om operationen inte går. Returnerar det operationen returnerade.
function foKorOp(p, op) {
    const fn = FO_OPS[op.typ];
    if (!fn) throw new Error("Okänd ändring: " + op.typ);
    return fn(p, op.a || {}, { av: op.av || "", tid: op.tid || foNu() });
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
        else if (traff(f.text) || traff(foSvarText(f))) ut.push({ typ: "fraga", id: f.id, rubrik: "Fråga " + f.nr, text: f.text, vikt: 2 });
    });
    p.beslut.forEach(b => { if (traff(b.nr) || traff(b.text)) ut.push({ typ: "beslut", id: b.id, rubrik: "Beslut " + b.nr, text: b.text, vikt: traff(b.nr) ? 1 : 2 }); });
    p.atgarder.forEach(a => { if (a.status !== "makulerad" && (traff("a-" + a.nr) || traff("å-" + a.nr) || traff(a.text))) ut.push({ typ: "atgard", id: a.id, rubrik: "Åtgärd Å-" + a.nr, text: a.text, vikt: 2 }); });
    p.personer.forEach(x => {
        const n = foPersonNamn(p, x.id), ft = foForetag(p, x.foretagId);
        if (traff(n) || traff(x.epost) || (ft && traff(ft.namn))) ut.push({ typ: "person", id: x.id, rubrik: n, text: [ft && ft.namn, x.epost].filter(Boolean).join(" · "), vikt: 3 });
    });
    return ut.sort((a, b) => a.vikt - b.vikt).slice(0, max || 12);
}

/* ---------- export ---------- */
function foCsvFragor(p, lista) {
    const rad = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const huvud = ["Nr", "Fråga", "Från", "Ansvarig", "Plats", "Svar senast", "Läge", "Möte", "Svar", "Svarat av", "Svarsdatum", "Kan påverka tid/kostnad", "Registrerad", "Registrerad av"];
    const rader = lista.map(f => {
        const sv = f.svar && f.svar.ver.length ? f.svar.ver[f.svar.ver.length - 1] : null;
        return [f.nr, f.text, foDiscText(p, f.fran), foPartText(p, f.ansvarig),
            f.indelning.map(id => (foVarde(p, id) || { varde: { namn: "" } }).varde.namn).join(", "), f.svarSenast,
            f.makulerad ? "Makulerad" : FO_LAGE[f.lage].namn, f.moten.map(id => (foForum(p, id) || {}).namn || "").join(", "),
            foSvarText(f), sv ? foPersonNamn(p, sv.av) : "", sv ? foDag(sv.tid) : "", f.paverkar ? "Ja" : "",
            foDag(f.skapad), foPersonNamn(p, f.av)].map(rad).join(";");
    });
    return "﻿" + huvud.map(rad).join(";") + "\r\n" + rader.join("\r\n");
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
        indelning: [byggnad.varden[1].id], svarSenast: foPlusDagar(foIdag(), -2), moten: [pm.id], paverkar: true }, ctx(P.b, -5));
    const f3 = op("nyFraga", { id: foId(), text: "Kan håltagning i HD/F-bjälklag plan 3 göras efter montage?", fran: D.KP, ansvarig: { person: P.k },
        indelning: [byggnad.varden[0].id], svarSenast: foPlusDagar(foIdag(), 5), berorda: [D.VS, D.E] }, ctx(P.kp, -4));
    op("svara", { id: f3.id, text: "Nej, håltagning ska göras på fabrik. Erik skickar håltagningsritning senast fredag." }, ctx(P.k, -3));
    op("svara", { id: f3.id, text: "Nej, håltagning ska göras på fabrik. Erik skickar håltagningsritning senast fredag.\n\nGäller alla håltag större än 150 mm." }, ctx(P.k, -1));
    const f4 = op("nyFraga", { id: foId(), text: "Vilken ljudklass gäller för lägenhetsavskiljande väggar mot trapphus?", fran: D.A, ansvarig: { disc: D.K },
        indelning: [byggnad.varden[0].id], svarSenast: foPlusDagar(foIdag(), 8), moten: [si.id] }, ctx(P.a, -2));
    const f5 = op("nyFraga", { id: foId(), text: "Ska dagvattenledningen under hus A dimensioneras för 20-årsregn?", fran: D.VS, ansvarig: { person: P.pl } }, ctx(P.vs, -12));
    op("svara", { id: f5.id, text: "Ja, enligt kommunens krav. Se dagvattenutredningen daterad i mars." }, ctx(P.pl, -11));
    op("sattLage", { id: f5.id, lage: "klar" }, ctx(P.vs, -10));
    op("nyAtgard", { id: foId(), text: "Revidera planritning plan 2 med ny schaktplacering", ansvarig: { person: P.a }, senast: foPlusDagar(foIdag(), 3),
        kalla: { typ: "fraga", id: f1.id } }, ctx(P.pl, -6));
    op("nyAtgard", { id: foId(), text: "Skicka håltagningsritning HD/F plan 3 till prefableverantören", ansvarig: { person: P.kp }, senast: foPlusDagar(foIdag(), -1),
        kalla: { typ: "fraga", id: f3.id } }, ctx(P.k, -3));
    op("nyAtgard", { id: foId(), text: "Ta fram brandskyddsbeskrivning rev B", ansvarig: { disc: D.B }, senast: foPlusDagar(foIdag(), 12) }, ctx(P.pl, -2));
    void f2; void f4;
    // Det man själv har skapat i demot räknas som sett, så att bara det andra har gjort syns som nytt.
    const nu = new Date().toISOString(), sett = p.sett[P.pl] = { _logg: nu };
    [f1, f5].forEach(f => { sett[f.id] = nu; });
    p.atgarder.forEach(a => { sett[a.id] = nu; });
    return p;
}
