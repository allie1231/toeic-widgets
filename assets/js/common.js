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
      this.rawValue = element.dataset.counter;
      this.value = Number(this.rawValue);
      this.hasValue = this.rawValue !== undefined && this.rawValue !== "" && Number.isFinite(this.value);
      this.placeholder = element.dataset.counterPlaceholder || "—";
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
      if (!this.hasValue) {
        this.element.textContent = this.placeholder;
        return this;
      }

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

  const getValue = (data, path) => path
    .split(".")
    .reduce((value, key) => value?.[key], data);

  const formatValue = (element, value) => {
    const prefix = element.dataset.bindPrefix || "";
    const suffix = element.dataset.bindSuffix || "";
    const displayValue = value ?? element.dataset.bindPlaceholder ?? "";
    return `${prefix}${displayValue}${suffix}`;
  };

  const selectWithin = (root, selector) => {
    const matches = Array.from(root.querySelectorAll(selector));
    if (root instanceof Element && root.matches(selector)) matches.unshift(root);
    return matches;
  };

  function mountBars(root = document) {
    selectWithin(root, "[data-bar-height]").forEach((bar) => {
      const height = Math.max(0, Math.min(100, Number(bar.dataset.barHeight || 0)));
      bar.classList.toggle("is-empty", height === 0);
      global.requestAnimationFrame(() => { bar.style.height = height === 0 ? "4px" : `${height}%`; });
    });
  }

  function renderHeatmap(grid, levels) {
      const fragment = document.createDocumentFragment();
      levels.forEach((level, index) => {
        const cell = document.createElement("span");
        cell.className = "heatmap__cell";
        cell.dataset.level = String(Math.max(0, Math.min(4, Number(level) || 0)));
        cell.style.transitionDelay = `${index * 8}ms`;
        cell.setAttribute("aria-hidden", "true");
        fragment.appendChild(cell);
      });
      grid.replaceChildren(fragment);
  }

  function renderLineChart(chart, points) {
    const lineElement = chart.querySelector("[data-chart-line]");
    const areaElement = chart.querySelector("[data-chart-area]");
    const dotElement = chart.querySelector("[data-chart-dot]");

    if (!Array.isArray(points) || points.length < 2) {
      lineElement?.removeAttribute("d");
      areaElement?.removeAttribute("d");
      dotElement?.setAttribute("hidden", "");
      chart.classList.add("is-empty");
      return;
    }

    const width = 360;
    const top = 14;
    const bottom = 76;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;
    const coordinates = points.map((point, index) => ({
      x: index * (width / (points.length - 1)),
      y: bottom - ((point - min) / range) * (bottom - top),
    }));
    const line = coordinates.map(({ x, y }, index) => `${index ? "L" : "M"}${x} ${y}`).join(" ");
    const last = coordinates[coordinates.length - 1];

    chart.classList.remove("is-empty");
    lineElement?.setAttribute("d", line);
    areaElement?.setAttribute("d", `${line} L${width} 90 L0 90Z`);
    dotElement?.removeAttribute("hidden");
    dotElement?.setAttribute("cx", String(last.x));
    dotElement?.setAttribute("cy", String(last.y));
  }

  function mountComponents(root = document) {
    selectWithin(root, "[data-counter]").forEach((element) => new Counter(element).mount());
    selectWithin(root, "[data-progress]").forEach((element) => new ProgressBar(element).mount());
    mountBars(root);
  }

  function mountLazyFrames(root = document) {
    const frames = selectWithin(root, "iframe[data-lazy-frame][data-src]");
    if (!frames.length) return;

    const load = (frame) => {
      frame.src = frame.dataset.src;
      frame.removeAttribute("data-src");
    };

    if (!("IntersectionObserver" in global)) {
      frames.forEach(load);
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        load(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "64px 0px" });

    frames.forEach((frame) => observer.observe(frame));
  }

  class DataSource {
    constructor(root) {
      this.root = root;
      this.url = root.dataset.source;
    }

    bindObject(root, data) {
      const repeatTemplates = selectWithin(root, "template[data-repeat]");

      selectWithin(root, "[data-bind]").forEach((element) => {
        element.textContent = formatValue(element, getValue(data, element.dataset.bind));
      });

      selectWithin(root, "[data-counter-bind]").forEach((element) => {
        element.dataset.counter = String(getValue(data, element.dataset.counterBind) ?? "");
      });

      selectWithin(root, "[data-progress-bind]").forEach((element) => {
        element.dataset.progress = String(getValue(data, element.dataset.progressBind) ?? 0);
      });

      selectWithin(root, "[data-bar-bind]").forEach((element) => {
        element.dataset.barHeight = String(getValue(data, element.dataset.barBind) ?? 0);
      });

      selectWithin(root, "[data-bind-aria-label]").forEach((element) => {
        element.setAttribute("aria-label", formatValue(element, getValue(data, element.dataset.bindAriaLabel)));
      });

      selectWithin(root, "[data-bind-datetime]").forEach((element) => {
        element.setAttribute("datetime", String(getValue(data, element.dataset.bindDatetime) ?? ""));
      });

      selectWithin(root, "[data-class-bind]").forEach((element) => {
        const modifier = String(getValue(data, element.dataset.classBind) ?? "");
        const prefix = element.dataset.classPrefix || "";
        if (/^[a-z0-9-]+$/i.test(modifier)) element.classList.add(`${prefix}${modifier}`);
      });

      selectWithin(root, "[data-heatmap-bind]").forEach((grid) => {
        renderHeatmap(grid, getValue(data, grid.dataset.heatmapBind) || []);
      });

      selectWithin(root, "[data-line-chart-bind]").forEach((chart) => {
        renderLineChart(chart, getValue(data, chart.dataset.lineChartBind));
      });

      repeatTemplates.forEach((template) => {
        const items = getValue(data, template.dataset.repeat);
        const fragment = document.createDocumentFragment();

        if (Array.isArray(items)) {
          items.forEach((item) => {
            const clone = template.content.cloneNode(true);
            this.bindObject(clone, item);
            fragment.appendChild(clone);
          });
        }

        template.replaceWith(fragment);
      });
    }

    showError() {
      const message = document.createElement("p");
      message.className = "widget-error";
      message.setAttribute("role", "alert");
      message.textContent = "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
      this.root.appendChild(message);
    }

    async mount() {
      this.root.setAttribute("aria-busy", "true");

      try {
        const response = await fetch(this.url, { cache: "no-store" });
        if (!response.ok) throw new Error(`Widget data request failed: ${response.status}`);
        const data = await response.json();
        this.bindObject(this.root, data);
        mountComponents(this.root);
      } catch (error) {
        console.error(error);
        this.showError();
      } finally {
        this.root.setAttribute("aria-busy", "false");
      }

      return this;
    }
  }

  function mount() {
    Theme.init();
    mountLazyFrames();
    document.querySelectorAll("[data-card]").forEach((element) => new Card(element).mount());
    document.querySelectorAll("[data-source]").forEach((element) => new DataSource(element).mount());
    mountComponents(document);
    namespace.Animation?.reveal();
  }

  Object.assign(namespace, { Card, Counter, DataSource, ProgressBar, Theme, mount });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})(window);
