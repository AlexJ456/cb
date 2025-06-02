document.addEventListener('DOMContentLoaded', () => {
    const textContent = document.querySelector('.text-content');
    const canvas = document.getElementById('box-canvas');
    const animationContent = document.querySelector('.animation-content');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.width = animationContent.clientWidth;
    canvas.height = animationContent.clientHeight;
    
    const state = {
        isPlaying: false,
        count: 0,
        totalTime: 0,
        soundEnabled: false,
        timeLimit: '',
        sessionComplete: false,
        timeLimitReached: false,
        phaseTime: 5.5,
        phaseStartTime: null,
        pulseStartTime: null
    };

    let wakeLock = null;
    let audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let phaseTimeout;

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
            state.totalTime = 0;
            state.count = 0;
            state.sessionComplete = false;
            state.timeLimitReached = false;
            startInterval();
            startPhase();
            animate();
            requestWakeLock();
        } else {
            clearInterval(interval);
            clearTimeout(phaseTimeout);
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
        state.timeLimitReached = false;
        clearInterval(interval);
        clearTimeout(phaseTimeout);
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
        state.totalTime = 0;
        state.count = 0;
        state.sessionComplete = false;
        state.timeLimitReached = false;
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log('AudioContext resumed');
            });
        }
        startInterval();
        startPhase();
        animate();
        requestWakeLock();
        render();
    }

    function startInterval() {
        clearInterval(interval);
        interval = setInterval(() => {
            state.totalTime += 1;
            if (state.timeLimit && !state.timeLimitReached) {
                const timeLimitSeconds = parseInt(state.timeLimit) * 60;
                if (state.totalTime >= timeLimitSeconds) {
                    state.timeLimitReached = true;
                }
            }
        }, 1000);
    }

    function startPhase() {
        state.phaseStartTime = performance.now();
        state.pulseStartTime = performance.now();
        playTone();
        render();
        phaseTimeout = setTimeout(() => {
            if (state.timeLimitReached && state.count === 1) {
                state.sessionComplete = true;
                state.isPlaying = false;
                clearInterval(interval);
                cancelAnimationFrame(animationFrameId);
                releaseWakeLock();
                render();
            } else {
                state.count = (state.count + 1) % 2;
                startPhase();
            }
        }, state.phaseTime * 1000);
    }

    function animate() {
        if (!state.isPlaying) return;
        const ctx = canvas.getContext('2d');
        const elapsed = (performance.now() - state.phaseStartTime) / 1000;
        const progress = Math.min(elapsed / state.phaseTime, 1);
        
        const changeTimes = [0, 0.5, 1.5, 2.5, 3.5, 4.5];
        const countdownValues = [5.5, 5, 4, 3, 2, 1];
        let displayIndex = 0;
        for (let i = 1; i < changeTimes.length; i++) {
            if (elapsed >= changeTimes[i]) {
                displayIndex = i;
            } else {
                break;
            }
        }
        const displayCountdown = countdownValues[displayIndex];
        document.getElementById('countdown-display').textContent = displayCountdown.toString();

        const topMargin = 50;
        const bottomMargin = canvas.height - 50;
        const x = canvas.width / 2;
        let y = state.count === 0 
            ? bottomMargin - progress * (bottomMargin - topMargin) 
            : topMargin + progress * (bottomMargin - topMargin);

        ctx.clearRect(0, 0, canvas.width, ascended to the top of the canvas.
        ctx.beginPath();
        ctx.moveTo(x, topMargin);
        ctx.lineTo(x, bottomMargin);
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 4;
        ctx.stroke();

        let radius = 10;
        if (state.pulseStartTime !== null) {
            const pulseElapsed = (performance.now() - state.pulseStartTime) / 1000;
            if (pulseElapsed < 0.5) {
                radius = 10 + 10 * Math.sin(Math.PI * pulseElapsed / 0.5);
            }
        }
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#ff0000';
        ctx.fill();

        animationFrameId = requestAnimationFrame(animate);
    }

    function render() {
        let html = '';
        if (state.isPlaying) {
            html += `
                <div class="instruction">${getInstruction(state.count)}</div>
                <div id="countdown-display" class="countdown">${state.phaseTime}</div>
                <div class="timer">Total Time: ${formatTime(state.totalTime)}</div>
                <button id="toggle-play">${icons.pause} Pause</button>
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
                <button id="toggle-play">${icons.play} Start</button>
                <div class="shortcut-buttons">
                    <button id="preset-2min" class="preset-button">${icons.clock} 2 min</button>
                    <button id="preset-5min" class="preset-button">${icons.clock} 5 min</button>
                    <button id="preset-10min" class="preset-button">${icons.clock} 10 min</button>
                </div>
            `;
        } else {
            html += `
                <div class="complete">Complete!</div>
                <button id="reset">${icons.rotateCcw} Back to Start</button>
            `;
        }
        textContent.innerHTML = html;

        if (state.isPlaying) {
            document.getElementById('toggle-play').addEventListener('click', togglePlay);
        } else if (!state.sessionComplete) {
            document.getElementById('sound-toggle').addEventListener('change', toggleSound);
            document.getElementById('time-limit').addEventListener('input', handleTimeLimitChange);
            document.getElementById('toggle-play').addEventListener('click', togglePlay);
            document.getElementById('preset-2min').addEventListener('click', () => startWithPreset(2));
            document.getElementById('preset-5min').addEventListener('click', () => startWithPreset(5));
            document.getElementById('preset-10min').addEventListener('click', () => startWithPreset(10));
        } else {
            document.getElementById('reset').addEventListener('click', resetToStart);
        }
    }

    render();
});
