# app.py
from flask import Flask, request, jsonify
from neo4j_service import get_full_graph, get_person_name_by_id, get_all_person_names

app = Flask(__name__)

@app.route("/")
def index():
    return app.send_static_file("index.html")

@app.route("/api/graph", methods=["GET"])
def api_graph():
    data = get_full_graph()
    return jsonify({"code":200, "msg":"success", "data": data})

@app.route("/api/candidate-list", methods=["GET"])
def api_candidate():
    candidates = get_all_person_names()
    return jsonify({"code":200, "msg":"success", "data":{"candidates": candidates}})

@app.route("/api/check-match", methods=["POST"])
def api_check():
    req = request.get_json()
    node_id = req.get("node_id")
    user_ans = req.get("user_answer_name")
    if node_id is None or not user_ans:
        return jsonify({"code":400, "msg":"参数缺失", "data":{}})

    node_info = get_person_name_by_id(node_id)
    if not node_info:
        return jsonify({
            "code":200,
            "msg":"success",
            "data":{"is_correct":False, "std_answer":"", "person_desc":""}
        })
    # 直接对比名字是否相等
    is_correct = (node_info["name"] == user_ans)
    return jsonify({
        "code":200,
        "msg":"success",
        "data":{
            "is_correct": is_correct,
            "std_answer": node_info["name"],
            "person_desc": node_info["desc"]
        }
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)