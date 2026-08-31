/* Naz Ventures — discount vouchers
   Shared by cart-checkout.html (Coffee Cart) and kaizen-checkout.html (Kaizen Spaces).

   TO ADD OR CHANGE A CODE, EDIT THE LIST BELOW. Nothing else needs to change.

     code      what the customer types. Case and spaces are ignored.
     type      "amount" (a flat peso amount off) or "percent" (a % off)
     value     how much comes off. Either one number for every booking, or a
               different number per business:
                   value: { cart: 1000, kaizen: 500 }
               "cart" is the Coffee Cart, "kaizen" is Kaizen Spaces.
     maxOff    percent codes only — the most it can ever take off, in pesos.
               0 means no cap. Ignored by "amount" codes.
     minSpend  smallest booking the code works on. Can also be set per business:
                   minSpend: { cart: 9000, kaizen: 3000 }
               0 means any booking. This is what stops a flat peso discount from
               eating a small booking alive.
     scope     "cart", "kaizen", or "both"
     expires   last day it works, YYYY-MM-DD, Philippine time. "" means never.
     active    set to false to switch a code off without deleting it
     label     the line the customer sees. Can also be set per business.

   Heads up: these codes live in the page, so anyone can read them in the browser's
   source. That is fine for codes you announce publicly anyway — and every booking
   is still confirmed by hand after you check the GCash payment, so nothing is
   charged automatically. Keep only live public codes in this list.
*/
(function (global) {
  "use strict";

  var VOUCHERS = [
    /* Naz Coffee 5th Anniversary, September 2026. */
    {
      code: "NAZTURNS5",
      type: "amount",
      value:    { cart: 1000, kaizen: 500 },
      maxOff: 0,
      minSpend: { cart: 9000, kaizen: 3000 },
      scope: "both",
      expires: "2026-09-30",
      active: true,
      label: "Naz Coffee 5th Anniversary"
    },

    /* --- Templates. Switch active to true when you want to run one. --- */
    {
      code: "CARTFIRST1500",
      type: "amount",
      value: 1500,
      maxOff: 0,
      minSpend: 16000,
      scope: "cart",
      expires: "",
      active: false,
      label: "₱1,500 off your Coffee Cart event"
    },
    {
      code: "WORKSHOP15",
      type: "percent",
      value: 15,
      maxOff: 2000,
      minSpend: 3000,
      scope: "kaizen",
      expires: "",
      active: false,
      label: "15% off your Kaizen Spaces session"
    }
  ];

  var DEFAULT_RESERVATION_RATE = 0.2;

  /* Today's date in the Philippines (UTC+8), so a code does not expire early or
     late for a customer whose device clock is on another timezone. */
  function manilaToday() {
    return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  }

  function normalise(code) {
    return String(code == null ? "" : code).replace(/[\s-]+/g, "").toUpperCase();
  }

  function peso(amount) {
    return "₱" + new Intl.NumberFormat("en-PH").format(Math.round(amount));
  }

  /* A setting can be one value for every booking, or an object holding a
     different value per business. This picks the right one. */
  function forScope(setting, scope) {
    if (setting && typeof setting === "object") {
      if (setting[scope] !== undefined) return setting[scope];
      if (setting.default !== undefined) return setting.default;
      return undefined;
    }
    return setting;
  }

  function find(code) {
    var key = normalise(code);
    if (!key) return null;
    for (var i = 0; i < VOUCHERS.length; i++) {
      if (normalise(VOUCHERS[i].code) === key) return VOUCHERS[i];
    }
    return null;
  }

  /* Works out what a code is worth on this particular booking.
     Returns { ok, error } or { ok, voucher, discount, newTotal, label, quoteOnly }. */
  function evaluate(code, options) {
    options = options || {};
    var total = Number(options.total) || 0;
    var scope = options.scope || "both";

    if (!normalise(code)) return { ok: false, error: "Enter a code first." };

    var voucher = find(code);
    if (!voucher || voucher.active === false) {
      return { ok: false, error: "We don't recognise that code. Check the spelling and try again." };
    }
    if (voucher.scope !== "both" && voucher.scope !== scope) {
      return { ok: false, error: "That code doesn't apply to this kind of booking." };
    }
    if (voucher.expires && manilaToday() > voucher.expires) {
      return { ok: false, error: "That code has expired." };
    }

    var value = Number(forScope(voucher.value, scope)) || 0;
    var minSpend = Number(forScope(voucher.minSpend, scope)) || 0;
    var label = forScope(voucher.label, scope) || "";

    /* Custom quotations reach checkout without a price yet. Accept the code and
       record it so it can be honoured when the quote is prepared. */
    if (total <= 0) {
      return { ok: true, voucher: voucher, discount: 0, newTotal: 0, label: label, quoteOnly: true };
    }

    if (minSpend && total < minSpend) {
      return { ok: false, error: "That code applies to bookings from " + peso(minSpend) + " up." };
    }

    var discount = voucher.type === "percent" ? total * (value / 100) : value;
    if (voucher.type === "percent" && voucher.maxOff) discount = Math.min(discount, voucher.maxOff);
    discount = Math.min(Math.round(discount), total);

    return {
      ok: true,
      voucher: voucher,
      discount: discount,
      newTotal: total - discount,
      label: label,
      quoteOnly: false
    };
  }

  /* Wires up a voucher box already present in the page.

     config.root      element (or its id) containing the voucher markup
     config.scope     "cart" or "kaizen"
     config.total     the booking's estimated total, in pesos
     config.deposit   the reservation fee before any discount, in pesos
     config.onChange  called with the current state whenever it changes, so the
                      page can repaint its own price lines
     config.applyFromUrl  URL parameter to auto-apply from (default "code")
  */
  function mount(config) {
    config = config || {};
    var root = typeof config.root === "string" ? document.getElementById(config.root) : config.root;
    if (!root) return null;

    var input = root.querySelector("[data-voucher-input]");
    var applyBtn = root.querySelector("[data-voucher-apply]");
    var removeBtn = root.querySelector("[data-voucher-remove]");
    var message = root.querySelector("[data-voucher-message]");
    var entryBox = root.querySelector("[data-voucher-entry]");
    var appliedBox = root.querySelector("[data-voucher-applied]");
    var appliedCode = root.querySelector("[data-voucher-applied-code]");
    var appliedNote = root.querySelector("[data-voucher-applied-note]");

    var total = Number(config.total) || 0;
    var baseDeposit = Number(config.deposit) || Math.round(total * DEFAULT_RESERVATION_RATE);
    /* Keep whatever reservation percentage this booking already uses. */
    var rate = total > 0 ? baseDeposit / total : DEFAULT_RESERVATION_RATE;

    var state = {
      applied: false,
      code: "",
      label: "",
      discount: 0,
      total: total,
      newTotal: total,
      deposit: baseDeposit,
      quoteOnly: false
    };

    function setHiddenFields() {
      var fields = document.querySelectorAll("[data-voucher-field]");
      for (var i = 0; i < fields.length; i++) {
        var kind = fields[i].getAttribute("data-voucher-field");
        if (kind === "code") fields[i].value = state.code;
        else if (kind === "discount") fields[i].value = state.discount ? String(state.discount) : "";
        else if (kind === "original-total") fields[i].value = total ? String(total) : "";
        else if (kind === "final-total") fields[i].value = state.newTotal ? String(state.newTotal) : "";
      }
    }

    function say(text, kind) {
      if (!message) return;
      message.textContent = text || "";
      message.classList.remove("is-error", "is-ok");
      if (text && kind) message.classList.add(kind === "error" ? "is-error" : "is-ok");
    }

    function render() {
      if (entryBox) entryBox.hidden = state.applied;
      if (appliedBox) appliedBox.hidden = !state.applied;
      if (appliedCode) appliedCode.textContent = state.code;
      if (appliedNote) {
        var savings = state.quoteOnly
          ? "we'll apply this to your quotation."
          : "you save " + peso(state.discount) + ".";
        appliedNote.textContent = state.label
          ? state.label + " — " + savings
          : savings.charAt(0).toUpperCase() + savings.slice(1);
      }
      setHiddenFields();
      if (typeof config.onChange === "function") config.onChange(state);
    }

    function apply(code, quiet) {
      var result = evaluate(code, { total: total, scope: config.scope });
      if (!result.ok) {
        if (!quiet) say(result.error, "error");
        return false;
      }
      state.applied = true;
      state.code = normalise(code);
      state.label = result.label || "";
      state.discount = result.discount;
      state.quoteOnly = result.quoteOnly;
      state.newTotal = result.quoteOnly ? 0 : result.newTotal;
      state.deposit = result.quoteOnly ? baseDeposit : Math.round(state.newTotal * rate);
      say("", null);
      render();
      return true;
    }

    function remove() {
      state.applied = false;
      state.code = "";
      state.label = "";
      state.discount = 0;
      state.quoteOnly = false;
      state.newTotal = total;
      state.deposit = baseDeposit;
      if (input) input.value = "";
      say("", null);
      render();
      if (input) input.focus();
    }

    if (applyBtn) applyBtn.addEventListener("click", function () { apply(input ? input.value : ""); });
    if (removeBtn) removeBtn.addEventListener("click", remove);
    if (input) {
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          apply(input.value);
        }
      });
      input.addEventListener("input", function () { say("", null); });
    }

    render();

    /* Let a social post link straight to a pre-filled code:
       .../cart-checkout.html?...&code=NAZTURNS5 */
    var param = config.applyFromUrl === undefined ? "code" : config.applyFromUrl;
    if (param) {
      var fromUrl = new URLSearchParams(global.location.search).get(param);
      if (fromUrl) {
        if (input) input.value = normalise(fromUrl);
        apply(fromUrl, true);
      }
    }

    return { apply: apply, remove: remove, state: state };
  }

  global.NazVouchers = { evaluate: evaluate, find: find, mount: mount, peso: peso, list: VOUCHERS };
})(window);
