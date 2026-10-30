import test from 'node:test';import assert from 'node:assert/strict';
import {validateChatBackup} from '../assets/chat-backup.mjs';
import {CHAT_TTL} from '../assets/chat-model.mjs';
const now=Date.now(),doc={companion:{characters:[{characterId:'a',createdAt:'original'}]}},message={role:'user',text:'全文',createdAt:now-1000,expiresAt:now-1000+CHAT_TTL},row={id:'turn',characterId:'a',characterCreatedAt:'original',messages:[message]};
test('chat backup validation preserves original expiry and accepts a still-live assistant after user expiry',()=>{const copy=validateChatBackup([row],doc,now);assert.deepEqual(copy,[row]);assert.notEqual(copy[0],row);assert.equal(validateChatBackup([{...row,messages:[{...message,role:'assistant',emotionId:'calm'}]}],doc,now)[0].messages[0].role,'assistant');});
test('chat backup refuses foreign identity, duplicate turns, malformed TTL, unknown fields and oversized content',()=>{for(const rows of [[{...row,characterCreatedAt:'other'}],[row,row],[{...row,messages:[{...message,expiresAt:now+CHAT_TTL}]}],[{...row,accessToken:'bad'}],[{...row,messages:[{...message,text:'x'.repeat(2001)}]}]])assert.throws(()=>validateChatBackup(rows,doc,now));});
