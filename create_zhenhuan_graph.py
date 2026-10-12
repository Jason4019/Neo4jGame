# -*- coding: utf-8 -*-
"""
用 py2neo 把《甄嬛传》人物关系数据写入 Neo4j。

运行：
    venv\Scripts\python.exe create_zhenhuan_graph.py

说明：
- 节点使用与封神一致的 Person 标签（name 唯一），方便复用同一套答题系统。
- 脚本幂等：重复运行不会产生重复节点/关系。
- 不清空封神数据，仅追加甄嬛传。如需清空全部数据，先执行：
    MATCH (n) DETACH DELETE n;
"""
from py2neo import Graph, Node, Relationship
import config

# (name, role, desc)
PERSONS = [
    ("甄嬛",     "熹贵妃",   "主角，莞贵人晋熹贵妃，聪慧坚韧、城府深"),
    ("皇帝",     "雍正",     "大清皇帝，多疑，深念已故的纯元皇后"),
    ("皇后",     "乌拉那拉·宜修", "心机深沉的正宫皇后，谋害皇嗣、打压妃嫔"),
    ("华妃",     "年世兰",   "骄横跋扈的宠妃，年羹尧之妹"),
    ("安陵容",   "鹂妃",     "甄嬛旧日姐妹后反目，心思敏感多疑"),
    ("沈眉庄",   "惠贵妃",   "甄嬛挚友，端庄贤淑，与太医温实初相爱"),
    ("果郡王",   "允礼",     "皇帝之弟，与甄嬛相爱，风流儒雅"),
    ("敬妃",     "敬妃",     "宫中年长妃嫔，待人宽厚，与甄嬛交好"),
    ("端妃",     "端妃",     "久病成医的妃嫔，与甄嬛结盟"),
    ("纯元皇后", "朱宜修之姐", "皇帝元后，皇后之姐，早逝"),
    ("温实初",   "太医",     "太医院御医，深爱沈眉庄"),
    ("浣碧",     "甄嬛侍女", "甄嬛同父异母妹妹，后封福晋"),
    ("流朱",     "甄嬛侍女", "甄嬛贴身侍女，赤胆忠心"),
    ("槿汐",     "甄嬛侍女", "甄嬛心腹侍女，与苏培盛结为对食"),
    ("苏培盛",   "太监总管", "皇帝贴身太监，与槿汐结为对食"),
    ("甄远道",   "甄嬛之父", "甄嬛父亲，朝廷官员"),
    ("曹贵人",   "贵人",     "华妃党羽，心思缜密，育有温宜公主"),
    ("祺贵人",   "祺贵人",   "娇纵跋扈，与甄嬛为敌"),
]

# (源人物, 关系类型, 目标人物)
RELATIONS = [
    # 夫妻 / 妃嫔（皇帝为夫）
    ("皇帝",   "HUSBAND", "皇后"),
    ("皇帝",   "HUSBAND", "华妃"),
    ("皇帝",   "HUSBAND", "甄嬛"),
    ("皇帝",   "HUSBAND", "纯元皇后"),
    # 父女
    ("甄远道", "FATHER",  "甄嬛"),
    # 姐妹
    ("皇后",   "SISTER",  "纯元皇后"),
    ("甄嬛",   "SISTER",  "沈眉庄"),
    ("甄嬛",   "SISTER",  "安陵容"),
    ("甄嬛",   "SISTER",  "浣碧"),
    # 主仆
    ("甄嬛",   "MASTER",  "流朱"),
    ("甄嬛",   "MASTER",  "槿汐"),
    ("甄嬛",   "MASTER",  "浣碧"),
    # 敌对
    ("甄嬛",   "ENEMY",   "皇后"),
    ("甄嬛",   "ENEMY",   "华妃"),
    ("甄嬛",   "ENEMY",   "安陵容"),
    ("甄嬛",   "ENEMY",   "祺贵人"),
    ("皇后",   "ENEMY",   "华妃"),
    ("华妃",   "ENEMY",   "沈眉庄"),
    # 恋人
    ("甄嬛",   "LOVER",   "果郡王"),
    ("沈眉庄", "LOVER",   "温实初"),
    # 对食
    ("苏培盛", "PARTNER", "槿汐"),
    # 兄弟 / 伙伴
    ("果郡王", "BROTHER", "皇帝"),
    ("敬妃",   "FRIEND",  "甄嬛"),
    ("端妃",   "FRIEND",  "甄嬛"),
    ("曹贵人", "FRIEND",  "华妃"),
]


def main():
    graph = Graph(config.NEO4J_URI, auth=(config.NEO4J_USER, config.NEO4J_PASSWORD))

    # 幂等创建节点：按 name 唯一性 MERGE
    node_map = {}
    for name, role, desc in PERSONS:
        n = Node("Person", name=name, role=role, desc=desc)
        graph.merge(n, "Person", "name")
        node_map[name] = n

    # 幂等创建关系：已存在则跳过
    created = 0
    for src, rel_type, tgt in RELATIONS:
        rel = Relationship(node_map[src], rel_type, node_map[tgt])
        if not graph.exists(rel):
            graph.create(rel)
            created += 1

    total = graph.run("MATCH (p:Person) RETURN count(p) AS c").evaluate()
    print(f"甄嬛传：写入 {len(PERSONS)} 个节点、{len(RELATIONS)} 条关系（新关系 {created} 条）。")
    print(f"当前数据库 Person 节点总数：{total}")


if __name__ == "__main__":
    main()
