# 从你的主应用文件 (app.py) 导入 Flask app 实例
# 并将其命名为 application 或者 app，Vercel 会查找这个变量
from app import app as application

# 如果 Vercel 配置明确寻找 'app'，也可以直接用:
# from app import app

# This file is required for Vercel to properly serve your Flask application
