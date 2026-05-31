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

  // State for the full-screen modal
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div
        style={{ position: "relative", display: "inline-block", cursor: (mediaType === "image" || mediaType === "video") ? "pointer" : "default" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          if (mediaType === "image" || mediaType === "video") setShowModal(true);
        }}
      >
        {mediaType === "image" && (
          <img
            src={mediaUrl}
            alt="Media preview"
            loading="lazy"
            style={{ maxWidth: "100%", maxHeight: "150px", borderRadius: "8px", objectFit: "cover" }}
          />
        )}
        {mediaType === "text" && (
          <div style={{ padding: "10px", background: "rgba(0,0,0,0.1)", borderRadius: "8px" }}>
            📄 {derivedFilename}
            {hovered && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                style={{
                  position: "absolute",
                  top: "5px",
                  right: "5px",
                  backgroundColor: "rgba(255, 255, 255, 0.8)",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "4px",
                  padding: "2px 6px"
                }}
                disabled={loading}
              >
                Download
              </button>
            )}
          </div>
        )}
        {mediaType === "video" && (
          <div style={{ position: "relative" }}>
            <video src={mediaUrl} style={{ maxHeight: "150px", maxWidth: "100%", borderRadius: "8px", objectFit: "cover" }} />
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              color: "white",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none"
            }}>
              ▶
            </div>
          </div>
        )}
        {mediaType === "audio" && (
          <div onClick={(e) => e.stopPropagation()}>
            <audio src={mediaUrl} controls style={{ maxWidth: "200px" }} />
            {hovered && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                style={{
                  position: "absolute",
                  top: "-10px",
                  right: "-10px",
                  backgroundColor: "rgba(255, 255, 255, 0.9)",
                  border: "1px solid #ccc",
                  cursor: "pointer",
                  borderRadius: "50%",
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
                disabled={loading}
              >
                ↓
              </button>
            )}
          </div>
        )}
        {hovered && mediaType !== "video" && mediaType !== "audio" && mediaType !== "text" && (
          <button
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            style={{
              position: "absolute",
              top: "5px",
              right: "5px",
              backgroundColor: "rgba(255, 255, 255, 0.8)",
              border: "none",
              cursor: "pointer",
              borderRadius: "4px",
              padding: "2px 6px"
            }}
            disabled={loading}
          >
            Download
          </button>
        )}
      </div>

      {/* Full-screen Modal for Image and Video */}
      {showModal && (mediaType === "image" || mediaType === "video") && (
        <div 
          onClick={() => setShowModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
        >
          <button 
            onClick={(e) => { e.stopPropagation(); setShowModal(false); }}
            style={{
              position: "absolute",
              top: "20px",
              right: "30px",
              background: "none",
              border: "none",
              color: "white",
              fontSize: "30px",
              cursor: "pointer"
            }}
          >
            ×
          </button>
          
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: "90%", maxHeight: "80%" }}>
            {mediaType === "image" && (
              <img src={mediaUrl} alt="Expanded Media" style={{ maxWidth: "100%", maxHeight: "80vh", objectFit: "contain", borderRadius: "8px" }} />
            )}
            {mediaType === "video" && (
              <video src={mediaUrl} controls autoPlay style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: "8px" }} />
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
            style={{
              marginTop: "20px",
              padding: "10px 20px",
              backgroundColor: "#4f46e5",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
            disabled={loading}
          >
            {loading ? "Downloading..." : "Download Original"}
          </button>
        </div>
      )}
    </>
  );
};

export default MediaComponent;
