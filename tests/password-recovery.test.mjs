import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const recovery=await readFile(new URL('../src/password-recovery.js',import.meta.url),'utf8');
const index=await readFile(new URL('../index.html',import.meta.url),'utf8');

test('password recovery uses the supported Supabase flow',()=>{
 assert.match(recovery,/resetPasswordForEmail\(email\)/);
 assert.match(recovery,/PASSWORD_RECOVERY/);
 assert.match(recovery,/updateUser\(\{password\}\)/);
 assert.match(recovery,/autocomplete="new-password"/);
});

test('recovery listener loads before hash-routed app',()=>{
 const recoveryIndex=index.indexOf('/src/password-recovery.js');
 const appIndex=index.indexOf('/src/app.js');
 assert.ok(recoveryIndex>=0&&appIndex>=0&&recoveryIndex<appIndex);
});

test('reset request does not reveal whether an account exists',()=>{
 assert.match(recovery,/如果这个邮箱对应文研账户/);
 assert.doesNotMatch(recovery,/账号不存在|邮箱不存在/);
});
