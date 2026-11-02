/** Public, bounded Help media only. Blob URLs remain seekable on hosts without byte ranges. */
export function createRecordingMedia(path:string, io:{fetch:typeof fetch;create:(blob:Blob)=>string;revoke:(url:string)=>void}) {
  const abort=new AbortController();
  let url:string|undefined, loading:Promise<string>|undefined, disposed=false;
  return {
    load() {
      if(disposed)return Promise.reject(new Error('Recording closed'));
      if(url)return Promise.resolve(url);
      if(loading)return loading;
      loading=(async()=>{
        if(!/^\/help\/scenarios-20261102\/(canopy|local-edit)\.mp4$/.test(path))throw new Error('Unknown recording');
        const response=await io.fetch(path,{credentials:'omit',redirect:'error',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])});
        if(!response.ok||!/^video\/mp4(?:;|$)/i.test(response.headers.get('content-type')??''))throw new Error('Recording unavailable');
        const bytes=await response.arrayBuffer();
        if(bytes.byteLength===0||bytes.byteLength>1024*1024)throw new Error('Recording size invalid');
        if(disposed)throw new Error('Recording closed');
        url=io.create(new Blob([bytes],{type:'video/mp4'}));return url;
      })().finally(()=>{loading=undefined;});
      return loading;
    },
    dispose(){disposed=true;abort.abort();if(url)io.revoke(url);}
  };
}
