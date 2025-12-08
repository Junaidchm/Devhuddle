const { S3Client, ListBucketsCommand, PutObjectCommand, HeadBucketCommand } = require("@aws-sdk/client-s3");
require("dotenv").config();

console.log("🔍 R2 Connection Diagnostic Test\n");
console.log("=" .repeat(50));

// Check environment variables
console.log("\n1. Checking Environment Variables:");
console.log("   R2_ACCOUNT_ID:", process.env.R2_ACCOUNT_ID ? "✅ Set" : "❌ Missing");
console.log("   R2_ACCESS_KEY_ID:", process.env.R2_ACCESS_KEY_ID ? `✅ Set (${process.env.R2_ACCESS_KEY_ID.substring(0, 8)}...)` : "❌ Missing");
console.log("   R2_SECRET_ACCESS_KEY:", process.env.R2_SECRET_ACCESS_KEY ? "✅ Set" : "❌ Missing");
console.log("   R2_BUCKET_NAME:", process.env.R2_BUCKET_NAME || "❌ Missing");
console.log("   R2_ENDPOINT:", process.env.R2_ENDPOINT || "❌ Missing");

if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
  console.log("\n❌ ERROR: Missing required credentials in .env file");
  console.log("   Make sure you have:");
  console.log("   - R2_ACCESS_KEY_ID");
  console.log("   - R2_SECRET_ACCESS_KEY");
  process.exit(1);
}

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function runDiagnostics() {
  try {
    console.log("\n2. Testing Connection to R2...");
    console.log("   Endpoint:", process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
    
    // Test 1: List buckets (requires list permission)
    console.log("\n3. Test 1: Listing buckets...");
    try {
      const listCommand = new ListBucketsCommand({});
      const response = await r2Client.send(listCommand);
      console.log("   ✅ Success! Found buckets:", response.Buckets?.map(b => b.Name).join(", ") || "none");
    } catch (error) {
      console.log("   ⚠️  Cannot list buckets (this is OK if token has Object Read & Write only)");
      console.log("   Error:", error.message);
    }
    
    // Test 2: Check if bucket exists (HEAD request)
    console.log("\n4. Test 2: Checking bucket access...");
    try {
      const headCommand = new HeadBucketCommand({
        Bucket: process.env.R2_BUCKET_NAME,
      });
      await r2Client.send(headCommand);
      console.log(`   ✅ Bucket "${process.env.R2_BUCKET_NAME}" is accessible!`);
    } catch (error) {
      console.log(`   ❌ Cannot access bucket "${process.env.R2_BUCKET_NAME}"`);
      console.log("   Error:", error.message);
      console.log("   Code:", error.Code);
      
      if (error.Code === "AccessDenied" || error.Code === "403") {
        console.log("\n   💡 Possible issues:");
        console.log("   1. API token doesn't have 'Object Read & Write' permissions");
        console.log("   2. API token is restricted to a different bucket");
        console.log("   3. Wrong Access Key ID or Secret Access Key");
        console.log("   4. Token might be expired or revoked");
      }
      throw error;
    }
    
    // Test 3: Upload a test file
    console.log("\n5. Test 3: Testing file upload...");
    try {
      const putCommand = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: "test/connection-test.txt",
        Body: "Hello from Media Service!",
        ContentType: "text/plain",
      });
      await r2Client.send(putCommand);
      console.log("   ✅ File upload successful!");
      console.log("   Test file uploaded to: test/connection-test.txt");
    } catch (error) {
      console.log("   ❌ File upload failed");
      console.log("   Error:", error.message);
      console.log("   Code:", error.Code);
      throw error;
    }
    
    console.log("\n" + "=".repeat(50));
    console.log("✅ All tests passed! R2 is configured correctly.");
    console.log("=".repeat(50));
    
  } catch (error) {
    console.log("\n" + "=".repeat(50));
    console.log("❌ Diagnostic failed");
    console.log("=".repeat(50));
    console.log("\nError details:");
    console.log("  Message:", error.message);
    console.log("  Code:", error.Code || "N/A");
    console.log("  Status Code:", error.$metadata?.httpStatusCode || "N/A");
    
    console.log("\n💡 Troubleshooting steps:");
    console.log("1. Go to Cloudflare Dashboard → R2 → API Tokens");
    console.log("2. Verify your API token has 'Object Read & Write' permissions");
    console.log("3. Check that the token is not restricted to a different bucket");
    console.log("4. Verify R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in .env match the token");
    console.log("5. Make sure the token is not expired");
    console.log("6. Try creating a new API token if the current one doesn't work");
    
    process.exit(1);
  }
}

runDiagnostics();

