/* ======================================================================
   Wimo · Företagsportal (portal.html)
   Bara för Wimos huvudadmin. Här skapas företag (kunder) och här sätts
   paket, moduler, gränser och status. Portalen visar bara nyckeltal:
   Wimo är aldrig medlem i ett företag och kommer inte åt dess projekt
   (säkerhetsreglerna stänger både Plan- och Forma-projekten för huvudadmin).

   foretag/{id} = { namn, moduler, paket, gransPlan, gransForma, status, slut, kontakt,
                    admins, medlemmar, inbjudna, inbjudTid, inbjudAdmin,
                    platserPlan, platserForma, stat, skapad, skapadAv, andrad }
   ====================================================================== */
(function () {
    "use strict";
    const SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
    const PRIS_PLAN = 1500, PRIS_FORMA = 200;          // kr per månad, exklusive moms
    const PAKET = {
        liten: { namn: "Liten", plan: 3, forma: 10 },
        mellan: { namn: "Mellan", plan: 8, forma: 30 },
        stor: { namn: "Stor", plan: 12, forma: 50 },
        eget: { namn: "Eget" }
    };
    const STATUS = { prov: "Provperiod", aktiv: "Aktiv", pausad: "Pausad" };
    const INBJUD_DAGAR = 14;
    const $ = (id) => document.getElementById(id);
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const kr = (n) => Math.round(n).toLocaleString("sv-SE") + " kr";
    const datum = (ms) => ms ? new Date(ms).toLocaleDateString("sv-SE") : "";
    const epostOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
    const appLank = () => location.origin + location.pathname.replace(/[^/]*$/, "") + "konto.html";

    let fb = null, jag = null, foretag = [], lyss = null;

    function status(t, fel) {
        const s = $("poStatus");
        s.textContent = t;
        s.classList.toggle("fel", !!fel);
        s.classList.remove("dold");
        clearTimeout(status.t);
        status.t = setTimeout(() => s.classList.add("dold"), fel ? 7000 : 3500);
    }

    async function ladda() {
        const [app, auth, fs] = await Promise.all([import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js"), import(SDK + "firebase-firestore.js")]);
        const appen = app.initializeApp(window.PLAN4_FIREBASE || {});
        fb = { auth, fs, authInst: auth.getAuth(appen), db: fs.getFirestore(appen) };
    }

    function visaMeddelande(rubrik, text, lank) {
        $("poSida").innerHTML = '<section class="p4-ks-kort po-meddelande"><h2>' + esc(rubrik) + '</h2><p class="hjalp">' + esc(text) + "</p>" +
            (lank ? '<a class="mknapp primar" href="' + esc(lank.href) + '">' + esc(lank.txt) + "</a>" : "") + "</section>";
    }

    // ---------- beräkningar ----------
    function pris(f) {
        const m = f.moduler || [];
        return (m.includes("plan") ? (f.gransPlan || 0) * PRIS_PLAN : 0) + (m.includes("forma") ? (f.gransForma || 0) * PRIS_FORMA : 0);
    }
    function varningar(f) {
        const v = [], nu = Date.now();
        const pp = (f.platserPlan || []).length, pf = (f.platserForma || []).length;
        if (!(f.admins || []).length) {
            const tid = Math.max(0, ...Object.values(f.inbjudTid || {}).map(Number));
            v.push(!(f.inbjudna || []).length ? "Ingen admin och ingen inbjudan"
                : tid < nu ? "Inbjudan till admin har gått ut" : "Väntar på att admin går med");
        }
        if ((f.moduler || []).includes("plan") && f.gransPlan && pp >= f.gransPlan) v.push("Plan är fullt");
        else if ((f.moduler || []).includes("plan") && f.gransPlan && pp / f.gransPlan >= 0.8) v.push("Plan nästan fullt");
        if ((f.moduler || []).includes("forma") && f.gransForma && pf >= f.gransForma) v.push("Forma är fullt");
        else if ((f.moduler || []).includes("forma") && f.gransForma && pf / f.gransForma >= 0.8) v.push("Forma nästan fullt");
        if (f.slut && f.status !== "pausad") {
            const dagar = Math.ceil((f.slut - nu) / 864e5);
            if (dagar < 0) v.push((f.status === "prov" ? "Provperioden" : "Avtalet") + " har gått ut");
            else if (dagar <= 7) v.push((f.status === "prov" ? "Provperioden" : "Avtalet") + " slutar om " + dagar + (dagar === 1 ? " dag" : " dagar"));
        }
        return v;
    }
    const senastText = (ms) => {
        if (!ms) return "Aldrig";
        const d = Math.floor((Date.now() - ms) / 864e5);
        return d <= 0 ? "Idag" : d === 1 ? "Igår" : d + " dagar sedan";
    };

    // ---------- listan ----------
    function rita() {
        const aktiva = foretag.filter((f) => f.status !== "pausad");
        const intakt = aktiva.filter((f) => f.status === "aktiv").reduce((n, f) => n + pris(f), 0);
        const prov = foretag.filter((f) => f.status === "prov").length;
        const sorterade = foretag.slice().sort((a, b) => (a.namn || "").localeCompare(b.namn || "", "sv"));
        let h = '<div class="po-rubrikrad"><div><div class="p4-eyebrow"><span class="p4-pop"></span>Wimo</div><h1>Företag</h1>' +
            '<p class="hjalp">Varje företag har en egen, tom Wimo. Här styr du paket och gränser. Du ser bara siffror, aldrig företagens projekt.</p></div>' +
            '<button type="button" class="mknapp primar" data-po="nytt">Nytt företag</button></div>';
        h += '<div class="p4-ks-siffror po-siffror">' +
            siffra(foretag.length, foretag.length === 1 ? "företag" : "företag") +
            siffra(kr(intakt), "per månad", "aktiva företag, exkl. moms") +
            siffra(prov, prov === 1 ? "i provperiod" : "i provperiod") +
            siffra(foretag.filter((f) => f.status === "pausad").length, "pausade") +
            "</div>";
        if (!sorterade.length) h += '<section class="p4-ks-kort"><h2>Inga företag än</h2><p class="hjalp">Skapa det första företaget. Företagets admin får en inbjudan och kommer in i en tom Wimo med de moduler du väljer.</p></section>';
        else h += '<section class="p4-ks-kort po-tabellkort"><div class="po-tabellram"><table class="po-tabell"><thead><tr>' +
            "<th>Företag</th><th>Paket</th><th>Status</th><th>Plan</th><th>Forma</th><th>Personer</th><th>Senast aktiv</th><th class=\"h\">Pris/mån</th><th></th></tr></thead><tbody>" +
            sorterade.map(rad).join("") + "</tbody></table></div></section>";
        $("poSida").innerHTML = h;
    }
    const siffra = (tal, rubrik, under) => '<div class="p4-ks-siffra"><b>' + esc(tal) + "</b><span>" + esc(rubrik) + "</span>" + (under ? "<small>" + esc(under) + "</small>" : "") + "</div>";
    function matare(anv, grans, har) {
        if (!har) return '<span class="po-dampad">–</span>';
        const p = grans ? Math.min(100, Math.round(anv / grans * 100)) : 0;
        return '<div class="po-matare' + (grans && anv >= grans ? " full" : p >= 80 ? " nara" : "") + '"><span>' + anv + " av " + grans + "</span><b><i style=\"width:" + p + '%"></i></b></div>';
    }
    function rad(f) {
        const m = f.moduler || [], v = varningar(f), st = f.stat || {};
        return "<tr><td><b>" + esc(f.namn) + "</b>" + (f.kontakt && (f.kontakt.namn || f.kontakt.epost) ? "<small>" + esc([f.kontakt.namn, f.kontakt.epost].filter(Boolean).join(" · ")) + "</small>" : "") +
            (v.length ? '<div class="po-varningar">' + v.map((x) => '<span class="po-varning">' + esc(x) + "</span>").join("") + "</div>" : "") + "</td>" +
            "<td>" + esc((PAKET[f.paket] || PAKET.eget).namn) + "<small>" + esc(m.map((x) => x === "plan" ? "Plan" : "Forma").join(" + ") || "Inga moduler") + "</small></td>" +
            '<td><span class="po-status ' + esc(f.status) + '">' + esc(STATUS[f.status] || f.status) + "</span>" + (f.slut ? "<small>till " + esc(datum(f.slut)) + "</small>" : "") + "</td>" +
            "<td>" + matare((f.platserPlan || []).length, f.gransPlan || 0, m.includes("plan")) + "</td>" +
            "<td>" + matare((f.platserForma || []).length, f.gransForma || 0, m.includes("forma")) + "</td>" +
            "<td>" + (f.medlemmar || []).length + ((f.admins || []).length ? "<small>" + (f.admins || []).length + " admin</small>" : "") + "</td>" +
            "<td>" + esc(senastText(st.senast)) + (st.projektPlan ? "<small>" + st.projektPlan + " Plan-projekt</small>" : "") + "</td>" +
            '<td class="h"><b>' + esc(kr(pris(f))) + "</b></td>" +
            '<td class="h"><button type="button" class="mknapp" data-po="andra" data-id="' + esc(f.id) + '">Ändra</button></td></tr>';
    }

    // ---------- dialog ----------
    function dialog(rubrik, kropp, knappar) {
        $("poDialogRubrik").textContent = rubrik;
        $("poDialogKropp").innerHTML = kropp;
        const k = $("poDialogKnappar");
        k.innerHTML = "";
        knappar.forEach((b) => {
            const el = document.createElement("button");
            el.type = "button";
            el.className = "mknapp" + (b.primar ? " primar" : "") + (b.fara ? " fara" : "") + (b.vanster ? " po-vanster" : "");
            el.textContent = b.txt;
            el.addEventListener("click", b.fn);
            k.appendChild(el);
        });
        $("poDialog").classList.remove("dold");
        const forsta = $("poDialogKropp").querySelector("input, select");
        if (forsta) forsta.focus();
    }
    const stang = () => $("poDialog").classList.add("dold");

    function formHtml(f, ny) {
        f = f || { paket: "liten", moduler: ["plan", "forma"], status: "prov", gransPlan: 3, gransForma: 10, kontakt: {} };
        const m = f.moduler || [];
        const slut = f.slut ? new Date(f.slut).toISOString().slice(0, 10) : (ny ? new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10) : "");
        return '<div class="falt"><label for="poNamn">Företagets namn</label><input class="f" id="poNamn" value="' + esc(f.namn || "") + '" maxlength="200"></div>' +
            '<div class="falt"><label>Moduler</label><div class="po-val">' +
              '<label class="p4-ks-kryss"><input type="checkbox" id="poPlan"' + (m.includes("plan") ? " checked" : "") + "> Wimo Plan</label>" +
              '<label class="p4-ks-kryss"><input type="checkbox" id="poForma"' + (m.includes("forma") ? " checked" : "") + "> Wimo Forma</label></div></div>" +
            '<div class="falt"><label for="poPaket">Paket</label><select class="f" id="poPaket">' +
              Object.keys(PAKET).map((k) => '<option value="' + k + '"' + (f.paket === k ? " selected" : "") + ">" + PAKET[k].namn +
                (PAKET[k].plan ? " – " + PAKET[k].plan + " i Plan, " + PAKET[k].forma + " i Forma" : " – egna siffror") + "</option>").join("") + "</select></div>" +
            '<div class="po-tva"><div class="falt"><label for="poGransPlan">Redigerare i Plan</label><input class="f" id="poGransPlan" type="number" min="0" max="5000" value="' + (f.gransPlan || 0) + '"></div>' +
              '<div class="falt"><label for="poGransForma">Användare i Forma</label><input class="f" id="poGransForma" type="number" min="0" max="5000" value="' + (f.gransForma || 0) + '"></div></div>' +
            '<p class="hjalp po-pris" id="poPris"></p>' +
            '<div class="po-tva"><div class="falt"><label for="poStatusVal">Status</label><select class="f" id="poStatusVal">' +
              Object.keys(STATUS).map((k) => '<option value="' + k + '"' + (f.status === k ? " selected" : "") + ">" + STATUS[k] + "</option>").join("") + "</select></div>" +
              '<div class="falt"><label for="poSlut">Gäller till (valfritt)</label><input class="f" id="poSlut" type="date" value="' + esc(slut) + '"></div></div>' +
            '<div class="po-tva"><div class="falt"><label for="poKontaktNamn">Kontaktperson</label><input class="f" id="poKontaktNamn" value="' + esc((f.kontakt || {}).namn || "") + '"></div>' +
              '<div class="falt"><label for="poKontaktEpost">Kontaktens e-post</label><input class="f" id="poKontaktEpost" type="email" value="' + esc((f.kontakt || {}).epost || "") + '"></div></div>' +
            (ny || !(f.admins || []).length
                ? '<div class="falt"><label for="poAdmin">' + (ny ? "Företagets första admin (e-post)" : "Bjud in admin igen (e-post)") + '</label><input class="f" id="poAdmin" type="email" value="' + esc(ny ? "" : ((f.inbjudAdmin || [])[0] || "")) + '" placeholder="namn@foretag.se">' +
                  '<p class="hjalp">Admin får en inbjudan som gäller i ' + INBJUD_DAGAR + " dagar. Efter det bjuder företaget själv in sina personer. Du kan bara bjuda in så länge företaget saknar admin.</p></div>"
                : '<p class="hjalp">Företaget har ' + (f.admins || []).length + " admin och sköter själv sina personer och platser.</p>") +
            '<div class="notis rod dold" id="poFel"></div>';
    }
    function kopplaForm() {
        const uppd = () => {
            const k = $("poPaket").value, p = PAKET[k];
            if (p.plan != null) { $("poGransPlan").value = p.plan; $("poGransForma").value = p.forma; }
            $("poGransPlan").disabled = !!p.plan; $("poGransForma").disabled = !!p.plan;
            visaPris();
        };
        const visaPris = () => {
            const f = lasForm();
            $("poPris").textContent = "Pris: " + kr(pris(f)) + " per månad exkl. moms" +
                (f.moduler.includes("plan") ? " · Plan " + f.gransPlan + " × " + kr(PRIS_PLAN) : "") +
                (f.moduler.includes("forma") ? " · Forma " + f.gransForma + " × " + kr(PRIS_FORMA) : "");
        };
        $("poPaket").addEventListener("change", uppd);
        ["poGransPlan", "poGransForma", "poPlan", "poForma"].forEach((id) => $(id).addEventListener("input", visaPris));
        ["poPlan", "poForma"].forEach((id) => $(id).addEventListener("change", visaPris));
        const p = PAKET[$("poPaket").value];
        $("poGransPlan").disabled = !!p.plan; $("poGransForma").disabled = !!p.plan;
        visaPris();
    }
    function lasForm() {
        const moduler = [$("poPlan").checked ? "plan" : "", $("poForma").checked ? "forma" : ""].filter(Boolean);
        const slut = $("poSlut").value ? new Date($("poSlut").value + "T23:59:59").getTime() : 0;
        const tal = (id) => Math.max(0, Math.min(5000, parseInt($(id).value, 10) || 0));
        return { namn: $("poNamn").value.trim().slice(0, 200), moduler, paket: $("poPaket").value,
            gransPlan: moduler.includes("plan") ? tal("poGransPlan") : 0, gransForma: moduler.includes("forma") ? tal("poGransForma") : 0,
            status: $("poStatusVal").value, slut: isNaN(slut) ? 0 : slut,
            kontakt: { namn: $("poKontaktNamn").value.trim().slice(0, 200), epost: $("poKontaktEpost").value.trim().toLowerCase().slice(0, 200) } };
    }
    const fel = (t) => { const e = $("poFel"); e.textContent = t; e.classList.remove("dold"); };

    function mejlaAdmin(f, epost) {
        const amne = "Välkommen till " + (f.namn || "er") + " Wimo";
        const text = "Hej!\n\nNu finns " + (f.namn || "ert företags") + " egen Wimo, och du är inbjuden som administratör.\n\n" +
            "1. Öppna " + appLank() + "\n2. Skapa ett konto med den här e-postadressen (" + epost + ") och bekräfta adressen via mejlet du får.\n" +
            "3. Tryck på Gå med.\n\nSom administratör bjuder du sedan in dina kollegor och delar ut platser under Mitt konto.\n" +
            "Inbjudan gäller i " + INBJUD_DAGAR + " dagar.\n\nVälkommen!\nWimo";
        location.href = "mailto:" + encodeURIComponent(epost) + "?subject=" + encodeURIComponent(amne) + "&body=" + encodeURIComponent(text);
    }

    function nyttForetag() {
        dialog("Nytt företag", formHtml(null, true), [
            { txt: "Avbryt", fn: stang },
            { txt: "Skapa och bjud in", primar: true, fn: async () => {
                const f = lasForm(), admin = $("poAdmin").value.trim().toLowerCase();
                if (!f.namn) return fel("Skriv företagets namn.");
                if (!f.moduler.length) return fel("Välj minst en modul.");
                if (!epostOk(admin)) return fel("Skriv en giltig e-postadress till företagets första admin.");
                const ref = fb.fs.doc(fb.fs.collection(fb.db, "foretag"));
                try {
                    await fb.fs.setDoc(ref, Object.assign(f, {
                        admins: [], medlemmar: [], platserPlan: [], platserForma: [], stat: {},
                        inbjudna: [admin], inbjudTid: { [admin]: Date.now() + INBJUD_DAGAR * 864e5 }, inbjudAdmin: [admin],
                        skapad: fb.fs.serverTimestamp(), skapadAv: jag.uid, andrad: fb.fs.serverTimestamp() }));
                    stang();
                    status(f.namn + " är skapat. Skicka mejlet som öppnas till " + admin + ".");
                    mejlaAdmin(f, admin);
                } catch (e) { console.warn(e); fel("Företaget kunde inte skapas. Kontrollera att reglerna är publicerade. (" + (e.code || e.message) + ")"); }
            } }]);
        kopplaForm();
    }

    function andraForetag(id) {
        const f = foretag.find((x) => x.id === id);
        if (!f) return;
        const anv = { plan: (f.platserPlan || []).length, forma: (f.platserForma || []).length };
        dialog(f.namn, formHtml(f, false) +
            '<p class="hjalp">Används nu: ' + anv.plan + " redigerare i Plan och " + anv.forma + " användare i Forma. Sänker du en gräns under det som används kan företaget inte ta nya platser förrän de frigjort några.</p>", [
            { txt: f.status === "pausad" ? "Aktivera" : "Pausa", vanster: true, fara: f.status !== "pausad", fn: () => pausa(f) },
            { txt: "Avbryt", fn: stang },
            { txt: "Spara", primar: true, fn: async () => {
                const ny = lasForm();
                if (!ny.namn) return fel("Skriv företagets namn.");
                if (!ny.moduler.length) return fel("Välj minst en modul.");
                const ref = fb.fs.doc(fb.db, "foretag", f.id);
                try {
                    await fb.fs.updateDoc(ref, Object.assign(ny, { andrad: fb.fs.serverTimestamp() }));
                    const admin = $("poAdmin") ? $("poAdmin").value.trim().toLowerCase() : "";
                    if (admin && !(f.admins || []).length) {
                        if (!epostOk(admin)) return fel("Skriv en giltig e-postadress till admin.");
                        await fb.fs.updateDoc(ref, { inbjudna: [admin], inbjudTid: { [admin]: Date.now() + INBJUD_DAGAR * 864e5 }, inbjudAdmin: [admin], andrad: fb.fs.serverTimestamp() });
                        stang();
                        status("Sparat. Skicka mejlet som öppnas till " + admin + ".");
                        return mejlaAdmin(Object.assign({}, f, ny), admin);
                    }
                    stang();
                    status(ny.namn + " är sparat.");
                } catch (e) { console.warn(e); fel("Ändringen kunde inte sparas. (" + (e.code || e.message) + ")"); }
            } }]);
        kopplaForm();
    }
    async function pausa(f) {
        const ny = f.status === "pausad" ? "aktiv" : "pausad";
        try {
            await fb.fs.updateDoc(fb.fs.doc(fb.db, "foretag", f.id), { status: ny, andrad: fb.fs.serverTimestamp() });
            stang();
            status(ny === "pausad" ? f.namn + " är pausat. Personerna kan läsa men inte ändra något." : f.namn + " är aktivt igen.");
        } catch (e) { console.warn(e); fel("Statusen kunde inte ändras."); }
    }

    document.addEventListener("click", (e) => {
        const b = e.target.closest("[data-po]");
        if (!b) return;
        if (b.dataset.po === "nytt") nyttForetag();
        else if (b.dataset.po === "andra") andraForetag(b.dataset.id);
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("poDialog").classList.contains("dold")) stang(); });
    $("poDialog").addEventListener("click", (e) => { if (e.target.id === "poDialog") stang(); });

    // ---------- start ----------
    ladda().then(() => {
        fb.auth.onAuthStateChanged(fb.authInst, async (u) => {
            if (lyss) { lyss(); lyss = null; }
            jag = u;
            $("poJag").textContent = u ? (u.email || "") : "";
            if (!u) return visaMeddelande("Logga in först", "Portalen använder ditt Wimo-konto. Logga in i Wimo och öppna portalen igen.", { href: "konto.html", txt: "Logga in i Wimo" });
            try {
                const d = await fb.fs.getDoc(fb.fs.doc(fb.db, "anvandare", u.uid));
                const x = d.exists() ? d.data() : {};
                if (x.roll !== "admin" || x.status !== "godkand") return visaMeddelande("Portalen är bara för Wimo", "Ditt konto har inte åtkomst till företagsportalen.", { href: "konto.html", txt: "Till Wimo" });
            } catch (e) { return visaMeddelande("Kunde inte kontrollera kontot", "Kontrollera nätverket och ladda om sidan."); }
            lyss = fb.fs.onSnapshot(fb.fs.collection(fb.db, "foretag"), (snap) => {
                foretag = snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
                rita();
            }, (e) => {
                console.warn("Portal:", e);
                visaMeddelande("Företagen kunde inte hämtas", "Kontrollera att de nya Firestore-reglerna är publicerade. (" + (e.code || e.message) + ")");
            });
        });
    }).catch(() => visaMeddelande("Ingen kontakt", "Kunde inte ladda Firebase. Kontrollera nätverket och ladda om sidan."));

    // för tester
    window.__portal = { rita: (lista) => { foretag = lista; rita(); }, pris, varningar, nyttForetag, andraForetag };
})();
