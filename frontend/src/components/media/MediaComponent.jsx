import React, { useState } from "react";
const MediaComponent = ({ mediaUrl }) => {
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [play, setPlay] = useState(false);

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
      const filename =
        mediaUrl.substring(mediaUrl.lastIndexOf("/") + 1) || "download";
      link.setAttribute("download", filename);

      document.body.appendChild(link);
      link.click();
    } catch (error) {
      console.error("Error downloading media:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const mediaType = (() => {
    const extension = mediaUrl.split(".").pop().toLowerCase();
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
          style={{ maxWidth: "100%", height: "auto" }}
        />
      )}
      {mediaType === "text" && (
        <div>
          {mediaUrl.substring(mediaUrl.lastIndexOf("/") + 1)}
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
