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

  animateNumber(selectedCountEl, active.length, fmtInt);
  totalCountEl.textContent = positions.length; // never changes, no anim
  animateNumber(totalCollateralEl, totalCollateral, fmtCurrency);
  animateNumber(estimatedMaxLoanEl, maxLoan, fmtCurrency);

  // Disable the deposit button when nothing is selected
  depositButton.disabled = active.length === 0;

  refreshHealthFactor(active.length, weightedLiq);
}

function refreshHealthFactor(activeCount, weightedLiq) {
  if (activeCount === 0) {
    // No positions selected → reset to default placeholder
    animateNumber(hfValueEl, HF_DEFAULT_VALUE, fmtDecimal2);
    hfValueEl.classList.remove("is-danger");
    hfIndicatorEl.style.left = "50%";
    hfBarRedEl.style.opacity = "0.5";
    hfBarGreenEl.style.opacity = "0.5";
    return;
  }

  const hf = weightedLiq / EXISTING_DEBT;
  animateNumber(hfValueEl, hf, fmtDecimal2);

  // Position the indicator on the 0–2 scale
  const clamped = Math.min(HF_SCALE_MAX, Math.max(0, hf));
  hfIndicatorEl.style.left = (clamped / HF_SCALE_MAX) * 100 + "%";

  // Light the half the indicator is sitting on, and color the number to match:
  //   HF < 1.0  → danger zone (left/red half)  → red highlights, value goes red
  //   HF ≥ 1.0  → safe zone   (right/green half) → green highlights, value stays green
  const inDanger = hf < 1.0;
  hfBarRedEl.style.opacity = inDanger ? "1" : "0.5";
  hfBarGreenEl.style.opacity = inDanger ? "0.5" : "1";
  hfValueEl.classList.toggle("is-danger", inDanger);
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

  animateNumber(successSelectedEl, selected, fmtInt);
  animateNumber(successCollateralEl, collateral, fmtCurrency);
  animateNumber(successLoanEl, loan, fmtCurrency);
  animateNumber(successHfValueEl, hf, fmtDecimal2);

  // Visual states (color, indicator position, bar opacities) are copied
  // directly — no tween, they should match the deposit modal's final state.
  successHfValueEl.classList.toggle(
    "is-danger",
    hfValueEl.classList.contains("is-danger"),
  );
  successHfIndicatorEl.style.left = hfIndicatorEl.style.left || "50%";
  successHfRedEl.style.opacity = hfBarRedEl.style.opacity || "0.5";
  successHfGreenEl.style.opacity = hfBarGreenEl.style.opacity || "0.5";

  // Hide the deposit modal; show success
  mainModalEl.classList.add("is-hidden");
  mainModalEl.setAttribute("aria-hidden", "true");
  successOverlay.classList.add("is-open");
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
