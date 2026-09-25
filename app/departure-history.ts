import type { NavigationController } from "./navigation-controller";
let historySession = 0;

/** Preserve the history entry while the shared guard asks Stay/Discard.
 * Capture runs before the router's bubbling popstate listener. No case input
 * or private content is written into history state. Cross-document history
 * retains the browser's beforeunload protection. */
export function installDepartureHistory(host: Window, navigation: NavigationController) {
  const history=host.history, push=history.pushState, replace=history.replaceState;
  // A local bookkeeping marker, never an authentication or operation key.
  const session=`${Date.now()}:${++historySession}`, marker="__genesisDeparture";
  let position=0, currentUrl=host.location.href;
  let restoring:{url:string;intent:number;authority:number;index:number}|null=null;
  let accepted:{intent:number;authority:number;index:number}|null=null;
  let cancellingIndex:number|null=null;
  const stamp=(data:unknown,index:number)=>({...((data&&typeof data==="object")?data:{}),[marker]:{session,index}});
  replace.call(history,stamp(history.state,position),"",currentUrl);
  const pushed:History["pushState"]=function(data,unused,url){push.call(history,stamp(data,++position),unused,url);currentUrl=host.location.href;};
  const replaced:History["replaceState"]=function(data,unused,url){replace.call(history,stamp(data,position),unused,url);currentUrl=host.location.href;};
  history.pushState=pushed;history.replaceState=replaced;
  const pop=(event:PopStateEvent)=>{
    const point=event.state?.[marker];
    if(!point||point.session!==session||!Number.isInteger(point.index)){navigation.beginIntent();return;}
    if(cancellingIndex!==null){
      event.stopImmediatePropagation();
      if(point.index===cancellingIndex)cancellingIndex=null;
      return;
    }
    if(accepted&&accepted.index===point.index){
      event.stopImmediatePropagation();
      const target=accepted;accepted=null;
      if(!navigation.intentCurrent(target.intent)||navigation.authorityVersion!==target.authority){
        // A newer logout, scope or navigation intent owns the workspace. Undo
        // this obsolete traversal without reloading or reopening a guard.
        navigation.cancelPageDeparture();
        if(position!==point.index){cancellingIndex=position;history.go(position-point.index);}
        return;
      }
      // Complete the original traversal, preserving forward history. Reload the
      // accepted entry so explicitly discarded workspace memory cannot survive
      // a same-component router reuse. Departure was already approved.
      host.location.reload();return;
    }
    if(restoring){
      event.stopImmediatePropagation();
      if(point.index!==position)return;
      const target=restoring;restoring=null;
      const current=()=>navigation.intentCurrent(target.intent)&&navigation.authorityVersion===target.authority;
      navigation.requestDeparture("link",target.url,{current,commit:()=>true,navigate:()=>{if(!current()){navigation.cancelPageDeparture();return;}accepted=target;history.go(target.index-position);}});
      return;
    }
    const intent=navigation.beginIntent(),url=host.location.href;
    if(navigation.risk()==="clear"||url===currentUrl){position=point.index;currentUrl=url;return;}
    event.stopImmediatePropagation();
    const delta=position-point.index;
    if(!delta)return;
    restoring={url,intent,authority:navigation.authorityVersion,index:point.index};
    history.go(delta);
  };
  host.addEventListener("popstate",pop,true);
  return()=>{host.removeEventListener("popstate",pop,true);if(history.pushState===pushed)history.pushState=push;if(history.replaceState===replaced)history.replaceState=replace;};
}
