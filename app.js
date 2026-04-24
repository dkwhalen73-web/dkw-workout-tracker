    const TECHNIQUE_TIPS = {
      'Russian Twists': 'Rotate shoulders, not just arms. Keep heels down.',
      'Hanging Supported Full PPT': 'Tuck hips forward. Squeeze lower abs to flatten back.',
      'Stability APT': 'Arch lower back slightly. Focus on the stretch and control.',
      'TRUE Kneeling Curl-Downs': 'Crunch ribcage specifically toward hips. Roll like a ball.',
      'Stability Lumbar Extensions': 'Pause at top. Keep neck neutral. No swinging.',
      'Walking Oblique Side Bends': 'Focus on lateral contraction. Don\'t lean forward or back.',
      'Hanging Windshield Wipers': 'Rotate from the trunk. Keep legs straight & controlled.',
      'Triple-Angle Serratus Protractions (Unilateral)': 'Push the weight forward as far as possible. Don\'t bend elbow.',
      'Kneeling Rollout': 'Keep back rounded. Only go as far as you can control.',
      'Hollow Body Rockers': 'Keep lower back pressed into floor. Rock as one unit.',
      'Reverse Crunches': 'Exhale as knees come up. Focus on the lower-abs tuck.',
      'Captain\'s Chair Leg Raises': 'Don\'t swing. Lift from the pelvis, not just the legs.',
      'Lying Leg Raises': 'Press lower back into the floor. No arching.',
      'Side Plank': 'Keep body in a straight line. Squeeze glutes.',
      'Bird Dog': 'Reach long, don\'t arch up. Keep core braced.'
    };

    const SESSION_KEY = 'dg_v15_session';
    let APP = {
      config: {
        mode: 'standard',
        week: '1',
        day: 'Monday',
        location: 'WFWHF',
        murphFocus: 'pace',
        travelLocation: 'Crunch',
        travelFocus: 'Chest & Back',
        beastDay: 'Friday',
        beastFormat: 'EMOM',
        beastDuration: '75'
      },
      workout: null,
      sets: {},
      blockTimers: {},
      restInterval: null
    };

    function escapeHtml(value) {
      return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function switchTab(tab) {
      document.querySelectorAll('.tab-pane').forEach(node => node.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(node => node.classList.remove('active'));
      document.getElementById('p-' + tab).classList.add('active');
      document.getElementById('t-' + tab).classList.add('active');
    }

    function init() {
      // Initialize UI from config
      document.getElementById('sel-mode').value = APP.config.mode;
      document.getElementById('sel-week').value = APP.config.week;
      document.getElementById('sel-day').value = APP.config.day;
      document.getElementById('sel-location').value = APP.config.location;
      
      // Always fetch the latest workout JSON first
      autoFetchWorkout();
    }

    async function autoFetchWorkout() {
      setStatus('Loading today\'s workout...');
      try {
        const resp = await fetch('./current-workout.json?t=' + Date.now());
        if (!resp.ok) throw new Error('No workout file found');
        const data = await resp.json();
        const freshWorkout = normalizeLoadedWorkout(data);
        const freshKey = (data.title || '') + '|' + (data.meta || '');

        // Check if we have a saved session for THIS SAME workout
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          try {
            const saved = JSON.parse(raw);
            const savedKey = (saved.workout?.title || '') + '|' + (saved.workout?.meta || '');
            if (savedKey === freshKey && saved.sets && Object.keys(saved.sets).length > 0) {
              // Same workout — update metadata (swaps, cues, targets) without resetting progress
              const savedWorkout = saved.workout;
              freshWorkout.blocks.forEach((fBlock, bIdx) => {
                const sBlock = savedWorkout.blocks[bIdx];
                if (!sBlock) return;
                fBlock.ss.forEach((fSs, sIdx) => {
                  const sSs = sBlock.ss[sIdx];
                  if (!sSs) return;
                  fSs.exs.forEach((fEx, eIdx) => {
                    const sEx = sSs.exs[eIdx];
                    if (!sEx) return;
                    // Update definitions while keeping custom name (if swapped)
                    sEx.swaps = fEx.swaps || [];
                    sEx.cue = fEx.cue || '';
                    sEx.target = fEx.target || '';
                    if (!sEx.originalName) {
                      sEx.name = fEx.name; // Not swapped yet, keep name in sync
                    } else if (sEx.originalName === fEx.name) {
                      // If sEx.originalName matches the new fEx.name, it means the base hasn't changed
                      // But if fEx.name changed in the JSON, we should probably update the originalName
                    }
                  });
                });
              });

              APP.workout = savedWorkout;
              APP.sets = saved.sets;
              APP.blockTimers = saved.blockTimers || {};
              APP.config = { ...APP.config, ...(saved.config || {}) };
              renderAll();
              setStatus('Resumed session with updated definitions.');
              return;
            }
          } catch (e) {
            // Corrupted save — ignore and load fresh
          }
        }

        // New workout or no saved session — load fresh
        APP.workout = freshWorkout;
        APP.sets = createSetState(APP.workout);
        APP.blockTimers = {};
        saveSession();
        renderAll();
        switchTab('overview');
        setStatus('Workout loaded.');
      } catch (err) {
        // Fetch failed — fall back to localStorage if anything is saved
        const raw = localStorage.getItem(SESSION_KEY);
        if (raw) {
          try {
            const saved = JSON.parse(raw);
            APP = {
              ...APP,
              config: { ...APP.config, ...(saved.config || {}) },
              workout: saved.workout || null,
              sets: saved.sets || {},
              blockTimers: saved.blockTimers || {}
            };
            if (APP.workout) {
              renderAll();
              setStatus('Offline — showing last saved session.');
              return;
            }
          } catch (e) { }
        }
        setStatus('No workout found. Paste JSON in the Load tab.');
      }
    }

    function setStatus(message) {
      document.getElementById('builderStatus').textContent = message;
    }

    function updateBuilderUI() {
      const mode = APP.config.mode;
      const weekGrp = document.getElementById('group-week');
      const dayGrp = document.getElementById('group-day');

      if (mode === 'standard') {
        weekGrp.style.display = 'flex';
        dayGrp.style.display = 'flex';
      } else {
        weekGrp.style.display = 'none';
        dayGrp.style.display = 'none';
      }
    }

    function hardRefresh() {
      if (confirm('This will clear your saved session, weights, and reps. Proceed?')) {
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.clear();
        location.reload(true);
      }
    }

    function forceReloadWorkout() {
      localStorage.removeItem(SESSION_KEY);
      APP.workout = null;
      APP.sets = {};
      APP.blockTimers = {};
      autoFetchWorkout();
    }

    function saveSession() {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        config: APP.config,
        workout: APP.workout,
        sets: APP.sets,
        blockTimers: APP.blockTimers
      }));
    }

    function resumeSession() {
      if (!APP.workout) {
        setStatus('No saved workout found yet.');
        return;
      }
      renderAll();
      switchTab('workout');
      setStatus('Resumed saved session.');
    }

    function clearSession() {
      if (!confirm('Clear the saved v15 session?')) return;
      localStorage.removeItem(SESSION_KEY);
      APP.workout = null;
      APP.sets = {};
      APP.blockTimers = {};
      renderAll();
      setStatus('Saved session cleared.');
    }

    function buildWorkout() {
      const c = APP.config;
      let workout = null;

      if (c.mode === 'standard') {
        if (c.location === 'WFWHF') {
          workout = buildStandardWorkout(Number(c.week), c.day, c.location);
        } else {
          workout = buildTravelWorkout(c.location, standardFocusForDay(c.day), {
            titlePrefix: `Week ${c.week} ${c.day} Travel Mod`
          });
        }
      } else if (c.mode === 'murph') {
        workout = buildMurphWorkout(c.murphFocus, c.location);
      } else if (c.mode === 'travel') {
        workout = buildTravelWorkout(c.travelLocation, c.travelFocus);
      } else if (c.mode === 'beast') {
        workout = buildBeastWorkout(c.beastDay, c.beastFormat, c.beastDuration);
      }

      if (!workout) {
        setStatus('That workout could not be built.');
        return;
      }

      APP.workout = workout;
      APP.sets = createSetState(workout);
      APP.blockTimers = {};
      saveSession();
      renderAll();
      switchTab('overview');
      setStatus('Workout built. Review the overview, then head to Workout.');
    }

    function createSetState(workout) {
      const setState = {};
      workout.blocks.forEach(block => {
        block.ss.forEach(ss => {
          ss.exs.forEach(ex => {
            setState[ex.id] = Array.from({ length: ex.sets || 1 }, () => ({ w: '', r: '', d: false }));
          });
        });
      });
      return setState;
    }

    function renderAll() {
      renderHeader();
      renderOverview();
      renderWorkout();
      updateProgress();
      document.getElementById('finishWrap').style.display = APP.workout ? 'block' : 'none';
    }

    function renderHeader() {
      const title = APP.workout ? APP.workout.title : 'Dr. Gains North Star';
      const meta = APP.workout ? APP.workout.meta : 'Build a workout, resume a saved session, or load tracker JSON.';
      document.getElementById('hTitle').textContent = title;
      document.getElementById('hMeta').textContent = meta;
    }

    function renderOverview() {
      const root = document.getElementById('overviewContent');
      if (!APP.workout) {
        root.innerHTML = `<div class="card empty-state">No active session. Tap "Reload Latest Workout" on the Load tab, or push current-workout.json to the repo.</div>`;
        return;
      }

      const workout = APP.workout;
      const exerciseNames = workout.blocks.flatMap(block => block.ss).flatMap(ss => ss.exs).map(ex => ex.name.toLowerCase());
      const configuredEquipment = Array.isArray(workout.eq) ? workout.eq.filter(Boolean) : [];
      const equipment = configuredEquipment.length > 0
        ? Array.from(new Set(configuredEquipment))
        : inferEquipment(exerciseNames, []);
      const statusPills = [
        workout.modeLabel || formatWorkoutType(workout.type) || 'Standard',
        workout.location || 'WFWHF',
        workout.duration ? `${workout.duration} min` : null
      ].filter(Boolean);

      root.innerHTML = `
    <div class="card">
      <div class="card-title">Session Identity</div>
      ${statusPills.map(pill => `<span class="status-pill">${escapeHtml(pill)}</span>`).join('')}
      <div class="hint" style="margin-top:8px">${escapeHtml(workout.meta || '')}</div>
      ${workout.yesterday ? `<div class="hint" style="margin-top:4px; font-style:italic">${escapeHtml(workout.yesterday)}</div>` : ''}
    </div>
    <div class="card">
      <div class="card-title">Equipment</div>
      ${equipment.length > 0 ? equipment.map(item => `<span class="eq-pill">${escapeHtml(item)}</span>`).join('') : '<div class="hint">Bodyweight only.</div>'}
    </div>
    <div class="card">
      <div class="card-title">Block Preview</div>
      ${workout.blocks.map((block, idx) => `
        <div style="padding:10px 0; border-bottom:${idx === workout.blocks.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)'}">
          <div style="font-weight:800; color:var(--cream)">${escapeHtml(block.label)}</div>
          <div class="hint" style="margin-bottom:4px">${escapeHtml(block.rounds || '')}</div>
          ${block.ss.map(ss => `
            <div style="padding:3px 0 3px 12px; border-left:2px solid rgba(212,175,55,0.25); margin:4px 0">
              ${ss.exs.map(ex => `<div class="hint" style="color:rgba(248,246,240,0.8)"><span style="color:var(--gold); font-weight:700">${ex.letter !== 'single' ? ex.letter.toUpperCase() + '.' : '►'}</span> ${escapeHtml(ex.name)} · <span style="color:rgba(248,246,240,0.5)">${escapeHtml(ex.target)}</span></div>`).join('')}
              ${ss.rest ? `<div class="hint" style="font-size:10px; color:rgba(248,246,240,0.4)">⏱ ${escapeHtml(ss.rest)} · 🔄 ${escapeHtml(ss.ar || '')}</div>` : ''}
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
  `;
    }

    function renderWorkout() {
      const root = document.getElementById('workoutContent');
      if (!APP.workout) {
        root.innerHTML = `<div class="card empty-state">Build or load a workout first.</div>`;
        return;
      }

      root.innerHTML = APP.workout.blocks.map(block => `
    <div class="block">
      <div class="block-h">
        <div>
          <div class="block-title">${escapeHtml(block.label)}</div>
          ${block.rounds ? `<div class="block-sub">${escapeHtml(block.rounds)}</div>` : ''}
        </div>
        ${block.timer ? `<button class="timer-btn" id="timer-btn-${block.id}" onclick="toggleBlockTimer('${block.id}')">${APP.blockTimers[block.id]?.running ? 'Stop Timer' : (APP.blockTimers[block.id]?.done ? 'Timer Done' : 'Start Timer')}</button>` : ''}
      </div>
      <div class="block-body">
        ${block.timer ? `<div class="timer-readout" id="timer-display-${block.id}" style="display:block">${formatTimerDisplay(block.id)}</div>` : ''}
        ${block.ss.map(ss => `
          <div class="ss-label">${escapeHtml(ss.label)}</div>
          ${ss.exs.map((ex, exIndex) => renderExerciseCard(ex, exIndex === ss.exs.length - 1, ss.rest, block.id)).join('')}
        `).join('')}
      </div>
    </div>
  `).join('');
    }

    function renderExerciseCard(ex, isLast, rest, blockId) {
      const sets = APP.sets[ex.id] || [];
      const primaryLabel = ex.logType === 'time' ? 'Time' : (ex.logType === 'distance' ? 'Distance' : 'Weight');
      const secondaryLabel = ex.logType === 'time' ? 'Notes' : 'Reps';
      const tip = inferExerciseTip(ex);

      return `
    <div class="ex-card">
      <div class="ex-name">${escapeHtml(ex.name)}</div>
      <div class="ex-tip">${escapeHtml(tip)}</div>
      
      <div class="ex-target">${escapeHtml(ex.target)}</div>
      <div style="margin-top:8px">
        ${sets.map((setRow, index) => `
          <div class="set-row">
            <div class="set-num">${index + 1}</div>
            <div>
              <input class="set-input" value="${escapeHtml(setRow.w)}" placeholder="-" onchange="updateSet('${ex.id}', ${index}, 'w', this.value)">
              <div class="mini-label">${escapeHtml(primaryLabel)}</div>
            </div>
            <div>
              <input class="set-input" value="${escapeHtml(setRow.r)}" placeholder="-" onchange="updateSet('${ex.id}', ${index}, 'r', this.value)">
              <div class="mini-label">${escapeHtml(secondaryLabel)}</div>
            </div>
            <button class="btn-go" id="go-${ex.id}-${index}" onclick="startSetCycle('${ex.id}', ${index}, '${escapeHtml(rest || '')}')" title="Start cycle timer">GO</button>
            <button class="btn-check ${setRow.d ? 'done' : ''}" onclick="toggleSet('${ex.id}', ${index}, this, ${isLast}, '${escapeHtml(rest || '')}', '${blockId}')">✓</button>
          </div>
          <div class="cycle-countdown" id="cycle-${ex.id}-${index}"></div>
        `).join('')}
      </div>
      ${ex.cue ? `<div class="ex-cue">${escapeHtml(ex.cue)}</div>` : ''}
      ${ex.swaps && ex.swaps.length > 0 ? `
        <button class="swap-toggle" onclick="this.nextElementSibling.classList.toggle('open')">⇄ Swap</button>
        <div class="swap-list">
          ${ex.originalName && ex.originalName !== ex.name ? `
            <div class="swap-chip" style="background:rgba(212,175,55,0.15); border:1px solid var(--gold); color:var(--gold)" onclick="swapExercise('${ex.id}', ${JSON.stringify(ex.originalName).replace(/"/g, '&quot;')})">↺ Original: ${escapeHtml(ex.originalName)}</div>
          ` : ''}
          ${ex.swaps.map(s => `<div class="swap-chip" onclick="swapExercise('${ex.id}', ${JSON.stringify(s).replace(/"/g, '&quot;')})">${escapeHtml(s)}</div>`).join('')}
        </div>
      ` : ''}
    </div>
  `;
    }

    function swapExercise(exId, newName) {
      for (const block of APP.workout.blocks) {
        for (const ss of block.ss) {
          const ex = ss.exs.find(e => e.id === exId);
          if (ex) {
            if (!ex.originalName) ex.originalName = ex.name;
            ex.name = newName;
            saveSession();
            renderAll();
            return;
          }
        }
      }
    }

    function updateSet(id, index, key, value) {
      APP.sets[id][index][key] = value;
      saveSession();
    }

    function toggleSet(id, index, btn, isLast, rest, blockId) {
      const row = APP.sets[id][index];
      row.d = !row.d;
      btn.classList.toggle('done');
      if (row.d && APP.workout.blocks.find(block => block.id === blockId)?.timer && !APP.blockTimers[blockId]?.running && !APP.blockTimers[blockId]?.done) {
        toggleBlockTimer(blockId);
      }
      if (row.d && isLast && rest) {
        const seconds = extractRestSeconds(rest);
        if (seconds > 0) startRest(seconds);
      }
      saveSession();
      updateProgress();
    }

    function toggleBlockTimer(blockId) {
      APP.blockTimers[blockId] = APP.blockTimers[blockId] || { elapsed: 0, startedAt: null, running: false, done: false };
      const timer = APP.blockTimers[blockId];

      if (!timer.running && !timer.done) {
        timer.running = true;
        timer.startedAt = Date.now();
      } else if (timer.running) {
        timer.elapsed += Date.now() - timer.startedAt;
        timer.startedAt = null;
        timer.running = false;
        timer.done = true;
      } else {
        return;
      }

      saveSession();
      renderWorkout();
      updateBlockTimerDisplays();
    }

    function updateBlockTimerDisplays() {
      Object.keys(APP.blockTimers).forEach(blockId => {
        const timer = APP.blockTimers[blockId];
        if (!timer.running) return;
        const display = document.getElementById('timer-display-' + blockId);
        if (display) display.textContent = formatTimerDisplay(blockId);
      });
      requestAnimationFrame(updateBlockTimerDisplays);
    }

    function formatTimerDisplay(blockId) {
      const timer = APP.blockTimers[blockId];
      if (!timer) return '00:00';
      const elapsed = timer.elapsed + (timer.running ? Date.now() - timer.startedAt : 0);
      const totalSeconds = Math.floor(elapsed / 1000);
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    function updateProgress() {
      const allSets = Object.values(APP.sets).flat();
      const doneSets = allSets.filter(setRow => setRow.d).length;
      document.getElementById('setsDone').textContent = `${doneSets} / ${allSets.length}`;
      document.getElementById('pFill').style.width = allSets.length ? `${(doneSets / allSets.length) * 100}%` : '0%';
    }

    // EMOM-style cycle timer: tap GO at set start — counts down full interval (work+rest)
    const _cycleTimers = {};
    function startSetCycle(exId, index, restStr) {
      const cycleKey = exId + '-' + index;
      if (_cycleTimers[cycleKey]) { clearInterval(_cycleTimers[cycleKey]); delete _cycleTimers[cycleKey]; }
      const totalSeconds = extractRestSeconds(restStr);
      if (totalSeconds <= 0) return;
      let remaining = totalSeconds;
      const btn = document.getElementById('go-' + exId + '-' + index);
      const display = document.getElementById('cycle-' + exId + '-' + index);
      if (btn) btn.classList.add('active');
      const update = () => { if (display) display.textContent = remaining + 's'; };
      update();
      _cycleTimers[cycleKey] = setInterval(() => {
        remaining -= 1;
        update();
        if (remaining <= 0) {
          clearInterval(_cycleTimers[cycleKey]);
          delete _cycleTimers[cycleKey];
          if (btn) btn.classList.remove('active');
          if (display) display.textContent = '\u25b6 GO!';
          try { navigator.vibrate([200, 100, 200]); } catch(e) {}
        }
      }, 1000);
    }

    function startRest(seconds) {
      stopRest();
      const pill = document.getElementById('restPill');
      const value = document.getElementById('restVal');
      let remaining = seconds;
      value.textContent = remaining;
      pill.style.display = 'flex';
      APP.restInterval = setInterval(() => {
        remaining -= 1;
        value.textContent = remaining;
        if (remaining <= 0) {
          stopRest();
          try { navigator.vibrate(250); } catch (error) { }
          alert('Rest over.');
        }
      }, 1000);
    }

    function stopRest() {
      clearInterval(APP.restInterval);
      APP.restInterval = null;
      document.getElementById('restPill').style.display = 'none';
    }

    function finishSession() {
      if (!APP.workout) return;
      const exerciseLookup = {};
      APP.workout.blocks.forEach(block => block.ss.forEach(ss => ss.exs.forEach(ex => { exerciseLookup[ex.id] = ex; })));

      let text = `DR. GAINS SESSION\n${APP.workout.title}\n${APP.workout.meta}\n`;
      Object.keys(APP.sets).forEach(id => {
        const completed = APP.sets[id].filter(setRow => setRow.d);
        if (!completed.length) return;
        const ex = exerciseLookup[id];
        text += `\n${ex.name}: ${completed.map(setRow => `${setRow.w || '-'} x ${setRow.r || '-'}`).join(', ')}`;
      });

      document.getElementById('logBody').textContent = text;
      document.getElementById('logModal').style.display = 'flex';
    }

    function closeModal() {
      document.getElementById('logModal').style.display = 'none';
    }

    function copyLog() {
      navigator.clipboard.writeText(document.getElementById('logBody').textContent)
        .then(() => alert('Session log copied.'))
        .catch(() => alert('Copy failed in this browser.'));
    }

    function loadFromJson() {
      let raw = document.getElementById('loadInput').value.trim();
      // Strip markdown code fences if pasted from Claude
      raw = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
      raw = raw.trim();
      // Extract JSON object from surrounding text
      const firstBrace = raw.indexOf('{');
      const lastBrace = raw.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        raw = raw.substring(firstBrace, lastBrace + 1);
      }

      try {
        const data = JSON.parse(raw);
        APP.workout = normalizeLoadedWorkout(data);
        APP.sets = createSetState(APP.workout);
        APP.blockTimers = {};
        saveSession();
        renderAll();
        switchTab('overview');
        setStatus('JSON workout loaded successfully.');
      } catch (error) {
        alert('JSON error: ' + (error.message || 'Unknown') + '\n\nPaste the raw JSON block from Claude — no extra text needed.');
      }
    }

    function normalizeLoadedWorkout(data) {
      const workout = { ...data };
      workout.title = workout.title || 'Loaded Workout';
      workout.meta = workout.meta || 'Loaded from tracker JSON';
      workout.modeLabel = workout.modeLabel || 'Loaded JSON';
      workout.location = workout.location || 'Custom';
      workout.duration = workout.duration || '';
      if (workout.blocks) {
        workout.blocks = workout.blocks.map(function (b, bi) {
          return {
            id: b.id || 'loaded-b' + bi,
            label: b.label || 'Block ' + (bi + 1),
            type: b.type || 'standard',
            rounds: b.rounds || '',
            timer: b.timer || false,
            ss: (b.ss || []).map(function (ss, si) {
              return {
                id: ss.id || 'loaded-ss' + bi + '-' + si,
                label: ss.label || '',
                rest: ss.rest || '60 sec',
                ar: ss.ar || '',
                exs: (ss.exs || []).map(function (ex, ei) {
                  return {
                    id: ex.id || 'loaded-ex' + bi + '-' + si + '-' + ei,
                    letter: ex.letter || String.fromCharCode(97 + ei),
                    name: ex.name || 'Exercise',
                    target: ex.target || '',
                    cue: ex.cue || '',
                    sets: ex.sets || parseSetCount(ex.target || '1'),
                    logType: ex.logType || inferLogType(ex.name || '', ex.target || ''),
                    swaps: ex.swaps || []
                  };
                })
              };
            })
          };
        });
      }
      return workout;
    }

    function buildStandardWorkout(week, day, location) {
      if (typeof DR_GAINS_FULL_DB !== 'undefined' && DR_GAINS_FULL_DB[week] && DR_GAINS_FULL_DB[week][day]) {
        const dbEntry = JSON.parse(JSON.stringify(DR_GAINS_FULL_DB[week][day]));
        if (!dbEntry.blocks || dbEntry.blocks.length === 0) {
          alert(day + ' is a bootcamp or rest day — no Dr. Gains session scheduled.');
          return null;
        }
        return {
          title: dbEntry.title || 'Week ' + week + ' ' + day,
          meta: location + ' · Week ' + week + ' · ' + day,
          modeLabel: 'Standard 8-Week',
          type: 'standard',
          location: location,
          duration: estimateDuration(dbEntry.blocks),
          eq: [],
          blocks: dbEntry.blocks.map(function (b) {
            return {
              id: b.id || slug(b.label),
              label: b.label || 'Block',
              type: b.type || 'standard',
              rounds: b.rounds || '',
              timer: b.timer || false,
              ss: (b.ss || []).map(function (ss) {
                return {
                  id: ss.id || slug(ss.label || b.label),
                  label: ss.label || '',
                  rest: ss.rest || '60 sec',
                  ar: ss.ar || '',
                  exs: (ss.exs || []).map(function (ex, ei) {
                    return {
                      id: ex.id,
                      letter: ex.letter || String.fromCharCode(97 + ei),
                      name: ex.name,
                      target: ex.target,
                      cue: ex.cue || '',
                      sets: ex.sets || parseSetCount(ex.target),
                      logType: ex.logType || inferLogType(ex.name, ex.target),
                      swaps: ex.swaps || []
                    };
                  })
                };
              })
            };
          })
        };
      }
      alert('Week ' + week + ' ' + day + ' was not available from the reference data.');
      return null;
    }

    function buildTravelWorkout(location, focus, options = {}) {
      const templates = {
        'Chest & Back': [
          group('Warm-Up', [{ name: 'Bike or brisk walk', target: '4 min', logType: 'time', cue: 'Raise temp first.' }, { name: 'Band pull-aparts', target: '2x15', cue: 'Prime shoulders.' }], '30 sec'),
          group('Density Pair 1', [{ name: location === 'Hotel' ? 'DB Floor Press' : 'Incline DB Press', target: '4x8-12', cue: 'Smooth eccentric.' }, { name: location === 'Hotel' ? '1-Arm DB Row' : 'Seated Cable Row', target: '4x10-12', cue: 'Own the squeeze.' }], '75 sec', 'Dead hang 20 sec or doorway lat stretch'),
          group('Density Pair 2', [{ name: location === 'Hotel' ? 'Push-Up Mechanical Drop Set' : 'Machine Chest Press', target: '3x12-15', cue: 'Keep pace high.' }, { name: location === 'Hotel' ? 'Suitcase DB Row' : 'Neutral-Grip Pulldown', target: '3x10-15', cue: 'Chest tall.' }], '60 sec', 'Scap wall slides x10')
        ],
        'Arms': [
          group('Warm-Up', [{ name: 'Dead hang or wrist mobility', target: '2 rounds', cue: 'Open elbows and wrists.' }], '30 sec'),
          group('Superset 1', [{ name: 'Hammer Curl', target: '4x8-12', cue: 'Neutral grip.' }, { name: 'Rope Pressdown', target: '4x10-12', cue: 'Lockout hard.' }], '75 sec', 'Farmer carry 15m'),
          group('Superset 2', [{ name: 'Incline DB Curl', target: '3x10-12', cue: 'Long range.' }, { name: 'Overhead DB Extension', target: '3x10-12', cue: 'Elbows stable.' }], '60 sec', 'Wrist circles x10 each way')
        ],
        'Core & Spine': [
          group('Primer', [{ name: 'Dead bug hold', target: '2x20 sec', logType: 'time', cue: 'Ribs down.' }, { name: 'Hip flexor stretch', target: '2x20 sec/side', logType: 'time', cue: 'Open front line.' }], '30 sec'),
          group('Circuit', [{ name: 'Hanging knee raise or captain chair raise', target: '4x8-12', cue: 'Posterior tilt.' }, { name: 'Cable crunch or crunch variation', target: '4x10-15', cue: 'Flex through abs.' }, { name: 'Back extension or bird dog', target: '4x10-15', cue: 'Move slow.' }], '90 sec', 'Breathing reset x4')
        ],
        'Legs & Shoulders': [
          group('Warm-Up', [{ name: 'Lateral band walk', target: '2x10/side', cue: 'Wake up glutes.' }, { name: 'Arm circles', target: '30 sec', logType: 'time', cue: 'Prep shoulders.' }], '30 sec'),
          group('Superset 1', [{ name: location === 'Hotel' ? 'Goblet Squat' : 'Hack Squat or Leg Press', target: '4x8-12', cue: 'Control depth.' }, { name: 'Arnold Press', target: '4x8-12', cue: 'Smooth turn over.' }], '75 sec', 'Hip flexor stretch 20 sec/side'),
          group('Superset 2', [{ name: location === 'Hotel' ? 'DB RDL' : 'Seated Leg Curl', target: '3x10-12', cue: 'Posterior chain.' }, { name: 'Lateral Raise Mechanical Set', target: '3x12-15', cue: 'Keep traps quiet.' }], '60 sec', 'Overhead carry 10m')
        ],
        'Full Upper': [
          group('Circuit', [{ name: 'DB Bench or Push-Up', target: '4x10-12', cue: 'Push hard.' }, { name: '1-Arm Row', target: '4x10-12', cue: 'Squeeze lats.' }, { name: 'Arnold Press', target: '4x8-10', cue: 'Stay tall.' }, { name: 'Hammer Curl', target: '4x10-12', cue: 'No swing.' }], '90 sec', 'Walk recovery')
        ],
        'Full Body': [
          group('Circuit', [{ name: 'Goblet Squat', target: '5x10-15', cue: 'Breathe and brace.' }, { name: 'Push-Up', target: '5x10-20', cue: 'Full lockout.' }, { name: 'DB Row', target: '5x10-12', cue: 'Hip square.' }, { name: 'Reverse Lunge', target: '5x8/leg', cue: 'Own the landing.' }], '90 sec', 'Walk recovery')
        ]
      };

      const baseBlocks = templates[focus] || templates['Full Body'];
      return {
        title: options.titlePrefix ? `${options.titlePrefix} — ${focus}` : `${location.toUpperCase()} ${focus.toUpperCase()}`,
        meta: `${location} · Travel build · ${focus}`,
        modeLabel: 'Travel Mod',
        type: 'travel',
        location,
        duration: estimateDuration(baseBlocks),
        eq: location === 'Hotel' ? ['Dumbbells', 'Bench', 'Bodyweight'] : ['Dumbbells', 'Cable Machine', 'Bench', 'Machines'],
        blocks: baseBlocks
      };
    }

    function buildMurphWorkout(focus, location) {
      const map = {
        pace: [
          group('Warm-Up', [{ name: 'Easy row or run', target: '5 min', logType: 'time', cue: 'Raise temp.' }, { name: 'Dead hang', target: '2x30 sec', logType: 'time', cue: 'Prep grip.' }], '30 sec'),
          group('Pace Builder', [{ name: 'Pull-Ups', target: '10 rounds x 5', cue: 'Clean reps.' }, { name: 'Push-Ups', target: '10 rounds x 10', cue: 'No snake.' }, { name: 'Air Squats', target: '10 rounds x 15', cue: 'Stay smooth.' }], '20 sec', 'Walk and shake out'),
          group('Run Split', [{ name: location === 'Hotel' ? 'Treadmill 400m' : '400m Run', target: '3 sets', logType: 'time', cue: 'Practice race pace.' }], '90 sec', 'Walk recovery')
        ],
        volume: [
          group('Pull-Up Capacity', [{ name: 'Assisted or banded pull-up cluster', target: '8 rounds x 4-6', cue: 'Submax crisp sets.' }, { name: 'Ring row or pulldown', target: '4x12-15', cue: 'Get extra volume.' }], '60 sec', 'Hang 15 sec'),
          group('Push and Squat Volume', [{ name: 'Push-Up density', target: '8 min continuous sets', cue: 'Keep short breaks.' }, { name: 'Air squat density', target: '8 min continuous sets', cue: 'Stay nasal.' }], '90 sec', 'Walk recovery')
        ],
        simulation: [
          group('Warm-Up', [{ name: 'Easy run', target: '800m', logType: 'time', cue: 'Prime system.' }], '60 sec'),
          group('Half Sim', [{ name: 'Pull-Ups', target: '50 total', cue: 'Partition as needed.' }, { name: 'Push-Ups', target: '100 total', cue: 'Stay technical.' }, { name: 'Air Squats', target: '150 total', cue: 'Stay even.' }], 'as needed', 'Walk and breathe'),
          group('Run Out', [{ name: 'Run', target: '800m', logType: 'time', cue: 'Hold form under fatigue.' }], '0 sec')
        ],
        pullup: [
          group('Grip Builder', [{ name: 'Dead Hang', target: '4xmax time', logType: 'time', cue: 'Switch grips.' }, { name: 'Scap pull-up', target: '4x10', cue: 'Own the bottom.' }], '60 sec', 'Forearm stretch'),
          group('Strength Ladder', [{ name: 'Weighted or strict pull-up', target: '6 ladders', cue: 'Quality first.' }, { name: 'Lat pulldown burn set', target: '4x15-20', cue: 'Keep elbows down.' }], '75 sec', 'Band pull-aparts x15')
        ]
      };

      const blocks = map[focus] || map.pace;
      return {
        title: `Murph Prep — ${focus.charAt(0).toUpperCase() + focus.slice(1)}`,
        meta: `${location} · Murph training`,
        modeLabel: 'Murph',
        type: 'murph',
        location,
        duration: estimateDuration(blocks),
        eq: location === 'Hotel' ? ['Pull-Up Bar', 'Dumbbells', 'Bodyweight'] : ['Pull-Up Bar', 'Weighted Vest', 'Track or Treadmill'],
        blocks
      };
    }

    function buildBeastWorkout(day, format, duration) {
      const focus = day === 'Friday' ? 'Core + Engine' : 'Legs + Shoulders + Engine';
      const blocks = [];
      blocks.push(group('Warm-Up', [
        { name: 'Bike / row / SkiErg', target: '5 min', logType: 'time', cue: 'Build heat.' },
        { name: 'Dynamic mobility wave', target: '2 rounds', cue: 'Open hips and shoulders.' }
      ], '30 sec'));

      if (format === 'EMOM') {
        blocks.push(group('EMOM Engine', [
          { name: day === 'Friday' ? 'Calorie row' : 'Calorie bike', target: '12 rounds', cue: 'Minute 1' },
          { name: day === 'Friday' ? 'Toes-to-bar or knee raise' : 'DB thruster', target: '12 rounds', cue: 'Minute 2' },
          { name: day === 'Friday' ? 'Burpee-over-erg' : 'Walking lunge', target: '12 rounds', cue: 'Minute 3' }
        ], 'Built into EMOM', 'Move to next station'));
      } else if (format === 'AMRAP') {
        blocks.push(group('AMRAP', [
          { name: 'Run or row', target: '400m / 500m', logType: 'time', cue: 'Open hard.' },
          { name: day === 'Friday' ? 'Sit-Up + V-Up combo' : 'Goblet squat', target: '20 reps', cue: 'Stay composed.' },
          { name: day === 'Friday' ? 'Push press' : 'Box step-up', target: '15 reps', cue: 'Keep moving.' },
          { name: 'Burpees', target: '10 reps', cue: 'No idle standing.' }
        ], '20-30 min AMRAP', 'Walk 20 sec if needed'));
      } else if (format === 'Chipper') {
        blocks.push(group('Chipper', [
          { name: 'Row', target: '1000m', logType: 'time', cue: 'Steady start.' },
          { name: day === 'Friday' ? 'Sit-ups' : 'Air squats', target: '80 reps', cue: 'Chunk smart.' },
          { name: day === 'Friday' ? 'KB swings' : 'DB push press', target: '60 reps', cue: 'Breathe at the top.' },
          { name: 'Burpees', target: '40 reps', cue: 'Stay relentless.' }
        ], 'For time', 'Minimal transition'));
      } else if (format === 'Intervals') {
        blocks.push(group('Intervals', [
          { name: 'Machine sprint', target: '6 rounds x 2 min', logType: 'time', cue: 'Hit hard, recover controlled.' },
          { name: day === 'Friday' ? 'Core combo' : 'Lower-body burner', target: '6 rounds x 45 sec', logType: 'time', cue: 'No idle rest.' }
        ], '1 min between rounds', 'Light walk and breath reset'));
      } else {
        blocks.push(group('For Time', [
          { name: 'Run', target: '800m', logType: 'time', cue: 'Open steady.' },
          { name: day === 'Friday' ? 'Sandbag carry' : 'Sled push', target: '6 lengths', cue: 'Own pace.' },
          { name: day === 'Friday' ? 'Hanging knee raises' : 'DB thrusters', target: '50 reps', cue: 'Break intentionally.' },
          { name: 'Burpees', target: '30 reps', cue: 'Finish under control.' }
        ], 'For time', 'Minimal transition'));
      }

      blocks.push(group('Score', [
        { name: 'Score / Notes', target: `${duration} min cap`, cue: 'Record rounds, time, calories, and what cooked you.' }
      ], '0 sec'));

      return {
        title: `${day.toUpperCase()} BEAST MODE — ${format.toUpperCase()}`,
        meta: `WFWHF · ${focus} · ${duration} min`,
        modeLabel: 'Beast Mode',
        type: 'beast',
        location: 'WFWHF',
        duration,
        eq: ['Rower / Bike / SkiErg', 'Dumbbells', 'Bodyweight', 'Sled / Carry implements'],
        blocks
      };
    }

    function group(label, exercises, rest = '60 sec', activeRest = '') {
      return {
        id: slug(label) + '-' + Math.random().toString(36).slice(2, 6),
        label,
        rounds: '',
        timer: false,
        ss: [{
          id: slug(label),
          label,
          rest,
          ar: activeRest,
          exs: exercises.map((exercise, index) => ({
            id: `${slug(label)}-${index + 1}`,
            letter: String.fromCharCode(97 + index),
            sets: parseSetCount(exercise.target),
            ...exercise
          }))
        }]
      };
    }

    function parseSetCount(target) {
      const match = String(target).match(/(\d+)(?:\s*x|\s*sets?)/i);
      if (match) return Number(match[1]);
      return 1;
    }

    function formatWorkoutType(type) {
      const labels = {
        standard: 'Standard',
        upper: 'Upper Body',
        arms: 'Arms',
        core: 'Core',
        legs_shoulders: 'Legs & Shoulders',
        warmup: 'Warm-Up',
        exercise: 'Exercise',
        travel: 'Travel',
        murph: 'Murph',
        beast: 'Beast Mode',
        finisher: 'Finisher'
      };

      return labels[type] || capitalize(String(type || '').replace(/[_-]+/g, ' '));
    }

    function collectWorkoutErrors(workout, label) {
      const errors = [];
      if (!workout || typeof workout !== 'object') {
        return [`${label}: workout is missing or invalid.`];
      }

      if (!workout.title) errors.push(`${label}: missing title.`);
      if (!Array.isArray(workout.blocks) || workout.blocks.length === 0) {
        errors.push(`${label}: blocks are missing.`);
        return errors;
      }

      const seenIds = new Set();
      workout.blocks.forEach((block, blockIndex) => {
        if (!block || typeof block !== 'object') {
          errors.push(`${label}: block ${blockIndex + 1} is invalid.`);
          return;
        }

        if (!block.id) errors.push(`${label}: block ${blockIndex + 1} is missing id.`);
        if (!block.label) errors.push(`${label}: block ${blockIndex + 1} is missing label.`);
        if (!Array.isArray(block.ss) || block.ss.length === 0) {
          errors.push(`${label}: block ${blockIndex + 1} has no exercise groups.`);
          return;
        }

        if (block.id) {
          if (seenIds.has(block.id)) errors.push(`${label}: duplicate block id "${block.id}".`);
          seenIds.add(block.id);
        }

        block.ss.forEach((ss, ssIndex) => {
          if (!ss || !Array.isArray(ss.exs) || ss.exs.length === 0) {
            errors.push(`${label}: block ${blockIndex + 1}, group ${ssIndex + 1} has no exercises.`);
            return;
          }

          ss.exs.forEach((exercise, exerciseIndex) => {
            if (!exercise || typeof exercise !== 'object') {
              errors.push(`${label}: block ${blockIndex + 1}, group ${ssIndex + 1}, exercise ${exerciseIndex + 1} is invalid.`);
              return;
            }

            if (!exercise.id) errors.push(`${label}: exercise ${exerciseIndex + 1} is missing id in block ${blockIndex + 1}.`);
            if (!exercise.name) errors.push(`${label}: exercise ${exerciseIndex + 1} is missing name in block ${blockIndex + 1}.`);
            if (typeof exercise.target !== 'string') errors.push(`${label}: exercise ${exerciseIndex + 1} target must be text in block ${blockIndex + 1}.`);
            if (!Number.isInteger(exercise.sets) || exercise.sets < 1) {
              errors.push(`${label}: exercise ${exerciseIndex + 1} sets must be a whole number in block ${blockIndex + 1}.`);
            }

            if (exercise.id) {
              if (seenIds.has(exercise.id)) errors.push(`${label}: duplicate exercise id "${exercise.id}".`);
              seenIds.add(exercise.id);
            }
          });
        });
      });

      return errors;
    }

    async function validateRepoData() {
      setStatus('Validating workout data...');

      try {
        const response = await fetch(`./current-workout.json?t=${Date.now()}`);
        if (!response.ok) throw new Error('current-workout.json could not be loaded.');

        const currentWorkout = normalizeLoadedWorkout(await response.json());
        const programErrors = Object.entries(DR_GAINS_FULL_DB || {}).flatMap(([week, days]) =>
          Object.entries(days || {}).flatMap(([day, workout]) =>
            collectWorkoutErrors(workout, `Program week ${week} ${day}`)
          )
        );
        const currentErrors = collectWorkoutErrors(currentWorkout, 'current-workout.json');
        const errors = [...currentErrors, ...programErrors];

        if (errors.length) {
          setStatus(`Validation found ${errors.length} issue${errors.length === 1 ? '' : 's'}.`);
          alert(`Validation found ${errors.length} issue${errors.length === 1 ? '' : 's'}:\n\n- ${errors.join('\n- ')}`);
          return;
        }

        setStatus('Validation passed. current-workout.json and parsed_db.js both look good.');
        alert('Validation passed.\n\ncurrent-workout.json and parsed_db.js both look structurally valid.');
      } catch (error) {
        setStatus(`Validation failed: ${error.message}`);
        alert(`Validation failed.\n\n${error.message}`);
      }
    }

    function inferLogType(name, target) {
      const nameText = String(name).toLowerCase();
      const targetText = String(target).toLowerCase();
      const timeTargetPattern = /(\d+\s*(sec|secs|s|min|mins|minute|minutes)\b|for time|max time|amrap|emom|time cap|\bcap\b)/;
      const distanceTargetPattern = /(\d+\s*(m|km|mi|mile|miles|meter|meters|metre|metres)\b|distance)/;

      if (timeTargetPattern.test(targetText)) return 'time';
      if (distanceTargetPattern.test(targetText)) return 'distance';
      if (/(run|treadmill|bike|rower|ski(erg)?|erg)/.test(nameText) && timeTargetPattern.test(targetText)) return 'time';
      return 'standard';
    }

    function extractRestSeconds(rest) {
      const matches = String(rest).match(/\d+/g);
      if (!matches) return 0;
      const nums = matches.map(Number).filter(n => n > 0);
      if (nums.length === 0) return 0;
      // Return largest number found (e.g. '60-90s' -> 90, '90s' -> 90)
      return Math.max(...nums);
    }

    function inferExerciseTip(ex) {
      const name = String(ex.name || '');
      const cleanName = name.replace(/^SS\d+[A-Z]:\s*/i, '').trim();
      const rawCue = String(ex.cue || '').toLowerCase();
      const clean = String(ex.cue || '').trim();

      // 1. Dictionary Lookup (High Precision)
      if (TECHNIQUE_TIPS[cleanName]) return TECHNIQUE_TIPS[cleanName];
      for (const [key, tip] of Object.entries(TECHNIQUE_TIPS)) {
        if (cleanName.toLowerCase().includes(key.toLowerCase())) return tip;
      }

      // 2. Keyword fallback (Moderated Precision)
      const lowerName = cleanName.toLowerCase();
      if (/row|pull|lat/.test(lowerName)) return 'Lead with elbows. Squeeze upper back.';
      if (/press|push/.test(lowerName)) return 'Brace core. Control the eccentric.';
      if (/squat|lunge|split squat/.test(lowerName)) return 'Stay rooted. Keep knees tracking.';
      if (/curl|tricep|extension|kickback/.test(lowerName)) return 'Full range. No momentum.';

      // 3. User-provided cue (Only if NOT transition noise)
      const isTransition = /→|move directly|next exercise|rest:|active rest/i.test(rawCue) || /move directly|next exercise/i.test(clean);
      if (clean && !isTransition && clean.length > 5) {
        return clean.split(/[|.]/)[0].replace(/\s+/g, ' ').trim();
      }

      // 4. Absolute Fallback
      return 'Controlled reps. Focus on the muscle contraction.';
    }

    function inferEquipment(exerciseNames, eq) {
      const found = new Set(eq);
      const joined = exerciseNames.join(' ');
      const rules = [
        // Cable machine patterns
        [/cable|pulldown|pushdown|lat pull|rope ext|rope tri|rope curl|cross.?cable|contralateral|face.?pull|sitting.*row|seated.*row|tricep ext|90°.*ext/i, 'Cable Machine'],
        // Dumbbells
        [/\bdb\b|dumbbell|hammer curl|spider curl|concentration|incline curl|twist.?press|squeeze press|pull.?over|arnold|lateral raise|anterior raise|side.?hug|kickback|skull.?crush|zottman|fly|press combo/i, 'Dumbbells'],
        // Bench
        [/bench|incline|decline|preacher|prone|supine|spider curl|skull.?crush/i, 'Bench'],
        // Pull-up bar
        [/pull.?up|dead hang|hang|hanging|chin.?up/i, 'Pull-Up Bar'],
        // Barbell
        [/barbell|deadlift|squat|clean|snatch|landmine|jefferson|good morning|front squat|back squat|pendlay|t.?bar/i, 'Barbell'],
        // Landmine (separate from barbell for specificity)
        [/landmine/i, 'Landmine Attachment'],
        // Sled
        [/sled|drag/i, 'Sled'],
        // Rings / TRX
        [/ring|trx|suspension/i, 'Rings / TRX'],
        // Stability ball
        [/stability|ball crunch|hyperextend.*ball/i, 'Stability Ball'],
        // Ab wheel / Rollout
        [/rollout|ab wheel/i, 'Ab Wheel'],
        // Bands
        [/band|pull.?apart/i, 'Resistance Bands'],
        // Plate
        [/plate carry|plate pinch|weighted/i, 'Weight Plates'],
        // Rope (cable attachment)
        [/rope/i, 'Rope Attachment'],
        // Cardio
        [/run\b|treadmill|sprint/i, 'Treadmill / Track'],
        [/rower|row.*erg/i, 'Rower'],
        [/bike|assault/i, 'Assault Bike'],
        [/skierg/i, 'SkiErg'],
        [/jump rope/i, 'Jump Rope'],
        // Specialty
        [/yoke/i, 'Yoke'],
        [/tire/i, 'Tire'],
        [/battle rope/i, 'Battle Ropes'],
        [/kettlebell|\bkb\b/i, 'Kettlebell'],
        [/vest/i, 'Weighted Vest'],
        [/box|plyo/i, 'Plyo Box'],
        // Leg machines
        [/leg press/i, 'Leg Press Machine'],
        [/leg curl|leg extension|sitting.*curl|sitting.*ext/i, 'Leg Curl / Extension Machine'],
        // Farmer carry implies DBs already covered
        [/farmer/i, 'Dumbbells'],
        // Calf raise
        [/calf raise/i, 'Calf Raise Station'],
        // Roman chair / GHD
        [/roman|ghd|hyperextension/i, 'Roman Chair / GHD']
      ];
      exerciseNames.forEach(name => {
        rules.forEach(([pattern, label]) => {
          if (pattern.test(name)) found.add(label);
        });
      });
      // Also test the joined string for context clues
      rules.forEach(([pattern, label]) => {
        if (pattern.test(joined)) found.add(label);
      });
      return Array.from(found);
    }

    function standardFocusForDay(day) {
      return {
        Monday: 'Chest & Back',
        Wednesday: 'Arms',
        Friday: 'Core & Spine',
        Saturday: 'Legs & Shoulders'
      }[day] || 'Full Body';
    }

    function estimateDuration(blocks) {
      const minutes = Math.max(45, blocks.length * 12 + 12);
      return String(minutes);
    }

    function slug(input) {
      return String(input).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    function capitalize(value) {
      return value.charAt(0).toUpperCase() + value.slice(1);
    }

    init();
    updateBlockTimerDisplays();
