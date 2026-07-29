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

        var main = document.getElementById("contenido-principal") || document.getElementById("asesoramiento-root");
        if (main) {
            if (open) {
                main.setAttribute("inert", "");
                main.setAttribute("aria-hidden", "true");
            } else {
                main.removeAttribute("inert");
                main.removeAttribute("aria-hidden");
            }
        }

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
        if (!nav.classList.contains("menu-open")) return;

        if (e.key === "Escape") {
            setMenuOpen(false);
            return;
        }

        if (e.key !== "Tab") return;
        var focusables = menu.querySelectorAll('a[href], button:not([disabled])');
        if (!focusables.length) return;
        var firstEl = focusables[0];
        var lastEl = focusables[focusables.length - 1];
        var active = document.activeElement;

        if (e.shiftKey && (active === firstEl || active === toggle)) {
            e.preventDefault();
            lastEl.focus();
        } else if (!e.shiftKey && active === lastEl) {
            e.preventDefault();
            firstEl.focus();
        }
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
            window.location.href = "/asesoramiento";
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
        /* En teléfono: solo la activa (experiencia swipe limpia). En tablet: peek sutil. */
        var sideX = isPhone ? 100 : isNarrow ? 82 : 78;
        var sideScale = isPhone ? 0.92 : isNarrow ? 0.76 : 0.78;

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
            } else if (!isPhone && abs === 1) {
                x = (offset > 0 ? 1 : -1) * sideX;
                scale = sideScale;
                y = 6;
                opacity = 0.42;
                z = 4;
                visibility = "visible";
            } else {
                x = (offset > 0 ? 1 : -1) * (sideX + (isPhone ? 8 : 28));
                scale = isPhone ? 0.9 : 0.72;
                y = 10;
                opacity = 0;
                z = 1;
                visibility = "hidden";
            }

            card.style.zIndex = String(z);
            card.style.opacity = String(opacity);
            card.style.visibility = visibility;
            card.style.filter = "none";
            card.style.pointerEvents = offset === 0 || (!isPhone && abs === 1) ? "auto" : "none";
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
    var lastFocus = null;

    function getFocusable() {
        return Array.prototype.slice.call(
            lb.querySelectorAll(
                'button:not([hidden]):not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
        ).filter(function (el) {
            return el.offsetParent !== null || el === document.activeElement;
        });
    }

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
        lastFocus = document.activeElement;
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
            if (lastFocus && typeof lastFocus.focus === "function") {
                try {
                    lastFocus.focus({ preventScroll: true });
                } catch (errFocus) {
                    lastFocus.focus();
                }
            }
            lastFocus = null;
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
        if (e.key === "Tab") {
            var focusable = getFocusable();
            if (!focusable.length) return;
            var first = focusable[0];
            var last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
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


/* —— Motion: scroll reveal + tilt sutil (desktop) —— */
(function () {
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-reveal]"));
    var formRoot = document.getElementById("asesoramiento-root");
    var io = null;

    function markInView(el) {
        if (!el) return;
        el.classList.add("is-inview");
        var section = el.closest(".sobre-nosotros");
        if (section) section.classList.add("is-inview");
        var form = el.closest(".asesoramiento-form") || el.querySelector(".asesoramiento-form");
        if (el.classList.contains("asesoramiento-form") || el.classList.contains("asesoramiento-success")) {
            el.classList.add("is-inview");
        }
        if (form) form.classList.add("is-inview");
    }

    if (nodes.length) {
        if (reduceMotion || !("IntersectionObserver" in window)) {
            nodes.forEach(markInView);
            var sn = document.querySelector(".sobre-nosotros");
            if (sn) sn.classList.add("is-inview");
        } else {
            io = new IntersectionObserver(
                function (entries) {
                    entries.forEach(function (entry) {
                        if (!entry.isIntersecting) return;
                        markInView(entry.target);
                        io.unobserve(entry.target);
                    });
                },
                { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
            );
            nodes.forEach(function (el) {
                io.observe(el);
            });
        }
    }

    /* Formulario React: observar cuando aparece el form (también si no hay nodes aún) */
    if (formRoot && "MutationObserver" in window) {
        var mo = new MutationObserver(function () {
            var form = formRoot.querySelector(".asesoramiento-form, .asesoramiento-success");
            if (!form || form.classList.contains("is-inview")) return;
            form.setAttribute("data-reveal", "up");
            if (io) io.observe(form);
            else markInView(form);
        });
        mo.observe(formRoot, { childList: true, subtree: true });
    }

    /* Parallax muy sutil en hero image */
    var heroImg = document.querySelector("#hero .hero-img img");
    if (heroImg && canHover && !reduceMotion) {
        var ticking = false;
        window.addEventListener(
            "scroll",
            function () {
                if (ticking) return;
                ticking = true;
                requestAnimationFrame(function () {
                    var rect = heroImg.getBoundingClientRect();
                    if (rect.bottom > 0 && rect.top < window.innerHeight) {
                        var y = Math.max(-12, Math.min(12, (window.innerHeight / 2 - (rect.top + rect.height / 2)) * 0.04));
                        heroImg.style.transform = "translate3d(0, " + y.toFixed(2) + "px, 0)";
                    }
                    ticking = false;
                });
            },
            { passive: true }
        );
    }

    /* Tilt en cards de servicios / problema (solo desktop) */
    if (!canHover || reduceMotion) return;

    function bindTilt(el) {
        el.classList.add("has-tilt");
        el.addEventListener("pointermove", function (e) {
            var r = el.getBoundingClientRect();
            var px = (e.clientX - r.left) / r.width - 0.5;
            var py = (e.clientY - r.top) / r.height - 0.5;
            el.style.setProperty("--tilt-y", (px * 6).toFixed(2) + "deg");
            el.style.setProperty("--tilt-x", (-py * 5).toFixed(2) + "deg");
            el.style.setProperty("--tilt-lift", "-4px");
        });
        el.addEventListener("pointerleave", function () {
            el.style.setProperty("--tilt-x", "0deg");
            el.style.setProperty("--tilt-y", "0deg");
            el.style.setProperty("--tilt-lift", "0px");
        });
    }

    Array.prototype.forEach.call(document.querySelectorAll(".servicios-item, .problema-item"), bindTilt);
})();

/* —— Tech identity: red de nodos, magnético, ripple, spotlight —— */
(function () {
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    var isNarrow = window.matchMedia("(max-width: 768px)").matches;

    /* Arquitectura: animar dash al entrar */
    var arch = document.querySelector("[data-arch-links]");
    if (arch && "IntersectionObserver" in window) {
        var archIo = new IntersectionObserver(
            function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        arch.classList.add("is-drawn");
                        archIo.disconnect();
                    }
                });
            },
            { threshold: 0.25 }
        );
        archIo.observe(arch);
    }

    if (reduceMotion || isNarrow) return;

    /* Constellation canvas en hero */
    var canvas = document.querySelector("[data-hero-net]");
    if (canvas && canvas.getContext) {
        var ctx = canvas.getContext("2d");
        var nodes = [];
        var mouse = { x: -9999, y: -9999 };
        var raf = 0;
        var running = false;
        var inView = true;

        function resize() {
            var parent = canvas.parentElement;
            var w = parent.clientWidth;
            var h = parent.clientHeight;
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.floor(w * dpr);
            canvas.height = Math.floor(h * dpr);
            canvas.style.width = w + "px";
            canvas.style.height = h + "px";
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            seed(w, h);
        }

        function seed(w, h) {
            var count = w < 900 ? 18 : 28;
            nodes = [];
            for (var i = 0; i < count; i++) {
                nodes.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.25,
                    vy: (Math.random() - 0.5) * 0.25,
                    r: 1.2 + Math.random() * 1.4,
                });
            }
        }

        function start() {
            if (running || !inView || document.hidden) return;
            running = true;
            frame();
        }

        function stop() {
            running = false;
            cancelAnimationFrame(raf);
        }

        function frame() {
            if (!running) return;
            var w = canvas.clientWidth;
            var h = canvas.clientHeight;
            ctx.clearRect(0, 0, w, h);

            for (var i = 0; i < nodes.length; i++) {
                var n = nodes[i];
                var dx = mouse.x - n.x;
                var dy = mouse.y - n.y;
                var dist = Math.sqrt(dx * dx + dy * dy) || 1;
                if (dist < 140) {
                    n.vx += (dx / dist) * 0.012;
                    n.vy += (dy / dist) * 0.012;
                }
                n.x += n.vx;
                n.y += n.vy;
                n.vx *= 0.99;
                n.vy *= 0.99;
                if (n.x < 0 || n.x > w) n.vx *= -1;
                if (n.y < 0 || n.y > h) n.vy *= -1;
                n.x = Math.max(0, Math.min(w, n.x));
                n.y = Math.max(0, Math.min(h, n.y));
            }

            for (var a = 0; a < nodes.length; a++) {
                for (var b = a + 1; b < nodes.length; b++) {
                    var na = nodes[a];
                    var nb = nodes[b];
                    var ddx = na.x - nb.x;
                    var ddy = na.y - nb.y;
                    var d2 = ddx * ddx + ddy * ddy;
                    if (d2 < 130 * 130) {
                        var alpha = 0.22 * (1 - Math.sqrt(d2) / 130);
                        ctx.strokeStyle = "rgba(56, 189, 248," + alpha + ")";
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(na.x, na.y);
                        ctx.lineTo(nb.x, nb.y);
                        ctx.stroke();
                    }
                }
            }

            for (var k = 0; k < nodes.length; k++) {
                var p = nodes[k];
                ctx.fillStyle = "rgba(226, 240, 255, 0.75)";
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }

            raf = requestAnimationFrame(frame);
        }

        resize();
        start();
        window.addEventListener("resize", resize);

        if ("IntersectionObserver" in window) {
            var netIo = new IntersectionObserver(
                function (entries) {
                    entries.forEach(function (entry) {
                        inView = entry.isIntersecting;
                        if (inView) start();
                        else stop();
                    });
                },
                { threshold: 0.05 }
            );
            netIo.observe(canvas);
        }

        canvas.parentElement.addEventListener(
            "pointermove",
            function (e) {
                var r = canvas.getBoundingClientRect();
                mouse.x = e.clientX - r.left;
                mouse.y = e.clientY - r.top;
            },
            { passive: true }
        );
        canvas.parentElement.addEventListener(
            "pointerleave",
            function () {
                mouse.x = -9999;
                mouse.y = -9999;
            },
            { passive: true }
        );

        document.addEventListener("visibilitychange", function () {
            if (document.hidden) stop();
            else start();
        });
    }

    if (!canHover) return;

    /* Spotlight suave en zonas interactivas */
    var spot = document.createElement("div");
    spot.className = "cmr-spotlight";
    document.body.appendChild(spot);
    var spotOn = false;

    document.addEventListener(
        "pointermove",
        function (e) {
            var hot = e.target.closest(
                ".btn-primary, .btn-whatsapp, .btn-nav, .px-cta-btn, .servicios-item, .problema-item, .px-card.is-active .px-card-frame"
            );
            if (hot) {
                spot.style.left = e.clientX + "px";
                spot.style.top = e.clientY + "px";
                if (!spotOn) {
                    spot.classList.add("is-on");
                    spotOn = true;
                }
            } else if (spotOn) {
                spot.classList.remove("is-on");
                spotOn = false;
            }
        },
        { passive: true }
    );

    /* Magnético en CTAs */
    Array.prototype.forEach.call(document.querySelectorAll(".btn-magnetic, .px-cta-btn, .btn-nav, .plan-card__cta, .planes-cta__btn"), function (btn) {
        btn.classList.add("btn-magnetic");
        btn.addEventListener("pointermove", function (e) {
            var r = btn.getBoundingClientRect();
            var x = (e.clientX - r.left) / r.width - 0.5;
            var y = (e.clientY - r.top) / r.height - 0.5;
            btn.style.setProperty("--mx", (x * 8).toFixed(2) + "px");
            btn.style.setProperty("--my", (y * 6).toFixed(2) + "px");
        });
        btn.addEventListener("pointerleave", function () {
            btn.style.setProperty("--mx", "0px");
            btn.style.setProperty("--my", "0px");
        });
    });

    /* Ripple al click */
    document.addEventListener("click", function (e) {
        var btn = e.target.closest(".btn-primary, .btn-whatsapp, .btn-nav, .px-cta-btn, .plan-card__cta, .planes-cta__btn");
        if (!btn) return;
        var rect = btn.getBoundingClientRect();
        var ripple = document.createElement("span");
        ripple.className = "cmr-ripple";
        var size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + "px";
        ripple.style.left = e.clientX - rect.left - size / 2 + "px";
        ripple.style.top = e.clientY - rect.top - size / 2 + "px";
        btn.appendChild(ripple);
        setTimeout(function () {
            ripple.remove();
        }, 560);
    });
})();
