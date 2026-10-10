# neo4j_service.py
from neo4j import GraphDatabase
from config import NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
# 导入关系映射表
from config import REL_MAP

def get_full_graph():
    """获取全部节点和关系，前端渲染图谱"""
    with driver.session() as session:
        node_res = session.run("""
            MATCH (n)
            RETURN id(n) AS node_id, labels(n) AS label, properties(n) AS props

        """)
        nodes = []
        for rec in node_res:
            node_id = rec["node_id"]
            label = rec["label"][0]
            props = rec["props"]
            item = {"id": node_id, "label": label}
            item.update(props)
            nodes.append(item)
        rel_res = session.run("""
            MATCH (s)-[r]->(t)
            RETURN id(s) AS source, id(t) AS target, type(r) AS rel_type
        """)
        rels = []
        for rec in rel_res:
            raw_rel_type = rec["rel_type"]
            # 从config读取映射，翻译成中文，找不到映射就保留原始英文兜底
            show_type = REL_MAP.get(raw_rel_type, raw_rel_type)
            rels.append({
                "source": rec["source"],
                "target": rec["target"],
                "type": show_type
            })
        return {"nodes": nodes, "relationships": rels}

def get_person_name_by_id(node_id):
    """根据节点ID，获取节点本身的name和desc"""
    with driver.session() as session:
        res = session.run("""
            MATCH (p:Person) WHERE id(p) = $nodeId
            RETURN p.name AS name, p.desc AS desc
        """, nodeId=node_id)
        record = res.single()
        if not record:
            return None
        return {
            "name": record["name"],
            "desc": record["desc"]
        }

def get_all_person_names():
    """获取全部人名，底部候选列表"""
    with driver.session() as session:
        res = session.run("MATCH (p:Person) RETURN p.name AS name")
        names = [rec["name"] for rec in res]
        return names
