/* ======================================================================
   Detaljvy, redigering, duplicering, serier och radering
   ====================================================================== */

/* ---------- redigera ---------- */

function visaKort(k) {
    if (k.attgora) {
        const a = fAktiviteter(state).find(x => x.id === k.attgora);
        if (a)
            return aktivitetDialog(a);
    }
    const t = T(), serie = k.fran ? serien(k, T()) : null;
    const rader = [
        ["Typ", TYPNAMN[k.typ]],
        ["Dag", dagEtikett(k.dag)],
        ["Klockslag / plats", k.tid || "—"],
        ["Vem", k.vem || "—"],
        ["Status", k.klar ? "Avbockad" : "Öppen"]
    ];
    if (serie) {
        const dagar2 = aterkomDagar(serie).map(d => DAGNAMN[d].slice(0, 3).toLowerCase()).join(", ");
        rader.push([k.virtuell ? "Återkommer" : "Förekomst av serie",
            dagar2 + (serie.tom ? " · t.o.m. " + kortDatum(serie.tom) : "") + (k.virtuell ? "" : " · frikopplad, ändras separat")]);
    }
    if (k.typ === "franvaro") {
        const per = franvaroPeriod(k), x = franvaroPerson(state, k);
        rader.push(["Person", x ? x.namn + (x.aktiv ? "" : " (inaktiv)") : k.personNamn ? k.personNamn + " (manuellt namn, ej i resursbanken)" : "Ej kopplad till resursbanken"]);
        rader.push(["Orsak", k.franvaroOrsak || "Annat"]);
        if (franvaroNy(k) && k.text)
            rader.push(["Kommentar", k.text]);
        rader.push(["Period", per.del ? kortDatum(per.fran) + " · " + tidText(k) : periodText(per.fran, per.till)]);
    }
    else if (k.tid)
        rader.push([k.typ === "mote" ? "Tid" : "Klockslag", tidText(k)]);
    if (k.plats)
        rader.push(["Plats", k.plats]);
    if (k.orsak)
        rader.push(["Senaste orsak", k.orsak]);
    let ordHtml = "";
    if (!k.virtuell && startMinut(k) === null) {
        const lista = otidsattaIDag(T(), k.dag), i = lista.indexOf(k);
        if (lista.length > 1 && i >= 0)
            ordHtml = '<div class="ordrad"><span class="hjalp" style="margin:0">Ordning bland dagens poster utan klockslag: ' +
                (i + 1) + ' av ' + lista.length + '</span>' +
                '<button type="button" class="mknapp" id="ordUpp"' + (i === 0 ? " disabled" : "") + '>↑ Flytta upp</button>' +
                '<button type="button" class="mknapp" id="ordNer"' + (i === lista.length - 1 ? " disabled" : "") + '>↓ Flytta ner</button></div>';
    }
    let resHtml = "";
    if (!k.virtuell && k.typ === "produktion" && k.roll !== "K") {
        const lage = bemanningsLage(state, k), b = k.bemanning;
        const per = momentPeriodI(T(), k);
        resHtml = '<p class="fraga" style="font-size:14px">Resurser</p>' +
            (tomBemanning(b) ? '<p class="hjalp" style="margin-top:-4px">Ingen bemanning planerad.</p>'
                : '<p class="hjalp" style="margin-top:-4px">' + kortDatum(per.fran) + (per.till !== per.fran ? "–" + kortDatum(per.till) : "") +
                    (lage.rader.length ? " · " + lage.rader.map(r => r.antal + " " + esc(r.kategori) +
                        (r.saknas ? ' <span class="saknasbem">(' + r.saknas + " ej namngivna)</span>" : "")).join(" · ") : "") + '</p>' +
                    '<ul class="kedjelista">' + (b.personer || []).map(id => {
                    const x = resPers(state, id), c = x ? resKat(state, x.kategoriId) : null;
                    return '<li><span>' + esc(x ? x.namn : "Okänd resurs") + (x && !x.aktiv ? ' <em class="inaktiv">inaktiv</em>' : "") +
                        '</span><span class="nar">' + esc(c ? c.namn : "") + '</span></li>';
                }).join("") + '</ul>');
    }
    let flyttHtml = "";
    if (!k.virtuell && k.flyttar && k.flyttar.length) {
        const sen = k.flyttar[k.flyttar.length - 1], d = new Date(sen.tid);
        const p2 = n => String(n).padStart(2, "0");
        flyttHtml = '<p class="fraga" style="font-size:14px">Flyttad</p>' +
            '<p class="hjalp" style="margin-top:-4px">Senast ' + d.getDate() + "/" + (d.getMonth() + 1) + " kl. " +
            p2(d.getHours()) + ":" + p2(d.getMinutes()) + " · " + kortDatum(sen.fran) + " → " + kortDatum(sen.till) +
            (sen.orsak ? " · " + esc(sen.orsak) : "") + '</p>' +
            (k.flyttar.length > 1 ? '<ul class="kedjelista">' + k.flyttar.slice(0, -1).reverse().map(f => {
                const fd = new Date(f.tid);
                return '<li><span class="nar">' + fd.getDate() + "/" + (fd.getMonth() + 1) + '</span><span>' +
                    kortDatum(f.fran) + " → " + kortDatum(f.till) + (f.orsak ? " · " + esc(f.orsak) : "") + '</span></li>';
            }).join("") + '</ul>' : "");
    }
    let forHtml = "";
    if (!k.virtuell && ((k.forutsattningar && k.forutsattningar.length) || (k.material && k.material.length) || (k.beredning && k.beredning.kravs))) {
        forHtml = '<p class="fraga" style="font-size:14px">Förutsättningar och material</p>';
        if (k.beredning && k.beredning.kravs) {
            forHtml += '<div class="abblock" style="margin-bottom:12px"><div class="abrad"><span>Arbetsberedning</span>' +
                '<div class="lage" id="dAb">' + Object.keys(ABTEXT).map(x => '<button type="button" data-s="' + x + '"' +
                (k.beredning.status === x ? ' class="vald"' : "") + '>' + ABTEXT[x] + '</button>').join("") + '</div></div></div>';
        }
        if (k.material && k.material.length) {
            forHtml += '<ul class="mlista">' + k.material.map(m => {
                const a = T().kort.find(x => x.id === m.avropKortId), l = T().kort.find(x => x.id === m.levKortId);
                const aDag = a ? a.dag : m.avropDag, lDag = l ? l.dag : m.levDag;
                const d = radEtikett(m), kopplad = m.foretagId && ftgPost(state, m.foretagId);
                return '<li><span class="mslagmark' + (arUe(m) ? " ue" : "") + '">' + d[0] + '</span>' +
                    '<b>' + esc(d[1] || "") + '</b>' + (d[2] ? '<span class="mlev">' + esc(d[2]) + '</span>' : "") +
                    '<span class="mstat' + (a && a.klar ? " klar" : "") + '">Avrop ' + kortDatum(aDag) + (a && a.klar ? " ✓" : "") + '</span>' +
                    '<span class="mstat' + (l && l.klar ? " klar" : "") + '">' + (arUe(m) ? "Start " : "Leverans ") + kortDatum(lDag) + (l && l.klar ? " ✓" : "") + '</span>' +
                    '<span class="mftg">' + (!kopplad && m.leverantor ? '<span class="ejkopp">ej kopplad: ' + esc(m.leverantor) + '</span>' : "") +
                    foretagValjare(state, arUe(m) ? "ue" : "leverantor", kopplad ? m.foretagId : null, "mrad-" + m.id, "", true) + '</span></li>';
            }).join("") + '</ul>';
        }
        if (k.forutsattningar && k.forutsattningar.length) {
            forHtml += '<ul class="flista">' + k.forutsattningar.map(f => '<li data-f="' + f.id + '"><span class="fstatus ' + (f.status === "saknas" ? "saknas" : "sakrad") + '">' +
                (f.status === "saknas" ? "Saknas" : f.status === "ejrelevant" ? "Ej relevant" : "Säkrad") + '</span>' +
                '<span>' + esc(f.txt || omradeNamn(f.omrade)) + '</span>' +
                (f.omrade !== "beredning" ? '<button type="button" class="sakraknapp">' +
                    (f.status === "saknas" ? "Säkra" : "Öppna igen") + '</button>' : "") +
                '</li>').join("") + '</ul>';
        }
    }
    if (!k.virtuell && k.typ === "avrop" && typeof avrBestDetalj === "function") {
        const best = k.avrop && k.avrop.best;
        forHtml += '<p class="fraga avr-rubrik" style="font-size:14px">Beställning' + (best && best.mallNamn ? ' <small>' + esc(best.mallNamn) + "</small>" : "") +
            '<button type="button" class="p4d-lank" id="dBest">' + (best ? "Ändra" : "+ Lägg till beställning") + "</button></p>" +
            (best ? avrBestDetalj(best, k) : "");
    }
    if (!k.virtuell && k.typ === "avrop" && !k.kedja) {
        const eget = k.avrop || {}, kopp = eget.foretagId && ftgPost(state, eget.foretagId);
        forHtml += '<p class="fraga" style="font-size:14px">Företag</p><div class="mftg">' +
            (!kopp && eget.leverantor ? '<span class="ejkopp">ej kopplad: ' + esc(eget.leverantor) + '</span>' : "") +
            foretagValjare(state, eget.slag === "ue" ? "ue" : "", kopp ? eget.foretagId : null, "avrop-" + k.id, "", true) + '</div>';
    }
    let kedjeHtml = "";
    if (k.kedja) {
        const kedjan = t.kort.filter(x => x.kedja === k.kedja).sort((a, b) => a.dag < b.dag ? -1 : 1);
        kedjeHtml = '<p class="fraga" style="font-size:14px">Kedjan</p><ul class="kedjelista">' +
            kedjan.map(x => '<li><span class="nar">' + dagEtikett(x.dag) + '</span>' +
                '<span class="' + (x.klar ? "avbockat" : "") + '" style="color:var(--' + x.typ + ')">' + esc(kortText(x, T(), projektForTavla(T()))) + '</span>' +
                (inomTavlan(x.dag) ? "" : '<span class="utanforflagg">utanför aktuell plan</span>' +
                    '<button type="button" class="kedjebock" data-k="' + x.id + '">' + (x.klar ? "Ångra" : "Markera klart") + '</button>') +
                '</li>').join("") +
            '</ul>';
    }
    const kropp = (typeof tpTvKortInfo === "function" ? tpTvKortInfo(k) : "") + '<ul class="detalj">' +
        rader.map(r => '<li><span class="et">' + r[0] + '</span><span>' + esc(r[1]) + '</span></li>').join("") + '</ul>' +
        ordHtml + resHtml + flyttHtml + forHtml + kedjeHtml +
        '<div class="falt" style="margin-top:14px"><label for="dNot">Anteckningar</label>' +
        '<p class="hjalp">Metod, mängd, avvikelse, vad som sades på mötet. Syns som en prick på kortet.</p>' +
        '<textarea class="f" id="dNot" rows="3">' + esc(k.not || "") + '</textarea>' +
        '<div class="p4-mailrad"><button type="button" class="mknapp p4-mailknapp" id="dMaila"' + (k.not || (k.avrop && k.avrop.best) ? "" : " disabled") +
        ' title="Öppnar ett nytt mejl i Outlook (eller ditt vanliga mejlprogram) med anteckningarna">' +
        '<span class="p4-mailikon" aria-hidden="true"></span>Maila</button>' +
        '<span class="hjalp" id="dMailaHjalp">' + (k.not ? "" : k.avrop && k.avrop.best ? "Mejlet blir en färdig beställning till leverantören" : "Skriv en anteckning först") + "</span></div></div>";
    const knappar = [];
    if (k.virtuell) {
        knappar.push({ txt: "Serien…", vanster: true, fn: () => { sparaNot(k); seriensVal(k); } });
    }
    else {
        knappar.push({ txt: "Ändra", vanster: true, fn: () => { sparaNot(k); redigeraKort(k); } });
        knappar.push({ txt: "Nytt hinder", fn: () => {
                sparaNot(k);
                hinderDialog({ kedja: k.kedja || null, text: k.text, dag: k.dag }, null);
            } });
    }
    if (kanDupliceras(k))
        knappar.push({ txt: "Duplicera", fn: () => { sparaNot(k); dupliceraDialog(k); } });
    if (!k.virtuell && (k.typ === "avrop" || k.typ === "leverans" || k.typ === "ue"))
        knappar.push({ txt: "Flytta denna post", fn: () => { sparaNot(k); flyttaEnskildDialog(k); } });
    if (!k.virtuell && k.typ === "produktion" && k.roll !== "K")
        knappar.push({ txt: "Bemanning", fn: () => { sparaNot(k); bemanningDialog(k); } });
    if (k.kedja)
        knappar.push({ txt: valdKedja === k.kedja ? "Dölj kedjan" : "Visa kedjan", fn: () => {
                sparaNot(k);
                valdKedja = valdKedja === k.kedja ? null : k.kedja;
                stangModal();
                rita();
            } });
    knappar.push({ txt: "Stäng", fn: () => { sparaNot(k); stangModal(); spara(); rita(); } });
    knappar.push({ txt: k.klar ? "Ångra avbockning" : "Markera klart", primar: true, fn: () => {
            sparaNot(k);
            bockaKort(k, stangModal);
        } });
    modal(k.typ === "franvaro" && franvaroNy(k) ? franvaroTitel(state, k) : kortText(k, T(), projektForTavla(T())), TYPNAMN[k.typ] + " · " + dagEtikett(k.dag), kropp, knappar);
    // Maila: nytt mejl med kortets uppgifter och anteckningarna
    const not = document.getElementById("dNot"), mail = document.getElementById("dMaila");
    if (not && mail) {
        const harBest = !!(k.avrop && k.avrop.best);
        not.addEventListener("input", () => {
            mail.disabled = !not.value.trim() && !harBest;
            document.getElementById("dMailaHjalp").textContent = mail.disabled ? "Skriv en anteckning först" : !not.value.trim() && harBest ? "Mejlet blir en färdig beställning till leverantören" : "";
        });
        mail.addEventListener("click", () => { sparaNot(k); valjMottagare(k, t, mail, till => mailaAnteckning(k, t, not.value.trim(), till)); });
    }
    const dB = document.getElementById("dBest");
    if (dB)
        dB.addEventListener("click", () => { sparaNot(k); avrBestDialog(k, () => visaKort(k)); });
    const oU = document.getElementById("ordUpp"), oN = document.getElementById("ordNer");
    if (oU)
        oU.addEventListener("click", () => { sparaNot(k); if (flyttaIDag(k, -1)) {
            stangModal();
            visaKort(k);
        } });
    if (oN)
        oN.addEventListener("click", () => { sparaNot(k); if (flyttaIDag(k, 1)) {
            stangModal();
            visaKort(k);
        } });
    kopplaForetagValjare(document.getElementById("overlay"), state, (sel, id) => {
        const f = sel.dataset.f || "";
        if (f.indexOf("mrad-") === 0) {
            const m = (k.material || []).find(x => x.id === f.slice(5));
            if (!m)
                return;
            m.foretagId = id;
            logg("Företag " + (id ? "kopplat" : "bortkopplat") + ": " + (m.txt || "materialrad") + (id ? " → " + ftgPost(state, id).namn : ""));
        }
        else if (f.indexOf("avrop-") === 0) {
            if (!k.avrop) {
                let txt = k.text.replace(" · gör idag", "");
                if (txt.indexOf("Avrop · ") === 0)
                    txt = txt.slice(8);
                k.avrop = { slag: null, txt: txt, leverantor: "", levDag: "", levKortId: null, foretagId: null };
            }
            k.avrop.foretagId = id;
            logg("Företag " + (id ? "kopplat" : "bortkopplat") + ": " + k.text + (id ? " → " + ftgPost(state, id).namn : ""));
        }
        spara();
        rita();
        sparaNot(k);
        stangModal();
        visaKort(k);
    });
    document.querySelectorAll(".kedjebock").forEach(b => b.addEventListener("click", () => {
        const t = T();
        const x = t.kort.find(y => y.id === b.dataset.k);
        if (!x)
            return;
        if (!x.klar && x.dag > IDAG) {
            return framtidsKontroll(x.dag, () => {
                const p = opBockaKedjekort(x, t.id, null, null);
                if (!p.ok || p.andringar[0].falt.klar !== true)
                    return;
                if (!appliceraPatch(p, { tavla: t, projekt: state }))
                    return;
                p.historik.forEach(h => logg(h));
                spara();
                rita();
                visaKort(k);
            });
        }
        const patch = opBockaKedjekort(x, t.id, null, null);
        if (!patch.ok)
            return;
        if (!appliceraPatch(patch, { tavla: t, projekt: state }))
            return;
        patch.historik.forEach(h => logg(h));
        sparaNot(k);
        stangModal();
        spara();
        rita();
        visaKort(k);
    }));
    document.querySelectorAll("#dAb button").forEach(b => b.addEventListener("click", () => {
        sattBeredning(k, b.dataset.s);
        sparaNot(k);
        stangModal();
        spara();
        rita();
        visaKort(k);
    }));
    document.querySelectorAll(".flista .sakraknapp").forEach(b => b.addEventListener("click", () => {
        const id = b.closest("li").dataset.f;
        const f = (k.forutsattningar || []).find(x => x.id === id);
        if (!f)
            return;
        if (f.status === "saknas")
            sakraForutsattning(k, f);
        else {
            osakraForutsattning(k, f);
            logg("Förutsättning öppnad igen: " + (f.txt || omradeNamn(f.omrade)));
        }
        sparaNot(k);
        stangModal();
        spara();
        rita();
        visaKort(k);
    }));
}

function sakraForutsattning(k, f, tyst) {
    const patch = opSakraForutsattning(k, f, hinderTillF(f, T()), tyst, f.txt || omradeNamn(f.omrade), null, null);
    if (!appliceraPatch(patch, { tavla: T(), projekt: state }))
        return;
    patch.historik.forEach(h => logg(h));
}

function osakraForutsattning(k, f) {
    appliceraPatch(opOsakraForutsattning(k, f, hinderTillF(f, T()), omradeNamn(f.omrade), null, null), { tavla: T(), projekt: state });
}

function sattHinderStatus(h, lost) {
    const patch = opSattHinderStatus(h, lost, null);
    if (!appliceraPatch(patch, { tavla: T(), projekt: state }))
        return;
    const par = parTillHinder(h, T());
    if (!par)
        return;
    par.f.status = lost ? "sakrad" : "saknas";
    if (par.f.omrade === "beredning" && par.kort.beredning) {
        if (lost)
            par.kort.beredning.status = "utford";
        else if (par.kort.beredning.status === "utford")
            par.kort.beredning.status = "planerad";
    }
}

function sattBeredning(k, status) {
    const f = (k.forutsattningar || []).find(x => x.omrade === "beredning");
    const patch = opSattBeredning(k, status, f ? hinderTillF(f, T()) : null, "Arbetsberedning ej utförd", omradeNamn("beredning"), ABTEXT[status].toLowerCase(), null, null);
    if (!appliceraPatch(patch, { tavla: T(), projekt: state }))
        return;
    patch.historik.forEach(h => logg(h));
}

function sparaNot(k) {
    const el = document.getElementById("dNot");
    if (!el)
        return;
    const v = el.value.trim();
    if (k.virtuell) {
        const s = serien(k, T());
        if (s && v !== (s.not || ""))
            s.not = v;
    }
    else
        appliceraPatch(opSattNot(k, v), { tavla: T(), projekt: state });
}

function flyttaEnskildDialog(k) {
    const t = T(), l = lankadRad(t, k);
    const bar = k.kedja ? t.kort.find(x => x.kedja === k.kedja && (x.roll === "S" || x.roll === "P")) : null;
    const vad = l && l.del === "L" ? (l.rad.slag === "ue" ? "UE-starten" : "leveransen") : "avropet";
    const kropp = '<p class="hjalp" style="margin-top:0">Flyttar bara ' + vad + '. ' +
        (bar ? "Produktionsmomentet " + esc(momentNamn(bar)) + " (" + kortDatum(bar.dag) + ") flyttas inte." : "") + '</p>' +
        '<div class="falt"><label for="feDag">Nytt datum</label><input class="f" id="feDag" type="date" value="' + k.dag + '"></div>' +
        '<div id="feVarn"></div>';
    modal("Flytta " + kortText(k, T(), projektForTavla(T())), "Nu " + dagEtikett(k.dag), kropp, [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Flytta", primar: true, fn: () => {
                const d = document.getElementById("feDag").value;
                if (!d || d === k.dag)
                    return stangModal();
                if ((iso2d(d).getDay() + 6) % 7 > 4) {
                    document.getElementById("feVarn").innerHTML = '<div class="notis rod">Välj en vardag.</div>';
                    return;
                }
                utfor(k, d, null);
                status(kortText(k, T(), projektForTavla(T())) + " flyttad till " + kortDatum(d));
            } }
    ]);
    const inp = document.getElementById("feDag"), box = document.getElementById("feVarn");
    const kolla = () => {
        const d = inp.value, v = [];
        if (bar && l && l.del === "L" && d > bar.dag)
            v.push((l.rad.slag === "ue" ? "UE-starten" : "Leveransen") + " hamnar efter momentets start " + kortDatum(bar.dag) + ".");
        if (l && l.del === "A") {
            const lev = t.kort.find(x => x.id === l.rad.levKortId);
            if (lev && d > lev.dag)
                v.push("Avropet hamnar efter " + (l.rad.slag === "ue" ? "UE-starten" : "leveransen") + " " + kortDatum(lev.dag) + ".");
        }
        box.innerHTML = v.length ? '<div class="notis">⚠ ' + v.join("<br>") + ' Du kan flytta ändå.</div>' : "";
    };
    inp.addEventListener("change", kolla);
}

function dagsvy(iso) {
    const t = T(), lista = dagsvyPoster(t, iso, projektForTavla(t));
    const pag = t.visaPagaende ? pagaendeForDag(t, iso) : [];
    const rad = k => {
        const tid = k.tid && startMinut(k) !== null ? tidText(k) : "";
        const namn = k.typ === "franvaro" && franvaroNy(k) ? franvaroTitel(state, k) : kortText(k, t, projektForTavla(t));
        const extra = [];
        if (k.typ === "franvaro" && franvaroNy(k))
            extra.push(franvaroUnder(state, k));
        const m = k.virtuell ? null : momentFor(k, T());
        if (m)
            extra.push("→ " + m);
        if (k.plats && k.typ !== "franvaro")
            extra.push(k.plats);
        if (k.typ === "produktion" && !k.virtuell && !tomBemanning(k.bemanning))
            extra.push("👷 " + bemanningsText(state, k));
        if (k.vem && k.typ !== "franvaro")
            extra.push(k.vem);
        return '<li class="dvrad t-' + k.typ + (k.klar ? " klar" : "") + '"><span class="dvtid">' + esc(tid) + '</span>' +
            '<span class="dvtext"><b>' + (k.klar ? "✓ " : "") + esc(namn) + '</b>' +
            (extra.length ? '<span>' + esc(extra.join(" · ")) + '</span>' : "") + '</span></li>';
    };
    const vv = vaderTraffar(iso);
    const kropp = (vv.length ? '<div class="notis rod" style="margin-top:0">⚠ ' + esc(vv.join(" · ")) + '</div>' : "") +
        (lista.length ? '<ul class="dvlista">' + lista.map(rad).join("") + '</ul>' : '<p class="hjalp">Inga poster.</p>') +
        (pag.length ? '<div class="pagaende dv"><span class="prub">Pågående</span>' +
            pag.map(x => '<div class="prad">› ' + esc(x.text) + '</div>').join("") + '</div>' : "");
    modal(DAGNAMN[(iso2d(iso).getDay() + 6) % 7] + " " + iso2d(iso).getDate() + " " + MANAD[iso2d(iso).getMonth()], t.namn + " · v." + veckonr(iso), kropp, [{ txt: "Stäng", primar: true, fn: stangModal }]);
    const o = document.getElementById("overlay");
    if (o) {
        o.classList.add("dagsvy");
        o.addEventListener("click", e => { if (e.target === o)
            stangModal(); });
    }
}

function dupliceraDialog(k) {
    if (k.typ === "franvaro" && (k.personId || !k.virtuell)) {
        const per = franvaroPeriod(k), skift = 7;
        return franvaroDialog(null, { personId: k.personId || "", personNamn: k.personNamn || "", franvaroOrsak: k.franvaroOrsak, text: franvaroNy(k) ? k.text : "",
            dag: plus(per.fran, skift), tillDag: per.till !== per.fran ? plus(per.till, skift) : "", tid: k.tid, slutTid: k.slutTid });
    }
    const mote = k.typ === "mote", fr = k.typ === "franvaro";
    const dag = plus(k.dag, 7);
    let orsak = k.franvaroOrsak || FRANVARO[0];
    const kropp = '<p class="hjalp" style="margin-top:0">En ny post skapas med uppgifterna nedan. ' +
        'Originalet ändras inte, och varken avbockning, flytthistorik eller kopplingar följer med.</p>' +
        '<div class="falt"><label for="duText">Text</label><input class="f" id="duText" value="' + esc(k.text) + '"></div>' +
        '<div class="tva"><div class="falt"><label for="duDag">Nytt datum</label>' +
        '<input class="f" id="duDag" type="date" value="' + dag + '"></div>' +
        (fr ? "" : '<div class="falt"><label for="duTill">Till och med (valfritt)</label>' +
        '<input class="f" id="duTill" type="date"></div>') + '</div>' +
        (fr ? "" : '<p class="hjalp" style="margin-top:-4px">Med Till och med blir det en kopia per vardag, t.ex. måndag till onsdag.</p>') +
        (mote ? '<div class="tva"><div class="falt"><label for="duStart">Börjar</label>' +
            '<input class="f" id="duStart" type="time" value="' + esc(k.tid || "") + '"></div>' +
            '<div class="falt"><label for="duSlut">Slutar</label>' +
            '<input class="f" id="duSlut" type="time" value="' + esc(k.slutTid || "") + '"></div></div>' +
            '<div class="falt"><label for="duPlats">Plats</label><input class="f" id="duPlats" value="' + esc(k.plats || "") + '"></div>'
            : '<div class="falt"><label for="duTid">Klockslag</label><input class="f" id="duTid" value="' + esc(k.tid || "") + '"></div>') +
        (fr ? '<div class="falt"><label>Orsak</label><div class="lage" id="duOrsak">' + FRANVARO.map(o => '<button type="button" data-o="' + o + '"' + (o === orsak ? ' class="vald"' : "") + '>' + o + '</button>').join("") + '</div></div>' : "") +
        '<div class="falt"><label for="duVem">' + (fr ? "Person" : "Vem") + '</label><input class="f" id="duVem" value="' + esc(k.vem || "") + '"></div>' +
        '<div id="duFel"></div>';
    modal("Duplicera", TYPNAMN[k.typ] + " · från " + dagEtikett(k.dag), kropp, [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Skapa kopia", primar: true, fn: () => {
                const d = document.getElementById("duDag").value;
                const fel = document.getElementById("duFel");
                if (!d) {
                    fel.innerHTML = '<div class="notis rod">Välj ett datum.</div>';
                    return;
                }
                const vd = (iso2d(d).getDay() + 6) % 7;
                if (vd > 4) {
                    fel.innerHTML = '<div class="notis rod">Tavlan visar måndag till fredag — välj en vardag.</div>';
                    return;
                }
                let tid = "", slut = "", plats = "";
                if (mote) {
                    tid = document.getElementById("duStart").value;
                    slut = document.getElementById("duSlut").value;
                    plats = document.getElementById("duPlats").value.trim();
                    if (tid && slut && slut <= tid) {
                        fel.innerHTML = '<div class="notis rod">Sluttiden måste vara senare än starttiden.</div>';
                        return;
                    }
                    if (!tid)
                        slut = "";
                }
                else
                    tid = document.getElementById("duTid").value.trim();
                const t = T();
                // en kopia per vardag från Nytt datum till och med Till och med
                const tillEl = document.getElementById("duTill"), till = tillEl ? tillEl.value : "";
                if (till && till < d) {
                    fel.innerHTML = '<div class="notis rod">Till och med måste vara samma dag eller senare.</div>';
                    return;
                }
                const dagarna = [];
                for (let x = d; x <= (till || d) && dagarna.length < 60; x = plus(x, 1))
                    if ((iso2d(x).getDay() + 6) % 7 < 5) dagarna.push(x);
                for (const dg of dagarna) {
                    const patch = opDupliceraKort(k, { dag: dg,
                        text: document.getElementById("duText").value.trim() || k.text,
                        tid: tid, vem: document.getElementById("duVem").value.trim(),
                        mote: mote, slutTid: slut, plats: plats, franvaro: fr, franvaroOrsak: orsak }, t.id, null, null);
                    if (!appliceraPatch(patch, { tavla: t, projekt: state }))
                        return;
                    patch.historik.forEach(h => logg(h));
                }
                stangModal();
                spara();
                rita();
                const sista = dagarna[dagarna.length - 1];
                status((dagarna.length > 1 ? dagarna.length + " kopior skapade " + kortDatum(d) + "–" + kortDatum(sista) : "Kopia skapad " + kortDatum(d)) +
                    (inomTavlan(d) && inomTavlan(sista) ? "" : " · utanför aktuell plan"));
            } }
    ]);
    document.querySelectorAll("#duOrsak button").forEach(b => b.addEventListener("click", () => {
        orsak = b.dataset.o;
        document.querySelectorAll("#duOrsak button").forEach(x => x.classList.toggle("vald", x === b));
    }));
}

function seriensVal(k) {
    const s = serien(k, T());
    if (!s)
        return;
    const kropp = '<p class="fraga">' + esc(s.text) + ' · ' + dagEtikett(k.dag) + '</p>' +
        '<p class="hjalp">Välj om ändringen gäller bara den här dagen eller hela serien.</p>' +
        '<div class="seriernaval">' +
        '<button type="button" class="mknapp" id="svAndraEn">Ändra endast denna förekomst</button>' +
        '<button type="button" class="mknapp" id="svTaBortEn">Ta bort endast denna förekomst</button>' +
        '<button type="button" class="mknapp" id="svAndraAlla">Ändra hela serien</button>' +
        '<button type="button" class="mknapp fara" id="svTaBortAlla">Ta bort hela serien</button>' +
        '</div>';
    modal("Återkommande post", "", kropp, [{ txt: "Avbryt", primar: true, fn: stangModal }]);
    document.getElementById("svAndraEn").addEventListener("click", () => {
        const ny = materialisera(k, {});
        logg("Enskild förekomst frikopplad " + kortDatum(k.dag) + ": " + s.text);
        stangModal();
        spara();
        rita();
        redigeraKort(ny);
    });
    document.getElementById("svTaBortEn").addEventListener("click", () => {
        T().skippa.push(s.id + "|" + k.dag);
        logg("Förekomst borttagen " + kortDatum(k.dag) + ": " + s.text);
        stangModal();
        spara();
        rita();
    });
    document.getElementById("svAndraAlla").addEventListener("click", () => { stangModal(); hanteraSerie(k); });
    document.getElementById("svTaBortAlla").addEventListener("click", () => {
        const t = T();
        taBortSerieSyskon(s);
        t.aterkom = t.aterkom.filter(x => x.id !== s.id);
        const bortS = t.kort.filter(x => x.fran === s.id && !x.klar).map(x => x.id);
        t.kort = t.kort.filter(x => x.fran !== s.id || x.klar);
        rensaHinderRef(t, bortS);
        rensaMaterialRef(t, bortS);
        t.skippa = t.skippa.filter(x => x.split("|")[0] !== s.id);
        logg("Återkommande serie borttagen: " + s.text);
        stangModal();
        spara();
        rita();
    });
}

function hanteraSerie(k) {
    const s = serien(k, T());
    if (!s)
        return;
    const mote = s.typ === "mote";
    const kropp = '<div class="falt"><label for="sText">Text</label><input class="f" id="sText" value="' + esc(s.text) + '"></div>' +
        '<div class="falt"><label>Veckodagar</label><div class="krysslista">' +
        DAGNAMN.map((d, i) => '<label><input type="checkbox" class="sVdag" value="' + i + '"' +
            (aterkomDagar(s).indexOf(i) >= 0 ? " checked" : "") + '> ' + d.slice(0, 3) + '</label>').join("") + '</div></div>' +
        (mote
            ? '<div class="tva"><div class="falt"><label for="sStart">Börjar</label>' +
                '<input class="f" id="sStart" type="time" value="' + esc(s.tid || "") + '"></div>' +
                '<div class="falt"><label for="sSlut">Slutar</label>' +
                '<input class="f" id="sSlut" type="time" value="' + esc(s.slutTid || "") + '"></div></div>' +
                '<div class="falt"><label for="sPlats">Plats</label><input class="f" id="sPlats" value="' + esc(s.plats || "") + '"></div>'
            : '<div class="falt"><label for="sTid">Klockslag / plats</label><input class="f" id="sTid" value="' + esc(s.tid || "") + '"></div>') +
        '<div class="tva"><div class="falt"><label for="sVem">Vem</label><input class="f" id="sVem" value="' + esc(s.vem || "") + '"></div>' +
        '<div class="falt"><label for="sTom">Till och med (valfritt)</label>' +
        '<input class="f" id="sTom" type="date" value="' + esc(s.tom || "") + '"></div></div>' +
        '<p class="hjalp">Ändringar gäller alla förekomster. Vill du bara ändra eller ta bort den här dagen ' +
        'använder du knapparna nedan — serien påverkas inte.</p>' +
        (mote ? moteTavlorHtml(serieSyskon(s).map(x => x.t.id), T().id) : "") +
        '<div id="sFel"></div>';
    modal("Återkommande post", s.text, kropp, [
        { txt: serieSyskon(s).length ? "Ta bort serien på alla tavlor" : "Ta bort hela serien", vanster: true, fara: true, fn: () => {
                const t = T();
                taBortSerieSyskon(s);
                t.aterkom = t.aterkom.filter(x => x.id !== s.id);
                const bortH = t.kort.filter(x => x.fran === s.id).map(x => x.id);
                t.kort = t.kort.filter(x => x.fran !== s.id);
                rensaHinderRef(t, bortH);
                rensaMaterialRef(t, bortH);
                t.skippa = t.skippa.filter(x => x.split("|")[0] !== s.id);
                logg("Återkommande post borttagen: " + s.text);
                stangModal();
                spara();
                rita();
            } },
        { txt: "Ändra bara " + kortDatum(k.dag), fn: () => {
                const ny = materialisera(k, {});
                logg("Enskild förekomst frikopplad " + kortDatum(k.dag) + ": " + s.text);
                stangModal();
                spara();
                rita();
                redigeraKort(ny);
            } },
        { txt: "Ställ in " + kortDatum(k.dag), fn: () => {
                T().skippa.push(s.id + "|" + k.dag);
                logg("Inställt " + kortDatum(k.dag) + ": " + s.text);
                stangModal();
                spara();
                rita();
            } },
        { txt: "Avbryt", fn: stangModal },
        { txt: "Spara serien", primar: true, fn: () => {
                const valda = Array.prototype.slice.call(document.querySelectorAll(".sVdag:checked")).map(e => +e.value);
                if (!valda.length) {
                    document.getElementById("sFel").innerHTML = '<div class="notis rod">Välj minst en veckodag.</div>';
                    return;
                }
                if (mote) {
                    const st = document.getElementById("sStart").value, sl = document.getElementById("sSlut").value;
                    if (st && sl && sl <= st) {
                        document.getElementById("sFel").innerHTML =
                            '<div class="notis rod">Sluttiden måste vara senare än starttiden.</div>';
                        return;
                    }
                    s.tid = st;
                    s.slutTid = st ? sl : "";
                    s.plats = document.getElementById("sPlats").value.trim();
                }
                else
                    s.tid = document.getElementById("sTid").value.trim();
                s.text = document.getElementById("sText").value.trim() || s.text;
                s.vdagar = valda;
                delete s.vdag;
                s.vem = document.getElementById("sVem").value.trim();
                s.tom = document.getElementById("sTom").value || "";
                if (mote) uppdateraSerieTavlor(s, T());
                synkaSerie(s);
                stangModal();
                spara();
                rita();
            } }
    ]);
}

function radInfo(r) {
    const d = [radRubrik(r)];
    if (r.rad) {
        d.push(r.rad.txt || "–");
        d.push(ftgNamn(state, r.rad) || "–");
    }
    else {
        let txt = r.kort.text.replace(" · gör idag", "");
        ["Avrop ", "Lev. ", "UE start "].forEach(pre => { if (txt.indexOf(pre) === 0)
            txt = txt.slice(pre.length); });
        d.push(txt || "–");
    }
    d.push(kortDatum(r.kort.dag));
    return d.join(" · ");
}

function raderaKort(k, extraLogg) {
    angraForeAvbryt();
    const t = T();
    const patch = opRaderaKort(k, t, extraLogg, null, null);
    if (!appliceraPatch(patch, { tavla: t, projekt: state }))
        return;
    if (k.fran && t.skippa.indexOf(k.fran + "|" + k.dag) < 0)
        t.skippa.push(k.fran + "|" + k.dag);
    patch.historik.forEach(h => logg(h));
    stangModal();
    spara();
    rita();
}

function raderaMoment(k) {
    const t = T();
    const rader = kopplade(k);
    const slut = k.roll === "S" ? parKort(k, "K", T()) : null;
    if (!rader.length)
        return raderaKort(k);
    const namn = momentNamn(k);
    const bock = r => r.kort.klar ? '<span class="kbock">✓</span>' : "";
    const kropp = '<p class="fraga">' + esc(namn) + '</p>' +
        '<p class="hjalp">Det här hör till momentet och tas alltid bort med det:</p>' +
        '<ul class="radlista"><li>' + esc(k.text) + ' · ' + kortDatum(k.dag) + '</li>' +
        (slut ? '<li>' + (slut.klar ? '<span class="kbock">✓</span>' : "") + esc(slut.text) + ' · ' + kortDatum(slut.dag) + '</li>' : "") +
        '</ul>' +
        '<p class="hjalp" style="margin-top:12px">Kopplade poster (' + rader.length + '):</p>' +
        '<ul class="radlista">' + rader.map(r => '<li>' + bock(r) + esc(radInfo(r)) + '</li>').join("") + '</ul>' +
        '<div class="notis">Behåller du de kopplade posterna ligger de kvar på sina datum som fristående poster, ' +
        'med typ, leverantör och leveransdatum intakta i avropslistan. Kolumnen Tillhör moment blir –.</div>' +
        '<div class="notis rod">Tar du bort allt försvinner även redan utförda poster som tillhör momentet.</div>';
    modal("Momentet har kopplade aktiviteter", "", kropp, [
        { txt: "Ta bort allt", vanster: true, fara: true, fn: () => taBortAllt(k, rader) },
        { txt: "Behåll kopplade poster", fn: () => behallKopplade(k, rader, slut) },
        { txt: "Avbryt", primar: true, fn: stangModal }
    ]);
}

function behallKopplade(k, rader, slut) {
    angraForeAvbryt();
    const t = T();
    const patch = opBehallKopplade(k, rader, slut, t, null, null);
    if (!appliceraPatch(patch, { tavla: t, projekt: state }))
        return;
    patch.historik.forEach(h => logg(h));
    stangModal();
    spara();
    rita();
    status("Momentet borttaget, kopplade poster kvar");
}

function taBortAllt(k, rader) {
    angraForeAvbryt();
    const t = T();
    const patch = opTaBortAllt(k, rader, t, null, null);
    if (!appliceraPatch(patch, { tavla: t, projekt: state }))
        return;
    patch.historik.forEach(h => logg(h));
    stangModal();
    spara();
    rita();
    status("Momentet och " + (patch.bort.length - 1) + " poster borttagna");
}

function redigeraKort(k) {
    if (k.typ === "franvaro" && !k.virtuell)
        return franvaroDialog(k);
    // Kort i ett moment (avrop, leverans, klart) delar momentets Plats / del, som ligger på startposten.
    const momentBar = k.kedja ? T().kort.find(x => x.kedja === k.kedja && (x.roll === "S" || x.roll === "P") && x.id !== k.id) : null;
    const platsVarde = momentBar && !k.plats ? momentBar.plats || "" : k.plats || "";
    const kropp = (typeof tpTvKortInfo === "function" ? tpTvKortInfo(k) : "") +
        '<div class="falt"><label for="rText">Text</label><input class="f" id="rText" value="' + esc(k.text) + '"></div>' +
        '<div class="tva"><div class="falt"><label for="rDag">Dag</label><select class="f" id="rDag">' + dagOptioner(k.dag) + '</select></div>' +
        '<div class="falt"><label for="rTyp">Typ</label><select class="f" id="rTyp">' +
        TYPER.map(t => '<option value="' + t + '"' + (t === k.typ ? " selected" : "") + '>' + TYPNAMN[t] + '</option>').join("") +
        '</select></div></div>' +
        (k.typ === "mote"
            ? '<div class="tva"><div class="falt"><label for="rStart">Börjar</label>' +
                '<input class="f" id="rStart" type="time" value="' + esc(k.tid || "") + '"></div>' +
                '<div class="falt"><label for="rSlut">Slutar</label>' +
                '<input class="f" id="rSlut" type="time" value="' + esc(k.slutTid || "") + '"></div></div>' +
                '<div class="tva"><div class="falt"><label for="rPlats">Plats</label>' +
                '<input class="f" id="rPlats" value="' + esc(k.plats || "") + '"></div>'
            : '<div class="tva"><div class="falt"><label for="rTid">Klockslag</label>' +
                '<input class="f" id="rTid" value="' + esc(k.tid || "") + '"></div>' +
                '</div><div class="tva"><div class="falt"><label for="rPlats">Plats / del</label>' +
                    '<input class="f" id="rPlats" value="' + esc(platsVarde) + '" placeholder="T.ex. Del 1:3">' +
                    (momentBar ? '<p class="hjalp" style="margin:4px 0 0">Gäller hela momentet ' + esc(momentNamn(momentBar)) + "</p>" : "") +
                    "</div>") +
        '<div class="falt"><label for="rVem">Vem</label><input class="f" id="rVem" value="' + esc(k.vem || "") + '"></div></div>' +
        (k.typ === "produktion" ? '<label class="milstolpeval"><input type="checkbox" id="rMil"' + (k.milstolpe ? " checked" : "") + '><span class="milstolpe-ik" aria-hidden="true"></span><span><b>Milstolpe</b><small>Märks med en symbol på tavlan och i Gantt-schemat</small></span></label>' : "") +
        (k.typ === "franvaro" ? '<div class="falt"><label for="rFOrsak">Orsak</label><select class="f" id="rFOrsak">' +
            FRANVARO.map(o => '<option' + (o === (k.franvaroOrsak || "Annat") ? " selected" : "") + '>' + o + '</option>').join("") +
            '</select></div>' : "") +
        (k.typ === "mote" && !k.fran && !k.virtuell ? moteTavlorHtml(moteSyskon(k).map(x => x.t.id), T().id) : "") +
        (k.typ === "ue" && !k.fran && !k.virtuell && !k.kedja && !k.roll ? ueSerieFaltHtml(T(), k) : "") +
        '<div id="rFel"></div>' +
        '<div class="falt"><label for="rNot">Anteckningar</label><textarea class="f" id="rNot" rows="3">' + esc(k.not || "") + '</textarea></div>' +
        (k.orsak ? '<div class="notis">Flyttad tidigare — orsaksord: ' + esc(k.orsak) + '</div>' : "");
    modal("Ändra post", "", kropp, [
        { txt: "Ta bort", vanster: true, fara: true, fn: () => {
                if (k.typ === "produktion" && k.roll !== "K")
                    return raderaMoment(k);
                if (k.lank)
                    return raderaMoteDialog(k);
                if (k.ueSerie)
                    return raderaUeDialog(k);
                raderaKort(k);
            } },
        { txt: "Avbryt", fn: stangModal },
        { txt: "Spara", primar: true, fn: () => {
                const foreKort = JSON.parse(JSON.stringify(k));
                const t = T();
                const nyDag = document.getElementById("rDag").value;
                const nyTyp = document.getElementById("rTyp").value;
                const o = { text: document.getElementById("rText").value.trim() || k.text };
                if (nyTyp === "mote" && document.getElementById("rStart")) {
                    const st = document.getElementById("rStart").value, sl = document.getElementById("rSlut").value;
                    if (st && sl && sl <= st) {
                        appliceraPatch(opRedigeraKort(k, { text: o.text }, t.id), { tavla: t, projekt: state });
                        document.getElementById("rFel").innerHTML =
                            '<div class="notis rod">Sluttiden måste vara senare än starttiden.</div>';
                        return;
                    }
                    o.tid = st;
                    o.slutTid = st ? sl : "";
                    o.plats = document.getElementById("rPlats").value.trim();
                }
                else {
                    o.tid = document.getElementById("rTid") ? document.getElementById("rTid").value.trim() : k.tid;
                    if (document.getElementById("rPlats"))
                        o.plats = document.getElementById("rPlats").value.trim();
                }
                // I ett moment sparas Plats / del på startposten, så att alla kort i momentet visar samma del.
                let momentPlats = null;
                if (momentBar && o.plats !== undefined && nyTyp !== "mote") {
                    momentPlats = o.plats;
                    o.plats = "";
                }
                o.vem = document.getElementById("rVem").value.trim();
                o.not = document.getElementById("rNot").value.trim();
                if (document.getElementById("rFOrsak"))
                    o.franvaroOrsak = document.getElementById("rFOrsak").value;
                o.typ = nyTyp;
                if (document.getElementById("rMil"))
                    o.milstolpe = nyTyp === "produktion" && document.getElementById("rMil").checked;
                const flytt = nyDag !== k.dag;
                const kravOrsak = flytt && kraverOrsak(k, nyDag, nyTyp);
                const patch = opRedigeraKort(k, o, t.id);
                if (!patch.ok)
                    return;
                if (!appliceraPatch(patch, { tavla: t, projekt: state }))
                    return;
                if (momentPlats !== null && (momentBar.plats || "") !== momentPlats) {
                    const pp = opRedigeraKort(momentBar, { plats: momentPlats }, t.id);
                    if (pp.ok)
                        appliceraPatch(pp, { tavla: t, projekt: state });
                }
                if (k.typ === "mote" || k.lank) {
                    uppdateraMoteTavlor(k, t);
                    synkaMote(k);
                }
                if (k.typ === "ue" && document.getElementById("rUeKal")) {
                    const vis = document.querySelector("#rUeVis button.vald");
                    const nyaDatum = rUeDatum;
                    if (nyaDatum) sattUeDatum(t, k, nyaDatum);
                    if (vis && k.ueSerie) k.ueVisning = vis.dataset.v;
                    if (k.ueSerie) synkaUeSerie(t, k);
                    if (nyaDatum) {
                        // datumen styrs av kalendern, inte av Dag-fältet
                        stangModal();
                        spara();
                        rita();
                        return;
                    }
                }
                if (kravOrsak)
                    return fragaOrsak(k, nyDag, foreKort);
                if (flytt)
                    return utfor(k, nyDag, null, foreKort);
                stangModal();
                spara();
                rita();
            } }
    ]);
}

// Öppnar ett nytt mejl (mailto:) i datorns mejlprogram, t.ex. Outlook, med kortets anteckningar.
// Leveransen som hör till ett avrop: kopplat leveranskort, kedjans leverans eller avropets leveransdag.
function avropsLeverans(k, t) {
    const a = k.avrop || {};
    let l = a.levKortId ? t.kort.find(x => x.id === a.levKortId) : null;
    if (!l && k.kedja) {
        const lev = t.kort.filter(x => x.kedja === k.kedja && x.roll === "L" && x.dag >= k.dag).sort((x, y) => x.dag < y.dag ? -1 : 1);
        l = lev[0] || t.kort.find(x => x.kedja === k.kedja && x.roll === "L") || null;
    }
    if (l)
        return { dag: l.dag, tid: l.tid || "" };
    return a.levDag ? { dag: a.levDag, tid: "" } : null;
}

// "Mån 9/11 kl 07.00 · v46" (fungerar även för helgdagar)
const MAIL_DAGAR = ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"];
function mailDagNamn(dag) {
    const d = iso2d(dag);
    return MAIL_DAGAR[d.getDay()] + " " + d.getDate() + "/" + (d.getMonth() + 1);
}
function mailDag(dag, tid) {
    return mailDagNamn(dag) + (tid ? " kl " + tid.replace(/:/g, ".") : "") + " · v" + veckonr(dag);
}

function mailaAnteckning(k, t, text, till) {
    const best = (k.typ === "avrop" || k.roll === "A") && k.avrop && k.avrop.best && typeof avrMejlRader === "function" ? k.avrop.best : null;
    if (!text && !best)
        return;
    const p = projektForTavla(t) || state;
    const namn = kortText(k, t, p);
    const del = typeof kortDel === "function" ? kortDel(k, t) : "";
    const delAv = del.replace(/^Del\s*(\d+)(?::(\d+))?$/, (m, a, b) => b ? a + " av " + b : a);
    const avrop = k.typ === "avrop" || k.roll === "A";
    const levB = best ? avropsLeverans(k, t) : null;
    const amne = best ? "Beställning " + [best.markning, best.mallNamn || (k.avrop && k.avrop.txt) || namn].filter(Boolean).join(" · ") + (levB ? " – leverans " + mailDagNamn(levB.dag).toLowerCase() : "") + " – " + p.projekt
        : namn + " · " + p.projekt + (p.tavlor.length > 1 ? " – " + t.namn : "");
    const rader = [namn, "Projekt: " + p.projekt + (p.tavlor.length > 1 ? " · " + t.namn : "")];
    if (avrop) {
        // avropets eget datum är samma dag som mejlet skickas, så det är leveransen som står
        const l = avropsLeverans(k, t);
        if (l) rader.push("Leverans: " + mailDag(l.dag, l.tid));
    }
    else
        rader.push((k.typ === "leverans" ? "Leverans: " : "Datum: ") + mailDag(k.dag, k.tid ? tidText(k) : ""));
    if (delAv) rader.push("Del: " + delAv);
    if (k.vem) rader.push("Ansvarig: " + k.vem);
    const skickat = mailDagNamn(d2iso(new Date()));
    if (best) {
        // en färdig beställning med samma uppgifter som beställningsmallen
        rader.length = 0;
        rader.push("Hej!", "", "Vi vill beställa följande till " + p.projekt + ".", "");
        avrMejlRader(best, k, t).forEach(r => rader.push(r));
        if (text) rader.push("", "Övrigt:", text);
        rader.push("", "Tack på förhand!", best.bestallare && best.bestallare.namn ? best.bestallare.namn : "");
        text = "";
    }
    let kropp = best ? rader.join("\r\n").replace(/\r?\n/g, "\r\n") + "\r\n"
        : rader.join("\r\n") + "\r\n" + (avrop ? "Material:" : "\r\nAnteckningar:") + "\r\n" + text.replace(/\r?\n/g, "\r\n") +
        (avrop ? "\r\nSkickat " + skickat.charAt(0).toLowerCase() + skickat.slice(1) : "") + "\r\n";
    // mejlprogrammen klarar inte hur långa länkar som helst: då blir det ett färdigt mejl som fil,
    // med hela anteckningen bifogad som textfil
    const MAX = 1800;
    if (encodeURIComponent(kropp).length + (till || []).join(",").length > MAX)
        return best ? bestallningSomFil(till || [], amne, kropp, namn, k.dag) : mailSomFil(till || [], amne, rader, text, namn, k.dag);
    const a = document.createElement("a");
    a.href = "mailto:" + (till || []).join(",") + "?subject=" + encodeURIComponent(amne) + "&body=" + encodeURIComponent(kropp);
    document.body.appendChild(a);
    a.click();
    a.remove();
}

/* ---------- långa anteckningar: färdigt mejl som .eml-fil ----------
   Filen öppnas som ett nytt, oskickat mejl i Outlook (och Windows E-post/Apple Mail) med
   mottagare, ämne och hela anteckningen bifogad som textfil. */
function b64utf8(s) {
    const b = new TextEncoder().encode(s);
    let bin = "";
    for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(bin).replace(/.{1,76}/g, "$&\r\n");
}
function mimeOrd(s) { return /^[\x20-\x7e]*$/.test(s) ? s : "=?UTF-8?B?" + b64utf8(s).replace(/\r\n/g, "") + "?="; }
function filnamnSakert(s) { return s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "Anteckning"; }
function laddaNer(namn, innehall, typ) {
    const url = URL.createObjectURL(new Blob([innehall], { type: typ }));
    const a = document.createElement("a");
    a.href = url; a.download = namn;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function mailSomFil(till, amne, rader, text, namn, dag) {
    const d = iso2d(dag);
    const datum = d.getDate() + "-" + (d.getMonth() + 1);
    const bilagaNamn = filnamnSakert("Anteckningar " + namn + " " + datum) + ".txt";
    const bilaga = "\ufeff" + rader.join("\r\n") + "\r\n\r\nAnteckningar:\r\n" + text.replace(/\r?\n/g, "\r\n") + "\r\n";
    const kropp = rader.join("\r\n") + "\r\n\r\nHela anteckningen finns i den bifogade filen " + bilagaNamn + ".\r\n";
    const g = "wimo-" + uid();
    const eml = [
        "X-Unsent: 1",
        "To: " + till.join(", "),
        "Subject: " + mimeOrd(amne),
        "MIME-Version: 1.0",
        'Content-Type: multipart/mixed; boundary="' + g + '"',
        "",
        "--" + g,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        b64utf8(kropp),
        "--" + g,
        'Content-Type: text/plain; charset=UTF-8; name="' + mimeOrd(bilagaNamn) + '"',
        "Content-Disposition: attachment; filename*=UTF-8''" + encodeURIComponent(bilagaNamn),
        "Content-Transfer-Encoding: base64",
        "",
        b64utf8(bilaga),
        "--" + g + "--",
        ""
    ].join("\r\n");
    const emlNamn = filnamnSakert("Mejl " + namn + " " + datum) + ".eml";
    laddaNer(emlNamn, eml, "message/rfc822");
    modal("Mejlet ligger i Hämtade filer", "", '<p>Anteckningen är för lång för en vanlig mejllänk, så Wimo har gjort ett färdigt mejl som fil: <b>' + esc(emlNamn) + '</b>.</p>' +
        '<p>Öppna filen så öppnas mejlet i Outlook med mottagare, ämne och <b>hela anteckningen bifogad som textfil</b>. Tryck sedan Skicka.</p>' +
        '<p class="hjalp">Använder du Gmail eller ett annat mejl i webbläsaren: ladda ner textfilen och bifoga den själv.</p>', [
        { txt: "Ladda ner textfilen", fn: () => laddaNer(bilagaNamn, bilaga, "text/plain;charset=utf-8") },
        { txt: "Ladda ner mejlet igen", fn: () => laddaNer(emlNamn, eml, "message/rfc822") },
        { txt: "Klar", primar: true, fn: stangModal }
    ]);
}

// En lång beställning: färdigt mejl som fil med hela beställningen i mejlet (ingen bilaga behövs).
function bestallningSomFil(till, amne, kropp, namn, dag) {
    const d = iso2d(dag), datum = d.getDate() + "-" + (d.getMonth() + 1);
    const eml = ["X-Unsent: 1", "To: " + till.join(", "), "Subject: " + mimeOrd(amne), "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", b64utf8(kropp), ""].join("\r\n");
    const emlNamn = filnamnSakert("Beställning " + namn + " " + datum) + ".eml";
    laddaNer(emlNamn, eml, "message/rfc822");
    modal("Beställningen ligger i Hämtade filer", "", '<p>Beställningen är för lång för en vanlig mejllänk, så Wimo har gjort ett färdigt mejl som fil: <b>' + esc(emlNamn) + '</b>.</p>' +
        '<p>Öppna filen så öppnas mejlet i Outlook med mottagare, ämne och hela beställningen. Tryck sedan Skicka.</p>', [
        { txt: "Kopiera texten", fn: () => { if (navigator.clipboard) navigator.clipboard.writeText(kropp).then(() => status("Beställningen kopierad")); } },
        { txt: "Ladda ner mejlet igen", fn: () => laddaNer(emlNamn, eml, "message/rfc822") },
        { txt: "Klar", primar: true, fn: stangModal }
    ]);
}

/* ---------- möten på flera tavlor ----------
   Ett möte kan visas på flera tavlor i projektet. Kopiorna hänger ihop via k.lank (samma id på alla),
   så att en ändring av text, dag, tid eller plats slår igenom på alla. Avbockning och anteckningar
   är per tavla. Återkommande möten länkas på samma sätt via serien (aterkom.lank). */
const MOTE_SYNK = ["text", "dag", "tid", "slutTid", "plats", "vem", "typ"];
const SERIE_SYNK = ["text", "vdagar", "tid", "slutTid", "plats", "vem", "tom", "typ"];

function kanTavla(t) { return typeof window.p4KanRedigera !== "function" || window.p4KanRedigera(state.id, t.id); }

function moteSyskon(k) {
    const ut = [];
    if (!k || !k.lank) return ut;
    state.tavlor.forEach(t => (t.kort || []).forEach(x => { if (x !== k && x.lank === k.lank) ut.push({ t: t, k: x }); }));
    return ut;
}
function serieSyskon(s) {
    const ut = [];
    if (!s || !s.lank) return ut;
    state.tavlor.forEach(t => (t.aterkom || []).forEach(x => { if (x !== s && x.lank === s.lank) ut.push({ t: t, s: x }); }));
    return ut;
}

// Kopierar mötets uppgifter till kopiorna på de andra tavlorna. Returnerar antalet uppdaterade.
function synkaMote(k) {
    let n = 0;
    moteSyskon(k).forEach(({ t, k: x }) => {
        if (!kanTavla(t)) return;
        MOTE_SYNK.forEach(f => { if (k[f] === undefined) delete x[f]; else x[f] = k[f]; });
        n++;
    });
    return n;
}
function synkaSerie(s) {
    serieSyskon(s).forEach(({ t, s: x }) => {
        if (!kanTavla(t)) return;
        SERIE_SYNK.forEach(f => { if (s[f] === undefined) delete x[f]; else x[f] = Array.isArray(s[f]) ? s[f].slice() : s[f]; });
        delete x.vdag;
    });
}

// Kryssrutor "Visa även på" för de andra tavlorna. valda: tavel-id som redan har mötet.
function moteTavlorHtml(valda, egenId) {
    const andra = state.tavlor.filter(t => t.id !== egenId);
    if (!andra.length) return "";
    return '<div class="falt mote-tavlor"><label>Visa även på</label><div class="krysslista">' +
        andra.map(t => {
            const kan = kanTavla(t);
            return '<label' + (kan ? "" : ' title="Du kan inte ändra på den tavlan"') + '><input type="checkbox" class="moteTavla" value="' + esc(t.id) + '"' +
                (valda.indexOf(t.id) >= 0 ? " checked" : "") + (kan ? "" : " disabled") + '> ' + esc(t.namn) + '</label>';
        }).join("") +
        '</div><p class="hjalp" style="margin:4px 0 0">Mötet läggs in på de valda tavlorna också. Ändrar du tid, dag eller text slår det igenom på alla.</p></div>';
}
function valdaMoteTavlor() {
    return [...document.querySelectorAll(".moteTavla:checked")].map(e => e.value)
        .map(id => state.tavlor.find(t => t.id === id)).filter(t => t && kanTavla(t));
}

// Lägger in en kopia av mötet k på tavlan t.
function kopieraMoteTill(k, t) {
    const x = JSON.parse(JSON.stringify(k));
    x.id = uid();
    x.klar = false; x.klarTid = null; x.not = ""; x.flyttar = []; x.orsak = null;
    delete x.fran; delete x.kedja; delete x.roll;
    t.kort.push(x);
    return x;
}
function kopieraSerieTill(s, t) {
    const x = JSON.parse(JSON.stringify(s));
    x.id = uid();
    t.aterkom.push(x);
    return x;
}

// Efter att mötet sparats: lägg till eller ta bort kopior så att de valda tavlorna stämmer.
function uppdateraMoteTavlor(k, egen) {
    if (!document.querySelector(".moteTavla")) return;
    const valda = valdaMoteTavlor().map(t => t.id);
    const finns = moteSyskon(k);
    let la = 0, bort = 0;
    finns.forEach(({ t, k: x }) => {
        if (valda.indexOf(t.id) >= 0 || !kanTavla(t)) return;
        t.kort = t.kort.filter(y => y !== x);
        bort++;
    });
    valda.forEach(id => {
        if (id === egen.id || finns.some(f => f.t.id === id)) return;
        if (!k.lank) k.lank = uid();
        kopieraMoteTill(k, state.tavlor.find(t => t.id === id));
        la++;
    });
    if (la || bort) logg("Mötet " + k.text + (la ? " lades till på " + la + (la === 1 ? " tavla" : " tavlor") : "") +
        (la && bort ? " och" : "") + (bort ? " togs bort från " + bort + (bort === 1 ? " tavla" : " tavlor") : ""));
}

// Ta bort ett möte som finns på flera tavlor: fråga om det gäller alla.
function raderaMoteDialog(k) {
    const syskon = moteSyskon(k).filter(x => kanTavla(x.t));
    if (!syskon.length) return raderaKort(k);
    const kropp = '<p class="fraga">' + esc(k.text) + ' · ' + dagEtikett(k.dag) + '</p>' +
        '<p class="hjalp">Mötet finns också på ' + syskon.map(x => esc(x.t.namn)).join(", ") + '.</p>';
    modal("Ta bort möte", "", kropp, [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Bara på den här tavlan", fn: () => raderaKort(k) },
        { txt: "På alla tavlor", primar: true, fara: true, fn: () => {
                syskon.forEach(({ t, k: x }) => { t.kort = t.kort.filter(y => y !== x); });
                raderaKort(k, " (även på " + syskon.length + (syskon.length === 1 ? " annan tavla)" : " andra tavlor)"));
            } }
    ]);
}

function taBortSerieSyskon(s) {
    serieSyskon(s).filter(x => kanTavla(x.t)).forEach(({ t: t2, s: x }) => {
        t2.aterkom = t2.aterkom.filter(y => y !== x);
        t2.kort = t2.kort.filter(y => y.fran !== x.id || y.klar);
        t2.skippa = t2.skippa.filter(y => y.split("|")[0] !== x.id);
    });
}

// Efter att serien sparats: lägg till eller ta bort seriens kopior så att de valda tavlorna stämmer.
function uppdateraSerieTavlor(s, egen) {
    if (!document.querySelector(".moteTavla")) return;
    const valda = valdaMoteTavlor().map(t => t.id);
    const finns = serieSyskon(s);
    finns.forEach(({ t, s: x }) => {
        if (valda.indexOf(t.id) >= 0 || !kanTavla(t)) return;
        t.aterkom = t.aterkom.filter(y => y !== x);
        t.kort = t.kort.filter(y => y.fran !== x.id || y.klar);
        t.skippa = t.skippa.filter(y => y.split("|")[0] !== x.id);
    });
    valda.forEach(id => {
        if (id === egen.id || finns.some(f => f.t.id === id)) return;
        if (!s.lank) s.lank = uid();
        kopieraSerieTill(s, state.tavlor.find(t => t.id === id));
    });
}

/* ---------- kalender-popup där man klickar i flera datum ----------
   Samma utseende som datumväljaren (p4d-*). valda: ISO-datum. klar(lista) anropas vid Klar.
   ankare: knappen popupen ska ligga vid. Bara vardagar går att välja. */
function datumKalender(valda, klar, rubrik, ankare) {
    const gammal = document.getElementById("datumKal");
    if (gammal) { gammal._stang(); }
    const set = new Set(valda || []);
    const start = (valda && valda.length ? valda.slice().sort()[0] : IDAG);
    const manad = iso2d(start); manad.setDate(1);
    const ruta = document.createElement("div");
    ruta.id = "datumKal";
    ruta.className = "p4d-pop p4d-flera";
    ruta.setAttribute("role", "dialog");
    ruta.setAttribute("aria-label", rubrik || "Välj datum");
    document.body.appendChild(ruta);
    let dragVal = null;
    const antalText = () => set.size + (set.size === 1 ? " dag vald" : " dagar valda");
    function rita() {
        const ar = manad.getFullYear(), m = manad.getMonth();
        const forsta = new Date(ar, m, 1);
        const d = new Date(forsta); d.setDate(1 - ((forsta.getDay() + 6) % 7));
        let html = '<div class="p4d-topp">' +
            '<button type="button" class="p4d-pil" data-n="-1" aria-label="Föregående månad"><span></span></button>' +
            '<div class="p4d-rubrik"><b>' + MANAD[m].replace(/^./, c => c.toUpperCase()) + "</b> " + ar + '</div>' +
            '<button type="button" class="p4d-pil nasta" data-n="1" aria-label="Nästa månad"><span></span></button></div>' +
            '<div class="p4d-rutnat" role="grid"><span class="p4d-vh">v</span>' +
            ["Må", "Ti", "On", "To", "Fr"].map(x => '<span class="p4d-vd">' + x + '</span>').join("");
        for (let rad = 0; rad < 6; rad++) {
            const mon = d2iso(d);
            if (rad > 3 && iso2d(mon).getMonth() !== m) break;
            html += '<button type="button" class="p4d-vnr" data-vecka="' + mon + '" title="Välj eller avmarkera hela veckan">' + veckonr(mon) + '</button>';
            for (let i = 0; i < 5; i++) {
                const iso = plus(mon, i), dd = iso2d(iso);
                html += '<button type="button" class="p4d-dag' + (dd.getMonth() !== m ? " annan" : "") + (iso === IDAG ? " idag" : "") +
                    (set.has(iso) ? " vald" : "") + '" data-d="' + iso + '"' + (set.has(iso) ? ' aria-pressed="true"' : "") + '>' + dd.getDate() + '</button>';
            }
            d.setDate(d.getDate() + 7);
        }
        html += '</div><div class="p4d-fot">' +
            '<button type="button" class="p4d-lank" data-a="rensa">Rensa</button>' +
            '<span class="p4d-antal">' + antalText() + '</span>' +
            '<button type="button" class="p4d-lank stark" data-a="klar">Klar</button></div>';
        ruta.innerHTML = html;
    }
    function placera() {
        const m = 8, b = ruta.offsetWidth, h = ruta.offsetHeight;
        const r = ankare ? ankare.getBoundingClientRect() : { left: (innerWidth - b) / 2, bottom: (innerHeight - h) / 2 - 6, top: 0 };
        let topp = r.bottom + 6;
        if (topp + h > innerHeight - m && r.top - h - 6 > m) topp = r.top - h - 6;
        ruta.style.left = Math.min(Math.max(m, r.left), innerWidth - b - m) + "px";
        ruta.style.top = Math.max(m, topp) + "px";
    }
    function stang() {
        ruta.remove();
        document.removeEventListener("pointerdown", utanfor, true);
        document.removeEventListener("keydown", tangent, true);
        document.removeEventListener("pointerup", slapp);
        if (ankare) ankare.focus();
    }
    ruta._stang = stang;
    const utanfor = e => { if (!ruta.contains(e.target) && e.target !== ankare) stang(); };
    const tangent = e => { if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); stang(); } };
    const slapp = () => { dragVal = null; };
    const uppdatera = (b, pa) => {
        pa ? set.add(b.dataset.d) : set.delete(b.dataset.d);
        b.classList.toggle("vald", pa);
        ruta.querySelector(".p4d-antal").textContent = antalText();
    };
    rita();
    placera();
    ruta.addEventListener("click", e => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.dataset.n) { manad.setMonth(manad.getMonth() + +b.dataset.n); rita(); }
        else if (b.dataset.vecka) {
            const v = [0, 1, 2, 3, 4].map(i => plus(b.dataset.vecka, i));
            const alla = v.every(x => set.has(x));
            v.forEach(x => alla ? set.delete(x) : set.add(x)); rita();
        }
        else if (b.dataset.a === "rensa") { set.clear(); rita(); }
        else if (b.dataset.a === "klar") { stang(); klar([...set].sort()); }
    });
    // klicka eller dra över dagarna
    ruta.addEventListener("pointerdown", e => {
        const b = e.target.closest(".p4d-dag");
        if (!b) return;
        e.preventDefault();
        dragVal = !set.has(b.dataset.d);
        uppdatera(b, dragVal);
    });
    ruta.addEventListener("pointerover", e => {
        if (dragVal === null) return;
        const b = e.target.closest(".p4d-dag");
        if (b) uppdatera(b, dragVal);
    });
    setTimeout(() => {
        document.addEventListener("pointerdown", utanfor, true);
        document.addEventListener("keydown", tangent, true);
        document.addEventListener("pointerup", slapp);
        const f = ruta.querySelector(".p4d-dag.vald, .p4d-dag.idag, .p4d-dag"); if (f) f.focus();
    }, 0);
}

/* ---------- UE-serier: ändra datum, synka uppgifter, ta bort ---------- */
const UE_SYNK = ["text", "vem", "tid", "ueVisning"];
function synkaUeSerie(t, k) {
    ueSerieKort(t, k.ueSerie).forEach(x => {
        if (x === k) return;
        UE_SYNK.forEach(f => { if (k[f] === undefined) delete x[f]; else x[f] = k[f]; });
    });
}
// Gör om seriens datum till listan nya: lägger till kort på nya datum och tar bort på bortvalda (avbockade behålls).
function sattUeDatum(t, k, nya) {
    if (!k.ueSerie) k.ueSerie = uid();
    if (!k.ueVisning) k.ueVisning = "kort";
    let fore = ueSerieKort(t, k.ueSerie);
    if (!fore.length) fore = [k];
    // kortet man redigerar ligger kvar: flyttas till ett valt datum om dess dag valdes bort
    if (nya.indexOf(k.dag) < 0 && !k.klar) {
        const ledig = nya.find(d => !fore.some(x => x.dag === d));
        if (ledig) k.dag = ledig;
    }
    const har = new Set(fore.map(x => x.dag));
    let la = 0, bort = 0;
    nya.forEach(d => {
        if (har.has(d)) return;
        const x = JSON.parse(JSON.stringify(k));
        x.id = uid(); x.dag = d; x.klar = false; x.klarTid = null; x.not = ""; x.flyttar = []; x.orsak = null;
        t.kort.push(x); la++;
    });
    fore.forEach(x => {
        if (nya.indexOf(x.dag) >= 0 || x.klar || x === k) return;
        t.kort = t.kort.filter(y => y !== x); bort++;
    });
    if (ueSerieKort(t, k.ueSerie).length < 2)
        ueSerieKort(t, k.ueSerie).forEach(x => { delete x.ueSerie; delete x.ueVisning; });
    if (la || bort) logg("UE " + k.text + ": " + (la ? la + " dagar tillagda" : "") + (la && bort ? ", " : "") + (bort ? bort + " dagar borttagna/pausade" : ""));
}
function raderaUeDialog(k) {
    const t = T(), l = ueSerieKort(t, k.ueSerie);
    if (l.length < 2) return raderaKort(k);
    modal("Ta bort UE", "", '<p class="fraga">' + esc(k.text) + ' · ' + dagEtikett(k.dag) + '</p>' +
        '<p class="hjalp">Posten är en del av en serie på ' + l.length + ' dagar (' + kortDatum(l[0].dag) + '–' + kortDatum(l[l.length - 1].dag) + ').</p>', [
        { txt: "Avbryt", fn: stangModal },
        { txt: "Bara den här dagen (pausa)", fn: () => raderaKort(k, " (dagen pausad i serien)") },
        { txt: "Hela serien", primar: true, fara: true, fn: () => {
                l.forEach(x => { if (x !== k && !x.klar) t.kort = t.kort.filter(y => y !== x); });
                raderaKort(k, " (hela serien, " + l.length + " dagar)");
            } }
    ]);
}

// Fältet i Ändra post för en UE: datum (kalender) och hur serien visas.
let rUeDatum = null;
function ueSerieFaltHtml(t, k) {
    rUeDatum = null;
    const l = k.ueSerie ? ueSerieKort(t, k.ueSerie) : [k];
    const info = l.length > 1 ? "Serie: " + l.length + " dagar, " + kortDatum(l[0].dag) + "–" + kortDatum(l[l.length - 1].dag) : "En dag";
    setTimeout(() => {
        const knapp = document.getElementById("rUeKal");
        if (!knapp) return;
        knapp.addEventListener("click", () => datumKalender(rUeDatum || l.map(x => x.dag), lista => {
            if (!lista.length) return;
            rUeDatum = lista;
            document.getElementById("rUeInfo").textContent = "Ändras till " + lista.length + (lista.length === 1 ? " dag" : " dagar") + ", " +
                kortDatum(lista[0]) + "–" + kortDatum(lista[lista.length - 1]) + " när du sparar";
            document.getElementById("rUeVisFalt").classList.toggle("dold", lista.length < 2);
        }, "Dagar för UE", knapp));
        document.querySelectorAll("#rUeVis button").forEach(b => b.addEventListener("click", () =>
            document.querySelectorAll("#rUeVis button").forEach(x => x.classList.toggle("vald", x === b))));
    }, 0);
    const vis = k.ueVisning || "kort";
    return '<div class="falt ueblock"><label>Datum</label><div class="ue-datumrad">' +
        '<button type="button" class="mknapp" id="rUeKal">Ändra datum i kalendern…</button>' +
        '<span id="rUeInfo" class="hjalp">' + esc(info) + '</span></div>' +
        '<div class="falt' + (l.length > 1 ? "" : " dold") + '" id="rUeVisFalt" style="margin:8px 0 0"><label>Visa på tavlan som</label>' +
        '<div class="lage" id="rUeVis"><button type="button" data-v="kort"' + (vis === "kort" ? ' class="vald"' : "") + '>Kort varje dag</button>' +
        '<button type="button" data-v="pagaende"' + (vis === "pagaende" ? ' class="vald"' : "") + '>Pågående (text)</button></div></div></div>';
}

/* ---------- välj vem mejlet ska till ----------
   Företag och resurser som har e-post (och gäller den här tavlan) visas som kryssrutor.
   Kortets eget företag är förvalt. klar(lista med adresser) skapar mejlet. */
const EPOST_OK = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
function kortetsForetag(k, t) {
    const ids = [];
    if (k.avrop && k.avrop.foretagId) ids.push(k.avrop.foretagId);
    if (k.foretagId) ids.push(k.foretagId);
    // materialrader: kortets egna, och rader på momentet som pekar på just det här avropet eller leveransen
    (k.material || []).forEach(m => { if (m.foretagId) ids.push(m.foretagId); });
    t.kort.forEach(x => (x.material || []).forEach(m => {
        if (m.foretagId && (m.avropKortId === k.id || m.levKortId === k.id)) ids.push(m.foretagId);
    }));
    return ids;
}
function valjMottagare(k, t, ankare, klar) {
    const gammal = document.getElementById("mailMottagare");
    if (gammal) { gammal._stang(); return; }
    const p = projektForTavla(t) || state;
    const ftg = (p.foretag || []).filter(f => f.aktiv !== false && EPOST_OK.test((f.epost || "").trim()) && resPaTavla(f, t.id))
        .sort((a, b) => a.namn.localeCompare(b.namn, "sv"));
    const pers = ((p.resurser || {}).personer || []).filter(x => x.aktiv !== false && EPOST_OK.test((x.epost || "").trim()) && resPaTavla(x, t.id))
        .sort((a, b) => a.namn.localeCompare(b.namn, "sv"));
    const forval = kortetsForetag(k, t);
    const rad = (typ, x) => '<label class="mm-rad"><input type="checkbox" class="mmVal" value="' + esc(x.epost.trim()) + '"' +
        (typ === "f" && forval.indexOf(x.id) >= 0 ? " checked" : "") + '><span><b>' + esc(x.namn) + '</b><small>' + esc(x.epost.trim()) + '</small></span></label>';
    const m = document.createElement("div");
    m.id = "mailMottagare";
    m.className = "p4d-pop mailmottagare";
    m.setAttribute("role", "dialog");
    m.setAttribute("aria-label", "Välj mottagare");
    m.innerHTML = '<div class="mm-rubrik">Skicka till</div>' +
        (ftg.length || pers.length ? '<div class="mm-lista">' +
            (ftg.length ? '<div class="mm-grupp">Företag</div>' + ftg.map(x => rad("f", x)).join("") : "") +
            (pers.length ? '<div class="mm-grupp">Resurser</div>' + pers.map(x => rad("p", x)).join("") : "") + '</div>'
            : '<p class="hjalp" style="margin:0 0 8px">Inga e-postadresser inlagda ännu. Lägg in dem under Företag eller Resurser, så går de att välja här.</p>') +
        '<label class="mm-annan"><span>Annan adress</span><input class="f" type="email" id="mmAnnan" placeholder="namn@foretag.se"></label>' +
        '<div id="mmFel"></div>' +
        '<div class="p4d-fot"><button type="button" class="p4d-lank" data-a="avbryt">Avbryt</button>' +
        '<span class="p4d-antal" id="mmAntal"></span>' +
        '<button type="button" class="p4d-lank stark" data-a="skapa">Skapa mejl</button></div>';
    document.body.appendChild(m);
    const r = ankare.getBoundingClientRect();
    const h = m.offsetHeight, b = m.offsetWidth;
    let topp = r.bottom + 6;
    if (topp + h > innerHeight - 8 && r.top - h - 6 > 8) topp = r.top - h - 6;
    m.style.left = Math.min(Math.max(8, r.left), innerWidth - b - 8) + "px";
    m.style.top = Math.max(8, topp) + "px";
    const valda = () => {
        const l = [...m.querySelectorAll(".mmVal:checked")].map(e => e.value);
        document.getElementById("mmAnnan").value.split(/[,;\s]+/).map(x => x.trim()).filter(Boolean).forEach(x => l.push(x));
        return l.filter((x, i) => l.indexOf(x) === i);
    };
    const antal = () => {
        const n = valda().length;
        document.getElementById("mmAntal").textContent = n ? n + (n === 1 ? " mottagare" : " mottagare") : "Ingen vald";
    };
    function stang(fokus) {
        m.remove();
        document.removeEventListener("pointerdown", utanfor, true);
        document.removeEventListener("keydown", tangent, true);
        if (fokus) ankare.focus();
    }
    m._stang = stang;
    const utanfor = e => { if (!m.contains(e.target) && !ankare.contains(e.target)) stang(); };
    const tangent = e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); stang(true); } };
    function skapa() {
        const l = valda();
        const fel = l.filter(x => !EPOST_OK.test(x));
        if (fel.length) {
            document.getElementById("mmFel").innerHTML = '<div class="notis rod">Kolla adressen: ' + esc(fel.join(", ")) + '</div>';
            return;
        }
        stang();
        klar(l);
    }
    m.addEventListener("change", antal);
    m.addEventListener("input", e => { if (e.target.id === "mmAnnan") { document.getElementById("mmFel").innerHTML = ""; antal(); } });
    m.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "mmAnnan") { e.preventDefault(); skapa(); } });
    m.addEventListener("click", e => {
        const knapp = e.target.closest("button");
        if (!knapp) return;
        if (knapp.dataset.a === "avbryt") stang(true);
        else if (knapp.dataset.a === "skapa") skapa();
    });
    antal();
    document.addEventListener("keydown", tangent, true);
    setTimeout(() => document.addEventListener("pointerdown", utanfor, true), 0);
    (m.querySelector(".mmVal") || document.getElementById("mmAnnan")).focus();
}
