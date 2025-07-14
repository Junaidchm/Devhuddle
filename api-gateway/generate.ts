import path from "path";
import { execSync } from "child_process";
import fs from "fs";

const protoPath = path.resolve(__dirname, "protos", "auth.proto");
const outDir = path.resolve(__dirname, "src", "grpc", "generated");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

try {
  const command = [
    "protoc",
    `--plugin=protoc-gen-ts_proto=${path.resolve("node_modules", ".bin", "protoc-gen-ts_proto")}`,
    `--ts_proto_out=${outDir}`,
    `--ts_proto_opt=outputServices=grpc-js,esModuleInterop=true`,
    `--proto_path=${path.dirname(protoPath)}`,
    protoPath
  ].join(" ");

  execSync(command, { stdio: "inherit" });
  console.log("✅ gRPC code generated using ts-proto (API Gateway)");
} catch (error) {
  console.error("❌ Failed to generate gRPC code:", error);
  process.exit(1);
}
