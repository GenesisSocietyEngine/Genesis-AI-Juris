"""Explicit learning illustrations, never fabricated application screenshots."""
from PIL import ImageDraw

def render_illustration(im,scene,font,block):
    d=ImageDraw.Draw(im); NAVY='#142b46';MUTED='#506477';BLUE='#176d67';LIGHT='#edf3fc';GOLD='#e4b35b'
    d.rounded_rectangle((26,115,1413,1057),radius=14,fill='white',outline='#d9e2ed',width=1)
    d.rounded_rectangle((64,153,1367,208),radius=8,fill=LIGHT)
    d.text((84,170),'ILLUSTRATED WORKFLOW  •  FOLLOW IN STUDIO',font=font(21,True),fill=BLUE)
    d.text((86,1008),'Learning illustration · Controls and outcomes must be verified in the application.',font=font(19),fill=MUTED)
    def heading(t,sub=None):
        y=block(d,t,(88,254),1230,43,NAVY,True,1.18)
        if sub:block(d,sub,(90,y+22),1200,26,MUTED,False,1.35)
    def card(x,y,w,h,title,body='',num=None,color=LIGHT):
        d.rounded_rectangle((x,y,x+w,y+h),radius=14,fill=color,outline='#d5e0ed',width=1)
        yy=y+26
        if num is not None:
            d.ellipse((x+24,yy,x+70,yy+46),fill=BLUE);d.text((x+38,yy+9),str(num),font=font(22,True),fill='white');yy+=68
        yy=block(d,title,(x+26,yy),w-52,30,NAVY,True,1.22)
        if body:block(d,body,(x+26,yy+21),w-52,24,MUTED,False,1.35)
    def arrow(x1,y1,x2,y2,color=BLUE):
        d.line((x1,y1,x2,y2),fill=color,width=5)
        import math
        a=math.atan2(y2-y1,x2-x1);s=16
        d.polygon([(x2,y2),(x2-s*math.cos(a-.5),y2-s*math.sin(a-.5)),(x2-s*math.cos(a+.5),y2-s*math.sin(a+.5))],fill=color)
    def ribbon(t,y=906):
        d.rounded_rectangle((88,y,1348,y+68),radius=9,fill=NAVY);block(d,t,(112,y+20),1210,23,'white',True,1.2)
    def table(rows,x=88,y=419,w=1260,row_h=94):
        for i,(label,value) in enumerate(rows):
            d.rounded_rectangle((x,y+i*row_h,x+w,y+(i+1)*row_h-10),radius=8,fill=LIGHT if i%2==0 else '#f6f8fb')
            block(d,label,(x+24,y+i*row_h+24),430,23,MUTED,True,1.2)
            block(d,value,(x+485,y+i*row_h+24),w-515,27,NAVY,False,1.2)
    sid=scene['id']
    if sid=='02':
        heading('Choose by intention','A worked example teaches. A template starts your own authoring task.')
        card(88,426,606,384,'Demo cases','Explore Canopy overview, worked examples and decision simulations.',1)
        card(741,426,606,384,'Templates','Open a new draft with a starting structure and intake questions. Supply your own reviewed facts.',2,color='#f4efe5')
        ribbon('My cases → Personal for Studio saves; Team for organization records.')
    elif sid=='03':
        heading('A canonical file has two parts','Use the complete final Markdown file, including its embedded case data.')
        card(88,416,477,368,'Five Flats, Three Borders','Readable brief\n+ embedded case structure\n+ integrity information',color='#f4efe5')
        card(674,416,674,174,'Entry route','Import case or prompt')
        card(674,620,674,164,'Editor route','More actions → Import case prompt (.md)')
        arrow(587,599,650,599);ribbon('Importing the text is not yet applying the graph.')
    elif sid=='04':
        heading('Verify the structure before applying','Verify canonical case checks the embedded data and fingerprint locally.')
        for x,value,label in [(88,'23','nodes'),(515,'36','relations'),(941,'1','exact case')]:
            card(x,440,406,211,value,label)
        table([('Review in the preview','Title · version · fingerprint'),('What integrity establishes','Which case data you are opening')],y=702,row_h=91)
        ribbon('Integrity does not independently verify evidence or legal conclusions.',y=905)
    elif sid=='05':
        heading('Apply exact case, then review','Current professional-case sections organize work without certifying approval.')
        steps=['Overview','Sources & evidence','Decision','Review','Reports','Brief & structure']
        for j,t in enumerate(steps):
            row=j//3;col=j%3;x=88+col*433;y=423+row*228
            card(x,y,393,183,t,'',j+1)
            if col<2:arrow(x+398,y+94,x+426,y+94)
        ribbon('A filled progress indicator is not a saved or approved case.')
    elif sid=='06':
        heading('Read the mandate as a question','The requested structure is an option to investigate, not a conclusion.')
        table([('Client context','Fictional PRC-resident client'),('Assets','Five English flats'),('Requested structure','Liechtenstein structure'),('Review discipline','Alternatives · open questions · stop conditions')],y=415,row_h=112)
        ribbon('Preserve the original canonical file before editing its working copy.')
    elif sid=='07':
        heading('Trace a source to the decision','Illustrative relationship based on the canonical case.')
        card(88,440,490,255,'Evidence','KYC questionnaire',1,color='#f4efe5')
        card(749,440,599,255,'Investigation','Ownership and source of funds',2)
        arrow(603,568,723,568)
        table([('Ask of the evidence','What does it establish?'),('Ask of the decision','What remains uncertain?')],y=736,row_h=81)
        ribbon('A named evidence node is not an accepted underlying document.')
    elif sid=='08':
        heading('Review the current financing inputs','Use the inputs and supporting sources in the case you have opened.')
        vals=[('Price & debt','Verify the financing inputs'),('Rate & term','Confirm the repayment basis'),('Annual rent','Check the current source'),('Operating costs','Review expenses and assumptions')]
        for j,(val,label) in enumerate(vals):card(88+(j%2)*649,420+(j//2)*196,610,169,val,label)
        ribbon('Recalculate after changing assumptions. Keep unresolved inputs visible.',y=853)
    elif sid=='09':
        heading('What does a 10% return mean?','Different measures answer different questions.')
        for j,(t,b) in enumerate([('Gross yield','Rental income relative to purchase price.'),('Cash-on-cash','Cash outcome relative to cash invested.'),('Equity IRR','Return reflecting equity cash flows over time.')]):card(88+j*433,444,393,320,t,b,j+1)
        ribbon('Provisional costs and unverified tax sources require further review.',y=843)
    elif sid=='10':
        heading('Evidence can change the route','Illustrative decision topology, not a reconstruction of the exact graph.')
        card(425,410,560,130,'Define the return measure')
        card(425,584,560,130,'Check lawful funding')
        arrow(705,548,705,575)
        card(88,796,540,118,'Proceed for further review',color='#edf5f3')
        card(808,796,540,118,'Pause or renegotiate',color='#f4efe5')
        arrow(617,720,358,783);arrow(795,720,1080,783)
        d.text((178,743),'Conditions supported',font=font(20),fill=MUTED)
        d.text((1003,743),'Gaps remain',font=font(20),fill=MUTED)
    elif sid=='11':
        heading('Structural checks are one layer','Open Review and act on the checks for your case.')
        card(88,434,603,352,'Playable case','Confirm intentional routes and outcomes. Use Test this case when the simulation is ready.',1)
        card(745,434,603,352,'Decision package','Read completeness checks. Return to the indicated field, evidence item or connection.',2,color='#f4efe5')
        ribbon('A structural pass does not replace evidence review or professional judgment.')
    elif sid=='12':
        heading('Create an analytical draft','Create analytical report → Create case report')
        d.rectangle((92,433,420,880),fill='#f6f8fb',outline='#9dafc4',width=2)
        d.text((126,469),'DRAFT REPORT',font=font(24,True),fill=NAVY)
        for j,t in enumerate(['Case identity','Assumptions','Evidence register','Decision map']):
            block(d,t,(126,535+j*74),254,21,MUTED)
            d.line((126,571+j*74,382,571+j*74),fill='#c8d4e2',width=2)
        card(504,433,844,174,'Preview PDF','Inspect identity, assumptions, sources and the portrait map.')
        card(504,637,844,174,'Download PDF','Open the delivered file and inspect it before sharing.')
        ribbon('Internal draft export and governed approval are separate.',y=908)
    elif sid=='13':
        heading('Preserve both the report and editable case','Use the file type that matches what you need to keep.')
        card(88,440,605,380,'PDF','Confirm the actual download and open it. “Download started” only confirms initiation.',1)
        card(744,440,604,380,'Final case prompt (.md)','Keep a portable, editable canonical handoff. Review the export status controls.',2,color='#f4efe5')
        ribbon('A filename containing Final does not create independent approval.')
    elif sid=='15':
        heading('Start a clean authoring task','Preserve the current work and read any replacement prompt.')
        for j,(t,b) in enumerate([('Preserve','Export or confirm a supported save.'),('Create','Case Studio → Create a case'),('Prepare','Start a blank draft or use a template.')]):card(88+j*433,437,393,367,t,b,j+1)
        ribbon('A template provides intake questions, not a finished case.')
    elif sid=='16':
        heading('Example brief: a supplier change','Fictional practice exercise · mark unsupported claims as unverified')
        table([('Decision required','Approve a supplier change before launch?'),('Known information','Parties · jurisdiction · deadline'),('Evidence required','Prices · delivery claims · supporting records'),('Alternatives','Proceed · keep current supplier · pause')],y=421,row_h=109)
        ribbon('State the conditions that would make you stop rather than proceed.')
    elif sid=='18':
        heading('Build a reasoned decision package','Concrete titles and explicit connections make the case understandable.')
        for j,(t,b) in enumerate([('Sources & evidence','Separate known facts from open questions.'),('Decision','Link each choice to a reasoned next step.'),('Review & Reports','Resolve gaps, inspect the report and verify a save.')]):card(88+j*433,440,393,378,t,b,j+1)
        ribbon('Add missing evidence instead of writing an unsupported conclusion.')
    elif sid=='20':
        heading('Your practice task','Repeat the workflow with a fictional or de-identified example.')
        tasks=['Import and verify the canonical file','Explain one evidence-dependent decision','Inspect a draft report and preserve the case','Start a new fictional case']
        for j,t in enumerate(tasks):
            y=425+j*107;d.ellipse((90,y,140,y+50),fill=BLUE);d.text((107,y+10),str(j+1),font=font(23,True),fill='white');block(d,t,(168,y+6),1165,30,NAVY,True,1.2)
        ribbon('Help & training: guides, chapters and domain recovery.')
    else:raise ValueError(f'Missing illustration for scene {sid}')
    return im
