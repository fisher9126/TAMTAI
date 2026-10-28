/* Aetherfall story data (shared): NPCs, main story (prologue + 6 chapters), side quests, daily quests, choices, titles.
   Used by the browser (window.AF_STORY) and by server/quests.js (require). Pure data, no logic besides tiny helpers.
   The story follows the design doc, moved onto the zones that exist in the game today:
   village = Thung lũng Bình Minh, Rừng Bóng Đèn / Đấu trường = chapter 1, Đầm Lầy = chapter 2, Mỏ Quặng = chapter 3,
   Cánh Đồng Tủ Lạnh = chapter 4, Hầm Ngục Tro Đen = chapter 5, Bãi Tế Thần (boss thế giới) = chapter 6. */
(function (root) {
  'use strict';
  const NPCS = {
    mira: { name: 'Mira', title: 'Cô bé làng Ashford', x: -4, z: 12, color: 0xf2a6c0 },
    elara: { name: 'Elara', title: 'Pháp sư Elf của Hội Pháp Sư', x: 7, z: 6, color: 0x8ec5f2 },
    bram: { name: 'Bram Đá Sắt', title: 'Thợ rèn người lùn', x: -9, z: 3, color: 0xc48a52 },
    kaelen: { name: 'Ser Kaelen', title: 'Chỉ huy Hội Hiệp Sĩ', x: 12, z: -5, color: 0xd9d9e6 },
    rowan: { name: 'Rowan', title: 'Thợ săn', x: 40, z: 38, color: 0x7ddc8f },
    gideon: { name: 'Gideon', title: 'Thương nhân lưu động', x: -28, z: 22, color: 0xffd95a },
    orrin: { name: 'Orrin', title: 'Thầy thuốc', x: -52, z: -22, color: 0xb48cff },
    aldwin: { name: 'Người lữ khách', title: 'Kẻ lang thang không tên', x: -12, z: -60, color: 0x9a8f7a },
    vex: { name: 'Vex', title: 'Sát thủ Orc', x: 40, z: -66, color: 0x6a9a5a }
  };
  const Z = { // places used by "visit" objectives
    forest: { x: 55, z: 50, r: 12, name: 'Rừng Bóng Đèn' }, arena: { x: 62, z: -58, r: 14, name: 'Đấu trường' },
    swamp: { x: -62, z: -30, r: 16, name: 'Đầm Lầy Nấm Độc' }, mine: { x: -20, z: -72, r: 16, name: 'Mỏ Quặng Gỉ Sét' }, frost: { x: -55, z: 62, r: 14, name: 'Cánh Đồng Tủ Lạnh' },
    boss: { x: 78, z: 2, r: 16, name: 'Bãi Tế Thần' }
  };
  const V = (k) => Object.assign({ k: 'visit' }, Z[k]);
  const list = [];
  /* q(id, chapter, giver, title, objective, need, minLevel, prerequisite ids, reward, offer text, done text, extra) */
  function q(id, ch, giver, title, obj, need, lv, pre, reward, offer, done, extra) {
    list.push(Object.assign({ id, ch, giver, to: giver, title, obj, need, lv, pre: pre || [], reward, offer, done }, extra || {}));
  }
  const kill = (type, n) => [{ k: 'kill', type }, n];
  const have = (m, n) => [{ k: 'have', m }, n];

  /* ---- Mở đầu: Kẻ Không Tro ---- */
  q('s01', 'Mở đầu · Kẻ Không Tro', 'mira', 'Tiếng kêu cứu', ...kill('teieretta', 4), 1, [], { exp: 0.4, gold: 25, potions: 2 },
    'Cứu em với! Mấy con ốc sên phủ tro đang bò vào ruộng, chị em không dám ra ngoài!', 'Cảm ơn anh chị! Hồi nãy em thấy vết sao sáng lên trên tay anh chị đó. Anh chị nên gặp cô Elara.');
  q('s02', 'Mở đầu · Kẻ Không Tro', 'elara', 'Vết sao trên tay', { k: 'talk', npc: 'bram' }, 1, 1, ['s01'], { exp: 0.3, gold: 20 },
    'Cho ta xem tay của bạn... Vết sao thật sự. Người bị tro bám lẽ ra đã hóa quái rồi. Hãy đến gặp Bram ở lò rèn, bảo ông ấy rằng ta gửi bạn.', 'Bram nói gì? Ông ấy hay nóng tính, nhưng tay nghề thì tốt nhất vùng này.');
  q('s03', 'Mở đầu · Kẻ Không Tro', 'bram', 'Lò rèn của Bram', ...have('ore', 3), 1, ['s02'], { exp: 0.4, gold: 30, item: ['weapon', 'rare'] },
    'Elara gửi bạn hả? Ta cần quặng để rèn thử một lưỡi đồng pha bụi sao. Mang cho ta 3 quặng gỉ ở mỏ phía Nam.', 'Tốt! Cầm lấy, lưỡi này pha chút bụi sao. Nó sẽ không bao giờ gỉ.');
  q('s04', 'Mở đầu · Kẻ Không Tro', 'elara', 'Bài kiểm tra', V('forest'), 1, 2, ['s03'], { exp: 0.5, gold: 40, title: 'Kẻ Không Tro' },
    'Có một mảnh sao nhỏ nằm trong Rừng Bóng Đèn. Hãy chạm vào nó: nếu tro không bám vào bạn, bạn đúng là Kẻ Không Tro.', 'Tro không động đến bạn. Bạn là người duy nhất có thể thu thập và thanh tẩy các mảnh sao.');

  /* ---- Chương 1: Tro trên đồng cỏ (làng, Rừng Bóng Đèn, Đấu trường) ---- */
  q('c1a', 'Chương 1 · Tro trên đồng cỏ', 'rowan', 'Dấu vết bóng đèn', ...kill('gufo', 5), 3, ['s04'], { exp: 0.5, gold: 40, potions: 2 },
    'Lũ Gufo Lampadino bỗng hung dữ, đứa nào cũng đeo bùa tro. Hạ giúp tôi 5 con quanh Rừng Bóng Đèn.', 'Đúng là có tro dính trên lông chúng. Có kẻ đang cố ý rải tro.');
  q('c1b', 'Chương 1 · Tro trên đồng cỏ', 'rowan', 'Lông và bùa tro', ...have('feather', 5), 3, ['c1a'], { exp: 0.4, gold: 50, mats: { herb: 4 } },
    'Gom 5 lông bóng đèn cho tôi, tôi sẽ khâu lại thành áo choàng và nghiên cứu tro bám trên đó.', 'Bùa đó làm từ tro của Giáo phái Tro Tàn. Chúng đang ở gần.');
  q('c1c', 'Chương 1 · Tro trên đồng cỏ', 'elara', 'Người áo choàng xám', V('arena'), 1, 5, ['c1b'], { exp: 0.5, gold: 60 },
    'Một tín đồ Giáo phái Tro Tàn vừa được thấy ở Đấu trường phía Đông Nam. Đến đó xem hắn đang làm gì, nhưng đừng đánh một mình con bò máy giặt.', 'Nơi đó đầy vết cháy và tro. Con bò máy giặt kia chắc chắn đã ăn mảnh sao.');
  q('c1d', 'Chương 1 · Tro trên đồng cỏ', 'kaelen', 'Con bò máy giặt', ...kill('boss', 1), 8, ['c1c'], { exp: 1.2, gold: 150, item: ['any', 'epic'], title: 'Diệt Lavatricio' },
    'Ta là Ser Kaelen. Con quái ở Đấu trường đã nuốt mảnh sao, nó khỏe lên từng ngày. Hạ nó, dù phải rủ cả đội.', 'Một chiến công đáng nể! Mảnh sao trong bụng nó nằm lại cho bạn.');
  q('c1e', 'Chương 1 · Tro trên đồng cỏ', 'bram', 'Mảnh sao thứ nhất', ...have('gear', 2), 8, ['c1d'], { exp: 0.8, gold: 100, item: ['weapon', 'epic'] },
    'Mảnh sao Lửa này nóng như than hồng. Ta cần 2 bánh răng máy giặt làm lõi để rèn nó thành vũ khí.', 'Xong! Mảnh sao Lửa đã được thanh tẩy. Bạn cảm thấy ngón tay ấm lên.');

  /* ---- Chương 2: Đầm lầy ---- */
  q('c2a', 'Chương 2 · Đầm Lầy Nấm Độc', 'elara', 'Lối vào sương mù', V('swamp'), 1, 7, ['c1e'], { exp: 0.5, gold: 60 },
    'Mảnh sao thứ hai nằm sâu trong Đầm Lầy ở phía Tây Nam. Hãy đến rìa đầm, ta nghe nói dân làng ở đó đang lâm bệnh.', 'Không khí ở đây đặc quánh. Đi cẩn thận.');
  q('c2b', 'Chương 2 · Đầm Lầy Nấm Độc', 'orrin', 'Thầy thuốc ở rìa đầm', ...kill('fungo', 6), 7, ['c2a'], { exp: 0.6, gold: 70 },
    'Tôi là Orrin, thầy thuốc. Nấm tro đang lây sang người. Tôi cần bạn diệt bớt lũ Funghino để chúng ngừng phát bào tử.', 'Cảm ơn bạn. Giờ tôi có thể làm việc mà không phải chạy trốn.');
  q('c2c', 'Chương 2 · Đầm Lầy Nấm Độc', 'orrin', 'Thuốc giải tạm', ...have('shroom', 6), 8, ['c2b'], { exp: 0.7, gold: 90 },
    'Tôi cần 6 nấm phát sáng để thử một liều thuốc mới. Nó có thể làm người nhiễm tro tỉnh lại, nhưng tôi phải thử trên người bệnh.', 'Thuốc đã xong. Giờ chỉ còn câu hỏi bạn có để tôi thử trên người bệnh không.',
    { choice: { q: 'Orrin xin thử thuốc trên người nhiễm bệnh. Bạn trả lời sao?', opts: [{ t: 'Giúp Orrin hoàn thiện thuốc', flag: 'orrin', v: 1, reply: 'Orrin gật đầu: "Tôi sẽ không quên chuyện này."' }, { t: 'Yêu cầu ông ngừng thí nghiệm', flag: 'orrin', v: 2, reply: 'Orrin thở dài: "Có lẽ bạn đúng. Tôi sẽ tìm cách khác."' }] } });
  q('c2d', 'Chương 2 · Đầm Lầy Nấm Độc', 'elara', 'Nhện nồi hầm', ...kill('ragno', 6), 9, ['c2c'], { exp: 0.7, gold: 100 },
    'Lũ Ragno Pentola đang canh đường vào đền cũ. Hạ 6 con để mở đường.', 'Đường đã thông. Đêm qua ta mơ thấy một giọng nói gọi tên bạn...');
  q('c2e', 'Chương 2 · Đầm Lầy Nấm Độc', 'elara', 'Sự thật về Elara', { k: 'none' }, 0, 9, ['c2d'], { exp: 0.5, gold: 50 },
    'Bạn đã tìm thấy bức thư trong đền: ta từng là học trò của Seraphine, thủ lĩnh Giáo phái Tro Tàn. Ta không giấu nữa. Bạn tin ta chứ?', 'Cảm ơn đã nghe ta nói.',
    { choice: { q: 'Elara từng là học trò của kẻ phản bội. Bạn nghĩ sao?', opts: [{ t: 'Tin Elara', flag: 'elara', v: 1, reply: 'Elara mỉm cười: "Ta sẽ không phụ lòng tin này."' }, { t: 'Còn nghi ngờ', flag: 'elara', v: 2, reply: 'Elara cúi đầu: "Ta hiểu. Hãy xem việc ta làm."' }] } });
  q('c2f', 'Chương 2 · Đầm Lầy Nấm Độc', 'elara', 'Vua nấm bùn', ...kill('sporo', 1), 11, ['c2e'], { exp: 1.5, gold: 200, item: ['any', 'epic'], title: 'Người diệt Nấm Vua' },
    'Mảnh sao thứ hai nằm trong thân Re Nấm Bùn. Hạ nó, nhưng hãy rủ thêm người.', 'Mảnh sao Đất nằm gọn trong tay bạn.');
  q('c2g', 'Chương 2 · Đầm Lầy Nấm Độc', 'bram', 'Mảnh sao thứ hai', ...have('venom', 4), 11, ['c2f'], { exp: 0.9, gold: 120, item: ['armor', 'epic'] },
    'Mảnh sao Đất cần tuyến độc để tôi luyện không bị nứt. Mang cho ta 4 tuyến độc.', 'Giáp này vừa với bạn. Nó sẽ giữ bạn sống lâu hơn.');

  /* ---- Chương 3: Mỏ quặng ---- */
  q('c3a', 'Chương 3 · Mỏ Quặng Gỉ Sét', 'gideon', 'Đường tới mỏ', V('mine'), 1, 10, ['c2g'], { exp: 0.5, gold: 80 },
    'Tôi là Gideon, thương nhân. Mỏ Quặng ở phía Nam là nơi buôn bán sầm uất nhất, nhưng gần đây quái chặn đường. Đi trước dò đường giúp tôi.', 'Hóa ra mỏ đầy quặng nhưng đầy quái nữa.');
  q('c3b', 'Chương 3 · Mỏ Quặng Gỉ Sét', 'gideon', 'Hợp đồng nguy hiểm', ...kill('talpa', 8), 10, ['c3a'], { exp: 0.8, gold: 140, mats: { ore: 6 } },
    'Chuột Chũi Búa đào hang dưới đường vận chuyển. Hạ 8 con, tôi trả công hậu hĩnh.', 'Đường vận chuyển lại an toàn rồi. Công của bạn đây.');
  q('c3c', 'Chương 3 · Mỏ Quặng Gỉ Sét', 'vex', 'Kẻ ám sát trong đêm', ...kill('golem', 4), 12, ['c3b'], { exp: 0.9, gold: 150 },
    'Ta là Vex. Ta được lệnh ám sát bạn, nhưng ta chán Giáo phái Tro Tàn rồi. Hạ giúp ta 4 Golem Nồi Cơm, chúng canh giữ đường rút lui.', 'Bạn thật sự mạnh. Ta nợ bạn một câu trả lời.');
  q('c3d', 'Chương 3 · Mỏ Quặng Gỉ Sét', 'vex', 'Lựa chọn của Vex', { k: 'none' }, 0, 12, ['c3c'], { exp: 0.4, gold: 80 },
    'Giờ bạn quyết định số phận ta. Tha cho ta thì ta thành đồng minh. Giao ta cho Hội Hiệp Sĩ thì bạn nhận thưởng.', 'Vậy là xong.',
    { choice: { q: 'Bạn xử trí Vex thế nào?', opts: [{ t: 'Tha cho Vex', flag: 'vex', v: 1, reply: 'Vex cười nhạt: "Ta sẽ trả ơn, Kẻ Không Tro."' }, { t: 'Giao Vex cho Hội Hiệp Sĩ', flag: 'vex', v: 2, reply: 'Vex im lặng. Kaelen gửi cho bạn thêm tiền thưởng.', gold: 300 }] } });
  q('c3e', 'Chương 3 · Mỏ Quặng Gỉ Sét', 'aldwin', 'Người lữ khách không tên', ...have('coal', 6), 12, ['c3d'], { exp: 0.8, gold: 110 },
    'Tôi chỉ là kẻ lang thang. Nhưng tôi biết lối vào hầm ngục dưới mỏ. Mang cho tôi 6 than đá để nhóm lửa, rồi tôi kể.', 'Than nóng thật. Bạn khá giống một người tôi từng biết...');
  q('c3f', 'Chương 3 · Mỏ Quặng Gỉ Sét', 'aldwin', 'Hầm Ngục Tro Đen', { k: 'clears' }, 1, 12, ['c3e'], { exp: 1.2, gold: 200, mats: { core: 2 } },
    'Cổng hầm ngục ở phía Nam làng. Bên trong tro chảy thành sông. Hãy hạ boss ở đó cùng đồng đội.', 'Bạn trở về còn sống! Hầm ngục đã biết sợ bạn.');
  q('c3g', 'Chương 3 · Mỏ Quặng Gỉ Sét', 'kaelen', 'Vua quặng gỉ', ...kill('reQuang', 1), 14, ['c3f'], { exp: 1.6, gold: 250, item: ['any', 'epic'], title: 'Phá Mỏ' },
    'Vua Quặng Gỉ nuốt mảnh sao thứ ba vào lõi sắt của hắn. Hạ hắn, nhưng nhớ đem thuốc.', 'Mảnh sao Sét nằm giữa đống quặng. Hội Hiệp Sĩ nợ bạn một lần.');
  q('c3h', 'Chương 3 · Mỏ Quặng Gỉ Sét', 'aldwin', 'Mảnh sao thứ ba', ...have('gem', 2), 14, ['c3g'], { exp: 1, gold: 160, item: ['cape', 'epic'] },
    'Cho tôi 2 đá quý, tôi sẽ nói sự thật về mình: tôi là Aldwin, con trai nhà vua Aldric. Cha tôi vẫn còn sống...', 'Cha tôi chưa chết. Giờ tôi mới nói thật: bạn là hy vọng cuối cùng.');

  /* ---- Chương 4: Cánh Đồng Tủ Lạnh ---- */
  q('c4a', 'Chương 4 · Cánh Đồng Tủ Lạnh', 'aldwin', 'Đèo băng', V('frost'), 1, 13, ['c3h'], { exp: 0.6, gold: 100 },
    'Đường lên kinh đô đi qua cánh đồng băng phía Tây Bắc. Hãy đi trước, ta theo sau.', 'Lạnh đến mức hơi thở đông lại. Cẩn thận tuyết lở.');
  q('c4b', 'Chương 4 · Cánh Đồng Tủ Lạnh', 'bram', 'Bộ tộc phương Bắc', ...kill('pinguino', 8), 13, ['c4a'], { exp: 1, gold: 170 },
    'Tộc lùn phương Bắc chỉ tin kẻ biết đánh. Hạ 8 Pinguino đang quấy phá trại họ.', 'Họ đã công nhận bạn. Đường hầm cổ mở cho bạn.');
  q('c4c', 'Chương 4 · Cánh Đồng Tủ Lạnh', 'orrin', 'Hoa băng và thuốc giải', ...have('frost', 6), 14, ['c4b'], { exp: 1, gold: 180 },
    'Thuốc giải của tôi cần hoa băng. Mang cho tôi 6 bông.', 'Nếu bạn đã giúp tôi ở đầm lầy, thuốc sẽ mạnh hơn. Nếu không, vẫn dùng được.', { bonusFlag: { orrin: 1, gold: 200, title: 'Bạn của Thầy Thuốc' } });
  q('c4d', 'Chương 4 · Cánh Đồng Tủ Lạnh', 'elara', 'Seraphine lộ diện', ...kill('orso', 6), 15, ['c4c'], { exp: 1.1, gold: 200 },
    'Seraphine vừa xuất hiện, cướp hai mảnh sao rồi biến mất. Hạ Orso Ghiacciolo canh trại của cô ta, ta sẽ lần theo dấu.', 'Ta bị thương, nhưng ta thấy mặt cô ấy. Cô ta vẫn là thầy cũ của ta.');
  q('c4e', 'Chương 4 · Cánh Đồng Tủ Lạnh', 'kaelen', 'Ser Kaelen trở mặt', { k: 'none' }, 0, 15, ['c4d'], { exp: 0.6, gold: 100 },
    'Mảnh sao là vũ khí. Hội Hiệp Sĩ cần chúng để chặn Giáo phái. Bạn đứng về phía ta hay phía Aldwin?', 'Vậy là quyết định.',
    { choice: { q: 'Mảnh sao nên dùng làm gì?', opts: [{ t: 'Ủng hộ Ser Kaelen (dùng làm vũ khí)', flag: 'side', v: 1, reply: 'Kaelen gật đầu, tặng bạn thêm tiền thưởng.', gold: 300 }, { t: 'Ủng hộ Aldwin (thanh tẩy)', flag: 'side', v: 2, reply: 'Aldwin siết chặt tay bạn: "Cảm ơn."' }] } });
  q('c4f', 'Chương 4 · Cánh Đồng Tủ Lạnh', 'aldwin', 'Nữ hoàng băng', ...kill('regina', 1), 17, ['c4e'], { exp: 2, gold: 350, item: ['any', 'legend'], title: 'Phá Băng' },
    'Regina Gelata canh giữ lối vào kinh đô. Hạ nàng, nhưng đừng đi một mình.', 'Mảnh sao Ánh sáng nằm lại trên tuyết. Kinh đô đang chờ.');
  q('c4g', 'Chương 4 · Cánh Đồng Tủ Lạnh', 'elara', 'Mảnh sao thứ tư', ...have('pelt', 6), 17, ['c4f'], { exp: 1.2, gold: 220, item: ['armor', 'epic'] },
    'Ta cần 6 da lông băng để quấn quanh mảnh sao, ngăn nó phát sáng quá mạnh.', 'Mảnh sao yên rồi. Giờ ta kể bạn nghe hết về Seraphine...');

  /* ---- Chương 5: Ngai vàng phủ tro (hầm ngục) ---- */
  q('c5a', 'Chương 5 · Ngai vàng phủ tro', 'kaelen', 'Cuộc tuần hầm ngục', { k: 'clears' }, 3, 15, ['c4g'], { exp: 1.5, gold: 300, mats: { gem: 2 } },
    'Hầm ngục Tro Đen là cổng vào kinh đô. Dọn nó 3 lần để chắc chắn mọi quái đều đã biết sợ.', 'Ba lần rồi, hầm ngục yên ắng hẳn.', { clears: 3 });
  q('c5b', 'Chương 5 · Ngai vàng phủ tro', 'aldwin', 'Kinh đô câm lặng', { k: 'steles' }, 6, 16, ['c5a'], { exp: 1.2, gold: 250, title: 'Người Đọc Bia' },
    'Kinh đô phủ tro, nhưng bia đá cổ còn rải rác khắp thế giới. Đọc 6 tấm để hiểu đêm Sao Rơi.', 'Tôi nghe cha tôi trong những dòng chữ đó.');
  q('c5c', 'Chương 5 · Ngai vàng phủ tro', 'aldwin', 'Vua Tro Aldric', ...kill('dboss', 1), 18, ['c5b'], { exp: 2, gold: 400, item: ['any', 'legend'], title: 'Người Gọi Vua' },
    'Cha tôi đã bị tro chiếm xác. Trong hầm ngục, hãy hạ Vua Tro nhưng đừng giết ông. Tôi sẽ gọi cha.', 'Cha tôi mỉm cười... rồi ngủ yên. Nếu thầy thuốc Orrin đã giúp, có thể ông còn cứu được.');
  q('c5d', 'Chương 5 · Ngai vàng phủ tro', 'elara', 'Mảnh sao thứ năm', ...have('core', 3), 18, ['c5c'], { exp: 1.4, gold: 300, item: ['weapon', 'legend'] },
    'Ta cần 3 lõi tro để gói mảnh sao Ánh sáng. Sau đó chúng ta sẽ đến Bãi Tế Thần.', 'Năm mảnh sao đã đủ. Giờ là lúc đối mặt với Seraphine.');

  /* ---- Chương 6: Vực Thẳm Hư Không ---- */
  q('c6a', 'Chương 6 · Vực Thẳm Hư Không', 'elara', 'Tập hợp đồng minh', ...have('gear', 4), 20, ['c5d'], { exp: 1.2, gold: 400 },
    'Mỗi đồng minh cần một vũ khí tốt. Mang 4 bánh răng cho Bram để chế súng bắn mảnh sao.', 'Bram đã làm xong. Các đồng minh sẵn sàng.');
  q('c6b', 'Chương 6 · Vực Thẳm Hư Không', 'kaelen', 'Cuộc hành quân', V('boss'), 1, 20, ['c6a'], { exp: 1.2, gold: 400 },
    'Quân ta tập trung ở Bãi Tế Thần phía Đông. Đến đó và đứng chung hàng ngũ.', 'Bạn đã đến. Chúng ta không còn đường lui.');
  q('c6c', 'Chương 6 · Vực Thẳm Hư Không', 'elara', 'Kẻ nuốt sao', ...kill('wboss', 1), 22, ['c6b'], { exp: 3, gold: 800, item: ['any', 'legend'], title: 'Kẻ Hạ Gran Lavatrice' },
    'Morvain gửi Gran Lavatrice Ardente xuống thế gian. Boss thế giới xuất hiện theo giờ ở Bãi Tế Thần. Hạ nó cùng cả máy chủ.', 'Morvain vẫn thức dậy, nhưng bạn đã làm chậm hắn. Giờ là lúc chọn kết thúc.');
  q('c6d', 'Kết thúc · Lựa chọn của Kẻ Không Tro', 'elara', 'Ngôi sao cuối cùng', { k: 'none' }, 0, 22, ['c6c'], { exp: 4, gold: 1000, item: ['any', 'legend'], title: 'Người Gìn Giữ Aether' },
    'Mọi thứ đã sẵn sàng. Hãy chọn con đường của bạn. Kết thúc bạn chọn sẽ ghi vào sổ vàng của thế giới.', 'Câu chuyện của Aether kết thúc ở đây. Nhưng thế giới thì vẫn mở.',
    { choice: { q: 'Bạn chọn kết thúc nào?', opts: [{ t: 'Thanh tẩy: xóa tro khỏi thế giới, Aldwin lên ngôi', flag: 'ending', v: 1, reply: 'Vết sao trên tay bạn mờ dần. Tro tan trong gió.' }, { t: 'Thắp sao mới: hy sinh sức mạnh, giữ cân bằng sáu nguyên tố', flag: 'ending', v: 2, reply: 'Một ngôi sao mới sáng lên trên bầu trời Aether.' }, { t: 'Phong ấn Morvain vào chính vết sao (cần đủ 12 bia đá)', flag: 'ending', v: 3, need: 'steles12', reply: 'Vết sao trên tay bạn đen lại, nhưng thế giới được yên. Đây chỉ là bắt đầu.' }] } });

  /* ---- Nhiệm vụ phụ ---- */
  q('p01', 'Phụ · Làng Ashford', 'rowan', 'Bù nhìn biết đi', ...have('herb', 6), 2, [], { exp: 0.3, gold: 30, title: 'Người Làm Vườn' }, 'Bù nhìn ngoài ruộng bị tro nhập, cứ đi lang thang ban đêm. Tôi cần 6 cỏ trà để cúng và an táng nó.', 'Nó yên rồi. Cảm ơn bạn.');
  q('p02', 'Phụ · Làng Ashford', 'mira', 'Quán Lợn Say', ...have('shell', 5), 2, [], { exp: 0.3, gold: 35, potions: 3 }, 'Quán Lợn Say cần vỏ ấm trà nấu rượu mới. Bạn mang giúp 5 cái nhé?', 'Rượu ngon lắm. Nhận bình máu của quán đi.');
  q('p03', 'Phụ · Làng Ashford', 'mira', 'Cây cung của cha', ...kill('gufo', 4), 4, [], { exp: 0.4, gold: 60, item: ['weapon', 'rare'] }, 'Cha em đi săn mà chưa về. Có bốn con Gufo canh đường rừng, anh chị hạ giúp em nhé.', 'Cha em về rồi! Đây là cây cung dư của cha.');
  q('p04', 'Phụ · Đầm Lầy', 'gideon', 'Thương nhân bị nguyền', ...have('venom', 3), 8, [], { exp: 0.5, gold: 150 }, 'Tôi mua phải bình cổ khiến tôi hóa ếch mỗi đêm. Phù thủy đầm lầy cần 3 tuyến độc để giải.', 'Hết ếch rồi! Tôi sẽ giảm giá cho bạn.');
  q('p05', 'Phụ · Đầm Lầy', 'orrin', 'Nấm thối', ...kill('fungo', 8), 8, [], { exp: 0.5, gold: 100, mats: { shroom: 4 } }, 'Lũ nấm nhiễm bệnh phá thảo dược của tôi. Hạ 8 con.', 'Vườn thảo dược của tôi hồi sinh rồi.');
  q('p06', 'Phụ · Mỏ Quặng', 'bram', 'Đúc lại giáp cũ', ...have('ore', 8), 10, [], { exp: 0.6, gold: 120, item: ['armor', 'rare'] }, 'Ta muốn đúc lại bộ giáp cũ của tộc lùn. Cần 8 quặng.', 'Chắc chắn hơn bộ ban đầu. Cầm đi.');
  q('p07', 'Phụ · Bí mật', 'aldwin', 'Mảnh ghép bia đá', { k: 'steles' }, 4, 12, [], { exp: 0.7, gold: 150 }, 'Nghe nói khắp lục địa có 12 bia đá cổ, mỗi bia kể một mảnh quá khứ. Hãy đọc ít nhất 4 tấm.', 'Chuyện người xưa vẫn còn nguyên trong đá.');
  q('p08', 'Phụ · Cánh Đồng Tủ Lạnh', 'gideon', 'Da lông đáng giá', ...have('pelt', 4), 13, [], { exp: 0.6, gold: 200 }, 'Da lông của Pinguino bán rất chạy ở phương Nam. Mang cho tôi 4 tấm.', 'Giao dịch tốt đẹp.');
  q('p09', 'Phụ · Hầm ngục', 'kaelen', 'Truy nã Cinderino', ...kill('cinder', 6), 12, [], { exp: 0.9, gold: 250 }, 'Hội Hiệp Sĩ treo thưởng cho 6 Cinderino trong hầm ngục Tro Đen.', 'Tiền thưởng đây.');

  /* ---- Nhiệm vụ hằng ngày (đặt lại mỗi ngày giờ Việt Nam) ---- */
  q('d01', 'Hằng ngày', 'kaelen', 'Tuần tra: hạ quái', { k: 'kill', type: '*' }, 12, 1, [], { exp: 0.5, gold: 80, potions: 2 }, 'Hội Hiệp Sĩ cần tuần tra. Hạ 12 quái bất kỳ hôm nay.', 'Cảm ơn bạn đã giữ đường an toàn.', { daily: true });
  q('d02', 'Hằng ngày', 'rowan', 'Thu hoạch thảo dược', ...have('herb', 6), 1, [], { exp: 0.3, gold: 50, mats: { shell: 2 } }, 'Mỗi ngày tôi cần một mẻ cỏ trà. Mang 6 cỏ trà cho tôi.', 'Tươi quá!', { daily: true });
  q('d03', 'Hằng ngày', 'kaelen', 'Dọn hầm ngục', { k: 'clears' }, 1, 12, [], { exp: 1, gold: 200, mats: { core: 1 } }, 'Dọn hầm ngục Tro Đen một lần hôm nay.', 'Ba hồi chuông cho người dọn hầm ngục.', { daily: true, clears: 1 });

  const TITLES = [...new Set(list.map((x) => x.reward.title).filter(Boolean).concat(list.flatMap((x) => (x.bonusFlag && x.bonusFlag.title) || [])))];
  const ENDINGS = { 1: 'Thanh tẩy', 2: 'Thắp sao mới', 3: 'Phong ấn Morvain' };
  const byId = {}; list.forEach((x) => { byId[x.id] = x; });
  const api = { NPCS, QUESTS: list, byId, TITLES, ENDINGS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.AF_STORY = api;
})(typeof window !== 'undefined' ? window : globalThis);
