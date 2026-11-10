import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLDraw, readStudioFile } from '../src/builder/studioFormat.js';

test('сохраняет трансформации вложенных сборок и наследуемый цвет', () => {
 const text = `0 FILE main.ldr\n1 4 20 0 0 1 0 0 0 1 0 0 0 1 sub.ldr\n0 FILE sub.ldr\n1 16 0 10 0 1 0 0 0 1 0 0 0 1 3001.dat`;
 const {parts}=parseLDraw(text); assert.equal(parts.length,1); assert.equal(parts[0].color,'4'); assert.deepEqual(parts[0].matrix.slice(12,15),[20,10,0]); assert.equal(parts[0].id,'3001.dat');
});
test('не теряет неизвестный идентификатор',()=>{const p=parseLDraw('1 7 0 0 0 1 0 0 0 1 0 0 0 1 unknown.dat');assert.equal(p.parts[0].id,'unknown.dat');});
test('отклоняет некорректный архив и пустую модель',async()=>{await assert.rejects(readStudioFile(new File(['not a zip'],'bad.io')));assert.throws(()=>parseLDraw('0 empty'));});
test('прерывает циклические ссылки',()=>{assert.throws(()=>parseLDraw('0 FILE a.ldr\n1 16 0 0 0 1 0 0 0 1 0 0 0 1 a.ldr'));});
