'use client';
import {useEffect,useState} from 'react';

const PEOPLE=['Richard','Anastasia','Jean-Claude','Kevin','Svetlana'];
const money=n=>`€${((n||0)/100).toFixed(2)}`;
async function api(payload) {
  const response=await fetch('/api/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const result=await response.json();
  if(!response.ok) throw Error(result.error||'Request failed.');
  return result.result;
}
function Status({value}) {return <span className={'status '+String(value||'').toLowerCase().replace(/\W+/g,'-')}>{value}</span>}
export default function Page() {
  const [role,setRole]=useState('Richard');
  const [data,setData]=useState({sales:[],expenses:[],links:[],checkpoints:[],summary:null});
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [sale,setSale]=useState({reference:'',customer:'',project:'A',description:'',amount:'',proposed_split:[50,30,20]});
  const [expense,setExpense]=useState({reference:'',description:'',category:'Materials',amount:'',proposed_allocation:'A'});
  const [link,setLink]=useState({telegramUserId:'',chatId:'',employee:'Richard'});
  async function refresh() {
    const response=await fetch(`/api/action?role=${encodeURIComponent(role)}`,{cache:'no-store'});
    const result=await response.json();
    if(!response.ok) throw Error(result.error);
    setData(result);
  }
  useEffect(()=>{refresh().catch(e=>setMessage(e.message))},[role]);
  async function act(payload,success='Saved.') {
    setBusy(true);setMessage('');
    try {const result=await api({actor:role,...payload});await refresh();setMessage(success+(result?.alreadyApproved?' Already approved; totals unchanged.':''));}
    catch(e){setMessage(e.message)}finally{setBusy(false)}
  }
  const salesRole=['Richard','Anastasia','Jean-Claude'].includes(role);
  const manager=role==='Svetlana';
  const summary=data.summary;
  return <main>
    <header className="hero">
      <div className="eyebrow">FRIENDS INCLUDED LTD · FINANCE SYSTEM</div>
      <h1>Wedding guests, accounted for.</h1>
      <p>Service delivered. Sale reported. Decisions recorded. Laura Sirmā’s Day 4 homework.</p>
      <div className="heroLinks">
        <a href="https://t.me/weeeedingbot" target="_blank">Telegram bot ↗</a>
        <a href={process.env.NEXT_PUBLIC_SHEETS_URL||'#'} target="_blank">Sales & Expenses sheet ↗</a>
        <a href={process.env.NEXT_PUBLIC_GITHUB_URL||'#'} target="_blank">GitHub source ↗</a>
      </div>
    </header>
    <section className="intro card">
      <label>Demonstration role<select value={role} onChange={e=>setRole(e.target.value)}>{PEOPLE.map(p=><option key={p}>{p}</option>)}</select></label>
      <p>Choose a salesperson to enter a sale, Kevin to enter an expense, or Svetlana to review decisions and finances. Telegram users must be linked by their numeric user ID in Manager setup.</p>
    </section>
    {message&&<div role="alert" className="message">{message}</div>}
    {salesRole&&<section className="card"><h2>Report a sale</h2><form onSubmit={e=>{e.preventDefault();act({action:'submitSale',input:sale},'Sale recorded.');}}>
      <div className="grid"><label>Reference<input required value={sale.reference} onChange={e=>setSale({...sale,reference:e.target.value})} placeholder="S06"/></label><label>Customer<input required value={sale.customer} onChange={e=>setSale({...sale,customer:e.target.value})}/></label><label>Project<select value={sale.project} onChange={e=>setSale({...sale,project:e.target.value})}><option value="A">A — Respectable Relatives</option><option value="B">B — Drunk University Friends</option></select></label><label>Amount (€)<input required type="number" min="0.01" step="0.01" value={sale.amount} onChange={e=>setSale({...sale,amount:e.target.value})}/></label></div>
      <label>Description<textarea required value={sale.description} onChange={e=>setSale({...sale,description:e.target.value})}/></label>
      <p className="subheading">Proposed commission split of the 10% pool</p><div className="grid three">{['Richard','Anastasia','Jean-Claude'].map((p,i)=><label key={p}>{p} %<input required type="number" min="0" max="100" step="1" value={sale.proposed_split[i]} onChange={e=>setSale({...sale,proposed_split:sale.proposed_split.map((v,j)=>i===j?e.target.value:v)})}/></label>)}</div>
      <button disabled={busy}>Submit sale</button>
    </form></section>}
    {role==='Kevin'&&<section className="card"><h2>Report an expense</h2><form onSubmit={e=>{e.preventDefault();act({action:'submitExpense',input:expense},'Expense recorded.');}}>
      <div className="grid"><label>Reference<input required value={expense.reference} onChange={e=>setExpense({...expense,reference:e.target.value})} placeholder="E08"/></label><label>Amount (€)<input required type="number" min="0.01" step="0.01" value={expense.amount} onChange={e=>setExpense({...expense,amount:e.target.value})}/></label><label>Category<select value={expense.category} onChange={e=>setExpense({...expense,category:e.target.value})}>{['Materials','Travel','Other'].map(x=><option key={x}>{x}</option>)}</select></label><label>Proposed allocation<select value={expense.proposed_allocation} onChange={e=>setExpense({...expense,proposed_allocation:e.target.value})}><option value="A">A — Respectable Relatives</option><option value="B">B — Drunk University Friends</option><option>Company overhead</option></select></label></div>
      <label>Description<textarea required value={expense.description} onChange={e=>setExpense({...expense,description:e.target.value})}/></label><button disabled={busy}>Submit expense</button>
    </form></section>}
    {manager&&summary&&<><section className="dashboard"><h2>Financial dashboard</h2><div className="metrics"><div className="metric"><span>Company result</span><strong>{money(summary.companyResult)}</strong></div><div className="metric"><span>Pending sales</span><strong>{money(summary.pendingSales)}</strong></div><div className="metric"><span>Overhead</span><strong>{money(summary.overhead)}</strong></div><div className="metric"><span>Awaiting allocation</span><strong>{money(summary.awaiting)}</strong></div></div><div className="grid projectGrid">{['A','B'].map(p=><article className="card" key={p}><h3>Project {p}</h3><dl><div><dt>Approved income</dt><dd>{money(summary.projects[p].income)}</dd></div><div><dt>Commission expense</dt><dd>{money(summary.projects[p].commission)}</dd></div><div><dt>Allocated expenses</dt><dd>{money(summary.projects[p].expenses)}</dd></div><div className="total"><dt>Result</dt><dd>{money(summary.projects[p].result)}</dd></div></dl></article>)}</div><div className="card"><h3>Cumulative commission earned</h3><div className="commission">{['Richard','Anastasia','Jean-Claude'].map((p,i)=><div key={p}><span>{p}</span><strong>{money(summary.earned[i])}</strong></div>)}</div></div></section>
      <section className="card"><h2>Test result checkpoints</h2><p>Capture each checkpoint after verifying its live records. Saved results remain visible when later transactions change the dashboard.</p><div className="grid"><button disabled={busy||data.checkpoints?.some(x=>x.label==='Test 1')} onClick={()=>act({action:'captureCheckpoint',label:'Test 1'},'Test 1 results captured.')}>Capture Test 1</button><button disabled={busy||data.checkpoints?.some(x=>x.label==='Test 2')} onClick={()=>act({action:'captureCheckpoint',label:'Test 2'},'Test 2 results captured.')}>Capture Test 2</button></div></section>
      <section className="card"><h2>Manager setup</h2><p>Connect the bot after deployment, then send <code>/start</code> to it to see your Telegram user and chat IDs. Link that account to a fictional employee here. Changing a link does not change a submitted transaction’s original chat destination.</p><button disabled={busy} onClick={()=>act({action:'setupWebhook'},'Bot webhook connected.')}>Connect Telegram bot</button><form onSubmit={e=>{e.preventDefault();act({action:'linkTelegram',...link},'Telegram account linked.');}}><div className="grid three"><label>Telegram user ID<input required value={link.telegramUserId} onChange={e=>setLink({...link,telegramUserId:e.target.value})}/></label><label>Chat ID<input required value={link.chatId} onChange={e=>setLink({...link,chatId:e.target.value})}/></label><label>Employee<select value={link.employee} onChange={e=>setLink({...link,employee:e.target.value})}>{PEOPLE.map(p=><option key={p}>{p}</option>)}</select></label></div><button disabled={busy}>Save link</button></form><div className="linksList">{data.links?.map(x=><p key={x.telegram_user_id}>{x.telegram_user_id} → {x.employee_name} · chat {x.chat_id}</p>)}</div></section>
    </>}
    {!!data.checkpoints?.length&&<section className="card"><h2>Completed test results</h2><div className="grid projectGrid">{data.checkpoints.map(x=><article key={x.label}><h3>{x.label}</h3><p>Project A {money(x.summary.projects.A.result)} · Project B {money(x.summary.projects.B.result)}</p><p>Company {money(x.summary.companyResult)}</p><p>Commission: Richard {money(x.summary.earned[0])}, Anastasia {money(x.summary.earned[1])}, Jean-Claude {money(x.summary.earned[2])}</p><small>Captured {new Date(x.captured_at).toLocaleString()}</small></article>)}</div></section>}
    <section className="card"><h2>{manager?'All sales':'My sales'}</h2><div className="tableWrap"><table><thead><tr><th>Ref</th><th>Salesperson</th><th>Customer</th><th>Project</th><th>Amount</th><th>Proposed R / A / J</th><th>Final R / A / J</th><th>Status</th><th>Sync</th><th>Notice</th>{manager&&<th>Decision</th>}</tr></thead><tbody>{data.sales.map(r=><tr key={r.reference}><td>{r.reference}</td><td>{r.salesperson}</td><td>{r.customer}<small>{r.description}</small></td><td>{r.project}</td><td>{money(r.amount_cents)}</td><td>{r.proposed_split.join(' / ')}</td><td>{r.final_split?.join(' / ')||'—'}</td><td><Status value={r.status}/></td><td><Status value={r.sync_status}/>{manager&&r.sync_status!=='Synced'&&<button className="small" onClick={()=>act({action:'retrySync',type:'sale',reference:r.reference},'Sync retried.')}>Retry</button>}</td><td><Status value={r.notification_status}/>{manager&&r.notification_status==='Failed'&&<button className="small" onClick={()=>act({action:'retryNotification',type:'sale',reference:r.reference},'Notification retried.')}>Retry</button>}</td>{manager&&<td>{r.status==='Pending approval'&&<DecisionSale row={r} act={act} busy={busy}/>}</td>}</tr>)}</tbody></table></div></section>
    <section className="card"><h2>{manager?'All expenses':'My expenses'}</h2><div className="tableWrap"><table><thead><tr><th>Ref</th><th>Reporter</th><th>Description</th><th>Category</th><th>Amount</th><th>Proposed</th><th>Final</th><th>Status</th><th>Sync</th><th>Notice</th>{manager&&<th>Decision</th>}</tr></thead><tbody>{data.expenses.map(r=><tr key={r.reference}><td>{r.reference}</td><td>{r.reporter}</td><td>{r.description}</td><td>{r.category}</td><td>{money(r.amount_cents)}</td><td>{r.proposed_allocation}</td><td>{r.final_allocation||'—'}</td><td><Status value={r.status}/></td><td><Status value={r.sync_status}/>{manager&&r.sync_status!=='Synced'&&<button className="small" onClick={()=>act({action:'retrySync',type:'expense',reference:r.reference},'Sync retried.')}>Retry</button>}</td><td><Status value={r.notification_status}/>{manager&&r.notification_status==='Failed'&&<button className="small" onClick={()=>act({action:'retryNotification',type:'expense',reference:r.reference},'Notification retried.')}>Retry</button>}</td>{manager&&<td>{r.status==='Awaiting allocation'&&<DecisionExpense row={r} act={act} busy={busy}/>}</td>}</tr>)}</tbody></table></div></section>
    <footer>Supabase stores the records and decisions. Google Sheets mirrors them for review. Pending sales do not enter results; recorded expenses reduce company result immediately.</footer>
  </main>;
}
function DecisionSale({row,act,busy}) {const [split,setSplit]=useState(row.proposed_split);return <div className="decision"><div className="split">{split.map((n,i)=><input key={i} aria-label={['Richard %','Anastasia %','Jean-Claude %'][i]} type="number" min="0" max="100" value={n} onChange={e=>setSplit(split.map((x,j)=>j===i?e.target.value:x))}/>)}</div><button disabled={busy} className="small" onClick={()=>act({action:'decideSale',reference:row.reference,split},'Sale approved.')}>Approve</button></div>}
function DecisionExpense({row,act,busy}) {const [allocation,setAllocation]=useState(row.proposed_allocation);return <div className="decision"><select value={allocation} onChange={e=>setAllocation(e.target.value)}><option value="A">A</option><option value="B">B</option><option>Company overhead</option></select><button disabled={busy} className="small" onClick={()=>act({action:'decideExpense',reference:row.reference,allocation},'Expense allocated.')}>Approve</button></div>}
