# StockScan

Offline-first real-time inventory scanning desktop app (Tauri 2 + React + SQLite).

## 开发

```bash
pnpm install
pnpm test          # 前端
pnpm app           # Tauri 开发窗口
```

Rust 测试：

```bash
# C 盘空间不够时，把编译产物放到 D 盘
export CARGO_TARGET_DIR="D:/stockscan-target"
export PATH="$HOME/.cargo/bin:$PATH"
pnpm test:rust
```

## 本机注意

- 需要 Rust stable MSVC、以及 Visual Studio Build Tools 的 C++ 工作负载。
- Windows **Smart App Control** 会拦截 Cargo 的 `build-script-build.exe`（错误 4551）。开发时请在「Windows 安全中心 → 应用和浏览器控制 → Smart App Control」中关闭，否则 `cargo test` / `pnpm app` 无法编译。
- 客户真实报表放 `fixtures/private/`（已 gitignore），不要提交。
