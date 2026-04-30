/* ---------------------------------------------------------------------------
   Settings modal — interactivity:
   · tab switching shows/hides the matching [data-panel] container
   · wallet-pill copy-to-clipboard with a transient "COPIED!" feedback
   · notification toggles flip aria-pressed (CSS handles the visual swap)
   --------------------------------------------------------------------------- */

/* ---------- Tabs ---------- */
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

function activateTab(target) {
  tabs.forEach((t) => {
    const active = t === target;
    t.classList.toggle("is-active", active);
    t.setAttribute("aria-selected", active ? "true" : "false");
  });

  const targetPanel = target.dataset.tab;
  panels.forEach((p) => {
    p.hidden = p.dataset.panel !== targetPanel;
  });
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab));
});

/* ---------- Avatar upload ----------
   Click the avatar tile → open file picker → preview the image.
   We read the file as a data URL (rather than an object URL) so the same
   string can be persisted to localStorage without lifetime issues.
   The 1:1 aspect comes from the 92×92 box + `object-fit: cover`. */
const avatarBtn = document.querySelector(".avatar-upload");
const avatarInput = document.getElementById("avatar-file");
const avatarImg = document.querySelector(".profile__avatar");

if (avatarBtn && avatarInput && avatarImg) {
  avatarBtn.addEventListener("click", () => avatarInput.click());

  avatarInput.addEventListener("change", () => {
    const file = avatarInput.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      avatarImg.src = e.target.result;
      avatarImg.alt = "Profile picture";
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- Profile persistence ----------
   Hydrate name / email / description / avatar from localStorage on load,
   and snapshot them back when the user confirms Save Changes. The
   displayed name in the profile header (`Radiant Lyra`) is treated as a
   read-only mirror of the saved Name field — it only updates on save,
   not while typing, so an unsaved edit can't leak into the header. */
const PROFILE_KEY = "varla:settings:profile";
const profileNameDisplay = document.querySelector(".profile__name");
const nameInput = document.querySelector('.field input[type="text"]');
const emailInput = document.querySelector('.field input[type="email"]');
const descInput = document.querySelector(".field textarea");

function loadProfile() {
  let data;
  try {
    data = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
  } catch {
    data = null;
  }
  if (!data) return;

  if (typeof data.name === "string") {
    if (nameInput) nameInput.value = data.name;
    if (profileNameDisplay && data.name) profileNameDisplay.textContent = data.name;
  }
  if (typeof data.email === "string" && emailInput) emailInput.value = data.email;
  if (typeof data.description === "string" && descInput) descInput.value = data.description;
  if (typeof data.avatar === "string" && data.avatar && avatarImg) {
    avatarImg.src = data.avatar;
  }
}

function saveProfile() {
  const data = {
    name: nameInput?.value.trim() ?? "",
    email: emailInput?.value.trim() ?? "",
    description: descInput?.value.trim() ?? "",
    // Only persist the avatar src if it's a data URL (i.e. user-uploaded).
    // The default `assets/avatar.png` doesn't need to be stored — if no
    // saved value exists, the HTML default loads naturally.
    avatar: avatarImg?.src.startsWith("data:") ? avatarImg.src : null,
  };

  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(data));
  } catch (err) {
    // localStorage quota exceeded — most likely a very large avatar image.
    console.warn("Could not save profile:", err);
    return false;
  }

  // Mirror the saved name into the profile header.
  if (profileNameDisplay && data.name) {
    profileNameDisplay.textContent = data.name;
  }
  return true;
}

loadProfile();

/* ---------- Wallet pill — copy to clipboard ---------- */
const walletPill = document.querySelector(".wallet-pill");
const walletAddr = document.querySelector(".wallet-pill__addr");

if (walletPill && walletAddr) {
  // Full address shown truncated in the UI; replace with real address when wired up.
  const FULL_ADDRESS = "0x71C87y4n87499545n27bfe8F2A";
  const originalLabel = walletAddr.textContent;

  walletPill.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(FULL_ADDRESS);
      walletAddr.textContent = "COPIED!";
      setTimeout(() => {
        walletAddr.textContent = originalLabel;
      }, 1200);
    } catch {
      /* clipboard unavailable (e.g. insecure context) — silently no-op */
    }
  });
}

/* ---------- Generic toggle (notifications + Expert Mode) ---------- */
document.querySelectorAll(".toggle").forEach((toggle) => {
  toggle.addEventListener("click", () => {
    const pressed = toggle.getAttribute("aria-pressed") === "true";
    toggle.setAttribute("aria-pressed", pressed ? "false" : "true");
  });
});

/* ---------- Expert Mode → reset slippage view ----------
   Whenever Expert Mode flips (in either direction), the previously-
   selected preset (e.g. 0.1% or 10%) might no longer make sense in the
   new mode. Reset slippage back to AUTO and re-cap the custom input. */
const expertToggle = document.getElementById("expert-toggle");
const slippage = document.querySelector(".slippage");

if (expertToggle && slippage) {
  const slipInput = slippage.querySelector(".slip-input__field input");
  const slipMaxLabel = slippage.querySelector(".slip-input__max");

  function applyExpertMode(isExpert) {
    slippage.dataset.expert = isExpert ? "true" : "false";

    // Update the custom input cap + MAX label to match.
    const cap = isExpert ? 15 : 5;
    if (slipInput) {
      slipInput.max = cap;
      // If the user had typed a value above the new cap, clamp it.
      const v = parseFloat(slipInput.value);
      if (!Number.isNaN(v) && v > cap) slipInput.value = cap;
    }
    if (slipMaxLabel) slipMaxLabel.textContent = `MAX: ${cap}%`;

    // Reset to AUTO mode + sync the AUTO/MANUAL button state.
    slippage.dataset.mode = "auto";
    slippage.querySelectorAll('[data-seg-group="mode"] .seg-btn').forEach((b) => {
      const active = b.dataset.value === "auto";
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });

    // Also reset the visible preset-set's active button to its default
    // (0.5% for normal, 5% for expert) so re-entering MANUAL is predictable.
    const defaultPreset = isExpert ? "5" : "0.5";
    slippage.dataset.preset = defaultPreset;
    const visibleSet = slippage.querySelector(
      `[data-seg-group="preset"][data-preset-set="${isExpert ? "expert" : "normal"}"]`
    );
    visibleSet?.querySelectorAll(".seg-btn").forEach((b) => {
      const active = b.dataset.value === defaultPreset;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });

    // Clear any leftover custom-input value so re-entering CUSTOM is clean.
    if (slipInput) slipInput.value = "";
  }

  expertToggle.addEventListener("click", () => {
    // The generic toggle handler above already flipped aria-pressed; read
    // the *new* state here.
    const isExpert = expertToggle.getAttribute("aria-pressed") === "true";
    applyExpertMode(isExpert);
  });
}

/* ---------- Save flow: confirm → success ----------
   Save Changes opens the confirmation popup. Confirming swaps to the
   success popup. Both popups close via X, backdrop, or Esc — and the
   confirmation also closes via Cancel. */
function openPopup(overlay) {
  if (!overlay) return;
  overlay.hidden = false;
  // Force a reflow so the transition runs from the hidden state.
  void overlay.offsetWidth;
  overlay.classList.add("is-open");
}

function closePopup(overlay) {
  if (!overlay) return;
  overlay.classList.remove("is-open");
  setTimeout(() => {
    overlay.hidden = true;
  }, 200);
}

const confirmOverlay = document.getElementById("confirm-overlay");
const successOverlay = document.getElementById("success-overlay");

// Copy variants per save source. Saving from the Profile tab talks about
// profile info; saving from Trading Preferences talks about trade settings.
const SAVE_COPY = {
  profile: {
    confirm: "Are you sure you want to update your profile information? These changes will be reflected immediately.",
    successTitle: "Profile Updated",
    successDesc: "Your changes have been saved<br>and reflected across Varla.",
  },
  trading: {
    confirm: "Are you sure you want to update your trading preferences? The new settings will apply to your next trade.",
    successTitle: "Preferences Updated",
    successDesc: "Your trading preferences have been saved<br>and will apply to your next trade.",
  },
};

let saveSource = "profile";
const confirmMsg = confirmOverlay?.querySelector(".popup__message");
const successTitleEl = successOverlay?.querySelector(".success-hero__title");
const successDescEl = successOverlay?.querySelector(".success-hero__desc");

function applyCopy(source) {
  const copy = SAVE_COPY[source] || SAVE_COPY.profile;
  if (confirmMsg) confirmMsg.textContent = copy.confirm;
  if (successTitleEl) successTitleEl.textContent = copy.successTitle;
  if (successDescEl) successDescEl.innerHTML = copy.successDesc;
}

/* Inline validation — block Save Changes if the user picked CUSTOM for
   slippage and the value is missing, invalid, or above the active cap
   (5% in normal mode, 15% in expert mode). Returns true if save can
   proceed. The message is rewritten per failure reason. */
function validateBeforeSave(source) {
  if (source !== "trading") return true;
  if (!slippage) return true;
  if (slippage.dataset.mode !== "manual") return true;
  if (slippage.dataset.preset !== "custom") return true;

  const input = slippage.querySelector(".slip-input__field input");
  const wrap = slippage.querySelector(".slip-input");
  const errorEl = slippage.querySelector(".slip-input__error");
  if (!input || !wrap) return true;

  const raw = input.value.trim();
  const cap = parseFloat(input.max) || 5;

  function fail(message) {
    if (errorEl) errorEl.textContent = message;
    wrap.classList.add("has-error");
    input.focus();
    return false;
  }

  if (raw === "") {
    return fail("Please enter a custom slippage value before saving");
  }

  const num = parseFloat(raw);
  if (Number.isNaN(num) || num < 0) {
    return fail("Please enter a valid slippage value");
  }

  if (num > cap) {
    return fail(`Slippage cannot exceed ${cap}%`);
  }

  wrap.classList.remove("has-error");
  return true;
}

// Clear the error as soon as the user starts fixing it.
const slipInputEl = slippage?.querySelector(".slip-input__field input");
slipInputEl?.addEventListener("input", () => {
  slippage.querySelector(".slip-input")?.classList.remove("has-error");
});

document.querySelectorAll(".save-btn-trigger").forEach((btn) => {
  btn.addEventListener("click", () => {
    saveSource = btn.closest(".panel")?.dataset.panel || "profile";
    if (!validateBeforeSave(saveSource)) return;
    applyCopy(saveSource);
    openPopup(confirmOverlay);
  });
});

document.getElementById("confirm-cancel")?.addEventListener("click", () => closePopup(confirmOverlay));
document.getElementById("confirm-close")?.addEventListener("click", () => closePopup(confirmOverlay));
document.getElementById("confirm-save")?.addEventListener("click", () => {
  // Only the Profile panel has actual fields wired to localStorage; Trading
  // is visual-only for now (presets/toggles aren't persisted yet).
  if (saveSource === "profile") saveProfile();
  closePopup(confirmOverlay);
  // Brief pause so the swap feels intentional rather than abrupt.
  setTimeout(() => openPopup(successOverlay), 220);
});

document.getElementById("success-close")?.addEventListener("click", () => closePopup(successOverlay));
document.getElementById("success-done")?.addEventListener("click", () => closePopup(successOverlay));

// Backdrop click closes the active popup.
[confirmOverlay, successOverlay].forEach((overlay) => {
  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) closePopup(overlay);
  });
});

// Esc closes whichever popup is currently open.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (confirmOverlay?.classList.contains("is-open")) closePopup(confirmOverlay);
  else if (successOverlay?.classList.contains("is-open")) closePopup(successOverlay);
});

/* ---------- Segmented button groups ----------
   Generic AUTO/MANUAL-style switcher. When the group is part of the
   slippage section, the click also writes its value back to the parent
   .slippage element's data-* attribute so CSS can show/hide the right
   sub-views (description, preset row, custom input). */
document.querySelectorAll(".seg-group").forEach((group) => {
  const buttons = group.querySelectorAll(".seg-btn");
  const slippage = group.closest(".slippage");
  const role = group.dataset.segGroup; // "mode" | "preset" | undefined

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", active ? "true" : "false");
      });

      if (slippage && role) {
        slippage.dataset[role] = btn.dataset.value;
        // Any mode/preset change clears a stale error state.
        slippage.querySelector(".slip-input")?.classList.remove("has-error");
        // When user re-enters MANUAL via custom input, focus the field
        if (role === "preset" && btn.dataset.value === "custom") {
          const input = slippage.querySelector(".slip-input__field input");
          if (input) input.focus();
        }
      }
    });
  });
});
