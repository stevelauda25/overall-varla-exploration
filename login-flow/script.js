// Login flow — view switching + email field + OTP entry.
//
// Welcome → Email → Confirm
// Each view's back button declares its target via data-target.

(function () {
  const views = {
    welcome: document.querySelector('[data-view="welcome"]'),
    email: document.querySelector('[data-view="email"]'),
    confirm: document.querySelector('[data-view="confirm"]'),
    wallet: document.querySelector('[data-view="wallet"]'),
    "wallet-connect": document.querySelector('[data-view="wallet-connect"]'),
  };

  const WALLET_DISPLAY_NAMES = {
    phantom: "Phantom",
    family: "Family",
    "1inch": "1inch",
    other: "Other",
  };

  // ------------------------------------------------------------------
  // Element refs
  // ------------------------------------------------------------------
  const emailField = document.querySelector(".email-field");
  const emailInput = document.getElementById("email-input");
  const emailError = document.getElementById("email-error");
  const continueBtn = document.querySelector(".continue-button");
  const emailForm = document.querySelector(".login-modal__form");
  const otpBoxes = Array.from(document.querySelectorAll(".otp-box"));
  const otpWrapper = document.querySelector(".confirm-otp");
  const otpError = document.getElementById("otp-error");
  const confirmBody = document.querySelector(".confirm-body");
  const confirmEmailDisplays = document.querySelectorAll("[data-confirm-email]");
  const successOverlay = document.getElementById("login-success");

  let successTimer = null;
  // Pick a value in the 1.5–2.5s window that the user specified
  const SUCCESS_DELAY_MS = 2000;

  // Wallet-connect auto-flow: 3s after the QR renders, show a 2s loading
  // spinner, then the success modal takes over.
  const walletConnectBody = document.querySelector(".wallet-connect-body");
  let walletConnectTimer = null;
  const WALLET_CONNECT_DELAY_MS = 3000;
  const WALLET_CONNECT_LOADING_MS = 2000;

  // ------------------------------------------------------------------
  // View switching
  // ------------------------------------------------------------------
  function showView(name) {
    Object.entries(views).forEach(([key, el]) => {
      if (!el) return;
      el.classList.toggle("is-hidden", key !== name);
    });

    if (name === "email") {
      requestAnimationFrame(() => emailInput?.focus());
    }
    if (name === "confirm") {
      requestAnimationFrame(() => otpBoxes[0]?.focus());
    }
    if (name === "wallet") {
      // Re-entering the picker should always start collapsed (no search, 4 tiles)
      resetWalletPicker();
    }

    if (name === "wallet-connect") {
      startWalletConnectFlow();
    } else {
      cancelWalletConnectFlow();
    }
  }

  function startWalletConnectFlow() {
    cancelWalletConnectFlow();
    walletConnectTimer = setTimeout(() => {
      walletConnectBody?.classList.add("is-loading");
      walletConnectTimer = setTimeout(() => {
        walletConnectBody?.classList.remove("is-loading");
        showSuccess();
        walletConnectTimer = null;
      }, WALLET_CONNECT_LOADING_MS);
    }, WALLET_CONNECT_DELAY_MS);
  }

  function cancelWalletConnectFlow() {
    if (walletConnectTimer) {
      clearTimeout(walletConnectTimer);
      walletConnectTimer = null;
    }
    walletConnectBody?.classList.remove("is-loading");
  }

  // Welcome → Email
  document.querySelectorAll('[data-action="goto-email"]').forEach((btn) => {
    btn.addEventListener("click", () => showView("email"));
  });

  // Generic back — target view declared on the button
  document.querySelectorAll('[data-action="back"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      clearError();
      hideLoading();
      cancelSuccessTimer();
      const target = btn.dataset.target || "welcome";
      showView(target);
    });
  });

  // Close — placeholder until the modal has an actual host page to dismiss to
  document.querySelectorAll('[data-action="close"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      console.log("[login] close");
    });
  });

  // Welcome → Wallet picker
  document.querySelectorAll('[data-action="goto-wallet"]').forEach((btn) => {
    btn.addEventListener("click", () => showView("wallet"));
  });

  // Wallet picker — two paths:
  //   1. "Other wallet" expands the picker (search bar + 10 more wallets)
  //   2. any other wallet navigates to the QR connect view
  const walletBody = document.querySelector(".login-modal--wallet .wallet-body");
  const walletGrid = document.querySelector(".login-modal--wallet .wallet-grid");
  const walletSearch = document.querySelector(".wallet-search");
  const walletSearchInput = document.getElementById("wallet-search-input");
  const walletEmpty = document.getElementById("wallet-empty");
  const otherToggleBtns = document.querySelectorAll(".wallet-option--other-toggle");
  const additionalBtns = document.querySelectorAll(".wallet-option--additional");

  // Scrollbar fade — only visible while the user is actively scrolling.
  // 600ms idle window after the last scroll event before the thumb fades out.
  let walletScrollTimer = null;
  walletGrid?.addEventListener("scroll", () => {
    walletGrid.classList.add("is-scrolling");
    if (walletScrollTimer) clearTimeout(walletScrollTimer);
    walletScrollTimer = setTimeout(() => {
      walletGrid.classList.remove("is-scrolling");
      walletScrollTimer = null;
    }, 600);
  });

  // When a brand PNG 404s, drop the <img> so the monogram fallback underneath shows
  document.querySelectorAll(".wallet-option__image").forEach((img) => {
    img.addEventListener("error", () => img.remove(), { once: true });
  });

  document.querySelectorAll(".wallet-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.action === "expand-wallets") {
        expandWalletPicker();
        return;
      }

      const slug = btn.dataset.wallet;
      const labelEl = btn.querySelector(".wallet-option__label");
      // Prefer the visible label (e.g. "MetaMask") over the slug ("metamask")
      const displayName = labelEl?.textContent?.trim() || WALLET_DISPLAY_NAMES[slug] || slug;
      // Strip a trailing "Wallet" so the title doesn't read "...with X Wallet wallet"
      const titleName = displayName.replace(/\s+wallet$/i, "");
      document.querySelectorAll("[data-wallet-name]").forEach((el) => {
        el.textContent = titleName;
      });
      console.log("[login] continue with wallet:", slug);
      showView("wallet-connect");
    });
  });

  // Search filter — match by label substring; show empty state when none match.
  // Only runs in expanded mode (the input is unreachable otherwise).
  walletSearchInput?.addEventListener("input", () => {
    const query = walletSearchInput.value.trim().toLowerCase();
    let visibleCount = 0;
    document.querySelectorAll(".wallet-option").forEach((btn) => {
      if (btn.classList.contains("wallet-option--other-toggle")) return;
      const label = btn.querySelector(".wallet-option__label")?.textContent.toLowerCase() || "";
      const matches = !query || label.includes(query);
      btn.hidden = !matches;
      if (matches) visibleCount++;
    });
    if (walletEmpty) walletEmpty.hidden = visibleCount > 0;
  });

  function expandWalletPicker() {
    walletBody?.classList.add("is-expanded");
    // Reveal search bar + additional tiles, hide the Other-wallet trigger
    if (walletSearch) walletSearch.hidden = false;
    additionalBtns.forEach((b) => (b.hidden = false));
    otherToggleBtns.forEach((b) => (b.hidden = true));
    requestAnimationFrame(() => walletSearchInput?.focus());
  }

  function resetWalletPicker() {
    walletBody?.classList.remove("is-expanded");
    if (walletSearchInput) walletSearchInput.value = "";
    if (walletEmpty) walletEmpty.hidden = true;
    if (walletSearch) walletSearch.hidden = true;
    additionalBtns.forEach((b) => (b.hidden = true));
    otherToggleBtns.forEach((b) => (b.hidden = false));
  }

  // QR pattern — generated once on load, deterministic so it always renders the
  // same. Three corner finder patterns plus a seeded-random middle, no asset.
  (function paintQrPattern() {
    const target = document.getElementById("qr-pattern");
    if (!target) return;

    const N = 23;
    const parts = [];
    const dot = (x, y) =>
      parts.push(
        `<rect x="${x + 0.05}" y="${y + 0.05}" width="0.9" height="0.9" rx="0.4" fill="white"/>`
      );

    function finder(ox, oy) {
      for (let dy = 0; dy < 7; dy++) {
        for (let dx = 0; dx < 7; dx++) {
          const onEdge = dx === 0 || dx === 6 || dy === 0 || dy === 6;
          const inCenter = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
          if (onEdge || inCenter) dot(ox + dx, oy + dy);
        }
      }
    }
    finder(0, 0);
    finder(N - 7, 0);
    finder(0, N - 7);

    let seed = 7919;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const inFinder =
          (x < 8 && y < 8) ||
          (x >= N - 8 && y < 8) ||
          (x < 8 && y >= N - 8);
        if (inFinder) continue;
        if (rand() > 0.5) dot(x, y);
      }
    }

    target.innerHTML = `<svg viewBox="0 0 ${N} ${N}" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`;
  })();

  // ------------------------------------------------------------------
  // Email field
  // ------------------------------------------------------------------
  emailInput?.addEventListener("input", () => {
    continueBtn.disabled = emailInput.value.trim().length === 0;
    if (emailField?.classList.contains("has-error")) clearError();
  });

  emailForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const value = emailInput.value.trim();
    if (!isValidEmail(value)) {
      showError();
      return;
    }
    // Inject the entered email into the confirm view's description
    confirmEmailDisplays.forEach((el) => {
      el.textContent = value;
    });
    showView("confirm");
  });

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function showError() {
    emailField?.classList.add("has-error");
    if (emailError) emailError.hidden = false;
  }

  function clearError() {
    emailField?.classList.remove("has-error");
    if (emailError) emailError.hidden = true;
  }

  // ------------------------------------------------------------------
  // OTP boxes — auto-advance on type, backspace navigates back, paste fills
  // ------------------------------------------------------------------
  otpBoxes.forEach((box, i) => {
    box.addEventListener("input", () => {
      const digit = box.value.replace(/\D/g, "").slice(-1);
      box.value = digit;
      // Editing while an error is shown clears it — fresh attempt
      if (otpWrapper?.classList.contains("has-error")) clearOtpError();
      if (digit && i < otpBoxes.length - 1) {
        otpBoxes[i + 1].focus();
      }
      checkOtpComplete();
    });

    box.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !box.value && i > 0) {
        otpBoxes[i - 1].focus();
        return;
      }
      if (e.key === "ArrowLeft" && i > 0) {
        e.preventDefault();
        otpBoxes[i - 1].focus();
      }
      if (e.key === "ArrowRight" && i < otpBoxes.length - 1) {
        e.preventDefault();
        otpBoxes[i + 1].focus();
      }
    });

    box.addEventListener("paste", (e) => {
      const text = (e.clipboardData || window.clipboardData).getData("text") || "";
      const digits = text.replace(/\D/g, "").slice(0, otpBoxes.length);
      if (!digits) return;
      e.preventDefault();
      digits.split("").forEach((char, idx) => {
        if (otpBoxes[idx]) otpBoxes[idx].value = char;
      });
      const lastIdx = Math.min(digits.length, otpBoxes.length) - 1;
      otpBoxes[lastIdx]?.focus();
      checkOtpComplete();
    });
  });

  const CORRECT_CODE = "281201";

  function checkOtpComplete() {
    const code = otpBoxes.map((b) => b.value).join("");
    if (code.length !== otpBoxes.length) return;

    if (code === CORRECT_CODE) {
      clearOtpError();
      showLoading();
      // Drop focus so the cursor in the last box doesn't sit on top of the spinner
      document.activeElement?.blur();
      console.log("[login] confirmation code accepted");
      successTimer = setTimeout(() => {
        hideLoading();
        showSuccess();
        successTimer = null;
      }, SUCCESS_DELAY_MS);
    } else {
      showOtpError();
      console.log("[login] confirmation code rejected:", code);
    }
  }

  function cancelSuccessTimer() {
    if (successTimer) {
      clearTimeout(successTimer);
      successTimer = null;
    }
  }

  function showSuccess() {
    successOverlay?.classList.add("is-open");
  }

  function hideSuccess() {
    successOverlay?.classList.remove("is-open");
  }

  function resetFlow() {
    otpBoxes.forEach((b) => (b.value = ""));
    if (emailInput) emailInput.value = "";
    if (continueBtn) continueBtn.disabled = true;
    clearError();
    clearOtpError();
    hideLoading();
    cancelSuccessTimer();
  }

  // Success modal dismiss — close, reset, return to welcome
  document.querySelectorAll('[data-action="dismiss-success"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      hideSuccess();
      // Wait for the overlay fade-out before swapping the underlying view
      setTimeout(() => {
        resetFlow();
        showView("welcome");
      }, 220);
    });
  });

  function showOtpError() {
    otpWrapper?.classList.add("has-error");
    if (otpError) otpError.hidden = false;
  }

  function clearOtpError() {
    otpWrapper?.classList.remove("has-error");
    if (otpError) otpError.hidden = true;
  }

  function showLoading() {
    confirmBody?.classList.add("is-loading");
  }

  function hideLoading() {
    confirmBody?.classList.remove("is-loading");
  }

  // Resend — clear boxes, drop any error/loading, cancel pending success, refocus
  document.querySelectorAll('[data-action="resend"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      console.log("[login] resend code");
      otpBoxes.forEach((b) => (b.value = ""));
      clearOtpError();
      hideLoading();
      cancelSuccessTimer();
      otpBoxes[0]?.focus();
    });
  });
})();
