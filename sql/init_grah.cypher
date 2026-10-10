MATCH (n) DETACH DELETE n;

CREATE (:Person{name:"哪吒", desc:"陈塘关三太子"})
CREATE (:Person{name:"太乙真人", desc:"阐教金仙，哪吒授业恩师"})
CREATE (:Person{name:"姜子牙", desc:"元始天尊弟子，太乙真人同门"})
CREATE (:Person{name:"李靖", desc:"陈塘关总兵，哪吒生父"})
CREATE (:Person{name:"申公豹", desc:"阐教弟子，姜子牙师弟"})
WITH 1 as dummy

MATCH (a:Person{name:"太乙真人"}), (b:Person{name:"哪吒"})
CREATE (a)-[:TEACH]->(b);

MATCH (a:Person{name:"太乙真人"}), (b:Person{name:"姜子牙"})
CREATE (a)-[:SHIBROTHER]->(b), (b)-[:SHIBROTHER]->(a);

MATCH (a:Person{name:"李靖"}), (b:Person{name:"哪吒"})
CREATE (a)-[:FATHER]->(b);
