(function initializeWidgets(global) {
  "use strict";

  const namespace = global.TOEICWidgets = global.TOEICWidgets || {};

  class Theme {
    static query = global.matchMedia("(prefers-color-scheme: dark)");

    static current() {
      return this.query.matches ? "dark" : "light";
    }

    static sync() {
      document.documentElement.dataset.theme = this.current();
    }

    static init() {
      this.sync();
      this.query.addEventListener?.("change", () => this.sync());
      return this.current();
    }
  }

  class Card {
    constructor(element) {
      this.element = element;
    }

    mount() {
      global.requestAnimationFrame(() => this.element.classList.add("is-ready"));
      return this;
    }
  }

  class Counter {
    constructor(element) {
      this.element = element;
      this.value = Number(element.dataset.counter || 0);
      this.decimals = Number(element.dataset.counterDecimals || 0);
      this.prefix = element.dataset.counterPrefix || "";
      this.suffix = element.dataset.counterSuffix || "";
      this.duration = Number(element.dataset.counterDuration || 900);
    }

    render(value) {
      const formatted = value.toLocaleString(document.documentElement.lang || "ko-KR", {
        minimumFractionDigits: this.decimals,
        maximumFractionDigits: this.decimals,
      });
      this.element.textContent = `${this.prefix}${formatted}${this.suffix}`;
    }

    mount() {
      const animation = namespace.Animation;
      if (!animation) {
        this.render(this.value);
        return this;
      }

      animation.frame({
        duration: this.duration,
        update: (progress) => this.render(this.value * progress),
      });
      return this;
    }
  }

  class ProgressBar {
    constructor(element) {
      this.element = element;
      this.fill = element.querySelector(".progress__fill");
      this.value = Math.max(0, Math.min(100, Number(element.dataset.progress || 0)));
    }

    mount() {
      this.element.setAttribute("role", "progressbar");
      this.element.setAttribute("aria-valuemin", "0");
      this.element.setAttribute("aria-valuemax", "100");
      this.element.setAttribute("aria-valuenow", String(this.value));
      global.requestAnimationFrame(() => {
        if (this.fill) this.fill.style.width = `${this.value}%`;
      });
      return this;
    }
  }

  function mountBars() {
    document.querySelectorAll("[data-bar-height]").forEach((bar) => {
      const height = Math.max(0, Math.min(100, Number(bar.dataset.barHeight || 0)));
      global.requestAnimationFrame(() => { bar.style.height = `${height}%`; });
    });
  }

  function mountHeatmaps() {
    document.querySelectorAll("[data-heatmap]").forEach((grid) => {
      const levels = (grid.dataset.heatmap || "")
        .split(",")
        .map((value) => Math.max(0, Math.min(4, Number(value.trim()) || 0)));

      const fragment = document.createDocumentFragment();
      levels.forEach((level, index) => {
        const cell = document.createElement("span");
        cell.className = "heatmap__cell";
        cell.dataset.level = String(level);
        cell.style.transitionDelay = `${index * 8}ms`;
        cell.setAttribute("aria-hidden", "true");
        fragment.appendChild(cell);
      });
      grid.replaceChildren(fragment);
    });
  }

  function mount() {
    Theme.init();
    mountHeatmaps();
    document.querySelectorAll("[data-card]").forEach((element) => new Card(element).mount());
    document.querySelectorAll("[data-counter]").forEach((element) => new Counter(element).mount());
    document.querySelectorAll("[data-progress]").forEach((element) => new ProgressBar(element).mount());
    mountBars();
    namespace.Animation?.reveal();
  }

  Object.assign(namespace, { Card, Counter, ProgressBar, Theme, mount });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})(window);
