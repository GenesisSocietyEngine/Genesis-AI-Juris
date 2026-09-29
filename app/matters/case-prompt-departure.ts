import type { NavigationController } from "../navigation-controller";

/** File bytes stay in memory until the shared departure dialog accepts this exact intent. */
export async function stageCasePrompt(options: {
  file: Pick<File,"name"|"size"|"text">; navigation: NavigationController;
  current: () => boolean; destination: string; commit: (value: string) => void; issue: (message: string) => void;
}) {
  const intent=options.navigation.beginIntent();
  let value="", cancelled=false;
  const current=()=>!cancelled&&options.navigation.intentCurrent(intent)&&options.current();
  const cancel=()=>{cancelled=true;value="";};
  try {
    if(!/\.md$/iu.test(options.file.name)||options.file.size>128000)throw new Error("Choose one Markdown case prompt no larger than 128 KB.");
    value=await options.file.text();
    if(!current()){cancel();return;}
    if(!value.trim()||value.length>64000)throw new Error("The Markdown case prompt is empty or exceeds the 64,000-character Studio limit.");
    options.navigation.requestDeparture("link",options.destination,{current,cancel,commit:()=>{
      if(!current())return false;
      try{options.commit(value);cancel();return true;}catch{options.issue("The import could not be prepared. Your current work is unchanged; retry after checking browser storage.");return false;}
    }});
  }catch(error){if(current())options.issue(error instanceof Error?error.message:"The file could not be read. Your current work is unchanged.");cancel();}
}
