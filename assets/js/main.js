/* Site behaviour — navigation, motion, stats, Calendly */
(function () {
  "use strict";

  const root = document.documentElement;
  root.classList.add("js");

  const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const prefersReducedMotion = () => reduceMotionQuery.matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

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

  function dictionary() {
    return window.I18N?.[root.lang] || window.I18N?.en || {};
  }

  /* ---------------------------------------------------------------
     Theme switching
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
        ? labels.theme_to_light || "Switch to light theme"
        : labels.theme_to_dark || "Switch to dark theme";
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
      themeColorMeta.setAttribute("content", safeTheme === "light" ? "#f7f2e8" : "#05080f");
    }
    syncThemeToggle();
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

  function syncToggleLabel(open) {
    if (!navToggle) return;
    const labels = dictionary();
    navToggle.setAttribute("aria-label", open ? labels.menu_close || "Close menu" : labels.menu_open || "Open menu");
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
      if (!header.contains(event.target)) setMenu(false);
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) setMenu(false);
    });

    window.addEventListener("languagechange", () => {
      syncToggleLabel(navToggle.getAttribute("aria-expanded") === "true");
    });
  }

  /* ---------------------------------------------------------------
     Scroll spy for section links
     --------------------------------------------------------------- */
  const sectionIds = ["services", "workflow", "focus", "projects"];
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

  function revealAll() {
    revealElements.forEach((element) => element.classList.add("is-visible"));
  }

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
    revealAll();
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
  if (finePointer) {
    document.querySelectorAll(".service-card, .project-card").forEach((card) => {
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
     Hero core scene — pointer depth, wire focus, offscreen pause
     --------------------------------------------------------------- */
  const coreVisual = document.querySelector(".core-visual");
  const visualStage = coreVisual?.querySelector(".visual-stage");
  const wirePulses = Array.from(coreVisual?.querySelectorAll(".wire-pulse") || []);
  const nodeSlots = Array.from(coreVisual?.querySelectorAll(".node-slot") || []);

  if (coreVisual && wirePulses.length) {
    nodeSlots.forEach((slot, index) => {
      const wire = wirePulses[index];
      if (!wire) return;
      const hot = () => wire.classList.add("is-hot");
      const cool = () => wire.classList.remove("is-hot");
      slot.addEventListener("pointerenter", hot);
      slot.addEventListener("pointerleave", cool);
      slot.addEventListener("focusin", hot);
      slot.addEventListener("focusout", cool);
    });
  }

  if (coreVisual && visualStage && finePointer && !prefersReducedMotion()) {
    const compactScene = window.matchMedia("(max-width: 760px)");
    const maxTilt = 7;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let frame = 0;

    function renderTilt() {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      visualStage.style.setProperty("--ry", currentX.toFixed(2) + "deg");
      visualStage.style.setProperty("--rx", (-currentY).toFixed(2) + "deg");
      if (Math.abs(targetX - currentX) > 0.02 || Math.abs(targetY - currentY) > 0.02) {
        frame = window.requestAnimationFrame(renderTilt);
      } else {
        currentX = targetX;
        currentY = targetY;
        visualStage.style.setProperty("--ry", currentX.toFixed(2) + "deg");
        visualStage.style.setProperty("--rx", (-currentY).toFixed(2) + "deg");
        frame = 0;
      }
    }

    function kickTilt() {
      if (!frame) frame = window.requestAnimationFrame(renderTilt);
    }

    coreVisual.addEventListener("pointermove", (event) => {
      if (compactScene.matches || coreVisual.classList.contains("is-webgl")) return;
      const rect = coreVisual.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      targetX = Math.max(-1, Math.min(1, x * 2)) * maxTilt;
      targetY = Math.max(-1, Math.min(1, y * 2)) * maxTilt;
      kickTilt();
    });
    coreVisual.addEventListener("pointerleave", () => {
      targetX = 0;
      targetY = 0;
      kickTilt();
    });
    compactScene.addEventListener?.("change", () => {
      if (compactScene.matches) {
        targetX = 0;
        targetY = 0;
        kickTilt();
      }
    });
  }

  if (coreVisual && "IntersectionObserver" in window) {
    const sceneObserver = new IntersectionObserver(
      (entries) => {
        if (coreVisual.classList.contains("is-webgl")) return;
        entries.forEach((entry) => {
          coreVisual.classList.toggle("is-paused", !entry.isIntersecting);
        });
      },
      { rootMargin: "120px 0px" }
    );
    sceneObserver.observe(coreVisual);
  }

  /* ---------------------------------------------------------------
     Lazy-load Calendly
     --------------------------------------------------------------- */
  const contactSection = document.getElementById("contact");
  const calendlyPanel = document.querySelector(".calendly-panel");
  const calendlySkeleton = document.querySelector(".calendly-skeleton");

  function revealCalendar() {
    if (!calendlyPanel) return;
    const hideSkeleton = () => calendlySkeleton?.classList.add("is-hidden");

    const iframeObserver = new MutationObserver(() => {
      const iframe = calendlyPanel.querySelector("iframe");
      if (iframe && iframe.dataset.loadBound !== "true") {
        iframe.dataset.loadBound = "true";
        iframe.addEventListener("load", hideSkeleton, { once: true });
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
     Cinematic WebGL hero — lazy, desktop only
     --------------------------------------------------------------- */
  const heroSceneScript = document.currentScript;
  const heroSceneUrl = heroSceneScript?.src
    ? new URL("./hero-scene.js", heroSceneScript.src).href
    : "assets/js/hero-scene.js";
  const desktopSceneQuery = window.matchMedia("(min-width: 761px)");
  const connection = navigator.connection || navigator.mozConnection || {};
  let heroSceneLoading = false;

  function hasWebGL() {
    try {
      if (!window.WebGLRenderingContext) return false;
      const probe = document.createElement("canvas");
      const gl = probe.getContext("webgl2") || probe.getContext("webgl");
      if (!gl) return false;
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch (error) {
      return false;
    }
  }

  function loadHeroScene() {
    if (heroSceneLoading || !coreVisual) return;
    if (!desktopSceneQuery.matches || prefersReducedMotion() || connection.saveData) return;
    if (!hasWebGL()) return;
    heroSceneLoading = true;
    import(heroSceneUrl)
      .then((module) => module.initHeroScene())
      .catch(() => {
        heroSceneLoading = false;
      });
  }

  if (coreVisual) {
    if ("IntersectionObserver" in window) {
      const heroSceneObserver = new IntersectionObserver(
        (entries, observer) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer.disconnect();
            loadHeroScene();
          }
        },
        { rootMargin: "320px 0px" }
      );
      heroSceneObserver.observe(coreVisual);
    } else {
      loadHeroScene();
    }

    desktopSceneQuery.addEventListener?.("change", loadHeroScene);

    window.addEventListener(
      "load",
      () => {
        window.setTimeout(loadHeroScene, 900);
      },
      { once: true }
    );
  }

  /* ---------------------------------------------------------------
     Footer year fallback (translations also replace {YEAR})
     --------------------------------------------------------------- */
  document.querySelectorAll("[data-year]").forEach((element) => {
    element.textContent = new Date().getFullYear();
  });
})();
