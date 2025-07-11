const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

const protoPath = path.resolve(__dirname, 'protos', 'auth.proto');
const outDir = path.resolve(__dirname, 'grpc-generated');

// Create the grpc-generated directory if it doesn't exist
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

try {
  execSync(`
    npx grpc_tools_node_protoc \
      --js_out=import_style=commonjs,binary:${outDir} \
      --grpc_out=grpc_js:${outDir} \
      --plugin=protoc-gen-ts=${path.resolve(__dirname, 'node_modules', '.bin', 'protoc-gen-ts')} \
      --ts_out=service=grpc-node:${outDir} \
      --proto_path=${path.dirname(protoPath)} \
      ${protoPath}
  `, { stdio: 'inherit' });
  console.log('gRPC code generated (API Gateway)');
} catch (error) {
  console.error('Failed to generate gRPC code:', error);
  process.exit(1);
}