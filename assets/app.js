/* ====== CONFIG ====== */
const SUBMIT_ENDPOINT = "https://script.google.com/macros/s/AKfycbzXkD9U8kY8p3VNTnrH9Szvvznz19eY8AAclaG2wUzOJfv0sAj8aGfWRHY_4-jfUcpQyw/exec"; // e.g. "https://script.google.com/macros/s/XXXX/exec"
const EMP_ID_REGEX = /^[A-Z0-9_-]{4,20}$/;

/* ====== HELPERS ====== */
const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => [...r.querySelectorAll(s)];

function nowIso() { return new Date().toISOString(); }

function escapeHtml(str) {
	return String(str ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}

function show(el) { el?.classList?.remove("hidden"); }
function hide(el) { el?.classList?.add("hidden"); }

function setHelp(el, msg, isErr = false) {
	if (!el) return;
	el.textContent = msg || "";
	el.classList.toggle("err", !!isErr);
}

function toUrlEncoded(obj) {
	const p = new URLSearchParams();
	Object.entries(obj).forEach(([k, v]) => {
		if (v && typeof v === "object") p.append(k, JSON.stringify(v));
		else p.append(k, v == null ? "" : String(v));
	});
	return p.toString();
}

// ---- JSON compatibility helpers (supports both schemas) ----
function getQuestionText(q) {
	return (q && (q.text ?? q.question)) || "";
}
function getOptionText(q, key) {
	if (!q || !q.options) return "";
	if (!Array.isArray(q.options)) return q.options[key] || "";
	const found = q.options.find(o => String(o.key).toUpperCase() === key);
	return found ? (found.text || "") : "";
}

/* ====== STATE ====== */
const url = new URL(location.href);
const testId = url.searchParams.get("testId") || "day_01";

let testsIndex = [];
let test = null;

const identity = { employeeId: "", fullName: "" };

let attempt = {
	attemptId: "",
	employeeId: "",
	fullName: "",
	startedAt: "",
	submittedAt: "",
	durationSeconds: "",
	timeTakenSeconds: "",
	answers: {},          // { [qid]: "A" }
	marked: [],           // ["qid1", "qid2"]
};

let idx = 0;
let timerInt = null;
let timeLeft = 0;

/* ====== DOM ====== */
const screenGate = qs("#screenGate");
const screenIntro = qs("#screenIntro");
const screenTest = qs("#screenTest");
const screenDone = qs("#screenDone");

const employeeIdInput = qs("#employeeId");
const fullNameInput = qs("#fullName");
const empHelp = qs("#empHelp");
const nameHelp = qs("#nameHelp");
const btnContinue = qs("#btnContinue");

const introTitle = qs("#introTitle");
const introMeta = qs("#introMeta");
const introTime = qs("#introTime");
const btnStart = qs("#btnStart");

const timerPill = qs("#timerPill");
const qMeta = qs("#qMeta");
const qText = qs("#qText");
const optionsWrap = qs("#optionsWrap");

const btnPrev = qs("#btnPrev");
const btnNext = qs("#btnNext");
const btnMark = qs("#btnMark");

const markedChip = qs("#markedChip");

const navChips = qs("#navChips");
const navChipsMobile = qs("#navChipsMobile");

/* ====== STORAGE ====== */
function attemptKey() {
	const who = (attempt.employeeId || identity.employeeId || "anon").toLowerCase();
	return `mcq_attempt:${testId}:${who}`;
}

function ensureAttemptId() {
	if (!attempt.attemptId) attempt.attemptId = `att_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function saveAttempt() {
	try { localStorage.setItem(attemptKey(), JSON.stringify(attempt)); } catch { }
}

function loadAttemptIfAny() {
	try {
		const raw = localStorage.getItem(attemptKey());
		if (!raw) return;
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === "object") attempt = { ...attempt, ...parsed };
	} catch { }
}

function isMarked(qid) {
	return (attempt.marked || []).includes(qid);
}

/* ====== RENDER ====== */
function currentQ() { return test.questions[idx]; }

function setTimerPill(seconds) {
	const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
	const ss = String(seconds % 60).padStart(2, "0");
	timerPill.textContent = `${mm}:${ss}`;
	timerPill.classList.toggle("critical", seconds <= 30);
}

function updateProgressUI() {
	// optional: you can update any progress bar here if exists
}

function renderChips(container) {
	if (!container) return;
	container.innerHTML = "";
	test.questions.forEach((q, i) => {
		const b = document.createElement("button");
		b.type = "button";
		b.className = "chip";
		b.textContent = String(i + 1);
		const answered = !!attempt.answers[q.id];
		b.classList.toggle("answered", answered);
		b.classList.toggle("marked", isMarked(q.id));
		b.classList.toggle("active", i === idx);
		b.addEventListener("click", () => { idx = i; renderQuestion(); });
		container.appendChild(b);
	});
}

function renderQuestion() {
	const q = currentQ();
	qMeta.textContent = `${q.id} / ${test.questions.length}`;
	qText.textContent = getQuestionText(q);

	const selected = attempt.answers[q.id] || null;

	markedChip.style.display = isMarked(q.id) ? "inline-flex" : "none";
	btnPrev.disabled = idx === 0;
	btnNext.textContent = (idx === test.questions.length - 1) ? "Review & Submit" : "Save & Next";

	optionsWrap.innerHTML = "";
	const keys = ["A", "B", "C", "D"];

	keys.forEach(k => {
		const opt = document.createElement("div");
		opt.className = "option" + (selected === k ? " selected" : "");
		opt.tabIndex = 0;
		opt.setAttribute("role", "button");
		opt.setAttribute("aria-label", `Option ${k}`);

		const optText = getOptionText(q, k);

		opt.innerHTML = `
      <div class="optLeft">
        <div class="optKey">${k}</div>
        <div class="optText">${escapeHtml(optText)}</div>
      </div>
      <div class="optRight">${selected === k ? "✓" : ""}</div>
    `;

		const choose = () => {
			attempt.answers[q.id] = k;
			saveAttempt();
			renderQuestion();
			updateProgressUI();
			renderChips(navChips);
			renderChipsRow(navChipsMobile);
		};

		opt.addEventListener("click", choose);
		opt.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				choose();
			}
		});

		optionsWrap.appendChild(opt);
	});
}

function renderChipsRow(container) {
	// mobile chips: reuse same renderer
	renderChips(container);
}

function disableAll(disabled) {
	[btnPrev, btnNext, btnMark].forEach(b => b && (b.disabled = disabled));
}

/* ====== TIMER ====== */
function startTimer() {
	clearInterval(timerInt);

	timeLeft = Number(test.durationSeconds || 0);
	if (!Number.isFinite(timeLeft) || timeLeft <= 0) {
		// fallback
		timeLeft = (test.questions.length >= 20) ? 1200 : 900;
	}
	setTimerPill(timeLeft);

	timerInt = setInterval(() => {
		timeLeft -= 1;
		if (timeLeft < 0) timeLeft = 0;
		setTimerPill(timeLeft);

		if (timeLeft <= 0) {
			clearInterval(timerInt);
			submitAttempt(true);
		}
	}, 1000);
}

/* ====== SUBMIT ====== */
async function submitAttempt(isAuto = false) {
	ensureAttemptId();

	attempt.submittedAt = nowIso();
	if (attempt.startedAt) {
		const startMs = new Date(attempt.startedAt).getTime();
		attempt.timeTakenSeconds = Math.max(0, Math.round((Date.now() - startMs) / 1000));
	} else {
		attempt.timeTakenSeconds = "";
	}

	saveAttempt();

	const payload = {
		employeeId: attempt.employeeId || identity.employeeId || "",
		fullName: attempt.fullName || identity.fullName || "",
		testId,
		attemptId: attempt.attemptId,
		startedAt: attempt.startedAt || "",
		submittedAt: attempt.submittedAt,
		timeTakenSeconds: attempt.timeTakenSeconds || "",
		answers: attempt.answers || {},
		marked: attempt.marked || [],
		userAgent: navigator.userAgent,
		source: "github_pages",
		isAuto: !!isAuto
	};

	if (!SUBMIT_ENDPOINT || SUBMIT_ENDPOINT.includes("PASTE_YOUR")) {
		console.log("SUBMIT PAYLOAD (no endpoint set):", payload);
		showSuccess(attempt.attemptId);
		return;
	}

	try {
		disableAll(true);

		// ✅ CORS-safe submit (no preflight)
		const res = await fetch(SUBMIT_ENDPOINT, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
			body: toUrlEncoded(payload)
		});

		const txt = await res.text();
		let data = null;
		try { data = JSON.parse(txt); } catch { }

		if (!res.ok || (data && data.ok === false)) {
			const msg = (data && data.error) ? data.error : `HTTP ${res.status}: ${txt}`;
			throw new Error(msg);
		}

		console.log("Submit response:", data || txt);
		showSuccess(attempt.attemptId);

	} catch (e) {
		console.error(e);
		disableAll(false);
		alert("Submission failed: " + String(e.message || e));
	}
}

/* ====== DONE ====== */
function showSuccess(attemptId) {
	clearInterval(timerInt);
	hide(screenTest);
	hide(screenIntro);
	hide(screenGate);
	show(screenDone);

	const doneId = qs("#doneAttemptId");
	if (doneId) doneId.textContent = attemptId || "";
}

/* ====== EVENTS ====== */
btnContinue?.addEventListener("click", () => {
	const emp = (employeeIdInput?.value || "").trim().toUpperCase().replace(/\s+/g, "");
	const name = (fullNameInput?.value || "").trim();

	identity.employeeId = emp;
	identity.fullName = name;

	// ✅ persist in attempt
	attempt.employeeId = emp;
	attempt.fullName = name;

	setHelp(empHelp, "");
	setHelp(nameHelp, "");

	let ok = true;
	if (!emp && !name) {
		setHelp(empHelp, "Enter Employee ID or Full Name", true);
		setHelp(nameHelp, "Enter Employee ID or Full Name", true);
		ok = false;
	}
	if (emp && !EMP_ID_REGEX.test(emp)) {
		setHelp(empHelp, "Use 4–20 chars: A–Z, 0–9, - or _", true);
		ok = false;
	}
	if (!ok) return;

	saveAttempt();
	loadAttemptIfAny();

	hide(screenGate);
	show(screenIntro);
});

btnStart?.addEventListener("click", () => {
	ensureAttemptId();
	attempt.startedAt = attempt.startedAt || nowIso();
	saveAttempt();

	hide(screenIntro);
	show(screenTest);

	idx = 0;
	renderQuestion();
	renderChips(navChips);
	renderChipsRow(navChipsMobile);
	startTimer();
});

btnPrev?.addEventListener("click", () => {
	if (idx > 0) idx -= 1;
	renderQuestion();
	renderChips(navChips);
	renderChipsRow(navChipsMobile);
});

btnNext?.addEventListener("click", async () => {
	if (idx === test.questions.length - 1) {
		// Submit at end
		await submitAttempt(false);
		return;
	}
	idx += 1;
	renderQuestion();
	renderChips(navChips);
	renderChipsRow(navChipsMobile);
});

btnMark?.addEventListener("click", () => {
	const qid = currentQ().id;
	attempt.marked = attempt.marked || [];
	if (isMarked(qid)) attempt.marked = attempt.marked.filter(x => x !== qid);
	else attempt.marked.push(qid);

	saveAttempt();
	renderQuestion();
	renderChips(navChips);
	renderChipsRow(navChipsMobile);
});

/* ====== INIT ====== */
(async function init() {
	// Load tests index (optional)
	try {
		const r = await fetch("../data/tests.json", { cache: "no-store" });
		testsIndex = await r.json();
	} catch { }

	// Load test JSON
	const res = await fetch(`../data/${testId}.json`, { cache: "no-store" });
	test = await res.json();

	// fallback duration if missing
	if (typeof test.durationSeconds !== "number") {
		const meta = Array.isArray(testsIndex) ? testsIndex.find(t => t.testId === testId) : null;
		if (meta && typeof meta.durationSeconds === "number") test.durationSeconds = meta.durationSeconds;
		else test.durationSeconds = (test.questions?.length >= 20) ? 1200 : 900;
	}

	// Intro UI
	if (introTitle) introTitle.textContent = test.title || testId;
	if (introMeta) introMeta.textContent = `${(test.questions || []).length} Questions`;
	if (introTime) introTime.textContent = `Time: ${Math.round(test.durationSeconds / 60)} min`;

	// Start on gate
	show(screenGate);
	hide(screenIntro);
	hide(screenTest);
	hide(screenDone);
})();