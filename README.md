# 周末吃什么

一个帮助您决定周末吃什么的 Flask 应用。

## 功能

- 随机推荐周末美食
- 记录您喜欢的美食
- 简单的用户界面

## 安装

1. 克隆仓库
```bash
git clone https://github.com/yourusername/周末吃什么-trae.git
cd 周末吃什么-trae
```

2. 创建并激活虚拟环境
```bash
python -m venv venv
source venv/bin/activate  # 在 Windows 上使用 `venv\Scripts\activate`
```

3. 安装依赖
```bash
pip install -r requirements.txt
```

4. 配置环境变量
创建 `.env` 文件并添加必要的环境变量（参考 `config.py`）

## 运行

```bash
flask run
```

然后访问 http://localhost:5000

## 部署

此应用已配置为可部署到 Vercel。

## 版本

1.0.0 - 初始版本
