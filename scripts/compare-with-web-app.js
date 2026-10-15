// Runs the made-up 9-player, groups-ON tournament on the OLD WEB APP's bracket code and prints the
// champion and standings, then compares them with the numbers pinned in __tests__/bracketRules.test.ts.
// Needs the web app's bracket files compiled once into a temporary folder (nothing in the web app changes):
//   cd <old web app folder>
//   npx tsc --outDir /tmp/web-lib --module commonjs --target es2020 --skipLibCheck --strict \
//     src/lib/types.ts src/lib/doubleElim.ts src/lib/engine.ts src/lib/tournament.ts \
//     src/lib/players.ts src/lib/roundNames.ts
//   node scripts/compare-with-web-app.js /tmp/web-lib
// Prints "MATCH" and exits 0 when the web app gives the same champion and standings.

const path = require('path');
const dir = process.argv[2];
if (!dir) {
  console.error(
    'Usage: node scripts/compare-with-web-app.js <folder with the compiled web app lib>',
  );
  process.exit(2);
}
const load = (name) => require(path.resolve(dir, name));
const { createTournament, buildPlayoff, computeStandings } = load('tournament');
const { reportScore, isComplete, champion } = load('engine');
const { winsToWin } = load('types');

// Same small random-number maker as the test, so seeding is identical.
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Math.random = mulberry32(12345);

const people = ['Ann', 'Bob', 'Cat', 'Dan', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy'];
// The fixed winners: whoever is earlier in this list always wins their match.
const strength = ['Gus', 'Ann', 'Ivy', 'Dan', 'Fay', 'Bob', 'Hal', 'Cat', 'Eve'];
const config = {
  groupFormat: { kind: 'bestOf', n: 3 },
  playoffFormat: { kind: 'bestOf', n: 3 },
  grandFinalFormat: { kind: 'bestOf', n: 5 },
  skipGroups: false,
};

function playByStrength(bracket, players) {
  let guard = 0;
  while (!isComplete(bracket) && guard++ < 500) {
    const m = bracket.matches.find((x) => x.winner === null && x.playerA && x.playerB);
    if (!m) break;
    const aWins =
      strength.indexOf(players[m.playerA].name) < strength.indexOf(players[m.playerB].name);
    const w = winsToWin(m.format);
    const res = reportScore(bracket, m.id, aWins ? w : 0, aWins ? 0 : w);
    if (!res.ok) throw new Error(res.reason);
  }
}

let t = createTournament(people, config);
for (const g of t.groups) playByStrength(g.bracket, t.players);
t = { ...t, playoff: buildPlayoff(t), phase: 'playoff' };
playByStrength(t.playoff, t.players);
t.phase = 'done';

const got = {
  champion: t.players[champion(t.playoff)].name,
  standings: computeStandings(t).map((id) => t.players[id].name),
};
const pinned = {
  champion: 'Gus',
  standings: ['Gus', 'Ann', 'Ivy', 'Dan', 'Bob', 'Fay', 'Eve', 'Cat', 'Hal'],
};
console.log('web app gives:', JSON.stringify(got));
console.log('test pins    :', JSON.stringify(pinned));
const same = JSON.stringify(got) === JSON.stringify(pinned);
console.log(same ? 'MATCH' : 'DIFFERENT');
process.exit(same ? 0 : 1);
