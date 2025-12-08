const { S3Client, ListBucketsCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
require("dotenv").config();

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function testConnection() {
  try {
    console.log("Testing R2 connection...");
    console.log("Bucket:", process.env.R2_BUCKET_NAME);
    
    // Test 1: List buckets
    const listCommand = new ListBucketsCommand({});
    const response = await r2Client.send(listCommand);
    console.log("✅ Connection successful!");
    console.log("Available buckets:", response.Buckets?.map(b => b.Name));
    
    // Test 2: Upload a test file
    console.log("\nTesting file upload...");
    const putCommand = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: "test/connection-test.txt",
      Body: "Hello from Media Service!",
      ContentType: "text/plain",
    });
    await r2Client.send(putCommand);
    console.log("✅ File upload successful!");
    console.log("Test file uploaded to: test/connection-test.txt");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.Code === "AccessDenied") {
      console.error("   → Check your R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY");
    }
  }
}

testConnection();