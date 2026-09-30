import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { commission, parseCents, validateSplit, validateReference, ALLOCATIONS, CATEGORIES } from './rules.mjs';

export function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw Error('Supabase is not configured.');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
function required(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw Error(`${label} is required.`);
  return result;
}
function check(error) { if (error) { if (error.code === '23505') throw Error('This reference already exists.'); throw Error(error.message); } }
export function requireRole(actor, allowed) {
  if (!allowed.includes(actor)) throw Error(`Permission denied for ${actor || 'unlinked user'}.`);
}

export async function submitSale(input, actor, source='Website', originalChatId=null) {
  requireRole(actor, ['Richard','Anastasia','Jean-Claude']);
  const row = {
    reference: validateReference(input.reference,'sale'), salesperson: actor,
    customer: required(input.customer,'Customer'), project: required(input.project,'Project'),
    description: required(input.description,'Description'), amount_cents: parseCents(input.amount),
    proposed_split: validateSplit(input.proposed_split), source,
    original_chat_id: originalChatId, status: 'Pending approval'
  };
  if (!['A','B'].includes(row.project)) throw Error('Project must be A or B.');
  const {data,error}=await db().from('sales').insert(row).select().single(); check(error);
  await syncRecord('sale',data.reference);
  return data;
}

export async function submitExpense(input, actor, source='Website', originalChatId=null) {
  requireRole(actor,['Kevin']);
  const proposed = required(input.proposed_allocation,'Proposed allocation');
  if (!ALLOCATIONS.includes(proposed)) throw Error('Invalid proposed allocation.');
  const category = required(input.category,'Category');
  if (!CATEGORIES.includes(category)) throw Error('Invalid category.');
  const row = {
    reference: validateReference(input.reference,'expense'), reporter: actor,
    description: required(input.description,'Description'), category,
    amount_cents: parseCents(input.amount), proposed_allocation: proposed,
    final_allocation: proposed === 'Company overhead' ? proposed : null,
    status: proposed === 'Company overhead' ? 'Allocated' : 'Awaiting allocation',
    source, original_chat_id: originalChatId
  };
  const {data,error}=await db().from('expenses').insert(row).select().single(); check(error);
  await syncRecord('expense',data.reference);
  return data;
}

export async function decideSale(reference, split, actor) {
  requireRole(actor,['Svetlana']);
  const final = validateSplit(split);
  const client=db();
  const {data,error}=await client.from('sales').update({final_split:final,status:'Approved',decided_at:new Date().toISOString(),notification_status:'Pending'}).eq('reference',reference).eq('status','Pending approval').select().maybeSingle(); check(error);
  if (!data) {
    const current=await getRecord('sale',reference);
    if (current?.status==='Approved') return {row:current,alreadyApproved:true};
    throw Error('Pending sale not found.');
  }
  await syncRecord('sale',reference);
  await notifyDecision('sale',reference);
  return {row:data,alreadyApproved:false};
}

export async function decideExpense(reference, allocation, actor) {
  requireRole(actor,['Svetlana']);
  if (!ALLOCATIONS.includes(allocation)) throw Error('Invalid final allocation.');
  const client=db();
  const {data,error}=await client.from('expenses').update({final_allocation:allocation,status:'Allocated',decided_at:new Date().toISOString(),notification_status:'Pending'}).eq('reference',reference).eq('status','Awaiting allocation').select().maybeSingle(); check(error);
  if (!data) {
    const current=await getRecord('expense',reference);
    if (current?.status==='Allocated') return {row:current,alreadyApproved:true};
    throw Error('Expense awaiting allocation not found.');
  }
  await syncRecord('expense',reference);
  await notifyDecision('expense',reference);
  return {row:data,alreadyApproved:false};
}

export async function getRecord(type,reference) {
  const {data,error}=await db().from(type==='sale'?'sales':'expenses').select('*').eq('reference',reference).maybeSingle(); check(error); return data;
}
export async function allRecords() {
  const client=db();
  const [s,e,l,c]=await Promise.all([client.from('sales').select('*').order('submitted_at'),client.from('expenses').select('*').order('submitted_at'),client.from('telegram_links').select('*'),client.from('test_checkpoints').select('*').order('label')]);
  check(s.error);check(e.error);check(l.error);check(c.error);
  return {sales:s.data,expenses:e.data,links:l.data,checkpoints:c.data};
}

function sheetClient() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_SPREADSHEET_ID) throw Error('Google Sheets is not configured.');
  const auth=new google.auth.JWT({email:process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,key:process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g,'\n'),scopes:['https://www.googleapis.com/auth/spreadsheets']});
  return google.sheets({version:'v4',auth});
}
function sheetValues(type,r) {
  if (type==='sale') {
    const earned=r.status==='Approved'?commission(r.amount_cents,r.final_split).amounts:[0,0,0];
    return [r.reference,r.submitted_at,r.salesperson,r.customer,r.project,r.description,(r.amount_cents/100).toFixed(2),...r.proposed_split,...(r.final_split||['','','']),...earned.map(x=>(x/100).toFixed(2)),r.status];
  }
  return [r.reference,r.submitted_at,r.reporter,r.description,r.category,(r.amount_cents/100).toFixed(2),r.proposed_allocation,r.final_allocation||'',r.status];
}
const HEADERS={
  sale:['Reference','Submission time','Salesperson','Customer','Project','Description','Amount EUR','Proposed Richard %','Proposed Anastasia %','Proposed Jean-Claude %','Approved Richard %','Approved Anastasia %','Approved Jean-Claude %','Richard earned EUR','Anastasia earned EUR','Jean-Claude earned EUR','Status'],
  expense:['Reference','Submission time','Reporter','Description','Category','Amount EUR','Proposed allocation','Final allocation','Status']
};
export async function syncRecord(type,reference) {
  const table=type==='sale'?'sales':'expenses', tab=type==='sale'?'Sales':'Expenses';
  const client=db();
  try {
    const r=await getRecord(type,reference);
    if (!r) throw Error('Record not found.');
    const sheets=sheetClient(), spreadsheetId=process.env.GOOGLE_SPREADSHEET_ID;
    const existing=await sheets.spreadsheets.values.get({spreadsheetId,range:`'${tab}'!A:A`});
    const refs=(existing.data.values||[]).map(x=>x[0]);
    if (refs[0]!=='Reference') await sheets.spreadsheets.values.update({spreadsheetId,range:`'${tab}'!A1`,valueInputOption:'RAW',requestBody:{values:[HEADERS[type]]}});
    const index=refs.indexOf(reference);
    const row=index>=0?index+1:Math.max(refs.length+1,2);
    await sheets.spreadsheets.values.update({spreadsheetId,range:`'${tab}'!A${row}`,valueInputOption:'RAW',requestBody:{values:[sheetValues(type,r)]}});
    await client.from(table).update({sync_status:'Synced',sync_error:null}).eq('reference',reference);
    return {status:'Synced',row};
  } catch(e) {
    await client.from(table).update({sync_status:'Sync failed',sync_error:String(e.message).slice(0,500)}).eq('reference',reference);
    return {status:'Sync failed',error:e.message};
  }
}

function decisionText(type,r) {
  if(type==='sale') {
    const {pool,amounts}=commission(r.amount_cents,r.final_split);
    const changed=r.final_split.some((p,i)=>p!==r.proposed_split[i]);
    return `Sale ${r.reference} approved — commission split ${changed?'changed':'confirmed'}. Sale €${(r.amount_cents/100).toFixed(2)}; total commission €${(pool/100).toFixed(2)}. ${['Richard','Anastasia','Jean-Claude'].map((name,i)=>`${name}: ${r.proposed_split[i]}%${changed?' → '+r.final_split[i]+'%':''} (€${(amounts[i]/100).toFixed(2)})`).join('. ')}.`;
  }
  return `Expense ${r.reference} — allocation ${r.final_allocation===r.proposed_allocation?'confirmed':'changed'}. €${(r.amount_cents/100).toFixed(2)}: ${r.description}. Proposed: ${r.proposed_allocation}. Approved: ${r.final_allocation}.`;
}
export async function sendTelegram(chatId,text) {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw Error('Telegram bot is not configured.');
  const response=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text})});
  const data=await response.json();
  if(!data.ok) throw Error(data.description||'Telegram delivery failed.');
  return data;
}
export async function notifyDecision(type,reference) {
  const table=type==='sale'?'sales':'expenses',client=db();
  const r=await getRecord(type,reference);
  if(!r || !r.decided_at) throw Error('Undecided record.');
  let chatId=r.original_chat_id;
  if(!chatId) {
    const {data,error}=await client.from('telegram_links').select('chat_id').eq('employee_name',type==='sale'?r.salesperson:r.reporter).order('updated_at',{ascending:false}).limit(1).maybeSingle();check(error);
    chatId=data?.chat_id;
  }
  if(!chatId) {
    await client.from(table).update({notification_status:'No Telegram recipient linked',notification_error:null}).eq('reference',reference);
    return {status:'No Telegram recipient linked'};
  }
  try {
    await sendTelegram(chatId,decisionText(type,r));
    await client.from(table).update({notification_status:'Sent',notification_error:null}).eq('reference',reference);
    return {status:'Sent'};
  } catch(e) {
    await client.from(table).update({notification_status:'Failed',notification_error:String(e.message).slice(0,500)}).eq('reference',reference);
    return {status:'Failed',error:e.message};
  }
}
