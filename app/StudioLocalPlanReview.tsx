"use client";
import { useEffect, useRef } from 'react';
import { describeStudioPromptOperation, type StudioPromptPlan } from './studio-editing';
import styles from './studio-evidence-workspace.module.css';

export default function StudioLocalPlanReview({locale,plan,nodeTitles,linkEndpoints,canApply,onApply,onEdit}:{
  locale:'en'|'ru'; plan:StudioPromptPlan; nodeTitles:ReadonlyMap<string,string>;
  linkEndpoints:ReadonlyMap<string,{from:string;to:string}>; canApply:boolean; onApply:()=>void; onEdit:()=>void;
}) {
  const t=(en:string,ru:string)=>locale==='en'?en:ru;
  const heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{ heading.current?.focus({preventScroll:true}); heading.current?.scrollIntoView({block:'start'}); },[]);
  return <section className={`page-width ${styles.surface}`} aria-label={t('Local case proposal','Локальное предложение для кейса')}>
    <header className={styles.header}><div><p className={styles.eyebrow}>{t('LOCAL BUILDER · NO AI REQUEST','ЛОКАЛЬНЫЙ КОНСТРУКТОР · БЕЗ ЗАПРОСА К AI')}</p><h2 ref={heading} tabIndex={-1} className={styles.reviewTitle}>{t('Review local changes','Проверьте локальные изменения')}</h2></div></header>
    <p>{plan.contextOnly ? t('This will add your text to the case context. It will not create case records.','Текст будет добавлен в контекст кейса. Новые записи не появятся.') : t(`${plan.operations.length} proposed changes. Check the complete list before applying.`,`Предложено изменений: ${plan.operations.length}. Проверьте весь список перед применением.`)}</p>
    <p className={styles.meta}>{t('Nothing is applied yet. The local builder does not assess evidence or record professional approval.','Изменения ещё не применены. Локальный конструктор не оценивает доказательства и не фиксирует профессиональное утверждение.')}</p>
    {plan.operations.length>0 && <ol className={styles.planList}>{plan.operations.map((operation,index)=><li key={`${operation.kind}-${index}`}><p>{describeStudioPromptOperation(operation,locale,nodeTitles,{showIds:false,linkEndpoints})}</p></li>)}</ol>}
    {plan.diagnostics.length>0 && <ul className={styles.notice}>{plan.diagnostics.map((diagnostic,index)=><li key={`${diagnostic.level}-${index}`}>{diagnostic.message}</li>)}</ul>}
    <div className={styles.actions}><button type="button" className={styles.secondary} onClick={onEdit}>{t('Edit brief','Изменить описание')}</button><button type="button" className={styles.primary} disabled={!canApply||!plan.canApply} onClick={()=>{if(canApply&&plan.canApply)onApply();}}>{plan.contextOnly?t('Add text to case context','Добавить текст в контекст'):t('Apply these changes','Применить эти изменения')}</button></div>
  </section>;
}
