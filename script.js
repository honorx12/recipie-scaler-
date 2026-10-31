'use strict';

(function () {
  const STORAGE_KEY = 'recipeScalerState_v1';
  const WINDOW_NAME_PREFIX = 'recipeScalerState_v1::';

  function getEl(id) {
    return document.getElementById(id);
  }

  function readNumber(el) {
    if (!el) return null;
    const s = el.value.trim();
    if (s === '') return null;
    const n = Number(s);
    if (!Number.isFinite(n)) return null;
    return n;
  }

  function formatNumber(n) {
    if (!Number.isFinite(n)) return '0';
    const r = Number(n.toFixed(2));
    if (r === 0) return '0';
    if (Math.abs(r) >= 1e21) return String(r);
    return r.toString();
  }

  function validate() {
    const origEl = getEl('originalServings');
    const desEl = getEl('desiredServings');
    if (!origEl || !desEl) {
      return { ok: false, errors: [], firstInvalidEl: null };
    }

    const orig = readNumber(origEl);
    const des = readNumber(desEl);

    const origInvalid = orig === null || orig <= 0;
    const desInvalid = des === null || des <= 0;

    if (origInvalid && desInvalid) {
      const msg = 'Please enter valid servings for both fields (numbers greater than 0).';
      return {
        ok: false,
        errors: [msg],
        firstInvalidEl: origEl,
        invalidEls: [origEl, desEl]
      };
    }

    if (origInvalid) {
      const msg = 'Please enter how many servings the recipe makes (a number greater than 0).';
      return {
        ok: false,
        errors: [msg],
        firstInvalidEl: origEl,
        invalidEls: [origEl]
      };
    }

    if (desInvalid) {
      const msg = 'Please enter how many servings you want (a number greater than 0).';
      return {
        ok: false,
        errors: [msg],
        firstInvalidEl: desEl,
        invalidEls: [desEl]
      };
    }

    const ingInputs = [
      getEl('ing1Amount'),
      getEl('ing2Amount'),
      getEl('ing3Amount')
    ];

    const invalidIngs = [];
    let firstOffenderNum = null;

    for (let i = 0; i < 3; i++) {
      const input = ingInputs[i];
      if (!input) continue;
      const amt = readNumber(input);
      if (amt === null || amt < 0) {
        invalidIngs.push(input);
        if (firstOffenderNum === null) {
          firstOffenderNum = i + 1;
        }
      }
    }

    if (invalidIngs.length > 0) {
      const msg = 'Please enter a valid amount (0 or more) for Ingredient ' + firstOffenderNum + '.';
      return {
        ok: false,
        errors: [msg],
        firstInvalidEl: invalidIngs[0],
        invalidEls: invalidIngs
      };
    }

    const scaleFactor = des / orig;
    let overflow = !Number.isFinite(scaleFactor);

    if (!overflow) {
      for (let i = 0; i < 3; i++) {
        const amt = readNumber(ingInputs[i]);
        const newAmt = (amt * des) / orig;
        if (!Number.isFinite(newAmt)) {
          overflow = true;
          break;
        }
      }
    }

    if (overflow) {
      const msg = 'Those numbers are too large to scale. Please use smaller values.';
      return {
        ok: false,
        errors: [msg],
        firstInvalidEl: origEl,
        invalidEls: [origEl, desEl]
      };
    }

    return {
      ok: true,
      errors: [],
      firstInvalidEl: null,
      invalidEls: []
    };
  }

  function calculate(silent = false) {
    const isSilent = silent === true;
    const validation = validate();

    if (!validation.ok) {
      clearResult();
      clearSavedState();
      if (!isSilent) {
        showMessage(validation.errors[0] || '', validation.invalidEls || []);
        if (validation.firstInvalidEl && typeof validation.firstInvalidEl.focus === 'function') {
          validation.firstInvalidEl.focus();
        }
      } else {
        clearMessage();
      }
      return;
    }

    clearMessage();

    const origEl = getEl('originalServings');
    const desEl = getEl('desiredServings');
    if (!origEl || !desEl) return;

    const origServings = readNumber(origEl);
    const desServings = readNumber(desEl);
    const scaleFactor = desServings / origServings;

    const dishEl = getEl('dishName');
    const dishName = dishEl && dishEl.value.trim() ? dishEl.value.trim() : 'Your recipe';

    const ings = [];
    for (let i = 1; i <= 3; i++) {
      const nameEl = getEl('ing' + i + 'Name');
      const amtEl = getEl('ing' + i + 'Amount');
      const name = nameEl && nameEl.value.trim() ? nameEl.value.trim() : 'Ingredient ' + i;
      const origAmt = readNumber(amtEl);
      const newAmt = (origAmt * desServings) / origServings;
      ings.push({
        name: name,
        origAmt: origAmt,
        newAmt: newAmt
      });
    }

    const resultData = {
      dishName: dishName,
      originalServings: origServings,
      desiredServings: desServings,
      scaleFactor: scaleFactor,
      ings: ings
    };

    renderResult(resultData);
    saveState();
  }

  function renderResult(data) {
    clearResult();
    const resultEl = getEl('result');
    const resultCard = getEl('resultCard');
    if (!resultEl || !resultCard) return;

    const h3 = document.createElement('h3');
    h3.className = 'result-dish';
    h3.textContent = data.dishName;
    resultEl.appendChild(h3);

    const summary = document.createElement('p');
    summary.className = 'result-summary';
    summary.textContent = 'Original servings: ' + formatNumber(data.originalServings) + ' → Wanted servings: ' + formatNumber(data.desiredServings);
    resultEl.appendChild(summary);

    const factor = document.createElement('p');
    factor.className = 'result-factor';
    factor.textContent = 'Scale factor: × ' + formatNumber(data.scaleFactor);
    resultEl.appendChild(factor);

    const list = document.createElement('ul');
    list.className = 'result-list';

    for (let i = 0; i < data.ings.length; i++) {
      const ing = data.ings[i];
      const li = document.createElement('li');
      li.className = 'result-row';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'result-ing-name';
      nameDiv.textContent = ing.name;

      const origDiv = document.createElement('div');
      origDiv.className = 'result-ing-orig';
      origDiv.textContent = 'Original: ' + formatNumber(ing.origAmt);

      const newDiv = document.createElement('div');
      newDiv.className = 'result-ing-new';
      newDiv.appendChild(document.createTextNode('New amount: '));

      const strong = document.createElement('strong');
      strong.textContent = formatNumber(ing.newAmt);
      newDiv.appendChild(strong);

      li.appendChild(nameDiv);
      li.appendChild(origDiv);
      li.appendChild(newDiv);
      list.appendChild(li);
    }

    resultEl.appendChild(list);
    resultCard.hidden = false;
  }

  function showMessage(text, invalidEls) {
    const msgEl = getEl('message');
    if (msgEl) {
      msgEl.textContent = text;
      msgEl.hidden = false;
    }

    const allInputs = document.querySelectorAll('#recipeForm input');
    for (let i = 0; i < allInputs.length; i++) {
      allInputs[i].removeAttribute('aria-invalid');
      allInputs[i].removeAttribute('aria-describedby');
    }

    if (Array.isArray(invalidEls)) {
      for (let i = 0; i < invalidEls.length; i++) {
        const el = invalidEls[i];
        if (el) {
          el.setAttribute('aria-invalid', 'true');
          el.setAttribute('aria-describedby', 'message');
        }
      }
    }
  }

  function clearMessage() {
    const msgEl = getEl('message');
    if (msgEl) {
      msgEl.textContent = '';
      msgEl.hidden = true;
    }

    const allInputs = document.querySelectorAll('#recipeForm input');
    for (let i = 0; i < allInputs.length; i++) {
      allInputs[i].removeAttribute('aria-invalid');
      allInputs[i].removeAttribute('aria-describedby');
    }
  }

  function clearResult() {
    const resultEl = getEl('result');
    if (resultEl) {
      while (resultEl.firstChild) {
        resultEl.removeChild(resultEl.firstChild);
      }
    }
    const resultCard = getEl('resultCard');
    if (resultCard) {
      resultCard.hidden = true;
    }
  }

  function saveState() {
    const dishEl = getEl('dishName');
    const origEl = getEl('originalServings');
    const desEl = getEl('desiredServings');
    const ing1N = getEl('ing1Name');
    const ing1A = getEl('ing1Amount');
    const ing2N = getEl('ing2Name');
    const ing2A = getEl('ing2Amount');
    const ing3N = getEl('ing3Name');
    const ing3A = getEl('ing3Amount');

    if (!dishEl || !origEl || !desEl || !ing1N || !ing1A || !ing2N || !ing2A || !ing3N || !ing3A) {
      return;
    }

    const state = {
      dishName: dishEl.value,
      originalServings: origEl.value,
      desiredServings: desEl.value,
      ing: [
        { name: ing1N.value, amount: ing1A.value },
        { name: ing2N.value, amount: ing2A.value },
        { name: ing3N.value, amount: ing3A.value }
      ]
    };

    const serialized = JSON.stringify(state);

    let saved = false;
    try {
      localStorage.setItem(STORAGE_KEY, serialized);
      saved = true;
    } catch (e) {}

    if (!saved) {
      try {
        sessionStorage.setItem(STORAGE_KEY, serialized);
        saved = true;
      } catch (e) {}
    }

    if (!saved) {
      try {
        window.name = WINDOW_NAME_PREFIX + serialized;
        saved = true;
      } catch (e) {}
    }
  }

  function clearSavedState() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}

    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {}

    try {
      if (typeof window.name === 'string' && window.name.indexOf(WINDOW_NAME_PREFIX) === 0) {
        window.name = '';
      }
    } catch (e) {}
  }

  function isPlainObject(obj) {
    return Object.prototype.toString.call(obj) === '[object Object]';
  }

  function isValidStateObject(s) {
    if (!isPlainObject(s)) return false;
    if (typeof s.dishName !== 'string') return false;

    function isValidVal(v) {
      if (typeof v === 'string') return true;
      if (typeof v === 'number' && Number.isFinite(v)) return true;
      return false;
    }

    if (!isValidVal(s.originalServings)) return false;
    if (!isValidVal(s.desiredServings)) return false;

    if (!Array.isArray(s.ing) || s.ing.length !== 3) return false;
    for (let i = 0; i < 3; i++) {
      const item = s.ing[i];
      if (!isPlainObject(item)) return false;
      if (typeof item.name !== 'string') return false;
      if (!isValidVal(item.amount)) return false;
    }
    return true;
  }

  function readRawSavedState() {
    try {
      const val = localStorage.getItem(STORAGE_KEY);
      if (val) return val;
    } catch (e) {}

    try {
      const val = sessionStorage.getItem(STORAGE_KEY);
      if (val) return val;
    } catch (e) {}

    try {
      if (typeof window.name === 'string' && window.name.indexOf(WINDOW_NAME_PREFIX) === 0) {
        return window.name.slice(WINDOW_NAME_PREFIX.length);
      }
    } catch (e) {}

    return null;
  }

  function loadState() {
    const raw = readRawSavedState();
    if (!raw) return;

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      clearSavedState();
      return;
    }

    if (!isValidStateObject(parsed)) {
      clearSavedState();
      return;
    }

    const dishEl = getEl('dishName');
    const origEl = getEl('originalServings');
    const desEl = getEl('desiredServings');
    const ing1N = getEl('ing1Name');
    const ing1A = getEl('ing1Amount');
    const ing2N = getEl('ing2Name');
    const ing2A = getEl('ing2Amount');
    const ing3N = getEl('ing3Name');
    const ing3A = getEl('ing3Amount');

    if (!dishEl || !origEl || !desEl || !ing1N || !ing1A || !ing2N || !ing2A || !ing3N || !ing3A) {
      return;
    }

    dishEl.value = String(parsed.dishName);
    origEl.value = String(parsed.originalServings);
    desEl.value = String(parsed.desiredServings);
    ing1N.value = String(parsed.ing[0].name);
    ing1A.value = String(parsed.ing[0].amount);
    ing2N.value = String(parsed.ing[1].name);
    ing2A.value = String(parsed.ing[1].amount);
    ing3N.value = String(parsed.ing[2].name);
    ing3A.value = String(parsed.ing[2].amount);

    calculate(true);
  }

  function resetAll() {
    const allInputs = document.querySelectorAll('#recipeForm input');
    for (let i = 0; i < allInputs.length; i++) {
      allInputs[i].value = '';
      allInputs[i].removeAttribute('aria-invalid');
      allInputs[i].removeAttribute('aria-describedby');
    }

    clearMessage();
    clearResult();
    clearSavedState();

    const dishEl = getEl('dishName');
    if (dishEl) {
      dishEl.focus();
    }
  }

  function loadExample() {
    clearMessage();
    clearResult();

    const dishEl = getEl('dishName');
    const origEl = getEl('originalServings');
    const desEl = getEl('desiredServings');
    const ing1N = getEl('ing1Name');
    const ing1A = getEl('ing1Amount');
    const ing2N = getEl('ing2Name');
    const ing2A = getEl('ing2Amount');
    const ing3N = getEl('ing3Name');
    const ing3A = getEl('ing3Amount');

    if (dishEl) dishEl.value = 'Pancakes';
    if (origEl) origEl.value = '4';
    if (desEl) desEl.value = '6';
    if (ing1N) ing1N.value = 'Flour';
    if (ing1A) ing1A.value = '200';
    if (ing2N) ing2N.value = 'Milk';
    if (ing2A) ing2A.value = '1.5';
    if (ing3N) ing3N.value = 'Eggs';
    if (ing3A) ing3A.value = '3';
  }

  function init() {
    const scaleBtn = getEl('scaleBtn');
    if (scaleBtn) {
      scaleBtn.addEventListener('click', function () {
        calculate(false);
      });
    }

    const resetBtn = getEl('resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetAll();
      });
    }

    const exampleBtn = getEl('exampleBtn');
    if (exampleBtn) {
      exampleBtn.addEventListener('click', function () {
        loadExample();
      });
    }

    const form = getEl('recipeForm');
    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
      });
    }

    const inputs = document.querySelectorAll('#recipeForm input');
    for (let i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          calculate(false);
        }
      });
    }

    loadState();
  }

  init();
})();