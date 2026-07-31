import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const moviesDir = path.join(__dirname, '../movies');

function getMkvFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getMkvFiles(filePath, fileList);
    } else if (file.endsWith('.mkv')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const mkvFiles = getMkvFiles(moviesDir);

console.log(`Found ${mkvFiles.length} MKV files to process.`);

async function processFile(filePath) {
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, '.mkv');
  
  const mp4Path = path.join(dir, `${baseName}.mp4`);
  const srtPath = path.join(dir, `${baseName}.srt`);

  if (fs.existsSync(mp4Path)) {
    console.log(`Skipping ${baseName} as mp4 already exists.`);
    return;
  }

  console.log(`\nProcessing: ${baseName}`);

  // 1. Extract subtitles
  console.log(`Extracting subtitles for ${baseName}...`);
  await new Promise((resolve, reject) => {
    const ffmpegSub = spawn('ffmpeg', [
      '-y',
      '-i', filePath,
      '-map', '0:s:0',
      '-c:s', 'srt',
      srtPath
    ]);
    ffmpegSub.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Subtitle extraction failed with code ${code}`));
    });
  });

  // 2. Transcode video and audio
  console.log(`Transcoding video and audio for ${baseName}...`);
  await new Promise((resolve, reject) => {
    const ffmpegVid = spawn('ffmpeg', [
      '-y',
      '-i', filePath,
      '-map', '0:v',
      '-map', '0:a:1', // Japanese EAC3 track
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      mp4Path
    ]);
    
    // Log progress occasionally
    let lastLogTime = Date.now();
    ffmpegVid.stderr.on('data', (data) => {
      if (Date.now() - lastLogTime > 15000) {
        const str = data.toString();
        const timeMatch = str.match(/time=(\d{2}:\d{2}:\d{2}.\d{2})/);
        if (timeMatch) {
          console.log(`[${baseName}] Progress: ${timeMatch[1]}`);
        }
        lastLogTime = Date.now();
      }
    });

    ffmpegVid.on('close', (code) => {
      if (code === 0) {
         console.log(`Finished ${baseName}.mp4 successfully.`);
         resolve();
      } else {
         reject(new Error(`Video transcoding failed with code ${code}`));
      }
    });
  });
}

async function run() {
  for (let i = 0; i < mkvFiles.length; i++) {
    console.log(`\n--- File ${i + 1} of ${mkvFiles.length} ---`);
    try {
      await processFile(mkvFiles[i]);
    } catch (err) {
      console.error(`Error processing ${mkvFiles[i]}:`, err);
    }
  }
  console.log('\nAll done processing MKV files!');
}

run();
