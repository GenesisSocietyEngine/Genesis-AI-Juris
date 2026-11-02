import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import Notice, {unavailableSavedCaseId} from '../../app/StudioSavedCaseAccessNotice';
function Fixture(){
  const [locale,setLocale]=useState(new URL(location.href).searchParams.get('lang')==='ru'?'ru':'en');
  useEffect(()=>{document.documentElement.lang=locale;},[locale]);
  const [phase,setPhase]=useState('unavailable');
  const [checks,setChecks]=useState(0);
  const pending=useRef(null);
  const id=unavailableSavedCaseId({phase,signOutPending:false,currentCaseId:null,requested:'50'});
  return <><aside className="learning-note"><b>LOCAL SYNTHETIC COMPONENT FIXTURE</b><p>No account, case, provider, storage or production handler is used. Checks below are modeled UI promises; writes remain zero.</p><p role="status">Synthetic checks: {checks}; synthetic writes: 0</p><button onClick={()=>setLocale(locale==='en'?'ru':'en')}>Switch fixture language</button> <button onClick={()=>pending.current?.reject(Error('Synthetic failed access check'))}>Fail synthetic check</button> <button onClick={()=>pending.current?.resolve()}>Complete synthetic check</button> <button onClick={()=>setPhase('ready')}>Show recovered fixture</button></aside>{id!==null?<Notice id={id} locale={locale} disabled={false} retry={()=>new Promise((resolve,reject)=>{setChecks(n=>n+1);pending.current={resolve,reject};})}/>:<p role="status">Recovered fixture; no real case has been loaded.</p>}</>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
