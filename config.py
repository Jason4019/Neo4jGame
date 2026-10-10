# config.py
# Neo4j连接配置 + rel_rule Cypher模板映射
NEO4J_URI = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "20000723"

# config.py
# 关系类型映射：neo4j内的关系英文 => 前端展示中文
REL_MAP = {
    "FATHER": "父亲",
    "MOTHER": "母亲",
    "SON": "儿子",
    "TEACH": "师徒",
    "SHIBROTHER": "同门",
    "BROTHER": "兄弟",
    "FRIEND": "伙伴",
    "ENEMY": "敌对",
    "MASTER": "主人",
    "DISCIPLE": "弟子"
}