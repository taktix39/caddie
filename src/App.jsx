import { useState, useEffect } from "react";
import { supabase } from './supabase'

const CLUBS = ["1W","3W","5W","4U","4I","5I","6I","7I","8I","9I","PW","AW","SW","PT"];
const MISS_TYPES = ["なし","引っ掛け","スライス","ダフり","トップ","プッシュ"];
const PUTT_MISS_TYPES = ["なし","オーバー","ショート"];
const TROUBLE_TYPES = ["OB","バンカー","池"];
const LIE_TYPES = ["","ティーイングエリア","フェアウェイ","ラフ","バンカー","トラブルエリア","グリーン"];
const PAR_OPTIONS = [3,4,5];
const STORAGE_KEY = "golf_rounds_v6";
const APPROACH_YDS = 100;
const MINT = "#3ecf8e";
const MINT_LIGHT = "#e8f8ef";
const BLUE = "#4ea8de";
const BLUE_LIGHT = "#e8f3fb";

const defaultShot = (first=false) => ({club:"",remaining:"",lie:first?"ティーイングエリア":"",miss:"なし",troubles:[]});
const defaultHole = () => ({par:4,yardage:"",score:"",putts:"",approaches:0,fairway:null,gir:false,shots:[defaultShot(true)],memo:""});
const initHoles = () => Array.from({length:18}, (_,i) => ({...defaultHole(), no:i+1}));

async function fetchRoundsFromDB(){
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .order('created_at', { ascending: false })
  if(error){ console.error(error); return []; }
  return data || [];
}

async function upsertRound(round){
  const { error } = await supabase
    .from('rounds')
    .upsert(round)
  if(error) console.error(error);
}

async function deleteRoundFromDB(id){
  const { error } = await supabase
    .from('rounds')
    .delete()
    .eq('id', id)
  if(error) console.error(error);
}

function calcCarry(hole, si){
  const b = parseFloat(hole.shots[si]?.remaining);
  const a = parseFloat(hole.shots[si+1]?.remaining);
  if(isNaN(b)||isNaN(a)) return null;
  return b-a>0 ? b-a : null;
}

function autoCalc(hole){
  const shots = hole.shots||[];
  const valid = shots.filter(s=>s.club);
  if(!valid.length) return {score:null,putts:null,approaches:null};
  const score = valid.length;
  const putts = valid.filter(s=>s.club==="PT").length;
  const approaches = valid.filter((s,i) => {
    if(s.club==="PT") return false;
    const carry = calcCarry(hole, shots.indexOf(s));
    return carry!==null && carry<APPROACH_YDS;
  }).length;
  return {score,putts,approaches};
}

function scoreLabel(score, par){
  if(!score||!par) return null;
  const d = score-par;
  if(d<=-2) return {txt:String(d), color:BLUE};
  if(d===-1) return {txt:"−1", color:MINT};
  if(d===0)  return {txt:"○",  color:"#27ae60"};
  if(d===1)  return {txt:"△",  color:"#f39c12"};
  if(d===2)  return {txt:"□",  color:"#e74c3c"};
  return       {txt:`+${d}`,   color:"#c0392b"};
}

const avg = arr => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : "-";
const pct = (n,d) => d ? Math.round(n/d*100)+"%" : "-";

const S = {
  wrap:{maxWidth:480,margin:"0 auto",minHeight:"100vh",background:"#fff",fontFamily:"-apple-system,sans-serif",fontSize:14},
  header:{background:"#fff",borderBottom:"1px solid #eee",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10},
  headerTitle:{fontSize:16,fontWeight:600,color:"#111",letterSpacing:"-0.3px"},
  tabBar:{display:"flex",borderBottom:"1px solid #eee",background:"#fff",position:"sticky",top:57,zIndex:9},
  tab:(a)=>({flex:1,padding:"11px 0",border:"none",background:"none",fontSize:13,fontWeight:a?600:400,color:a?"#111":"#999",borderBottom:a?`2px solid ${MINT}`:"2px solid transparent",cursor:"pointer"}),
  btn:(bg="#111",color="#fff")=>({background:bg,color,border:"none",borderRadius:8,padding:"10px 16px",fontSize:13,fontWeight:600,cursor:"pointer"}),
  outlineBtn:{background:"none",border:"1px solid #e0e0e0",borderRadius:8,padding:"8px 14px",fontSize:13,color:"#555",cursor:"pointer"},
  card:{background:"#fff",border:"1px solid #eee",borderRadius:12,padding:"14px 16px",marginBottom:10},
  label:{fontSize:11,color:"#999",marginBottom:4,display:"block"},
  inp:{border:"1px solid #e8e8e8",borderRadius:8,padding:"8px 10px",fontSize:14,width:"100%",boxSizing:"border-box",background:"#fafafa",color:"#111"},
  inpAuto:{border:"1px solid #d0eed9",borderRadius:8,padding:"8px 10px",fontSize:14,width:"100%",boxSizing:"border-box",background:MINT_LIGHT,color:"#111"},
  pill:(color,bg)=>({display:"inline-flex",alignItems:"center",background:bg,color,borderRadius:20,padding:"2px 9px",fontSize:11,fontWeight:600}),
  shotBlock:{background:"#fafafa",border:"1px solid #eee",borderRadius:10,padding:"12px",marginBottom:8},
  divider:{borderTop:"1px solid #f0f0f0",margin:"12px 0"},
  subtotal:{background:"#fafafa",borderRadius:10,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13},
};

function ScoreChart({history}){
  const valid = history.filter(s=>s.score);
  if(!valid.length) return <div style={{fontSize:13,color:"#bbb",padding:"20px 0",textAlign:"center"}}>データがありません</div>;
  const scores = valid.map(s=>s.score);
  const minS = Math.min(...scores)-3, maxS = Math.max(...scores)+3;
  const W = Math.max(320, valid.length*60), H = 110;
  const xStep = (W-40)/Math.max(valid.length-1,1);
  const yScale = v => H-18-((v-minS)/(maxS-minS))*(H-36);
  const pts = valid.map((s,i) => [20+i*xStep, yScale(s.score)]);
  return (
    <div style={{overflowX:"auto"}}>
      <svg width={W} height={H} style={{display:"block"}}>
        <polyline points={pts.map(p=>p.join(",")).join(" ")} fill="none" stroke={MINT} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
        {pts.map(([x,y],i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={4} fill={MINT}/>
            <text x={x} y={y-9} textAnchor="middle" fontSize={11} fill="#333" fontWeight="600">{valid[i].score}</text>
            <text x={x} y={H-2} textAnchor="middle" fontSize={10} fill="#bbb">{valid[i].date?.slice(5)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function RoundHeatmap({holes}){
  const half = [holes.slice(0,9), holes.slice(9,18)];
  const labels = ["OUT","IN"];
  return (
    <div style={{margin:"10px 0 4px"}}>
      {half.map((hs, hi) => {
        const halfScore = hs.reduce((a,h)=>a+(parseInt(h.score)||0),0);
        const halfPar   = hs.reduce((a,h)=>a+h.par,0);
        const halfDiff  = halfScore ? halfScore - halfPar : null;
        return (
          <div key={hi} style={{marginBottom:6}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
              <span style={{fontSize:10,fontWeight:600,color:"#aaa",width:24}}>{labels[hi]}</span>
              <div style={{display:"grid",gridTemplateColumns:"repeat(9,1fr)",gap:2,flex:1}}>
                {hs.map(h => {
                  const s = parseInt(h.score);
                  const d = s ? s - h.par : null;
                  const bg = d===null?"#f0f0f0":d<0?BLUE:d===0?MINT:d===1?"#f39c12":d===2?"#e74c3c":"#c0392b";
                  const txt = d===null?"—":d<0?String(d):d===0?"○":d===1?"△":d===2?"□":`+${d}`;
                  return (
                    <div key={h.no} style={{textAlign:"center"}}>
                      <div style={{fontSize:8,color:"#ccc",marginBottom:1}}>{h.no}</div>
                      <div style={{background:bg,borderRadius:3,padding:"3px 0",fontSize:8,fontWeight:700,color:"#fff",lineHeight:1.3}}>{txt}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{textAlign:"right",minWidth:36}}>
                <div style={{fontSize:14,fontWeight:700,color:"#111",lineHeight:1}}>{halfScore||"—"}</div>
                {halfDiff!==null ? <div style={{fontSize:9,color:halfDiff===0?"#27ae60":halfDiff<0?BLUE:"#f39c12",fontWeight:600}}>{halfDiff===0?"E":halfDiff>0?`+${halfDiff}`:halfDiff}</div> : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HoleHeatmap({holeStats}){
  const holes = Array.from({length:18}, (_,i) => {
    const st = holeStats[i+1];
    const a = st ? st.scores.reduce((a,b)=>a+b,0)/st.scores.length : null;
    const bg = a===null?"#f0f0f0":a<0?BLUE:a===0?MINT:a<1?"#f39c12":"#e74c3c";
    const txt = a===null?"—":a>=0?`+${a.toFixed(1)}`:a.toFixed(1);
    return {i, bg, txt};
  });
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(9,1fr)",gap:4}}>
        {holes.map(({i,bg,txt}) => (
          <div key={i} style={{textAlign:"center"}}>
            <div style={{fontSize:9,color:"#bbb",marginBottom:2}}>{i+1}</div>
            <div style={{background:bg,color:"#fff",borderRadius:5,padding:"4px 0",fontSize:10,fontWeight:700}}>{txt}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:10,marginTop:8,fontSize:10,color:"#aaa",flexWrap:"wrap"}}>
        {[[BLUE,"バーディ以下"],[MINT,"パー"],["#f39c12","ボギー"],["#e74c3c","ダブル+"]].map(([c,l]) => (
          <span key={l}><span style={{color:c}}>●</span> {l}</span>
        ))}
      </div>
    </div>
  );
}

export default function App(){
  const [tab,setTab] = useState("rounds");
  const [rounds,setRounds] = useState([]);
  const [editing,setEditing] = useState(null);
  const [form,setForm] = useState({date:"",course:"",tee:"レギュラー",holes:initHoles()});
  const [session,setSession] = useState(null);
  const [email,setEmail] = useState("");
  const [emailSent,setEmailSent] = useState(false);

  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      setSession(session);
      if(session) fetchRounds();
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_,session)=>{
      setSession(session);
      if(session) fetchRounds();
    });
    return ()=>subscription.unsubscribe();
  },[]);

  async function fetchRounds(){
    const data = await fetchRoundsFromDB();
    setRounds(data);
  }

  async function handleLogin(){
  const {error} = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: 'http://localhost:5173'
    }
  });
  if(error) alert(error.message);
  else setEmailSent(true);
  }

  async function handleLogout(){
    await supabase.auth.signOut();
    setRounds([]);
    setSession(null);
  }

  const totalScore = holes => holes.reduce((s,h)=>s+(parseInt(h.score)||0),0);
  const totalPutts = holes => holes.reduce((s,h)=>s+(parseInt(h.putts)||0),0);
  const totalPar   = holes => holes.reduce((s,h)=>s+h.par,0);
  const diff = holes => { const d=totalScore(holes)-totalPar(holes); return d===0?"E":d>0?`+${d}`:String(d); };

  function startNew(){
    setForm({date:new Date().toISOString().slice(0,10),course:"",tee:"レギュラー",holes:initHoles()});
    setEditing("new"); setTab("entry");
  }
  async function saveRound(){
    const { data: { user } } = await supabase.auth.getUser();
    const round = {...form, id:editing==="new"?Date.now():editing, user_id:user.id};
    await upsertRound(round);
    await fetchRounds();
    setEditing(null); setTab("rounds");
  }
  function editRound(r){
    const holes = r.holes.map(h=>({...h,yardage:h.yardage||"",memo:h.memo||"",approaches:h.approaches||0,
      shots:(h.shots||[defaultShot(true)]).map(s=>({lie:"",...s}))}));
    setForm({...r,holes}); setEditing(r.id); setTab("entry");
  }
  async function deleteRound(id){ 
    if(confirm("削除しますか？")){
      await deleteRoundFromDB(id);
      await fetchRounds();
      }
  }

  function upHole(i,key,val){ setForm(f=>{ const holes=[...f.holes]; holes[i]={...holes[i],[key]:val}; return {...f,holes}; }); }
  function upYardage(i,val){
    setForm(f=>{ const holes=[...f.holes]; const shots=[...holes[i].shots];
      if(!shots[0].remaining||shots[0].remaining===holes[i].yardage) shots[0]={...shots[0],remaining:val};
      holes[i]={...holes[i],yardage:val,shots}; return {...f,holes}; });
  }
  function applyAutoCalc(holes, hi, shots){
    const {score,putts,approaches} = autoCalc({...holes[hi],shots});
    holes[hi] = {...holes[hi], shots,
      score: score!==null?String(score):holes[hi].score,
      putts: putts!==null?String(putts):holes[hi].putts,
      approaches: approaches!==null?approaches:holes[hi].approaches};
  }
  function upShot(hi,si,key,val){
    setForm(f=>{ const holes=[...f.holes]; const shots=[...holes[hi].shots];
      const u={...shots[si],[key]:val};
      if(key==="club"){ u.miss="なし"; if(val==="PT"&&!u.lie) u.lie="グリーン"; }
      shots[si]=u; applyAutoCalc(holes,hi,shots); return {...f,holes}; });
  }
  function addShot(hi){
    setForm(f=>{ const holes=[...f.holes]; const shots=[...holes[hi].shots,defaultShot()];
      applyAutoCalc(holes,hi,shots); return {...f,holes}; });
  }
  function removeShot(hi,si){
    setForm(f=>{ const holes=[...f.holes];
      const shots=holes[hi].shots.filter((_,i)=>i!==si);
      const final=shots.length?shots:[defaultShot(true)];
      applyAutoCalc(holes,hi,final); return {...f,holes}; });
  }

  function getClubStats(){
    const map={};
    rounds.forEach(r=>r.holes.forEach(h=>{
      (h.shots||[]).forEach((s,si)=>{
        if(!s.club) return;
        if(!map[s.club]) map[s.club]={carries:[],girs:0,total:0,misses:{},troubles:{}};
        const c=map[s.club]; const carry=calcCarry(h,si);
        if(carry) c.carries.push(carry); c.total++;
        if(s.miss&&s.miss!=="なし") c.misses[s.miss]=(c.misses[s.miss]||0)+1;
        (s.troubles||[]).forEach(t=>{ c.troubles[t]=(c.troubles[t]||0)+1; });
      });
      const fc=h.shots?.[0]?.club; if(fc&&h.gir&&map[fc]) map[fc].girs++;
    }));
    return map;
  }
  function getHoleStats(){
    const map={};
    rounds.forEach(r=>r.holes.forEach(h=>{
      const s=parseInt(h.score); if(!s) return;
      if(!map[h.no]) map[h.no]={scores:[],par:h.par};
      map[h.no].scores.push(s-h.par);
    }));
    return map;
  }
  function getApproachStats(){
    let total=0,onePutt=0,totalP=0;
    rounds.forEach(r=>r.holes.forEach(h=>{
      const has=(h.shots||[]).some((s,si)=>{ if(s.club==="PT") return false; const c=calcCarry(h,si); return c!==null&&c<APPROACH_YDS; });
      if(!has) return; total++; const p=parseInt(h.putts)||0; totalP+=p; if(!h.gir&&p<=1) onePutt++;
    }));
    return {total, onePuttRate:pct(onePutt,total), avgPutts:total?(totalP/total).toFixed(1):"-"};
  }
  function getFwGir(){
    let fw=0,fwT=0,gir=0,girT=0;
    rounds.forEach(r=>r.holes.forEach(h=>{ girT++; if(h.gir) gir++; if(h.par!==3){ fwT++; if(h.fairway===true) fw++; } }));
    return {fw:pct(fw,fwT), gir:pct(gir,girT)};
  }

  const clubStats    = getClubStats();
  const holeStats    = getHoleStats();
  const approachStats= getApproachStats();
  const fwGir        = getFwGir();
  const scoreHistory = rounds.map(r=>({date:r.date,score:totalScore(r.holes),putts:totalPutts(r.holes)})).reverse();

  if(!session){
    return(
      <div style={{...S.wrap,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:"0 32px"}}>
        <svg width="160" height="32" viewBox="0 0 160 32" style={{marginBottom:32}}>
          <ellipse cx="16" cy="27" rx="8" ry="2" fill={MINT} opacity="0.5"/>
          <rect x="14.5" y="21" width="3" height="5" rx="1" fill={MINT}/>
          <path d="M13 23 Q16 25 19 23" fill={MINT}/>
          <circle cx="16" cy="16" r="7" fill="none" stroke={MINT} strokeWidth="1.8"/>
          <circle cx="16" cy="16" r="6" fill="white"/>
          <circle cx="13" cy="13" r="1" fill="#ddd"/>
          <circle cx="16" cy="12" r="1" fill="#ddd"/>
          <circle cx="19" cy="13" r="1" fill="#ddd"/>
          <circle cx="12" cy="16" r="1" fill="#ddd"/>
          <circle cx="15" cy="15" r="1" fill="#ddd"/>
          <circle cx="18" cy="15" r="1" fill="#ddd"/>
          <text x="30" y="24" fontSize="22" fontWeight="700" fontFamily="-apple-system,sans-serif">
            <tspan fill={MINT}>C</tspan><tspan fill={BLUE}>addie</tspan>
          </text>
        </svg>
        {emailSent ? (
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:16}}>📧</div>
            <div style={{fontSize:16,fontWeight:600,color:"#111",marginBottom:8}}>メールを確認してください</div>
            <div style={{fontSize:13,color:"#999"}}>届いたリンクをタップするとログインできます</div>
          </div>
        ) : (
          <div style={{width:"100%"}}>
            <div style={{fontSize:16,fontWeight:600,color:"#111",marginBottom:8,textAlign:"center"}}>ログイン</div>
            <div style={{fontSize:13,color:"#999",marginBottom:24,textAlign:"center"}}>メールアドレスを入力してください</div>
            <input style={{...S.inp,marginBottom:12}} type="email" placeholder="example@gmail.com" value={email} onChange={e=>setEmail(e.target.value)}/>
            <button onClick={handleLogin} style={{...S.btn(MINT,"#fff"),width:"100%",padding:14,fontSize:15}}>ログインリンクを送る</button>
          </div>
        )}
      </div>
    );
  }
  if(tab==="entry"){
    return (
      <div style={S.wrap}>
        <div style={S.header}>
          <button onClick={()=>{setTab("rounds");setEditing(null);}} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#333",padding:0,lineHeight:1}}>‹</button>
          <span style={S.headerTitle}>{editing==="new"?"新規ラウンド":"ラウンド編集"}</span>
          <button onClick={saveRound} style={S.btn(MINT,"#fff")}>保存</button>
        </div>
        <div style={{padding:"14px 16px 80px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <div><label style={S.label}>日付</label><input type="date" style={S.inp} value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
            <div><label style={S.label}>ティー</label>
              <select style={S.inp} value={form.tee} onChange={e=>setForm(f=>({...f,tee:e.target.value}))}>
                {["レギュラー","バック","フロント","シルバー"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{marginBottom:18}}><label style={S.label}>コース名</label><input style={S.inp} value={form.course} onChange={e=>setForm(f=>({...f,course:e.target.value}))} placeholder="例：烏山城カントリークラブ"/></div>

          {["OUT","IN"].map((side,si) => {
            const sh = form.holes.slice(si*9, si*9+9);
            const sScore = sh.reduce((a,h)=>a+(parseInt(h.score)||0),0);
            const sPutts = sh.reduce((a,h)=>a+(parseInt(h.putts)||0),0);
            const sPar   = sh.reduce((a,h)=>a+h.par,0);
            return (
              <div key={side}>
                <div style={{fontSize:12,fontWeight:600,color:"#999",marginBottom:8,letterSpacing:"0.5px"}}>{side} — {si===0?"1〜9":"10〜18"}H</div>
                {sh.map((h,idx) => {
                  const i = si*9+idx;
                  const lbl = scoreLabel(parseInt(h.score), h.par);
                  const hasShots = h.shots.some(s=>s.club);
                  return (
                    <div key={i} style={{...S.card,marginBottom:8}}>
                      {/* Row1 */}
                      <div style={{display:"grid",gridTemplateColumns:"28px 1fr 1fr 1fr",gap:8,marginBottom:6,alignItems:"flex-end"}}>
                        <div style={{fontSize:16,fontWeight:700,color:MINT,paddingBottom:6}}>{h.no}</div>
                        <div><label style={S.label}>Par</label>
                          <select style={{...S.inp,textAlign:"center",padding:"7px 4px"}} value={h.par} onChange={e=>upHole(i,"par",parseInt(e.target.value))}>
                            {PAR_OPTIONS.map(p=><option key={p}>{p}</option>)}
                          </select>
                        </div>
                        <div><label style={S.label}>距離(y)</label>
                          <input type="number" style={{...S.inp,textAlign:"center",padding:"7px 4px"}} value={h.yardage} min={0} onChange={e=>upYardage(i,e.target.value)} placeholder="—"/>
                        </div>
                        <div><label style={S.label}>スコア</label>
                          <div style={{display:"flex",alignItems:"center",gap:5}}>
                            <input type="number" style={{...(hasShots?S.inpAuto:S.inp),textAlign:"center",padding:"7px 4px",flex:1}} value={h.score} min={1} max={15} onChange={e=>upHole(i,"score",e.target.value)} placeholder="—"/>
                            {lbl ? <span style={{fontSize:15,fontWeight:700,color:lbl.color,minWidth:22,textAlign:"center"}}>{lbl.txt}</span> : null}
                          </div>
                        </div>
                      </div>
                      {/* Row2 */}
                      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
                        <div style={{display:"flex",alignItems:"center",gap:5}}>
                          <label style={{...S.label,marginBottom:0}}>パット</label>
                          <input type="number" style={{...(hasShots?S.inpAuto:S.inp),textAlign:"center",padding:"6px 4px",width:52}} value={h.putts} min={0} max={10} onChange={e=>upHole(i,"putts",e.target.value)} placeholder="—"/>
                        </div>
                        {hasShots ? (
                          <>
                            <div style={{display:"flex",alignItems:"center",gap:5}}>
                              <label style={{...S.label,marginBottom:0}}>AP</label>
                              <input type="number" style={{...S.inpAuto,textAlign:"center",padding:"6px 4px",width:52}} value={h.approaches??0} min={0} max={18} onChange={e=>upHole(i,"approaches",parseInt(e.target.value)||0)}/>
                              <span style={{fontSize:11,color:"#999"}}>回</span>
                            </div>
                            <span style={{fontSize:11,color:MINT,marginLeft:"auto"}}>✓ 自動計算</span>
                          </>
                        ) : null}
                      </div>
                      {/* Shots */}
                      {h.shots.map((s,si2) => {
                        const isPutt = s.club==="PT";
                        const carry  = calcCarry(h,si2);
                        const isApproach = !isPutt && carry!==null && carry<APPROACH_YDS;
                        return (
                          <div key={si2} style={S.shotBlock}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                              <span style={{fontSize:11,fontWeight:600,color:"#aaa"}}>{si2+1}打目</span>
                              {si2>0 ? <button onClick={()=>removeShot(i,si2)} style={{background:"none",border:"none",color:"#ccc",fontSize:18,cursor:"pointer",padding:0,lineHeight:1}}>×</button> : null}
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:7}}>
                              <div><label style={S.label}>クラブ</label>
                                <select style={{...S.inp,padding:"7px 4px"}} value={s.club} onChange={e=>upShot(i,si2,"club",e.target.value)}>
                                  <option value="">—</option>{CLUBS.map(c=><option key={c}>{c}</option>)}
                                </select>
                              </div>
                              <div><label style={S.label}>残り(y)</label>
                                <input type="number" style={{...S.inp,padding:"7px 4px",textAlign:"center"}} value={s.remaining} min={0} placeholder="—" onChange={e=>upShot(i,si2,"remaining",e.target.value)}/>
                              </div>
                              <div><label style={S.label}>ライ</label>
                                <select style={{...S.inp,padding:"7px 4px"}} value={s.lie||""} onChange={e=>upShot(i,si2,"lie",e.target.value)}>
                                  {LIE_TYPES.map(l=><option key={l} value={l}>{l||"—"}</option>)}
                                </select>
                              </div>
                            </div>
                            <div style={{marginBottom:7}}>
                              <label style={S.label}>{isPutt?"パットミス":"ミス"}</label>
                              <select style={{...S.inp,padding:"7px 8px"}} value={s.miss} onChange={e=>upShot(i,si2,"miss",e.target.value)}>
                                {(isPutt?PUTT_MISS_TYPES:MISS_TYPES).map(m=><option key={m}>{m}</option>)}
                              </select>
                            </div>
                            {carry!==null && !isPutt ? (
                              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                                <span style={{fontSize:12,color:BLUE,fontWeight:600}}>📏 {carry}y</span>
                                {isApproach ? <span style={S.pill("#c07800","#fff8e1")}>🎯 アプローチ</span> : null}
                              </div>
                            ) : null}
                            {!isPutt ? (
                              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                                {TROUBLE_TYPES.map(t => {
                                  const on = (s.troubles||[]).includes(t);
                                  return (
                                    <button key={t} onClick={()=>upShot(i,si2,"troubles",on?(s.troubles||[]).filter(x=>x!==t):[...(s.troubles||[]),t])}
                                      style={{padding:"4px 12px",borderRadius:20,border:`1px solid ${on?"#e74c3c":"#e0e0e0"}`,fontSize:11,cursor:"pointer",background:on?"#fdecea":"#fafafa",color:on?"#c0392b":"#888",fontWeight:on?600:400}}>
                                      {t}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      <button onClick={()=>addShot(i)} style={{width:"100%",padding:"9px",border:`1px dashed ${MINT}`,borderRadius:8,background:"none",color:MINT,fontSize:12,fontWeight:600,cursor:"pointer"}}>＋ ショット追加</button>
                      <div style={S.divider}/>
                      <input style={{...S.inp,fontSize:12,color:"#888"}} value={h.memo||""} onChange={e=>upHole(i,"memo",e.target.value)} placeholder="📝 メモ（任意）"/>
                    </div>
                  );
                })}
                <div style={{...S.subtotal,marginBottom:16}}>
                  <span style={{color:"#888",fontSize:12}}>{side} 小計</span>
                  <div style={{display:"flex",gap:12,alignItems:"baseline"}}>
                    <span style={{fontSize:18,fontWeight:700}}>{sScore||"—"}<span style={{fontSize:11,color:"#bbb",marginLeft:3}}>({sPar})</span></span>
                    <span style={{fontSize:12,color:"#888"}}>パット {sPutts||"—"}</span>
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{background:"#111",borderRadius:12,padding:"16px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{color:"#aaa",fontSize:13}}>合計スコア</span>
            <div style={{textAlign:"right"}}>
              <div><span style={{fontSize:30,fontWeight:700,color:"#fff"}}>{totalScore(form.holes)||"—"}</span><span style={{fontSize:15,color:MINT,marginLeft:8}}>{diff(form.holes)}</span></div>
              <div style={{fontSize:12,color:"#666"}}>パット {totalPutts(form.holes)||"—"}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <svg width="160" height="32" viewBox="0 0 160 32">
          <ellipse cx="16" cy="27" rx="8" ry="2" fill={MINT} opacity="0.5"/>
          <rect x="14.5" y="21" width="3" height="5" rx="1" fill={MINT}/>
          <path d="M13 23 Q16 25 19 23" fill={MINT}/>
          <circle cx="16" cy="16" r="7" fill="none" stroke={MINT} strokeWidth="1.8"/>
          <circle cx="16" cy="16" r="6" fill="white"/>
          <circle cx="13" cy="13" r="1" fill="#ddd"/>
          <circle cx="16" cy="12" r="1" fill="#ddd"/>
          <circle cx="19" cy="13" r="1" fill="#ddd"/>
          <circle cx="12" cy="16" r="1" fill="#ddd"/>
          <circle cx="15" cy="15" r="1" fill="#ddd"/>
          <circle cx="18" cy="15" r="1" fill="#ddd"/>
          <text x="30" y="24" fontSize="22" fontWeight="700" fontFamily="-apple-system,sans-serif">
            <tspan fill={MINT}>C</tspan><tspan fill={BLUE}>addie</tspan>
          </text>
        </svg>
        <div style={{display:"flex",gap:8}}>
          <button onClick={startNew} style={S.btn(MINT,"#fff")}>＋ 新規</button>
          <button onClick={handleLogout} style={{...S.outlineBtn,fontSize:12}}>ログアウト</button>
        </div>
      </div>
      <div style={S.tabBar}>
        {[["rounds","ラウンド"],["analysis","分析"]].map(([k,l]) => (
          <button key={k} style={S.tab(tab===k)} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      <div style={{padding:"14px 16px 40px"}}>

        {tab==="rounds" && (
          rounds.length===0
            ? <div style={{textAlign:"center",padding:"60px 0",color:"#bbb"}}><div style={{fontSize:36,marginBottom:8}}>⛳</div><div style={{fontSize:14}}>まだラウンドがありません</div></div>
            : <div>{rounds.map(r => {
                const lbl = scoreLabel(totalScore(r.holes), totalPar(r.holes));
                return (
                  <div key={r.id} style={S.card}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                      <div>
                        <div style={{fontSize:15,fontWeight:600,color:"#111",marginBottom:3}}>{r.course||"コース未記入"}</div>
                        <div style={{fontSize:12,color:"#aaa"}}>{r.date} · {r.tee}ティー</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                          <span style={{fontSize:28,fontWeight:700,color:"#111",lineHeight:1}}>{totalScore(r.holes)||"—"}</span>
                          {lbl ? <span style={{fontSize:16,fontWeight:700,color:lbl.color}}>{lbl.txt}</span> : null}
                        </div>
                        <div style={{fontSize:11,color:"#aaa",marginTop:2}}>パット {totalPutts(r.holes)||"—"}</div>
                      </div>
                    </div>
                    <RoundHeatmap holes={r.holes}/>
                    <div style={{display:"flex",gap:8,marginBottom:12}}>
                      {[["FW",pct(r.holes.filter(h=>h.fairway===true&&h.par!==3).length,r.holes.filter(h=>h.par!==3).length)],["GIR",pct(r.holes.filter(h=>h.gir).length,18)]].map(([k,v]) => (
                        <span key={k} style={{fontSize:11,color:"#888",background:"#f5f5f5",borderRadius:6,padding:"3px 8px"}}>{k} {v}</span>
                      ))}
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>editRound(r)} style={{...S.outlineBtn,flex:1}}>編集</button>
                      <button onClick={()=>deleteRound(r.id)} style={{...S.outlineBtn,color:"#e74c3c",borderColor:"#fde"}}>削除</button>
                    </div>
                  </div>
                );
              })}</div>
        )}

        {tab==="analysis" && (
          rounds.length===0
            ? <div style={{textAlign:"center",padding:"60px 0",color:"#bbb"}}><div style={{fontSize:14}}>ラウンドを記録すると分析が表示されます</div></div>
            : <div>
                <div style={S.card}>
                  <div style={{fontSize:13,fontWeight:600,color:"#111",marginBottom:12}}>スコア推移</div>
                  <ScoreChart history={scoreHistory}/>
                </div>

                <div style={S.card}>
                  <div style={{fontSize:13,fontWeight:600,color:"#111",marginBottom:10}}>フェアウェイ・GIR</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {[["FWキープ率",fwGir.fw,MINT_LIGHT,MINT],["GIR率",fwGir.gir,BLUE_LIGHT,BLUE]].map(([l,v,bg,color]) => (
                      <div key={l} style={{background:bg,borderRadius:10,padding:"12px",textAlign:"center"}}>
                        <div style={{fontSize:11,color:"#888",marginBottom:4}}>{l}</div>
                        <div style={{fontSize:22,fontWeight:700,color}}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={S.card}>
                  <div style={{fontSize:13,fontWeight:600,color:"#111",marginBottom:10}}>ホール別平均（対パー）</div>
                  <HoleHeatmap holeStats={holeStats}/>
                </div>

                <div style={S.card}>
                  <div style={{fontSize:13,fontWeight:600,color:"#111",marginBottom:4}}>アプローチ精度</div>
                  <div style={{fontSize:11,color:"#bbb",marginBottom:10}}>{APPROACH_YDS}y未満（PT除く）</div>
                  {approachStats.total===0
                    ? <div style={{fontSize:13,color:"#bbb"}}>データがありません</div>
                    : <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                        {[["ホール数",approachStats.total,"#111"],["寄せワン率",approachStats.onePuttRate,MINT],["平均パット",approachStats.avgPutts,"#111"]].map(([l,v,c]) => (
                          <div key={l} style={{background:"#f8f8f8",borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
                            <div style={{fontSize:10,color:"#aaa",marginBottom:4}}>{l}</div>
                            <div style={{fontSize:20,fontWeight:700,color:c}}>{v}</div>
                          </div>
                        ))}
                      </div>
                  }
                </div>

                <div style={S.card}>
                  <div style={{fontSize:13,fontWeight:600,color:"#111",marginBottom:12}}>クラブ別パフォーマンス</div>
                  {Object.keys(clubStats).length===0
                    ? <div style={{fontSize:13,color:"#bbb"}}>データがありません</div>
                    : <div>{CLUBS.filter(c=>clubStats[c]).map(c => {
                        const st = clubStats[c];
                        const isPutt = c==="PT";
                        const topMiss = Object.entries(st.misses||{}).sort((a,b)=>b[1]-a[1])[0];
                        return (
                          <div key={c} style={{borderBottom:"1px solid #f5f5f5",paddingBottom:12,marginBottom:12}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                              <span style={{fontWeight:700,fontSize:15,color:"#111"}}>{c}</span>
                              <span style={{fontSize:11,color:"#bbb"}}>{st.total}回</span>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:isPutt?"1fr 1fr":"1fr 1fr 1fr",gap:7}}>
                              {!isPutt ? <div style={{background:"#f8f8f8",borderRadius:8,padding:"8px",textAlign:"center"}}><div style={{fontSize:10,color:"#aaa"}}>平均飛距離</div><div style={{fontSize:16,fontWeight:700,color:"#111"}}>{avg(st.carries)}<span style={{fontSize:10,color:"#bbb"}}>y</span></div></div> : null}
                              {!isPutt ? <div style={{background:"#f8f8f8",borderRadius:8,padding:"8px",textAlign:"center"}}><div style={{fontSize:10,color:"#aaa"}}>GIR率</div><div style={{fontSize:16,fontWeight:700,color:"#111"}}>{pct(st.girs,st.total)}</div></div> : null}
                              <div style={{background:"#f8f8f8",borderRadius:8,padding:"8px",textAlign:"center"}}><div style={{fontSize:10,color:"#aaa"}}>多いミス</div><div style={{fontSize:13,fontWeight:600,color:"#111"}}>{topMiss?topMiss[0]:"なし"}</div></div>
                              {isPutt ? <div style={{background:"#f8f8f8",borderRadius:8,padding:"8px",textAlign:"center"}}><div style={{fontSize:10,color:"#aaa"}}>ミス回数</div><div style={{fontSize:16,fontWeight:700,color:"#111"}}>{Object.values(st.misses||{}).reduce((a,b)=>a+b,0)}回</div></div> : null}
                            </div>
                            {Object.keys(st.misses||{}).length>0 ? (
                              <div style={{display:"flex",gap:5,marginTop:7,flexWrap:"wrap"}}>
                                {Object.entries(st.misses).sort((a,b)=>b[1]-a[1]).map(([m,n]) => (
                                  <span key={m} style={S.pill("#9a6200","#fff8e1")}>{m} {n}回</span>
                                ))}
                              </div>
                            ) : null}
                            {!isPutt && Object.keys(st.troubles||{}).length>0 ? (
                              <div style={{display:"flex",gap:5,marginTop:5,flexWrap:"wrap"}}>
                                {TROUBLE_TYPES.filter(t=>st.troubles[t]).map(t => (
                                  <span key={t} style={S.pill("#c0392b","#fdecea")}>{t} {st.troubles[t]}回（{pct(st.troubles[t],st.total)}）</span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}</div>
                  }
                </div>
              </div>
        )}
      </div>
    </div>
  );
}