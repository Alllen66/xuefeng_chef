from flask import Flask, render_template, jsonify, request
import requests
import time
from config import Config

# (确保您已经导入了 render_template)
# from flask import Flask, render_template, jsonify, request

app = Flask(__name__) # <--- 取消此行的注释
app.config.from_object(Config)

# 全局变量用于缓存 access_token 和其过期时间
FEISHU_ACCESS_TOKEN = None
FEISHU_TOKEN_EXPIRES_AT = 0

def get_feishu_access_token():
    """获取飞书应用访问凭证 (tenant_access_token)"""
    global FEISHU_ACCESS_TOKEN, FEISHU_TOKEN_EXPIRES_AT    
    if FEISHU_ACCESS_TOKEN and time.time() < FEISHU_TOKEN_EXPIRES_AT:
        print("DEBUG: get_feishu_access_token - Using cached token.")
        return FEISHU_ACCESS_TOKEN

    url = "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal"
    headers = {"Content-Type": "application/json"}
    payload = {
        "app_id": app.config["FEISHU_APP_ID"],
        "app_secret": app.config["FEISHU_APP_SECRET"],
    }
    print(f"DEBUG: get_feishu_access_token - Requesting new token with App ID: {app.config['FEISHU_APP_ID']}")
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        print(f"DEBUG: get_feishu_access_token - Token API response status: {response.status_code}")
        print(f"DEBUG: get_feishu_access_token - Token API response body: {response.text}")
        response.raise_for_status()
        data = response.json()
        
        if data.get("code") == 0:
            FEISHU_ACCESS_TOKEN = data.get("tenant_access_token")
            FEISHU_TOKEN_EXPIRES_AT = time.time() + data.get("expire", 7200) - 60 
            print(f"DEBUG: get_feishu_access_token - Successfully obtained new token (expires in {data.get('expire')}s).")
            return FEISHU_ACCESS_TOKEN
        else:
            print(f"获取飞书 Access Token 失败: Code: {data.get('code')}, Msg: {data.get('msg')}")
            FEISHU_ACCESS_TOKEN = None # Ensure token is None if fetching failed
            return None
    except requests.exceptions.RequestException as e:
        print(f"请求飞书 Access Token API 异常: {e}")
        FEISHU_ACCESS_TOKEN = None # Ensure token is None if exception occurred
        return None

def get_bitable_records(page_token=None, page_size=20):
    """从飞书多维表格获取记录"""
    access_token = get_feishu_access_token()
    if not access_token:
        print("DEBUG: get_bitable_records - Failed to get access_token from get_feishu_access_token(). Aborting Bitable API call.")
        return {"error": "无法获取飞书 Access Token"}
    
    print(f"DEBUG: get_bitable_records - Using access_token (first 20 chars): {access_token[:20]}...")

    base_id = app.config["BASE_ID"]
    table_id_full = app.config["TABLE_ID"]
    
    if "&view=" in table_id_full:
        table_id, view_param = table_id_full.split("&view=", 1)
        view_id = view_param
    else:
        table_id = table_id_full
        view_id = None

    url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{base_id}/tables/{table_id}/records"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    params = {"page_size": page_size}
    if page_token:
        params["page_token"] = page_token
    if view_id: # This part might not be hit if your TABLE_ID in config.py doesn't have &view=
        params["view_id"] = view_id
        print(f"DEBUG: get_bitable_records - Using view_id: {view_id}")

    print(f"DEBUG: get_bitable_records - Request URL: {url}")
    print(f"DEBUG: get_bitable_records - Request Headers: {headers}")
    print(f"DEBUG: get_bitable_records - Request Params: {params}")
    
    all_records = []
    has_more = True # Assume true for the first request if not paginating all
    current_page_token = page_token # Initialize with passed page_token

    # Simplified loop for initial testing, to get first page or specific page
    # To fetch all pages, the original while loop is better
    # For now, let's just try one request
    # while has_more: # Original loop
    if current_page_token:
        params["page_token"] = current_page_token
    
    try:
        response = requests.get(url, headers=headers, params=params)
        print(f"DEBUG: get_bitable_records - Bitable API response status: {response.status_code}")
        print(f"DEBUG: get_bitable_records - Bitable API response headers: {response.headers}")
        print(f"DEBUG: get_bitable_records - Bitable API response body: {response.text}") # This will show the raw error from Feishu
        response.raise_for_status() # This will raise an exception for 4xx/5xx errors
        data = response.json()

        if data.get("code") == 0:
            items = data.get("data", {}).get("items", [])
            # 处理图片URL
            for item in items:
                current_item_fields = item.get('fields', {})
                
                raw_image_link_data = current_item_fields.get('图片链接')
                print(f"DEBUG: Record ID {item.get('record_id')}, Raw '图片链接' from Feishu: {raw_image_link_data}, Type: {type(raw_image_link_data)}")

                processed_urls = []

                if raw_image_link_data: # 确保字段存在且不为None或空
                    if isinstance(raw_image_link_data, str) and raw_image_link_data.strip(): # 单个 URL 字符串
                        processed_urls.append(raw_image_link_data.strip())
                    elif isinstance(raw_image_link_data, list): # URL 列表
                        for entry in raw_image_link_data:
                            url_to_add = None
                            if isinstance(entry, str) and entry.strip():
                                url_to_add = entry.strip()
                            elif isinstance(entry, dict):
                                # 尝试从常见的key中提取URL
                                if 'link' in entry and isinstance(entry['link'], str) and entry['link'].strip():
                                    url_to_add = entry['link'].strip()
                                elif 'url' in entry and isinstance(entry['url'], str) and entry['url'].strip():
                                    url_to_add = entry['url'].strip()
                                elif 'text' in entry and isinstance(entry['text'], str) and entry['text'].strip():
                                    if entry['text'].startswith('http://') or entry['text'].startswith('https://'):
                                        url_to_add = entry['text'].strip()
                            
                            if url_to_add:
                                processed_urls.append(url_to_add)
                            else:
                                print(f"DEBUG: Record ID {item.get('record_id')}, Could not extract URL from '图片链接' list entry: {entry}")
                    else:
                        print(f"DEBUG: Record ID {item.get('record_id')}, '图片链接' field has an unexpected type: {type(raw_image_link_data)}")
                
                # 简化逻辑：不再回退到 "图片" 字段
                # if not processed_urls and '图片' in current_item_fields and current_item_fields['图片']:
                #     pass # 移除对 '图片' 字段的处理

                current_item_fields['图片链接'] = processed_urls # 前端将从此字段获取URL
                if not processed_urls:
                     print(f"DEBUG: Record ID {item.get('record_id')}, Final processed_urls for '图片链接' is empty. Frontend will use default.")

            all_records.extend(items)
            has_more = data.get("data", {}).get("has_more", False)
            current_page_token = data.get("data", {}).get("page_token", None)
            # break # If only fetching one page for testing
        else:
            print(f"获取飞书多维表格数据失败: Code: {data.get('code')}, Msg: {data.get('msg')}")
            return {"error": f"获取飞书多维表格数据失败: {data.get('msg')}"}
    except requests.exceptions.HTTPError as http_err:
        print(f"请求飞书多维表格 API 发生 HTTP 错误: {http_err}") # More specific HTTP error
        print(f"请求飞书多维表格 API 响应内容: {http_err.response.text if http_err.response else 'No response content'}")
        return {"error": f"请求飞书多维表格 API 发生 HTTP 错误: {str(http_err)}"}
    except requests.exceptions.RequestException as e:
        print(f"请求飞书多维表格 API 异常: {e}")
        return {"error": f"请求飞书多维表格 API 异常: {str(e)}"}
        
    # if not page_token and not has_more:
    #     break
    # if page_token and not has_more:
    #      break

    return {"items": all_records, "has_more": has_more, "next_page_token": current_page_token}


@app.route('/')
def index():
    return "Hello, World!" # 示例路由

@app.route('/swipe')
def swipe_page():
    return render_template('swipe.html')

@app.route('/list')
def list_page():
    return render_template('list.html')

@app.route('/profile')
def profile_page():
    return render_template('profile.html')

@app.route('/detail/<item_id>') # 假设 item_id 是菜谱在多维表格中的记录ID
def detail_page(item_id):
    # 此处需要逻辑根据 item_id 从飞书获取单个菜谱的详细信息
    # 为简化，暂时只传递 item_id 到模板
    return render_template('detail.html', item_id=item_id)

@app.route('/api/recipes', methods=['GET'])
def api_get_recipes():
    """API接口，用于前端获取菜谱数据"""
    page_token = request.args.get('page_token', None)
    page_size = request.args.get('page_size', 20, type=int)
    
    data = get_bitable_records(page_token=page_token, page_size=page_size)
    if "error" in data:
        return jsonify(data), 500
    return jsonify(data)

@app.route('/api/recipe/<record_id>', methods=['GET'])
def api_get_recipe_detail(record_id):
    """API接口，用于获取单个菜谱详情"""
    access_token = get_feishu_access_token()
    if not access_token:
        return jsonify({"error": "无法获取飞书 Access Token"}), 500

    base_id = app.config["BASE_ID"]
    table_id_full = app.config["TABLE_ID"]
    table_id = table_id_full.split("&view=")[0] if "&view=" in table_id_full else table_id_full


    url = f"https://open.feishu.cn/open-apis/bitable/v1/apps/{base_id}/tables/{table_id}/records/{record_id}"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()

        if data.get("code") == 0:
            item = data.get("data", {}).get("record", {})
            current_item_fields = item.get('fields', {})
            
            if current_item_fields:
                raw_image_link_data_detail = current_item_fields.get('图片链接')
                print(f"DEBUG: Detail Record ID {item.get('record_id')}, Raw '图片链接' from Feishu: {raw_image_link_data_detail}, Type: {type(raw_image_link_data_detail)}")
                
                processed_urls_detail = []

                if raw_image_link_data_detail: 
                    if isinstance(raw_image_link_data_detail, str) and raw_image_link_data_detail.strip():
                        processed_urls_detail.append(raw_image_link_data_detail.strip())
                    elif isinstance(raw_image_link_data_detail, list):
                        for entry in raw_image_link_data_detail:
                            url_to_add = None
                            if isinstance(entry, str) and entry.strip():
                                url_to_add = entry.strip()
                            elif isinstance(entry, dict):
                                if 'link' in entry and isinstance(entry['link'], str) and entry['link'].strip():
                                    url_to_add = entry['link'].strip()
                                elif 'url' in entry and isinstance(entry['url'], str) and entry['url'].strip():
                                    url_to_add = entry['url'].strip()
                                elif 'text' in entry and isinstance(entry['text'], str) and entry['text'].strip():
                                    if entry['text'].startswith('http://') or entry['text'].startswith('https://'):
                                        url_to_add = entry['text'].strip()

                            if url_to_add:
                                processed_urls_detail.append(url_to_add)
                            else:
                                print(f"DEBUG: Detail Record ID {item.get('record_id')}, Could not extract URL from '图片链接' list entry: {entry}")
                    else:
                        print(f"DEBUG: Detail Record ID {item.get('record_id')}, '图片链接' field has an unexpected type: {type(raw_image_link_data_detail)}")

                # 简化逻辑：不再回退到 "图片" 字段
                # if not processed_urls_detail and '图片' in current_item_fields and current_item_fields['图片']:
                #     pass # 移除对 '图片' 字段的处理
                
                current_item_fields['图片链接'] = processed_urls_detail # 前端将从此字段获取URL
                if not processed_urls_detail:
                    print(f"DEBUG: Detail Record ID {item.get('record_id')}, Final processed_urls_detail for '图片链接' is empty. Frontend will use default.")

            return jsonify(item)
        else:
            print(f"获取飞书记录详情失败: {data.get('msg')}")
            return jsonify({"error": f"获取飞书记录详情失败: {data.get('msg')}"}), 500
    except requests.exceptions.RequestException as e:
        print(f"请求飞书记录详情 API 异常: {e}")
        return jsonify({"error": f"请求飞书记录详情 API 异常: {str(e)}"}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)