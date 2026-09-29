/** Modified clicks, downloads and new windows do not leave the current work. */
export function isWorkspaceDepartureClick(
  event: Pick<MouseEvent,"button"|"ctrlKey"|"metaKey"|"shiftKey"|"altKey"|"defaultPrevented">,
  link: {href:string;target:string;hasAttribute:(name:string)=>boolean}, current: string,
) {
  if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||link.hasAttribute("download")||link.target&&!['_self','_top','_parent'].includes(link.target))return false;
  const url=new URL(link.href,current),source=new URL(current);
  return !["/signin-with-chatgpt","/signout-with-chatgpt"].includes(url.pathname) && /^https?:$/.test(url.protocol) && !(url.origin===source.origin&&url.pathname===source.pathname&&url.search===source.search&&Boolean(url.hash));
}
