import { NextResponse } from 'next/server';
import { db, submitSale, submitExpense, sendTelegram } from '../../../lib/server.mjs';

export const runtime='nodejs';
const help=`Friends Included bot. A manager must link your Telegram user ID first.\nSales: /sale S01|Olivia Rose|A|One proud uncle|1000|50|30|20\nExpenses: /expense E01|Rented suit|Materials|120|A\nUse Company overhead for overhead expenses.`;
function parse(text,command,length) {
  const parts=text.slice(command.length).trim().split('|').map(x=>x.trim());
  if(parts.length!==length) throw Error(`Expected ${length} fields separated by |. Send /help for an example.`);
  return parts;
}
export async function POST(request) {
  if(!process.env.TELEGRAM_WEBHOOK_SECRET || request.headers.get('x-telegram-bot-api-secret-token')!==process.env.TELEGRAM_WEBHOOK_SECRET) return NextResponse.json({error:'Unauthorized'},{status:401});
  let chatId;
  try {
    const update=await request.json();
    const message=update.message;
    if(!message?.text || !message.chat?.id || !message.from?.id) return NextResponse.json({ok:true});
    chatId=message.chat.id;
    const userId=message.from.id;
    const text=message.text.trim();
    if(text.startsWith('/start')||text.startsWith('/help')) {
      await sendTelegram(chatId,`Your Telegram user ID: ${userId}. Your chat ID: ${chatId}.\n${help}`);
      return NextResponse.json({ok:true});
    }
    const {data:link,error}=await db().from('telegram_links').select('employee_name').eq('telegram_user_id',userId).maybeSingle();
    if(error) throw Error(error.message);
    if(!link) throw Error(`Your Telegram user ID ${userId} is not linked. Ask Svetlana to link it in Manager setup.`);
    let row;
    if(text.startsWith('/sale')) {
      const [reference,customer,project,description,amount,...split]=parse(text,'/sale',8);
      row=await submitSale({reference,customer,project,description,amount,proposed_split:split},link.employee_name,'Telegram',chatId);
      await sendTelegram(chatId,`Recorded sale ${row.reference}: €${(row.amount_cents/100).toFixed(2)}, project ${row.project}, ${row.status}.`);
    } else if(text.startsWith('/expense')) {
      const [reference,description,category,amount,proposed_allocation]=parse(text,'/expense',5);
      row=await submitExpense({reference,description,category,amount,proposed_allocation},link.employee_name,'Telegram',chatId);
      await sendTelegram(chatId,`Recorded expense ${row.reference}: €${(row.amount_cents/100).toFixed(2)}, proposed ${row.proposed_allocation}, ${row.status}.`);
    } else await sendTelegram(chatId,help);
  } catch(e) {
    if(chatId) try { await sendTelegram(chatId,`Submission failed: ${e.message}`); } catch {}
  }
  return NextResponse.json({ok:true});
}
