import { NextResponse } from 'next/server';
import { allRecords, submitSale, submitExpense, decideSale, decideExpense, syncRecord, notifyDecision, db, requireRole } from '../../../lib/server.mjs';
import { summarize } from '../../../lib/rules.mjs';

export const runtime='nodejs';
export async function GET(request) {
  try {
    const role=new URL(request.url).searchParams.get('role');
    if (!['Richard','Anastasia','Jean-Claude','Kevin','Svetlana'].includes(role)) throw Error('Select a demonstration role.');
    const all=await allRecords();
    if (role==='Svetlana') return NextResponse.json({...all,summary:summarize(all.sales,all.expenses)});
    return NextResponse.json({
      sales:all.sales.filter(x=>x.salesperson===role),
      expenses:all.expenses.filter(x=>x.reporter===role),
      summary:null
    });
  } catch(e) { return NextResponse.json({error:e.message},{status:400}); }
}
export async function POST(request) {
  try {
    const body=await request.json();
    const actor=body.actor;
    let result;
    switch(body.action) {
      case 'submitSale': result=await submitSale(body.input,actor); break;
      case 'submitExpense': result=await submitExpense(body.input,actor); break;
      case 'decideSale': result=await decideSale(body.reference,body.split,actor); break;
      case 'decideExpense': result=await decideExpense(body.reference,body.allocation,actor); break;
      case 'retrySync':
        requireRole(actor,['Svetlana']);
        result=await syncRecord(body.type,body.reference); break;
      case 'retryNotification':
        requireRole(actor,['Svetlana']);
        result=await notifyDecision(body.type,body.reference); break;
      case 'setupWebhook': {
        requireRole(actor,['Svetlana']);
        if(!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_WEBHOOK_SECRET) throw Error('Telegram environment variables are missing.');
        const url=new URL('/api/telegram',request.url).toString();
        const response=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url,secret_token:process.env.TELEGRAM_WEBHOOK_SECRET,drop_pending_updates:true})});
        result=await response.json();
        if(!result.ok) throw Error(result.description||'Webhook setup failed.');
        break;
      }
      case 'linkTelegram': {
        requireRole(actor,['Svetlana']);
        if(!['Richard','Anastasia','Jean-Claude','Kevin','Svetlana'].includes(body.employee)) throw Error('Invalid employee.');
        if(!/^\d+$/.test(String(body.telegramUserId))) throw Error('Enter a numeric Telegram user ID.');
        if(!/^\d+$/.test(String(body.chatId))) throw Error('Enter a numeric Telegram chat ID.');
        const {data,error}=await db().from('telegram_links').upsert({telegram_user_id:body.telegramUserId,employee_name:body.employee,chat_id:body.chatId,updated_at:new Date().toISOString()},{onConflict:'telegram_user_id'}).select().single();
        if(error) throw Error(error.message);
        result=data;break;
      }
      default:throw Error('Unknown action.');
    }
    return NextResponse.json({ok:true,result});
  } catch(e) { return NextResponse.json({ok:false,error:e.message},{status:400}); }
}
