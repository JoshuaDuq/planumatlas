/* Accessible controls for Furo's native navigation and page-outline drawers. */
document.addEventListener("DOMContentLoaded", () => {
  for (const region of document.querySelectorAll(".table-wrapper, div.highlight pre")) {
    region.tabIndex = 0;
  }
  const compactOutline = window.matchMedia("(max-width: 82em)");
  const drawers = [
    [".docs-nav-toggle", "__navigation", "docs-navigation"],
    [".docs-toc-toggle", "__toc", "docs-page-contents"],
  ].map(([selector, inputId, panelId]) => ({
    button: document.querySelector(selector),
    input: document.getElementById(inputId),
    panel: document.getElementById(panelId),
  })).filter(({ button, panel }) => button && panel);

  function syncDrawers() {
    const navigationOpen = document.getElementById("__navigation").checked;
    for (const { button, input, panel } of drawers) {
      button.setAttribute("aria-expanded", String(input.checked));
      const isDrawer = input.id === "__navigation" || compactOutline.matches;
      panel.closest("aside").inert = isDrawer ? !input.checked : navigationOpen;
    }
    document.querySelector(".content").inert = drawers.some(({ input }) => input.checked);
  }

  for (const { button, input, panel } of drawers) {
    button.hidden = false;
    input.addEventListener("change", syncDrawers);
    button.addEventListener("click", () => {
      const open = !input.checked;
      for (const other of drawers) other.input.checked = other.input === input && open;
      syncDrawers();
      if (input.checked) panel.querySelector("input, a")?.focus();
    });
    panel.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");
      if (!link || !input.checked) return;
      input.checked = false;
      syncDrawers();
      if (link.getAttribute("href").startsWith("#")) {
        const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
        const heading = target.querySelector("h1, h2, h3, h4");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      }
    });
  }
  compactOutline.addEventListener("change", () => {
    document.getElementById("__toc").checked = false;
    syncDrawers();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const open = drawers.find(({ input }) => input.checked);
    if (!open) return;
    open.input.checked = false;
    syncDrawers();
    open.button.focus();
  });
  syncDrawers();
});
