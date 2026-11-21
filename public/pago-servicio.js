/* Pago de un mes de plan con Mercado Pago (landing CMR).
 *
 * - Los botones "Pagar con Mercado Pago" nacen ocultos y solo aparecen si el servidor dice
 *   que el cobro está configurado (GET /api/checkout -> { enabled: true }).
 * - El formulario manda SOLO el servicio y los datos de contacto: el precio lo pone el servidor.
 * - Solo se redirige a enlaces https de mercadopago.com / mercadopago.com.ar.
 * - La vuelta (?mp=ok|error|pendiente) es solo informativa: confirma el webhook, no el navegador.
 */
(function () {
  "use strict";

  // Misma regla que api/_lib/mp-url.js (test/mp-url.test.js prueba las dos).
  function esUrlDeMercadoPago(url) {
    try {
      var u = new URL(String(url));
      return u.protocol === "https:" && !u.username && !u.password && !u.port &&
        /(^|\.)mercadopago\.com(\.ar)?$/i.test(u.hostname);
    } catch (_) {
      return false;
    }
  }

  var MENSAJES = {
    ok: {
      tipo: "ok",
      titulo: "¡Gracias! Recibimos tu pago",
      texto: "La contratación queda confirmada cuando Mercado Pago nos avisa que el pago se acreditó. Te vamos a contactar por mail.",
    },
    pendiente: {
      tipo: "pendiente",
      titulo: "Tu pago está en proceso",
      texto: "La contratación se confirma cuando Mercado Pago acredite el pago. No hace falta que pagues de nuevo.",
    },
    error: {
      tipo: "error",
      titulo: "El pago no se completó",
      texto: "Podés intentarlo de nuevo o escribirnos y lo resolvemos juntos.",
    },
  };

  // WhatsApp de CMR (el mismo del botón "Hablar por WhatsApp" de la landing).
  var WHATSAPP_CMR = "5493364578599";

  // Enlace para que el cliente nos mande el comprobante, con el plan y el número de contratación.
  // nombrePlan sale de los botones de ESTA página (ver nombreDelPlan), nunca del texto de la URL;
  // el número solo entra si es un número.
  function linkWhatsApp(contratacion, nombrePlan) {
    var nro = /^[0-9]{1,15}$/.test(String(contratacion || "")) ? " N° " + contratacion : "";
    var plan = nombrePlan ? " el " + nombrePlan + " (contratación" + nro + ")" : " la contratación" + nro;
    var texto = "Hola CMR, pagué con Mercado Pago" + plan + ". Les mando el comprobante.";
    return "https://wa.me/" + WHATSAPP_CMR + "?text=" + encodeURIComponent(texto);
  }

  // "plan-web" -> "Plan Web", buscando el botón de ese plan en la landing.
  function nombreDelPlan(slug) {
    if (!/^[a-z0-9-]{1,40}$/.test(String(slug || ""))) return "";
    var b = document.querySelector('.js-mp-pagar[data-servicio="' + slug + '"]');
    return (b && b.getAttribute("data-servicio-nombre")) || "";
  }

  function mostrarVuelta() {
    var params = new URLSearchParams(window.location.search);
    var m = MENSAJES[params.get("mp")];
    if (!m) return;
    var contratacion = params.get("contratacion");
    var plan = nombreDelPlan(params.get("servicio"));
    var aviso = document.createElement("div");
    aviso.className = "mp-aviso mp-aviso--" + m.tipo;
    aviso.setAttribute("role", "status");
    var t = document.createElement("strong");
    t.textContent = m.titulo;
    var p = document.createElement("p");
    p.textContent = m.texto;
    var cerrar = document.createElement("button");
    cerrar.type = "button";
    cerrar.className = "mp-aviso__cerrar";
    cerrar.setAttribute("aria-label", "Cerrar aviso");
    cerrar.textContent = "×";
    cerrar.addEventListener("click", function () { aviso.remove(); });
    aviso.append(t, p);
    if (m.tipo !== "error") {
      var wsp = document.createElement("a");
      wsp.className = "mp-aviso__wsp";
      wsp.href = linkWhatsApp(contratacion, plan);
      wsp.target = "_blank";
      wsp.rel = "noopener noreferrer";
      wsp.textContent = "Mandar comprobante por WhatsApp";
      aviso.append(wsp);
    }
    aviso.append(cerrar);
    document.body.appendChild(aviso);
    // Limpia la URL para que al recargar no vuelva a aparecer.
    params.delete("mp");
    params.delete("contratacion");
    params.delete("servicio");
    var qs = params.toString();
    history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : "") + (window.location.hash || "#planes"));
    // La vuelta de Mercado Pago llega sin "#": se baja a los planes.
    var planes = document.getElementById("planes");
    if (planes && planes.scrollIntoView) planes.scrollIntoView();
  }

  // Matriz del QR de un link de Mercado Pago (null si el link no es de Mercado Pago o falta la librería).
  // Usa qrcode-generator 1.4.4 (public/vendor, MIT), que se carga antes que este script.
  function matrizQR(url) {
    if (!esUrlDeMercadoPago(url) || typeof window.qrcode !== "function") return null;
    var qr = window.qrcode(0, "M"); // 0 = tamaño automático; M = corrección de errores media
    qr.addData(String(url));
    qr.make();
    var n = qr.getModuleCount();
    var filas = [];
    for (var r = 0; r < n; r++) {
      var fila = [];
      for (var c = 0; c < n; c++) fila.push(qr.isDark(r, c));
      filas.push(fila);
    }
    return filas;
  }

  function dibujarQR(canvas, filas) {
    var n = filas.length + 8; // 4 módulos de margen blanco por lado (lo pide el estándar)
    var tam = Math.floor(canvas.width / n);
    var ctx = canvas.getContext("2d");
    var off = Math.floor((canvas.width - tam * n) / 2);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    filas.forEach(function (fila, r) {
      fila.forEach(function (oscuro, c) {
        if (oscuro) ctx.fillRect(off + (c + 4) * tam, off + (r + 4) * tam, tam, tam);
      });
    });
  }

  function crearDialogo() {
    var d = document.createElement("dialog");
    d.className = "mp-dialogo";
    d.innerHTML =
      '<form method="dialog" class="mp-form" novalidate>' +
      '<h3 class="mp-form__titulo">Contratar <span data-mp-nombre></span></h3>' +
      '<p class="mp-form__monto">Pago único de 1 mes: <strong data-mp-precio></strong></p>' +
      '<label>Nombre y apellido<input name="nombre" autocomplete="name" required minlength="2" maxlength="120"></label>' +
      '<label>Email<input name="email" type="email" autocomplete="email" required maxlength="160"></label>' +
      '<label>Teléfono (opcional)<input name="telefono" type="tel" autocomplete="tel" maxlength="40"></label>' +
      '<p class="mp-form__error" role="alert" hidden></p>' +
      '<div class="mp-form__acciones">' +
      '<button type="button" class="mp-form__cancelar" value="cancel">Cancelar</button>' +
      '<button type="submit" class="mp-form__pagar">Ir a pagar a Mercado Pago</button>' +
      "</div>" +
      '<button type="submit" class="mp-form__qr" data-modo="qr">Prefiero pagar con QR desde el celular</button>' +
      '<p class="mp-form__nota">Vas a pagar en el sitio de Mercado Pago. Nosotros no vemos los datos de tu tarjeta.</p>' +
      "</form>" +
      '<div class="mp-qr" hidden>' +
      '<h3 class="mp-form__titulo">Escaneá con el celular</h3>' +
      '<p class="mp-qr__texto">Abrí la cámara o la app de Mercado Pago y escaneá el código. Vas a pagar <strong data-mp-precio></strong>.</p>' +
      '<canvas class="mp-qr__codigo" width="264" height="264" role="img" aria-label="Código QR para pagar con Mercado Pago"></canvas>' +
      '<p class="mp-form__nota">Cuando Mercado Pago acredite el pago te llega la confirmación por mail.</p>' +
      '<div class="mp-form__acciones">' +
      '<button type="button" class="mp-form__cancelar mp-qr__cerrar">Cerrar</button>' +
      '<a class="mp-form__pagar mp-qr__link" rel="noopener">Pagar en esta pantalla</a>' +
      "</div>" +
      "</div>";
    document.body.appendChild(d);
    return d;
  }

  function iniciarBotones(botones) {
    var dialogo = crearDialogo();
    var form = dialogo.querySelector("form");
    var error = dialogo.querySelector(".mp-form__error");
    var pagar = dialogo.querySelector(".mp-form__pagar");
    var botonQR = dialogo.querySelector(".mp-form__qr");
    var panelQR = dialogo.querySelector(".mp-qr");
    var servicio = null;

    function verFormulario() {
      form.hidden = false;
      panelQR.hidden = true;
    }

    // Devuelve false si no se pudo dibujar (el que llama redirige como siempre).
    function verQR(url) {
      var filas = matrizQR(url);
      if (!filas) return false;
      dibujarQR(panelQR.querySelector("canvas"), filas);
      panelQR.querySelector(".mp-qr__link").href = url;
      form.hidden = true;
      panelQR.hidden = false;
      return true;
    }

    panelQR.querySelector(".mp-qr__cerrar").addEventListener("click", function () { dialogo.close(); });
    dialogo.addEventListener("close", verFormulario);

    function mostrarError(msg) {
      error.textContent = msg;
      error.hidden = !msg;
    }

    dialogo.querySelector(".mp-form__cancelar").addEventListener("click", function () { dialogo.close(); });

    botones.forEach(function (b) {
      b.hidden = false;
      b.addEventListener("click", function () {
        servicio = b.getAttribute("data-servicio");
        dialogo.querySelector("[data-mp-nombre]").textContent = b.getAttribute("data-servicio-nombre") || "";
        dialogo.querySelectorAll("[data-mp-precio]").forEach(function (el) {
          el.textContent = b.getAttribute("data-servicio-precio") || "";
        });
        verFormulario();
        mostrarError("");
        dialogo.showModal();
      });
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!form.reportValidity()) return;
      var datos = new FormData(form);
      var conQR = !!(ev.submitter && ev.submitter.getAttribute("data-modo") === "qr");
      pagar.disabled = true;
      botonQR.disabled = true;
      (conQR ? botonQR : pagar).textContent = conQR ? "Generando QR…" : "Generando enlace…";
      mostrarError("");
      fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          servicio: servicio,
          nombre: datos.get("nombre"),
          email: datos.get("email"),
          telefono: datos.get("telefono"),
        }),
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (data) { return { ok: r.ok, data: data }; });
        })
        .then(function (r) {
          if (r.ok && esUrlDeMercadoPago(r.data.checkoutUrl)) {
            // Con QR se muestra el código; si no se pudo dibujar, se va a pagar como siempre.
            if (conQR && verQR(r.data.checkoutUrl)) return;
            window.location.assign(r.data.checkoutUrl);
            return;
          }
          mostrarError((r.data && r.data.error) || "No pudimos iniciar el pago. Probá de nuevo.");
        })
        .catch(function () { mostrarError("No hay conexión. Probá de nuevo."); })
        .finally(function () {
          pagar.disabled = false;
          botonQR.disabled = false;
          pagar.textContent = "Ir a pagar a Mercado Pago";
          botonQR.textContent = "Prefiero pagar con QR desde el celular";
        });
    });
  }

  function init() {
    mostrarVuelta();
    var botones = Array.prototype.slice.call(document.querySelectorAll(".js-mp-pagar"));
    if (!botones.length) return;
    fetch("/api/checkout", { headers: { accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : { enabled: false }; })
      .then(function (d) { if (d && d.enabled === true) iniciarBotones(botones); })
      .catch(function () { /* sin servidor (p. ej. vite dev): los botones siguen ocultos */ });
  }

  window.CMRPagoServicio = { esUrlDeMercadoPago: esUrlDeMercadoPago, linkWhatsApp: linkWhatsApp, matrizQR: matrizQR };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
