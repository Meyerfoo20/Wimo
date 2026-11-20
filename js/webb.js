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
    document.querySelectorAll('[data-konto="skapa"]').forEach((a) => { a.textContent = "Öppna Wimo"; a.setAttribute("href", "konto.html"); });
  }

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
