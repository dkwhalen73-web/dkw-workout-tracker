const fs = require('fs');
const path = require('path');

const SOURCE_FILE = path.join(__dirname, 'data', 'DrGains_8Week_Program_Reference.txt');
const content = fs.readFileSync(SOURCE_FILE, 'utf8');

const weeks = {};
let currentWeek = null;
let currentDay = null;
let currentBlock = null;

const lines = content.split('\n');

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

function inferDayType(title) {
    const titleLower = title.toLowerCase();
    const matches = [];
    const rules = [
        ['chest', 'chest'],
        ['back', 'back'],
        ['biceps', 'biceps'],
        ['triceps', 'triceps'],
        ['forearms', 'forearms'],
        ['core', 'core'],
        ['spine', 'spine'],
        ['legs', 'legs'],
        ['shoulders', 'shoulders']
    ];

    for (const [needle, label] of rules) {
        if (titleLower.includes(needle)) matches.push(label);
    }

    if (matches.includes('biceps') || matches.includes('triceps') || matches.includes('forearms')) {
        return 'arms';
    }

    if (matches.includes('chest') && matches.includes('back')) {
        return 'upper';
    }

    if (matches.includes('legs') && matches.includes('shoulders')) {
        return 'legs_shoulders';
    }

    if (matches.includes('core') || matches.includes('spine')) {
        return 'core';
    }

    return matches[0] || 'exercise';
}

let blockCounter = 0;
let exerciseCounter = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('========================================')) {
        const nextLine = lines[i + 1]?.trim();
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
            i++;
            continue;
        }
    }

    if (line.startsWith('--- ')) {
        const dayMatch = line.match(/--- (.*?)  \|  (.*?) ---/);
        if (dayMatch) {
            const rawDayName = dayMatch[1].trim().toUpperCase();
            const dayTitle = dayMatch[2].trim();
            const dayMap = {
                MONDAY: 'Monday',
                TUESDAY: 'Tuesday',
                WEDNESDAY: 'Wednesday',
                THURSDAY: 'Thursday',
                FRIDAY: 'Friday',
                SATURDAY: 'Saturday',
                SUNDAY: 'Sunday'
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

    if (line.startsWith('[BOOTCAMP DAY') || line.startsWith('REST')) {
        continue;
    }

    if (line.includes('|') && !line.startsWith('>')) {
        const parts = line.split('|');
        const name = parts[0].trim();
        const target = parts[1].trim();

        const isWarmup = name.toLowerCase().includes('warm-up') || (lines[i + 1] && lines[i + 1].toLowerCase().includes('warm-up'));
        const isFinisher = name.toLowerCase().includes('finisher');
        const ssMatch = name.match(/^(SS\d+[A-Z]|\d+[A-Z]):/);

        const exercise = {
            id: `w${currentWeek}_${currentDay.toLowerCase().substring(0, 3)}__ex${++exerciseCounter}`,
            name,
            target,
            sets: getSets(target),
            cue: ''
        };

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

        if (ssMatch) {
            const ssLabelPrefix = ssMatch[1].substring(0, ssMatch[1].length - 1);
            const expectedLabel = isFinisher ? 'FINISHER' : (isWarmup ? 'WARM-UP' : `SUPERSET ${ssLabelPrefix.replace('SS', '')}`);

            if (currentBlock && currentBlock.label === expectedLabel) {
                if (ssMatch[1].endsWith('A')) {
                    currentBlock.ss.push({
                        label: name.split(':')[0],
                        rest,
                        ar,
                        exs: [exercise]
                    });
                } else {
                    const targetSS = currentBlock.ss[currentBlock.ss.length - 1];
                    targetSS.exs.push(exercise);
                    if (rest) targetSS.rest = rest;
                    if (ar) targetSS.ar = ar;
                    if (!targetSS.label.includes(ssMatch[1])) {
                        targetSS.label = `${targetSS.label} & ${ssMatch[1]}`;
                    }
                }
            } else {
                currentBlock = {
                    id: `w${currentWeek}_${currentDay.toLowerCase().substring(0, 3)}__b${++blockCounter}`,
                    label: isFinisher ? 'FINISHER' : (isWarmup ? 'WARM-UP' : `SUPERSET ${ssLabelPrefix.replace('SS', '')}`),
                    type: isWarmup ? 'warmup' : 'exercise',
                    ss: [{
                        label: name.split(':')[0],
                        rest,
                        ar,
                        exs: [exercise]
                    }]
                };
                weeks[currentWeek][currentDay].blocks.push(currentBlock);
            }
        } else {
            currentBlock = {
                id: `w${currentWeek}_${currentDay.toLowerCase().substring(0, 3)}__b${++blockCounter}`,
                label: isWarmup ? 'WARM-UP' : (isFinisher ? 'FINISHER' : 'EXERCISE'),
                type: isWarmup ? 'warmup' : 'exercise',
                ss: [{
                    label: isFinisher ? 'FINISHER' : (isWarmup ? 'WARM-UP' : 'SINGLE'),
                    rest,
                    ar,
                    exs: [exercise]
                }]
            };
            weeks[currentWeek][currentDay].blocks.push(currentBlock);
        }
    }
}

for (const w in weeks) {
    for (const d in weeks[w]) {
        const day = weeks[w][d];
        const inferredType = inferDayType(day.title);

        day.blocks.forEach(b => {
            if (b.type !== 'warmup') {
                b.type = inferredType;
            }
        });
    }
}

console.log('const DR_GAINS_FULL_DB = ' + JSON.stringify(weeks, null, 2) + ';');
