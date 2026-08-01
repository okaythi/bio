import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs";
import path from "path";

const s3Client = new S3Client({
  region: "auto",
  endpoint: "https://1a34e3b2175b8d85d73804215787e277.r2.cloudflarestorage.com",
  forcePathStyle: true,
  maxAttempts: 5,
  credentials: {
    accessKeyId: "e89e7c08a9b57a0132ded50ee6724b76",
    secretAccessKey: "5cbe8a64d6d500f4b66dc06f962dd1e64f7c78ad10479d4ab03349a20c4dfa95"
  }
});

async function uploadFile(filePath, key) {
  const fileStream = fs.createReadStream(filePath);
  try {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: "movies",
        Key: key,
        Body: fileStream
      }
    });

    upload.on("httpUploadProgress", (progress) => {
      if (progress.total) {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        if (pct % 25 === 0) {
          console.log(`[${key}] ${pct}% (${(progress.loaded / 1024 / 1024).toFixed(1)}MB)`);
        }
      }
    });

    await upload.done();
    console.log(`Upload complete: ${key}`);
  } catch (error) {
    console.error(`Upload failed for ${key}:`, error.message);
  }
}

async function main() {
  const s1Dir = "movies/Solo Leveling S01 1080p Dual Audio 10 bits DD+ x265-EMBER";
  const files = fs.readdirSync(s1Dir);
  const cleanFolder = "Solo Leveling (2024)";

  for (const file of files) {
    if (!file.endsWith(".mp4") && !file.endsWith(".srt")) continue;

    const fullPath = path.join(s1Dir, file);
    let cleanName = file.replace(/\s*\[[A-Z0-9]+\]/i, '');
    
    if (cleanName.endsWith('.srt') && !cleanName.endsWith('.en.srt')) {
      cleanName = cleanName.replace(/\.srt$/i, '.en.srt');
    }

    const r2Key = `${cleanFolder}/${cleanName}`;
    console.log(`Starting upload: ${file} -> ${r2Key}`);
    await uploadFile(fullPath, r2Key);
  }
  console.log("All Season 1 uploads completed!");
}

main();
