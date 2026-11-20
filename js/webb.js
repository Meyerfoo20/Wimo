/* Wimo · startsidan: ljust/mörkt läge (samma val som i appen), mobilmeny, kontaktformulär */
(function () {
  const rot = document.documentElement;
  const satt = (mork) => {
    if (mork) rot.setAttribute("data-tema", "mork"); else rot.removeAttribute("data-tema");
    try { localStorage.setItem("wimo-tema", mork ? "mork" : "ljus"); } catch (e) { }
    const k = document.querySelector(".tema");
    if (k) { k.setAttribute("aria-pressed", String(mork)); k.setAttribute("aria-label", mork ? "Byt till ljust läge" : "Byt till mörkt läge"); k.title = k.getAttribute("aria-label"); }
  };
  const tema = document.querySelector(".tema");
  if (tema) {
    satt(rot.getAttribute("data-tema") === "mork");
    tema.addEventListener("click", () => satt(rot.getAttribute("data-tema") !== "mork"));
  }

  // redan inloggad: en knapp, Öppna Wimo
  let inloggad = false;
  try { inloggad = localStorage.getItem("wimo-inloggad") === "1"; } catch (e) { }
  if (inloggad) {
    document.querySelectorAll('[data-konto="logga"]').forEach((a) => { if (a.closest(".nav-hoger, .borja-knappar")) a.remove(); else a.textContent = "Öppna Wimo"; });
    document.querySelectorAll('.fot [data-konto="skapa"]').forEach((a) => a.closest("li").remove());
    document.querySelectorAll('[data-konto="skapa"]').forEach((a) => { a.textContent = "Öppna Wimo"; a.setAttribute("href", "konto.html"); });
    document.querySelectorAll("[data-konto-not]").forEach((p) => { p.innerHTML = '<span>Du är inloggad.</span> <a href="konto.html">Öppna Wimo</a>'; });
  }

  // rubriklänken i heron slutar knuffa när man har hovrat den en gång
  const boka = document.querySelector(".hero-boka");
  if (boka) {
    const pil = boka.querySelector("svg");
    const stanna = () => {
      if (boka.classList.contains("sedd")) return;
      // pilen glider mjukt tillbaka från där pulsen var i stället för att hoppa
      const nu = getComputedStyle(pil).transform;
      boka.classList.add("sedd");
      pil.style.transform = nu === "none" ? "" : nu;
      pil.getBoundingClientRect();
      pil.style.transition = "transform .35s cubic-bezier(.65, 0, .35, 1)";
      pil.style.transform = "translateX(0)";
    };
    boka.addEventListener("mouseenter", stanna);
    boka.addEventListener("focus", stanna);
  }

  // navigeringen på datorn: varje bokstav får en egen ruta så att ordet kan rulla upp bokstav för bokstav
  const lankar = document.querySelector(".nav-lankar");
  if (lankar && matchMedia("(min-width: 761px)").matches) {
    lankar.classList.add("rull");
    lankar.querySelectorAll("li:not(.bara-smal) a").forEach((a) => {
      const text = a.textContent;
      a.setAttribute("aria-label", text);
      const ord = document.createElement("span");
      ord.className = "rull-ord";
      ord.setAttribute("aria-hidden", "true");
      [...text].forEach((t, i) => {
        const s = document.createElement("span");
        s.textContent = t;
        s.dataset.b = t;
        s.style.setProperty("--i", i);
        ord.appendChild(s);
      });
      a.textContent = "";
      a.appendChild(ord);
    });
  }

  // öppnas sidorna direkt från datorn (file://) finns inga korta adresser, så där används filnamnen
  if (location.protocol === "file:") document.querySelectorAll("a[href]").forEach((a) => {
    const h = a.getAttribute("href");
    if (h === "./") a.setAttribute("href", "index.html");
    else if (h === "om-oss" || h === "kontakt") a.setAttribute("href", h + ".html");
  });

  // mobilmenyn
  const nav = document.querySelector(".nav"), meny = document.querySelector(".meny");
  if (meny) meny.addEventListener("click", () => {
    const oppen = nav.classList.toggle("oppen");
    meny.setAttribute("aria-expanded", String(oppen));
  });
  // navigeringen får en linje när man scrollat
  const skugga = () => nav && nav.classList.toggle("skuggad", window.scrollY > 8);
  window.addEventListener("scroll", skugga, { passive: true });
  skugga();

  // kontaktformuläret: öppnar ett färdigt mejl
  const f = document.getElementById("kontaktformular");
  if (f) f.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = (n) => (f.elements[n] && f.elements[n].value || "").trim();
    const fel = f.querySelector(".fel");
    if (!v("namn") || !v("epost") || !v("meddelande")) {
      fel.textContent = "Fyll i namn, e-post och meddelande.";
      (f.elements[!v("namn") ? "namn" : !v("epost") ? "epost" : "meddelande"]).focus();
      return;
    }
    fel.textContent = "";
    const amne = (v("arende") || "Fråga om Wimo") + (v("foretag") ? " – " + v("foretag") : "");
    const kropp = v("meddelande") + "\n\n" + v("namn") + (v("foretag") ? "\n" + v("foretag") : "") + "\n" + v("epost") + (v("telefon") ? "\n" + v("telefon") : "");
    location.href = "mailto:" + f.dataset.till + "?subject=" + encodeURIComponent(amne) + "&body=" + encodeURIComponent(kropp);
  });
})();
