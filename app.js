document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app-content');
    const canvas = document.getElementById('box-canvas');
    const container = document.querySelector('.container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    
    const PHASE_DURATION = 5500; // 5.5 seconds in milliseconds
    const COUNTDOWN_STEP = 1000; // 1 second per step (adjusted for half-second at end)
    const MAX_COUNTDOWN = 5;

    const state = {
        isPlaying: false,
        count: 0, // 0: inhale, 1: exhale
        countdown: MAX_COUNTDOWN,
        accumulatedTime: 0,
        soundEnabled: false,
        timeLimit: '',
        sessionComplete: false,
        timeLimitReached: false,
        phaseStartTime: null,
        pulseStartTime: null
    };

    let wakeLock = null;
    let audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let lastTickTime;

    const icons = {
        play: `<svg class="icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
        pause: `<svg class="icon" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`,
        volume2: `<svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
        volumeX: `<svg class="icon" viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`,
        rotateCcw: `<svg class="icon" viewBox="0 0 24 24"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`,
        clock: `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`
    };

    function getInstruction(count) {
        return count === 0 ? 'Inhale' : 'Exhale';
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

    let interval;
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
            state.accumulatedTime = 0;
            state.countdown = MAX_COUNTDOWN;
            state.count = 0;
            state.sessionComplete = false;
            state.timeLimitReached = false;
            state.phaseStartTime = performance.now();
            playTone();
            startInterval();
            animate();
            requestWakeLock();
        } else {
            clearInterval(interval);
            cancelAnimationFrame(animationFrameId);
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            releaseWakeLock();
        }
        render();
    }

    function resetToStart() {
        state.isPlaying = false;
        state.accumulatedTime = 0;
        state.countdown = MAX_COUNTDOWN;
        state.count = 0;
        state.sessionComplete = false;
        state.timeLimit = '';
        state.timeLimitReached = false;
        clearInterval(interval);
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
        state.accumulatedTime = 0;
        state.countdown = MAX_COUNTDOWN;
        state.count = 0;
        state.sessionComplete = false;
        state.timeLimitReached = false;
        state.phaseStartTime = performance.now();
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('AudioContext resumed');
            });
        }
        playTone();
        startInterval();
        animate();
        requestWakeLock();
        render();
    }

    function startInterval() {
        clearInterval(interval);
        lastTickTime = performance.now();
        interval = setInterval(() => {
            const now = performance.now();
            const elapsed = (now - lastTickTime) / 1000;
            state.accumulatedTime += elapsed;
            lastTickTime = now;
            if (state.isPlaying) {
                if (state.timeLimit && !state.timeLimitReached) {
                    const timeLimitSeconds = parseInt(state.timeLimit) * 60;
                    if (Math.floor(state.accumulatedTime) >= timeLimitSeconds) {
                        state.timeLimitReached = true;
                    }
                }
                const phaseElapsed = now - state.phaseStartTime;
                if (phaseElapsed >= PHASE_DURATION) {
                    if (state.count === 1 && state.timeLimitReached) {
                        state.sessionComplete = true;
                        state.isPlaying = false;
                        clearInterval(interval);
                        cancelAnimationFrame(animationFrameId);
                        releaseWakeLock();
                    } else {
                        state.count = (state.count + 1) % 2;
                        state.phaseStartTime = now;
                        state.pulseStartTime = now;
                        playTone();
                    }
                } else {
                    // Adjusted countdown: 5 to 1 over 5 seconds, 1 for last 0.5s
                    state.countdown = phaseElapsed >= 5000 ? 1 : Math.max(1, MAX_COUNTDOWN - Math.floor(phaseElapsed / COUNTDOWN_STEP));
                }
            }
            render();
        }, 100);
    }

    function animate() {
        if (!state.isPlaying) return;
        const ctx = canvas.getContext('2d');
        const phaseElapsed = performance.now() - state.phaseStartTime;
        const progress = Math.min(1, phaseElapsed / PHASE_DURATION);
        const x = canvas.width / 2;
        const y_top = canvas.height / 2 + 50; // Line starts below center, avoids instruction
        const y_bottom = canvas.height - 50; // Line ends near bottom, with padding
        let dot_y;
        if (state.count === 0) { // inhale
            dot_y = y_bottom - progress * (y_bottom - y_top);
        } else { // exhale
            dot_y = y_top + progress * (y_bottom - y_top);
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw thicker line
        ctx.beginPath();
        ctx.moveTo(x, y_top);
        ctx.lineTo(x, y_bottom);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#d97706';
        ctx.stroke();

        // Draw bigger dot with pulse effect
        let radius = 15;
        if (state.pulseStartTime !== null) {
            const pulseElapsed = (performance.now() - state.pulseStartTime) / 1000;
            if (pulseElapsed < 0.5) {
                const pulseFactor = Math.sin(Math.PI * pulseElapsed / 0.5);
                radius = 15 + 10 * pulseFactor;
            }
        }
        ctx.beginPath();
        ctx.arc(x, dot_y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#ff0000';
        ctx.fill();

        animationFrameId = requestAnimationFrame(animate);
    }

    function render() {
        let html = `
            <h1>Coherent Breathing</h1>
        `;
        if (state.isPlaying) {
            html += `
                <div class="timer">Total Time: ${formatTime(Math.floor(state.accumulatedTime))}</div>
                <div class="instruction">${getInstruction(state.count)}</div>
                <div class="countdown">${state.countdown}</div>
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