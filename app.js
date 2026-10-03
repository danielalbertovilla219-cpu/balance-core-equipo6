"use strict";

const SCENARIOS = [
  { id: "E01", z1: 1.25, z2: 1.25, z3: 1.25, z4: 1.25, expected: "Equilibrada", note: "Simetría exacta" },
  { id: "E02", z1: 1.40, z2: 1.10, z3: 1.30, z4: 1.20, expected: "Equilibrada", note: "Cercano al 10 %" },
  { id: "E03", z1: 1.08, z2: 0.92, z3: 1.10, z4: 0.90, expected: "Equilibrada", note: "9 %, justo antes del umbral" },
  { id: "E04", z1: 1.50, z2: 1.10, z3: 1.25, z4: 1.15, expected: "Mejorable", note: "10 %, inicio del rango" },
  { id: "E05", z1: 1.00, z2: 1.50, z3: 1.20, z4: 1.30, expected: "Mejorable", note: "12 % hacia la derecha" },
  { id: "E06", z1: 1.45, z2: 1.05, z3: 1.40, z4: 1.10, expected: "Mejorable", note: "14 %, cercano al límite" },
  { id: "E07", z1: 1.25, z2: 0.90, z3: 1.05, z4: 0.80, expected: "Mejorable", note: "15 %, borde superior" },
  { id: "E08", z1: 1.40, z2: 1.00, z3: 1.50, z4: 1.10, expected: "Desequilibrada", note: "16 %, supera el límite" },
  { id: "E09", z1: 2.00, z2: 1.40, z3: 1.60, z4: 1.00, expected: "Desequilibrada", note: "20 %, desbalance claro" },
  { id: "E10", z1: 1.40, z2: 2.20, z3: 1.60, z4: 2.80, expected: "Desequilibrada", note: "25 %, derecha dominante" }
];

const ZONES = ["z1", "z2", "z3", "z4"];
const MAX_HISTORY = 40;
const READ_INTERVAL_MS = 500;
const formatter = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctFormatter = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const integerFormatter = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const root = document.documentElement;
const history = [];
const activeAnimations = new WeakMap();

function classify(delta) {
  if (delta < 10 - 1e-9) return "Equilibrada";
  if (delta <= 15 + 1e-9) return "Mejorable";
  return "Desequilibrada";
}

function calculate(values) {
  const total = values.z1 + values.z2 + values.z3 + values.z4;
  const left = values.z1 + values.z3;
  const right = values.z2 + values.z4;
  const top = values.z1 + values.z2;
  const bottom = values.z3 + values.z4;
  const deltaLat = total > 0 ? Math.abs(left - right) / total * 100 : 0;
  const deltaVert = total > 0 ? Math.abs(top - bottom) / total * 100 : 0;
  const governingDelta = Math.max(deltaLat, deltaVert);
  const balanceScore = Math.max(0, 100 - 2 * governingDelta);
  const pressureX = total > 0 ? (right - left) / total : 0;
  const pressureY = total > 0 ? (bottom - top) / total : 0;
  return {
    total, left, right, top, bottom, deltaLat, deltaVert, governingDelta,
    balanceScore, pressureX, pressureY, status: classify(governingDelta)
  };
}

function getValues() {
  return Object.fromEntries(ZONES.map(zone => [zone, Number(document.getElementById(`${zone}Number`).value) || 0]));
}

function animateNumber(element, target, { digits = 1, suffix = "" } = {}) {
  const previous = activeAnimations.get(element);
  if (previous) cancelAnimationFrame(previous);
  const start = Number(element.dataset.numericValue ?? target);
  const startedAt = performance.now();
  const duration = 420;
  const numberFormat = digits === 0 ? integerFormatter : digits === 2 ? formatter : pctFormatter;

  const frame = now => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = start + (target - start) * eased;
    element.textContent = `${numberFormat.format(value)}${suffix}`;
    element.dataset.numericValue = String(value);
    if (progress < 1) activeAnimations.set(element, requestAnimationFrame(frame));
    else {
      element.dataset.numericValue = String(target);
      activeAnimations.delete(element);
    }
  };
  activeAnimations.set(element, requestAnimationFrame(frame));
}

function setStatusTheme(status, valid) {
  const themes = {
    Equilibrada: ["#38dc91", "56, 220, 145"],
    Mejorable: ["#ffb640", "255, 182, 64"],
    Desequilibrada: ["#ff6372", "255, 99, 114"],
    Invalida: ["#8fa1b5", "143, 161, 181"]
  };
  const [color, rgb] = themes[valid ? status : "Invalida"];
  root.style.setProperty("--status", color);
  root.style.setProperty("--status-rgb", rgb);
  document.getElementById("resultPanel").dataset.state = valid ? status.toLowerCase() : "invalida";
}

function recommendation(result) {
  if (result.governingDelta < 10) {
    return "Mantener la distribución actual: el centro de presión está dentro de la zona aceptable.";
  }

  const actions = [];
  if (result.deltaLat >= 10 - 1e-9) {
    const amount = Math.abs(result.left - result.right) / 2;
    const origin = result.left > result.right ? "izquierdo" : "derecho";
    const destination = result.left > result.right ? "derecho" : "izquierdo";
    actions.push(`mover ≈${formatter.format(amount)} kg del lado ${origin} al ${destination}`);
  }
  if (result.deltaVert >= 10 - 1e-9) {
    const amount = Math.abs(result.top - result.bottom) / 2;
    const origin = result.top > result.bottom ? "superior" : "inferior";
    const destination = result.top > result.bottom ? "inferior" : "superior";
    actions.push(`mover ≈${formatter.format(amount)} kg del sector ${origin} al ${destination}`);
  }
  const prefix = result.status === "Desequilibrada" ? "Acción prioritaria: " : "Ajuste recomendado: ";
  return `${prefix}${actions.join(" y ")}.`;
}

function dominantLabel(result) {
  const labels = [];
  if (Math.abs(result.left - result.right) > 1e-9) labels.push(result.left > result.right ? "Izq" : "Der");
  if (Math.abs(result.top - result.bottom) > 1e-9) labels.push(result.top > result.bottom ? "Superior" : "Inferior");
  return labels.length ? labels.join(" · ") : "Centrada";
}

function updateVisualZones(values, total) {
  const max = Math.max(...Object.values(values), .01);
  ZONES.forEach(zone => {
    const value = values[zone];
    const share = total > 0 ? value / total * 100 : 0;
    const visual = document.getElementById(`visual${zone.toUpperCase()}`);
    animateNumber(visual.querySelector("strong"), value, { digits: 2 });
    animateNumber(visual.querySelector("small"), share, { digits: 1, suffix: " %" });
    animateNumber(document.getElementById(`sensor${zone.toUpperCase()}`), value, { digits: 2 });
    visual.style.setProperty("--zone-alpha", String(.12 + (value / max) * .38));
    visual.style.setProperty("--zone-rgb", value === max && max > 0 ? "255, 182, 64" : "53, 137, 213");
    document.getElementById(`${zone}Output`).textContent = `${formatter.format(value)} kg`;
  });
}

function updatePressureCenter(result) {
  const marker = document.getElementById("pressureCenter");
  const x = Math.max(10, Math.min(90, 50 + result.pressureX * 40));
  const y = Math.max(12, Math.min(94, 53 + result.pressureY * 42));
  marker.style.left = `${x}%`;
  marker.style.top = `${y}%`;
  marker.setAttribute("aria-label", `Centro de presión actual: ${pctFormatter.format(result.pressureX * 100)} por ciento horizontal y ${pctFormatter.format(result.pressureY * 100)} por ciento vertical`);
}

function updateAxisBars(result) {
  const maxHorizontal = Math.max(result.left, result.right, .01);
  const maxVertical = Math.max(result.top, result.bottom, .01);
  document.getElementById("leftBar").style.width = `${result.left / maxHorizontal * 48}%`;
  document.getElementById("rightBar").style.width = `${result.right / maxHorizontal * 48}%`;
  document.getElementById("topBar").style.width = `${result.top / maxVertical * 48}%`;
  document.getElementById("bottomBar").style.width = `${result.bottom / maxVertical * 48}%`;
}

function updateDashboard({ addHistory = true } = {}) {
  const values = getValues();
  const result = calculate(values);
  const valid = result.total >= 1 - 1e-9 && result.total <= 10 + 1e-9;

  setStatusTheme(result.status, valid);
  updateVisualZones(values, result.total);
  updatePressureCenter(result);
  updateAxisBars(result);

  animateNumber(document.getElementById("leftWeight"), result.left, { digits: 2, suffix: " kg" });
  animateNumber(document.getElementById("rightWeight"), result.right, { digits: 2, suffix: " kg" });
  animateNumber(document.getElementById("topWeight"), result.top, { digits: 2, suffix: " kg" });
  animateNumber(document.getElementById("bottomWeight"), result.bottom, { digits: 2, suffix: " kg" });
  animateNumber(document.getElementById("totalWeight"), result.total, { digits: 2, suffix: " kg" });
  animateNumber(document.getElementById("deltaValue"), result.deltaLat, { digits: 1, suffix: "%" });
  animateNumber(document.getElementById("deltaVertValue"), result.deltaVert, { digits: 1, suffix: "%" });
  animateNumber(document.getElementById("scoreValue"), valid ? result.balanceScore : 0, { digits: 0 });

  document.getElementById("dominantSide").textContent = dominantLabel(result);
  document.getElementById("statusLabel").textContent = valid ? result.status : "Fuera de rango";
  document.getElementById("statusMessage").textContent = valid
    ? recommendation(result)
    : "Ajusta la suma de las cuatro zonas para trabajar dentro del rango de validación de 1 a 10 kg.";
  document.getElementById("rangeWarning").hidden = valid;

  const circumference = 2 * Math.PI * 76;
  const displayedScore = valid ? result.balanceScore : 0;
  document.getElementById("orbitValue").style.strokeDashoffset = String(circumference * (1 - displayedScore / 100));

  const matching = SCENARIOS.find(s => ZONES.every(zone => Math.abs(s[zone] - values[zone]) < .001));
  document.querySelectorAll("#scenarioTableBody tr").forEach(row => row.classList.toggle("active", row.dataset.id === matching?.id));
  if (matching) document.getElementById("scenarioSelect").value = matching.id;
  if (addHistory) recordMeasurement(values);
}

function setZone(zone, value) {
  const normalized = Math.max(0, Math.min(5, Number(value) || 0));
  document.getElementById(`${zone}Range`).value = normalized;
  document.getElementById(`${zone}Number`).value = normalized.toFixed(2);
}

function loadScenario(id) {
  const scenario = SCENARIOS.find(item => item.id === id);
  if (!scenario) return;
  ZONES.forEach(zone => setZone(zone, scenario[zone]));
  updateDashboard();
}

function stateBadge(status) {
  return `<span class="state-badge ${status.toLowerCase()}">${status}</span>`;
}

function buildScenarioTable() {
  const select = document.getElementById("scenarioSelect");
  const tbody = document.getElementById("scenarioTableBody");
  let correct = 0;

  SCENARIOS.forEach(scenario => {
    const result = calculate(scenario);
    const pass = result.status === scenario.expected;
    if (pass) correct += 1;

    const option = document.createElement("option");
    option.value = scenario.id;
    option.textContent = `${scenario.id} · ${scenario.note}`;
    select.appendChild(option);

    const row = document.createElement("tr");
    row.dataset.id = scenario.id;
    row.tabIndex = 0;
    row.setAttribute("aria-label", `Cargar escenario ${scenario.id}`);
    row.innerHTML = `
      <td><strong>${scenario.id}</strong></td>
      ${ZONES.map(zone => `<td>${formatter.format(scenario[zone])}</td>`).join("")}
      <td>${formatter.format(result.total)} kg</td>
      <td><strong>${pctFormatter.format(result.deltaLat)}%</strong></td>
      <td><strong>${pctFormatter.format(result.deltaVert)}%</strong></td>
      <td>${stateBadge(scenario.expected)}</td>
      <td>${stateBadge(result.status)}</td>
      <td><span class="check-badge">${pass ? "✓ Correcto" : "✕ Revisar"}</span></td>`;
    row.addEventListener("click", () => {
      select.value = scenario.id;
      loadScenario(scenario.id);
      document.getElementById("simulador").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    row.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        row.click();
      }
    });
    tbody.appendChild(row);
  });

  document.getElementById("correctCount").textContent = String(correct);
}

function recordMeasurement(values = getValues()) {
  history.push({ ...values });
  if (history.length > MAX_HISTORY) history.shift();
  renderHistory();
}

function renderHistory() {
  const plotLeft = 52;
  const plotWidth = 888;
  const plotTop = 20;
  const plotHeight = 180;
  const offset = MAX_HISTORY - history.length;

  ZONES.forEach(zone => {
    const path = history.map((sample, index) => {
      const x = plotLeft + ((offset + index) / (MAX_HISTORY - 1)) * plotWidth;
      const y = plotTop + (1 - Math.min(5, sample[zone]) / 5) * plotHeight;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
    document.getElementById(`history${zone.toUpperCase()}`).setAttribute("d", path);
  });
}

function seedHistory() {
  const values = getValues();
  history.length = 0;
  for (let index = 0; index < MAX_HISTORY; index += 1) history.push({ ...values });
  renderHistory();
}

function bindControls() {
  ZONES.forEach(zone => {
    const range = document.getElementById(`${zone}Range`);
    const number = document.getElementById(`${zone}Number`);
    range.addEventListener("input", () => {
      number.value = Number(range.value).toFixed(2);
      updateDashboard();
    });
    number.addEventListener("input", () => {
      range.value = number.value;
      updateDashboard();
    });
    number.addEventListener("change", () => {
      setZone(zone, number.value);
      updateDashboard();
    });
  });

  document.getElementById("loadScenarioButton").addEventListener("click", () => loadScenario(document.getElementById("scenarioSelect").value));
  document.getElementById("resetButton").addEventListener("click", () => loadScenario("E01"));
  document.getElementById("presentationButton").addEventListener("click", async () => {
    document.body.classList.toggle("presentation");
    if (!document.fullscreenElement) {
      try { await document.documentElement.requestFullscreen(); } catch (_) { /* Compact presentation mode still works. */ }
    } else {
      await document.exitFullscreen();
    }
  });
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) document.body.classList.remove("presentation");
  });
}

buildScenarioTable();
bindControls();
loadScenario("E01");
seedHistory();
setInterval(() => recordMeasurement(), READ_INTERVAL_MS);
