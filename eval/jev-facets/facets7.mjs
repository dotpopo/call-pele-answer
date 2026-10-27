import { BUILTIN_ADAPTERS } from '/workspace/work/call-pele-answer/skills/call-pele-answer/scripts/routers/systemone.mjs';
const blocks = [
 '浏览器先发 ClientHello，服务器回 ServerHello 和证书，浏览器验证证书后发送 Finished，双方开始加密通信。',
 '订单创建后进入待支付；支付成功变为已支付，超时 30 分钟未支付则自动取消；已支付订单发货后变为已发货。',
 'Redis 读延迟约 0.2 毫秒，PostgreSQL 约 2 毫秒，S3 约 30 毫秒；Redis 每 GB 每月约 15 美元，S3 约 0.02 美元。',
 '先备份数据库，再停写流量，然后执行迁移脚本，最后恢复写流量。',
 '慢的不是 pe：最近 50 次运行中位 52 毫秒，时间花在模型写两遍内容和调 4 次工具上。',
];
const Q = {
  two_parties_exchange: { type: 'noul', instructions: 'Does the text describe two or more named parties sending messages to each other in order?' },
  states_change: { type: 'noul', instructions: 'Does the text describe something moving between named states because of events?' },
  ordered_steps: { type: 'noul', instructions: 'Does the text give actions to do in a fixed order?' },
  branches: { type: 'noul', instructions: 'Does the text say that different things happen under different conditions?' },
  items_by_attributes: { type: 'noul', instructions: 'Does the text compare two or more items on the same two or more attributes?' },
  comparable_numbers: { type: 'noul', instructions: 'Does the text give numbers for two or more items measured in the same unit?' },
  single_claim: { type: 'noul', instructions: 'Can the whole text be said in one short sentence without losing a fact?' },
};
for (const name of ['typesafe', 'classifier-systemone']) {
  const a = BUILTIN_ADAPTERS.find(x => x.name === name);
  const t = Date.now();
  try { const r = await a.ask(blocks, Q); console.log(name, r.model, (Date.now() - t) + 'ms');
    r.forEach((x, i) => console.log(' ', i + 1, Object.entries(x).map(([k, v]) => k.split('_')[0] + '=' + (v.noul ?? v.probability ?? JSON.stringify(v)).toString().slice(0, 4)).join(' ')));
  } catch (e) { console.log(name, 'ERR', e.message, (Date.now() - t) + 'ms'); }
}
