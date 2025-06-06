document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app-content');
    const canvas = document.getElementById('breathing-canvas');
    
    const PHASE_DURATION = 5.5; // Fixed phase duration in seconds
    const INTERVAL_TIME = 500; // 500ms updates

    const state = {
        isPlaying: false,
        count: 0, // 0: inhale, 1: exhale
        totalTime: 0,
        soundEnabled: false,
        timeLimit: '',
        sessionComplete: false,
        timeLimitReached: false,
        phaseDuration: PHASE_DURATION,
        phaseStartTime: null,
        startTime: null,
        pulseStartTime: null
    };

    let wakeLock = null;
    let audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let interval, animationFrameId;

    // Icons (unchanged for brevity)
    const icons = {
        play: `<svg class="icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
        pause: `<svg class="icon" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
        volume2: `<svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
        volumeX: `<svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`,
        rotateCcw: `<svg class="icon" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`,
        clock: `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`
    };

    function getInstruction(count) { return count === 0 ? 'Inhale' : 'Exhale'; }
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    function playTone() {
        if (state.soundEnabled && audioContext) {
            const oscillator = audioContext.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
            oscillator.connect(audioContext.destination);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        }
    }
    function getCountdownDisplay(elapsed) {
        if (elapsed < 0.5) return 5.5;
        else if (elapsed < 1.5) return 5;
        else if (elapsed < 2.5) return 4;
        else if (elapsed < 3.5) return 3;
        else if (elapsed < 4.5) return 2;
        else if (elapsed < 5.5) return 1;
        else return 0;
    }
    async function requestWakeLock() {
        if ('wakeLock' in navigator) {
            try { wakeLock = await navigator.wakeLock.request('screen'); } catch (err) {}
        }
    }
    function releaseWakeLock() {
        if (wakeLock) wakeLock.release().then(() => { wakeLock = null; });
    }

    function togglePlay() {
        if (state.isPlaying) {
            clearInterval(interval);
            cancelAnimationFrame(animationFrameId);
            state.isPlaying = false;
            state.startTime = null;
            state.phaseStartTime = null;
            state.totalTime = 0;
            state.count = 0;
            state.sessionComplete = false;
            state.timeLimitReached = false;
            state.pulseStartTime = null;
            releaseWakeLock();
        } else {
            state.startTime = performance.now();
            state.phaseStartTime = performance.now();
            state.count = 0;
            state.totalTime = 0;
            state.sessionComplete = false;
            state.timeLimitReached = false;
            state.pulseStartTime = null;
            if (audioContext.state === 'suspended') audioContext.resume();
            playTone();
            startInterval();
            animate();
            requestWakeLock();
            state.isPlaying = true;
        }
        render();
    }

    function resetToStart() {
        state.isPlaying = false;
        state.totalTime = 0;
        state.count = 0;
        state.sessionComplete = false;
        state.timeLimitReached = false;
        state.startTime = null;
        state.phaseStartTime = null;
        state.pulseStartTime = null;
        clearInterval(interval);
        cancelAnimationFrame(animationFrameId);
        releaseWakeLock();
        render();
    }

    function toggleSound() { state.soundEnabled = !state.soundEnabled; render(); }
    function handleTimeLimitChange(e) { state.timeLimit = e.target.value.replace(/[^0-9]/g, ''); }
    function startWithPreset(minutes) {
        state.timeLimit = minutes.toString();
        state.isPlaying = true;
        state.startTime = performance.now();
        state.phaseStartTime = performance.now();
        state.count = 0;
        state.totalTime = 0;
        state.sessionComplete = false;
        state.timeLimitReached = false;
        state.pulseStartTime = null;
        if (audioContext.state === 'suspended') audioContext.resume();
        playTone();
        startInterval();
        animate();
        requestWakeLock();
        render();
    }

    function startInterval() {
        clearInterval(interval);
        interval = setInterval(updateState, INTERVAL_TIME);
    }

    function updateState() {
        const now = performance.now();
        const elapsed = (now - state.phaseStartTime) / 1000;
        if (elapsed >= state.phaseDuration) {
            state.pulseStartTime = now;
            if (state.count === 1 && state.timeLimitReached) {
                state.sessionComplete = true;
                state.isPlaying = false;
                clearInterval(interval);
                cancelAnimationFrame(animationFrameId);
                releaseWakeLock();
            } else {
                state.count = (state.count + 1) % 2;
                state.phaseStartTime = now;
                playTone();
            }
        }
        state.totalTime = Math.floor((now - state.startTime) / 1000);
        if (state.timeLimit && state.totalTime >= parseInt(state.timeLimit) * 60) {
            state.timeLimitReached = true;
        }
        render();
    }

    function animate() {
        if (!state.isPlaying) return;
        const now = performance.now();
        const elapsed = (now - state.phaseStartTime) / 1000;
        const progress = Math.min(elapsed / state.phaseDuration, 1);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const x = canvas.width / 2;
        const yMin = 20, yMax = canvas.height - 20;
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x, yMin);
        ctx.lineTo(x, yMax);
        ctx.stroke();

        let dotY = state.count === 0 ? yMax - progress * (yMax - yMin) : yMin + progress * (yMax - yMin);
        let radius = 10, fillStyle = '#ff0000';
        if (state.pulseStartTime !== null) {
            const pulseElapsed = (now - state.pulseStartTime) / 1000;
            if (pulseElapsed < 0.6) {
                const pulseFactor = Math.sin(Math.PI * pulseElapsed / 0.6);
                radius = 10 + 5 * pulseFactor;
                fillStyle = `rgb(255, ${100 + 155 * pulseFactor}, 0)`; // Red to orange
            }
        }

        ctx.beginPath();
        ctx.arc(x, dotY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = fillStyle;
        ctx.fill();

        animationFrameId = requestAnimationFrame(animate);
    }

    function render() {
        let html = `
            <div class="timer" aria-live="polite">Total Time: ${formatTime(state.totalTime)}</div>
        `;
        if (state.isPlaying) {
            const now = performance.now();
            const elapsed = (now - state.phaseStartTime) / 1000;
            const countdownDisplay = getCountdownDisplay(elapsed);
            const displayValue = countdownDisplay === 5.5 ? '5.5' : Math.floor(countdownDisplay).toString();
            html += `
                <h1>Coherent Breathing</h1>
                <div class="exercise-container">
                    <div class="text-area">
                        <div class="instruction">${getInstruction(state.count)}</div>
                        <div class="countdown">${displayValue}</div>
                    </div>
                    <div class="animation-area"></div>
                </div>
                <button id="toggle-play" aria-label="Pause">${icons.pause} Pause</button>
            `;
        } else if (state.sessionComplete) {
            html += `
                <h1>Coherent Breathing</h1>
                <div class="complete">Complete!</div>
                <button id="reset" aria-label="Back to Start">${icons.rotateCcw} Back to Start</button>
            `;
        } else {
            html += `
                <h1>Coherent Breathing</h1>
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
                        <input type="number" inputmode="numeric" placeholder="Time limit (minutes)" value="${state.timeLimit}" id="time-limit" step="1" min="0">
                        <label for="time-limit">Minutes (optional)</label>
                    </div>
                </div>
                <div class="prompt">Press start to begin</div>
                <button id="toggle-play" aria-label="Start">${icons.play} Start</button>
                <div class="shortcut-buttons">
                    <button id="preset-2min" class="preset-button" aria-label="Start 2 minutes">${icons.clock} 2 min</button>
                    <button id="preset-5min" class="preset-button" aria-label="Start 5 minutes">${icons.clock} 5 min</button>
                    <button id="preset-10min" class="preset-button" aria-label="Start 10 minutes">${icons.clock} 10 min</button>
                </div>
            `;
        }
        app.innerHTML = html;

        if (state.isPlaying) {
            const animationArea = document.querySelector('.animation-area');
            if (animationArea && !animationArea.contains(canvas)) {
                animationArea.appendChild(canvas);
                canvas.style.display = 'block';
                canvas.width = animationArea.offsetWidth;
                canvas.height = animationArea.offsetHeight;
                animate(); // Ensure animation starts fresh
            }
        } else {
            canvas.style.display = 'none';
        }

        if (state.isPlaying) {
            document.getElementById('toggle-play').addEventListener('click', togglePlay);
        } else if (state.sessionComplete) {
            document.getElementById('reset').addEventListener('click', resetToStart);
        } else {
            document.getElementById('sound-toggle').addEventListener('change', toggleSound);
            document.getElementById('time-limit').addEventListener('input', handleTimeLimitChange);
            document.getElementById('toggle-play').addEventListener('click', togglePlay);
            document.getElementById('preset-2min').addEventListener('click', () => startWithPreset(2));
            document.getElementById('preset-5min').addEventListener('click', () => startWithPreset(5));
            document.getElementById('preset-10min').addEventListener('click', () => startWithPreset(10));
        }
    }

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (state.isPlaying) {
                const animationArea = document.querySelector('.animation-area');
                if (animationArea) {
                    canvas.width = animationArea.offsetWidth;
                    canvas.height = animationArea.offsetHeight;
                }
            }
        }, 100);
    });

    render();
});