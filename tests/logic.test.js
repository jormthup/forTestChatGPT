import test from 'node:test';
import assert from 'node:assert/strict';
import {totals,canSell,thaiDay} from '../logic.js';
test('discount applied before VAT and rounded to satang',()=>assert.deepEqual(totals([{price:75,qty:2}],10,7),{subtotal:150,discount:10,vat:9.8,total:149.8}));
test('discount cannot produce negative total',()=>assert.equal(totals([{price:60,qty:1}],100).total,0));
test('stock counts the same drink with different options together',()=>{assert.equal(canSell([{id:'1',qty:2},{id:'1',qty:2}],[{id:'1',stock:3}]),false);assert.equal(canSell([{id:'1',qty:3}],[{id:'1',stock:3}]),true);});
test('report day follows Bangkok midnight',()=>assert.equal(thaiDay('2026-11-02T18:00:00Z'),'2026-11-03'));
