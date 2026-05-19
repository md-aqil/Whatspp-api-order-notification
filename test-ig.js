import dotenv from "dotenv";
dotenv.config({ path: "/etc/lcsw/.env" });
import { getUserIdByInstagramAccountId } from "./lib/db/integration-repository.js";

(async () => {
  try {
    const result = await getUserIdByInstagramAccountId("17841401616218402");
    console.log("RESULT FOR 17841401616218402 IS:", result);
  } catch (err) {
    console.error("ERROR running test:", err);
  }
  process.exit(0);
})();
