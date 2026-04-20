SET @MYSQLDUMP_TEMP_LOG_BIN = @@SESSION.SQL_LOG_BIN;
SET @@SESSION.SQL_LOG_BIN= 0;
SET @@GLOBAL.GTID_PURGED=/*!80000 '+'*/ '13465096-d291-11f0-9ffb-8d8f2305ad56:1-23468';
INSERT INTO `users` VALUES ('1f40c1ee-5cbc-40f8-830f-43a1f376de41','test@example.com','$2b$12$.xmNpnCbxQEKU0xXlG3W1expNLV0qT3iFHVtjczs8IEdGHETDishG','Test User','owner','free',1,'2026-04-07 15:23:33','2026-04-07 15:23:33');
INSERT INTO `users` VALUES ('46173c91-e724-43e9-82cc-dad6e86fa166','mdaqil4k@gmail.com','$2a$12$pm5abmuNATgWMMwI4Qkqf.aNV3Dt9Hjte7OlopGp47gsfZsWWcjQe','mdaqil4k','owner','free',1,'2026-04-12 13:29:06','2026-04-12 13:29:06');
INSERT INTO `users` VALUES ('6fbc547a-4a0b-4a6e-a152-92893348a8da','aqilali381@gmail.com','$2b$12$cTd6aCMihwJ6rRYSUfoXduZFBFEUlJzx58ld4OD/SqbblOp8c8XJa','Md Aqil','owner','free',1,'2026-04-07 16:48:39','2026-04-07 16:48:39');
INSERT INTO `users` VALUES ('d2703b03-0412-41b2-b312-6a2329e987ba','test2@example.com','$2b$12$dJH2.fMwxfcT29fjq4zuo.IRXKd/sjvGGYv87jD.Su3nbewJ9Nxta','Test User','owner','free',1,'2026-04-07 15:22:46','2026-04-07 15:22:46');
INSERT INTO `users` VALUES ('f28e8e11-8c4c-4766-8e94-b7771e0fc55b','newuser@test.com','$2b$12$EfOA1tk0jXOUpX84NB574ecjMj.z/vEesUvwXH3JqhRzl367kBXhG','New User','owner','free',1,'2026-04-07 16:50:26','2026-04-07 16:50:26');
SET @@SESSION.SQL_LOG_BIN = @MYSQLDUMP_TEMP_LOG_BIN;
