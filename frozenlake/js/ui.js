/* UI cho Hồ Băng 6x6 — Đêm Bắc Cực.
 * Chỉ điều khiển trò chơi qua API công khai của FrozenLakeEngine / FrozenLakeAI.
 * Không tự huấn luyện khi tải trang; huấn luyện chạy theo từng "chunk" qua setTimeout. */
(function () {
  "use strict";

  var E = FrozenLakeEngine;
  var NCOL = E.MAP_6X6[0].length;
  var ACTION_NAMES = ["trái", "xuống", "phải", "lên"];
  var ARROW_ROT = [180, 90, 0, 270]; // mũi tên gốc chỉ sang phải (hành động 2)

  // ---------- DOM ----------
  function $(id) { return document.getElementById(id); }
  var boardEl = $("board"), elfWrap = $("elfWrap"),
      fxLayer = $("fxLayer"), slipBadge = $("slipBadge"),
      banner = $("banner"), bannerTitle = $("bannerTitle"),
      bannerSub = $("bannerSub"), bannerReplay = $("bannerReplay"),
      stepCount = $("stepCount"), winCount = $("winCount"), lossCount = $("lossCount"),
      statusLine = $("statusLine"),
      resetBtn = $("resetBtn"), slipToggle = $("slipToggle"),
      trainBtn = $("trainBtn"), progressFill = $("progressFill"),
      epLabel = $("epLabel"), srLabel = $("srLabel"),
      qToggle = $("qToggle"), aiPlayBtn = $("aiPlayBtn"), aiNote = $("aiNote");

  // ---------- Trạng thái ----------
  var slippery = false;                       // mặc định: TẮT
  var env = new E.FrozenLakeEnv({ slippery: slippery });
  var state = env.reset();
  var steps = 0, wins = 0, losses = 0;
  var busy = false;          // đang chạy hoạt ảnh di chuyển
  var episodeOver = false;
  var agent = null;
  var agentSlippery = null;  // cài đặt mặt băng lúc agent được huấn luyện
  var training = false;
  var aiPlaying = false;
  var aiTimer = null;
  var overlayOn = false;
  var tiles = [];

  // ---------- Hình SVG nội tuyến ----------
  var HOLE_SVG =
    '<svg class="hole-svg" viewBox="0 0 100 100" aria-hidden="true">' +
    '<defs><linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#35588f"/><stop offset="0.5" stop-color="#16294e"/>' +
    '<stop offset="1" stop-color="#081226"/></linearGradient></defs>' +
    '<polygon points="50,10 64,16 77,13 83,29 91,45 84,59 88,75 71,77 60,89 46,82 32,90 25,72 10,66 16,50 8,34 22,28 20,12 36,18" fill="#e8f7fe"/>' +
    '<polygon points="50,17.2 61.5,22.1 72.1,19.7 77.1,32.8 83.6,45.9 77.9,57.4 81.2,70.5 67.2,72.1 58.2,82 46.7,76.2 35.2,82.8 29.5,68 17.2,63.1 22.1,50 15.6,36.9 27,32 25.4,18.8 38.5,23.8" fill="url(#wg)"/>' +
    '<path d="M34 31 q13 -7 26 -2" stroke="#7fb8ee" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.8"/>' +
    '<path d="M30 41 q8 -4 15 -2" stroke="#5d93cf" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.6"/>' +
    '<path d="M44 67 q9 4 17 0" stroke="#2c4d80" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.8"/>' +
    '<circle cx="41" cy="58" r="2.3" fill="#9fd0f5" opacity="0.6"/>' +
    '<circle cx="62" cy="50" r="1.6" fill="#9fd0f5" opacity="0.55"/>' +
    '<g stroke="#f2fbff" stroke-width="1.7" opacity="0.85" stroke-linecap="round" fill="none">' +
    '<path d="M77 13 L88 6"/><path d="M91 45 L99 43"/><path d="M10 66 L2 71"/>' +
    '<path d="M32 90 L28 97"/><path d="M20 12 L13 5"/><path d="M88 75 L96 80"/>' +
    '</g></svg>';

  var GIFT_SVG =
    '<svg class="gift-svg" viewBox="0 0 64 64" aria-hidden="true">' +
    '<rect x="13" y="29" width="38" height="27" rx="4" fill="#e84d5b"/>' +
    '<rect x="13" y="29" width="38" height="6" rx="3" fill="#c93b4d"/>' +
    '<rect x="9" y="20" width="46" height="11" rx="4" fill="#f25e6e"/>' +
    '<rect x="28" y="20" width="8" height="36" fill="#ffd166"/>' +
    '<rect x="28" y="20" width="8" height="11" fill="#ffdf8a"/>' +
    '<path d="M32 20 C24 7 11 11 15 18 C17 21 26 21 32 20 Z" fill="#ffd166"/>' +
    '<path d="M32 20 C40 7 53 11 49 18 C47 21 38 21 32 20 Z" fill="#ffd166"/>' +
    '<circle cx="32" cy="19" r="4" fill="#ffdf8a"/></svg>';

  var START_ETCH_SVG =
    '<svg class="start-etch" viewBox="0 0 40 40" aria-hidden="true">' +
    '<g stroke="#3f8fb8" stroke-width="2" stroke-linecap="round" fill="none">' +
    '<path d="M20 6 V34 M6 20 H34 M10 10 L30 30 M30 10 L10 30"/>' +
    '<path d="M20 6 L16 10 M20 6 L24 10 M20 34 L16 30 M20 34 L24 30"/>' +
    '</g><circle cx="20" cy="20" r="3.4" fill="#3f8fb8"/></svg>';

  var Q_ARROW_SVG =
    '<svg class="q-arrow" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path d="M4.5 12 H16 M11 5.5 L17.8 12 L11 18.5" fill="none" stroke="currentColor" ' +
    'stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---------- Dựng bàn chơi từ MAP_6X6 ----------
  (function buildBoard() {
    for (var r = 0; r < E.MAP_6X6.length; r++) {
      for (var c = 0; c < NCOL; c++) {
        var ch = E.MAP_6X6[r][c];
        var t = document.createElement("div");
        t.className = "tile tile-" + ch;
        if (ch === "H") t.innerHTML = HOLE_SVG;
        else if (ch === "G") t.innerHTML = '<div class="gift-glow"></div>' + GIFT_SVG;
        else if (ch === "S") t.innerHTML = START_ETCH_SVG;
        if (ch === "F" || ch === "S") {
          var q = document.createElement("div");
          q.className = "q-cell";
          q.innerHTML = Q_ARROW_SVG;
          t.appendChild(q);
        }
        boardEl.appendChild(t);
        tiles.push(t);
      }
    }
  })();

  // ---------- Tinh linh ----------
  function placeElf(instant) {
    var row = Math.floor(state / NCOL), col = state % NCOL;
    if (instant) elfWrap.classList.add("no-anim");
    elfWrap.style.transform = "translate(" + (col * 100) + "%, " + (row * 100) + "%)";
    if (instant) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { elfWrap.classList.remove("no-anim"); });
      });
    }
  }

  function reflowAnim(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // ép reflow để chạy lại animation
    el.classList.add(cls);
  }

  function showSlip() { reflowAnim(slipBadge, "show"); }

  function spawnRipples(tile) {
    for (var i = 0; i < 2; i++) {
      (function (idx) {
        setTimeout(function () {
          var rp = document.createElement("div");
          rp.className = "ripple";
          tile.appendChild(rp);
          setTimeout(function () { rp.remove(); }, 1000);
        }, idx * 280);
      })(i);
    }
  }

  function spawnSparks() {
    var row = Math.floor(state / NCOL), col = state % NCOL;
    var cx = ((col + 0.5) / NCOL) * 100, cy = ((row + 0.5) / NCOL) * 100;
    var colors = ["#ffd166", "#57f2b0", "#5fd9f7", "#ffffff", "#ff9aa5"];
    for (var i = 0; i < 14; i++) {
      var sp = document.createElement("div");
      sp.className = "spark";
      sp.style.left = cx + "%";
      sp.style.top = cy + "%";
      sp.style.background = colors[i % colors.length];
      var ang = (Math.PI * 2 * i) / 14 + Math.random() * 0.5;
      var dist = 48 + Math.random() * 70;
      sp.style.setProperty("--dx", Math.round(Math.cos(ang) * dist) + "px");
      sp.style.setProperty("--dy", Math.round(Math.sin(ang) * dist - 22) + "px");
      sp.style.animationDelay = (Math.random() * 0.22).toFixed(2) + "s";
      fxLayer.appendChild(sp);
    }
    setTimeout(function () { fxLayer.innerHTML = ""; }, 1600);
  }

  // ---------- HUD / trạng thái ----------
  function fmt(n) { return n.toLocaleString("vi-VN"); }

  function updateHud() {
    stepCount.textContent = steps;
    winCount.textContent = wins;
    lossCount.textContent = losses;
  }

  function setStatus(text, cls) {
    statusLine.textContent = text;
    statusLine.className = "status" + (cls ? " " + cls : "");
  }

  function showBanner(won) {
    banner.classList.remove("hidden", "win", "loss");
    banner.classList.add(won ? "win" : "loss");
    bannerTitle.textContent = won ? "Tuyệt vời!" : "Ôi không!";
    bannerSub.textContent = won
      ? "Tinh linh đã mở được hộp quà sau " + steps + " bước!"
      : "Tinh linh rơi xuống hố băng lạnh buốt ở bước " + steps + "...";
  }

  // ---------- Vòng đời ván chơi ----------
  function resetEpisode() {
    stopAI();
    banner.classList.add("hidden");
    elfWrap.classList.remove("falling", "winner", "bump");
    fxLayer.innerHTML = "";
    var goalTile = tiles[E.MAP_6X6.join("").indexOf("G")];
    if (goalTile) goalTile.classList.remove("bounce");
    state = env.reset();
    steps = 0;
    busy = false;
    episodeOver = false;
    placeElf(true);
    updateHud();
    setStatus(slippery
      ? "Mặt băng trơn: mỗi bước có thể trượt sang hai hướng vuông góc!"
      : "Dùng phím mũi tên, WASD hoặc nút bấm để di chuyển tinh linh.");
  }

  function doStep(action, fromAI) {
    if (busy || episodeOver) return;
    if (aiPlaying && !fromAI) return;
    var res;
    try { res = env.step(action); } catch (e) { return; }
    busy = true;
    var prev = state;
    state = res.state;
    steps++;
    var slipped = slippery && res.actualAction !== action;
    if (slipped) {
      showSlip();
      setStatus("Trượt! Định đi " + ACTION_NAMES[action] + " nhưng băng đẩy sang "
        + ACTION_NAMES[res.actualAction] + ".", "warn");
    } else if (!res.done) {
      setStatus((fromAI ? "AI đi " : "Đi ") + ACTION_NAMES[res.actualAction] + ".");
    }
    if (state !== prev) placeElf(); else reflowAnim(elfWrap, "bump");
    updateHud();

    if (res.done) {
      episodeOver = true;
      setTimeout(function () {
        if (res.reward === 1) {
          wins++;
          updateHud();
          elfWrap.classList.add("winner");
          tiles[state].classList.add("bounce");
          spawnSparks();
          setStatus("Chiến thắng! Hộp quà đã được mở.", "good");
          setTimeout(function () { showBanner(true); busy = false; }, 950);
        } else {
          losses++;
          updateHud();
          elfWrap.classList.add("falling");
          spawnRipples(tiles[state]);
          setStatus("Tõm! Tinh linh rơi xuống hố nước.", "bad");
          setTimeout(function () { showBanner(false); busy = false; }, 950);
        }
      }, state !== prev ? 300 : 120);
    } else {
      setTimeout(function () { busy = false; }, state !== prev ? 300 : 150);
    }
  }

  // ---------- Mặt băng trơn ----------
  slipToggle.addEventListener("change", function () {
    slippery = slipToggle.checked;
    env = new E.FrozenLakeEnv({ slippery: slippery });
    resetEpisode(); // đổi cài đặt giữa ván -> chơi lại từ đầu
    updateAIControls();
  });

  // ---------- Góc AI ----------
  function agentReady() {
    return !!agent && agent.trainedEpisodes > 0 && agentSlippery === slippery && !training;
  }

  function updateAIControls() {
    trainBtn.disabled = training || aiPlaying;
    trainBtn.textContent = training ? "Đang huấn luyện..." : "Huấn luyện AI";
    slipToggle.disabled = training;
    qToggle.disabled = !agentReady();
    aiPlayBtn.disabled = !(agentReady() || aiPlaying);
    if (!agentReady() && overlayOn) {
      overlayOn = false;
      qToggle.checked = false;
      boardEl.classList.remove("show-q");
    }
    if (training) {
      setNote("AI đang luyện tập trên một hồ băng vô hình...", "dim");
    } else if (agent && agent.trainedEpisodes > 0 && agentSlippery !== slippery) {
      setNote("Mặt băng đã thay đổi — bấm Huấn luyện AI để dạy lại từ đầu!");
    } else if (agentReady()) {
      setNote("AI sẵn sàng! Bật Bản đồ Q hoặc cho AI tự chơi.", "ok");
    } else {
      setNote("AI chưa được huấn luyện.", "dim");
    }
  }

  function setNote(text, cls) {
    aiNote.textContent = text;
    aiNote.className = "note" + (cls ? " " + cls : "");
  }

  function updateTrainLabels(done, target) {
    progressFill.style.width = Math.min(100, (done / target) * 100).toFixed(1) + "%";
    epLabel.textContent = fmt(done) + " / " + fmt(target) + " tập";
    srLabel.textContent = "Thắng gần đây: " + Math.round(agent.successRate() * 100) + "%";
  }

  trainBtn.addEventListener("click", function () {
    if (training || aiPlaying) return;
    var target = slippery ? 30000 : 5000;
    // đổi cài đặt mặt băng -> huấn luyện lại từ agent MỚI tinh
    if (!agent || agentSlippery !== slippery) {
      agent = new FrozenLakeAI.QAgent({ nStates: env.nStates });
      agentSlippery = slippery;
    }
    var headless = new E.FrozenLakeEnv({ slippery: slippery }); // env riêng, không đụng bàn chơi
    var startEp = agent.trainedEpisodes;
    var goal = startEp + target;
    var CHUNK = slippery ? 500 : 250;
    training = true;
    updateTrainLabels(0, target);
    updateAIControls();

    (function tick() {
      var n = Math.min(CHUNK, goal - agent.trainedEpisodes);
      agent.train(headless, n);
      updateTrainLabels(agent.trainedEpisodes - startEp, target);
      if (overlayOn) paintOverlay();
      if (agent.trainedEpisodes < goal) {
        setTimeout(tick, 0); // nhường lượt cho trình duyệt vẽ tiến trình
      } else {
        training = false;
        epLabel.textContent = "Đã luyện " + fmt(agent.trainedEpisodes) + " tập";
        updateAIControls();
        if (overlayOn) paintOverlay();
      }
    })();
  });

  // ---------- Bản đồ Q ----------
  function paintOverlay() {
    var maxV = 0, s, ch;
    for (s = 0; s < env.nStates; s++) {
      ch = env.tile(s);
      if (ch === "F" || ch === "S") maxV = Math.max(maxV, agent.stateValue(s));
    }
    for (s = 0; s < tiles.length; s++) {
      var q = tiles[s].querySelector(".q-cell");
      if (!q) continue;
      var k = maxV > 0 ? agent.stateValue(s) / maxV : 0;
      var hue = Math.round(265 - 115 * k); // tím (lạnh) -> xanh cực quang (nóng)
      q.style.background = "hsla(" + hue + ", 85%, 60%, " + (0.14 + 0.4 * k).toFixed(3) + ")";
      q.style.boxShadow = "inset 0 0 " + Math.round(6 + 14 * k) + "px hsla(" + hue + ", 90%, 72%, "
        + (0.3 + 0.45 * k).toFixed(3) + ")";
      var arrow = q.firstElementChild;
      arrow.style.transform = "rotate(" + ARROW_ROT[agent.bestAction(s)] + "deg)";
      arrow.style.opacity = (0.4 + 0.6 * k).toFixed(2);
    }
  }

  qToggle.addEventListener("change", function () {
    overlayOn = qToggle.checked;
    if (overlayOn) {
      paintOverlay();
      boardEl.classList.add("show-q");
    } else {
      boardEl.classList.remove("show-q");
    }
  });

  // ---------- AI tự chơi ----------
  function stopAI() {
    if (!aiPlaying) return;
    aiPlaying = false;
    if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
    aiPlayBtn.textContent = "AI chơi";
    updateAIControls();
  }

  aiPlayBtn.addEventListener("click", function () {
    if (aiPlaying) { stopAI(); setStatus("Đã dừng AI."); return; }
    if (!agentReady()) return;
    resetEpisode();
    aiPlaying = true;
    aiPlayBtn.textContent = "Dừng AI";
    updateAIControls();
    setStatus("AI đang dẫn tinh linh qua hồ băng...", "good");
    var aiSteps = 0;
    (function loop() {
      if (!aiPlaying) return;
      if (episodeOver) { stopAI(); return; }
      if (aiSteps >= 100) {
        stopAI();
        setStatus("AI dừng lại sau 100 bước mà chưa tới nơi.", "warn");
        return;
      }
      doStep(agent.act(state, true), true); // tham lam từng bước trên bàn chơi thật
      aiSteps++;
      aiTimer = setTimeout(loop, 320);
    })();
  });

  // ---------- Điều khiển của người chơi ----------
  var dpadBtns = document.querySelectorAll(".dpad-btn");
  for (var i = 0; i < dpadBtns.length; i++) {
    dpadBtns[i].addEventListener("click", function () {
      doStep(parseInt(this.getAttribute("data-action"), 10), false);
    });
  }

  var KEYMAP = {
    ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2, ArrowUp: 3,
    a: 0, s: 1, d: 2, w: 3, A: 0, S: 1, D: 2, W: 3
  };
  document.addEventListener("keydown", function (e) {
    var a = KEYMAP[e.key];
    if (a === undefined) return;
    if (e.key.indexOf("Arrow") === 0) e.preventDefault();
    doStep(a, false);
  });

  resetBtn.addEventListener("click", function () { resetEpisode(); });
  bannerReplay.addEventListener("click", function () { resetEpisode(); });

  // ---------- Khởi tạo ----------
  placeElf(true);
  updateHud();
  updateAIControls();
})();
