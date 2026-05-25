import React, { useMemo, useState } from "react";
import axios from "axios";
import { resolveMediaSource } from "../../utils/media";

const MediaComponent = ({ media }) => {
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [play, setPlay] = useState(false);
  const { url: mediaUrl, originalName } = useMemo(
    () => resolveMediaSource(media),
    [media]
  );

  const derivedFilename = useMemo(() => {
    if (originalName) {
      return originalName;
    }

    try {
      const parsed = new URL(mediaUrl);
      const fromQuery = parsed.searchParams.get("filename");
      if (fromQuery) {
        return fromQuery;
      }
      const pathname = parsed.pathname.split("/").filter(Boolean);
      return pathname[pathname.length - 1] || "download";
    } catch {
      return mediaUrl.substring(mediaUrl.lastIndexOf("/") + 1) || "download";
    }
  }, [mediaUrl, originalName]);

  const handleDownload = async () => {
    try {
      setLoading(true);
      const result = await axios.get(mediaUrl, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([result.data]));
      const link = document.createElement("a");
      link.href = url;

      // Extract the filename from the URL or use a generic name if not present
      link.setAttribute("download", derivedFilename);

      document.body.appendChild(link);
      link.click();
    } catch (error) {
      console.error("Error downloading media:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const mediaType = (() => {
    const extension = derivedFilename.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif"].includes(extension)) {
      return "image";
    } else if (["txt", "pdf", "doc"].includes(extension)) {
      return "text";
    } else if (["mp4", "webm", "ogg", "mkv"].includes(extension)) {
      return "video";
    } else if (["mp3", "wav", "ogg"].includes(extension)) {
      return "audio";
    } else {
      return "unknown";
    }
  })();

  return (
    <div
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {mediaType === "image" && (
        <img
          src={mediaUrl}
          alt="Media"
          loading="lazy"
          style={{ maxWidth: "100%", height: "auto" }}
        />
      )}
      {mediaType === "text" && (
        <div>
          {derivedFilename}
          {hovered && (
            <button
              onClick={handleDownload}
              style={{
                position: "absolute",
                top: "5px",
                right: "5px",
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                border: "none",
                cursor: "pointer",
              }}
              disabled={loading}
            >
              Download
            </button>
          )}
        </div>
      )}
      {mediaType === "video" && (
        <div>
          <video src={mediaUrl} controls={play} height={300} width={400} />
          {!play && (
            <button
              onClick={() => setPlay(true)}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                border: "none",
                cursor: "pointer",
              }}
              disabled={loading}
            >
              Play
            </button>
          )}
        </div>
      )}
      {mediaType === "audio" && (
        <div>
          <audio src={mediaUrl} controls />
          {hovered && (
            <button
              onClick={handleDownload}
              style={{
                position: "absolute",
                top: "5px",
                right: "5px",
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                border: "none",
                cursor: "pointer",
              }}
              disabled={loading}
            >
              Download
            </button>
          )}
        </div>
      )}
      {hovered && mediaType !== "video" && mediaType !== "audio" && (
        <button
          onClick={handleDownload}
          style={{
            position: "absolute",
            top: "5px",
            right: "5px",
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            border: "none",
            cursor: "pointer",
          }}
          disabled={loading}
        >
          Download
        </button>
      )}
    </div>
  );
};

export default MediaComponent;
