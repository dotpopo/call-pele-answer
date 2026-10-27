// Text the agent would write when it does not author the diagram itself: drop reading guides and
// sentences that only point at a figure that was removed with its fence.
export function stripFigureTalk(t) {
  return t.split('\n')
    .filter(l => !/^\s*(>\s*)?(\*\*)?(看哪里|看交叉点|看两条路径|看最后|看分数|看右侧|看交点|看\S{0,8}：)/.test(l))
    .map(l => l.split(/(?<=[。！？])/).filter(s => !/(下图|上图|图中|图里|图线|这张图|左侧|右侧|菱形|箭头|节点|拖动滑块|滑块|曲线越|绿框|黄框|红框|图例|%%)/.test(s)).join(''))
    .filter(l => l.trim()).join('\n').trim();
}
