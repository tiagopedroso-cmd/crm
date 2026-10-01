"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, RotateCcw } from "lucide-react";
import { useProfile, useReference, useRefresh } from "@/hooks/use-crm";
import { followupDate, renderTemplate } from "@/lib/outreach";
import { inputToInstant, whatsappUrl } from "@/lib/utils";
import { confirmCadenceFollowup, getCadenceContext, scheduleCadenceFollowup } from "@/services/outreach";
import type { Lead } from "@/types/crm";
import { Modal, Notice } from "@/components/ui";

export function FollowupButton({lead,compact=false}:{lead:Lead;compact?:boolean}) {
 const profile=useProfile(); const refs=useReference(); const refresh=useRefresh();
 const [open,setOpen]=useState(false); const [phase,setPhase]=useState<"edit"|"confirm"|"schedule">("edit"); const [message,setMessage]=useState(""); const [sentId,setSentId]=useState(""); const [notice,setNotice]=useState(""); const [busy,setBusy]=useState(false); const [at,setAt]=useState(followupDate);
 const q=useQuery({queryKey:["cadence",lead.id],queryFn:()=>getCadenceContext(lead.id),enabled:lead.stage==="CONTATADO"});
 if(lead.stage!=="CONTATADO") return null;
 if(q.isLoading) return <button disabled className={compact?"icon-btn":"btn wide"}><RotateCcw size={16}/>{!compact&&"Preparando…"}</button>;
 const c=q.data;
 if(!c || c.status!=="IN_PROGRESS" || !c.next_message) return c?.status==="COMPLETED"&&!compact?<span className="badge green">Cadência concluída</span>:null;
 const next=c.current_step+1;
 function start(){ const product=refs.data?.products.find(p=>p.id===lead.product_id)?.name||""; setMessage(renderTemplate(c.next_message!,lead,product,profile.display_name).text); setPhase("edit"); setNotice(""); setAt(followupDate()); setOpen(true); }
 const href=whatsappUrl(lead.whatsapp,message);
 async function confirm(){if(!sentId)return;setBusy(true);try{await confirmCadenceFollowup({id:sentId,lead:lead.id,message,phone:new URL(href!).pathname.slice(1)}); await q.refetch(); await refresh(); setPhase(next>=c.total_followups?"edit":"schedule"); if(next>=c.total_followups){setNotice("Cadência concluída. Todos os follow-ups foram registrados.");}}catch{setNotice("Não foi possível registrar o follow-up.");}finally{setBusy(false)}}
 async function schedule(){setBusy(true);try{const instant=inputToInstant(at);if(!instant)throw new Error();await scheduleCadenceFollowup(lead.id,instant);await refresh();setOpen(false);}catch{setNotice("Não foi possível agendar. Confira a data.");}finally{setBusy(false)}}
 return <>{<button type="button" className={compact?"icon-btn":"btn whatsapp wide"} onClick={start} title={`Enviar Follow-up ${next}`}>{compact?<RotateCcw size={18}/>:<MessageCircle size={16}/>} {!compact&&`Enviar Follow-up ${next}`}</button>}
 {open&&<Modal open onClose={()=>!busy&&setOpen(false)} title={`Follow-up ${next} · ${c.campaign_name}`} description={`Mensagem ${next} de ${c.total_followups} da cadência selecionada na abordagem inicial.`} wide><div className="form-body"><Notice text={notice}/>{phase==="edit"&&<><label>Mensagem sugerida<textarea rows={12} maxLength={8000} value={message} onChange={e=>setMessage(e.target.value)}/></label><div className="modal-actions">{href?<a className="btn whatsapp" href={href} target="_blank" rel="noopener noreferrer" onClick={()=>{setSentId(crypto.randomUUID());setPhase("confirm")}}>Enviar pelo WhatsApp</a>:<button disabled className="btn">WhatsApp inválido</button>}<button className="btn" onClick={()=>setOpen(false)}>Cancelar</button></div></>}{phase==="confirm"&&<><h3>A mensagem foi enviada?</h3><p>Confirme somente depois do envio no WhatsApp.</p><label>Texto efetivamente enviado<textarea rows={10} value={message} onChange={e=>setMessage(e.target.value)}/></label><div className="modal-actions"><button className="btn primary" disabled={busy} onClick={()=>void confirm()}>{busy?"Registrando…":"Sim, registrar envio"}</button><button className="btn" onClick={()=>setPhase("edit")}>Voltar</button></div></>}{phase==="schedule"&&<><h3>Agendar Follow-up {next+1}?</h3><p>Sugestão automática: 2 dias úteis após este contato.</p><label>Próximo follow-up<input type="datetime-local" value={at} onChange={e=>setAt(e.target.value)}/></label><div className="modal-actions"><button className="btn primary" disabled={busy} onClick={()=>void schedule()}>Agendar</button><button className="btn" onClick={()=>setOpen(false)}>Agora não</button></div></>}</div></Modal>}</>;
}
