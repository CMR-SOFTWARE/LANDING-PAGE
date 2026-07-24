/* CMR Software Solutions — comportamiento del sitio (scroll, carruseles, formulario) */

(function () {
    var toggle = document.querySelector(".js-nav-toggle");
    var nav = document.querySelector(".site-nav");
    var menu = document.getElementById("nav-primary");
    if (!toggle || !nav || !menu) return;

    function setMenuOpen(open, opts) {
        opts = opts || {};
        nav.classList.toggle("menu-open", open);
        menu.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.setAttribute(
            "aria-label",
            open ? "Cerrar menú de navegación" : "Abrir menú de navegación"
        );
        document.body.classList.toggle("nav-menu-open", open);
        if (open) {
            var first = menu.querySelector("a, button");
            if (first && typeof first.focus === "function") {
                window.setTimeout(function () {
                    try {
                        first.focus({ preventScroll: true });
                    } catch (err) {
                        first.focus();
                    }
                }, 0);
            }
        } else if (opts.focusToggle !== false) {
            try {
                toggle.focus({ preventScroll: true });
            } catch (err2) {
                toggle.focus();
            }
        }
    }

    toggle.addEventListener("click", function () {
        setMenuOpen(!nav.classList.contains("menu-open"));
    });

    menu.addEventListener("click", function (e) {
        if (e.target.closest("a") || e.target.closest(".btn-nav")) {
            setMenuOpen(false, { focusToggle: false });
        }
    });

    window.addEventListener("resize", function () {
        if (window.matchMedia("(min-width: 961px)").matches) {
            setMenuOpen(false, { focusToggle: false });
        }
    });

    document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        if (!nav.classList.contains("menu-open")) return;
        setMenuOpen(false);
    });
})();

(function () {
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    var waChatUrl =
        "https://wa.me/5493364578599?text=" +
        encodeURIComponent("Hola CMR, me gustaría recibir información sobre sus servicios.");

    document.addEventListener("click", function (e) {
        if (e.target.closest(".js-goto-asesoramiento")) {
            window.location.href = "/asesoramiento.html";
            return;
        }
        if (e.target.closest(".btn-whatsapp")) {
            e.preventDefault();
            var winWa = window.open(waChatUrl, "_blank");
            if (winWa) {
                winWa.opener = null;
            }
            return;
        }
        var a = e.target.closest('a[href^="#"]');
        if (!a) return;
        var href = a.getAttribute("href");
        if (!href || href === "#") return;
        var target = document.querySelector(href);
        if (!target) return;
        if (reduceMotion) return;

        e.preventDefault();
        var start = window.scrollY;
        var end = target.getBoundingClientRect().top + start;
        var distance = Math.abs(end - start);
        if (distance < 3) {
            history.pushState(null, "", href);
            return;
        }
        var duration = Math.min(2600, Math.max(480, distance * 0.7));
        var t0 = null;

        function step(ts) {
            if (t0 === null) t0 = ts;
            var elapsed = ts - t0;
            var p = Math.min(elapsed / duration, 1);
            window.scrollTo(0, start + (end - start) * easeInOutCubic(p));
            if (p < 1) {
                requestAnimationFrame(step);
            } else {
                history.pushState(null, "", href);
            }
        }
        requestAnimationFrame(step);
    });
})();

(function () {
    var section = document.getElementById("proyectos");
    if (!section) return;

    var cards = Array.prototype.slice.call(section.querySelectorAll("[data-px-card]"));
    if (!cards.length) return;

    var prevBtn = section.querySelector(".px-nav--prev");
    var nextBtn = section.querySelector(".px-nav--next");
    var dotsHost = section.querySelector("[data-px-dots]");
    var viewport = section.querySelector(".px-viewport");
    var active = 0;
    var n = cards.length;
    var dragX = null;
    var dragMoved = false;

    function layout() {
        var w = window.innerWidth;
        var isNarrow = w <= 768;
        var isPhone = w <= 480;
        /* Separación alta: laterales solo se insinúan; nada atraviesa la activa */
        var sideX = isPhone ? 88 : isNarrow ? 82 : 78;
        var sideScale = isPhone ? 0.74 : isNarrow ? 0.76 : 0.78;

        cards.forEach(function (card, i) {
            var offset = i - active;
            if (offset > n / 2) offset -= n;
            else if (offset < -n / 2) offset += n;
            var abs = Math.abs(offset);
            card.classList.toggle("is-active", offset === 0);
            card.setAttribute("aria-hidden", offset === 0 ? "false" : "true");
            card.tabIndex = offset === 0 ? 0 : -1;

            var x;
            var scale;
            var y;
            var opacity;
            var z;
            var visibility;

            if (offset === 0) {
                x = 0;
                scale = 1;
                y = 0;
                opacity = 1;
                z = 10;
                visibility = "visible";
            } else if (abs === 1) {
                x = (offset > 0 ? 1 : -1) * sideX;
                scale = sideScale;
                y = 6;
                opacity = 0.42;
                z = 4;
                visibility = "visible";
            } else {
                x = (offset > 0 ? 1 : -1) * (sideX + 28);
                scale = 0.72;
                y = 10;
                opacity = 0;
                z = 1;
                visibility = "hidden";
            }

            card.style.zIndex = String(z);
            card.style.opacity = String(opacity);
            card.style.visibility = visibility;
            card.style.filter = "none";
            card.style.pointerEvents = abs === 0 || abs === 1 ? "auto" : "none";
            /* Plano 2D: sin rotateY para evitar bleed-through */
            card.style.transform =
                "translate(-50%, -50%) translateX(" +
                x +
                "%) translateY(" +
                y +
                "px) scale(" +
                scale +
                ")";
        });

        if (dotsHost) {
            var dots = dotsHost.querySelectorAll(".px-dot");
            for (var d = 0; d < dots.length; d++) {
                dots[d].classList.toggle("is-active", d === active);
                dots[d].setAttribute("aria-selected", d === active ? "true" : "false");
            }
        }
    }

    function goTo(index) {
        active = ((index % n) + n) % n;
        layout();
    }

    function buildDots() {
        if (!dotsHost) return;
        dotsHost.innerHTML = "";
        for (var i = 0; i < n; i++) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "px-dot" + (i === 0 ? " is-active" : "");
            btn.setAttribute("role", "tab");
            btn.setAttribute("aria-label", "Ir al proyecto " + (i + 1));
            btn.setAttribute("aria-selected", i === 0 ? "true" : "false");
            (function (idx) {
                btn.addEventListener("click", function () {
                    goTo(idx);
                });
            })(i);
            dotsHost.appendChild(btn);
        }
    }

    if (prevBtn) {
        prevBtn.addEventListener("click", function () {
            goTo(active - 1);
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener("click", function () {
            goTo(active + 1);
        });
    }

    cards.forEach(function (card, i) {
        card.addEventListener("click", function (e) {
            if (e.target.closest("[data-px-more]")) return;
            if (dragMoved) {
                dragMoved = false;
                return;
            }
            if (i !== active) {
                goTo(i);
                return;
            }
            if (e.target.closest(".px-card-frame") && typeof section._pxOpenViewer === "function") {
                section._pxOpenViewer(card);
            }
        });
    });

    if (viewport) {
        viewport.addEventListener(
            "pointerdown",
            function (e) {
                if (e.pointerType === "mouse" && e.button !== 0) return;
                dragX = e.clientX;
                dragMoved = false;
            },
            { passive: true }
        );
        viewport.addEventListener(
            "pointerup",
            function (e) {
                if (dragX == null) return;
                var dx = e.clientX - dragX;
                dragX = null;
                if (Math.abs(dx) < 48) return;
                dragMoved = true;
                goTo(active + (dx < 0 ? 1 : -1));
            },
            { passive: true }
        );
        viewport.addEventListener(
            "pointercancel",
            function () {
                dragX = null;
            },
            { passive: true }
        );
        viewport.addEventListener(
            "wheel",
            function (e) {
                if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 8) {
                    e.preventDefault();
                    goTo(active + (e.deltaX > 0 ? 1 : -1));
                }
            },
            { passive: false }
        );
    }

    section.addEventListener("keydown", function (e) {
        if (!section.contains(document.activeElement) && document.activeElement !== section) return;
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            goTo(active - 1);
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            goTo(active + 1);
        }
    });

    /* Sin parallax: object-fit contain + capas limpias */
    window.addEventListener(
        "resize",
        (function () {
            var t;
            return function () {
                clearTimeout(t);
                t = setTimeout(layout, 100);
            };
        })()
    );

    buildDots();
    layout();

    section._pxGoTo = goTo;
    section._pxGetActive = function () {
        return active;
    };
    section._pxWasDrag = function () {
        var was = dragMoved;
        dragMoved = false;
        return was;
    };
})();


(function () {
    var section = document.getElementById("proyectos");
    var lb = document.getElementById("proyecto-captura-lightbox");
    if (!section || !lb) return;

    var shell = lb.querySelector("[data-px-viewer-shell]");
    var backdrop = lb.querySelector(".px-viewer-backdrop");
    var closeBtn = lb.querySelector(".px-viewer-close");
    var titleEl = lb.querySelector("[data-px-viewer-title]");
    var descEl = lb.querySelector("[data-px-viewer-desc]");
    var counterEl = lb.querySelector("[data-px-viewer-counter]");
    var imgEl = lb.querySelector("[data-px-viewer-img]");
    var canvas = lb.querySelector(".px-viewer-canvas");
    var prevBtn = lb.querySelector(".px-viewer-nav--prev");
    var nextBtn = lb.querySelector(".px-viewer-nav--next");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var gallery = [];
    var index = 0;
    var open = false;
    var fadeTimer = null;

    function setSlide(i, animate) {
        if (!gallery.length) return;
        index = ((i % gallery.length) + gallery.length) % gallery.length;
        var item = gallery[index];

        function apply() {
            imgEl.src = item.src;
            imgEl.alt = item.alt || "";
            if (counterEl) {
                counterEl.textContent = gallery.length > 1 ? index + 1 + " / " + gallery.length : "";
            }
            if (canvas) canvas.classList.remove("is-fading");
        }

        if (animate && !reduceMotion && canvas) {
            canvas.classList.add("is-fading");
            clearTimeout(fadeTimer);
            fadeTimer = setTimeout(apply, 180);
        } else {
            apply();
        }
    }

    function openViewer(card) {
        if (!card || open) return;

        var title = card.querySelector(".px-card-title");
        var desc = card.querySelector(".px-card-desc");
        var galleryRoot = card.querySelector(".px-card-gallery");
        var imgs = galleryRoot
            ? Array.prototype.slice.call(galleryRoot.querySelectorAll("img"))
            : Array.prototype.slice.call(card.querySelectorAll(".px-card-media img"));
        if (!imgs.length) return;

        gallery = imgs.map(function (im) {
            return { src: im.getAttribute("src") || "", alt: im.getAttribute("alt") || "" };
        });
        index = 0;

        if (titleEl) titleEl.textContent = title ? title.textContent.trim() : "Proyecto";
        if (descEl) descEl.textContent = desc ? desc.textContent.trim() : "";

        var multi = gallery.length > 1;
        if (prevBtn) prevBtn.hidden = !multi;
        if (nextBtn) nextBtn.hidden = !multi;

        setSlide(0, false);

        if (shell) {
            shell.style.removeProperty("transform");
            shell.style.removeProperty("opacity");
            shell.style.transformOrigin = "50% 50%";
        }

        open = true;
        lb.hidden = false;
        document.body.style.overflow = "hidden";
        section.classList.add("is-viewer-open");

        /* Forzar reflow para que fade+scale partan del estado cerrado */
        void lb.offsetWidth;

        requestAnimationFrame(function () {
            lb.classList.add("is-open");
            try {
                closeBtn.focus({ preventScroll: true });
            } catch (err) {
                if (closeBtn) closeBtn.focus();
            }
        });
    }

    function closeViewer() {
        if (!open && lb.hidden) return;
        open = false;
        lb.classList.remove("is-open");
        section.classList.remove("is-viewer-open");

        var done = function () {
            lb.hidden = true;
            document.body.style.overflow = "";
            gallery = [];
            if (shell) {
                shell.style.removeProperty("transform");
                shell.style.removeProperty("opacity");
                shell.style.removeProperty("transform-origin");
            }
            if (imgEl) {
                imgEl.removeAttribute("src");
                imgEl.alt = "";
            }
        };

        if (reduceMotion) {
            done();
            return;
        }
        setTimeout(done, 420);
    }

    section._pxCloseViewer = closeViewer;

    section.addEventListener("click", function (e) {
        var more = e.target.closest("[data-px-more]");
        if (!more) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof section._pxWasDrag === "function" && section._pxWasDrag()) {
            return;
        }
        var card = more.closest("[data-px-card]");
        if (!card) return;
        var idx = parseInt(card.getAttribute("data-index"), 10);
        if (!isNaN(idx) && typeof section._pxGoTo === "function") {
            section._pxGoTo(idx);
        }
        openViewer(card);
    });

    section._pxOpenViewer = openViewer;

    if (backdrop) backdrop.addEventListener("click", closeViewer);
    if (closeBtn) {
        closeBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            closeViewer();
        });
    }
    if (prevBtn) {
        prevBtn.addEventListener("click", function () {
            setSlide(index - 1, true);
        });
    }
    if (nextBtn) {
        nextBtn.addEventListener("click", function () {
            setSlide(index + 1, true);
        });
    }

    /* Swipe táctil en el visor */
    if (canvas) {
        var swipeX = null;
        canvas.addEventListener(
            "pointerdown",
            function (e) {
                if (e.pointerType === "mouse" && e.button !== 0) return;
                swipeX = e.clientX;
            },
            { passive: true }
        );
        canvas.addEventListener(
            "pointerup",
            function (e) {
                if (swipeX == null) return;
                var dx = e.clientX - swipeX;
                swipeX = null;
                if (Math.abs(dx) < 48) return;
                setSlide(index + (dx < 0 ? 1 : -1), true);
            },
            { passive: true }
        );
        canvas.addEventListener(
            "pointercancel",
            function () {
                swipeX = null;
            },
            { passive: true }
        );
    }

    document.addEventListener("keydown", function (e) {
        if (!open || lb.hidden) return;
        if (e.key === "Escape") {
            e.preventDefault();
            closeViewer();
            return;
        }
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            setSlide(index - 1, true);
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            setSlide(index + 1, true);
        }
    });
})();



/* El formulario de asesoramiento vive en React (/asesoramiento.html) y
   envía a la Edge Function de Supabase. Ya no se usa mailto:. */
(function () {
    document.addEventListener("click", function (e) {
        if (e.target.closest(".js-scroll-form")) {
            e.preventDefault();
            window.location.href = "/asesoramiento.html";
        }
    });
})();
