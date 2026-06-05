const defaultGatewayBase = (
  import.meta.env.VITE_IPFS_GATEWAY_URL || `${window.location.origin}/ipfs`
).replace(/\/$/, "");

const trimIpfsPrefix = (value = "") => value.replace(/^ipfs:\/\//, "");

export const buildIpfsGatewayUrl = (cid, originalName = "") => {
  if (!cid) {
    return "";
  }

  const suffix = originalName
    ? `?filename=${encodeURIComponent(originalName)}`
    : "";
  return `${defaultGatewayBase}/${trimIpfsPrefix(cid)}${suffix}`;
};

export const resolveMediaSource = (media = {}) => {
  const cid = media.cid || media.media_cid || "";
  const originalName = media.original_name || media.originalName || "";
  let thumbnailUrl = media.thumbnail_url || media.thumbnailUrl || "";
  
  // Rewrite hardcoded local gateway URLs from legacy records
  if (thumbnailUrl && thumbnailUrl.includes("localhost/ipfs")) {
    thumbnailUrl = thumbnailUrl.replace(/https?:\/\/[^\/]+\/ipfs/i, defaultGatewayBase);
  }

  if (cid) {
    return {
      cid,
      url: buildIpfsGatewayUrl(cid, originalName),
      thumbnailUrl,
      originalName,
    };
  }

  if (media.gateway_url || media.gatewayUrl) {
    return {
      cid: "",
      url: media.gateway_url || media.gatewayUrl,
      thumbnailUrl,
      originalName,
    };
  }

  if (typeof media.media_url === "string" && media.media_url.startsWith("ipfs://")) {
    return {
      cid: trimIpfsPrefix(media.media_url),
      url: buildIpfsGatewayUrl(trimIpfsPrefix(media.media_url), originalName),
      thumbnailUrl,
      originalName,
    };
  }

  return {
    cid: "",
    url: media.media_url || "",
    thumbnailUrl,
    originalName,
  };
};

export const hasRenderableMedia = (message = {}) =>
  Boolean(
    message.cid ||
      message.media_cid ||
      message.gateway_url ||
      message.gatewayUrl ||
      message.media_url
  );

