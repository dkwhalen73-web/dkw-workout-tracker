# Dr. Gains Workout Tracker

This is a simple browser-based workout tracker for the Dr. Gains program. 

## Files

- `index.html`: page layout
- `styles.css`: styling
- `app.js`: app logic
- `current-workout.json`: today's workout file
- `parsed_db.js`: generated full program database
- `parser.js`: generator that rebuilds `parsed_db.js`
- `data/DrGains_8Week_Program_Reference.txt`: source text used by the parser
- `validate-workouts.js`: Node validator for workout data

## How To Use

1. Open `index.html` in a browser.
2. The app tries to load `current-workout.json` automatically.
3. Use `Build Workout` if you want to generate a session from the built-in program.
4. Use `Validate Data` on the Load tab if you want a quick browser check.

## Rebuild The Program Database

Run:

```bash
node parser.js > parsed_db.js
```

Simple meaning: this re-creates the big program file from the text reference in `data/`.

## Validate The Data

Run:

```bash
node validate-workouts.js
```

This checks that:

- `current-workout.json` is shaped correctly
- `parsed_db.js` is shaped correctly
- blocks and exercises have the fields the app expects
- duplicate ids are caught

## Safe Editing Order

If you are updating the workout system, use this order:

1. Edit `current-workout.json` for a one-day workout tweak.
2. Edit `data/DrGains_8Week_Program_Reference.txt` if the source program changed.
3. Rebuild `parsed_db.js` with `node parser.js > parsed_db.js`.
4. Run `node validate-workouts.js`.

That keeps the app data consistent and lowers the chance of silent breakage.
