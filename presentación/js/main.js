/* Presentación — control de diapositivas, escala y soluciones */

(function () {
  "use strict";

  var stage = document.getElementById("stage");
  var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
  var topic = document.getElementById("topic");
  var counter = document.getElementById("counter");
  var progressFill = document.querySelector("#progress i");
  var dotsBox = document.getElementById("dots");
  var btnPrev = document.getElementById("prev");
  var btnNext = document.getElementById("next");

  var current = 0;

  /* ---------- escalar el escenario 1280×720 a la ventana ---------- */

  function fit() {
    var pad = 24;
    var scale = Math.min(
      (window.innerWidth - pad) / 1280,
      (window.innerHeight - pad) / 720
    );
    stage.style.transform = "scale(" + scale + ")";
  }

  window.addEventListener("resize", fit);
  fit();

  /* ---------- puntos de navegación ---------- */

  slides.forEach(function (_, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", "Ir a la diapositiva " + (i + 1));
    b.addEventListener("click", function () { goTo(i); });
    dotsBox.appendChild(b);
  });

  var dots = Array.prototype.slice.call(dotsBox.children);

  /* ---------- cambiar de diapositiva ---------- */

  function goTo(i) {
    if (i < 0 || i >= slides.length) return;
    slides[current].classList.remove("active");
    current = i;
    var slide = slides[current];
    slide.classList.add("active");

    topic.textContent = slide.getAttribute("data-topic") || "";
    counter.textContent = (current + 1) + " / " + slides.length;
    progressFill.style.width = ((current + 1) / slides.length) * 100 + "%";

    dots.forEach(function (d, j) {
      d.classList.toggle("on", j === current);
    });
  }

  btnPrev.addEventListener("click", function () { goTo(current - 1); });
  btnNext.addEventListener("click", function () { goTo(current + 1); });

  /* ---------- teclado ---------- */

  document.addEventListener("keydown", function (e) {
    switch (e.key) {
      case "ArrowRight":
      case "PageDown":
      case " ":
        e.preventDefault();
        goTo(current + 1);
        break;
      case "ArrowLeft":
      case "PageUp":
        e.preventDefault();
        goTo(current - 1);
        break;
      case "Home":
        e.preventDefault();
        goTo(0);
        break;
      case "End":
        e.preventDefault();
        goTo(slides.length - 1);
        break;
      case "f":
      case "F":
        if (!document.fullscreenElement && stage.requestFullscreen) {
          stage.requestFullscreen();
        } else if (document.exitFullscreen) {
          document.exitFullscreen();
        }
        break;
    }
  });

  /* ---------- swipe en pantallas táctiles ---------- */

  var touchX = null;

  stage.addEventListener("touchstart", function (e) {
    touchX = e.changedTouches[0].clientX;
  }, { passive: true });

  stage.addEventListener("touchend", function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) {
      goTo(dx < 0 ? current + 1 : current - 1);
    }
    touchX = null;
  }, { passive: true });

  /* ---------- mostrar / ocultar soluciones ---------- */

  document.querySelectorAll(".reveal").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var sol = btn.nextElementSibling;
      if (!sol || !sol.classList.contains("solution")) return;
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      sol.hidden = open;
      btn.textContent = open ? "Ver solución" : "Ocultar solución";
    });
  });

  /* ---------- iniciar ---------- */

  goTo(0);
})();
