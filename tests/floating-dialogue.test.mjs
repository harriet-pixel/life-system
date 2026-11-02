import test from 'node:test';import assert from 'node:assert/strict';import {floatingDialogue} from '../assets/floating-dialogue.mjs';
test('floating dialogue preserves complete long responses and graphemes',()=>{for(const text of ['短句','字'.repeat(500),'👨‍👩‍👧‍👦'.repeat(60),'e\u0301'.repeat(60)])assert.equal(floatingDialogue(text),text);assert.equal(floatingDialogue(null),'');});
