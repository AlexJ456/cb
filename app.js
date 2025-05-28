document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app-content');
    const canvas = document.getElementById('breathing-canvas');
    const container = document.querySelector('.container');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const state = {
        isPlaying: false,
        count: 0,
        totalTime: 0,
        soundEnabled: false,
        timeLimit: '',
        sessionComplete: false,
        phaseTime: 5.5,
        startTime: null,
        phaseStartTime: null,
        displayCountdown: 5.5,
        pulseStartTime: null
    };

    let wakeLock = null;
    let audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let animationFrameId;

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

    function getDisplayCountdown(elapsed) {
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
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Wake lock is active');
            } catch (err) {
                console.error('Failed to acquire wake lock:', err);
            }
        }
    }

    function releaseWakeLock() {
        if (wakeLock) {
            wakeLock.release().then(() => {
                wakeLock = null;
                console.log('Wake lock released');
            }).catch(err => console.error('Failed to release wake lock:', err));
        }
    }

    function togglePlay() {
        state.isPlaying = !state.isPlaying;
        if (state.isPlaying) {
            if (audioContext.state === 'suspended') audioContext.resume();
            state.startTime = performance.now();
            state.phaseStartTime = performance.now();
            state.count = 0;
            state.totalTime = 0;
            state.displayCountdown = 5.5;
            state.sessionComplete = false;
            playTone();
            requestWakeLock();
            updateLoop();
        } else {
            cancelAnimationFrame(animationFrameId);
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            releaseWakeLock();
        }
        render();
    }

    function resetToStart() {
        state.isPlaying = false;
        state.totalTime = 0;
        state.count = 0;
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
        state.startTime = performance.now();
        state.phaseStartTime = performance.now();
        state.count = 0;
        state.totalTime = 0;
        state.displayCountdown = 5.5;
        state.sessionComplete = false;
        if (audioContext.state === 'suspended') audioContext.resume();
        playTone();
        requestWakeLock();
        updateLoop();
        render();
    }

    function updateLoop() {
        if (!state.isPlaying) return;
        const currentTime = performance.now();
        const totalElapsed = (currentTime - state.startTime) / 1000;
        state.totalTime = Math.floor(totalElapsed);
        let phaseElapsed = (currentTime - state.phaseStartTime) / 1000;

        if (phaseElapsed >= 5.5) {
            state.count = (state.count + 1) % 2;
            state.phaseStartTime = currentTime;
            phaseElapsed = 0;
            state.pulseStartTime = currentTime;
            playTone();
            if (state.timeLimit && state.count === 1) {
                const timeLimitSeconds = parseInt(state.timeLimit) * 60;
                if (state.totalTime >= timeLimitSeconds) {
                    state.sessionComplete = true;
                    state.isPlaying = false;
                    releaseWakeLock();
                    render();
                    return;
                }
            }
        }

        state.displayCountdown = getDisplayCountdown(phaseElapsed);
        render();
        animate(phaseElapsed);
        animationFrameId = requestAnimationFrame(updateLoop);
    }

    function animate(phaseElapsed) {
        const ctx = canvas.getContext('2d');
        const progress = Math.min(phaseElapsed / 5.5, 1);
        const lineHeight = canvas.height * 0.3;
        const lineWidth = 10;
        const dotRadius = 15;
        const lineY = canvas.height / 2;
        const lineStartX = (canvas.width - lineWidth) / 2;
        const topY = lineY - lineHeight / 2;
        const bottomY = lineY + lineHeight / 2;
        let dotY = state.count === 0 ? 
            bottomY - progress * lineHeight : 
            topY + progress * lineHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.beginPath();
        ctx.moveTo(lineStartX, topY);
        ctx.lineTo(lineStartX, bottomY);
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = lineWidth;
        ctx.stroke();

        let radius = dotRadius;
        if (state.pulseStartTime) {
            const pulseElapsed = (performance.now() - state.pulseStartTime) / 1000;
            if (pulseElapsed < 0.5) {
                radius = dotRadius + 5 * Math.sin(Math.PI * pulseElapsed / 0.5);
            }
        }
        ctx.beginPath();
        ctx.arc(lineStartX, dotY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
    }

    function render() {
        let html = `<h1>Coherent Breathing</h1>`;
        if (state.isPlaying) {
            html += `
                <div class="timer">Total Time: ${formatTime(state.totalTime)}</div>
                <div class="instruction">${getInstruction(state.count)}</div>
                <div class="countdown">${state.displayCountdown.toFixed(1)}</div>
            `;
        } else if (!state.sessionComplete) {
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
        html += `
            <button id="toggle-play">
                ${state.isPlaying ? icons.pause : icons.play}
                ${state.isPlaying ? 'Pause' : 'Start'}
            </button>
        `;
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
                    <button id="preset-2min" class="preset-button">${icons.clock} 2 min</button>
                    <button id="preset-5min" class="preset-button">${icons.clock} 5 min</button>
                    <button id="preset-10min" class="preset-button">${icons.clock} 10 min</button>
                </div>
            `;
        }
        app.innerHTML = html;

        document.getElementById('toggle-play').addEventListener('click', togglePlay);
        if (state.sessionComplete) {
            document.getElementById('reset').addEventListener('click', resetToStart);
        }
        if (!state.isPlaying && !state.sessionComplete) {
            document.getElementById('sound-toggle').addEventListener('change', toggleSound);
            document.getElementById('time-limit').addEventListener('input', handleTimeLimitChange);
            document.getElementById('preset-2min').addEventListener('click', () => startWithPreset(2));
            document.getElementById('preset-5min').addEventListener('click', () => startWithPreset(5));
            document.getElementById('preset-10min').addEventListener('click', () => startWithPreset(10));
        }
    }

    render();
});