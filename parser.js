const fs = require('fs');

const content = fs.readFileSync('/Users/danielwhalen/Library/CloudStorage/GoogleDrive-dkwhalen73@gmail.com/My Drive/Dev_World/Dr. Gains Workout Program/DrGains_8Week_Program_Reference.txt', 'utf8');

const weeks = {};
let currentWeek = null;
let currentDay = null;
let currentBlock = null;

const lines = content.split('\n');

function slugify(text) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function getSets(target) {
    const match = target.match(/^(\d+)x/);
    if (match) return parseInt(match[1]);
    if (target.toLowerCase().includes('sets')) {
        const setMatch = target.match(/(\d+)\s+sets/);
        if (setMatch) return parseInt(setMatch[1]);
    }
    if (target.toLowerCase().includes('round')) {
        const roundMatch = target.match(/(\d+)\s+round/);
        if (roundMatch) return parseInt(roundMatch[1]);
    }
    return 1;
}

let blockCounter = 0;
let exerciseCounter = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Week Header
    if (line.startsWith('========================================')) {
        const nextLine = lines[i+1]?.trim();
        if (nextLine && nextLine.startsWith('WEEK')) {
            const weekNum = nextLine.match(/WEEK\s+(\d+)/)[1];
            currentWeek = weekNum;
            weeks[currentWeek] = {
                Monday: { title: '', blocks: [] },
                Tuesday: { title: '', blocks: [] },
                Wednesday: { title: '', blocks: [] },
                Thursday: { title: '', blocks: [] },
                Friday: { title: '', blocks: [] },
                Saturday: { title: '', blocks: [] },
                Sunday: { title: 'REST', blocks: [] }
            };
            i++; // skip next line
            continue;
        }
    }

    // Day Header
    if (line.startsWith('--- ')) {
        const dayMatch = line.match(/--- (.*?)  \|  (.*?) ---/);
        if (dayMatch) {
            let rawDayName = dayMatch[1].trim().toUpperCase();
            const dayTitle = dayMatch[2].trim();
            // Map to the key in the object
            const dayMap = {
                'MONDAY': 'Monday',
                'TUESDAY': 'Tuesday',
                'WEDNESDAY': 'Wednesday',
                'THURSDAY': 'Thursday',
                'FRIDAY': 'Friday',
                'SATURDAY': 'Saturday',
                'SUNDAY': 'Sunday'
            };
            currentDay = dayMap[rawDayName] || rawDayName;
            if (weeks[currentWeek][currentDay]) {
                weeks[currentWeek][currentDay].title = `WEEK ${currentWeek} - ${currentDay.toUpperCase()}: ${dayTitle}`;
            }
            currentBlock = null;
            blockCounter = 0;
            exerciseCounter = 0;
        }
        continue;
    }

    if (!currentWeek || !currentDay) continue;

    // Check for Bootcamp or Rest
    if (line.startsWith('[BOOTCAMP DAY') || line.startsWith('REST')) {
        continue;
    }

    // Exercise line: Name | Target
    if (line.includes('|') && !line.startsWith('>')) {
        const parts = line.split('|');
        const name = parts[0].trim();
        const target = parts[1].trim();
        
        const isWarmup = name.toLowerCase().includes('warm-up') || (lines[i+1] && lines[i+1].toLowerCase().includes('warm-up'));
        const isFinisher = name.toLowerCase().includes('finisher');
        const ssMatch = name.match(/^(SS\d+[A-Z]|\d+[A-Z]):/);
        
        const exercise = {
            id: `w${currentWeek}_${currentDay.toLowerCase().substring(0,3)}__ex${++exerciseCounter}`,
            name: name,
            target: target,
            sets: getSets(target),
            cue: ''
        };

        // Get technical notes (cue) and rest info
        let nextI = i + 1;
        let rest = '';
        let ar = '';
        while (lines[nextI] && lines[nextI].trim().startsWith('>')) {
            const noteLine = lines[nextI].trim().substring(1).trim();
            exercise.cue += (exercise.cue ? ' ' : '') + noteLine;
            
            if (noteLine.includes('Rest:')) {
                const restPart = noteLine.split('|').find(p => p.includes('Rest:'));
                if (restPart) rest = restPart.replace('Rest:', '').trim();
                
                const arPart = noteLine.split('|').find(p => p.includes('Active Rest:'));
                if (arPart) ar = arPart.replace('Active Rest:', '').trim();
            }
            nextI++;
        }
        i = nextI - 1;

        // Block logic
        if (ssMatch) {
            const ssLabelPrefix = ssMatch[1].substring(0, ssMatch[1].length - 1); // e.g., "SS1"
            const expectedLabel = isFinisher ? 'FINISHER' : (isWarmup ? 'WARM-UP' : `SUPERSET ${ssLabelPrefix.replace('SS','')}`);
            
            // Check if we should add to existing block or start new one
            if (currentBlock && currentBlock.label === expectedLabel) {
                // It's a continuation of the current superset block
                if (ssMatch[1].endsWith('A')) {
                     // Sometimes there are multiple "A"s in some weird cases or it's a new superset within same label? 
                     // Usually A starts it. If we already have an A and get another A, it might be a new SS in same block?
                     // But for Dr. Gains, SS1A, SS1B are grouped.
                     currentBlock.ss.push({
                        label: name.split(':')[0],
                        rest: rest,
                        ar: ar,
                        exs: [exercise]
                    });
                } else {
                    // It's B, C, etc. Find the last SS in this block
                    let targetSS = currentBlock.ss[currentBlock.ss.length - 1];
                    targetSS.exs.push(exercise);
                    if (rest) targetSS.rest = rest;
                    if (ar) targetSS.ar = ar;
                    // Update label
                    if (!targetSS.label.includes(ssMatch[1])) {
                         targetSS.label = targetSS.label + ' & ' + ssMatch[1];
                    }
                }
            } else {
                // New Block
                currentBlock = {
                    id: `w${currentWeek}_${currentDay.toLowerCase().substring(0,3)}__b${++blockCounter}`,
                    label: isFinisher ? 'FINISHER' : (isWarmup ? 'WARM-UP' : `SUPERSET ${ssLabelPrefix.replace('SS','')}`),
                    type: isWarmup ? 'warmup' : 'exercise',
                    ss: [{
                        label: name.split(':')[0],
                        rest: rest,
                        ar: ar,
                        exs: [exercise]
                    }]
                };
                weeks[currentWeek][currentDay].blocks.push(currentBlock);
            }
        } else {
            // Single exercise block
            currentBlock = {
                id: `w${currentWeek}_${currentDay.toLowerCase().substring(0,3)}__b${++blockCounter}`,
                label: isWarmup ? 'WARM-UP' : (isFinisher ? 'FINISHER' : 'EXERCISE'),
                type: isWarmup ? 'warmup' : 'exercise',
                ss: [{
                    label: isFinisher ? 'FINISHER' : (isWarmup ? 'WARM-UP' : 'SINGLE'),
                    rest: rest,
                    ar: ar,
                    exs: [exercise]
                }]
            };
            weeks[currentWeek][currentDay].blocks.push(currentBlock);
        }
    }
}

// Final cleanup: Infer types more accurately from day title
for (const w in weeks) {
    for (const d in weeks[w]) {
        const day = weeks[w][d];
        const titleLower = day.title.toLowerCase();
        let inferredType = 'exercise';
        if (titleLower.includes('chest')) inferredType = 'chest';
        if (titleLower.includes('back')) inferredType = 'back';
        if (titleLower.includes('biceps')) inferredType = 'biceps';
        if (titleLower.includes('triceps')) inferredType = 'triceps';
        if (titleLower.includes('core')) inferredType = 'core';
        if (titleLower.includes('legs')) inferredType = 'legs';
        if (titleLower.includes('shoulders')) inferredType = 'shoulders';

        day.blocks.forEach(b => {
            if (b.type !== 'warmup') {
                // Try to be more specific based on exercise names if possible
                // but day-level inference is a good fallback
                b.type = inferredType;
            }
        });
    }
}

console.log('const DR_GAINS_FULL_DB = ' + JSON.stringify(weeks, null, 2) + ';');
