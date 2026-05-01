/* ---------------------------------------------------------------------------
   Position toggle interactivity + live summary computation
   - Click any toggle to flip its position's active state
   - Updates the parent <li> data-active flag (drives the dim-on-off styling)
   - Recomputes the summary panel from active positions:
       Selected positions  = count of active rows
       Total collateral    = Σ value of active rows
       Estimated Max Loan  = Σ (value × LTV) of active rows
         (LTV per Varla docs: Conservative 80% / Moderate 65% / Risk 50%)
   --------------------------------------------------------------------------- */

const positions = document.querySelectorAll(".position");
const selectedCountEl = document.getElementById("selected-count");
const totalCountEl = document.getElementById("total-count");
const totalCollateralEl = document.getElementById("total-collateral");
const estimatedMaxLoanEl = document.getElementById("estimated-max-loan");
const depositButton = document.querySelector(".deposit-button");

// Health Factor elements + constants
// Per Varla docs (https://varla.xyz/docs/risk-engine/health-factor):
//   Health Factor = Σ(Position Value × Liquidation Threshold) / Total Debt
// We model a hypothetical existing debt so the bar shows live progression
// as the user toggles positions. With the two default-active positions
// (NBA + Taylor) this works out to ≈ 1.52, matching the Figma reference.
const hfValueEl = document.getElementById("health-factor-value");
const hfIndicatorEl = document.getElementById("hf-indicator");
const hfBarRedEl = document.getElementById("hf-bar-red");
const hfBarGreenEl = document.getElementById("hf-bar-green");

const HF_DEFAULT_TEXT = hfValueEl.textContent; // "1.00" placeholder
const HF_DEFAULT_VALUE = parseFloat(HF_DEFAULT_TEXT) || 1;
const HF_SCALE_MAX = 2.0; // bar tops out at 2.0
const EXISTING_DEBT = 36500; // hypothetical debt (USD) — calibrates the bar

/* ---------------------------------------------------------------------------
   animateNumber(el, to, formatter, duration?)
   Tweens an element's numeric text from its previously rendered value to a
   new target, using easeOutCubic. The current animated value is stashed on
   the element itself (`el._numCurrent`) so retriggering mid-animation picks
   up smoothly from wherever it visibly sits, with no jump.
   --------------------------------------------------------------------------- */
function animateNumber(el, to, formatter, duration = 300) {
  const from = typeof el._numCurrent === "number" ? el._numCurrent : to;

  if (el._numAnim) cancelAnimationFrame(el._numAnim);

  if (from === to) {
    el._numCurrent = to;
    el.textContent = formatter(to);
    return;
  }

  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = from + (to - from) * eased;
    el._numCurrent = current;
    el.textContent = formatter(current);
    if (t < 1) {
      el._numAnim = requestAnimationFrame(step);
    } else {
      el._numAnim = null;
      el._numCurrent = to;
      el.textContent = formatter(to);
    }
  }
  el._numAnim = requestAnimationFrame(step);
}

const fmtInt = (n) => Math.round(n).toString();
const fmtCurrency = (n) => currencyFormatter.format(Math.round(n));
const fmtDecimal2 = (n) => n.toFixed(2);

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function refreshSummary() {
  const active = document.querySelectorAll('.position[data-active="true"]');

  let totalCollateral = 0;
  let maxLoan = 0;
  let weightedLiq = 0; // Σ(value × liquidation threshold) for HF
  active.forEach((p) => {
    const value = Number(p.dataset.value) || 0;
    const ltv = Number(p.dataset.ltv) || 0;
    const liq = Number(p.dataset.liq) || 0;
    totalCollateral += value;
    maxLoan += value * ltv;
    weightedLiq += value * liq;
  });

  // 350ms tween for summary updates (Package A, item 4)
  animateNumber(selectedCountEl, active.length, fmtInt, 350);
  totalCountEl.textContent = positions.length; // never changes, no anim
  animateNumber(totalCollateralEl, totalCollateral, fmtCurrency, 350);
  animateNumber(estimatedMaxLoanEl, maxLoan, fmtCurrency, 350);

  // Disable the deposit button when nothing is selected
  depositButton.disabled = active.length === 0;

  refreshHealthFactor(active.length, weightedLiq);
}

/* Compute indicator color from its position along the bar.
   Reversed mapping: pct=0 (HF=0, riskiest) is red; pct=1 (HF=2, safest) is green. */
function hfColorFor(pct) {
  // Hue: 0 (red) → 60 (yellow) → 120 (green)
  const hue = Math.max(0, Math.min(120, pct * 120));
  return `hsl(${hue}, 70%, 65%)`;
}

/* Convert HF (0..HF_SCALE_MAX) into a px offset along the bar's width. */
function hfPositionPx(hf) {
  const barWidth = hfIndicatorEl.parentElement?.clientWidth || 0;
  const clamped = Math.min(HF_SCALE_MAX, Math.max(0, hf));
  return (clamped / HF_SCALE_MAX) * barWidth;
}

/* Track the last applied indicator offset (px) so we can detect large jumps
   for the trail effect. Initialized lazily to current center on first read. */
let _hfLastPx = null;

function applyHfPosition(hf, { animateGhost = true } = {}) {
  const targetPx = hfPositionPx(hf);
  const pct = Math.min(1, Math.max(0, hf / HF_SCALE_MAX));
  const color = hfColorFor(pct);

  // Trail: if moving more than 15% of bar in one update, drop 2 ghosts
  if (
    animateGhost &&
    _hfLastPx !== null &&
    hfIndicatorEl.parentElement
  ) {
    const barWidth = hfIndicatorEl.parentElement.clientWidth || 1;
    const delta = Math.abs(targetPx - _hfLastPx);
    if (delta / barWidth > 0.15) {
      spawnHfGhosts(_hfLastPx, targetPx, color);
    }
  }

  hfIndicatorEl.style.setProperty("--hf-x", targetPx + "px");
  hfIndicatorEl.style.setProperty("--hf-color", color);
  _hfLastPx = targetPx;
}

function spawnHfGhosts(fromPx, toPx, color) {
  const parent = hfIndicatorEl.parentElement;
  if (!parent) return;
  // Two intermediate ghosts at 33% and 66% of the journey
  [0.33, 0.66].forEach((t) => {
    const ghost = document.createElement("div");
    ghost.className = "hf-ghost";
    const pos = fromPx + (toPx - fromPx) * t;
    ghost.style.setProperty("--hf-x", pos + "px");
    ghost.style.setProperty("--hf-color", color);
    parent.appendChild(ghost);
    ghost.addEventListener("animationend", () => ghost.remove(), { once: true });
  });
}

function refreshHealthFactor(activeCount, weightedLiq) {
  if (activeCount === 0) {
    // No positions selected → reset to default placeholder
    animateNumber(hfValueEl, HF_DEFAULT_VALUE, fmtDecimal2, 350);
    hfValueEl.classList.remove("is-danger");
    hfIndicatorEl.classList.remove("is-risky");
    applyHfPosition(HF_DEFAULT_VALUE);
    hfBarRedEl.style.opacity = "0.5";
    hfBarGreenEl.style.opacity = "0.5";
    return;
  }

  const hf = weightedLiq / EXISTING_DEBT;
  animateNumber(hfValueEl, hf, fmtDecimal2, 350);
  applyHfPosition(hf);

  // Light the half the indicator is sitting on, and color the number to match:
  //   HF < 1.0  → danger zone (left/red half)  → red highlights, value goes red
  //   HF ≥ 1.0  → safe zone   (right/green half) → green highlights, value stays green
  const inDanger = hf < 1.0;
  hfBarRedEl.style.opacity = inDanger ? "1" : "0.5";
  hfBarGreenEl.style.opacity = inDanger ? "0.5" : "1";
  hfValueEl.classList.toggle("is-danger", inDanger);
  // Risky pulse fires when value is in the danger zone
  hfIndicatorEl.classList.toggle("is-risky", inDanger);
}

positions.forEach((position) => {
  const toggle = position.querySelector("[data-toggle]");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    const isActive = position.dataset.active === "true";
    const next = !isActive;
    position.dataset.active = String(next);
    position.classList.toggle("is-active", next);
    toggle.setAttribute("aria-pressed", String(next));
    refreshSummary();
  });
});

// Initialize on first paint so the summary reflects the markup state.
refreshSummary();

// HF indicator depends on bar pixel width — recompute on resize so the dot
// stays aligned. Skip ghost trails for resize updates.
window.addEventListener("resize", () => {
  const hfText = hfValueEl._numCurrent ?? HF_DEFAULT_VALUE;
  applyHfPosition(hfText, { animateGhost: false });
});

/* ---------------------------------------------------------------------------
   Modal entrance cascade — children "wake up" in sequence on first paint.
   --------------------------------------------------------------------------- */
(function playEntranceCascade() {
  const modalEl = document.querySelector(".modal");
  if (!modalEl) return;

  // Tag each row with its index so CSS can stagger animation-delay
  positions.forEach((p, i) => p.style.setProperty("--row-i", i));

  const rowCount = positions.length;
  const rowDelay = 30; // ms
  modalEl.style.setProperty(
    "--summary-delay",
    rowCount * rowDelay + 80 + "ms",
  );
  modalEl.style.setProperty(
    "--footer-delay",
    rowCount * rowDelay + 200 + "ms",
  );

  modalEl.classList.add("is-entering");

  // Remove the entering class after the cascade finishes so it doesn't
  // re-trigger on subsequent state changes (e.g. toggle clicks).
  const totalMs = rowCount * rowDelay + 200 + 220 + 50;
  setTimeout(() => modalEl.classList.remove("is-entering"), totalMs);
})();

/* ---------------------------------------------------------------------------
   Custom overlay scrollbar
   - Sits on top of .positions-list (absolute) instead of taking layout width
   - Thumb size + position recomputed on every scroll
   - Fades to opacity 0 when scrolling stops (after a short delay)
   --------------------------------------------------------------------------- */

const list = document.getElementById("positions-list");
const scrollbar = document.getElementById("scrollbar");
const thumb = document.getElementById("scrollbar-thumb");

const HIDE_DELAY_MS = 800; // how long the scrollbar lingers after the last scroll
let hideTimer = null;

function updateThumb() {
  const { scrollTop, scrollHeight, clientHeight } = list;

  // No overflow → nothing to scroll, keep the bar invisible
  if (scrollHeight <= clientHeight) {
    thumb.style.height = "0";
    scrollbar.classList.remove("is-active");
    return;
  }

  const trackHeight = scrollbar.clientHeight;
  // Thumb height proportional to viewport-vs-content ratio (with a minimum)
  const thumbHeight = Math.max(20, (clientHeight / scrollHeight) * trackHeight);
  // Thumb top proportional to scroll progress
  const maxScroll = scrollHeight - clientHeight;
  const maxThumbY = trackHeight - thumbHeight;
  const thumbY = (scrollTop / maxScroll) * maxThumbY;

  thumb.style.height = thumbHeight + "px";
  thumb.style.top = thumbY + "px";
}

function showScrollbar() {
  // Don't show if there's nothing to scroll
  if (list.scrollHeight <= list.clientHeight) return;
  scrollbar.classList.add("is-active");
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    scrollbar.classList.remove("is-active");
  }, HIDE_DELAY_MS);
}

list.addEventListener("scroll", () => {
  updateThumb();
  showScrollbar();
});

// Recalculate when the layout changes (e.g. window resize)
window.addEventListener("resize", updateThumb);

// Initial measurement so the thumb is correctly sized the first time it shows
updateThumb();

/* ---------------------------------------------------------------------------
   Success modal
   - Opens when the user clicks "Deposit selected" with ≥1 position active
   - Snapshots the live summary state into the success modal at click time
   - Closes via the X button, the Done button, or the backdrop
   --------------------------------------------------------------------------- */

const successOverlay = document.getElementById("success-overlay");
const successCloseBtn = document.getElementById("success-close");
const successDoneBtn = document.getElementById("success-done");

const successSelectedEl = document.getElementById("success-selected");
const successCollateralEl = document.getElementById("success-collateral");
const successLoanEl = document.getElementById("success-loan");
const successHfValueEl = document.getElementById("success-hf-value");
const successHfRedEl = document.getElementById("success-hf-red");
const successHfGreenEl = document.getElementById("success-hf-green");
const successHfIndicatorEl = document.getElementById("success-hf-indicator");

// View-state references for the deposit → loading → success flow
const mainModalEl = document.querySelector(".modal");
const modalLoadingEl = document.getElementById("modal-loading");
const depositLabelEl = depositButton.querySelector(".deposit-button__label");
const ORIGINAL_DEPOSIT_LABEL = depositLabelEl.textContent;
const LOADING_DURATION_MS = 1500; // simulated processing time

function openSuccess() {
  // Read the latest animated values from the live deposit summary. These are
  // stashed on each element by animateNumber, so they reflect the truth even
  // mid-flight.
  const selected = selectedCountEl._numCurrent ?? 0;
  const collateral = totalCollateralEl._numCurrent ?? 0;
  const loan = estimatedMaxLoanEl._numCurrent ?? 0;
  const hf = hfValueEl._numCurrent ?? HF_DEFAULT_VALUE;

  // Reset success-modal counters to 0 so each open plays a fresh count-up
  // animation (otherwise the previous final values stick and there's nothing
  // to tween).
  successSelectedEl._numCurrent = 0;
  successCollateralEl._numCurrent = 0;
  successLoanEl._numCurrent = 0;
  successHfValueEl._numCurrent = 0;
  successSelectedEl.textContent = "0";
  successCollateralEl.textContent = fmtCurrency(0);
  successLoanEl.textContent = fmtCurrency(0);
  successHfValueEl.textContent = fmtDecimal2(0);

  // Visual states copied directly — match the deposit modal's final state.
  successHfValueEl.classList.toggle(
    "is-danger",
    hfValueEl.classList.contains("is-danger"),
  );
  successHfRedEl.style.opacity = hfBarRedEl.style.opacity || "0.5";
  successHfGreenEl.style.opacity = hfBarGreenEl.style.opacity || "0.5";

  // Hide the deposit modal; show success
  mainModalEl.classList.add("is-hidden");
  mainModalEl.setAttribute("aria-hidden", "true");
  successOverlay.classList.add("is-open");

  // Place the success indicator immediately at the matching position. We do
  // this in a rAF so the overlay's layout is settled and we get a real width.
  requestAnimationFrame(() => {
    const barWidth =
      successHfIndicatorEl.parentElement?.clientWidth || 0;
    const clamped = Math.min(HF_SCALE_MAX, Math.max(0, hf));
    const px = (clamped / HF_SCALE_MAX) * barWidth;
    const pct = clamped / HF_SCALE_MAX;
    successHfIndicatorEl.style.setProperty("--hf-x", px + "px");
    successHfIndicatorEl.style.setProperty("--hf-color", hfColorFor(pct));
    successHfIndicatorEl.classList.toggle("is-risky", hf < 1.0);
  });

  // Count up from 0 to final values — kicks in after the halo starts (700ms)
  // and lasts 500ms. (Package C item 4.)
  setTimeout(() => {
    if (!successOverlay.classList.contains("is-open")) return;
    animateNumber(successSelectedEl, selected, fmtInt, 500);
    animateNumber(successCollateralEl, collateral, fmtCurrency, 500);
    animateNumber(successLoanEl, loan, fmtCurrency, 500);
    animateNumber(successHfValueEl, hf, fmtDecimal2, 500);
  }, 700);

  // Confetti burst — fires shortly after the icon bounce settles
  setTimeout(() => {
    if (!successOverlay.classList.contains("is-open")) return;
    spawnConfetti();
  }, 750);
}

/* Inject 10 confetti dots that fan out from the success icon center.
   Each dot is removed on animationend. */
function spawnConfetti() {
  const ring = successOverlay.querySelector(".success-modal__icon-ring");
  if (!ring) return;
  const count = 10;
  for (let i = 0; i < count; i++) {
    const dot = document.createElement("span");
    dot.className = "confetti";
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const distance = 40 + Math.random() * 30;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    dot.style.setProperty("--confetti-x", x + "px");
    dot.style.setProperty("--confetti-y", y + "px");
    dot.style.setProperty(
      "--confetti-start-scale",
      (0.5 + Math.random() * 0.3).toFixed(2),
    );
    dot.style.setProperty(
      "--confetti-end-scale",
      (0.2 + Math.random() * 0.2).toFixed(2),
    );
    ring.appendChild(dot);
    dot.addEventListener("animationend", () => dot.remove(), { once: true });
  }
}

function closeSuccess() {
  successOverlay.classList.remove("is-open");
  mainModalEl.classList.remove("is-hidden");
  mainModalEl.removeAttribute("aria-hidden");
}

function setDepositLoading(loading) {
  depositButton.classList.toggle("is-loading", loading);
  depositLabelEl.textContent = loading ? "Processing..." : ORIGINAL_DEPOSIT_LABEL;
  modalLoadingEl.classList.toggle("is-active", loading);
  modalLoadingEl.setAttribute("aria-hidden", loading ? "false" : "true");
}

depositButton.addEventListener("click", () => {
  if (depositButton.disabled) return;
  if (depositButton.classList.contains("is-loading")) return; // ignore double-click

  // Step 1: enter loading state — button "Processing..." spinner +
  // semi-transparent overlay with the spoke-star icon over the modal body
  setDepositLoading(true);

  // Step 2: after the simulated processing time, swap to the success modal
  setTimeout(() => {
    setDepositLoading(false);
    openSuccess();
  }, LOADING_DURATION_MS);
});

successCloseBtn.addEventListener("click", closeSuccess);
successDoneBtn.addEventListener("click", closeSuccess);

// Close when clicking the backdrop (but not when clicking inside the modal)
successOverlay.addEventListener("click", (e) => {
  if (e.target === successOverlay) closeSuccess();
});

// Esc key closes too
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && successOverlay.classList.contains("is-open")) {
    closeSuccess();
  }
});
