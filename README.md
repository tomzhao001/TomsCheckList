# 旅行清单

手机上用的旅行打包清单。本机只监听 `127.0.0.1:3711`，手机通过 Tailscale 打开。登录只要一个管理员密码。

第一期只有「旅行」这一类。配置页维护袋子和物品；新建旅行时复制一份，各次旅行的勾选互不影响。选定日期和目的地后，用 [Open-Meteo](https://open-meteo.com/) 显示每天的天气，点开可以看逐小时预报。

## 本地调试

需要 Node.js 22.13 或更高版本，以及 pnpm 9。在仓库根目录执行：

```powershell
pnpm install
Copy-Item .env.example .env
```

编辑 `.env`：

- `ADMIN_PASSWORD` 改成你的密码
- `COOKIE_SECURE` 改为 `false`，本地用 http 访问时登录 Cookie 才能保存

启动后端，用 `CHECKLIST_ENV_FILE` 指向这份配置：

```powershell
$env:CHECKLIST_ENV_FILE = (Resolve-Path .env).Path
pnpm --filter @checklist/server dev
```

另开一个终端启动前端。Vite 会把 `/api` 和 `/healthz` 代理到 `http://127.0.0.1:3711`。

```powershell
pnpm --filter @checklist/web dev
```

浏览器打开 `http://127.0.0.1:5173`，用 `ADMIN_PASSWORD` 登录。登录后直接进入清单页。

## 打包

安装包自带固定版本的 Node（见 `scripts/node-version.txt`），目标机器不用另外安装。没有平台相关的原生模块，但 Node 二进制仍要按系统准备，所以请在目标系统上打包。

第一次打包前，先把配置放到用户数据目录，并改掉密码。文件名是 `checklist.env`，内容从 `.env.example` 抄。走 Tailscale 的 https 时，把 `COOKIE_SECURE` 留成 `true`（不要写成 `false`）。

| 系统 | 配置文件 | 数据库和日志 |
| --- | --- | --- |
| Windows | `%LOCALAPPDATA%\TomsCheckList\checklist.env` | `%LOCALAPPDATA%\TomsCheckList` |
| macOS | `~/Library/Application Support/TomsCheckList/checklist.env` | `~/Library/Application Support/TomsCheckList` |

Windows（在 Windows 上运行）：

```powershell
.\scripts\package-windows.ps1
```

输出 `dist\TomsCheckList-<版本>-win-x64\`。加上 `-Zip` 才额外生成同名 zip。加上 `-Start` 会在打包完成后运行输出目录里的 `windows\install-service.ps1`，把服务切到这次打好的包并重新启动。若当前服务的工作目录已经是这个输出目录，会先停掉它再打包，避免文件被占用。

macOS（在 Mac 上运行，架构按 `uname -m` 自动选择 arm64 或 x64）：

```bash
chmod +x scripts/package-macos.sh packaging/macos/*.sh
./scripts/package-macos.sh
```

输出 `dist/TomsCheckList-<版本>-darwin-<arch>/`。加上 `--tar` 才额外生成同名 tar.gz。加上 `--start` 会在打包完成后运行输出目录里的 `macos/install-service.sh`。

两个脚本都可以加 `-SkipInstall` / `--skip-install` 跳过 `pnpm install`。打包时会把用户数据目录里的 `checklist.env` 复制进输出目录；这个文件不存在就会失败。

Mac 服务器上更新：在已登录桌面的终端里执行 `git pull`，然后 `./scripts/package-macos.sh --start`。不要从纯 SSH 会话安装，否则 `launchctl bootstrap` 会报 `125: Domain does not support specified action`。

## 安装与运行

把安装包解压到一个固定目录，例如 `D:\Apps\TomsCheckList` 或 `~/Apps/TomsCheckList`。配置和数据不在安装目录里，升级不会丢。

### Windows

```powershell
cd D:\Apps\TomsCheckList
powershell -ExecutionPolicy Bypass -File .\windows\install-service.ps1
```

用户数据目录里还没有 `checklist.env` 时，会从安装目录复制一份再继续。密码仍是 `change-me` 或为空时会退出，改好后再运行一次。注册成功后，`TomsCheckList` 在登录后自动启动，进程意外退出时 10 秒后自动拉起。

`windows\` 下还有 `status.ps1`、`stop.ps1`、`logs.ps1`（`-Errors`、`-Follow`）、`start.ps1`、`uninstall-service.ps1`。

### macOS

```bash
cd ~/Apps/TomsCheckList
./macos/install-service.sh
```

请用要运行服务的那个用户，在已经登录的桌面里打开「终端」执行。不要加 `sudo`，也不要从 SSH 里执行。`macos/` 下的脚本和 Windows 一一对应（`status.sh`、`stop.sh`、`logs.sh --errors --follow`、`start.sh`、`uninstall-service.sh`）。

## 手机访问

服务只监听 `127.0.0.1:3711`，和 TomsLocalAgent 的 3701 互不占用。在装了 Tailscale 的那台电脑上执行：

```bash
tailscale serve --bg 3711
```

然后在手机上打开 Tailscale 给出的 https 地址。`COOKIE_SECURE=true` 时必须走这个 https 地址，登录才能保持。只在本机用 `http://127.0.0.1:3711` 访问的话，把它改为 `false`。

## 天气

目的地搜索和预报都由本机服务转发给 Open-Meteo，不需要 API Key。小时预报最多覆盖今天起 16 天；更远的日期会标成「预报尚未覆盖」。更早的历史日期改走历史接口。页面上保留署名：Weather data by Open-Meteo.com。
