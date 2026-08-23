#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "${script_dir}/.." && pwd)"
help_dir="${project_root}/public/help"
editor_source="${help_dir}/case-studio-iterative-editing.mp4"
player_source="${help_dir}/play-your-studio-case.mp4"
output="${help_dir}/studio-ai-guided-demo.mp4"
poster="${help_dir}/studio-ai-guided-demo-poster.jpg"
font_sans="/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
font_sans_bold="/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
font_serif="/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
work_dir="$(mktemp -d /tmp/genesis-studio-demo.XXXXXX)"
trap 'rm -rf "${work_dir}"' EXIT

# FFmpeg duration parsing requires a leading zero for fractional seconds. Keep
# the authored filter strings compact and normalise them at the command edge.
ffmpeg() {
  local arguments=()
  local argument
  for argument in "$@"; do arguments+=("${argument//d=./d=0.}"); done
  command ffmpeg "${arguments[@]}"
}

common_video=(-an -r 25 -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart)
navy="#06131b"
cyan="#63c6cf"
gold="#d4aa5e"
white="#f3f1e9"
muted="#a9b5bb"

ffmpeg -hide_banner -loglevel error -y -f lavfi -i "color=c=${navy}:s=1280x720:r=25:d=5" -vf \
  "drawbox=x=54:y=52:w=1172:h=616:color=#0a1c26:t=fill,drawbox=x=54:y=52:w=8:h=616:color=${gold}:t=fill,drawtext=fontfile=${font_sans_bold}:text='GENESIS  JURIS CODEX':expansion=none:fontcolor=${cyan}:fontsize=24:x=96:y=96,drawtext=fontfile=${font_serif}:text='From brief to playable case':expansion=none:fontcolor=${white}:fontsize=58:x=96:y=190,drawtext=fontfile=${font_sans}:text='A two minute expert walkthrough of Case Studio':expansion=none:fontcolor=${muted}:fontsize=25:x=100:y=278,drawbox=x=96:y=384:w=360:h=2:color=${gold}:t=fill,drawtext=fontfile=${font_sans_bold}:text='USER VIEW  AI REVIEW  GRAPH  PLAYER  PDF':expansion=none:fontcolor=${white}:fontsize=18:x=96:y=420,fade=t=in:st=0:d=.5,fade=t=out:st=4.45:d=.55" \
  "${common_video[@]}" "${work_dir}/01.mp4"

ffmpeg -hide_banner -loglevel error -y -ss 0 -t 9 -i "${editor_source}" -vf \
  "scale=1280:720,drawbox=x=44:y=42:w=1192:h=112:color=#06131bcc:t=fill,drawbox=x=44:y=42:w=7:h=112:color=${gold}:t=fill,drawtext=fontfile=${font_sans_bold}:text='01  USER VIEW':expansion=none:fontcolor=${cyan}:fontsize=19:x=75:y=64,drawtext=fontfile=${font_serif}:text='A professional workbench without technical noise':expansion=none:fontcolor=${white}:fontsize=31:x=75:y=96,fade=t=in:st=0:d=.35,fade=t=out:st=8.55:d=.45" \
  "${common_video[@]}" "${work_dir}/02.mp4"

ffmpeg -hide_banner -loglevel error -y -ss 0 -t 6.5 -i "${editor_source}" -vf \
  "setpts=2*(PTS-STARTPTS),scale=1280:720,drawbox=x=54:y=44:w=1172:h=632:color=#06131bc0:t=fill,drawtext=fontfile=${font_sans_bold}:text='02  FIVE LINE SOURCE BRIEF':expansion=none:fontcolor=${gold}:fontsize=19:x=88:y=72,drawtext=fontfile=${font_serif}:text='Paste the matter as experts actually receive it':expansion=none:fontcolor=${white}:fontsize=34:x=88:y=112,drawbox=x=78:y=184:w=1124:h=360:color=#0c202bd9:t=fill,drawbox=x=78:y=184:w=6:h=360:color=${cyan}:t=fill,drawtext=fontfile=${font_sans}:text='Asteron implemented an ERP platform for Northbridge.':expansion=none:fontcolor=${white}:fontsize=22:x=112:y=222,drawtext=fontfile=${font_sans}:text='The go live failed and invoices remain unpaid.':expansion=none:fontcolor=${white}:fontsize=22:x=112:y=274,drawtext=fontfile=${font_sans}:text='A settlement offer of EUR 64,500 expires tomorrow.':expansion=none:fontcolor=${white}:fontsize=22:x=112:y=326,drawtext=fontfile=${font_sans}:text='Key implementation records are held by both parties.':expansion=none:fontcolor=${white}:fontsize=22:x=112:y=378,drawtext=fontfile=${font_sans}:text='Counsel must preserve evidence and choose a response.':expansion=none:fontcolor=${white}:fontsize=22:x=112:y=430,drawtext=fontfile=${font_sans_bold}:text='RAW BRIEF  5 LINES':expansion=none:fontcolor=${cyan}:fontsize=16:x=112:y=492,fade=t=in:st=0:d=.35,fade=t=out:st=12.5:d=.5" \
  "${common_video[@]}" "${work_dir}/03.mp4"

ffmpeg -hide_banner -loglevel error -y -ss 5 -t 7.5 -i "${editor_source}" -vf \
  "setpts=2*(PTS-STARTPTS),scale=1280:720,drawbox=x=42:y=40:w=1196:h=118:color=#06131bd9:t=fill,drawbox=x=42:y=40:w=7:h=118:color=${cyan}:t=fill,drawtext=fontfile=${font_sans_bold}:text='03  REVIEWABLE AI PROPOSAL':expansion=none:fontcolor=${cyan}:fontsize=19:x=76:y=64,drawtext=fontfile=${font_serif}:text='Nothing changes until the author reviews every operation':expansion=none:fontcolor=${white}:fontsize=30:x=76:y=99,drawbox=x=754:y=190:w=452:h=394:color=#081923e8:t=fill,drawtext=fontfile=${font_sans_bold}:text='CANDIDATE SCHEME':expansion=none:fontcolor=${gold}:fontsize=17:x=784:y=220,drawtext=fontfile=${font_sans}:text='9 semantic nodes':expansion=none:fontcolor=${white}:fontsize=22:x=784:y=270,drawtext=fontfile=${font_sans}:text='10 explicit relations':expansion=none:fontcolor=${white}:fontsize=22:x=784:y=316,drawtext=fontfile=${font_sans}:text='Deadlines and consequences':expansion=none:fontcolor=${white}:fontsize=22:x=784:y=362,drawtext=fontfile=${font_sans}:text='Economics stored as inputs':expansion=none:fontcolor=${white}:fontsize=22:x=784:y=408,drawbox=x=784:y=472:w=320:h=54:color=${gold}:t=fill,drawtext=fontfile=${font_sans_bold}:text='APPLY REVIEWED CHANGES':expansion=none:fontcolor=#10202c:fontsize=16:x=805:y=489,fade=t=in:st=0:d=.35,fade=t=out:st=14.45:d=.5" \
  "${common_video[@]}" "${work_dir}/04.mp4"

ffmpeg -hide_banner -loglevel error -y -ss 10 -t 7.5 -i "${editor_source}" -vf \
  "setpts=2*(PTS-STARTPTS),scale=1280:720,drawbox=x=44:y=44:w=1192:h=110:color=#06131bd9:t=fill,drawbox=x=44:y=44:w=7:h=110:color=${gold}:t=fill,drawtext=fontfile=${font_sans_bold}:text='04  APPLY AND REFINE':expansion=none:fontcolor=${cyan}:fontsize=19:x=76:y=66,drawtext=fontfile=${font_serif}:text='One atomic revision then precise manual editing':expansion=none:fontcolor=${white}:fontsize=30:x=76:y=99,drawbox=x=832:y=510:w=350:h=126:color=#081923e8:t=fill,drawtext=fontfile=${font_sans_bold}:text='NODE N06 UPDATED':expansion=none:fontcolor=${gold}:fontsize=18:x=858:y=536,drawtext=fontfile=${font_sans}:text='Settlement deadline clarified':expansion=none:fontcolor=${white}:fontsize=17:x=858:y=574,drawtext=fontfile=${font_sans}:text='Undo remains available':expansion=none:fontcolor=${cyan}:fontsize=15:x=858:y=604,fade=t=in:st=0:d=.35,fade=t=out:st=14.45:d=.5" \
  "${common_video[@]}" "${work_dir}/05.mp4"

ffmpeg -hide_banner -loglevel error -y -ss 13 -t 9 -i "${editor_source}" -vf \
  "setpts=2*(PTS-STARTPTS),scale=1280:720,drawbox=x=42:y=42:w=1196:h=108:color=#06131bd9:t=fill,drawbox=x=42:y=42:w=7:h=108:color=${cyan}:t=fill,drawtext=fontfile=${font_sans_bold}:text='05  CONTROL THE RELATIONSHIPS':expansion=none:fontcolor=${cyan}:fontsize=19:x=76:y=64,drawtext=fontfile=${font_serif}:text='Add  relink  delete  and undo without losing lineage':expansion=none:fontcolor=${white}:fontsize=29:x=76:y=98,drawbox=x=86:y=560:w=270:h=58:color=#0b2330e8:t=fill:enable='between(t,0,5.9)',drawtext=fontfile=${font_sans_bold}:text='ADD RELATION':expansion=none:fontcolor=${white}:fontsize=18:x=118:y=578:enable='between(t,0,5.9)',drawbox=x=504:y=560:w=270:h=58:color=#0b2330e8:t=fill:enable='between(t,6,11.9)',drawtext=fontfile=${font_sans_bold}:text='RELINK ENDPOINT':expansion=none:fontcolor=${white}:fontsize=18:x=532:y=578:enable='between(t,6,11.9)',drawbox=x=890:y=560:w=300:h=58:color=${gold}:t=fill:enable='between(t,12,18)',drawtext=fontfile=${font_sans_bold}:text='DELETE  THEN UNDO':expansion=none:fontcolor=#10202c:fontsize=18:x=918:y=578:enable='between(t,12,18)',fade=t=in:st=0:d=.35,fade=t=out:st=17.45:d=.5" \
  "${common_video[@]}" "${work_dir}/06.mp4"

ffmpeg -hide_banner -loglevel error -y -ss 0 -t 15 -i "${player_source}" -vf \
  "setpts=1.333333*(PTS-STARTPTS),scale=1280:720,drawbox=x=42:y=42:w=1196:h=108:color=#06131bd9:t=fill,drawbox=x=42:y=42:w=7:h=108:color=${gold}:t=fill,drawtext=fontfile=${font_sans_bold}:text='06  TEST THE CASE':expansion=none:fontcolor=${cyan}:fontsize=19:x=76:y=64,drawtext=fontfile=${font_serif}:text='The reviewed graph becomes a playable legal simulation':expansion=none:fontcolor=${white}:fontsize=29:x=76:y=98,drawtext=fontfile=${font_sans_bold}:text='CLOCK  EVIDENCE  COST  WORKLOAD  CONSEQUENCES':expansion=none:fontcolor=${white}:fontsize=16:x=74:y=670,fade=t=in:st=0:d=.35,fade=t=out:st=19.4:d=.6" \
  "${common_video[@]}" "${work_dir}/07.mp4"

ffmpeg -hide_banner -loglevel error -y -sseof -0.08 -i "${player_source}" -vf \
  "scale=1280:720,tpad=stop_mode=clone:stop_duration=10,drawbox=x=74:y=70:w=1132:h=580:color=#071924ec:t=fill,drawtext=fontfile=${font_sans_bold}:text='FINANCIAL OUTCOME':expansion=none:fontcolor=${cyan}:fontsize=18:x=108:y=106,drawtext=fontfile=${font_serif}:text='Settlement accepted':expansion=none:fontcolor=${white}:fontsize=43:x=108:y=152,drawbox=x=106:y=248:w=326:h=152:color=#0d2632:t=fill,drawtext=fontfile=${font_sans}:text='Award or settlement':expansion=none:fontcolor=${muted}:fontsize=17:x=132:y=274,drawtext=fontfile=${font_sans_bold}:text='EUR 64,500':expansion=none:fontcolor=${white}:fontsize=32:x=132:y=316,drawbox=x=476:y=248:w=326:h=152:color=#0d2632:t=fill,drawtext=fontfile=${font_sans}:text='Legal spend':expansion=none:fontcolor=${muted}:fontsize=17:x=502:y=274,drawtext=fontfile=${font_sans_bold}:text='EUR 2,350':expansion=none:fontcolor=${white}:fontsize=32:x=502:y=316,drawbox=x=846:y=248:w=326:h=152:color=${gold}:t=fill,drawtext=fontfile=${font_sans}:text='Net financial result':expansion=none:fontcolor=#1b2a32:fontsize=17:x=872:y=274,drawtext=fontfile=${font_sans_bold}:text='EUR 62,150':expansion=none:fontcolor=#10202c:fontsize=32:x=872:y=316,drawtext=fontfile=${font_sans}:text='9.0 billable hours  source authored values  deterministic ledger':expansion=none:fontcolor=${muted}:fontsize=18:x=108:y=470,fade=t=in:st=0:d=.35,fade=t=out:st=9.45:d=.55" \
  -t 10 "${common_video[@]}" "${work_dir}/08.mp4"

ffmpeg -hide_banner -loglevel error -y -f lavfi -i "color=c=${navy}:s=1280x720:r=25:d=9" -vf \
  "drawbox=x=58:y=46:w=1164:h=628:color=#0a1c26:t=fill,drawtext=fontfile=${font_sans_bold}:text='07  PROFESSIONAL PDF REPORT':expansion=none:fontcolor=${cyan}:fontsize=19:x=92:y=72,drawtext=fontfile=${font_serif}:text='A reviewable deliverable  not a black box':expansion=none:fontcolor=${white}:fontsize=34:x=92:y=112,drawbox=x=712:y=168:w=392:h=462:color=#f4f5f1:t=fill,drawbox=x=738:y=194:w=340:h=8:color=#163445:t=fill,drawtext=fontfile=${font_sans_bold}:text='GENESIS  JURIS CODEX':expansion=none:fontcolor=#163445:fontsize=16:x=742:y=222,drawtext=fontfile=${font_serif}:text='Professional Case Report':expansion=none:fontcolor=#10202c:fontsize=24:x=742:y=258,drawtext=fontfile=${font_sans_bold}:text='ERP settlement response':expansion=none:fontcolor=#10202c:fontsize=17:x=742:y=304,drawbox=x=742:y=350:w=310:h=1:color=#b7c4c8:t=fill,drawtext=fontfile=${font_sans}:text='Executive summary':expansion=none:fontcolor=#3d6573:fontsize=14:x=742:y=372,drawtext=fontfile=${font_sans}:text='Decision map and consequences':expansion=none:fontcolor=#3d6573:fontsize=14:x=742:y=408,drawtext=fontfile=${font_sans}:text='Economics and source register':expansion=none:fontcolor=#3d6573:fontsize=14:x=742:y=444,drawtext=fontfile=${font_sans}:text='Graph and verification checklist':expansion=none:fontcolor=#3d6573:fontsize=14:x=742:y=480,drawtext=fontfile=${font_sans_bold}:text='PDF READY':expansion=none:fontcolor=#c79b3b:fontsize=18:x=742:y=552,drawtext=fontfile=${font_sans}:text='Structured A4 report for review or circulation':expansion=none:fontcolor=${muted}:fontsize=21:x=92:y=286,drawtext=fontfile=${font_sans}:text='Raw AI prompts are excluded':expansion=none:fontcolor=${white}:fontsize=19:x=92:y=346,drawtext=fontfile=${font_sans}:text='Every conclusion remains linked to the reviewed graph':expansion=none:fontcolor=${white}:fontsize=19:x=92:y=392,drawtext=fontfile=${font_sans}:text='Fingerprint  lineage  economics  sources':expansion=none:fontcolor=${gold}:fontsize=18:x=92:y=462,fade=t=in:st=0:d=.35,fade=t=out:st=8.45:d=.55" \
  "${common_video[@]}" "${work_dir}/09.mp4"

ffmpeg -hide_banner -loglevel error -y -f lavfi -i "color=c=${navy}:s=1280x720:r=25:d=6" -vf \
  "drawbox=x=54:y=52:w=1172:h=616:color=#0a1c26:t=fill,drawbox=x=54:y=52:w=8:h=616:color=${gold}:t=fill,drawtext=fontfile=${font_sans_bold}:text='GENESIS  JURIS CODEX':expansion=none:fontcolor=${cyan}:fontsize=22:x=96:y=92,drawtext=fontfile=${font_serif}:text='Build  review  play  explain':expansion=none:fontcolor=${white}:fontsize=55:x=96:y=198,drawtext=fontfile=${font_sans}:text='AI proposes  professionals decide  the runtime stays deterministic':expansion=none:fontcolor=${muted}:fontsize=23:x=100:y=286,drawbox=x=96:y=382:w=410:h=58:color=${gold}:t=fill,drawtext=fontfile=${font_sans_bold}:text='OPEN CASE STUDIO':expansion=none:fontcolor=#10202c:fontsize=19:x=126:y=400,drawtext=fontfile=${font_sans}:text='Professional beta  August 2026':expansion=none:fontcolor=${cyan}:fontsize=16:x=96:y=512,fade=t=in:st=0:d=.45,fade=t=out:st=5.4:d=.6" \
  "${common_video[@]}" "${work_dir}/10.mp4"

ffmpeg -hide_banner -loglevel error -y \
  -i "${work_dir}/01.mp4" -i "${work_dir}/02.mp4" -i "${work_dir}/03.mp4" -i "${work_dir}/04.mp4" -i "${work_dir}/05.mp4" \
  -i "${work_dir}/06.mp4" -i "${work_dir}/07.mp4" -i "${work_dir}/08.mp4" -i "${work_dir}/09.mp4" -i "${work_dir}/10.mp4" \
  -filter_complex "[0:v][1:v][2:v][3:v][4:v][5:v][6:v][7:v][8:v][9:v]concat=n=10:v=1:a=0[v]" -map "[v]" \
  "${common_video[@]}" "${work_dir}/video.mp4"

narration=(
  "Genesis Juris Studio. From a short brief to a playable and explainable legal scenario."
  "Studio opens in User View. Technical identifiers stay out of the way while the complete professional workflow remains available."
  "Paste the situation in the form experts actually receive it. Five concise lines are enough to define the parties, urgency, evidence problem, financial offer, and decision."
  "The AI does not silently build or publish a case. It produces a read only candidate scheme. The author sees every proposed node, relationship, deadline, consequence, assumption, and economic input before applying anything."
  "Apply the reviewed proposal as one atomic revision. Then select a node and refine its title, facts, timing, budget, or professional consequence directly in the inspector."
  "Relationships remain under human control. Add a new route, focus either endpoint, relink the source or destination, delete the connection, and undo the complete change without losing version history."
  "When the graph passes validation, launch it in the same player used by published cases. Decisions advance time, expose evidence, consume budget and workload, and lead to authored consequences."
  "The final ledger keeps the economics explicit. In this reference path, a sixty four thousand five hundred euro settlement produces a net result of sixty two thousand one hundred fifty euros."
  "Finish with a structured PDF report containing the executive summary, decision map, economics, sources, verification checklist, graph, and content fingerprint."
  "Genesis Juris. AI proposes. Professionals decide. The case remains deterministic, reviewable, and ready to improve."
)
durations=(5 9 13 15 15 18 20 10 9 6)

for index in "${!narration[@]}"; do
  number="$(printf '%02d' "$((index+1))")"
  duration="${durations[$index]}"
  fade_start="$(awk -v duration="${duration}" 'BEGIN { printf "%.2f", duration-0.45 }')"
  ffmpeg -hide_banner -loglevel error -y -f lavfi -i "flite=text='${narration[$index]}':voice=awb" -af \
    "aresample=48000,volume=1.08,acompressor=threshold=-19dB:ratio=2.3:attack=18:release=180,apad=pad_dur=${duration},atrim=0:${duration},afade=t=in:st=0:d=.12,afade=t=out:st=${fade_start}:d=.4" \
    -t "${duration}" -c:a pcm_s16le "${work_dir}/audio-${number}.wav"
done

ffmpeg -hide_banner -loglevel error -y \
  -i "${work_dir}/audio-01.wav" -i "${work_dir}/audio-02.wav" -i "${work_dir}/audio-03.wav" -i "${work_dir}/audio-04.wav" -i "${work_dir}/audio-05.wav" \
  -i "${work_dir}/audio-06.wav" -i "${work_dir}/audio-07.wav" -i "${work_dir}/audio-08.wav" -i "${work_dir}/audio-09.wav" -i "${work_dir}/audio-10.wav" \
  -filter_complex "[0:a][1:a][2:a][3:a][4:a][5:a][6:a][7:a][8:a][9:a]concat=n=10:v=0:a=1[voice];sine=frequency=73:sample_rate=48000:duration=120,volume=0.015[low];sine=frequency=146:sample_rate=48000:duration=120,volume=0.007[high];[low][high]amix=inputs=2:normalize=0,lowpass=f=620[bed];[voice][bed]amix=inputs=2:normalize=0[a]" \
  -map "[a]" -t 120 -c:a aac -b:a 160k "${work_dir}/audio.m4a"

ffmpeg -hide_banner -loglevel error -y -i "${work_dir}/video.mp4" -i "${work_dir}/audio.m4a" -map 0:v -map 1:a -c:v copy -c:a copy -t 120 -movflags +faststart "${output}"
ffmpeg -hide_banner -loglevel error -y -ss 00:00:05.5 -i "${output}" -frames:v 1 -q:v 2 "${poster}"

ffprobe -v error -show_entries format=duration,size -of default=noprint_wrappers=1 "${output}"
