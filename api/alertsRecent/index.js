const { DefaultAzureCredential } = require("@azure/identity");
const sql = require("mssql");

module.exports = async function (context, req) {
  const limit = Math.min(parseInt(req.query.limit || "100", 10), 500);
  const server = process.env.SQL_SERVER;
  const database = process.env.SQL_DATABASE;

  try {
    const credential = new DefaultAzureCredential();
    const token = await credential.getToken("https://database.windows.net/.default");

    const pool = await sql.connect({
      server,
      database,
      options: { encrypt: true },
      authentication: {
        type: "azure-active-directory-access-token",
        options: { token: token.token }
      }
    });

    const result = await pool.request()
      .input("limit", sql.Int, limit)
      .query(`
        SELECT TOP (@limit)
          Severity,
          AlertType,
          CompanyName,
          VendorPayee,
          MetricValue,
          BaselineValue,
          DetectedAt
        FROM dbo.Payment_Anomaly_Alerts
        ORDER BY DetectedAt DESC;
      `);

    context.res = {
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: result.recordset
    };
  } catch (err) {
    context.log.error(err);
    context.res = { status: 500, body: { error: "Server error", detail: err.message } };
  } finally {
    try { await sql.close(); } catch {}
  }
};
