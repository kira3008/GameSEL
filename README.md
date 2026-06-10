# GameSEL — Blackjack & FrozenLake 6x6

Hai game web chạy ngay trong trình duyệt (mở `index.html` là chơi, không cần cài đặt),
logic mô phỏng trung thực các môi trường toy-text của [Gymnasium](https://gymnasium.farama.org/),
kèm demo AI Q-learning theo tinh thần repo
[Reinforcement-Learning-on-FrozenLake](https://github.com/moripiri/Reinforcement-Learning-on-FrozenLake)
(bản đồ 4x4 của repo được nâng lên 6x6).

## 🃏 Blackjack — `blackjack/index.html`

Xì dách phong cách casino Art-Deco: luật đúng 100% môi trường `Blackjack-v1` của Gymnasium
(bộ bài vô hạn, A = 1/11, nhà cái rút đến 17, xì dách tự nhiên trả 3 ăn 2), thêm hệ thống
chip — bắt đầu 1.000 chip, đặt cược bằng chip 5/25/100/500 rồi **Chia bài** (Enter), chơi
bằng **Rút** (phím H) / **Dừng** (phím S); ngân quỹ được lưu tự động. Bấm **Huấn luyện AI**
để agent Q-learning tự học 100.000 ván ngay trong trình duyệt, sau đó bật **AI chơi** xem
máy tự đánh, hoặc xem gợi ý "AI khuyên" khi tự chơi.

## 🧊 FrozenLake 6x6 — `frozenlake/index.html`

Dẫn tinh linh băng qua hồ băng 6x6 (36 ô, 8 hố) đến hộp quà, đúng cơ chế Gymnasium
`FrozenLake-v1`: di chuyển bằng phím mũi tên / WASD / nút bấm; bật **Mặt băng trơn** để
chơi chế độ trượt ngẫu nhiên như Gymnasium gốc (1/3 đi đúng hướng, 2/3 lệch sang hai bên
vuông góc — rơi hố là thua). Bấm **Huấn luyện AI** để agent Q-learning tự học (5.000 ván
chế độ thường / 30.000 ván chế độ trơn), bật **Bản đồ Q** xem mũi tên + màu nhiệt thể hiện
chính sách đã học trên từng ô, rồi **AI chơi** xem agent tự đi đến đích.

## Cấu trúc & kiểm thử

Mỗi game gồm `js/engine.js` (logic Gymnasium thuần, không DOM), `js/ai.js` (Q-learning
dạng bảng, không DOM) và `js/ui.js` + `css/style.css` (giao diện). Chạy test bằng Node:

```
node blackjack/test/engine.test.js
node blackjack/test/ai.test.js
node frozenlake/test/engine.test.js
node frozenlake/test/ai.test.js
```

Tài liệu thiết kế: `docs/superpowers/specs/`, kế hoạch triển khai: `docs/superpowers/plans/`.
