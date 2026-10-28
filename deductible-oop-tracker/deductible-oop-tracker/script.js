/* ---------- Data ---------- */
let claims = [];   // {id, date, desc, type, allowed, copay}
let nextId = 1;
const KEY = "ded-oop-tracker-v1";

const $ = id => document.getElementById(id);
const money = n => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

/* ---------- Core calculation ---------- */
function readPlan() {
  return {
    deductible: parseFloat($("ded").value),
    oopMax: parseFloat($("oop").value),
    coins: parseFloat($("coins").value) / 100,
  };
}

/* Applies claims in date order and tracks running deductible and OOP totals. */
function processClaims(plan, list) {
  const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  let dedUsed = 0, oopUsed = 0;
  const rows = sorted.map(c => {
    let ded = 0, coins = 0, copay = 0;
    if (c.type === "copay") {
      copay = Math.min(c.copay, c.allowed);
    } else if (c.type === "standard") {
      ded = Math.min(Math.max(plan.deductible - dedUsed, 0), c.allowed);
      coins = (c.allowed - ded) * plan.coins;
    } // preventive: patient pays nothing

    let patient = ded + coins + copay;
    const room = Math.max(plan.oopMax - oopUsed, 0);
    const capped = patient > room;
    if (capped) patient = room;              // OOP maximum reached: plan pays 100% beyond it

    dedUsed += ded;
    oopUsed += patient;
    return { ...c, ded, patient, planPays: c.allowed - patient, capped, dedUsed, oopUsed };
  });
  return { rows, dedUsed, oopUsed };
}

/* ---------- Rendering ---------- */
function setMeter(prefix, used, limit) {
  const pct = limit > 0 ? Math.min(used / limit * 100, 100) : 0;
  $(prefix + "Bar").style.width = pct + "%";
  $(prefix + "Text").textContent = money(used) + " of " + money(limit);
  const left = Math.max(limit - used, 0);
  $(prefix + "Note").textContent = left === 0
    ? (prefix === "ded" ? "Deductible met. Coinsurance applies from here." : "Out-of-pocket maximum reached. The plan pays 100% of covered costs.")
    : money(left) + " remaining (" + pct.toFixed(0) + "% used)";
}

function render() {
  const plan = readPlan();
  const bad = [plan.deductible, plan.oopMax, plan.coins].some(Number.isNaN) || plan.deductible < 0 || plan.oopMax < 0 || plan.coins < 0 || plan.coins > 1;
  $("planErr").textContent = bad ? "Enter valid plan numbers (coinsurance 0 to 100)."
    : plan.oopMax < plan.deductible ? "Out-of-pocket maximum is usually at least the deductible." : "";
  if (bad) return;

  const res = processClaims(plan, claims);
  setMeter("ded", res.dedUsed, plan.deductible);
  setMeter("oop", res.oopUsed, plan.oopMax);

  if (!res.rows.length) {
    $("claims").innerHTML = "<div class='empty'>No claims yet. Add one above or load sample claims.</div>";
  } else {
    const typeLabel = { standard: "Standard", copay: "Copay", preventive: "Preventive" };
    const body = res.rows.map(r =>
      "<tr><td>" + esc(r.date) + "</td><td>" + esc(r.desc || "-") + " <span class='badge'>" + typeLabel[r.type] + (r.capped ? ", OOP max" : "") + "</span></td>" +
      "<td>" + money(r.allowed) + "</td><td>" + money(r.ded) + "</td><td>" + money(r.patient) + "</td><td>" + money(r.planPays) + "</td>" +
      "<td><button class='ghost del' data-id='" + r.id + "' aria-label='Delete claim " + esc(r.desc || r.date) + "'>Delete</button></td></tr>").join("");
    const tot = k => res.rows.reduce((s, r) => s + r[k], 0);
    $("claims").innerHTML = "<table><thead><tr><th>Date</th><th>Description</th><th>Allowed</th><th>To deductible</th><th>You pay</th><th>Plan pays</th><th></th></tr></thead><tbody>" +
      body + "</tbody><tfoot><tr><td colspan='2'>Totals</td><td>" + money(tot("allowed")) + "</td><td>" + money(tot("ded")) +
      "</td><td>" + money(tot("patient")) + "</td><td>" + money(tot("planPays")) + "</td><td></td></tr></tfoot></table>";
  }
  save();
}

/* ---------- Actions ---------- */
function addClaim() {
  const allowed = parseFloat($("allowed").value);
  const type = $("type").value;
  const copay = parseFloat($("copay").value);
  const date = $("date").value;
  let err = "";
  if (!date) err = "Choose a date of service.";
  else if (Number.isNaN(allowed) || allowed < 0) err = "Enter the allowed amount (0 or more).";
  else if (type === "copay" && (Number.isNaN(copay) || copay < 0)) err = "Enter a valid copay amount.";
  $("claimErr").textContent = err;
  if (err) return;
  claims.push({ id: nextId++, date, desc: $("desc").value.trim(), type, allowed, copay: type === "copay" ? copay : 0 });
  $("desc").value = ""; $("allowed").value = "";
  render();
}

function loadSample() {
  const y = new Date().getFullYear();
  const s = [
    ["02-06", "Annual physical", "preventive", 220, 0],
    ["03-14", "Urgent care visit", "standard", 310, 0],
    ["05-02", "Specialist consult", "copay", 180, 40],
    ["06-20", "MRI, knee", "standard", 1450, 0],
    ["08-11", "Physical therapy x6", "standard", 900, 0],
    ["10-03", "Outpatient surgery", "standard", 6200, 0],
  ];
  s.forEach(([md, desc, type, allowed, copay]) => claims.push({ id: nextId++, date: y + "-" + md, desc, type, allowed, copay }));
  render();
}

/* ---------- Storage (per-browser convenience, guarded) ---------- */
function save() {
  try { localStorage.setItem(KEY, JSON.stringify({ claims, nextId, plan: [$("ded").value, $("oop").value, $("coins").value] })); } catch (e) {}
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || "null");
    if (d && Array.isArray(d.claims)) {
      claims = d.claims; nextId = d.nextId || claims.length + 1;
      if (d.plan) { $("ded").value = d.plan[0]; $("oop").value = d.plan[1]; $("coins").value = d.plan[2]; }
    }
  } catch (e) {}
}

/* ---------- Events ---------- */
$("add").addEventListener("click", addClaim);
$("sample").addEventListener("click", loadSample);
$("reset").addEventListener("click", () => { claims = []; render(); });
$("type").addEventListener("change", () => { $("copayWrap").hidden = $("type").value !== "copay"; });
["ded", "oop", "coins"].forEach(id => $(id).addEventListener("input", render));
$("claims").addEventListener("click", e => {
  const b = e.target.closest("button[data-id]");
  if (b) { claims = claims.filter(c => c.id !== Number(b.dataset.id)); render(); }
});
$("date").value = new Date().toISOString().slice(0, 10);
load();
render();
