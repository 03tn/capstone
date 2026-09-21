import { useEffect,useState } from "react";
import Workspace from "./Workspace";
import { connected,supabase } from "./lib/data";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { CheckCircle2, FileSearch, Gavel, ShieldCheck } from "lucide-react";

export default function App(){
  const[ready,setReady]=useState(!connected),[signedIn,setSignedIn]=useState(!connected);
  useEffect(()=>{if(!supabase)return;supabase.auth.getSession().then(({data})=>{setSignedIn(Boolean(data.session));setReady(true)});const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSignedIn(Boolean(s)));return()=>data.subscription.unsubscribe()},[]);
  useEffect(()=>{const signOut=(event:MouseEvent)=>{const link=(event.target as HTMLElement).closest('a[href^="/signout-with-chatgpt"]');if(!link)return;event.preventDefault();if(supabase)supabase.auth.signOut();else{localStorage.removeItem("calder-demo-v1");location.reload()}};document.addEventListener("click",signOut);return()=>document.removeEventListener("click",signOut)},[]);
  if(!ready)return <div className="loading"><div className="loader"/><p>Preparing Calder workspace…</p></div>;
  if(!signedIn)return <SignIn/>;
  return <Workspace/>;
}

function SignIn(){const[email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState(""),[createMode,setCreateMode]=useState(false),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  const submit=async()=>{setBusy(true);setMessage("");const result=createMode?await supabase!.auth.signUp({email,password,options:{data:{full_name:name}}}):await supabase!.auth.signInWithPassword({email,password});setMessage(result.error?.message||(createMode?"Account created with Submitter access. An administrator must assign any additional permissions.":"Signed in."));setBusy(false)};
  return <main className="auth-page">
    <section className="auth-shell">
      <aside className="auth-intro">
        <div className="auth-logo"><span><Gavel size={23}/></span><div><strong>Calder</strong><small>Agreement Review</small></div></div>
        <div className="auth-copy"><span className="auth-eyebrow">CONTROLLED CONTRACT TRIAGE</span><h1>Review the agreements that need attention.</h1><p>Turn inbound vendor contracts into source-linked findings, human decisions, and a durable audit record.</p></div>
        <div className="auth-benefits"><div><FileSearch/><span><strong>Evidence first</strong><small>Every finding points back to its source.</small></span></div><div><ShieldCheck/><span><strong>Human controlled</strong><small>Automation never makes the final decision.</small></span></div></div>
        <p className="auth-intro-foot"><CheckCircle2 size={15}/> Deterministic and manual review remain available without AI.</p>
      </aside>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-mobile-logo"><span><Gavel size={20}/></span><strong>Calder</strong></div>
        <header><span className="auth-step">SECURE WORKSPACE</span><h2 id="auth-title">{createMode?"Create your account":"Welcome back"}</h2><p>{createMode?"Start with Submitter access and securely expand permissions through an Administrator.":"Sign in to submit, review, and track vendor agreements."}</p></header>
        <form onSubmit={(event)=>{event.preventDefault();void submit()}}>
          {createMode&&<div className="auth-field"><Label htmlFor="full-name">Full name</Label><Input id="full-name" autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your full name"/></div>}
          <div className="auth-field"><Label htmlFor="email">Email address</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"/></div>
          <div className="auth-field"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete={createMode?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password"/></div>
          {createMode&&<div className="auth-role-note"><ShieldCheck size={17}/><span><strong>Submitter access by default</strong><small>Only an Administrator can change role permissions.</small></span></div>}
          {message&&<div className="auth-message" role="status">{message}</div>}
          <Button className="auth-primary" type="submit" disabled={busy||!email||!password||(createMode&&!name)}>{busy?"Please wait…":createMode?"Create account":"Sign in"}</Button>
        </form>
        <div className="auth-divider"><span>{createMode?"Already have an account?":"New to Calder?"}</span></div>
        <Button className="auth-secondary" type="button" variant="outline" disabled={busy} onClick={()=>{setCreateMode(!createMode);setMessage("")}}>{createMode?"Back to sign in":"Create an account"}</Button>
        <p className="auth-privacy">Protected workspace • Authorized users only</p>
      </section>
    </section>
  </main>}
