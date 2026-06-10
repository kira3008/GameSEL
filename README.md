# GameSEL — Blackjack & FrozenLake 6x6

Hai game web chạy ngay trong trình duyệt (mở `index.html` là chơi, không cần cài đặt),
logic mô phỏng trung thực các môi trường toy-text của [Gymnasium](https://gymnasium.farama.org/),
kèm demo AI Q-learning theo tinh thần repo
[Reinforcement-Learning-on-FrozenLake](https://github.com/moripiri/Reinforcement-Learning-on-FrozenLake)
(bản đồ 4x4 của repo được nâng lên 6x6).

## 🚀 Cách chạy game

**Yêu cầu:** chỉ cần một trình duyệt hiện đại (Chrome / Edge / Firefox).
Không cần cài Python, Node hay thư viện gì — game là HTML/CSS/JS thuần, chạy offline được.

### Cách 1 — Mở trực tiếp (nhanh nhất)

1. Tải code về:
   ```
   git clone https://github.com/kira3008/GameSEL.git
   ```
   (hoặc bấm **Code → Download ZIP** trên GitHub rồi giải nén)
2. Mở thư mục vừa tải, **nháy đúp** vào một trong hai file:
   - `blackjack/index.html` → chơi Blackjack 🃏
   - `frozenlake/index.html` → chơi FrozenLake ❄️

### Cách 2 — Chạy qua server local (tùy chọn)

Nếu thích chạy kiểu web server (không bắt buộc):

```
# nếu có Python
python -m http.server 8000

# hoặc nếu có Node
npx serve .
```

rồi mở `http://localhost:8000/blackjack/` hoặc `http://localhost:8000/frozenlake/`.

## 🃏 Blackjack — cách chơi

Xì dách phong cách casino Art-Deco, luật đúng 100% môi trường `Blackjack-v1` của Gymnasium
(bộ bài vô hạn, A = 1/11, nhà cái rút đến 17, xì dách tự nhiên trả 3 ăn 2).

1. **Đặt cược:** bấm các chip `5 / 25 / 100 / 500` để đặt (bắt đầu có 1.000 chip, tự lưu lại
   cho lần chơi sau). Bấm **Xóa cược** nếu muốn đặt lại.
2. **Chia bài:** bấm **Chia bài** (hoặc phím `Enter`).
3. **Chơi:** bấm **Rút** (phím `H`) để rút thêm bài, **Dừng** (phím `S`) để dừng — nhà cái
   sẽ lật bài úp và rút đến khi đạt 17 điểm.
4. **Kết quả:** Thắng ăn 1:1, Xì dách tự nhiên (A + 10/J/Q/K) ăn 3:2, Hòa hoàn cược.
   Hết chip thì bấm nút nhận lại 1.000 chip.

**Demo AI:** bấm **Huấn luyện AI** — agent Q-learning tự học 100.000 ván ngay trong trình
duyệt (vài giây). Sau đó:
- Bật công tắc **AI chơi** để xem máy tự đánh (có hiện quyết định "AI: Rút/Dừng" từng bước).
- Khi tự chơi, góc AI sẽ hiện gợi ý **"AI khuyên: Rút/Dừng"** cho bài trên tay bạn.

## 🧊 FrozenLake 6x6 — cách chơi

Dẫn tinh linh băng qua hồ băng 6x6 (36 ô, 8 hố nước) đến hộp quà, đúng cơ chế Gymnasium
`FrozenLake-v1`.

1. **Di chuyển:** phím mũi tên `← ↓ → ↑`, phím `WASD`, hoặc bấm 4 nút trên màn hình.
2. **Mục tiêu:** đến ô hộp quà 🎁 là thắng; rơi xuống hố nước là thua. Bấm **Chơi lại** để chơi ván mới.
3. **Chế độ khó:** bật **Mặt băng trơn** — mặt băng trượt như Gymnasium gốc: mỗi bước chỉ có
   1/3 xác suất đi đúng hướng, 2/3 trượt sang hai bên vuông góc (có chữ **"Trượt!"** báo khi trượt).

**Demo AI:** bấm **Huấn luyện AI** — agent Q-learning tự học (5.000 ván ở chế độ thường,
30.000 ván ở chế độ trơn, có thanh tiến độ + tỷ lệ thắng). Sau đó:
- Bật **Bản đồ Q** để xem chính sách đã học: mũi tên = hướng đi tốt nhất từng ô,
  màu nhiệt = giá trị ô.
- Bấm **AI chơi** để xem agent tự đi đến hộp quà từng bước.
- Lưu ý: đổi chế độ trơn/thường thì phải huấn luyện lại (AI học cho đúng môi trường đó).

## 🗂 Cấu trúc & kiểm thử

Mỗi game gồm `js/engine.js` (logic Gymnasium thuần, không DOM), `js/ai.js` (Q-learning
dạng bảng, không DOM) và `js/ui.js` + `css/style.css` (giao diện).

Chạy test (cần [Node.js](https://nodejs.org), chỉ dùng cho test — chơi game thì không cần):

```
node blackjack/test/engine.test.js
node blackjack/test/ai.test.js
node frozenlake/test/engine.test.js
node frozenlake/test/ai.test.js
```

Tài liệu thiết kế: `docs/superpowers/specs/`, kế hoạch triển khai: `docs/superpowers/plans/`.
