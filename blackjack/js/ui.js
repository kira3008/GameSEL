/* UI layer — Blackjack "Đêm Hoàng Kim".
 * Drives BlackjackEngine exclusively through reset()/step() and its helpers;
 * never re-implements game rules. No imports, no fetch, no external assets. */
(function () {
  "use strict";

  var Engine = BlackjackEngine;
  var AI = BlackjackAI;

  /* ===================== Tiện ích ===================== */
  function $(id) { return document.getElementById(id); }
  function setText(id, t) { $(id).textContent = t; }
  function fmt(n) {
    try { return n.toLocaleString("vi-VN"); } catch (e) { return String(n); }
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  var uid = 0;

  /* ===================== Lưu trữ ngân quỹ ===================== */
  var BANK_KEY = "gamesel.blackjack.bankroll";

  function loadBank() {
    try {
      var v = localStorage.getItem(BANK_KEY);
      if (v !== null) {
        var n = parseFloat(v);
        if (isFinite(n) && n >= 0) return n;
      }
    } catch (e) { /* file:// hoặc chặn cookie — dùng mặc định */ }
    return 1000;
  }

  function saveBank() {
    try { localStorage.setItem(BANK_KEY, String(bankroll)); } catch (e) { /* bỏ qua */ }
  }

  /* ===================== Vẽ bài (SVG nội tuyến) ===================== */
  function suitColor(suit) {
    return (suit === "heart" || suit === "diamond") ? "#9b2c24" : "#262219";
  }

  function suitShape(suit) {
    if (suit === "heart") {
      return '<path d="M0,6.4 C-1.6,4.4 -7,1.5 -7,-2.3 C-7,-5.5 -4.5,-6.7 -2.9,-6.7 C-1.4,-6.7 -0.4,-5.9 0,-4.6 C0.4,-5.9 1.4,-6.7 2.9,-6.7 C4.5,-6.7 7,-5.5 7,-2.3 C7,1.5 1.6,4.4 0,6.4 Z"/>';
    }
    if (suit === "diamond") {
      return '<path d="M0,-7.2 L4.9,0 L0,7.2 L-4.9,0 Z"/>';
    }
    if (suit === "club") {
      return '<circle cx="0" cy="-3.7" r="3.2"/><circle cx="-3.4" cy="1.5" r="3.2"/>' +
        '<circle cx="3.4" cy="1.5" r="3.2"/>' +
        '<path d="M-2.8,7.4 C-1.6,6.3 -0.9,4.4 -0.8,1.6 L0.8,1.6 C0.9,4.4 1.6,6.3 2.8,7.4 Z"/>';
    }
    return '<path d="M0,-7 C1.9,-4.5 6.7,-1.7 6.7,1.3 C6.7,3.9 4.8,5.1 3.1,5.1 C2,5.1 1.1,4.7 0.6,3.9 ' +
      'C0.8,5.5 1.5,6.7 2.7,7.5 L-2.7,7.5 C-1.5,6.7 -0.8,5.5 -0.6,3.9 C-1.1,4.7 -2,5.1 -3.1,5.1 ' +
      'C-4.8,5.1 -6.7,3.9 -6.7,1.3 C-6.7,-1.7 -1.9,-4.5 0,-7 Z"/>';
  }

  function suitMark(suit, x, y, s, flip) {
    return '<g fill="' + suitColor(suit) + '" transform="translate(' + x + ' ' + y + ') scale(' + s + ')' +
      (flip ? ' rotate(180)' : '') + '">' + suitShape(suit) + '</g>';
  }

  /* Bố cục nốt chấm cho 2..10 — [cột 0|.5|1, hàng 0..1, lật] */
  var PIPS = {
    "2": [[.5, 0], [.5, 1, 1]],
    "3": [[.5, 0], [.5, .5], [.5, 1, 1]],
    "4": [[0, 0], [1, 0], [0, 1, 1], [1, 1, 1]],
    "5": [[0, 0], [1, 0], [.5, .5], [0, 1, 1], [1, 1, 1]],
    "6": [[0, 0], [1, 0], [0, .5], [1, .5], [0, 1, 1], [1, 1, 1]],
    "7": [[0, 0], [1, 0], [.5, .25], [0, .5], [1, .5], [0, 1, 1], [1, 1, 1]],
    "8": [[0, 0], [1, 0], [.5, .25], [0, .5], [1, .5], [.5, .75, 1], [0, 1, 1], [1, 1, 1]],
    "9": [[0, 0], [1, 0], [0, .333], [1, .333], [.5, .5], [0, .667, 1], [1, .667, 1], [0, 1, 1], [1, 1, 1]],
    "10": [[0, 0], [1, 0], [.5, .167], [0, .333], [1, .333], [0, .667, 1], [1, .667, 1], [.5, .833, 1], [0, 1, 1], [1, 1, 1]]
  };

  /* Huy hiệu Art-Deco cho J/Q/K */
  function medallion(rank, suit) {
    var col = suitColor(suit);
    var rays = "";
    for (var k = 0; k < 24; k++) {
      var a = (Math.PI * 2 * k) / 24;
      rays += '<line x1="' + (60 + Math.cos(a) * 19).toFixed(1) + '" y1="' + (84 + Math.sin(a) * 19).toFixed(1) +
        '" x2="' + (60 + Math.cos(a) * 37).toFixed(1) + '" y2="' + (84 + Math.sin(a) * 37).toFixed(1) + '"/>';
    }
    return '<path d="M60,26 L93,52 L93,116 L60,142 L27,116 L27,52 Z" fill="#f1e6c6" stroke="#ab8c34" stroke-width="1.6"/>' +
      '<path d="M60,32 L88,54 L88,114 L60,136 L32,114 L32,54 Z" fill="none" stroke="rgba(171,140,52,0.7)" stroke-width="0.9"/>' +
      '<g stroke="#b08f2e" stroke-width="0.8" opacity="0.85">' + rays + '</g>' +
      '<path d="M60,23 L63.5,27.5 L60,32 L56.5,27.5 Z" fill="#ab8c34"/>' +
      '<path d="M60,136 L63.5,140.5 L60,145 L56.5,140.5 Z" fill="#ab8c34"/>' +
      '<circle cx="60" cy="84" r="20.5" fill="#f1e6c6" stroke="#ab8c34" stroke-width="1"/>' +
      '<text x="60" y="84" dy="0.36em" text-anchor="middle" font-family="Cinzel, Georgia, serif" ' +
      'font-size="29" font-weight="700" fill="' + col + '">' + rank + '</text>' +
      suitMark(suit, 60, 44, 0.85) +
      suitMark(suit, 60, 124, 0.85, true);
  }

  function cardFrontSVG(rank, suit) {
    var col = suitColor(suit);
    var s = '<svg viewBox="0 0 120 168" class="card-svg" aria-hidden="true">';
    s += '<rect x="1" y="1" width="118" height="166" rx="10" fill="#f7efda" stroke="#cdbd8e" stroke-width="1.4"/>';
    s += '<rect x="5.5" y="5.5" width="109" height="157" rx="7" fill="none" stroke="rgba(171,140,52,0.38)" stroke-width="1"/>';
    var fs = rank === "10" ? 16 : 20;
    var corner = '<text x="16" y="26" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="' + fs +
      '" font-weight="700" fill="' + col + '">' + rank + '</text>' + suitMark(suit, 16, 38.5, 0.78);
    s += '<g>' + corner + '</g>';
    s += '<g transform="rotate(180 60 84)">' + corner + '</g>';
    if (rank === "A") {
      s += '<path d="M60,38 L94,84 L60,130 L26,84 Z" fill="none" stroke="rgba(171,140,52,0.45)" stroke-width="1"/>';
      s += '<path d="M60,46 L87,84 L60,122 L33,84 Z" fill="none" stroke="rgba(171,140,52,0.3)" stroke-width="0.7"/>';
      s += suitMark(suit, 60, 84, 3.05);
    } else if (rank === "J" || rank === "Q" || rank === "K") {
      s += medallion(rank, suit);
    } else {
      var lay = PIPS[rank];
      for (var i = 0; i < lay.length; i++) {
        s += suitMark(suit, 36 + lay[i][0] * 48, 38 + lay[i][1] * 92, 1.32, lay[i][2]);
      }
    }
    return s + '</svg>';
  }

  function cardBackSVG() {
    var id = "cgb" + (++uid);
    var scales = "";
    for (var row = 0; row < 14; row++) {
      var y = 8 + row * 13;
      var off = row % 2 ? 13 : 0;
      for (var x = -6 + off; x <= 126; x += 26) {
        scales += '<path d="M' + (x - 13) + ',' + y + ' A13,13 0 0 0 ' + (x + 13) + ',' + y + ' Z"/>';
      }
    }
    return '<svg viewBox="0 0 120 168" class="card-svg" aria-hidden="true">' +
      '<defs><clipPath id="' + id + '"><rect x="7" y="7" width="106" height="154" rx="6"/></clipPath></defs>' +
      '<rect x="1" y="1" width="118" height="166" rx="10" fill="#3f1812" stroke="#caa948" stroke-width="1.4"/>' +
      '<rect x="5" y="5" width="110" height="158" rx="7" fill="none" stroke="rgba(212,175,55,0.55)" stroke-width="1"/>' +
      '<g clip-path="url(#' + id + ')">' +
      '<rect x="7" y="7" width="106" height="154" fill="#4a1d15"/>' +
      '<g fill="#54231a" stroke="rgba(212,175,55,0.3)" stroke-width="0.8">' + scales + '</g>' +
      '<circle cx="60" cy="84" r="27" fill="#3f1812" stroke="#caa948" stroke-width="1.2"/>' +
      '<circle cx="60" cy="84" r="22.5" fill="none" stroke="rgba(212,175,55,0.5)" stroke-width="0.7" stroke-dasharray="2.5 3"/>' +
      '<path d="M60,68 L73,84 L60,100 L47,84 Z" fill="none" stroke="#d4af37" stroke-width="1.1"/>' +
      '<path d="M60,75 L67.5,84 L60,93 L52.5,84 Z" fill="#d4af37"/>' +
      '</g></svg>';
  }

  /* ===================== Phỉnh (chip) ===================== */
  var CHIP_STYLE = {
    5: { base: "#8f2a22", dark: "#5e1a14", edge: "#f1e6cb", text: "#f1e6cb", disc: "#a23329" },
    25: { base: "#1c5f44", dark: "#0f3a29", edge: "#f1e6cb", text: "#f1e6cb", disc: "#247052" },
    100: { base: "#23211b", dark: "#0f0e0c", edge: "#d4af37", text: "#e9c95d", disc: "#2c2920" },
    500: { base: "#43265c", dark: "#291538", edge: "#d4af37", text: "#e9c95d", disc: "#50306d" }
  };

  function chipSVG(v) {
    var c = CHIP_STYLE[v];
    var dash = (2 * Math.PI * 42.5 / 16).toFixed(2);
    return '<svg viewBox="0 0 100 100" class="chip-svg" aria-hidden="true">' +
      '<circle cx="50" cy="50" r="48" fill="' + c.base + '" stroke="' + c.dark + '" stroke-width="1.5"/>' +
      '<circle cx="50" cy="50" r="42.5" fill="none" stroke="' + c.edge + '" stroke-width="9" stroke-dasharray="' + dash + ' ' + dash + '"/>' +
      '<circle cx="50" cy="50" r="33" fill="' + c.disc + '" stroke="' + c.dark + '" stroke-width="1"/>' +
      '<circle cx="50" cy="50" r="29.5" fill="none" stroke="' + c.edge + '" stroke-width="0.9" stroke-dasharray="3 4.5" opacity="0.8"/>' +
      '<text x="50" y="50" dy="0.36em" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-weight="700" font-size="' +
      (v >= 100 ? 24 : 29) + '" fill="' + c.text + '">' + v + '</text></svg>';
  }

  /* ===================== Trạng thái ===================== */
  var bankroll = loadBank();
  var bet = 0;
  var phase = "betting"; /* betting | playing | settling */
  var busy = false;      /* khoá thao tác trong lúc tự động xử lý */
  var env = null;
  var lastObs = null;
  var dispPlayer = [];
  var dispDealer = [];
  var holeEl = null;

  var TRAIN_TOTAL = 100000;
  var TRAIN_CHUNK = 2000;
  var agent = null;
  var training = false;

  var aiMode = false;
  var aiTimer = null;

  var RANKS_TEN = ["10", "J", "Q", "K"];
  var SUIT_NAMES = ["spade", "heart", "diamond", "club"];

  /* Giá trị engine -> lá bài hiển thị (chỉ để trang trí, không ảnh hưởng luật) */
  function makeDisplayCard(v) {
    var rank = v === 1 ? "A" : (v === 10 ? pick(RANKS_TEN) : String(v));
    return { rank: rank, suit: pick(SUIT_NAMES) };
  }

  /* ===================== Cập nhật giao diện ===================== */
  function updateBank() {
    setText("bankroll", fmt(bankroll));
    $("resetBank").classList.toggle("hidden", !(bankroll < 5 && phase === "betting"));
  }

  function updateBet() {
    setText("betAmount", bet > 0 ? fmt(bet) + " chip" : "—");
  }

  function updateControls() {
    var betting = phase === "betting" && !aiMode;
    $("dealBtn").disabled = !(betting && bet >= 5 && bet <= bankroll);
    var canAct = phase === "playing" && !aiMode && !busy;
    $("hitBtn").disabled = !canAct;
    $("standBtn").disabled = !canAct;
    $("clearBet").disabled = !(betting && bet > 0);
    var btns = document.querySelectorAll("[data-chip]");
    for (var i = 0; i < btns.length; i++) {
      var v = +btns[i].getAttribute("data-chip");
      btns[i].disabled = !(betting && bet + v <= bankroll);
    }
  }

  function updatePlayerStatus() {
    if (!env) {
      setText("playerScore", phase === "betting" ? "Đặt cược và bấm Chia bài" : "");
      return;
    }
    var s = Engine.sumHand(env.player);
    setText("playerScore", "Điểm: " + s +
      (Engine.usableAce(env.player) ? " (mềm)" : "") +
      (s > 21 ? " — quá 21!" : ""));
  }

  function updateDealerStatus(revealed) {
    if (!env) { setText("dealerScore", ""); return; }
    if (!revealed) {
      setText("dealerScore", "Lộ bài: " + (env.dealer[0] === 1 ? "A" : env.dealer[0]));
    } else {
      var s = Engine.sumHand(env.dealer);
      setText("dealerScore", "Điểm: " + s + (s > 21 ? " — quá 21!" : ""));
    }
  }

  function trained() { return agent !== null && agent.trainedEpisodes >= TRAIN_TOTAL; }

  function updateAdvice() {
    var el = $("advice");
    if (!trained()) {
      el.innerHTML = '<span class="advice-dim">Chưa huấn luyện — bàn cố vấn đang trống.</span>';
      return;
    }
    if (phase === "playing" && lastObs && env && !env.done) {
      var a = agent.act(lastObs, true);
      el.innerHTML = 'AI khuyên: <strong class="' + (a === 1 ? "hit" : "stand") + '">' +
        (a === 1 ? "Rút" : "Dừng") + '</strong>';
    } else {
      el.innerHTML = '<span class="advice-dim">Vào ván để nhận lời khuyên.</span>';
    }
  }

  function refreshAll() {
    updateBank(); updateBet(); updateControls(); updateAdvice();
  }

  /* ===================== Bài trên bàn ===================== */
  function addCard(handId, disp, faceDown, delayMs) {
    var el = document.createElement("div");
    el.className = "card" + (faceDown ? " face-down" : "");
    el.style.animationDelay = (delayMs || 0) + "ms";
    el.innerHTML = '<div class="card-inner">' +
      '<div class="card-face card-front">' + cardFrontSVG(disp.rank, disp.suit) + '</div>' +
      '<div class="card-face card-back">' + cardBackSVG() + '</div></div>';
    $(handId).appendChild(el);
    return el;
  }

  function addChipVisual(v) {
    var holder = $("betChips");
    var n = holder.children.length;
    var el = document.createElement("div");
    el.className = "bet-chip";
    el.style.transform = "translate(-50%, -50%) translate(" + ((n % 5) * 2 - 4) + "px, " +
      (-n * 6) + "px) rotate(" + (((n * 47) % 22) - 11) + "deg)";
    el.innerHTML = '<span class="chip-anim">' + chipSVG(v) + '</span>';
    holder.appendChild(el);
  }

  /* ===================== Đặt cược ===================== */
  function addChip(v) {
    if (phase !== "betting" || aiMode) return;
    if (bet + v > bankroll) return;
    bet += v;
    addChipVisual(v);
    updateBet(); updateControls();
  }

  function clearBet() {
    if (phase !== "betting") return;
    bet = 0;
    $("betChips").innerHTML = "";
    updateBet(); updateControls();
  }

  /* ===================== Diễn tiến ván bài ===================== */
  function deal() {
    if (phase !== "betting" || bet < 5 || bet > bankroll) return;
    bankroll -= bet;
    saveBank();

    env = new Engine.BlackjackEnv();
    lastObs = env.reset();
    dispPlayer = [makeDisplayCard(env.player[0]), makeDisplayCard(env.player[1])];
    dispDealer = [makeDisplayCard(env.dealer[0]), makeDisplayCard(env.dealer[1])];

    $("playerHand").innerHTML = "";
    $("dealerHand").innerHTML = "";
    $("banner").className = "banner";

    addCard("playerHand", dispPlayer[0], false, 0);
    addCard("dealerHand", dispDealer[0], false, 160);
    addCard("playerHand", dispPlayer[1], false, 320);
    holeEl = addCard("dealerHand", dispDealer[1], true, 480);

    phase = "playing";
    busy = false;
    updatePlayerStatus();
    updateDealerStatus(false);
    refreshAll();

    /* Xì dách 21 ngay từ đầu — tự động dừng để tính bài */
    if (lastObs[0] === 21) {
      busy = true;
      updateControls();
      setTimeout(function () { doStand(); }, 1050);
    }
  }

  function doHit() {
    var res = env.step(1);
    lastObs = res.obs;
    var d = makeDisplayCard(env.player[env.player.length - 1]);
    dispPlayer.push(d);
    addCard("playerHand", d, false, 0);
    updatePlayerStatus();
    if (res.done) {
      phase = "settling";
      busy = true;
      updateControls(); updateAdvice();
      finishRound(res.reward, 600);
    } else {
      updateAdvice();
    }
  }

  function doStand() {
    var res = env.step(0);
    lastObs = res.obs;
    phase = "settling";
    busy = true;
    updateControls(); updateAdvice();
    finishRound(res.reward, 300);
  }

  /* Lật bài tẩy, rút thêm bài cho nhà cái (nếu có), rồi tính sổ */
  function finishRound(reward, lead) {
    setTimeout(function () {
      if (holeEl) holeEl.classList.remove("face-down");
      var extra = env.dealer.length - dispDealer.length;
      for (var i = 0; i < extra; i++) {
        setTimeout(function () {
          var d = makeDisplayCard(env.dealer[dispDealer.length]);
          dispDealer.push(d);
          addCard("dealerHand", d, false, 0);
          updateDealerStatus(true);
        }, 680 + i * 430);
      }
      setTimeout(function () {
        updateDealerStatus(true);
        settle(reward);
      }, 700 + extra * 430);
    }, lead || 250);
  }

  function settle(reward) {
    var payout = reward >= 1.5 ? bet * 2.5 : reward === 1 ? bet * 2 : reward === 0 ? bet : 0;
    var net = payout - bet;
    bankroll += payout;
    saveBank();
    updateBank();

    var word, cls;
    if (reward >= 1.5) { word = "Xì dách!"; cls = "natural"; }
    else if (reward === 1) { word = "Thắng"; cls = "win"; }
    else if (reward === 0) { word = "Hòa"; cls = "push"; }
    else { word = "Thua"; cls = "lose"; }

    setText("bannerWord", word);
    setText("bannerDelta", reward === 0
      ? "Hoàn cược " + fmt(bet) + " chip"
      : (net > 0 ? "+" : "−") + fmt(Math.abs(net)) + " chip");
    $("banner").className = "banner show " + cls;

    setTimeout(newRoundReset, 2350);
  }

  function newRoundReset() {
    $("banner").className = "banner";
    $("playerHand").innerHTML = "";
    $("dealerHand").innerHTML = "";
    $("betChips").innerHTML = "";
    bet = 0;
    env = null;
    lastObs = null;
    holeEl = null;
    dispPlayer = [];
    dispDealer = [];
    phase = "betting";
    busy = false;
    setText("dealerScore", "");
    updatePlayerStatus();
    refreshAll();
    if (aiMode) aiLater(aiStartRound, 650);
  }

  /* ===================== Huấn luyện AI (chia nhỏ, không khoá trang) ===================== */
  function startTraining() {
    if (training || trained()) return;
    training = true;
    document.body.classList.add("training");
    agent = new AI.QAgent();
    var headless = new Engine.BlackjackEnv(); /* env riêng, không đụng bàn chơi */
    var btn = $("trainBtn");
    btn.disabled = true;
    btn.textContent = "Đang huấn luyện…";

    function tick() {
      var n = Math.min(TRAIN_CHUNK, TRAIN_TOTAL - agent.trainedEpisodes);
      /* giữ epsilon giảm dần tuyến tính trên toàn bộ 100.000 ván */
      agent.epsilon = Math.max(agent.epsilonMin, 1 - agent.trainedEpisodes / TRAIN_TOTAL);
      agent.train(headless, n);
      var done = agent.trainedEpisodes;
      $("trainFill").style.width = ((done / TRAIN_TOTAL) * 100).toFixed(1) + "%";
      setText("trainText", fmt(done) + " / " + fmt(TRAIN_TOTAL) + " ván");
      if (done < TRAIN_TOTAL) {
        setTimeout(tick, 16);
      } else {
        training = false;
        document.body.classList.remove("training");
        btn.textContent = "Đã huấn luyện ✦";
        $("aiToggle").disabled = false;
        $("aiToggleRow").classList.remove("disabled");
        setText("aiNote", "");
        updateAdvice();
      }
    }
    setTimeout(tick, 30);
  }

  /* ===================== AI tự chơi ===================== */
  function aiLater(fn, ms) {
    clearTimeout(aiTimer);
    aiTimer = setTimeout(fn, ms);
  }

  function showBadge(action) {
    var b = $("aiBadge");
    b.textContent = "AI: " + (action === 1 ? "Rút" : "Dừng");
    b.classList.add("show");
  }

  function hideBadge() { $("aiBadge").classList.remove("show"); }

  function setAiMode(on) {
    aiMode = !!on && trained();
    $("aiToggle").checked = aiMode;
    document.body.classList.toggle("ai-running", aiMode);
    if (!aiMode) {
      clearTimeout(aiTimer);
      hideBadge();
    } else {
      setText("aiNote", "");
      if (phase === "betting") aiLater(aiStartRound, 350);
      else if (phase === "playing" && !busy) aiLater(aiStep, 700);
    }
    updateControls();
  }

  function aiStartRound() {
    if (!aiMode || phase !== "betting") return;
    if (bankroll < 25) {
      setAiMode(false);
      setText("aiNote", "Ngân quỹ dưới 25 chip — AI ngừng chơi.");
      return;
    }
    bet = 0;
    $("betChips").innerHTML = "";
    bet = 25;
    addChipVisual(25);
    updateBet();
    deal();
    aiLater(aiStep, 1500);
  }

  function aiStep() {
    if (!aiMode || phase !== "playing" || busy) return;
    var a = agent.act(lastObs, true);
    showBadge(a);
    aiLater(function () {
      hideBadge();
      if (!aiMode || phase !== "playing" || busy) return;
      if (a === 1) {
        doHit();
        if (phase === "playing") aiLater(aiStep, 950);
      } else {
        doStand();
      }
    }, 950);
  }

  /* ===================== Gắn sự kiện ===================== */
  var chipBtns = document.querySelectorAll("[data-chip]");
  for (var ci = 0; ci < chipBtns.length; ci++) {
    (function (btn) {
      var v = +btn.getAttribute("data-chip");
      btn.innerHTML = chipSVG(v);
      btn.addEventListener("click", function () { addChip(v); });
    })(chipBtns[ci]);
  }

  $("clearBet").addEventListener("click", clearBet);
  $("dealBtn").addEventListener("click", deal);
  $("hitBtn").addEventListener("click", function () {
    if (phase === "playing" && !busy && !aiMode) doHit();
  });
  $("standBtn").addEventListener("click", function () {
    if (phase === "playing" && !busy && !aiMode) doStand();
  });
  $("resetBank").addEventListener("click", function () {
    bankroll = 1000;
    saveBank();
    refreshAll();
  });
  $("trainBtn").addEventListener("click", startTraining);
  $("aiToggle").addEventListener("change", function () { setAiMode(this.checked); });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      if (!$("dealBtn").disabled) { e.preventDefault(); deal(); }
    } else if (e.key === "h" || e.key === "H") {
      if (!$("hitBtn").disabled) doHit();
    } else if (e.key === "s" || e.key === "S") {
      if (!$("standBtn").disabled) doStand();
    }
  });

  /* ===================== Khởi động ===================== */
  updatePlayerStatus();
  refreshAll();

  /* Chế độ xem thử: ?demo=1 — đặt 100 chip và chia bài ngay.
   * ?demo=2 — như trên rồi tự Dừng (để xem cảnh lật bài và biển kết quả). */
  var demoMatch = location.search.match(/[?&]demo=([12])/);
  if (demoMatch) {
    if (demoMatch[1] === "2") document.body.classList.add("demo-still");
    addChip(bankroll >= 100 ? 100 : bankroll >= 25 ? 25 : 5);
    deal();
    if (demoMatch[1] === "2") {
      setTimeout(function () {
        if (phase === "playing" && !busy) doStand();
      }, 600);
    }
  }
})();
