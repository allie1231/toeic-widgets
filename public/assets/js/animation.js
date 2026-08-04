(function initializeAnimation(global) {
  "use strict";

  const reducedMotion = global.matchMedia("(prefers-reduced-motion: reduce)");

  const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);

  const Animation = {
    prefersReducedMotion() {
      return reducedMotion.matches;
    },

    frame({ duration = 900, update, complete }) {
      if (this.prefersReducedMotion()) {
        update(1);
        complete?.();
        return null;
      }

      const startedAt = performance.now();

      const tick = (now) => {
        const elapsed = Math.min(1, (now - startedAt) / duration);
        update(easeOutCubic(elapsed));

        if (elapsed < 1) {
          global.requestAnimationFrame(tick);
        } else {
          complete?.();
        }
      };

      return global.requestAnimationFrame(tick);
    },

    reveal(elements = document.querySelectorAll("[data-animate]")) {
      const targets = Array.from(elements);
      if (!targets.length) return;

      if (this.prefersReducedMotion() || !("IntersectionObserver" in global)) {
        targets.forEach((element) => element.classList.add("is-visible"));
        return;
      }

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      }, { threshold: 0.12 });

      targets.forEach((element) => observer.observe(element));
    },
  };

  global.TOEICWidgets = global.TOEICWidgets || {};
  global.TOEICWidgets.Animation = Animation;
})(window);
