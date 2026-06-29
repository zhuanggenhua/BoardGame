// 仅在用户明确授权“直写生产 Mongo 回写反馈状态”后执行。
//
// 用法（本机 PowerShell）：
// Get-Content temp/feedback-closeout/update-feedback-status-20260618-safe-open-batch-if-authorized.js |
//   ssh admin@8.148.71.102 "docker exec -i boardgame-mongodb mongosh --quiet boardgame"
//
// 对应证据：
// evidence/feedback-closeout/safe-open-batch-pending-writeback-2026-06-18.md

const batchUpdatedAt = new Date();

const groups = [
  {
    label: 'Dice Throne ADVANCE_PHASE:not_active_player 86 条',
    status: 'resolved',
    ids: [
      '6a2ff09dc1f9d45aea62ba08',
      '6a2ffb11c1f9d45aea62ba6c',
      '6a2ffb67c1f9d45aea62ba74',
      '6a2ffb6ac1f9d45aea62ba7c',
      '6a300229c1f9d45aea62baa5',
      '6a30022cc1f9d45aea62baad',
      '6a30022fc1f9d45aea62bab5',
      '6a300375c1f9d45aea62babd',
      '6a300376c1f9d45aea62bac5',
      '6a30037ac1f9d45aea62bacd',
      '6a30038dc1f9d45aea62bad5',
      '6a3004bbc1f9d45aea62badd',
      '6a3004c0c1f9d45aea62bae5',
      '6a300528c1f9d45aea62baed',
      '6a30206ac1f9d45aea62bb0c',
      '6a30206fc1f9d45aea62bb14',
      '6a3020b6c1f9d45aea62bb1c',
      '6a3020bbc1f9d45aea62bb25',
      '6a30210ec1f9d45aea62bb2d',
      '6a3022aec1f9d45aea62bb36',
      '6a302cccc1f9d45aea62bb64',
      '6a303099c1f9d45aea62bba8',
      '6a3032f5c1f9d45aea62bbcd',
      '6a30333bc1f9d45aea62bbd6',
      '6a3035fbc1f9d45aea62bc02',
      '6a303957c1f9d45aea62bc21',
      '6a30bf30e7db65695ded7e3c',
      '6a30bf71e7db65695ded7e44',
      '6a30c013e7db65695ded7e4c',
      '6a30c01de7db65695ded7e54',
      '6a30c033e7db65695ded7e5c',
      '6a30c039e7db65695ded7e64',
      '6a30cee2e7db65695ded7eac',
      '6a30de29e7db65695ded7f50',
      '6a30e23fe7db65695ded7f6c',
      '6a30e55fe7db65695ded7f80',
      '6a3110cce7db65695ded8012',
      '6a312418e7db65695ded8045',
      '6a312655e7db65695ded804d',
      '6a3129ebe7db65695ded8078',
      '6a313aaae7db65695ded80c3',
      '6a313ab4e7db65695ded80cd',
      '6a313ab6e7db65695ded80d5',
      '6a31450ce7db65695ded8115',
      '6a314ac1e7db65695ded813b',
      '6a3178dae7db65695ded8210',
      '6a3179a2e7db65695ded821e',
      '6a3179a6e7db65695ded8226',
      '6a3179a8e7db65695ded822e',
      '6a3179d5e7db65695ded8238',
      '6a317be7e7db65695ded824b',
      '6a317bece7db65695ded8253',
      '6a317c10e7db65695ded825b',
      '6a317e19e7db65695ded8269',
      '6a318102e7db65695ded827d',
      '6a318106e7db65695ded8285',
      '6a318108e7db65695ded828d',
      '6a318fbbe7db65695ded82a5',
      '6a318fcee7db65695ded82ad',
      '6a322d35e7db65695ded92ef',
      '6a3266ec638b2f426d294ff1',
      '6a326865638b2f426d295006',
      '6a326936638b2f426d295012',
      '6a327c62638b2f426d295041',
      '6a327ddc638b2f426d295049',
      '6a327dde638b2f426d295051',
      '6a328334638b2f426d295074',
      '6a32857a638b2f426d29507d',
      '6a329067638b2f426d29511a',
      '6a329115638b2f426d295123',
      '6a329526638b2f426d2951b9',
      '6a32980f638b2f426d295211',
      '6a329827638b2f426d29521f',
      '6a329849638b2f426d29522a',
      '6a3298a8638b2f426d295247',
      '6a3299bc638b2f426d29526e',
      '6a3299d2638b2f426d29527c',
      '6a329a5c638b2f426d295290',
      '6a329e95638b2f426d29531b',
      '6a329e9e638b2f426d295323',
      '6a329f72638b2f426d295343',
      '6a32a127638b2f426d295375',
      '6a32b01c638b2f426d2955a7',
      '6a32b030638b2f426d2955af',
      '6a32b44f638b2f426d295625',
      '6a32bd66638b2f426d29572f',
    ],
  },
  {
    label: '七大恨 t is not defined 3 条',
    status: 'resolved',
    ids: [
      '6a313e7ae7db65695ded80e7',
      '6a316751e7db65695ded81c2',
      '6a32c96c638b2f426d295896',
    ],
  },
  {
    label: 'SmashUp 集会场 addTempPower 2 条',
    status: 'resolved',
    ids: [
      '6a320034e7db65695ded8e08',
      '6a320062e7db65695ded8e10',
    ],
  },
  {
    label: 'SmashUp 沉船湾 1 条',
    status: 'closed',
    ids: [
      '6a32b526638b2f426d295640',
    ],
  },
  {
    label: 'Dice Throne RESPONSE_PASS 忙碌窗 1 条',
    status: 'resolved',
    ids: [
      '6a32a4da638b2f426d295411',
    ],
  },
  {
    label: 'SmashUp 时空旅行者跳跃者旧候选漂移 1 条',
    status: 'resolved',
    ids: [
      '6a327ea0638b2f426d29505f',
    ],
  },
  {
    label: 'SmashUp active-turn follow-up advance no_progress 5 条',
    status: 'resolved',
    ids: [
      '6a3000fcc1f9d45aea62ba94',
      '6a3000ffc1f9d45aea62ba9c',
      '6a311637e7db65695ded8020',
      '6a3117b1e7db65695ded8028',
      '6a314d02e7db65695ded8179',
    ],
  },
  {
    label: 'client 好友请求不存在 1 条',
    status: 'closed',
    ids: [
      '6a2bf962717d92971c9e3848',
    ],
  },
  {
    label: 'SmashUp buildLegalActions Maximum call stack 1 条',
    status: 'closed',
    ids: [
      '6a2e12e8d789d530ed3254d4',
    ],
  },
  {
    label: 'client React 520 2 条',
    status: 'resolved',
    ids: [
      '6a316771e7db65695ded81c4',
      '6a32e44dfc7801341e0cc690',
    ],
  },
];

for (const group of groups) {
  const objectIds = group.ids.map((id) => ObjectId(id));
  const result = db.feedbacks.updateMany(
    {
      _id: { $in: objectIds },
      status: 'open',
    },
    {
      $set: {
        status: group.status,
        updatedAt: batchUpdatedAt,
      },
    },
  );
  print(JSON.stringify({
    label: group.label,
    targetStatus: group.status,
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    ids: group.ids,
    updatedAt: batchUpdatedAt,
  }));
}
