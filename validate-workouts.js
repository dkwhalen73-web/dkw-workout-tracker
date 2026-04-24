const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = __dirname;
const currentWorkoutPath = path.join(repoRoot, 'current-workout.json');
const parsedDbPath = path.join(repoRoot, 'parsed_db.js');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readParsedDb(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source}\nthis.__db = DR_GAINS_FULL_DB;`, context);
  return context.__db;
}

function validateExercise(exercise, location, errors) {
  if (!exercise || typeof exercise !== 'object') {
    errors.push(`${location}: exercise is missing or invalid`);
    return;
  }

  if (!exercise.id) errors.push(`${location}: exercise is missing id`);
  if (!exercise.name) errors.push(`${location}: exercise is missing name`);
  if (typeof exercise.target !== 'string') errors.push(`${location}: exercise target must be text`);
  if (!Number.isInteger(exercise.sets) || exercise.sets < 1) {
    errors.push(`${location}: exercise sets must be a whole number greater than 0`);
  }
  if (exercise.swaps && !Array.isArray(exercise.swaps)) {
    errors.push(`${location}: exercise swaps must be a list`);
  }
}

function validateSuperset(ss, location, errors) {
  if (!ss || typeof ss !== 'object') {
    errors.push(`${location}: superset group is missing or invalid`);
    return;
  }

  if (!Array.isArray(ss.exs) || ss.exs.length === 0) {
    errors.push(`${location}: superset group must contain at least one exercise`);
    return;
  }

  ss.exs.forEach((exercise, index) => {
    validateExercise(exercise, `${location} -> exercise ${index + 1}`, errors);
  });
}

function validateBlock(block, location, errors) {
  if (!block || typeof block !== 'object') {
    errors.push(`${location}: block is missing or invalid`);
    return;
  }

  if (!block.id) errors.push(`${location}: block is missing id`);
  if (!block.label) errors.push(`${location}: block is missing label`);
  if (!Array.isArray(block.ss) || block.ss.length === 0) {
    errors.push(`${location}: block must contain at least one superset or exercise group`);
    return;
  }

  block.ss.forEach((ss, index) => {
    validateSuperset(ss, `${location} -> group ${index + 1}`, errors);
  });
}

function validateWorkout(workout, label) {
  const errors = [];

  if (!workout || typeof workout !== 'object') {
    return [`${label}: workout is missing or invalid`];
  }

  if (!workout.title) errors.push(`${label}: workout is missing title`);
  if (!Array.isArray(workout.blocks)) {
    errors.push(`${label}: workout blocks must be a list`);
    return errors;
  }

  const seenIds = new Set();
  workout.blocks.forEach((block, blockIndex) => {
    validateBlock(block, `${label} -> block ${blockIndex + 1}`, errors);

    if (block && block.id) {
      if (seenIds.has(block.id)) {
        errors.push(`${label}: duplicate block id "${block.id}"`);
      }
      seenIds.add(block.id);
    }

    if (block && Array.isArray(block.ss)) {
      block.ss.forEach((ss) => {
        if (!ss || !Array.isArray(ss.exs)) return;
        ss.exs.forEach((exercise) => {
          if (!exercise || !exercise.id) return;
          if (seenIds.has(exercise.id)) {
            errors.push(`${label}: duplicate exercise id "${exercise.id}"`);
          }
          seenIds.add(exercise.id);
        });
      });
    }
  });

  return errors;
}

function validateProgramDb(db) {
  const errors = [];
  for (const [week, days] of Object.entries(db || {})) {
    for (const [day, workout] of Object.entries(days || {})) {
      const workoutErrors = validateWorkout(workout, `Program week ${week} ${day}`);
      errors.push(...workoutErrors);
    }
  }
  return errors;
}

function main() {
  const currentWorkout = readJson(currentWorkoutPath);
  const parsedDb = readParsedDb(parsedDbPath);

  const errors = [
    ...validateWorkout(currentWorkout, 'current-workout.json'),
    ...validateProgramDb(parsedDb)
  ];

  if (errors.length) {
    console.error('Workout validation failed:\n');
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log('Workout validation passed.');
  console.log('- current-workout.json is structurally valid');
  console.log('- parsed_db.js is structurally valid');
}

main();
