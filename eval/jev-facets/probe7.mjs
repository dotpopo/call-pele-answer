// live probe: bare noul vs noul with block context + true/false criteria (TypeSafe guidance)
import { readFileSync } from 'node:fs';
import { FACETS } from '../../skills/call-pele-answer/scripts/core/facets.mjs';
const all = ['real','runs','fresh','final','blocks'].flatMap(f => JSON.parse(readFileSync(f + '.json')).map(b => ({ ...b, set: f })));
const pick = id => all.find(b => b.id.endsWith(id));
const CASES = {
  percentages: { neg: ['pele-019#6'], pos: [] },
  code: { neg: ['pele-038#5'], pos: ['pele-066#9', 'code1', 'code2'] },
  messages: { neg: ['pele-025#2', 'pele-025#4'], pos: ['seq1'] },
  dated_events: { neg: ['pele-098#4'], pos: [] },
  alternatives: { neg: ['pele-028#6', 'pele-097#1'], pos: ['pele-049#3'] },
  modules_grid: { neg: ['pele-064#5', 'pele-036#1'], pos: [] },
};
const NEW = {
  percentages: { type: 'noul', instructions: { question: 'Is `block` built around several percentages that are shares of one whole?', context: 'This block is one part of a longer answer. A chart is drawn only when the numbers are what the block is about.' },
    criteria: { true: 'Three or more parts of one whole each get a percentage, such as 45% rent, 30% food, 25% savings.', false: 'A single percentage appears as a threshold or a detail inside a sentence, such as "if the score has not fallen by 30%".' } },
  code: { type: 'noul', instructions: { question: 'Is code or a command something the reader of `block` is meant to copy and run?', context: 'This block is one part of a longer answer.' },
    criteria: { true: 'The block gives code lines or a command line to type, such as "run npm run build && npm start" or several lines of Python.', false: 'A command name only labels something in a list or form, such as "system version (winver)", and the block is about something else.' } },
  messages: { type: 'noul', instructions: { question: 'Does `block` walk through messages passed back and forth between two or more named parties, in order?', context: 'This block is one part of a longer answer. A sequence diagram is drawn only when the block itself is that exchange.' },
    criteria: { true: 'The block lists who sends what to whom in turn, such as "the browser sends ClientHello, the server replies ServerHello, the browser sends Finished".', false: 'The block explains why something works and only names a message in passing, such as "the server cannot confirm the client got its SYN".' } },
  dated_events: { type: 'noul', instructions: { question: 'Is `block` a sequence of events ordered by their dates?', context: 'This block is one part of a longer answer.' },
    criteria: { true: 'Three or more events each have their own date, and the dates order them, such as a history from 1905 to 1919 to 2015.', false: 'A date or year appears as background to an explanation of ideas, such as "completed in 1915. Core insights: ...".' } },
  alternatives: { type: 'noul', instructions: { question: 'Does `block` present two or more alternative approaches the reader chooses between?', context: 'This block is one part of a longer answer.' },
    criteria: { true: 'The block names options the reader picks one of, each with its own details, such as "choose Vue if ..., choose React if ...".', false: 'The block mentions a word like plan or option once, or explains how to use one method, such as "the team puts changes into quadrants; top right goes into the sprint".' } },
  modules_grid: { type: 'noul', instructions: { question: 'Does `block` describe a system whose modules sit in rows or layers, where each layer is made of parts?', context: 'This block is one part of a longer answer.' },
    criteria: { true: 'The block names layers or rows of a software or hardware system and the modules in each, such as "UI layer: web, app; service layer: order, payment".', false: 'The block is a numbered list of management or strategy ideas that are called layers, such as "goal layer: OKR; transparency layer: docs".' } },
};
const ask = async (state, questions) => { const r = await fetch('https://classifier.dev/v1/systemone', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer unused' }, body: JSON.stringify({ state, model: 'jev-latest', questions }) }); const j = await r.json(); if (!r.ok) throw new Error(r.status + JSON.stringify(j)); return j; };
for (const [f, c] of Object.entries(CASES)) for (const [kind, ids] of [['neg', c.neg], ['pos', c.pos]]) for (const id of ids) {
  const b = pick(id); if (!b) { console.log('missing', id); continue; }
  const j = await ask({ block: b.text }, { old: { ...FACETS[f], instructions: FACETS[f].instructions.replace('the text', '`block`') }, new: NEW[f] });
  console.log(f.padEnd(13), kind, id.padEnd(12), 'bare', j.answers.old.noul.toFixed(2), '→ new', j.answers.new.noul.toFixed(2), j.model || '');
}
