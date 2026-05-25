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

  if (cid) {
    return {
      cid,
      url: buildIpfsGatewayUrl(cid, originalName),
      originalName,
    };
  }

  if (media.gateway_url || media.gatewayUrl) {
    return {
      cid: "",
      url: media.gateway_url || media.gatewayUrl,
      originalName,
    };
  }

  if (typeof media.media_url === "string" && media.media_url.startsWith("ipfs://")) {
    return {
      cid: trimIpfsPrefix(media.media_url),
      url: buildIpfsGatewayUrl(trimIpfsPrefix(media.media_url), originalName),
      originalName,
    };
  }

  return {
    cid: "",
    url: media.media_url || "",
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

