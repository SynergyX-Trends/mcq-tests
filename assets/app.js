(() => {
	const qs = new URLSearchParams(location.search);
	const testId = qs.get("testId");
	if (!testId) return; // index page uses its own script

	// -------- CONFIG ----------
	// Later you will replace with your endpoint
	const SUBMIT_ENDPOINT = "https://script.google.com/macros/s/AKfycbzmLFuqpgwodMU8jcpFVuyGQHShVrgnsQP6Nuimwzg-KSgjAW7EltEdtqJE4aTbCF-pRw/exec"; // e.g. "https://script.google.com/macros/s/XXXX/exec"
	const EMP_ID_REGEX = /^[A-Z0-9_-]{4,20}$/;

	// -------- DOM ----------
	const screenGate = document.getElementById("screenGate");
	const screenIntro = document.getElementById("screenIntro");
	const screenTest = document.getElementById("screenTest");
	const screenDone = document.getElementById("screenDone");

	const employeeIdInput = document.getElementById("employeeId");
	const fullNameInput = document.getElementById("fullName");
	const empHelp = document.getElementById("empHelp");
	const nameHelp = document.getElementById("nameHelp");
	const btnContinue = document.getElementById("btnContinue");

	const introTitle = document.getElementById("introTitle");
	const introMeta = document.getElementById("introMeta");
	const introTime = document.getElementById("introTime");
	const btnStart = document.getElementById("btnStart");

	const timerPill = document.getElementById("timerPill");
	const qMeta = document.getElementById("qMeta");
	const qText = document.getElementById("qText");
	const optionsWrap = document.getElementById("optionsWrap");

	const btnPrev = document.getElementById("btnPrev");
	const btnNext = document.getElementById("btnNext");
	const btnMark = document.getElementById("btnMark");
	const markedChip = document.getElementById("markedChip");

	const navChips = document.getElementById("navChips");
	const navChipsMobile = document.getElementById("navChipsMobile");

	// modal
	const modal = document.getElementById("modal");
	const modalTitle = document.getElementById("modalTitle");
	const modalBody = document.getElementById("modalBody");
	const modalCancel = document.getElementById("modalCancel");
	const modalOk = document.getElementById("modalOk");

	// -------- STATE ----------
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
		answers: {},
		marked: []
	};

	let idx = 0;
	let timerInt = null;
	let timeLeft = 0;

	// -------- HELPERS ----------
	const show = (el) => el && el.classList.remove("hidden");
	const hide = (el) => el && el.classList.add("hidden");

	function nowIso() { return new Date().toISOString(); }

	function ensureAttemptId() {
		if (!attempt.attemptId) {
			attempt.attemptId = `att_${Date.now()}_${Math.random().toString(16).slice(2)}`;
		}
	}

	function attemptKey() {
		const who = (attempt.employeeId || identity.employeeId || "anon").toLowerCase();
		return `mcq_attempt:${testId}:${who}`;
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

	function setHelp(el, msg, isErr = false) {
		if (!el) return;
		el.textContent = msg || "";
		el.classList.toggle("err", !!isErr);
	}

	function openModal(title, body, onOk, onCancel) {
		modalTitle.textContent = title || "";
		modalBody.textContent = body || "";
		show(modal);

		const close = () => hide(modal);

		modalOk.onclick = () => {
			close();
			onOk && onOk();
		};
		modalCancel.onclick = () => {
			close();
			onCancel && onCancel();
		};
	}

	function disableAll(disabled) {
		[btnPrev, btnNext, btnMark].forEach(b => b && (b.disabled = disabled));
	}

	function escapeHtml(s) {
		return String(s).replace(/[&<>"']/g, m => ({
			"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
		}[m]));
	}

	// ✅ NEW: used to submit without preflight (CORS-safe)
	function toUrlEncoded(obj) {
		const p = new URLSearchParams();
		Object.entries(obj || {}).forEach(([k, v]) => {
			if (v && typeof v === "object") p.append(k, JSON.stringify(v));
			else p.append(k, v == null ? "" : String(v));
		});
		return p.toString();
	}

	// Keyboard shortcuts A/B/C/D
	window.addEventListener("keydown", (e) => {
		if (screenTest.classList.contains("hidden")) return;
		const key = e.key.toUpperCase();
		if (!["A", "B", "C", "D"].includes(key)) return;
		const q = currentQ();
		attempt.answers[q.id] = key;
		saveAttempt();
		renderQuestion();
	});

	function currentQ() { return test.questions[idx]; }

	function isMarked(qid) {
		return (attempt.marked || []).includes(qid);
	}

	function setTimerPill(seconds) {
		const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
		const ss = String(seconds % 60).padStart(2, "0");
		timerPill.textContent = `${mm}:${ss}`;
		timerPill.classList.toggle("critical", seconds <= 30);
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
		qText.textContent = q.question || q.text || "";

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

			let optText = "";
			if (Array.isArray(q.options)) {
				const found = q.options.find(o => String(o.key).toUpperCase() === k);
				optText = found ? (found.text || "") : "";
			} else if (q.options && typeof q.options === "object") {
				optText = q.options[k] || "";
			}

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
				renderChips(navChips);
				renderChips(navChipsMobile);
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

	function startTimer() {
		clearInterval(timerInt);

		timeLeft = Number(test.durationSeconds || 0);
		if (!Number.isFinite(timeLeft) || timeLeft <= 0) {
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

	function showSuccess(attemptId) {
		clearInterval(timerInt);
		hide(screenTest);
		hide(screenIntro);
		hide(screenGate);
		show(screenDone);

		const doneId = document.getElementById("doneAttemptId");
		if (doneId) doneId.textContent = attemptId || "";
	}

	// ✅ UPDATED: submit without CORS preflight, no duplicate fetch, preserve behavior
	async function submitAttempt(isAuto = false) {
		ensureAttemptId();
		attempt.submittedAt = nowIso();

		// compute time taken
		if (attempt.startedAt) {
			const startMs = new Date(attempt.startedAt).getTime();
			attempt.timeTakenSeconds = Math.max(0, Math.round((Date.now() - startMs) / 1000));
		} else {
			attempt.timeTakenSeconds = "";
		}

		saveAttempt(); // persist final

		const payload = {
			employeeId: attempt.employeeId || identity.employeeId || "",
			fullName: attempt.fullName || identity.fullName || "",
			testId,
			attemptId: attempt.attemptId,
			startedAt: attempt.startedAt || "",
			submittedAt: attempt.submittedAt || new Date().toISOString(),
			timeTakenSeconds: attempt.timeTakenSeconds || "",
			answers: attempt.answers || {},
			marked: attempt.marked || [],
			userAgent: navigator.userAgent,
			source: "github_pages",
			isAuto: !!isAuto
		};

		if (!SUBMIT_ENDPOINT) {
			console.log("SUBMIT PAYLOAD (no endpoint set):", payload);
			showSuccess(attempt.attemptId);
			return;
		}

		try {
			disableAll(true);

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
			openModal("Submission failed", String(e.message || e), null, null);
		}
	}

	// -------- EVENTS ----------
	btnContinue.addEventListener("click", () => {
		// normalize
		const emp = (employeeIdInput.value || "").trim().toUpperCase().replace(/\s+/g, "");
		const name = (fullNameInput.value || "").trim();

		identity.employeeId = emp;
		identity.fullName = name;

		// ✅ NEW: persist identity into attempt (required for payload)
		attempt.employeeId = emp;
		attempt.fullName = name;
		saveAttempt();

		let ok = true;
		setHelp(empHelp, "");
		setHelp(nameHelp, "");

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

		// load any in-progress attempt for this identity
		loadAttemptIfAny();

		hide(screenGate);
		show(screenIntro);
	});

	btnStart.addEventListener("click", () => {
		ensureAttemptId();
		if (!attempt.startedAt) attempt.startedAt = nowIso();
		attempt.durationSeconds = test.durationSeconds;

		saveAttempt();

		hide(screenIntro);
		show(screenTest);

		startTimer();
		renderQuestion();
		renderChips(navChips);
		renderChips(navChipsMobile);
	});

	btnPrev.addEventListener("click", () => {
		if (idx > 0) idx -= 1;
		saveAttempt();
		renderQuestion();
		renderChips(navChips);
		renderChips(navChipsMobile);
	});

	btnNext.addEventListener("click", () => {
		if (idx === test.questions.length - 1) {
			openModal(
				"Submit test?",
				"Once submitted you can't change answers.",
				() => submitAttempt(false),
				null
			);
			return;
		}
		idx += 1;
		saveAttempt();
		renderQuestion();
		renderChips(navChips);
		renderChips(navChipsMobile);
	});

	btnMark.addEventListener("click", () => {
		const qid = currentQ().id;
		attempt.marked = attempt.marked || [];
		if (isMarked(qid)) attempt.marked = attempt.marked.filter(x => x !== qid);
		else attempt.marked.push(qid);

		saveAttempt();
		renderQuestion();
		renderChips(navChips);
		renderChips(navChipsMobile);
	});

	// -------- INIT ----------
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

		show(screenGate);
		hide(screenIntro);
		hide(screenTest);
		hide(screenDone);
	})();
})();