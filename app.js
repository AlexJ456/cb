document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app-content');
    const canvas = document.getElementById('box-canvas');
    const container = document.querySelector('.container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const state = {
        isPlaying: false,
        phase: 0, // 0: inhale, 1: exhale
        startTime: null,
        phaseStartTime: null,
        totalTime: 0,
        soundEnabled: false,
        timeLimit: '',
        sessionComplete: false
    };

    let wakeLock = null;
    let audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const icons = {
        play: `<svg class="icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
        pause: `<svg class="icon" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
        volume2: `<svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
        volumeX: `<svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`,
        rotateCcw: `<svg class="icon" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`,
        clock: `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`
    };

    function getInstruction(phase) {
        return phase === 0 ? 'Inhale' : 'Exhale';
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function playTone() {
        if (state.soundEnabled && audioContext) {
            try {
                const oscillator = audioContext.createOscillator();
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
                oscillator.connect(audioContext.destination);
                oscillator.start();
                oscillator.stop(audioContext.currentTime + 0.1);
            } catch (e) {
                console.error('Error playing tone:', e);
            }
        }
    }

    let animationFrameId;

    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake lock is active');
            } catch (err) {
                console.error('Failed to acquire wake lock:', err);
            }
        } else {
            console.log('Wake Lock API not supported');
        }
    }

    function releaseWakeLock() {
        if (wakeLock !== null) {
            wakeLock.release()
                .then(() => {
                    wakeLock = null;
                    console.log('Wake lock released');
                })
                .catch(err => {
                    console.error('Failed to release wake lock:', err);
                });
        }
    }

    function togglePlay() {
        state.isPlaying = !state.isPlaying;
        if (state.isPlaying) {
            if (audioContext && audioContext.state === 'suspended') {
                audioContext.resume().then(() => {
                    console.log('AudioContext resumed');
                });
            }
            state.phase = 0;
            state.startTime = performance.now();
            state.phaseStartTime = performance.now();
            state.totalTime = 0;
            state.sessionComplete = false;
            playTone();
            startPhase();
            animate();
            requestWakeLock();
        } else {
            cancelAnimationFrame(animationFrameId);
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            releaseWakeLock();
        }
        render();
    }

    function startPhase() {
        if (!state.isPlaying) return;
        playTone();
        state.phaseStartTime = performance.now();
        setTimeout(() => {
            if (!state.isPlaying) return;
            const currentTime = performance.now();
            state.totalTime = Math.floor((currentTime - state.startTime) / 1000);
            if (state.timeLimit && state.totalTime >= parseInt(state.timeLimit) * 60 && state.phase === 1) {
                state.sessionComplete = true;
                state.isPlaying = false;
                cancelAnimationFrame(animationFrameId);
                releaseWakeLock();
                render();
            } else {
                state.phase = (state.phase + 1) % 2;
                startPhase();
            }
        }, 5500);
    }

    function animate() {
        if (!state.isPlaying) return;
        const ctx = canvas.getContext('2d');
        const currentTime = performance.now();
        const elapsed = (currentTime - state.phaseStartTime) / 1000;
        const progress = Math.min(1, elapsed / 5.5);
        const x = canvas.width / 2;
        const yTop = 50;
        const yBottom = canvas.height - 50;
        let y;
        if (state.phase === 0) { // inhale
            y = yBottom - progress * (yBottom - yTop);
        } else { // exhale
            y = yTop + progress * (yBottom - yTop);
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw thicker line
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x, yTop);
        ctx.lineTo(x, yBottom);
        ctx.stroke();
        // Draw bigger dot
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, 2 * Math.PI);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
        updateUI();
        animationFrameId = requestAnimationFrame(animate);
    }

    function updateUI() {
        if (!state.isPlaying) return;
        const currentTime = performance.now();
        state.totalTime = Math.floor((currentTime - state.startTime) / 1000);
        const timerEl = document.getElementById('timer');
        const instructionEl = document.getElementById('instruction');
        const countdownEl = document.getElementById('countdown');
        if (timerEl) timerEl.textContent = `Total Time: ${formatTime(state.totalTime)}`;
        if (instructionEl) instructionEl.textContent = getInstruction(state.phase);
        const elapsedPhase = (currentTime - state.phaseStartTime) / 1000;
        const remaining = Math.max(0, 5.5 - elapsedPhase);
        if (countdownEl) countdownEl.textContent = remaining.toFixed(1);
    }

    function resetToStart() {
        state.isPlaying = false;
        state.phase = 0;
        state.startTime = null;
        state.phaseStartTime = null;
        state.totalTime = 0;
        state.sessionComplete = false;
        state.timeLimit = '';
        cancelAnimationFrame(animationFrameId);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        releaseWakeLock();
        render();
    }

    function toggleSound() {
        state.soundEnabled = !state.soundEnabled;
        render();
    }

    function handleTimeLimitChange(e) {
        state.timeLimit = e.target.value.replace(/[^0-9]/g, '');
    }

    function startWithPreset(minutes) {
        state.timeLimit = minutes.toString();
        state.isPlaying = true;
        state.phase = 0;
        state.startTime = performance.now();
        state.phaseStartTime = performance.now();
        state.totalTime = 0;
        state.sessionComplete = false;
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('AudioContext resumed');
            });
        }
        playTone();
        startPhase();
        animate();
        requestWakeLock();
        render();
    }

    function render() {
        let html = `
            <h1>Coherent Breathing</h1>
        `;
        if (state.isPlaying) {
            html += `
                <div id="timer">Total Time: ${formatTime(state.totalTime)}</div>
                <div id="instruction">${getInstruction(state.phase)}</div>
                <div id="countdown">${(5.5).toFixed(1)}</div>
            `;
        }
        if (!state.isPlaying && !state.sessionComplete) {
            html += `
                <div class="settings">
                    <div class="form-group">
                        <label class="switch">
                            <input type="checkbox" id="sound-toggle" ${state.soundEnabled ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                        <label for="sound-toggle">
                            ${state.soundEnabled ? icons.volume2 : icons.volumeX}
                            Sound ${state.soundEnabled ? 'On' : 'Off'}
                        </label>
                    </div>
                    <div class="form-group">
                        <input
                            type="number"
                            inputmode="numeric"
                            placeholder="Time limit (minutes)"
                            value="${state.timeLimit}"
                            id="time-limit"
                            step="1"
                            min="0"
                        >
                        <label for="time-limit">Minutes (optional)</label>
                    </div>
                </div>
                <div class="prompt">Press start to begin</div>
            `;
        }
        if (state.sessionComplete) {
            html += `<div class="complete">Complete!</div>`;
        }
        if (!state.sessionComplete) {
            html += `
                <button id="toggle-play">
                    ${state.isPlaying ? icons.pause : icons.play}
                    ${state.isPlaying ? 'Pause' : 'Start'}
                </button>
            `;
        }
        if (state.sessionComplete) {
            html += `
                <button id="reset">
                    ${icons.rotateCcw}
                    Back to Start
                </button>
            `;
        }
        if (!state.isPlaying && !state.sessionComplete) {
            html += `
                <div class="shortcut-buttons">
                    <button id="preset-2min" class="preset-button">
                        ${icons.clock} 2 min
                    </button>
                    <button id="preset-5min" class="preset-button">
                        ${icons.clock} 5 min
                    </button>
                    <button id="preset-10min" class="preset-button">
                        ${icons.clock} 10 min
                    </button>
                </div>
            `;
        }
        app.innerHTML = html;

        if (!state.sessionComplete) {
            document.getElementById('toggle-play').addEventListener('click', togglePlay);
        }
        if (state.sessionComplete) {
            document.getElementById('reset').addEventListener('click', resetToStart);
        }
        if (!state.isPlaying && !state.sessionComplete) {
            document.getElementById('sound-toggle').addEventListener('change', toggleSound);
            const timeLimitInput = document.getElementById('time-limit');
            timeLimitInput.addEventListener('input', handleTimeLimitChange);
            document.getElementById('preset-2min').addEventListener('click', () => startWithPreset(2));
            document.getElementById('preset-5min').addEventListener('click', () => startWithPreset(5));
            document.getElementById('preset-10min').addEventListener('click', () => startWithPreset(10));
        }
    }

    render();
});
