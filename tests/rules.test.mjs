import test from 'node:test';
import assert from 'node:assert/strict';
import {commission,parseCents,validateSplit,summarize} from '../lib/rules.mjs';

const sale=(ref,project,amount,split,status='Approved')=>({reference:ref,project,amount_cents:amount*100,final_split:split,status});
const expense=(ref,amount,allocation,status='Allocated')=>({reference:ref,amount_cents:amount*100,final_allocation:allocation,status});
test('exact first-test totals and cumulative second-test totals',()=>{
  const sales=[sale('S01','A',1000,[50,30,20]),sale('S02','B',2000,[20,40,40])];
  const expenses=[expense('E01',120,'A'),expense('E02',80,'A'),expense('E03',100,'Company overhead')];
  let r=summarize(sales,expenses);
  assert.deepEqual([r.projects.A.result,r.projects.B.result,r.companyResult,...r.earned],[70000,180000,240000,9000,11000,10000]);
  sales.push(sale('S03','A',1500,[20,30,50]),sale('S04','B',800,[25,25,50]),sale('S05','B',600,null,'Pending approval'));
  expenses.push(expense('E04',250,'B'),expense('E05',90,'B'),expense('E06',60,'Company overhead'),expense('E07',140,null,'Awaiting allocation'));
  r=summarize(sales,expenses);
  assert.deepEqual([r.projects.A.result,r.projects.B.result,r.companyResult,...r.earned,r.pendingSales,r.awaiting],[205000,218000,393000,14000,17500,21500,60000,14000]);
});
test('validates amounts and splits',()=>{
  assert.equal(parseCents('12.34'),1234);
  for(const amount of ['',0,-1,'1.234','abc']) assert.throws(()=>parseCents(amount));
  assert.throws(()=>validateSplit([60,30,20]));
  assert.throws(()=>validateSplit([-1,51,50]));
});
test('rounding remainder goes to largest share with Richard first on ties',()=>{
  assert.deepEqual(commission(5,[50,50,0]),{pool:1,amounts:[0,1,0]});
  assert.deepEqual(commission(15,[0,50,50]),{pool:2,amounts:[0,1,1]});
});
