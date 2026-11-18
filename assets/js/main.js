/* Site behaviour — mission control interactions */
(function () {
  "use strict";

  const root = document.documentElement;
  root.classList.add("js");

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const prefersReducedMotion = () => reduceMotionQuery.matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  function dictionary() {
    return window.I18N?.[root.lang] || window.I18N?.en || {};
  }

  /* ---------------------------------------------------------------
     Header, scroll progress and back-to-top
     --------------------------------------------------------------- */
  const header = document.querySelector(".site-header");
  const progressBar = document.getElementById("scroll-progress");
  const scrollTopButton = document.getElementById("scroll-top");
  let scrollTicking = false;

  function updateOnScroll() {
    const scrollY = window.scrollY;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;

    if (header) header.classList.toggle("is-scrolled", scrollY > 8);
    if (progressBar) {
      progressBar.style.width = (scrollable > 0 ? (scrollY / scrollable) * 100 : 0) + "%";
    }
    if (scrollTopButton) {
      scrollTopButton.classList.toggle("is-visible", scrollY > 520);
    }
    scrollTicking = false;
  }

  window.addEventListener(
    "scroll",
    () => {
      if (!scrollTicking) {
        window.requestAnimationFrame(updateOnScroll);
        scrollTicking = true;
      }
    },
    { passive: true }
  );
  updateOnScroll();

  if (scrollTopButton) {
    scrollTopButton.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    });
  }

  /* ---------------------------------------------------------------
     Mobile navigation
     --------------------------------------------------------------- */
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");

  function syncToggleLabel(open) {
    if (!navToggle) return;
    const labels = dictionary();
    navToggle.setAttribute(
      "aria-label",
      open ? labels.menu_close || "Close menu" : labels.menu_open || "Open menu"
    );
  }

  function setMenu(open) {
    if (!navToggle || !navLinks) return;
    navToggle.setAttribute("aria-expanded", String(open));
    navLinks.classList.toggle("is-open", open);
    if (header) header.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
    syncToggleLabel(open);
  }

  if (navToggle && navLinks) {
    syncToggleLabel(false);

    navToggle.addEventListener("click", () => {
      setMenu(navToggle.getAttribute("aria-expanded") !== "true");
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setMenu(false));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        navToggle.focus();
      }
    });

    document.addEventListener("click", (event) => {
      if (navToggle.getAttribute("aria-expanded") !== "true") return;
      if (header && !header.contains(event.target)) setMenu(false);
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) setMenu(false);
    });

    window.addEventListener("languagechange", () => {
      syncToggleLabel(navToggle.getAttribute("aria-expanded") === "true");
    });
  }

  /* ---------------------------------------------------------------
     Theme — night deck / daylight deck
     --------------------------------------------------------------- */
  const themeToggle = document.getElementById("themeToggle");
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  const THEME_STORAGE_KEY = "mm-theme";

  function currentTheme() {
    return root.dataset.theme === "light" ? "light" : "dark";
  }

  function syncThemeToggle() {
    if (!themeToggle) return;
    const labels = dictionary();
    const next = currentTheme() === "dark" ? "light" : "dark";
    const label =
      next === "light"
        ? labels.theme_to_light || "Switch to daylight mode"
        : labels.theme_to_dark || "Switch to night mode";
    themeToggle.setAttribute("aria-label", label);
    themeToggle.setAttribute("title", label);
  }

  function syncThemeQuery(theme) {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("theme")) return;
      url.searchParams.set("theme", theme);
      window.history.replaceState(window.history.state, "", url);
    } catch (error) {
      /* history may be unavailable */
    }
  }

  function applyTheme(theme) {
    const safeTheme = theme === "light" ? "light" : "dark";
    root.dataset.theme = safeTheme;
    root.style.colorScheme = safeTheme;
    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", safeTheme === "light" ? "#f4eee2" : "#060403");
    }
    syncThemeToggle();
    window.dispatchEvent(new CustomEvent("themechange", { detail: { theme: safeTheme } }));
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next);
      syncThemeQuery(next);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch (error) {
        /* storage may be unavailable */
      }
    });
  }

  applyTheme(currentTheme());
  window.addEventListener("languagechange", syncThemeToggle);

  /* ---------------------------------------------------------------
     Scroll spy
     --------------------------------------------------------------- */
  const sectionIds = ["modules", "sequence", "mission", "log"];
  const sections = sectionIds
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const navAnchors = Array.from(document.querySelectorAll(".nav-link[href^='#']"));

  function setActiveLink(id) {
    navAnchors.forEach((link) => {
      const isActive = link.getAttribute("href") === "#" + id;
      link.classList.toggle("active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  if (sections.length && "IntersectionObserver" in window) {
    const visibleSections = new Map();
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            visibleSections.set(entry.target.id, entry.intersectionRatio);
          } else {
            visibleSections.delete(entry.target.id);
          }
        });

        if (visibleSections.size) {
          const mostVisible = Array.from(visibleSections.entries()).sort((a, b) => b[1] - a[1])[0];
          setActiveLink(mostVisible[0]);
        } else {
          setActiveLink(null);
        }
      },
      { rootMargin: "-22% 0px -58% 0px", threshold: [0, 0.1, 0.3, 0.6] }
    );

    sections.forEach((section) => spy.observe(section));
  }

  /* ---------------------------------------------------------------
     Reveal on scroll (with automatic stagger)
     --------------------------------------------------------------- */
  document.querySelectorAll("[data-stagger]").forEach((parent) => {
    Array.from(parent.children).forEach((child, index) => {
      if (!child.hasAttribute("data-reveal")) child.setAttribute("data-reveal", "");
      child.style.setProperty("--delay", Math.min(index * 0.055, 0.33).toFixed(3) + "s");
    });
  });

  const revealElements = Array.from(document.querySelectorAll("[data-reveal]"));

  if (!prefersReducedMotion() && "IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    revealElements.forEach((element) => revealObserver.observe(element));
  } else {
    revealElements.forEach((element) => element.classList.add("is-visible"));
  }

  /* ---------------------------------------------------------------
     Animated counters
     --------------------------------------------------------------- */
  const counters = Array.from(document.querySelectorAll(".count-val"));
  const statsSection = document.querySelector(".stats-section");

  function runCounters() {
    counters.forEach((counter) => {
      const target = Number.parseInt(counter.dataset.target || "0", 10);
      if (prefersReducedMotion()) {
        counter.textContent = String(target);
        return;
      }
      counter.textContent = "0";
      const duration = 1400;
      const startTime = performance.now();

      function tick(now) {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        counter.textContent = String(Math.round(eased * target));
        if (progress < 1) window.requestAnimationFrame(tick);
      }

      window.requestAnimationFrame(tick);
    });
  }

  if (counters.length) {
    if (statsSection && "IntersectionObserver" in window) {
      let countersDone = false;
      const statsObserver = new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !countersDone) {
              countersDone = true;
              runCounters();
              observer.disconnect();
            }
          });
        },
        { threshold: 0.35 }
      );
      statsObserver.observe(statsSection);
    } else {
      runCounters();
    }
  }

  /* ---------------------------------------------------------------
     Pointer spotlight on cards
     --------------------------------------------------------------- */
  if (finePointer && !prefersReducedMotion()) {
    document
      .querySelectorAll(".module-card, .log-card, .rack-card, .sequence-card")
      .forEach((card) => {
        card.addEventListener("pointermove", (event) => {
          const rect = card.getBoundingClientRect();
          card.style.setProperty("--mx", event.clientX - rect.left + "px");
          card.style.setProperty("--my", event.clientY - rect.top + "px");
        });
        card.addEventListener("pointerleave", () => {
          card.style.removeProperty("--mx");
          card.style.removeProperty("--my");
        });
      });
  }

  /* ---------------------------------------------------------------
     Deploy hero — map reticle, loadout selector, sector intel
     --------------------------------------------------------------- */
  const deployMap = document.getElementById("deployMap");
  const deployArt = document.querySelector(".deploy-art");
  const deployHero = document.querySelector(".hero--deploy");
  const reticle = document.getElementById("reticle");
  const reticleCoord = document.getElementById("reticleCoord");

  if (deployArt && typeof deployArt.pauseAnimations === "function") {
    if (prefersReducedMotion()) {
      deployArt.pauseAnimations();
    } else if ("IntersectionObserver" in window) {
      const smilObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) deployArt.unpauseAnimations();
            else deployArt.pauseAnimations();
          });
        },
        { rootMargin: "60px 0px" }
      );
      smilObserver.observe(deployArt);
    }
  }

  if (deployMap && deployArt && reticle && reticleCoord && finePointer && !prefersReducedMotion()) {
    let mapX = 0;
    let mapY = 0;
    let parallaxFrame = 0;

    function renderParallax() {
      parallaxFrame = 0;
      deployArt.style.transform = `translate3d(${mapX}px, ${mapY}px, 0) scale(1.03)`;
    }

    deployMap.addEventListener("pointermove", (event) => {
      const rect = deployMap.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      mapX = -(x / rect.width - 0.5) * 16;
      mapY = -(y / rect.height - 0.5) * 12;
      if (!parallaxFrame) parallaxFrame = window.requestAnimationFrame(renderParallax);

      reticle.style.transform = `translate3d(${x}px, ${y}px, 0)`;

      const lat = 48.7412 + (1 - y / rect.height) * 0.06;
      const lon = 9.1562 + (x / rect.width) * 0.06;
      reticleCoord.textContent = `${lat.toFixed(4)}N · ${lon.toFixed(4)}E`;
    });

    deployMap.addEventListener("pointerenter", () => {
      deployMap.classList.add("has-reticle");
    });

    deployMap.addEventListener("pointerleave", () => {
      deployMap.classList.remove("has-reticle");
      mapX = 0;
      mapY = 0;
      if (!parallaxFrame) parallaxFrame = window.requestAnimationFrame(renderParallax);
    });
  }

  /* Zulu clock in the map chrome */
  const zuluClock = document.getElementById("zuluClock");

  if (zuluClock) {
    const tickZulu = () => {
      zuluClock.textContent = new Date().toISOString().slice(11, 16);
    };
    tickZulu();
    window.setInterval(tickZulu, 30000);
  }

  /* Loadout selector */
  const classCards = Array.from(document.querySelectorAll(".d-class"));
  const loadoutName = document.getElementById("loadoutName");
  const loadoutNote = document.getElementById("loadoutNote");

  function classNote(card) {
    const key = card?.dataset.noteKey;
    return (key && dictionary()[key]) || card?.dataset.note || "";
  }

  function syncLoadoutNote() {
    const active = document.querySelector(".d-class.is-active");
    if (!active || !loadoutName || !loadoutNote) return;
    loadoutName.textContent = active.dataset.class;
    loadoutNote.textContent = classNote(active);
  }

  classCards.forEach((card) => {
    card.addEventListener("click", () => {
      classCards.forEach((item) => {
        item.classList.remove("is-active");
        item.setAttribute("aria-pressed", "false");
      });
      card.classList.add("is-active");
      card.setAttribute("aria-pressed", "true");
      syncLoadoutNote();
    });
  });

  syncLoadoutNote();
  window.addEventListener("languagechange", syncLoadoutNote);

  /* Power level count-up */
  const powerLevels = Array.from(document.querySelectorAll(".d-class .pwr, .d-skill__lvl"));

  if (powerLevels.length && !prefersReducedMotion()) {
    powerLevels.forEach((element, index) => {
      const target = Number.parseInt(element.textContent, 10);
      if (!Number.isFinite(target)) return;

      const duration = 620 + index * 30;
      const startedAt = performance.now();
      element.textContent = "0";

      function tick(now) {
        const progress = Math.min((now - startedAt) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = String(Math.round(target * eased));
        if (progress < 1) window.requestAnimationFrame(tick);
      }

      window.requestAnimationFrame(tick);
    });
  }

  /* Sector intel bar */
  const sectorData = {
    A: {
      title: "Embedded",
      tags: "STM32 · Yocto · Altium",
      statusKey: "intel_secured",
      descKey: "sector_a_desc",
      proofKey: "sector_a_proof",
      power: 94,
      contested: false,
      coord: "48.7758N 9.1829E",
    },
    B: {
      title: "Autonomy",
      tags: "PX4 · MAVLink · Fusion",
      statusKey: "intel_active",
      descKey: "sector_b_desc",
      proofKey: "sector_b_proof",
      power: 90,
      contested: false,
      coord: "48.7412N 9.2104E",
    },
    C: {
      title: "Edge",
      tags: "OpenWrt · Docker · Hermes",
      statusKey: "intel_secured",
      descKey: "sector_c_desc",
      proofKey: "sector_c_proof",
      power: 88,
      contested: false,
      coord: "48.7831N 9.1817E",
    },
    D: {
      title: "Cloud",
      tags: "AWS · Terraform · EKS",
      statusKey: "intel_active",
      descKey: "sector_d_desc",
      proofKey: "sector_d_proof",
      power: 84,
      contested: false,
      coord: "48.6895N 9.2219E",
    },
    E: {
      title: "AI",
      tags: "LLM · RAG · Tools",
      statusKey: "intel_contested",
      descKey: "sector_e_desc",
      proofKey: "sector_e_proof",
      power: 86,
      contested: true,
      coord: "48.8013N 9.1562E",
    },
  };

  const sectorFlags = Array.from(document.querySelectorAll(".d-flag"));
  const intelbar = document.querySelector(".intelbar");
  const squadPanel = document.querySelector(".squad-panel");
  const intelCode = document.getElementById("intelCode");
  const intelTitle = document.getElementById("intelTitle");
  const intelTags = document.getElementById("intelTags");
  const intelStatus = document.getElementById("intelStatus");
  const intelCoord = document.getElementById("intelCoord");
  let intelSwapTimer = 0;

  function renderSector(flag) {
    const data = flag && sectorData[flag.dataset.sector];
    if (!data || !intelCode || !intelTitle || !intelTags || !intelStatus || !intelCoord) return;

    intelCode.textContent = flag.dataset.sector;
    intelTitle.textContent = data.title;
    intelTags.textContent = data.tags;
    intelStatus.textContent = dictionary()[data.statusKey] || "● SECURED";
    intelStatus.classList.toggle("is-contested", data.contested);
    intelCoord.textContent = data.coord;
  }

  /* Hover curtain for the capture points */
  const sectorCard = document.getElementById("sectorCard");
  const sectorCardCode = document.getElementById("sectorCardCode");
  const sectorCardTitle = document.getElementById("sectorCardTitle");
  const sectorCardStatus = document.getElementById("sectorCardStatus");
  const sectorCardDesc = document.getElementById("sectorCardDesc");
  const sectorCardTags = document.getElementById("sectorCardTags");
  const sectorCardCoord = document.getElementById("sectorCardCoord");
  const sectorCardPower = document.getElementById("sectorCardPower");
  const sectorCardMeter = document.getElementById("sectorCardMeter");
  const sectorCardProof = document.getElementById("sectorCardProof");
  let sectorCardFlag = null;
  let sectorCardTimer = 0;

  function renderSectorCard(flag) {
    const data = flag && sectorData[flag.dataset.sector];
    if (!data || !sectorCard || !deployHero) return;
    if (!sectorCardCode || !sectorCardTitle || !sectorCardStatus || !sectorCardDesc || !sectorCardTags || !sectorCardCoord) return;

    sectorCardCode.textContent = flag.dataset.sector;
    sectorCardTitle.textContent = data.title;
    sectorCardStatus.textContent = dictionary()[data.statusKey] || "";
    sectorCardStatus.classList.toggle("is-active", data.statusKey === "intel_active");
    sectorCardStatus.classList.toggle("is-contested", data.contested);
    sectorCardDesc.textContent = dictionary()[data.descKey] || "";
    sectorCardCoord.textContent = data.coord;
    if (sectorCardPower) sectorCardPower.textContent = String(data.power);
    if (sectorCardMeter) sectorCardMeter.style.width = `${data.power}%`;
    if (sectorCardProof) sectorCardProof.textContent = dictionary()[data.proofKey] || "";

    sectorCardTags.replaceChildren(
      ...data.tags.split(" · ").map((tag) => {
        const chip = document.createElement("span");
        chip.textContent = tag;
        return chip;
      })
    );

    const heroRect = deployHero.getBoundingClientRect();
    const squadRect = squadPanel ? squadPanel.getBoundingClientRect() : null;
    const lowerFlag = document.querySelector('.d-flag[data-sector="C"]');
    const lowerFlagRect = lowerFlag ? lowerFlag.getBoundingClientRect() : null;
    const cardW = sectorCard.offsetWidth;
    const cardH = sectorCard.offsetHeight;
    const isRtl = document.documentElement.dir === "rtl";

    let left = 12;
    let top = 12;

    if (squadRect) {
      left = isRtl
        ? squadRect.left - heroRect.left
        : squadRect.right - heroRect.left - cardW;

      const lowerEdge = Math.max(squadRect.bottom, lowerFlagRect ? lowerFlagRect.bottom : 0);
      top = lowerEdge - heroRect.top + 18;
    }

    left = Math.max(12, Math.min(left, heroRect.width - cardW - 12));
    top = Math.max(12, Math.min(top, heroRect.height - cardH - 12));

    sectorCard.style.left = `${left}px`;
    sectorCard.style.top = `${top}px`;
    sectorCard.classList.add("is-open");
    sectorCard.setAttribute("aria-hidden", "false");
  }

  function showSectorCard(flag) {
    window.clearTimeout(sectorCardTimer);
    sectorCardFlag = flag;
    sectorFlags.forEach((item) => item.classList.toggle("is-preview", item === flag));
    renderSectorCard(flag);
  }

  function queueSectorCard(flag) {
    window.clearTimeout(sectorCardTimer);
    sectorCardTimer = window.setTimeout(() => showSectorCard(flag), 90);
  }

  function hideSectorCard() {
    window.clearTimeout(sectorCardTimer);
    sectorCardFlag = null;
    sectorFlags.forEach((item) => item.classList.remove("is-preview"));
    if (!sectorCard) return;
    sectorCard.classList.remove("is-open");
    sectorCard.setAttribute("aria-hidden", "true");
  }

  sectorFlags.forEach((flag) => {
    flag.addEventListener("click", () => {
      sectorFlags.forEach((item) => {
        item.classList.remove("is-active");
        item.setAttribute("aria-pressed", "false");
      });
      flag.classList.add("is-active");
      flag.setAttribute("aria-pressed", "true");

      flag.classList.remove("is-popping");
      void flag.offsetWidth;
      flag.classList.add("is-popping");

      if (prefersReducedMotion() || !intelbar) {
        renderSector(flag);
        return;
      }

      window.clearTimeout(intelSwapTimer);
      intelbar.classList.add("is-swapping");
      intelSwapTimer = window.setTimeout(() => {
        renderSector(flag);
        intelbar.classList.remove("is-swapping");
      }, 130);
    });
  });

  sectorFlags.forEach((flag) => {
    if (finePointer) {
      flag.addEventListener("pointerenter", () => queueSectorCard(flag));
      flag.addEventListener("pointerleave", hideSectorCard);
    }
    flag.addEventListener("focus", () => showSectorCard(flag));
    flag.addEventListener("blur", hideSectorCard);
  });

  window.addEventListener("scroll", hideSectorCard, { passive: true });
  window.addEventListener("resize", hideSectorCard);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideSectorCard();
  });

  window.addEventListener("languagechange", () => {
    renderSector(document.querySelector(".d-flag.is-active") || sectorFlags[0]);
    if (sectorCardFlag) renderSectorCard(sectorCardFlag);
  });

  /* ---------------------------------------------------------------
     Lazy-load Calendly
     --------------------------------------------------------------- */
  const contactSection = document.getElementById("contact");
  const calendlyPanel = document.querySelector(".calendly-panel");
  const calendlySkeleton = document.querySelector(".calendly-skeleton");
  let calendlyLoading = false;

  function revealCalendar() {
    if (!calendlyPanel || calendlyLoading) return;
    calendlyLoading = true;

    const hideSkeleton = () => calendlySkeleton?.classList.add("is-hidden");

    const iframeObserver = new MutationObserver(() => {
      const iframe = calendlyPanel.querySelector("iframe");
      if (iframe && iframe.dataset.loadBound !== "true") {
        iframe.dataset.loadBound = "true";
        iframe.addEventListener(
          "load",
          () => {
            /* Let the embedded page paint before removing the loading state. */
            window.setTimeout(hideSkeleton, 700);
          },
          { once: true }
        );
        iframeObserver.disconnect();
      }
    });
    iframeObserver.observe(calendlyPanel, { childList: true, subtree: true });

    const script = document.createElement("script");
    script.src = "https://assets.calendly.com/assets/external/widget.js";
    script.async = true;
    script.onerror = () => {
      const hint = calendlySkeleton?.querySelector(".calendly-skeleton__hint");
      if (hint) hint.textContent = window.I18N?.[root.lang]?.contact_fallback || "Open the scheduling page";
    };
    document.body.appendChild(script);

    /* Safety net: never leave the panel stuck on the loading state. */
    window.setTimeout(() => {
      if (calendlyPanel.querySelector("iframe")) hideSkeleton();
      iframeObserver.disconnect();
    }, 12000);
  }

  if (contactSection && calendlyPanel) {
    if ("IntersectionObserver" in window) {
      const calendlyObserver = new IntersectionObserver(
        (entries, observer) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            revealCalendar();
            observer.disconnect();
          }
        },
        { rootMargin: "450px 0px" }
      );
      calendlyObserver.observe(contactSection);
    } else {
      revealCalendar();
    }
  }

  /* ---------------------------------------------------------------
     Footer year fallback (translations also replace {YEAR})
     --------------------------------------------------------------- */
  document.querySelectorAll("[data-year]").forEach((element) => {
    element.textContent = new Date().getFullYear();
  });
})();
