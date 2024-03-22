const fs = require("fs");
const ApexPMD = require("./ApexPMD");

(async () => {
  const jobId = "1231413123123";

  fs.mkdirSync(jobId);
  fs.copyFileSync(
    "./fixtures/invalid/Unchangeable.cls",
    `./${jobId}/Unchangeable.cls`
  );
  fs.copyFileSync("./fixtures/ruls/test.xml", `./${jobId}/ruls.xml`);

  try {
    let init = new ApexPMD("", "", jobId, [], [], "");

    const run = await init.runPMD();
  } catch (err) {
    console.error(err);
  } finally {
    fs.rmSync(jobId, { recursive: true, force: true });
  }
})();
