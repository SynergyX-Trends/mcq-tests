(() => {
	const qs = new URLSearchParams(location.search);
	const testId = qs.get("testId");
	if (!testId) return; // index page uses its own script

	// -------- CONFIG ----------
	// Later you will set this to your Apps Script URL:
	const SUBMIT_ENDPOINT = "https://script.google.com/macros/s/AKfycbwajtsKc1fa_D7fAw5YwUpmAahQjhA6kzyz5Uf0nWuagjVv4Pc6Q3272l6YgwMOIBz2yQ/exec"; // e.g. "https://script.google.com/macros/s/XXXX/exec"
	const EMP_ID_REGEX = /^[A-Z0-9_-]{4,20}$/;

	// -------- DOM ----------
	const el = (id) => document.getElementById(id);

	const screenGate = el("screenGate");
	const screenIntro = el("screenIntro");
	const screenTest = el("screenTest");
	const screenReview = el("screenReview");
	const screenSuccess = el("screenSuccess");

	const hdrTitle = el("hdrTitle");
	const hdrSub = el("hdrSub");
	const timerPill = el("timerPill");

	const employeeIdInput = el("employeeId");
	const fullNameInput = el("fullName");
	const empHelp = el("empHelp");
	const nameHelp = el("nameHelp");
	const btnContinue = el("btnContinue");

	const introTitle = el("introTitle");
	const introQCount = el("introQCount");
	const introTime = el("introTime");
	const btnStart = el("btnStart");

	const navStats = el("navStats");
	const navChips = el("navChips");
	const navChipsMobile = el("navChipsMobile");

	const qMeta = el("qMeta");
	const qText = el("qText");
	const optionsWrap = el("optionsWrap");
	const markedChip = el("markedChip");

	const btnPrev = el("btnPrev");
	const btnNext = el("btnNext");
	const btnMark = el("btnMark");
	const btnClear = el("btnClear");
	const btnReview = el("btnReview");

	const progressFill = el("progressFill");
	const progressTxt = el("progressTxt");

	const revIdentity = el("revIdentity");
	const revAnswered = el("revAnswered");
	const revMarked = el("revMarked");
	const revLeft = el("revLeft");
	const revChips = el("revChips");
	const btnBackToTest = el("btnBackToTest");
	const btnFinalSubmit = el("btnFinalSubmit");

	const subId = el("subId");

	// Modal
	const modal = el("modal");
	const modalTitle = el("modalTitle");
	const modalBody = el("modalBody");
	const modalCancel = el("modalCancel");
	const modalOk = el("modalOk");

	// -------- STATE ----------
	let test = null;
	let idx = 0;
	let timerInterval = null;

	let identity = { employeeId: "", fullName: "" };

	// attempt state stored locally
	let attempt = {
		testId,
		attemptId: "",
		startedAt: null,
		submittedAt: null,
		durationSeconds: 0,
		answers: {},      // { Q1:"A" }
		marked: [],       // ["Q2"]
		currentIndex: 0
	};

	// -------- HELPERS ----------
	const show = (node) => node.classList.remove("hidden");
	const hide = (node) => node.classList.add("hidden");

	function storageKey() {
		const keyPart = (identity.employeeId || identity.fullName || "anon").toUpperCase().replace(/\s+/g, "_");
		return `mcq:${testId}:${keyPart}`;
	}

	function nowIso() {
		return new Date().toISOString();
	}

	function setHelp(node, msg, isError = false) {
		node.textContent = msg || "";
		node.classList.toggle("error", !!isError);
	}

	function formatMMSS(sec) {
		sec = Math.max(0, Math.floor(sec));
		const m = String(Math.floor(sec / 60)).padStart(2, "0");
		const s = String(sec % 60).padStart(2, "0");
		return `${m}:${s}`;
	}

	function answeredCount() {
		return Object.keys(attempt.answers).length;
	}

	function isMarked(qid) {
		return attempt.marked.includes(qid);
	}

	function toggleMarked(qid) {
		if (isMarked(qid)) attempt.marked = attempt.marked.filter(x => x !== qid);
		else attempt.marked.push(qid);
	}

	function currentQ() {
		return test.questions[idx];
	}

	function ensureAttemptId() {
		if (!attempt.attemptId) {
			const ident = (identity.employeeId || identity.fullName).toUpperCase().replace(/\s+/g, "_");
			attempt.attemptId = `${testId}_${ident}_${Date.now()}`;
		}
	}

	function saveAttempt() {
		attempt.currentIndex = idx;
		localStorage.setItem(storageKey(), JSON.stringify(attempt));
	}

	function loadAttemptIfAny() {
		const raw = localStorage.getItem(storageKey());
		if (!raw) return false;
		try {
			const parsed = JSON.parse(raw);
			// only restore if same test and not submitted
			if (parsed.testId === testId && !parsed.submittedAt) {
				attempt = { ...attempt, ...parsed };
				idx = Math.min(parsed.currentIndex || 0, test.questions.length - 1);
				return true;
			}
		} catch { }
		return false;
	}

	function setTimerPill(secondsLeft) {
		timerPill.textContent = `Time: ${formatMMSS(secondsLeft)}`;
		timerPill.classList.remove("warn", "crit");
		const pct = secondsLeft / attempt.durationSeconds;
		if (pct <= 0.05) timerPill.classList.add("crit");
		else if (pct <= 0.20) timerPill.classList.add("warn");
	}

	function secondsLeft() {
		if (!attempt.startedAt) return attempt.durationSeconds;
		const startMs = new Date(attempt.startedAt).getTime();
		const elapsed = (Date.now() - startMs) / 1000;
		return attempt.durationSeconds - elapsed;
	}

	function startTimer() {
		stopTimer();
		timerInterval = setInterval(() => {
			const left = secondsLeft();
			setTimerPill(left);

			if (left <= 0) {
				stopTimer();
				// auto-submit
				openModal(
					"Time’s up",
					"Time is over. Your attempt will be submitted now.",
					async () => {
						await submitAttempt(true);
					},
					() => { }
				);
			}
		}, 250);
	}

	function stopTimer() {
		if (timerInterval) clearInterval(timerInterval);
		timerInterval = null;
	}

	function updateProgressUI() {
		const total = test.questions.length;
		const ans = answeredCount();
		navStats.textContent = `Answered ${ans} / ${total}`;
		progressTxt.textContent = `Answered ${ans}/${total}`;
		const pct = total ? (ans / total) * 100 : 0;
		progressFill.style.width = `${pct}%`;
	}

	function renderChips(container) {
		container.innerHTML = "";
		test.questions.forEach((q, i) => {
			const b = document.createElement("button");
			b.className = "chipBtn";
			b.textContent = String(i + 1);
			if (attempt.answers[q.id]) b.classList.add("answered");
			if (i === idx) b.classList.add("current");
			if (isMarked(q.id)) b.classList.add("marked");
			b.addEventListener("click", () => {
				idx = i;
				saveAttempt();
				renderQuestion();
			});
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

		// last button changes label
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
				renderQuestion();      // re-render selection state
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

		updateProgressUI();
		renderChips(navChips);
		renderChipsRow(navChipsMobile);
	}

	function renderChipsRow(container) {
		container.innerHTML = "";
		test.questions.forEach((q, i) => {
			const b = document.createElement("button");
			b.className = "chipBtn";
			b.textContent = String(i + 1);
			if (attempt.answers[q.id]) b.classList.add("answered");
			if (i === idx) b.classList.add("current");
			if (isMarked(q.id)) b.classList.add("marked");
			b.addEventListener("click", () => {
				idx = i;
				saveAttempt();
				renderQuestion();
			});
			container.appendChild(b);
		});
	}

	function openReview() {
		hide(screenTest);
		show(screenReview);

		const total = test.questions.length;
		const ans = answeredCount();
		const marked = attempt.marked.length;
		const left = secondsLeft();

		revIdentity.textContent = `Identity: ${identity.employeeId || identity.fullName}`;
		revAnswered.textContent = `Answered: ${ans}/${total}`;
		revMarked.textContent = `Marked: ${marked}`;
		revLeft.textContent = `Time left: ${formatMMSS(left)}`;

		// review chips
		revChips.innerHTML = "";
		test.questions.forEach((q, i) => {
			const b = document.createElement("button");
			b.className = "chipBtn";
			b.textContent = String(i + 1);
			if (attempt.answers[q.id]) b.classList.add("answered");
			if (isMarked(q.id)) b.classList.add("marked");
			b.addEventListener("click", () => {
				idx = i;
				hide(screenReview);
				show(screenTest);
				renderQuestion();
			});
			revChips.appendChild(b);
		});

		saveAttempt();
	}

	function openModal(title, body, okFn, cancelFn) {
		modalTitle.textContent = title;
		modalBody.textContent = body;
		show(modal);

		const cleanup = () => {
			hide(modal);
			modalOk.onclick = null;
			modalCancel.onclick = null;
		};

		modalCancel.onclick = () => { cleanup(); cancelFn && cancelFn(); };
		modalOk.onclick = async () => {
			cleanup();
			if (okFn) await okFn();
		};
	}

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

		// Prepare payload (no correct answers needed here)
		const payload = {
			employeeId: attempt.employeeId || identity.employeeId || "",
			fullName: attempt.fullName || identity.fullName || "",
			testId,
			startedAt: attempt.startedAt || "",
			submittedAt: attempt.submittedAt || new Date().toISOString(),
			timeTakenSeconds: attempt.timeTakenSeconds || "",
			answers: attempt.answers || {},
			marked: attempt.marked || [],
			userAgent: navigator.userAgent,
			source: "github_pages"
		};

		// If endpoint not configured yet, just show success and log payload
		if (!SUBMIT_ENDPOINT) {
			console.log("SUBMIT PAYLOAD (no endpoint set):", payload);
			showSuccess(payload.attemptId);
			return;
		}

		// POST to Apps Script
		try {
			disableAll(true);
			const res = await fetch(SUBMIT_ENDPOINT, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload)
			});

			try {
				disableAll(true);

				const res = await fetch(SUBMIT_ENDPOINT, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload)
				});

				const txt = await res.text();
				let data = null;
				try { data = JSON.parse(txt); } catch { }

				if (!res.ok || (data && data.ok === false)) {
					const msg = (data && data.error) ? data.error : `HTTP ${res.status}`;
					throw new Error(msg);
				}

				console.log("Submit response:", data || txt);

				// optional: you can show score later if you add UI fields
				// e.g. data.percentage, data.correctCount, etc.

				showSuccess(attempt.attemptId);

			} catch (e) {
				console.error(e);
				disableAll(false);
				openModal("Submission failed", String(e.message || e), null, null);
			}
		} catch (e) {
			console.error(e);
			disableAll(false);
			openModal("Submission failed", "Network error. Try again.", null, null);
		}
	}

	function showSuccess(id) {
		stopTimer();
		hide(screenGate); hide(screenIntro); hide(screenTest); hide(screenReview);
		show(screenSuccess);
		subId.textContent = id || "-";
	}

	function disableAll(disabled) {
		document.querySelectorAll("button, input").forEach(x => x.disabled = disabled);
	}

	function escapeHtml(s) {
		return String(s).replace(/[&<>"']/g, m => ({
			"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
		}[m]));
	}

	// ---- JSON compatibility helpers (supports both schemas) ----
	function getQuestionText(q) {
		return (q && (q.text ?? q.question)) || "";
	}

	function getOptionText(q, key) {
		if (!q || !q.options) return "";

		// Schema A: options is an object map {A:"",B:"",C:"",D:""}
		if (!Array.isArray(q.options)) {
			return q.options[key] || "";
		}

		// Schema B: options is an array [{key:"A", text:"..."}, ...]
		const found = q.options.find(o => String(o.key).toUpperCase() === key);
		return found ? (found.text || "") : "";
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

	// -------- EVENTS ----------
	btnContinue.addEventListener("click", () => {
		// normalize
		const emp = (employeeIdInput.value || "").trim().toUpperCase().replace(/\s+/g, "");
		const name = (fullNameInput.value || "").trim();

		identity.employeeId = emp;
		identity.fullName = name;
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
	});

	btnPrev.addEventListener("click", () => {
		if (idx > 0) idx -= 1;
		saveAttempt();
		renderQuestion();
	});

	btnNext.addEventListener("click", () => {
		if (idx === test.questions.length - 1) {
			openReview();
			return;
		}
		idx = Math.min(test.questions.length - 1, idx + 1);
		saveAttempt();
		renderQuestion();
	});

	btnMark.addEventListener("click", () => {
		const q = currentQ();
		toggleMarked(q.id);
		saveAttempt();
		renderQuestion();
	});

	btnClear.addEventListener("click", () => {
		const q = currentQ();
		delete attempt.answers[q.id];
		saveAttempt();
		renderQuestion();
		updateProgressUI();
	});

	btnReview.addEventListener("click", openReview);

	btnBackToTest.addEventListener("click", () => {
		hide(screenReview);
		show(screenTest);
		renderQuestion();
	});

	btnFinalSubmit.addEventListener("click", async () => {
		const total = test.questions.length;
		const ans = answeredCount();
		const unans = total - ans;

		if (unans > 0) {
			openModal(
				"Confirm submission",
				`You have ${unans} unanswered questions. Submit anyway?`,
				async () => submitAttempt(false),
				() => { }
			);
		} else {
			await submitAttempt(false);
		}
	});

	// -------- INIT ----------
	(async function init() {
		// Load test JSON
		const res = await fetch(`../data/${testId}.json`, { cache: "no-store" });
		test = await res.json();

		// ---- Meta fallback from tests.json (duration/title) ----
		if (!test.title || typeof test.durationSeconds !== "number") {
			try {
				const metaRes = await fetch(`../data/tests.json`, { cache: "no-store" });
				const all = await metaRes.json();
				const meta = Array.isArray(all) ? all.find(t => t.testId === testId) : null;

				if (meta) {
					if (!test.title) test.title = meta.title;
					if (typeof test.durationSeconds !== "number") test.durationSeconds = meta.durationSeconds;
				}
			} catch (e) {
				// keep going; UI will still work, time may not
			}
		}

		// Hard fallback if still missing (prevents NaN)
		if (typeof test.durationSeconds !== "number") {
			test.durationSeconds = (test.questions?.length >= 20) ? 1200 : 900;
		}

		hdrTitle.textContent = "Sylvi MCQ";
		hdrSub.textContent = `${test.title} • ${test.questions.length} questions`;

		introTitle.textContent = test.title;
		introQCount.textContent = `Questions: ${test.questions.length}`;
		introTime.textContent = `Time: ${Math.round(test.durationSeconds / 60)} min`;

		// Default timer pill (not started)
		attempt.durationSeconds = test.durationSeconds;
		setTimerPill(test.durationSeconds);

		// Show gate first
		show(screenGate);
		hide(screenIntro); hide(screenTest); hide(screenReview); hide(screenSuccess);
	})();
})();