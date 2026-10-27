P='prose';T='table'
L={0:[P],1:[P],2:[T],3:[T],4:[P],5:[P],6:[T],7:['steps'],8:[P],9:[T],10:[P],11:[T],12:[P],13:[T],
14:[P],15:[P],16:[T],17:[P],18:[P],19:[T],20:['steps'],21:[P],22:[P],23:[T],24:[T],25:[P],26:[P],27:[P],28:[T],29:[T],30:[P],31:[T],32:[T],33:[T],34:[P],35:[P],36:['sequenceDiagram',T],37:[P],38:[P],39:[T],40:[P,'block'],41:[T],42:[P],43:[P],44:[T],45:['architecture','flowchart'],46:[P],47:[T],48:[P],49:[T],50:[P],51:[P],52:[P],53:[T],54:[P,T],55:[T,'pie'],56:[P],57:[P],58:[P],59:[P,'steps']}
L.update({60:[T],61:[T],62:[T],63:[T],64:[T],65:[T],66:['steps'],67:[T],68:[T],69:[P],70:['flowchart'],71:[P],72:[P],73:[T],74:[P],75:[P,'flowchart'],76:[P],77:[P,'mindmap'],78:[P,'mindmap'],79:[P],80:[P],81:[T],82:[P],83:[T],84:[P,'tabs'],85:[P],86:[P,'steps'],87:[T,'bar'],88:[P],89:[T],90:['steps','flowchart'],91:['steps','gantt','timeline'],92:[T],93:[T],94:[P],95:[P],96:[T],97:[P],98:[T],99:[T],100:['callout',P],101:[T,'architecture'],102:[P],103:[P],104:[P]})
L.update({105:[T],106:[P],107:[T,'bar'],108:[P],109:[T],110:['steps'],111:[T],112:[T],113:[T],114:[P,'treeView'],115:['code',P],116:['code',P],117:[P],118:[P],119:[T],120:[P],121:[T,'gantt'],122:[P],123:[T],124:[P,'steps'],125:[P],126:[P],127:[P],128:[T],129:[P],130:[T],131:[T,'callout'],132:[P],133:[T],134:[P],135:['steps',P],136:[P],137:[P],138:[P,'mindmap'],139:[P],140:[T],141:[P],142:[P],143:[T],144:['callout',P],145:[T],146:[T],147:[T],148:[P],149:[T,'steps']})
L.update({150:[P],151:[P],152:[P],153:[T],154:[T],155:[T],156:[P],157:[P],158:[T],159:[T],160:[P],161:[P],162:[T],163:[P],164:[P],165:['steps',P],166:[P],167:['architecture',P],168:[T],169:[P],170:[P,'gitGraph'],171:['steps',P],172:[T],173:[T],174:[P],175:[P],176:[T],177:[T],178:[T],179:[P],180:[P,'slider'],181:[T],182:[P],183:[T],184:[P]})
import json,collections
B=json.load(open('runs.raw.json')); assert len(L)==len(B), (len(L),len(B))
out=[]; seen=collections.Counter()
for i,b in enumerate(B):
  q=b['id'].split('#')[0]
  # split by question so blocks of one draft never straddle tune/held-out
  out.append({'id':b['id'],'split':'t' if int(q.split('-')[1])%2 else 'h','gold':L[i],'text':b['text']})
json.dump(out,open('runs.json','w'),ensure_ascii=False,indent=0)
print(collections.Counter((o['gold'][0],o['split']) for o in out).most_common())
