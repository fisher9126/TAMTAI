/* Aetherfall skill tree data (shared by browser and server): 3 branches per class, each with passive stat nodes, skill-upgrade nodes
   (more damage for one attack) and an "ultimate" node unlocked at level 20 / 40 / 60. Pure data. */
(function (root) {
  'use strict';
  const STAT = { atk: 'Sức đánh', def: 'Giáp', hp: 'Máu', mp: 'Mana', crit: 'Chí mạng', spd: 'Tốc độ' };
  const SK = { atk: 'Chém thường', spin: 'Chém xoáy', dash: 'Lao tới', quake: 'Chấn động', bolt: 'Phép bắn', fireball: 'Cầu lửa', frost: 'Băng giá', thunder: 'Sấm sét', meteor: 'Thiên thạch',
    arrow: 'Bắn cung', pierce: 'Tên xuyên', volley: 'Mưa tên', stunshot: 'Tên choáng', barrage: 'Loạt tên', stab: 'Đâm nhanh', backstab: 'Đâm lén', flurry: 'Loạt dao', execute: 'Hạ sát', smite: 'Thánh kích', holy: 'Thánh quang' };
  /* node builders: P = passive stats (per rank), S = skill damage (per rank), U = ultimate (one rank, several stats and skill damage) */
  const P = (id, name, eff, max, lv) => ({ id, name, eff, max: max || 5, lv: lv || 1, kind: 'p' });
  const S = (id, name, skill, per, max, lv) => ({ id, name, skill, per, max: max || 5, lv: lv || 1, kind: 's' });
  const U = (id, name, eff, skill, per, lv) => ({ id, name, eff, skill: skill || null, per: per || 0, max: 1, lv, kind: 'u' });
  const B = (name, desc, nodes) => ({ name, desc, nodes });
  const TREE = {
    warrior: [
      B('Thủ Hộ', 'Trụ cột của đội: nhiều máu, nhiều giáp.', [P('w1a', 'Da sắt', { def: 0.03 }), P('w1b', 'Tim thép', { hp: 0.03 }), P('w1c', 'Ý chí bất khuất', { mp: 0.04 }, 3, 5), P('w1d', 'Giáp dày', { def: 0.04 }, 3, 10), U('w1u', 'Bức tường thành', { hp: 0.2, def: 0.2 }, null, 0, 20)]),
      B('Cuồng Chiến', 'Sát thương gần và chí mạng.', [P('w2a', 'Lực chém', { atk: 0.03 }), P('w2b', 'Mắt chiến binh', { crit: 0.01 }, 5, 3), S('w2c', 'Chém mạnh hơn', 'atk', 0.06, 5, 5), S('w2d', 'Xoáy bão', 'spin', 0.08, 5, 8), U('w2u', 'Thần chiến tranh', { atk: 0.15, crit: 0.05 }, 'spin', 0.3, 20)]),
      B('Chấn Địa', 'Kỹ năng khống chế và xung kích.', [S('w3a', 'Lao như vũ bão', 'dash', 0.08, 5, 3), S('w3b', 'Dậm đất', 'quake', 0.08, 5, 10), P('w3c', 'Chân nhanh', { spd: 0.01 }, 4, 6), P('w3d', 'Nội lực', { mp: 0.05 }, 3, 12), U('w3u', 'Địa chấn', { atk: 0.1 }, 'quake', 0.4, 20)])
    ],
    mage: [
      B('Lửa', 'Sát thương phép bùng nổ.', [S('m1a', 'Cầu lửa nóng', 'fireball', 0.08, 5, 1), S('m1b', 'Thiên thạch lớn', 'meteor', 0.08, 5, 15), P('m1c', 'Trí tuệ lửa', { atk: 0.03 }), P('m1d', 'Nhiệt huyết', { crit: 0.01 }, 5, 6), U('m1u', 'Bão lửa', { atk: 0.15 }, 'meteor', 0.4, 20)]),
      B('Băng', 'Làm chậm, bền bỉ, nhiều mana.', [S('m2a', 'Băng buốt', 'frost', 0.08, 5, 5), P('m2b', 'Hơi lạnh', { mp: 0.05 }), P('m2c', 'Lớp băng', { def: 0.03 }, 4, 6), P('m2d', 'Máu băng', { hp: 0.03 }, 4, 8), U('m2u', 'Thời đại băng', { mp: 0.2, def: 0.15 }, 'frost', 0.4, 20)]),
      B('Bí Thuật', 'Chí mạng và sấm sét.', [S('m3a', 'Sấm sét', 'thunder', 0.08, 5, 12), S('m3b', 'Phép bắn', 'bolt', 0.06, 5, 2), P('m3c', 'Tập trung', { crit: 0.01 }, 5, 4), P('m3d', 'Dòng ma lực', { mp: 0.04 }, 5, 6), U('m3u', 'Tinh thông phép', { atk: 0.12, crit: 0.06, mp: 0.1 }, 'thunder', 0.3, 20)])
    ],
    archer: [
      B('Thiện Xạ', 'Chính xác và xa.', [S('a1a', 'Tên xuyên', 'pierce', 0.08, 5, 1), S('a1b', 'Bắn cung', 'arrow', 0.06, 5, 2), P('a1c', 'Tay vững', { atk: 0.03 }), P('a1d', 'Mắt đại bàng', { crit: 0.01 }, 5, 5), U('a1u', 'Phát tên thần', { atk: 0.15 }, 'pierce', 0.4, 20)]),
      B('Săn Mồi', 'Nhiều mục tiêu.', [S('a2a', 'Mưa tên', 'volley', 0.08, 5, 5), S('a2b', 'Loạt tên', 'barrage', 0.08, 5, 15), P('a2c', 'Săn lùng', { atk: 0.02 }, 5, 4), P('a2d', 'Bình tĩnh', { mp: 0.04 }, 4, 8), U('a2u', 'Vua thợ săn', { atk: 0.1, crit: 0.05 }, 'barrage', 0.4, 20)]),
      B('Linh Hoạt', 'Nhanh, bền hơn.', [P('a3a', 'Chân gió', { spd: 0.01 }, 5, 3), P('a3b', 'Áo da', { def: 0.03 }), P('a3c', 'Sức bền', { hp: 0.03 }), S('a3d', 'Tên choáng', 'stunshot', 0.08, 5, 12), U('a3u', 'Bóng gió', { spd: 0.08, hp: 0.12 }, null, 0, 20)])
    ],
    assassin: [
      B('Ám Sát', 'Một đòn hạ gục.', [S('s1a', 'Đâm lén', 'backstab', 0.08, 5, 1), S('s1b', 'Hạ sát', 'execute', 0.08, 5, 15), P('s1c', 'Dao sắc', { atk: 0.03 }), P('s1d', 'Điểm yếu', { crit: 0.01 }, 5, 4), U('s1u', 'Nhát cuối', { atk: 0.15, crit: 0.06 }, 'execute', 0.4, 20)]),
      B('Tốc Độ', 'Liên hoàn đòn nhanh.', [S('s2a', 'Đâm nhanh', 'stab', 0.06, 5, 2), S('s2b', 'Loạt dao', 'flurry', 0.08, 5, 8), P('s2c', 'Chân sáo', { spd: 0.01 }, 5, 3), P('s2d', 'Phản xạ', { def: 0.03 }, 4, 6), U('s2u', 'Cơn lốc dao', { spd: 0.08, atk: 0.1 }, 'flurry', 0.4, 20)]),
      B('Bóng Đêm', 'Sống sót và bất ngờ.', [P('s3a', 'Thân pháp', { hp: 0.03 }), P('s3b', 'Hơi thở lạnh', { mp: 0.04 }, 4, 3), P('s3c', 'Che giấu', { def: 0.03 }, 5, 5), P('s3d', 'Bản năng', { crit: 0.01 }, 5, 7), U('s3u', 'Vua bóng tối', { crit: 0.08, hp: 0.12 }, null, 0, 20)])
    ],
    healer: [
      B('Thánh Quang', 'Sát thương thánh.', [S('h1a', 'Thánh kích', 'smite', 0.08, 5, 1), S('h1b', 'Thánh quang', 'holy', 0.08, 5, 5), P('h1c', 'Ánh sáng', { atk: 0.03 }), P('h1d', 'Lòng sùng đạo', { crit: 0.01 }, 5, 6), U('h1u', 'Phán xét', { atk: 0.15 }, 'holy', 0.4, 20)]),
      B('Chữa Lành', 'Nhiều mana và máu.', [P('h2a', 'Tâm tịnh', { mp: 0.05 }), P('h2b', 'Thể chất', { hp: 0.04 }), P('h2c', 'Hồi nhanh', { mp: 0.04 }, 5, 6), P('h2d', 'Phúc lành', { hp: 0.04 }, 5, 10), U('h2u', 'Suối nguồn', { mp: 0.2, hp: 0.15 }, null, 0, 20)]),
      B('Bảo Hộ', 'Giáp và tốc độ.', [P('h3a', 'Lá chắn thánh', { def: 0.04 }), P('h3b', 'Bước nhẹ', { spd: 0.01 }, 4, 4), P('h3c', 'Ý chí', { hp: 0.03 }, 5, 6), P('h3d', 'Quyết tâm', { atk: 0.02 }, 5, 8), U('h3u', 'Thiên thần hộ mệnh', { def: 0.2, hp: 0.15 }, null, 0, 20)])
    ]
  };
  /* ultimate nodes above level 20: stronger versions (level 40 and 60) are appended to every branch */
  Object.keys(TREE).forEach((c) => TREE[c].forEach((b, bi) => {
    const u = b.nodes[b.nodes.length - 1];
    [40, 60].forEach((lv) => {
      const k = lv / 20; b.nodes.push(U(u.id + lv, u.name + (lv === 40 ? ' II' : ' III'), Object.keys(u.eff).reduce((o, s) => { o[s] = +(u.eff[s] * (k === 2 ? 0.8 : 1.2)).toFixed(3); return o; }, {}), u.skill, u.skill ? +(u.per * (k === 2 ? 0.8 : 1.2)).toFixed(3) : 0, lv));
    });
  }));
  const byId = {}; Object.keys(TREE).forEach((c) => TREE[c].forEach((b, bi) => b.nodes.forEach((n) => { n.cls = c; n.branch = bi; byId[n.id] = n; })));
  const POINTS_PER_LEVEL = 1, SETS = 3, ULT_NEED = 8; // points needed inside a branch before its ultimate nodes open
  const pointsTotal = (level) => Math.max(0, ((level | 0) - 1) * POINTS_PER_LEVEL);
  const resetCost = (level) => ((level | 0) < 20 ? 0 : (level | 0) * 80);
  const api = { TREE, byId, STAT, SK, POINTS_PER_LEVEL, SETS, ULT_NEED, pointsTotal, resetCost };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AF_TREE = api;
})(typeof window !== 'undefined' ? window : globalThis);
