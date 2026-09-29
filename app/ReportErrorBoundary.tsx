"use client";
import { Component, type ReactNode } from "react";
/** Keep a failed report module/render inside the report surface, preserving the editor. */
export default class ReportErrorBoundary extends Component<{children:ReactNode;onClose:()=>void;locale:"en"|"ru"},{failed:boolean}> {
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<div className="case-report-backdrop"><section className="case-report-dialog" role="alertdialog" aria-modal="true" aria-labelledby="report-failure-title" onKeyDown={event=>{if(event.key==="Escape")this.props.onClose();if(event.key==="Tab")event.preventDefault();}}><h2 id="report-failure-title">{this.props.locale==="en"?"The report could not open":"Не удалось открыть отчёт"}</h2><p>{this.props.locale==="en"?"Your case remains open. Close this message and retry the report. Keep this tab open to preserve unsaved edits.":"Кейс остаётся открытым. Закройте сообщение и повторите попытку. Оставьте вкладку открытой, чтобы сохранить несохранённые правки."}</p><button type="button" autoFocus onClick={this.props.onClose}>{this.props.locale==="en"?"Return to my case":"Вернуться к кейсу"}</button></section></div>:this.props.children;}
}
