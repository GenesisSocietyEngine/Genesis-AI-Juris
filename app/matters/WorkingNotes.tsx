"use client";
import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { NOTE_STARTERS, noteDirty, noteStatus, type NoteEditor, type WorkingNotesController } from "./working-notes-controller";
import { formatNoteBlock } from "./note-formatting";
import styles from "./working-notes.module.css";

/** Text is escaped by React. This deliberately small subset creates no links,
 * remote embeds, raw HTML or executable content. The stored body stays text. */
export function NoteReading({ body }: { body: string }) {
  const inline = (line: string): ReactNode => line.split(/(\*\*[^*]+\*\*)/g).map((text, i) => text.startsWith("**") && text.endsWith("**") ? <strong key={i}>{text.slice(2,-2)}</strong> : <Fragment key={i}>{text}</Fragment>);
  const lines=body.split("\n"), blocks:ReactNode[]=[];
  for(let i=0;i<lines.length;i++) {
    const line=lines[i], heading=/^(#{1,3}) (.*)$/.exec(line);
    if(heading) { const Tag=({1:"h3",2:"h4",3:"h5"} as const)[heading[1].length as 1|2|3]; blocks.push(<Tag key={i}>{inline(heading[2])}</Tag>); continue; }
    const kind=(text:string)=>/^- \[[ xX]\] /.test(text)?"check":/^\d+\. /.test(text)?"number":/^- /.test(text)?"bullet":null;
    const list=kind(line);
    if(list) { const start=i,items:ReactNode[]=[]; do {const text=lines[i];items.push(<li key={i} value={list==="number"?Number.parseInt(text):undefined}>{list==="check"?<><span aria-label={text[3].toLowerCase()==="x"?"Completed note item":"Incomplete note item"}>{text[3].toLowerCase()==="x"?"☑":"☐"}</span> {inline(text.slice(6))}</>:inline(text.replace(/^(?:- |\d+\. )/,""))}</li>);i++;}while(i<lines.length&&kind(lines[i])===list);i--;blocks.push(list==="number"?<ol key={start} start={Number.parseInt(line)}>{items}</ol>:<ul key={start} className={list==="check"?styles.checklist:undefined}>{items}</ul>);continue; }
    if(/^> \[!NOTE\] /.test(line)) blocks.push(<aside key={i} className={styles.callout}>{inline(line.slice(10))}</aside>);
    else if(/^> /.test(line)) blocks.push(<blockquote key={i}>{inline(line.slice(2))}</blockquote>);
    else blocks.push(line?<p key={i}>{inline(line)}</p>:<br key={i}/>);
  }
  return <div className={styles.reading}>{body?blocks:<p>No note text yet.</p>}</div>;
}
const displayAuthor=(note:{savedBy:string;savedByName?:string},authors:Record<string,string>)=>note.savedByName || authors[note.savedBy] || "Case member";
const displayTime=(value:string)=>{const date=new Date(value);return Number.isNaN(date.getTime())?"Time unavailable":date.toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"})+" UTC";};
export default function WorkingNotes({ controller, canWrite, onOverview, authors = {} }: { authors?:Record<string,string>; controller: WorkingNotesController; canWrite: boolean; onOverview: () => void }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const [starterOpen,setStarterOpen] = useState(false);
  const newButton=useRef<HTMLButtonElement>(null), starterPanel=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(starterOpen)starterPanel.current?.querySelector("button")?.focus();},[starterOpen]);
  const focus = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (!controller.getSnapshot().loaded) void controller.list(); },[controller]);
  useEffect(() => { focus.current?.focus(); },[state.selected]);
  if (!state.visible) return null;
  const editor = state.selected ? state.editors[state.selected] : null;
  const query = state.filter.toLowerCase();
  const notes = state.notes.filter(note => note.title.toLowerCase().includes(query));
  const drafts = Object.values(state.editors).filter(e=>!e.base || noteDirty(e) || e.phase==="unknown");
  return <section className={styles.notebook} data-own-drafts aria-label="Working notes">
    <header className={styles.header}><div><p className={styles.eyebrow}>Case notebook</p><h2 ref={focus} tabIndex={-1}>{editor ? editor.draft.title.trim() || "Untitled note" : "Working notes"}</h2><p>Working material · shared with this case. Notes are not accepted evidence or approved decisions.</p></div><button type="button" onClick={onOverview}>Case overview</button></header>
    <p className={styles.hint}>Save explicitly. Unsaved input stays in this open case; reloading, signing out or leaving the case can discard it.</p>
    {state.issue && <p role="alert" className={styles.warning}>{state.issue} <button type="button" onClick={()=>void controller.list()}>Retry notes</button></p>}
    {editor ? <NoteEditorView key={editor.key} editor={editor} controller={controller} canWrite={canWrite} authors={authors}/> : <>
      <div className={styles.actions}><label>Find in loaded notes<input type="search" value={state.filter} onChange={e=>controller.setFilter(e.target.value)}/></label>{canWrite && <button type="button" ref={newButton} className={styles.primary} disabled={controller.pending} onClick={()=>setStarterOpen(!starterOpen)} aria-expanded={starterOpen}>New note</button>}</div>
      {!canWrite && <p className={styles.hint}>You can read notes. Ask the case owner for contributor access to edit.</p>}
      {controller.pending && <p role="status" className={styles.warning}>A save needs recovery before another submission. <button type="button" onClick={()=>controller.selectPending()}>Recover original save</button></p>}
      {starterOpen && <div ref={starterPanel} className={styles.starters} onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();setStarterOpen(false);newButton.current?.focus();}}}>{NOTE_STARTERS.map(starter=><button type="button" key={starter.id} onClick={()=>{controller.start(starter.id);setStarterOpen(false);}}><strong>{starter.title}</strong><span>{starter.description}</span></button>)}</div>}
      {drafts.length>0 && <div className={styles.drafts}><h3>Continue in this open case</h3>{drafts.map(e=><button key={e.key} type="button" onClick={()=>void controller.open(e.key)}>{e.draft.title || "Untitled note"} · {noteStatus(e)}</button>)}</div>}
      <p className={styles.hint} role="status">{state.loading ? "Loading notes…" : `${state.notes.length} notes loaded${state.nextCursor ? "; more available" : ""}.`}{state.filter && ` ${notes.length} match in the loaded list.`}</p>
      {state.loaded && !state.notes.length && <div className={styles.empty}><h3>Give your reasoning a place to develop</h3><p>Capture meeting notes, questions or provisional analysis alongside this case.</p></div>}
      <ul className={styles.list}>{notes.map(note=><li key={note.id}><button type="button" onClick={()=>void controller.open(note.id)}><strong>{note.title}</strong><span>{note.type} · {displayAuthor(note,authors)} · revision {note.revision} · {displayTime(note.savedAt)}</span><span>Open note →</span></button></li>)}</ul>
      {state.nextCursor && <button type="button" disabled={state.loading} onClick={()=>void controller.list(true)}>Load more notes</button>}
    </>}
  </section>;
}
function NoteEditorView({editor:e,controller,canWrite,authors}:{editor:NoteEditor;controller:WorkingNotesController;canWrite:boolean;authors:Record<string,string>}) {
  const [preview,setPreview]=useState(false),[discard,setDiscard]=useState(false),[history,setHistory]=useState(false);
  const discardButton=useRef<HTMLButtonElement>(null), keepButton=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(discard)keepButton.current?.focus();},[discard]);
  const cancelDiscard=()=>{setDiscard(false);discardButton.current?.focus();};
  const body=useRef<HTMLTextAreaElement>(null);
  const dirty=noteDirty(e), pending=e.phase==="submitting"||e.phase==="unknown";
  const add=(before:string,after="")=>{const textarea=body.current;if(!textarea)return;const start=textarea.selectionStart,end=textarea.selectionEnd;controller.edit(e.key,{body:e.draft.body.slice(0,start)+before+e.draft.body.slice(start,end)+after+e.draft.body.slice(end)});requestAnimationFrame(()=>{textarea.focus();textarea.setSelectionRange(start+before.length,end+before.length);});};
  const block=(marker:string)=>{const textarea=body.current;if(!textarea)return;const result=formatNoteBlock(e.draft.body,textarea.selectionStart,textarea.selectionEnd,marker);controller.edit(e.key,{body:result.body});requestAnimationFrame(()=>{textarea.focus();textarea.setSelectionRange(result.start,result.end);});};
  return <>
    <div className={styles.actions}><button type="button" onClick={()=>controller.returnToList()}>← All notes</button>{e.base && <button type="button" onClick={()=>{setHistory(!history);if(!history)void controller.history(e.key);}} aria-expanded={history}>Version history</button>}</div>
    <div className={styles.editor}>
      {e.base&&<p className={styles.hint}>Saved by {displayAuthor(e.base,authors)} · {displayTime(e.base.savedAt)} · revision {e.base.revision}</p>}
      <label className={styles.titleField}>Note title<input value={e.draft.title} readOnly={!canWrite} maxLength={200} aria-invalid={e.field==="title"} aria-describedby={e.field==="title"?"note-title-error":undefined} onChange={ev=>controller.edit(e.key,{title:ev.target.value})}/>{e.field==="title"&&<span id="note-title-error" className={styles.fieldError}>{e.message}</span>}</label>
      <label className={styles.typeField}>Note type<select value={e.draft.type} disabled={!canWrite} onChange={ev=>controller.edit(e.key,{type:ev.target.value as "blank"|"meeting"|"analysis"})}><option value="blank">General note</option><option value="meeting">Meeting notes</option><option value="analysis">Analysis</option></select></label>
      <div className={styles.actions} aria-label="Note formatting">{canWrite&&!preview&&<><button type="button" onClick={()=>block("## ")}>Heading</button><button type="button" onClick={()=>add("**","**")}>Bold</button><button type="button" onClick={()=>block("- ")}>List</button><button type="button" onClick={()=>block("1. ")}>Numbered list</button><button type="button" onClick={()=>block("- [ ] ")}>Checklist</button><button type="button" onClick={()=>block("> ")}>Quote</button><button type="button" onClick={()=>block("> [!NOTE] ")}>Callout</button></>}<button type="button" onClick={()=>setPreview(!preview)} aria-pressed={preview}>{preview?"Edit text":"Reading preview"}</button></div>
      {preview||!canWrite?<NoteReading body={e.draft.body}/>:<label className={styles.bodyField}>Note text<textarea ref={body} rows={16} value={e.draft.body} maxLength={100000} aria-invalid={e.field==="body"} aria-describedby={e.field==="body"?"note-body-error":undefined} onChange={ev=>controller.edit(e.key,{body:ev.target.value})}/>{e.field==="body"&&<span id="note-body-error" className={styles.fieldError}>{e.message}</span>}</label>}
      <p className={styles.hint}>Markdown headings, bold, lists, checklists, quotes and callouts. Links and HTML remain plain text.</p>
      <p role="status" className={pending||e.phase==="conflict"||e.phase==="validation"?styles.warning:dirty?styles.hint:styles.feedback}>{noteStatus(e)}</p>
      {/unavailable|lookup failed|No receipt|retained|original save is confirmed/i.test(e.message)&&<p className={styles.hint}>{e.message}</p>}
      {e.phase==="unknown"&&<div className={styles.recovery}><strong>Recover this exact save</strong><p>Changing the draft does not change the pending operation. Checking an unavailable receipt does not prove the save failed.</p><div className={styles.actions}><button type="button" className={styles.primary} onClick={()=>void controller.recover(e.key)}>Check original receipt</button><button type="button" onClick={()=>void controller.recover(e.key,true)}>Resend identical original save</button></div></div>}
      {e.conflict&&<section className={styles.recovery} aria-label="Compare note versions"><h3>Compare before saving</h3><div className={styles.compare}><div><h4>Your current draft</h4><strong>{e.draft.title}</strong><pre>{e.draft.body}</pre></div><div><h4>Current saved · revision {e.conflict.revision}</h4><strong>{e.conflict.title}</strong><pre>{e.conflict.body}</pre></div></div><p>Choose the saved version to discard local edits, or continue editing your draft against the compared revision. Neither choice saves automatically.</p><div className={styles.actions}><button type="button" onClick={()=>controller.resolveConflict(e.key,false)}>Keep draft and edit merge</button><button type="button" onClick={()=>controller.resolveConflict(e.key,true)}>Use saved version; discard local edits</button></div></section>}
      {canWrite&&<div className={styles.actions}><button type="button" className={styles.primary} disabled={controller.pending||e.phase==="conflict"||!dirty} onClick={()=>void controller.save(e.key)}>{e.phase==="submitting"?"Saving…":"Save note"}</button><button ref={discardButton} type="button" disabled={pending} onClick={()=>setDiscard(true)}>Discard local changes</button></div>}
      {discard&&<section role="alert" className={styles.warning} onKeyDown={event=>{if(event.key==="Escape"){event.preventDefault();cancelDiscard();}}}><p>Discard this local draft? Saved versions remain unchanged.</p><div className={styles.actions}><button ref={keepButton} type="button" onClick={cancelDiscard}>Keep editing</button><button type="button" onClick={()=>controller.discard(e.key)}>Discard draft</button></div></section>}
      {e.receipt&&<details className={styles.receipt}><summary>Original save receipt · revision {e.receipt.revision}</summary><p>Saved at {displayTime(e.receipt.occurredAt)}. This confirms the submitted revision; newer saved revisions and your current edits are separate.</p><dl><dt>Operation</dt><dd>{e.receipt.key}</dd><dt>Actor</dt><dd>{authors[e.receipt.actor]??e.receipt.actor}</dd></dl><button type="button" onClick={()=>void controller.refresh(e.key)}>Refresh current saved version</button></details>}
    </div>
    {history&&<section className={styles.history}><h3>Version history</h3><p>Read-only saved versions. Opening history does not replace your draft.</p><ul>{e.history.map(n=><li key={n.revision}><button type="button" onClick={()=>void controller.historical(e.key,n.revision)}>Revision {n.revision} · {displayTime(n.savedAt)} · {displayAuthor(n,authors)} · {n.savedByRole}</button></li>)}</ul>{e.historyCursor&&<button type="button" onClick={()=>void controller.history(e.key,true)}>Load older versions</button>}{e.historical&&<article><h4>{e.historical.title} · revision {e.historical.revision}</h4><NoteReading body={e.historical.body}/><button type="button" onClick={()=>void controller.historical(e.key,null)}>Close historical version</button></article>}</section>}
  </>;
}
