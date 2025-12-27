// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}



let db, auth, user;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-triage-app';


//  指定傷患變數：將此變數設為 0-53 的數字即可強制出現該傷患 (設為 null 則為隨機)
window.debugCaseID = null;
// --- VARIABLES & AUDIO ---
const TOTAL_PATIENTS_STANDARD = 15;
let pc = 0, cp = {}, go = true, difficulty = null, scoreRecords = [], timerInterval = null, startTime = 0, stepHistory = [], currentTourniquetDecision = false, timeLimit = 120000;
let arcadeScore = 0, patientsCompletedInArcade = 0, playerName = "Player";
const ARCADE_INITIAL_TIME = 60000, ARCADE_TIME_DROP = 10000, ARCADE_DROP_INTERVAL = 5, ARCADE_MIN_TIME = 5000;
let selectedMode = null;

// --- MODIFIED AUDIO SETUP (Single mp3) ---
let audioCtx = null; // 保留給音效使用 (SFX)
let isMuted = false;
// BGM 設定：直接讀取 bgm.mp3
const bgmAudio = new Audio('PIC/bgm.mp3');
bgmAudio.loop = true; // 設定循環播放

// --- AUDIO RESUME LOGIC (MOBILE FIX) ---
// 觸控時恢復音效引擎並嘗試播放 BGM
document.addEventListener('touchstart', function () {
    if (audioCtx && audioCtx.state === 'suspended' && !isMuted) {
        audioCtx.resume();
    }
    // 如果 BGM 暫停中且遊戲進行中，嘗試播放
    if (!isMuted && difficulty !== null && bgmAudio.paused) {
        bgmAudio.play().catch(e => console.log("BGM resume on touch failed", e));
    }
}, { passive: true });

document.addEventListener('click', function () {
    if (audioCtx && audioCtx.state === 'suspended' && !isMuted) {
        audioCtx.resume();
    }
    if (!isMuted && difficulty !== null && bgmAudio.paused) {
        bgmAudio.play().catch(e => console.log("BGM resume on click failed", e));
    }
});

// 頁面切換 (Tab 切換) 時暫停/恢復
document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        // 頁面隱藏時暫停
        if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
        bgmAudio.pause();
    } else {
        // 頁面顯示時恢復
        if (audioCtx && audioCtx.state === 'suspended' && !isMuted) audioCtx.resume();
        // 如果不在靜音狀態且遊戲正在進行，恢復播放
        if (!isMuted && difficulty !== null) {
            bgmAudio.play().catch(e => console.log("BGM auto-resume failed", e));
        }
    }
});

// 音效開關控制
window.toggleAudio = function () {
    isMuted = !isMuted;
    const btnIcon = document.getElementById('audio-icon');
    if (isMuted) {
        btnIcon.className = 'fa-solid fa-volume-xmark text-red-500 text-xl';
        if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
        bgmAudio.pause();
    } else {
        btnIcon.className = 'fa-solid fa-volume-high text-gray-700 text-xl';
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        // 只有在已選擇難度(遊戲中)才開始播放
        if (difficulty !== null) {
            bgmAudio.play().catch(e => console.log("Toggle play failed", e));
        }
    }
}

// 風格切換 (因為只有一首音樂，此功能改為隱藏按鈕)
window.toggleMusicStyle = function () {
    const btn = document.getElementById('music-style-btn');
    if (btn) btn.classList.add('hidden');
}

function initAudio() {
    if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    if (audioCtx.state === 'suspended' && !isMuted) audioCtx.resume();
}

// 播放背景音樂 (取代原本的 Sequencer)
function playBGM() {
    if (isMuted) return;
    // 確保風格按鈕隱藏
    const btn = document.getElementById('music-style-btn');
    if (btn) btn.classList.add('hidden');

    bgmAudio.play().catch(e => console.warn("BGM Play failed (waiting for interaction):", e));
}

// 停止背景音樂
function stopBGM() {
    bgmAudio.pause();
    bgmAudio.currentTime = 0; // 重置到開頭
}

function playVictorySound() { if (isMuted || !audioCtx) return; playCorrectSound(); }
function playCorrectSound() { if (isMuted || !audioCtx) return; const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(523.25, audioCtx.currentTime); o.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.1); g.gain.setValueAtTime(0.1, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3); o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.3); }
function playErrorSound() { if (isMuted || !audioCtx) return; const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(150, audioCtx.currentTime); o.frequency.linearRampToValueAtTime(80, audioCtx.currentTime + 0.4); g.gain.setValueAtTime(0.2, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4); o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.4); }
function playGameStartSound() { if (isMuted || !audioCtx) return; const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(220, audioCtx.currentTime); o.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.6); g.gain.setValueAtTime(0.1, audioCtx.currentTime); g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.6); o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.6); }

// --- DOM REFERENCES ---
const tg = { RED: { en: "Immediately", zh: "危急", class: "red-bg", color: 'red' }, YELLOW: { en: "Delayed", zh: "次緊急", class: "yellow-bg", color: 'yellow' }, GREEN: { en: "Minor", zh: "輕傷", class: "green-bg", color: 'green' }, BLACK: { en: "Deceased - Deceased / Expectant", zh: "死亡", class: "black-bg", color: 'black' } };
const buttonTextConfig = {
    "btn-bleed-tourniquet": { full: { en: "Apply Tourniquet", zh: "使用止血帶 → 繼續評估" }, clean: { en: "Apply Tourniquet", zh: "使用止血帶" } }, "btn-bleed-none": { full: { en: "No Tourniquet", zh: "不使用止血帶 → 繼續評估" }, clean: { en: "No Tourniquet", zh: "不使用止血帶" } }, "btn-amb-can": { full: { en: "Minor", zh: "輕傷" }, clean: { en: "Minor", zh: "輕傷" } }, "btn-amb-cannot": { full: { en: "Assess Further", zh: "繼續評估" }, clean: { en: "Assess Further", zh: "繼續評估" } }, "btn-resp-absent": { full: { en: "Open Airway", zh: "暢通呼吸道" }, clean: { en: "Open Airway", zh: "暢通呼吸道" } }, "btn-resp-fast": { full: { en: "Abnormal (>30 or <10)", zh: "過快(>30/min)或過慢(<10/min) → 最終確認" }, clean: { en: "Abnormal", zh: "異常" } }, "btn-resp-normal": { full: { en: "Normal (10-30/min)", zh: "正常 → 繼續 P" }, clean: { en: "Normal", zh: "正常" } }, "btn-perf-absent": { full: { en: "Absent Pulse / CRT > 2s", zh: "無脈搏或 CRT > 2秒 → 最終確認" }, clean: { en: "Absent / Slow", zh: "無脈搏/充填慢" } }, "btn-perf-present": { full: { en: "Present Pulse / CRT ≤ 2s", zh: "有脈搏且 CRT ≤ 2秒 → 繼續 M" }, clean: { en: "Present / Normal", zh: "有脈搏 / 充填正常" } }, "btn-ment-cannot": { full: { en: "Cannot Follow Commands", zh: "無法遵從指令 → 最終確認" }, clean: { en: "Cannot Follow", zh: "無法遵從指令" } }, "btn-ment-can": { full: { en: "Can Follow Commands", zh: "可遵從指令 → 最終確認" }, clean: { en: "Can Follow", zh: "可遵從指令" } },
    //--- 這裡是 JumpSTART 相關按鈕 ---
    "btn-js-check-pulse": { full: { en: "Check Pulse", zh: "檢查脈搏" }, clean: { en: "Check Pulse", zh: "檢查脈搏" } }, "btn-js-mark-black-1": { full: { en: "Deceased", zh: "死亡" }, clean: { en: "Deceased", zh: "死亡" } }, "btn-js-rescue-breaths": { full: { en: "Give 5 Rescue Breaths", zh: "給予 5 次吹氣" }, clean: { en: "5 Breaths", zh: "給予吹氣" } }, "btn-js-mark-black-2": { full: { en: " Immediately ", zh: "危急" }, clean: { en: "Deceased", zh: "死亡" } }
};

const pcE = document.getElementById('patient-card'), mT = document.getElementById('main-title'), sc = document.getElementById('status-container'), sd = document.getElementById('status-display'), pnd = document.getElementById('patient-number'), trd = document.getElementById('triage-result'), rrD = document.getElementById('resp-rate'), rrZN = document.getElementById('resp-rate-zh-note'), wtsd = document.getElementById('walk-test-status'), aa = document.getElementById('airway-action'), ame = document.getElementById('airway-message-en'), amz = document.getElementById('airway-message-zh'), npb = document.getElementById('next-patient-btn'), fcd = document.getElementById('final-classification'), scoreSummaryEl = document.getElementById('score-summary'), btnBack = document.getElementById('btn-back-step'), triageCard = document.querySelector('.triage-card');
const rc = document.getElementById('resp-container'), pC = document.getElementById('pulse-container'), mC = document.getElementById('mental-container'), timerDisplay = document.getElementById('triage-timer'), difficultyInfo = document.getElementById('difficulty-info'), newIncidentBtn = document.getElementById('new-incident-btn');
const st = { bleeding: document.getElementById('step-bleeding'), ambulatory: document.getElementById('step-ambulatory'), respiration: document.getElementById('step-respiration'), perfusion: document.getElementById('step-perfusion'), mental: document.getElementById('step-mental'), finalChoice: document.getElementById('step-final-choice'), conclusion: document.getElementById('step-conclusion'), jumpStartPulse: document.getElementById('step-jumpstart-check-pulse'), jumpStartBreaths: document.getElementById('step-jumpstart-rescue-breaths') };

// --- TOURNIQUET LOGIC ---
const tqModal = document.getElementById('tourniquet-modal');
const tqBackdrop = document.getElementById('tourniquet-backdrop');
const tqArm = document.getElementById('tq-arm');
const tqDevice = document.getElementById('tq-device');
const tqWindlass = document.getElementById('tq-windlass');
const tqWound = document.getElementById('tq-wound');
const tqWoundInner = document.getElementById('tq-wound-inner');
const tqBloodDripsContainer = document.getElementById('tq-blood-drips-container');
const tqApplyBtn = document.getElementById('tq-apply-btn');
const tqBtnText = document.getElementById('tq-btn-text');
const tqPositionText = document.getElementById('tq-position-text');
const tqPositionIndicator = document.getElementById('tq-position-indicator');
const tqProgressBar = document.getElementById('tq-progress-bar');
const tqInstruction = document.getElementById('tq-instruction');

const WOUND_POS_PERCENT = 60;
const SAFE_ZONE_MARGIN = 5;
let tq_tourniquetPosPercent = 80;
let tq_isApplying = false;
let tq_isDragging = false;
let tq_isLocked = false;
let tq_progress = 0;
let tq_animationFrame;
let tq_noiseNode, tq_gainNode, tq_filterNode;

function tq_createNoiseBuffer() {
    if (!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
    return buffer;
}

function tq_playBindSound() {
    if (!audioCtx) initAudio();
    if (tq_noiseNode) try { tq_noiseNode.stop(); } catch (e) { }
    const buffer = tq_createNoiseBuffer();
    tq_noiseNode = audioCtx.createBufferSource();
    tq_noiseNode.buffer = buffer; tq_noiseNode.loop = true;
    tq_filterNode = audioCtx.createBiquadFilter();
    tq_filterNode.type = 'bandpass'; tq_filterNode.Q.value = 1; tq_filterNode.frequency.value = 400;
    tq_gainNode = audioCtx.createGain(); tq_gainNode.gain.value = 0.0;
    tq_noiseNode.connect(tq_filterNode); tq_filterNode.connect(tq_gainNode); tq_gainNode.connect(audioCtx.destination);
    tq_noiseNode.start();
    tq_gainNode.gain.setTargetAtTime(0.5, audioCtx.currentTime, 0.05);
    tq_filterNode.frequency.setValueAtTime(400, audioCtx.currentTime);
    tq_filterNode.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
    tq_filterNode.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 0.2);
}

function tq_stopBindSound() {
    if (tq_gainNode && audioCtx) {
        tq_gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
        setTimeout(() => { if (tq_noiseNode) { try { tq_noiseNode.stop(); } catch (e) { } tq_noiseNode = null; } }, 100);
    }
}

function tq_updateTourniquetPosition(clientY) {
    if (tq_isLocked) return;
    const armRect = tqArm.getBoundingClientRect();
    let relativeY = clientY - armRect.top;
    let percent = (relativeY / armRect.height) * 100;
    percent = Math.max(5, Math.min(95, percent));
    tq_tourniquetPosPercent = percent;
    tqDevice.style.top = `${percent}%`;
    tq_checkPositionValidity(percent);
}

function tq_checkPositionValidity(percent) {
    let isValid = false; let message = ""; let colorClass = "text-red-400"; let indicatorColor = "bg-red-500";
    if (percent > WOUND_POS_PERCENT) { message = "位置錯誤 (在傷口下方)"; }
    else if (percent > WOUND_POS_PERCENT - SAFE_ZONE_MARGIN) { message = "位置錯誤 (壓在傷口上)"; colorClass = "text-yellow-400"; indicatorColor = "bg-yellow-500"; }
    else { isValid = true; message = "位置正確 (近心端)"; colorClass = "text-green-400"; indicatorColor = "bg-green-500"; }
    tqPositionText.textContent = message;
    tqPositionText.className = `text-sm font-bold ${colorClass}`;
    tqPositionIndicator.className = `w-3 h-3 rounded-full ${indicatorColor}`;
    if (isValid) {
        tqApplyBtn.disabled = false;
        tqApplyBtn.classList.remove('bg-gray-600', 'text-gray-400');
        tqApplyBtn.classList.add('bg-red-600', 'hover:bg-red-700', 'text-white');
        tqBtnText.textContent = "開始止血 (長按)";
        tqInstruction.textContent = "位置正確，請按住按鈕鎖緊";
    } else {
        tqApplyBtn.disabled = true;
        tqApplyBtn.classList.add('bg-gray-600', 'text-gray-400');
        tqApplyBtn.classList.remove('bg-red-600', 'hover:bg-red-700', 'text-white');
        tqBtnText.textContent = "位置無效";
        tqInstruction.textContent = "請將止血帶往上拖曳離傷口5-8cm";
    }
}

function tq_updateProgress() {
    if (!tq_isApplying) return;
    tq_progress += 1.5;
    tqProgressBar.style.width = `${Math.min(tq_progress, 100)}%`;
    if (tq_progress > 5) {
        tqDevice.style.transform = `translate(-50%, -50%) scaleX(${1 - (tq_progress * 0.001)})`;
        const rotation = tq_progress * 8.1;
        tqWindlass.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
        if (!tq_isLocked) {
            tq_isLocked = true;
            tqDevice.classList.remove('cursor-grab', 'cursor-grabbing');
            tqDevice.style.cursor = 'not-allowed';
            tqInstruction.textContent = "正在鎖緊...";
        }
        const intensity = Math.max(0, 1 - tq_progress / 100);
        tqBloodDripsContainer.style.opacity = intensity;
        tqBloodDripsContainer.style.transform = `scale(${0.4 + (intensity * 0.6)})`;
        const dripDuration = 1.2 + (tq_progress / 100) * 3;
        const drips = tqBloodDripsContainer.getElementsByClassName('tq-blood-drip');
        for (let drip of drips) { drip.style.animationDuration = `${dripDuration}s`; }
    }
    if (tq_filterNode && audioCtx) {
        const randomFreq = 800 + Math.random() * 500;
        tq_filterNode.frequency.setTargetAtTime(randomFreq, audioCtx.currentTime, 0.1);
    }
    if (tq_progress >= 100) {
        tq_completeTourniquet();
    } else {
        tq_animationFrame = requestAnimationFrame(tq_updateProgress);
    }
}

function tq_completeTourniquet() {
    tq_isApplying = false;
    tq_stopBindSound();
    playCorrectSound();
    tqApplyBtn.disabled = true;
    tqBtnText.textContent = "止血完成";
    tqApplyBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
    tqApplyBtn.classList.add('bg-green-600', 'cursor-default');
    tqPositionText.textContent = "處置成功";
    tqPositionText.className = "text-xl font-bold text-green-400 tq-success-flash";
    tqPositionIndicator.style.display = 'none';
    tqArm.classList.remove('tq-bleeding');
    tqWoundInner.classList.remove('animate-pulse');
    tqWound.style.opacity = '0.5'; tqWound.style.filter = 'grayscale(50%)';
    tqBloodDripsContainer.style.opacity = '0'; tqBloodDripsContainer.style.display = 'none';
    tqWindlass.style.transform = 'translate(-50%, -50%) rotate(810deg)';
    tqInstruction.textContent = "已成功止血";

    // Close modal and proceed after delay
    setTimeout(() => {
        closeTourniquetModal();
        proceedFromBleeding();
    }, 1500);
}

// Tourniquet Event Listeners
const tqStartDrag = (e) => {
    if (tq_isLocked) return;
    tq_isDragging = true;
    tqDevice.classList.add('cursor-grabbing'); tqDevice.classList.remove('cursor-grab');
    if (e.type === 'touchstart') e.preventDefault();
};
const tqDoDrag = (e) => {
    if (!tq_isDragging || tq_isLocked) return;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    tq_updateTourniquetPosition(clientY);
};
const tqEndDrag = () => {
    tq_isDragging = false;
    tqDevice.classList.remove('cursor-grabbing'); tqDevice.classList.add('cursor-grab');
};
const tqStartApply = (e) => {
    if (e.type === 'touchstart') e.preventDefault();
    if (tqApplyBtn.disabled || tq_progress >= 100) return;
    initAudio(); tq_isApplying = true; tq_playBindSound(); tq_updateProgress();
};
const tqStopApply = (e) => {
    if (e.type === 'touchend') e.preventDefault();
    if (tq_progress >= 100) return;
    tq_isApplying = false; tq_stopBindSound(); cancelAnimationFrame(tq_animationFrame);
    if (tq_progress > 0) tqInstruction.textContent = "壓力不足，請繼續按住";
};

// --- GAME LOGIC (Main) ---
function formatTime(ms) { const s = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(s / 60), sec = s % 60; return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`; }

window.onCardClick = function (mode, cardEl) {
    if (selectedMode === mode && cardEl.classList.contains('flipped')) {
        if (mode === 'arcade') {
            const nameInput = document.getElementById('player-name');
            if (!nameInput.value.trim()) { nameInput.focus(); nameInput.classList.add('ring-4', 'ring-red-500', 'bg-red-50'); setTimeout(() => nameInput.classList.remove('ring-4', 'ring-red-500', 'bg-red-50'), 500); return; }
        }
        playGameStartSound(); cardEl.classList.remove('flipped');
        const frontFace = cardEl.querySelector('.flip-card-front');
        const clone = frontFace.cloneNode(true);
        const rect = frontFace.getBoundingClientRect();
        clone.style.left = rect.left + 'px'; clone.style.top = rect.top + 'px'; clone.style.width = rect.width + 'px'; clone.style.height = rect.height + 'px';
        clone.classList.add('card-clone-animating'); clone.style.transform = ''; document.body.appendChild(clone);
        requestAnimationFrame(() => {
            clone.style.left = '50%'; clone.style.top = '50%'; clone.style.transform = 'translate(-50%, -50%) scale(1.5)'; clone.style.animation = 'flash-white 0.8s ease-in-out';
            setTimeout(() => { clone.style.opacity = '0'; clone.style.transform = 'translate(-50%, -50%) scale(3)'; setTimeout(() => { clone.remove(); startWithEffect(); }, 200); }, 800);
        });
        return;
    }
    document.querySelectorAll('.flip-card').forEach(c => { if (c !== cardEl) c.classList.remove('flipped'); });
    cardEl.classList.add('flipped'); selectedMode = mode; setDifficulty(mode, null);
}

window.setDifficulty = function (level, clickedButton) {
    difficulty = level; arcadeScore = 0; patientsCompletedInArcade = 0; document.getElementById('arcade-score-container').classList.add('hidden');
    document.getElementById('music-style-btn').classList.remove('hidden');
    const nc = document.getElementById('arcade-name-container');
    if (level === 'arcade') { nc.classList.remove('hidden'); setTimeout(() => document.getElementById('player-name').focus(), 300); } else { nc.classList.add('hidden'); }
    if (level === 'beginner') { timeLimit = 120000; difficultyInfo.innerHTML = '<span class="bilingual-en text-green-700 font-bold">Beginner Mode: Color-coded. 2 mins/patient.</span><span class="bilingual-zh block mt-1 text-green-700">初學者模式：按鈕顏色提示。限時2分鐘。</span>'; }
    else if (level === 'pro') { timeLimit = 60000; difficultyInfo.innerHTML = '<span class="bilingual-en text-yellow-700 font-bold">Professional Mode: Grayscale. 1 min/patient.</span><span class="bilingual-zh block mt-1 text-yellow-700">專業人員模式：灰階按鈕。限時1分鐘。</span>'; }
    else if (level === 'master') { timeLimit = 30000; difficultyInfo.innerHTML = '<span class="bilingual-en text-red-700 font-bold">Master Mode: No hints. 30 sec/patient.</span><span class="bilingual-zh block mt-1 text-red-700">大師級模式：無提示。限時30秒。</span>'; }
    else if (level === 'arcade') { timeLimit = ARCADE_INITIAL_TIME; difficultyInfo.innerHTML = '<span class="bilingual-en text-gray-800 font-bold">Arcade Mode: Unlimited patients. Time decreases.</span><span class="bilingual-zh block mt-1 text-gray-800">街機模式：無限病患，時間遞減。</span>'; }
    applyDifficultyStyles(level); if (!isMuted) playBGM();
};

function applyDifficultyStyles(level) {
    const allC = ['bg-green-500', 'hover:bg-green-600', 'hover:bg-green-700', 'bg-red-500', 'hover:bg-red-600', 'bg-gray-400', 'hover:bg-gray-500', 'bg-yellow-500', 'hover:bg-yellow-600', 'yellow-red-split', 'red-black-split', 'bg-indigo-600', 'hover:bg-indigo-700'];
    const bCM = [{ id: 'btn-bleed-tourniquet', c: ['bg-gray-600', 'hover:bg-gray-700'] }, { id: 'btn-bleed-none', c: ['bg-gray-600', 'hover:bg-gray-700'] }, { id: 'btn-amb-can', c: ['bg-green-500', 'hover:bg-green-600'] }, { id: 'btn-amb-cannot', c: [] }, { id: 'btn-resp-absent', c: ['red-black-split'] }, { id: 'btn-resp-fast', c: ['bg-red-500', 'hover:bg-red-600'] }, { id: 'btn-resp-normal', c: ['yellow-red-split'] }, { id: 'btn-perf-absent', c: ['bg-red-500', 'hover:bg-red-600'] }, { id: 'btn-perf-present', c: ['yellow-red-split'] }, { id: 'btn-ment-cannot', c: ['bg-red-500', 'hover:bg-red-600'] }, { id: 'btn-ment-can', c: ['bg-yellow-500', 'hover:bg-yellow-600'] }, { id: 'btn-js-check-pulse', c: ['bg-green-500', 'hover:bg-green-600'] }, { id: 'btn-js-mark-black-1', c: ['bg-gray-900', 'hover:bg-black', 'text-white'] }, { id: 'btn-js-rescue-breaths', c: ['bg-white', 'hover:bg-gray-100'] }, { id: 'btn-js-mark-black-2', c: ['bg-red-500', 'hover:bg-red-600', 'text-white'] }];
    const uM = (level === 'master' || level === 'arcade'), uP = (level === 'pro');
    Object.values(st).forEach(s => {
        if (!s) return;
        s.querySelectorAll('.action-button:not(.rpm-button)').forEach(btn => {
            const bId = btn.id; btn.classList.remove(...allC, 'pro-mode-button');
            //   btn-js-mark-black-2 加入排除清單 (isEx)，防止它在專業/大師模式變灰
            const isEx = (btn.classList.contains('final-triage-button') || bId === 'btn-amb-can' || bId === 'btn-js-mark-black-1' || bId === 'btn-js-mark-black-2' || bId === 'btn-js-rescue-breaths' || bId === 'btn-js-check-pulse');
            if (!isEx) {
                if (uP || uM) btn.classList.add('pro-mode-button');
                else { const ce = bCM.find(e => e.id === bId); if (ce) btn.classList.add(...ce.c); }
            }
            else {
                if (bId === 'btn-amb-can') btn.classList.add('bg-green-500', 'hover:bg-green-600');
                if (bId === 'btn-js-mark-black-1') btn.classList.add('bg-black', 'hover:bg-gray-900', 'text-white');
                if (bId === 'btn-js-mark-black-2') btn.classList.add('bg-red-500', 'hover:bg-red-600', 'text-white');

                // ：檢查脈搏與給予吹氣按鈕 (設定為白底、深黑字)
                // 必須移除 text-white，否則檢查脈搏按鈕會因 HTML 預設樣式而變成白底白字
                if (bId === 'btn-js-rescue-breaths' || bId === 'btn-js-check-pulse') {
                    btn.classList.remove('text-white');
                    btn.classList.add('bg-white', 'hover:bg-gray-100', 'text-gray-900', 'border-2', 'border-gray-300');
                }
            }


            if (bId && buttonTextConfig[bId]) {
                const c = buttonTextConfig[bId], td = uM ? c.clean : c.full;
                //綠色按鈕
                if (bId === 'btn-amb-can') {
                    if (!btn.classList.contains('flex')) btn.classList.add('flex', 'flex-row', 'items-center', 'justify-center', 'gap-3');
                    btn.innerHTML = `<div class="text-center"><span class="bilingual-en">${td.en}</span><span class="bilingual-zh block">${td.zh}</span></div><img src="PIC/green.png" alt="Green Status" class="h-12 w-auto object-contain rounded">`;
                }
                // [新增修改] 黑色按鈕 1 (JumpSTART Deceased 1) - 加入圖片
                else if (bId === 'btn-js-mark-black-1') {
                    if (!btn.classList.contains('flex')) btn.classList.add('flex', 'flex-row', 'items-center', 'justify-center', 'gap-3');
                    btn.innerHTML = `<div class="text-center"><span class="bilingual-en">${td.en}</span><span class="bilingual-zh block">${td.zh}</span></div><img src="PIC/black1.png" alt="Black Status" class="h-12 w-auto object-contain">`;
                }
                // 紅色按鈕: 這裡修復圖片不顯示的問題：明確寫入 img 標籤
                else if (bId === 'btn-js-mark-black-2') {
                    if (!btn.classList.contains('flex')) btn.classList.add('flex', 'flex-row', 'items-center', 'justify-center', 'gap-3');
                    btn.innerHTML = `<div class="text-center"><span class="bilingual-en">${td.en}</span><span class="bilingual-zh block">${td.zh}</span></div><img src="PIC/red1.png" alt="Red Status" class="h-12 w-auto object-contain">`;
                } else { btn.innerHTML = `<span class="bilingual-en">${td.en}</span><span class="bilingual-zh block">${td.zh}</span>`; }
            }
        });
        const rpm = s.querySelector('.rpm-button');
        if (rpm && rpm.id === 'btn-amb-cannot') {
            if (uP || uM) rpm.classList.add('pro-mode-button'); else rpm.classList.remove('pro-mode-button');
            const c = buttonTextConfig['btn-amb-cannot'], td = uM ? c.clean : c.full;
            if (!rpm.classList.contains('flex')) rpm.classList.add('flex', 'flex-row', 'items-center', 'justify-center', 'gap-3');
            rpm.innerHTML = `<div class="text-center"><span class="bilingual-en">${td.en}</span><span class="bilingual-zh block">${td.zh}</span></div><img src="PIC/cantwalk.png" alt="Cannot Walk" class="h-12 w-auto object-contain rounded">`;
        }
    });
}

window.goBack = function () {
    if (stepHistory.length === 0) return; const pid = stepHistory.pop();
    Object.values(st).forEach(s => { if (s) s.classList.add('hidden') });
    const pe = document.getElementById(pid); if (pe) pe.classList.remove('hidden');
    if (pid === 'step-respiration') { st.respiration.querySelectorAll('.grid > button').forEach(b => b.disabled = false); aa.classList.add('hidden'); aa.className = "mt-4 p-3 border-l-4 hidden"; }
    if (pid === 'step-jumpstart-check-pulse') { document.getElementById('js-pulse-result').classList.add('hidden'); st.jumpStartPulse.querySelectorAll('button').forEach(b => b.disabled = false); document.getElementById('js-breath-result').classList.add('hidden'); }
    if (pid === 'step-perfusion') { st.perfusion.querySelectorAll('button').forEach(b => b.disabled = false); }
    if (pid === 'step-mental') { st.mental.querySelectorAll('button').forEach(b => b.disabled = false); }
    if (pid === 'step-respiration' || pid === 'step-jumpstart-check-pulse' || pid === 'step-jumpstart-rescue-breaths') rc.classList.remove('hidden');
    if (pid === 'step-perfusion') { pC.classList.remove('hidden'); rc.classList.add('hidden'); }
    if (pid === 'step-mental') { mC.classList.remove('hidden'); pC.classList.add('hidden'); }
    if (stepHistory.length > 0) btnBack.classList.remove('hidden'); else btnBack.classList.add('hidden');
}

window.startWithEffect = function () {
    if (difficulty === 'arcade') { const ni = document.getElementById('player-name'), v = ni.value.trim(); if (!v) { alert("請輸入救護人員姓名以開始街機模式！"); ni.focus(); ni.classList.add('border-red-500', 'ring-2', 'ring-red-200'); setTimeout(() => ni.classList.remove('border-red-500', 'ring-2', 'ring-red-200'), 2000); return; } playerName = v; }
    const ol = document.getElementById('transition-overlay'); ol.style.opacity = '1'; setTimeout(() => { si(); ol.style.opacity = '0'; }, 500);
}

function si() {
    if (!difficulty) return; window.scrollTo(0, 0); stopTimer();
    scoreRecords = []; pc = 0; go = false; mT.classList.add('hidden'); sc.classList.add('hidden'); document.getElementById('difficulty-selection').classList.add('hidden'); scoreSummaryEl.classList.add('hidden'); pcE.classList.remove('hidden'); sd.innerHTML = `<span class="bilingual-en">Incident Active</span><span class="bilingual-zh block mt-1">事件啟動</span>`; applyDifficultyStyles(difficulty);
    if (difficulty === 'arcade') { document.getElementById('arcade-game-hud').style.display = 'block'; document.getElementById('hud-score').textContent = '0'; arcadeScore = 0; } else { document.getElementById('arcade-game-hud').style.display = 'none'; }
    nP();
}

function startTimer() { stopTimer(); startTime = performance.now(); timerDisplay.textContent = formatTime(timeLimit); timerDisplay.classList.remove('text-red-800'); triageCard.classList.remove('time-up-alarm'); timerInterval = setInterval(() => { const el = performance.now() - startTime; let r = timeLimit - el; if (r < 0) r = 0; timerDisplay.textContent = formatTime(r); if (r === 0) { if (difficulty === 'arcade') { stopTimer(); window.eI(); } else { timerDisplay.classList.add('text-red-800'); triageCard.classList.add('time-up-alarm'); } } }, 100); }
function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }
function pushHistory(id) { stepHistory.push(id); if (stepHistory.length > 0) btnBack.classList.remove('hidden'); }

function gp() {


    //  支援指定傷患功能
    // 如果 window.debugCaseID 有設定數字 (0-53)，則強制使用該傷患，否則隨機產生
    // 可以在 Console 輸入 debugCaseID = 12 來測試特定案例
    const s = (typeof window.debugCaseID === 'number') ? window.debugCaseID : Math.floor(Math.random() * 57);
    pc++;

    // 原本的隨機邏輯備份：
    //const s = Math.floor(Math.random() * 57);

    let g, a, cW = false, rr = 0, pp = true, cO = true, fc = null, bleeding = false, tqReq = false, isPed = false, jsPulse = false, jsRescue = false, airwayRes = false, selAb = null, injuryText = { en: "", zh: "" };
    let isObviousDeath = false;//預設為否
    // 隨機性別與年齡生成 (共用邏輯)
    const gs = [{ en: "Male", zh: "男性" }, { en: "Female", zh: "女性" }];
    g = gs[Math.floor(Math.random() * gs.length)];
    a = Math.floor(Math.random() * 50) + 15; // 成人年齡隨機 15-65 歲
    jsPulse = Math.random() < 0.5;
    jsRescue = Math.random() < 0.5;
    airwayRes = (Math.random() < 0.5);

    switch (s) {
        // --- 原本的舊傷患資料 (0-36) ---
        case 0: cW = true; rr = 15; pp = true; cO = true; fc = tg.GREEN; injuryText = { en: "Scrapes on arms", zh: "手臂擦傷" }; break;
        case 1: cW = false; rr = 0; pp = false; cO = false; airwayRes = Math.random() < 0.5; fc = airwayRes ? tg.RED : tg.BLACK; injuryText = { en: "Unconscious, head trauma", zh: "意識不清，頭部外傷" }; break;
        case 2: cW = false; rr = 35; pp = true; cO = true; fc = tg.RED; injuryText = { en: "Chest pain, difficulty breathing", zh: "胸痛，呼吸困難" }; break;
        case 3: cW = false; rr = 15; pp = false; cO = true; fc = tg.RED; injuryText = { en: "Pale skin, weak pulse", zh: "皮膚蒼白，脈搏微弱" }; break;
        case 4: cW = false; rr = 15; pp = true; cO = false; fc = tg.RED; injuryText = { en: "Confused, head injury", zh: "意識混亂，頭部受傷" }; break;
        case 5: cW = false; rr = 15; pp = true; cO = true; fc = tg.YELLOW; injuryText = { en: "Broken leg, in pain", zh: "腿部骨折，疼痛" }; break;
        case 6: cW = false; rr = 20; pp = false; cO = true; fc = tg.RED; bleeding = true; tqReq = true; injuryText = { en: "Severed leg, massive spurting blood", zh: "腿部斷裂，大量噴濺出血" }; break;
        case 7: cW = false; rr = 32; pp = false; cO = true; fc = tg.RED; bleeding = true; tqReq = true; injuryText = { en: "Open left arm fracture, continuous massive bleeding", zh: "左手臂開放性骨折,持續大出血" }; selAb = { en: "Weak/Irregular", zh: "橈動脈微弱不規則" }; break;
        case 8: cW = false; rr = 4; pp = false; cO = false; fc = tg.RED; bleeding = true; tqReq = true; injuryText = { en: "Pants soaked with blood, active bleeding", zh: "雙腳褲子滲血，持續出血" }; selAb = { en: "Absent", zh: "橈動脈摸不到" }; break;
        case 9: cW = false; rr = 36; pp = false; cO = true; fc = tg.RED; bleeding = true; tqReq = false; injuryText = { en: "Massive neck bleeding", zh: "頸部大出血，噴濺式" }; selAb = { en: "Weak/Irregular", zh: "橈動脈微弱不規則" }; break;
        case 10: isPed = true; a = Math.floor(Math.random() * 8) + 1; cW = false; rr = 42; pp = true; cO = true; fc = tg.YELLOW; injuryText = { en: "Child, abrasions, crying", zh: "兒童，擦傷，哭鬧" }; break;
        case 11: isPed = true; a = Math.floor(Math.random() * 8) + 1; cW = false; rr = 12; pp = false; cO = false; fc = tg.RED; injuryText = { en: "Child, quiet, shallow breathing", zh: "兒童，安靜，呼吸淺快" }; break;
        case 12: isPed = true; a = Math.floor(Math.random() * 8) + 1; cW = false; rr = 0; const aw = Math.random() < 0.3, hp = Math.random() < 0.5, bw = Math.random() < 0.5; fc = aw ? tg.RED : (hp ? (bw ? tg.RED : tg.BLACK) : tg.BLACK); injuryText = { en: "Child, motionless, blue lips", zh: "兒童，無動作，嘴唇發紫" }; airwayRes = aw; jsPulse = hp; jsRescue = bw; break;
        case 13: g = { en: "Male", zh: "男性" }; a = 16; cW = true; rr = 18; pp = true; cO = true; fc = tg.GREEN; injuryText = { en: "Limb abrasions & lacerations", zh: "肢體擦傷及撕裂傷" }; break;
        case 14: g = { en: "Female", zh: "女性" }; a = 35; cW = true; rr = 18; pp = true; cO = true; fc = tg.GREEN; injuryText = { en: "Facial abrasions", zh: "臉部擦傷" }; break;
        case 15: g = { en: "Male", zh: "男性" }; cW = false; rr = 20; pp = true; cO = true; fc = tg.YELLOW; injuryText = { en: "Deformed right toe", zh: "右腳趾頭變形" }; break;
        case 16: g = { en: "Male", zh: "男性" }; cW = false; rr = 22; pp = true; cO = true; fc = tg.YELLOW; injuryText = { en: "Dizziness", zh: "眩暈" }; break;
        case 17: g = { en: "Female", zh: "女性" }; cW = false; rr = 18; pp = true; cO = true; fc = tg.YELLOW; injuryText = { en: "Weakness in both legs", zh: "雙腳無力" }; break;
        case 18: g = { en: "Female", zh: "女性" }; cW = false; rr = 20; pp = true; cO = true; fc = tg.YELLOW; injuryText = { en: "Eyes cannot open", zh: "眼睛睜不開" }; break;
        case 19: g = { en: "Female", zh: "女性" }; cW = false; rr = 36; pp = false; cO = false; fc = tg.RED; injuryText = { en: "Asymmetrical chest rise", zh: "胸部起伏不對稱" }; selAb = { en: "Absent", zh: "橈動脈摸不到" }; break;
        case 20: g = { en: "Female", zh: "女性" }; cW = false; rr = 24; pp = false; cO = true; fc = tg.RED; bleeding = true; tqReq = true; injuryText = { en: "Massive arm bleeding, pale/clammy", zh: "右手臂大量出血，臉色蒼白濕冷" }; selAb = { en: "Weak", zh: "橈動脈微弱" }; break;
        case 21: cW = false; rr = 0; airwayRes = false; pp = false; cO = false; fc = tg.BLACK; injuryText = { en: "Head deformity", zh: "頭部變形" }; break;
        case 22: isPed = true; g = { en: "Male", zh: "男性" }; a = Math.floor(Math.random() * 8) + 1; cW = true; rr = 25; pp = true; cO = true; fc = tg.GREEN; injuryText = { en: "Frightened, multiple limb hematomas", zh: "受到驚嚇，肢體多處血腫" }; break;
        case 23: isPed = true; g = { en: "Male", zh: "男性" }; a = Math.floor(Math.random() * 8) + 1; cW = true; rr = 22; pp = true; cO = true; fc = tg.GREEN; injuryText = { en: "Frightened, multiple limb hematomas", zh: "受到驚嚇，肢體多處血腫" }; break;
        case 24: isPed = true; g = { en: "Female", zh: "女性" }; a = Math.floor(Math.random() * 8) + 1; cW = false; rr = 30; pp = true; cO = true; fc = tg.YELLOW; injuryText = { en: "Crying, fussy", zh: "哭鬧" }; break;
        case 25: isPed = true; g = { en: "Male", zh: "男性" }; a = Math.floor(Math.random() * 8) + 1; cW = false; rr = 28; pp = true; cO = true; fc = tg.YELLOW; injuryText = { en: "Right ankle deformity", zh: "右腳踝變形" }; break;
        case 26: isPed = true; g = { en: "Male", zh: "男性" }; a = Math.floor(Math.random() * 8) + 1; cW = false; rr = 25; pp = true; cO = true; fc = tg.YELLOW; injuryText = { en: "Pain in both feet", zh: "雙腳疼痛" }; break;
        case 27: isPed = true; g = { en: "Male", zh: "男性" }; a = 2; cW = false; rr = 24; pp = false; cO = false; fc = tg.RED; injuryText = { en: "Apathetic, lethargic", zh: "神情冷漠、昏睡" }; selAb = { en: "Absent", zh: "橈動脈摸不到" }; break;
        case 28: isPed = true; g = { en: "Female", zh: "女性" }; a = 4; cW = false; rr = 0; airwayRes = true; pp = true; cO = false; fc = tg.RED; injuryText = { en: "Facial laceration, hematoma", zh: "臉部撕裂傷、血腫" }; selAb = { en: "Weak", zh: "橈動脈微弱" }; break;
        case 29: isPed = true; g = { en: "Male", zh: "男性" }; a = 7; cW = false; rr = 0; airwayRes = false; pp = false; cO = false; fc = tg.BLACK; injuryText = { en: "Deformity of right arm and leg", zh: "右手右腳變形" }; jsPulse = false; break;
        case 30: g = { en: "Male", zh: "男性" }; a = Math.floor(Math.random() * 40) + 18; cW = true; rr = Math.floor(Math.random() * 12) + 12; pp = true; cO = true; fc = tg.GREEN; injuryText = { en: "Minor head laceration, conscious", zh: "頭部輕微撕裂傷，意識清楚" }; break;
        case 31: g = { en: "Female", zh: "女性" }; a = Math.floor(Math.random() * 30) + 20; cW = true; rr = Math.floor(Math.random() * 10) + 14; pp = true; cO = true; fc = tg.GREEN; injuryText = { en: "Closed arm fracture", zh: "手臂閉鎖性骨折" }; break;
        case 32: g = { en: "Male", zh: "男性" }; a = Math.floor(Math.random() * 5) + 12; cW = true; rr = Math.floor(Math.random() * 10) + 18; pp = true; cO = true; fc = tg.GREEN; injuryText = { en: "Multiple limb abrasions", zh: "四肢多處擦傷" }; break;
        case 33: g = { en: "Female", zh: "女性" }; a = Math.floor(Math.random() * 20) + 20; cW = true; rr = Math.floor(Math.random() * 8) + 12; pp = true; cO = true; fc = tg.GREEN; injuryText = { en: "Ankle sprain, walking with limp", zh: "腳踝扭傷，跛行" }; break;
        case 34: g = { en: "Male", zh: "男性" }; a = Math.floor(Math.random() * 20) + 40; cW = true; rr = Math.floor(Math.random() * 10) + 16; pp = true; cO = true; fc = tg.GREEN; injuryText = { en: "Chest wall contusion, breathing okay", zh: "胸壁挫傷，呼吸正常" }; break;
        case 35: isPed = true; a = 5; cW = false; rr = 42; pp = true; cO = false; fc = tg.RED; bleeding = true; tqReq = true; injuryText = { en: "Double leg amputation, massive bleeding", zh: "雙腳截肢，地上一攤血，臉色蒼白" }; selAb = { en: "Weak", zh: "橈動脈弱" }; break;
        case 36: isPed = true; a = 7; cW = false; rr = 6; pp = false; cO = false; fc = tg.RED; bleeding = true; tqReq = false; injuryText = { en: "Massive groin hemorrhage", zh: "右大腿上方腹股溝大出血" }; selAb = { en: "Absent", zh: "橈動脈摸不到" }; break;

        // --- 新增 START 傷患 (37-52) ---

        // 新增 5 名綠色 (Green) - 能走動 (cW=true)
        case 37: cW = true; rr = Math.floor(Math.random() * 10) + 12; pp = true; cO = true; fc = tg.GREEN; injuryText = { en: "Minor wrist sprain", zh: "手腕輕微扭傷" }; break;
        case 38: cW = true; rr = Math.floor(Math.random() * 10) + 12; pp = true; cO = true; fc = tg.GREEN; injuryText = { en: "Superficial cut on forehead", zh: "前額表淺割傷" }; break;
        case 39: cW = true; rr = Math.floor(Math.random() * 10) + 12; pp = true; cO = true; fc = tg.GREEN; injuryText = { en: "Bruised shoulder, walking ok", zh: "肩膀挫傷，行走無礙" }; break;
        case 40: cW = true; rr = Math.floor(Math.random() * 10) + 12; pp = true; cO = true; fc = tg.GREEN; injuryText = { en: "Minor abrasion on elbow", zh: "手肘輕微擦傷" }; break;
        case 41: cW = true; rr = Math.floor(Math.random() * 10) + 12; pp = true; cO = true; fc = tg.GREEN; injuryText = { en: "Finger dislocation, painful", zh: "手指脫臼，疼痛" }; break;

        // 新增 5 名黃色 (Yellow) - 不能走(cW=false), R<30, P有, M可遵從(cO=true)
        case 42: cW = false; rr = 24; pp = true; cO = true; fc = tg.YELLOW; injuryText = { en: "Closed tibia fracture, pulse ok", zh: "小腿閉鎖性骨折，遠端脈搏正常" }; break;
        case 43: cW = false; rr = 22; pp = true; cO = true; fc = tg.YELLOW; injuryText = { en: "Severe ankle sprain, cannot stand", zh: "嚴重腳踝扭傷，無法站立" }; break;
        case 44: cW = false; rr = 28; pp = true; cO = true; fc = tg.YELLOW; injuryText = { en: "Large soft tissue wound on thigh", zh: "大腿大面積軟組織撕裂傷" }; break;
        case 45: cW = false; rr = 20; pp = true; cO = true; fc = tg.YELLOW; injuryText = { en: "Dislocated shoulder, severe pain", zh: "肩膀脫臼，劇痛" }; break;
        case 46: cW = false; rr = 18; pp = true; cO = true; fc = tg.YELLOW; injuryText = { en: "Back injury, lower limb numbness", zh: "背部受傷，下肢麻木" }; break;

        // 新增 3 名紅色 (Red) - 異常 R, P, 或 M
        // Red 1: 呼吸過快 (R>30)
        case 47: cW = false; rr = 35; pp = true; cO = true; fc = tg.RED; injuryText = { en: "Chest trauma, rapid shallow breathing", zh: "胸部外傷，呼吸淺快" }; break;
        // Red 2: 灌流異常 (P無/CRT>2)
        case 48: cW = false; rr = 24; pp = false; cO = true; fc = tg.RED; injuryText = { en: "Pale skin, delayed capillary refill", zh: "皮膚蒼白，微血管充填延遲" }; selAb = { en: "Weak", zh: "橈動脈微弱" }; break;
        // Red 3: 意識異常 (M不可遵從)
        case 49: cW = false; rr = 22; pp = true; cO = false; fc = tg.RED; injuryText = { en: "Head injury, confused speech", zh: "頭部外傷，胡言亂語" }; break;

        // 新增 3 名黑色 (Black) - 暢通呼吸道後仍無呼吸
        case 50: cW = false; rr = 0; airwayRes = false; pp = false; cO = false; fc = tg.BLACK; injuryText = { en: "Massive head crush injury", zh: "頭部嚴重壓砸傷" }; break;
        case 51: cW = false; rr = 0; airwayRes = false; pp = false; cO = false;
            fc = tg.BLACK; injuryText = { en: "Cyanosis", zh: "膚色發紺" };
            isObviousDeath = false;//設定為明顯死亡
            break;
        case 52: cW = false; rr = 0; airwayRes = false; pp = false; cO = false; fc = tg.BLACK; injuryText = { en: "Cardiac arrest, traumatic", zh: "創傷性心搏停止" }; break;
        case 53: cW = false; rr = 0; airwayRes = false; pp = false; cO = false;
            fc = tg.BLACK;
            injuryText = { en: "Patient found lying supine on the ground, unresponsive.", zh: "躺在地上無反應" };
            isObviousDeath = false;//設定為明顯死亡
            break;
        // Case 54: 被重物壓住胸口
        case 54: {
            isPed = true;
            a = Math.floor(Math.random() * 8) + 1;
            cW = false;
            rr = 0;
            // 隨機邏輯: 30%暢通後自呼, 50%有脈搏, 50%吹氣有效
            const aw = Math.random() < 0.3;
            const hp = Math.random() < 0.5;
            const bw = Math.random() < 0.5;
            // 判定: 暢通有效? -> 紅; 否則查脈搏(無->黑; 有->吹氣(有效->紅; 無效->黑))
            fc = aw ? tg.RED : (hp ? (bw ? tg.RED : tg.BLACK) : tg.BLACK);

            injuryText = { en: "Child, chest crushed by heavy object", zh: "兒童，被重物壓住胸口" };
            airwayRes = aw;
            jsPulse = hp;
            jsRescue = bw;
            break;
        }

        // Case 55: 躺在地上無反應
        case 55: {
            isPed = true;
            a = Math.floor(Math.random() * 8) + 1;
            cW = false;
            rr = 0;
            const aw = Math.random() < 0.3;
            const hp = Math.random() < 0.5;
            const bw = Math.random() < 0.5;
            fc = aw ? tg.RED : (hp ? (bw ? tg.RED : tg.BLACK) : tg.BLACK);

            injuryText = { en: "Child, lying on ground unresponsive", zh: "兒童，躺在地上無反應" };
            airwayRes = aw;
            jsPulse = hp;
            jsRescue = bw;
            break;
        }

        // Case 56: 膚色發紺
        case 56: {
            isPed = true;
            a = Math.floor(Math.random() * 8) + 1;
            cW = false;
            rr = 0;
            const aw = Math.random() < 0.3;
            const hp = Math.random() < 0.5;
            const bw = Math.random() < 0.5;
            fc = aw ? tg.RED : (hp ? (bw ? tg.RED : tg.BLACK) : tg.BLACK);

            injuryText = { en: "Child, cyanosis", zh: "兒童，膚色發紺" };
            airwayRes = aw;
            jsPulse = hp;
            jsRescue = bw;
            break;
        }
    }

    if (!selAb) selAb = [{ en: "Absent", zh: "橈動脈摸不到" }, { en: "Weak/Irregular", zh: "橈動脈微弱不規則" }][Math.floor(Math.random() * 2)];

    // 建立傷患物件
    cp = { id: pc, gender: g, age: a, canWalk: cW, respRate: rr, pulsePresent: pp, canObey: cO, airwayResponse: airwayRes, correctTriage: fc, abnormalPulse: selAb, massiveBleeding: bleeding, injury: injuryText, hasOpenedAirway: false, tourniquetRequired: tqReq, isPediatric: isPed, jsHasPulse: jsPulse, jsRescueEffective: jsRescue };

    currentTourniquetDecision = false;
}

function spU() {
    trd.classList.add('hidden'); npb.disabled = true; pnd.textContent = cp.id;
    document.getElementById('patient-context').innerHTML = `<span class="bilingual-en">Gender: ${cp.gender.en}, Age: ${cp.age}</span><span class="bilingual-zh block mt-1">性別: ${cp.gender.zh}, 年齡: ${cp.age}</span><div class="mt-2 pt-2 border-t border-yellow-300"><span class="font-bold bilingual-en">Injury: ${cp.injury.en}</span><span class="block mt-1 bilingual-zh">傷情: ${cp.injury.zh}</span></div>`;

    const pGi = document.getElementById('patient-gender-img'); const pCi = document.getElementById('patient-child-img'); const pMi = document.getElementById('patient-male-img');
    if (cp.isPediatric) { pCi.classList.remove('hidden'); pGi.classList.add('hidden'); pMi.classList.add('hidden'); } else { pCi.classList.add('hidden'); if (cp.gender.en === 'Female') { pGi.classList.remove('hidden'); pMi.classList.add('hidden'); } else { pGi.classList.add('hidden'); pMi.classList.remove('hidden'); } }

    const stc = 'text-gray-900';
    wtsd.innerHTML = cp.canWalk ? `<span class="bilingual-en ${stc} font-bold">Can Walk</span><span class="bilingual-zh block">能走動</span>` : `<span class="bilingual-en ${stc} font-bold">Cannot Walk</span><span class="bilingual-zh block">無法走動</span>`;
    rrZN.textContent = ''; if (cp.respRate === 0) {
        rrD.textContent = 'Absent'; rrZN.innerHTML = '<span class="text-xl font-bold text-gray-800">（無呼吸）</span>';
    } else { rrD.textContent = cp.respRate; }
    let pe, pz; if (cp.respRate === 0) { pe = "Absent"; pz = "無脈搏"; } else if (cp.pulsePresent) { pe = "Present / CRT ≤ 2s"; pz = "有脈搏 / CRT ≤ 2秒"; } else { pe = cp.abnormalPulse ? `${cp.abnormalPulse.en} / CRT > 2s` : "Absent / CRT > 2s"; pz = cp.abnormalPulse ? `${cp.abnormalPulse.zh} / CRT > 2秒` : "橈動脈摸不到 / CRT > 2秒"; }
    document.getElementById('pulse-status').innerHTML = `<span class="bilingual-en ${stc} font-bold">${pe}</span><span class="bilingual-zh block">${pz}</span>`;
    let me, mz; if (cp.respRate === 0) { me = "Unconscious"; mz = "無意識"; } else if (cp.canObey) { me = "Can Obey"; mz = "可遵從指令"; } else { me = "Cannot Obey"; mz = "無法遵從指令"; }
    document.getElementById('mental-status-display').innerHTML = `<span class="bilingual-en ${stc} font-bold">${me}</span><span class="bilingual-zh block">${mz}</span>`;
    rc.classList.add('hidden'); pC.classList.add('hidden'); mC.classList.add('hidden');
    Object.values(st).forEach(s => { if (s) s.classList.add('hidden') }); aa.classList.add('hidden'); ame.textContent = ''; amz.textContent = ''; document.getElementById('js-pulse-result').classList.add('hidden'); document.getElementById('js-breath-result').classList.add('hidden');
    Object.values(st).forEach(s => { if (s) s.querySelectorAll('button').forEach(b => { b.disabled = false }) });
    st.ambulatory.classList.remove('hidden'); triageCard.classList.remove('time-up-alarm'); window.scrollTo(0, 0); stepHistory = [];
    if (stepHistory.length > 0) btnBack.classList.remove('hidden'); else btnBack.classList.add('hidden');
    const bf = document.getElementById('btn-resp-fast'), bn = document.getElementById('btn-resp-normal'), uM = (difficulty === 'master' || difficulty === 'arcade');
    if (cp.isPediatric) { if (!uM) { bf.innerHTML = `<span class="bilingual-en">Abnormal (>45 or <14)</span><span class="bilingual-zh block">過快(>45)或過慢(<14)</span>`; bn.innerHTML = `<span class="bilingual-en">Normal (14-45)</span><span class="bilingual-zh block">正常 (14-45)</span>`; } else { bf.innerHTML = `<span class="bilingual-en">Abnormal</span><span class="bilingual-zh block">異常</span>`; bn.innerHTML = `<span class="bilingual-en">Normal</span><span class="bilingual-zh block">正常</span>`; } }
    else { if (!uM) { bf.innerHTML = `<span class="bilingual-en">Abnormal (>30 or <10)</span><span class="bilingual-zh block">過快(>30)或過慢(<10)</span>`; bn.innerHTML = `<span class="bilingual-en">Normal (10-30)</span><span class="bilingual-zh block">正常 (10-30)</span>`; } else { bf.innerHTML = `<span class="bilingual-en">Abnormal</span><span class="bilingual-zh block">異常</span>`; bn.innerHTML = `<span class="bilingual-en">Normal</span><span class="bilingual-zh block">正常</span>`; } }
    startTimer();
}

window.checkAmbulatory = function (cw, b) { if (b) b.blur(); st.ambulatory.classList.add('hidden'); if (cw) { window.finalizeTriage('GREEN'); } else { pushHistory('step-ambulatory'); rc.classList.add('hidden'); st.bleeding.classList.remove('hidden'); st.bleeding.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }

function openTourniquetModal() {
    tqModal.style.display = 'flex';
    tqBackdrop.style.display = 'block';

    // Reset State
    tq_isApplying = false; tq_isDragging = false; tq_isLocked = false; tq_progress = 0;
    tq_tourniquetPosPercent = 80;

    // Reset UI
    tqDevice.style.top = '80%';
    tqDevice.style.transform = 'translate(-50%, -50%)';
    tqDevice.classList.remove('cursor-grabbing'); tqDevice.classList.add('cursor-grab'); tqDevice.style.cursor = '';
    tqWindlass.style.transform = 'translate(-50%, -50%) rotate(0deg)';
    tqProgressBar.style.width = '0%';

    tqArm.classList.add('tq-bleeding');
    tqWoundInner.classList.add('animate-pulse');
    tqWound.style.opacity = '1'; tqWound.style.filter = 'none';
    tqBloodDripsContainer.style.opacity = '1'; tqBloodDripsContainer.style.display = 'block'; tqBloodDripsContainer.style.transform = 'none';

    const drips = tqBloodDripsContainer.getElementsByClassName('tq-blood-drip');
    for (let drip of drips) { drip.style.animationDuration = '1.2s'; }

    tq_checkPositionValidity(80);

    // Bind events
    tqDevice.addEventListener('mousedown', tqStartDrag); tqDevice.addEventListener('touchstart', tqStartDrag);
    window.addEventListener('mousemove', tqDoDrag); window.addEventListener('touchmove', tqDoDrag);
    window.addEventListener('mouseup', tqEndDrag); window.addEventListener('touchend', tqEndDrag);
    tqApplyBtn.addEventListener('mousedown', tqStartApply); tqApplyBtn.addEventListener('touchstart', tqStartApply);
    tqApplyBtn.addEventListener('mouseup', tqStopApply); tqApplyBtn.addEventListener('mouseleave', tqStopApply); tqApplyBtn.addEventListener('touchend', tqStopApply);
}

function closeTourniquetModal() {
    tqModal.style.display = 'none';
    tqBackdrop.style.display = 'none';

    // Unbind events to save resources
    tqDevice.removeEventListener('mousedown', tqStartDrag); tqDevice.removeEventListener('touchstart', tqStartDrag);
    window.removeEventListener('mousemove', tqDoDrag); window.removeEventListener('touchmove', tqDoDrag);
    window.removeEventListener('mouseup', tqEndDrag); window.removeEventListener('touchend', tqEndDrag);
    tqApplyBtn.removeEventListener('mousedown', tqStartApply); tqApplyBtn.removeEventListener('touchstart', tqStartApply);
    tqApplyBtn.removeEventListener('mouseup', tqStopApply); tqApplyBtn.removeEventListener('mouseleave', tqStopApply); tqApplyBtn.removeEventListener('touchend', tqStopApply);
}

window.checkBleeding = function (tq, b) {
    if (b) b.blur();
    const buttons = st.bleeding.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = true);
    currentTourniquetDecision = tq;

    if (tq) {
        // 1. Play original animation
        const animImg = document.createElement('img');
        animImg.src = "PIC/tone.png";
        animImg.style.position = "fixed";
        animImg.style.top = "50%"; animImg.style.left = "50%";
        animImg.style.transform = "translate(-50%, -50%) scale(0)";
        animImg.style.width = "33vw"; animImg.style.zIndex = "10000";
        animImg.style.transition = "transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease-in 0.5s";
        animImg.style.opacity = "1"; animImg.style.pointerEvents = "none";
        animImg.className = "shadow-2xl rounded-xl";
        document.body.appendChild(animImg);
        requestAnimationFrame(() => { animImg.style.transform = "translate(-50%, -50%) scale(1)"; });

        setTimeout(() => { animImg.style.opacity = "0"; }, 700);
        setTimeout(() => {
            if (animImg.parentNode) animImg.parentNode.removeChild(animImg);
            // 2. Open Tourniquet Simulator instead of proceeding immediately
            openTourniquetModal();
        }, 1000);
    } else {
        proceedFromBleeding();
    }
}

// Global scope needed for Tourniquet logic to call back
window.proceedFromBleeding = function () {
    pushHistory('step-bleeding');
    st.bleeding.classList.add('hidden');
    rc.classList.remove('hidden');
    st.respiration.classList.remove('hidden');
    st.respiration.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const buttons = st.bleeding.querySelectorAll('button');
    buttons.forEach(btn => btn.disabled = false);
}

window.checkRespiration = function (v, b) {
    if (b) b.blur(); st.respiration.querySelectorAll('.grid > button').forEach(x => x.disabled = true);
    if (v === 0) {
        cp.hasOpenedAirway = true; pushHistory('step-respiration'); aa.classList.remove('hidden'); aa.className = "mt-4 p-3 border-l-4";
        const uA = (difficulty !== 'beginner'), ab = cp.respRate > 0, as = (cp.respRate === 0 && cp.airwayResponse);
        if (ab) { playErrorSound(); aa.classList.add('bg-red-100', 'text-red-700', 'border-red-500'); ame.innerHTML = '<span class="font-bold">PROCEDURAL ERROR</span>'; amz.innerHTML = '<span class="text-xl font-bold">程序錯誤：傷患已有呼吸。</span>'; st.finalChoice.classList.remove('hidden'); st.finalChoice.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        else if (as) { if (uA) { aa.classList.add('bg-gray-100', 'text-gray-800', 'border-gray-500'); ame.innerHTML = 'Breathing detected.'; amz.innerHTML = '<span class="text-xl font-bold">有呼吸。</span>'; } else { aa.classList.add('bg-green-100', 'text-green-700', 'border-green-500'); ame.innerHTML = 'Breathing started.'; amz.innerHTML = '<span class="text-xl font-bold">呼吸恢復。</span>'; } st.finalChoice.classList.remove('hidden'); st.finalChoice.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        else { if (uA) { aa.classList.add('bg-gray-100', 'text-gray-800', 'border-gray-500'); ame.innerHTML = 'Still no breathing.'; amz.innerHTML = '<span class="text-xl font-bold"> 仍無呼吸。</span>'; } else { aa.classList.add('bg-red-100', 'text-red-700', 'border-red-500'); ame.innerHTML = 'Still no breathing.'; amz.innerHTML = '<span class="text-xl font-bold">仍無呼吸。</span>'; } if (cp.isPediatric) { st.jumpStartPulse.classList.remove('hidden'); st.jumpStartPulse.scrollIntoView({ behavior: 'smooth', block: 'center' }); } else { st.finalChoice.classList.remove('hidden'); st.finalChoice.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }
    } else if (v > 30) { pushHistory('step-respiration'); st.finalChoice.classList.remove('hidden'); st.finalChoice.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    else { pushHistory('step-respiration'); st.respiration.classList.add('hidden'); rc.classList.add('hidden'); pC.classList.remove('hidden'); st.perfusion.classList.remove('hidden'); st.perfusion.querySelectorAll('button').forEach(x => x.disabled = false); st.perfusion.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}
window.onCheckPulse = function (b) {
    if (b) b.blur(); b.parentElement.querySelectorAll('button').forEach(x => x.disabled = true); pushHistory('step-jumpstart-check-pulse'); document.getElementById('js-pulse-result').classList.remove('hidden');
    if (cp.jsHasPulse) {
        document.getElementById('js-pulse-text').textContent = "Pulse Present (有脈搏)";
        document.getElementById('js-pulse-text').className = "font-bold text-lg mb-3 text-center text-green-600"; document.getElementById('js-pulse-options').classList.remove('hidden'); st.finalChoice.classList.add('hidden');
        //明確定義 opts 變數，修復 undefined 錯誤
        const opts = document.getElementById('js-pulse-options');
        opts.classList.remove('hidden');
        st.finalChoice.classList.add('hidden');
        // 畫面自動捲動到新出現的選項按鈕
        opts.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } else { document.getElementById('js-pulse-text').textContent = "Pulse Absent (無脈搏)"; document.getElementById('js-pulse-text').className = "font-bold text-lg mb-3 text-center text-red-600"; document.getElementById('js-pulse-options').classList.add('hidden'); st.finalChoice.classList.remove('hidden'); st.finalChoice.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}
window.onRescueBreaths = function (b) { if (b) b.blur(); b.parentElement.querySelectorAll('button').forEach(x => x.disabled = true); pushHistory('step-jumpstart-rescue-breaths'); document.getElementById('js-breath-result').classList.remove('hidden'); let mE = "", mZ = "", c = ""; if (cp.jsRescueEffective) { mE = "Breathing started."; mZ = "恢復呼吸。"; c = "text-green-800 bg-green-100 border-green-500"; } else { mE = "Still no breathing."; mZ = "仍無呼吸。"; c = "text-red-800 bg-red-100 border-red-500"; } document.getElementById('js-breath-text').innerHTML = `<span class="bilingual-en block">${mE}</span><span class="bilingual-zh block">${mZ}</span>`; document.getElementById('js-breath-result').className = `mt-3 p-3 border-l-4 rounded ${c}`; st.finalChoice.classList.remove('hidden'); st.finalChoice.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
window.onMarkBlackSkip = function (b) { if (b) b.blur(); window.finalizeTriage('BLACK', null, { en: "PROCEDURAL ERROR: Check pulse first.", zh: "程序錯誤：需先檢查脈搏" }); }
window.onMarkBlackFinal = function (b) { if (b) b.blur(); window.finalizeTriage('BLACK', null, { en: "PROCEDURAL ERROR: Must attempt breaths.", zh: "程序錯誤：需嘗試吹氣" }); }
window.checkPerfusion = function (bad, b) { if (b) b.blur(); if (bad) { pushHistory('step-perfusion'); st.perfusion.querySelectorAll('button').forEach(x => x.disabled = true); st.finalChoice.classList.remove('hidden'); st.finalChoice.scrollIntoView({ behavior: 'smooth', block: 'center' }); } else { pushHistory('step-perfusion'); st.perfusion.classList.add('hidden'); pC.classList.add('hidden'); mC.classList.remove('hidden'); st.mental.classList.remove('hidden'); st.mental.querySelectorAll('button').forEach(x => x.disabled = false); st.mental.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
window.checkMental = function (bad, b) { if (b) b.blur(); pushHistory('step-mental'); st.mental.classList.add('hidden'); st.finalChoice.classList.remove('hidden'); st.finalChoice.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

function nP() {
    if (difficulty !== 'arcade' && pc >= TOTAL_PATIENTS_STANDARD) { window.eI(); return; }
    if (difficulty === 'arcade') { patientsCompletedInArcade++; if (patientsCompletedInArcade > 0 && patientsCompletedInArcade % ARCADE_DROP_INTERVAL === 0) timeLimit = Math.max(ARCADE_MIN_TIME, timeLimit - ARCADE_TIME_DROP); }
    gp(); spU();
}
window.nextPatient = nP;

window.finalizeTriage = function (k, b, fail) {
    if (b) b.blur(); Object.values(st).forEach(s => { if (s) s.classList.add('hidden') });
    let isCorrect = false; const chosenCat = tg[k];
    if (fail) { isCorrect = false; playErrorSound(); } else { st.finalChoice.classList.add('hidden'); let ok = chosenCat === cp.correctTriage; if (cp.respRate === 0 && !cp.hasOpenedAirway && !cp.isObviousDeath) { ok = false; fail = { en: "PROCEDURAL ERROR: Airway not opened.", zh: "程序錯誤：未執行暢通呼吸道。" }; } if (ok) playCorrectSound(); else playErrorSound(); isCorrect = ok; }
    if (difficulty === 'arcade') { const pts = isCorrect ? 100 : -200; arcadeScore += pts; document.getElementById('hud-score').textContent = arcadeScore; document.getElementById('arcade-game-hud').classList.remove('score-pop'); void document.getElementById('arcade-game-hud').offsetWidth; document.getElementById('arcade-game-hud').classList.add('score-pop'); }
    scoreRecords.push({ triageTimeMs: performance.now() - startTime, correctCategory: cp.correctTriage, chosenCategory: chosenCat, isCorrect: isCorrect, bleedingPresent: cp.massiveBleeding, tourniquetApplied: currentTourniquetDecision, tourniquetRequired: cp.tourniquetRequired, respRate: cp.respRate, airwayOpened: cp.hasOpenedAirway, isObviousDeath: cp.isObviousDeath });
    stR(chosenCat, isCorrect, performance.now() - startTime, fail);
}

function stR(c, ok, t, fail) {
    stopTimer(); triageCard.classList.remove('time-up-alarm'); const dt = formatTime(t);
    let fc = ok ? 'bg-green-100 border-green-500 text-green-700' : 'bg-red-100 border-red-500 text-red-700', ft = '';
    if (fail) { ft = `<span class="bilingual-en block font-bold text-red-800">${fail.en} (Time: ${dt})</span><span class="bilingual-zh block font-bold text-red-800">❌ ${fail.zh} (用時: ${dt})</span>`; }
    else if (ok) { ft = `<span class="bilingual-en block">CORRECT: Category is ${c.en.split(' - ')[0]}. (Time: ${dt})</span><span class="bilingual-zh block">✅ 正確：分類為 ${c.zh.split('(')[0]}。(用時: ${dt})</span>`; }
    else { ft = `<span class="bilingual-en block">INCORRECT: Correct is ${cp.correctTriage.en.split(' - ')[0]}. You chose ${c.en.split(' - ')[0]}. (Time: ${dt})</span><span class="bilingual-zh block">❌ 錯誤：正確分類是 ${cp.correctTriage.zh.split('(')[0]}。您選擇了 ${c.zh.split('(')[0]}。(用時: ${dt})</span>`; }
    trd.classList.remove('hidden', 'red-bg', 'yellow-bg', 'green-bg', 'black-bg'); trd.classList.add(c.class);
    trd.innerHTML = `<span class="bilingual-en">${c.en.split(' - ')[0]}</span><span class="bilingual-zh block">${c.zh.split('(')[0]}</span>`;
    fcd.innerHTML = `<div class="${fc} p-3 rounded-lg border-l-4 font-bold text-lg">${ft}</div>`;
    rc.classList.remove('hidden'); pC.classList.remove('hidden'); mC.classList.remove('hidden');
    st.conclusion.classList.remove('hidden'); npb.disabled = false; btnBack.classList.add('hidden'); fcd.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

window.eI = function () {
    stopTimer();
    playVictorySound();
    go = true;
    document.getElementById('arcade-game-hud').style.display = 'none';

    //  隱藏檢傷卡片 (原本的檢傷畫面)，避免重疊顯示
    if (typeof pcE !== 'undefined' && pcE) {
        pcE.classList.add('hidden');
    } else {
        const card = document.getElementById('patient-card');
        if (card) card.classList.add('hidden');
    }

    // 關鍵修正：呼叫 renderScoreSummary 來計算並顯示數據
    renderScoreSummary();

    if (difficulty === 'arcade') {
        // 修正：原本呼叫 saveLeaderboard，改為呼叫您定義的 saveScore
        if (typeof window.saveScore === 'function') {
            window.saveScore(playerName, arcadeScore);
        }
        // 修正：原本呼叫 showLeaderboard，改為呼叫您定義的 loadLeaderboard
        if (typeof window.loadLeaderboard === 'function') {
            window.loadLeaderboard();
        }
    } else {
        const lbContainer = document.getElementById('leaderboard-container');
        if (lbContainer) lbContainer.classList.add('hidden');
    }

    // 顯示狀態容器
    sc.classList.remove('hidden');
    sd.innerHTML = `<span class="bilingual-en">Incident Over.</span><span class="bilingual-zh block mt-1">事件結束。共完成 ${scoreRecords.length} 人。</span>`;

    // 禁用按鈕與隱藏音樂切換
    const newIncidentBtn = document.getElementById('new-incident-btn');
    if (newIncidentBtn) newIncidentBtn.disabled = true;

    const musicBtn = document.getElementById('music-style-btn');
    if (musicBtn) musicBtn.classList.add('hidden');
}



function renderScoreSummary() {
    const summaryEl = document.getElementById('score-summary');
    if (!summaryEl) return;

    // 關鍵修正：移除 hidden 讓結算畫面顯示出來
    summaryEl.classList.remove('hidden');

    // 計算基本數據
    const total = scoreRecords.length;
    const correct = scoreRecords.filter(r => r.isCorrect).length;
    const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100);

    const totalTime = scoreRecords.reduce((acc, r) => acc + r.triageTimeMs, 0);
    const avgTime = total === 0 ? 0 : totalTime / total;

    // 更新 UI 文字
    const elTotal = document.getElementById('summary-total-patients');
    if (elTotal) elTotal.textContent = total;

    const elAcc = document.getElementById('summary-overall-accuracy');
    if (elAcc) elAcc.textContent = `${accuracy}%`;

    const elTime = document.getElementById('summary-total-time');
    if (elTime) elTime.textContent = formatTime(totalTime);

    const elAvg = document.getElementById('summary-avg-time');
    if (elAvg) elAvg.textContent = formatTime(avgTime);

    // 顯示街機模式分數
    if (difficulty === 'arcade') {
        const arcadeContainer = document.getElementById('arcade-score-container');
        if (arcadeContainer) arcadeContainer.classList.remove('hidden');
        const elScore = document.getElementById('arcade-final-score');
        if (elScore) elScore.textContent = arcadeScore;
    }

    // 統計詳細數據：止血帶 (Bleeding Control)
    const bleedingCases = scoreRecords.filter(r => r.bleedingPresent).length;
    const tqCorrect = scoreRecords.filter(r => r.bleedingPresent && r.tourniquetApplied).length;
    const tqMissed = scoreRecords.filter(r => r.bleedingPresent && !r.tourniquetApplied).length;
    const tqWrong = scoreRecords.filter(r => !r.bleedingPresent && r.tourniquetApplied).length;

    updateText('summary-bleeding-total', bleedingCases);
    updateText('summary-tq-correct', tqCorrect);
    updateText('summary-tq-missed', tqMissed);
    updateText('summary-tq-wrong', tqWrong);

    // 統計詳細數據：呼吸道 (Airway)
    // 定義：原本無呼吸(respRate==0) 且非明顯死亡(isObviousDeath!=true) 的才算需要處置的氣道問題
    const airwayCases = scoreRecords.filter(r => r.respRate === 0 && !r.isObviousDeath).length;
    const airwayCorrect = scoreRecords.filter(r => r.respRate === 0 && !r.isObviousDeath && r.airwayOpened).length;
    const airwayMissed = scoreRecords.filter(r => r.respRate === 0 && !r.isObviousDeath && !r.airwayOpened).length;
    // 簡單定義誤用：有呼吸卻執行暢通呼吸道
    const airwayWrong = scoreRecords.filter(r => r.respRate > 0 && r.airwayOpened).length;

    updateText('summary-airway-total', airwayCases);
    updateText('summary-airway-correct', airwayCorrect);
    updateText('summary-airway-missed', airwayMissed);
    updateText('summary-airway-wrong', airwayWrong);

    // 生成分類統計表格
    const tbody = document.getElementById('summary-table-body');
    if (tbody) {
        tbody.innerHTML = '';
        // 確保 tg 物件存在 (通常在 Script.js上方已定義)
        if (typeof tg !== 'undefined') {
            const categories = [tg.RED, tg.YELLOW, tg.GREEN, tg.BLACK];
            categories.forEach(cat => {
                const catName = cat.en.split(' - ')[0]; // 取簡短名稱
                const catTotal = scoreRecords.filter(r => r.correctCategory === cat).length;
                const catCorrect = scoreRecords.filter(r => r.correctCategory === cat && r.isCorrect).length;
                const catAcc = catTotal === 0 ? 0 : Math.round((catCorrect / catTotal) * 100);

                // 設定顏色樣式
                let colorClass = 'text-gray-900';
                if (cat.color === 'red') colorClass = 'text-red-600';
                else if (cat.color === 'yellow') colorClass = 'text-yellow-600';
                else if (cat.color === 'green') colorClass = 'text-green-600';

                const row = `
                    <tr>
                        <td class="px-4 py-3 whitespace-nowrap text-sm font-bold ${colorClass}">
                            ${catName}
                        </td>
                        <td class="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">${catTotal}</td>
                        <td class="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">${catCorrect}</td>
                        <td class="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">${catAcc}%</td>
                    </tr>
                `;
                tbody.insertAdjacentHTML('beforeend', row);
            });
        }
    }
}

// 輔助函式：安全更新文字
function updateText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

window.saveScore = async function (name, score, accuracy) {
    console.log("排行榜功能已停用 (Firebase removed)");
    return;
};

window.loadLeaderboard = async function () {
    console.log("排行榜功能已停用 (Firebase removed)");
    const list = document.getElementById('leaderboard-list');
    if (list) list.innerHTML = '<li class="text-center text-gray-500">排行榜功能已關閉</li>';
};
/*  重新開始遊戲功能
* 負責重置所有變數與 UI 狀態，返回主選單
*/
window.resetGame = function () {
    stopTimer();
    pc = 0;
    scoreRecords = [];
    difficulty = null;
    arcadeScore = 0;
    patientsCompletedInArcade = 0;

    window.scrollTo(0, 0);

    // 隱藏結算與遊戲畫面
    const summaryEl = document.getElementById('score-summary');
    if (summaryEl) summaryEl.classList.add('hidden');

    // 確保檢傷卡片隱藏
    const pcE = document.getElementById('patient-card');
    if (pcE) pcE.classList.add('hidden');

    const sc = document.getElementById('status-container');
    if (sc) sc.classList.add('hidden');

    // 顯示主選單與標題
    const mT = document.getElementById('main-title');
    if (mT) mT.classList.remove('hidden');

    const diffSel = document.getElementById('difficulty-selection');
    if (diffSel) diffSel.classList.remove('hidden');

    // 重置其他 UI 狀態
    const arcadeHud = document.getElementById('arcade-game-hud');
    if (arcadeHud) arcadeHud.style.display = 'none';

    const nameContainer = document.getElementById('arcade-name-container');
    if (nameContainer) nameContainer.classList.add('hidden');

    const newIncidentBtn = document.getElementById('new-incident-btn');
    if (newIncidentBtn) newIncidentBtn.disabled = true;

    // 重置卡片翻轉效果
    document.querySelectorAll('.flip-card').forEach(c => c.classList.remove('flipped'));

    // 播放背景音樂 (如果沒靜音)
    if (typeof isMuted !== 'undefined' && !isMuted && typeof playBGM === 'function') {
        playBGM();
    }
};
// --- 初始化設定 ---
window.onload = function () {
    window.scrollTo(0, 0);
    stopTimer();
    pc = 0;
    scoreRecords = [];
    difficulty = null;
    timerDisplay.textContent = '00:00';
    arcadeScore = 0;
    patientsCompletedInArcade = 0;
    timeLimit = 120000;

    // 隱藏排行榜與相關介面
    const arcadeContainer = document.getElementById('arcade-score-container');
    if (arcadeContainer) arcadeContainer.classList.add('hidden');

    const leaderboardContainer = document.getElementById('leaderboard-container');
    if (leaderboardContainer) leaderboardContainer.classList.add('hidden');

    const arcadeHud = document.getElementById('arcade-game-hud');
    if (arcadeHud) arcadeHud.style.display = 'none';

    selectedMode = null;

    document.querySelectorAll('.flip-card').forEach(c => c.classList.remove('flipped'));

    if (mT) mT.classList.remove('hidden');
    const diffSel = document.getElementById('difficulty-selection');
    if (diffSel) diffSel.classList.remove('hidden');

    if (scoreSummaryEl) scoreSummaryEl.classList.add('hidden');
    if (pcE) pcE.classList.add('hidden');
    if (sc) sc.classList.add('hidden');
    if (newIncidentBtn) newIncidentBtn.disabled = true;

    const nameContainer = document.getElementById('arcade-name-container');
    if (nameContainer) nameContainer.classList.add('hidden');

    const playerName = document.getElementById('player-name');
    if (playerName) playerName.value = '';

    if (triageCard) triageCard.classList.remove('time-up-alarm');

    const musicBtn = document.getElementById('music-style-btn');
    if (musicBtn) musicBtn.classList.add('hidden');

    if (!isMuted) playBGM();
};
window.toggleQRCode = () => { const c = document.getElementById('qrcode-display'), d = document.getElementById('qrcode'); if (c.classList.contains('hidden')) { c.classList.remove('hidden'); d.innerHTML = ""; new QRCode(d, { text: window.location.href, width: 128, height: 128 }); } else { c.classList.add('hidden'); } };

window.toggleChangeLog = () => { const c = document.getElementById('changelog-content'); c.classList.toggle('hidden'); };
