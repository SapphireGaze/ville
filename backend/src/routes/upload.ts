import fs from "fs";
import path from "path";
import express from "express";
import ytdl from "ytdl-core";
import ffmpeg from "fluent-ffmpeg";
import * as mm from "music-metadata";

import { upload } from "../utils/upload.conf";
import { addTrackRecords, getNumberOfTracks } from "../database/queries";

const router: express.Router = express.Router();

// post request for audio file uploading and adding file record to database
router.post("/", upload.single("audio"), async (req: any, res: any) => {
  try {
    const { format } = await mm.parseFile(req.file.path, {
      duration: true,
    });

    const track = {
      title: path.parse(req.file.originalname).name,
      duration: format.duration || -1,
      path: req.file.path,
    };
    track.duration = Math.floor(track.duration);

    await addTrackRecords(track);

    console.log("File uploaded:", req.file.originalname, "to", req.file.path);
    res.status(200).send({ success: "File uploaded successfully!" });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

// post request for downloading youtube audios and storing in database
router.post("/url", async (req: any, res: any) => {
  try {
    const url = req.body.url;

    const uploadPath: string = "src/database/uploads/";
    fs.mkdirSync(uploadPath, { recursive: true });

    // validate user input url
    if (!url || !ytdl.validateURL(url)) {
      return res.status(400).send("Invalid YouTube URL");
    }

    const numberOfTracks: number = await getNumberOfTracks();

    // get youtube stream with ytdl-core and convert to mp3 using ffmpeg
    const stream: any = ytdl(url, { quality: "highestaudio" });
    ffmpeg(stream)
      .audioBitrate(128)
      .save(uploadPath + `${numberOfTracks + 1}.mp3`)
      .on("end", async () => {
        const info = await ytdl.getInfo(url);
        const filePath: string = uploadPath + `${numberOfTracks + 1}.mp3`;

        const { format } = await mm.parseFile(filePath, {
          duration: true,
        });

        const track = {
          title: info.videoDetails.title,
          duration: format.duration || -1,
          path: filePath,
        };
        track.duration = Math.floor(track.duration);

        await addTrackRecords(track);
      });

    res.status(200).send({ success: "File uploaded successfully!" });
  } catch (error) {
    console.error("Error downloading file with given URL:", error);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

export default router;