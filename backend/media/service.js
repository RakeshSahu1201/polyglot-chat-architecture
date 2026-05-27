const { Blob } = require("node:buffer");
const { mediaAsset } = require("./model");

const DEFAULT_CHUNK_SIZE = Number(process.env.IPFS_CHUNK_SIZE_BYTES || 262144);
const DEFAULT_GATEWAY = (
  process.env.IPFS_GATEWAY_BASE_URL || "https://ipfs.io/ipfs"
).replace(/\/$/, "");

const getGatewayUrl = (cid, originalName = "") => {
  const suffix = originalName
    ? `?filename=${encodeURIComponent(originalName)}`
    : "";
  return `${DEFAULT_GATEWAY}/${cid}${suffix}`;
};

const chunkBuffer = (buffer, chunkSize = DEFAULT_CHUNK_SIZE) => {
  const chunks = [];
  for (let offset = 0; offset < buffer.length; offset += chunkSize) {
    chunks.push(buffer.subarray(offset, offset + chunkSize));
  }
  return chunks;
};

const uploadViaPinata = async (file) => {
  if (!process.env.PINATA_JWT) {
    throw new Error("PINATA_JWT is not configured");
  }

  const formData = new FormData();
  formData.append(
    "file",
    new Blob(chunkBuffer(file.buffer), {
      type: file.mimetype || "application/octet-stream",
    }),
    file.originalname
  );
  formData.append(
    "pinataMetadata",
    JSON.stringify({
      name: file.originalname,
      keyvalues: {
        mime_type: file.mimetype || "application/octet-stream",
        size_bytes: String(file.size),
      },
    })
  );

  const response = await fetch(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PINATA_JWT}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pinata upload failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  return payload.IpfsHash;
};

const uploadViaIpfsNode = async (file) => {
  if (!process.env.IPFS_API_URL) {
    throw new Error("IPFS_API_URL is not configured");
  }

  const formData = new FormData();
  formData.append(
    "file",
    new Blob(chunkBuffer(file.buffer), {
      type: file.mimetype || "application/octet-stream",
    }),
    file.originalname
  );

  const endpoint = `${process.env.IPFS_API_URL.replace(
    /\/$/,
    ""
  )}/api/v0/add?pin=true&cid-version=1`;

  const response = await fetch(endpoint, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`IPFS node upload failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  return payload.Hash;
};

const uploadToIpfs = async (file) => {
  if (process.env.PINATA_JWT) {
    return uploadViaPinata(file);
  }

  if (process.env.IPFS_API_URL) {
    return uploadViaIpfsNode(file);
  }

  throw new Error("No IPFS uploader configured. Set PINATA_JWT or IPFS_API_URL.");
};

const uploadMediaAsset = async ({ file, uploadedBy, kind, metadata }) => {
  if (!file?.buffer?.length) {
    throw new Error("A media file is required");
  }

  if (!uploadedBy) {
    throw new Error("uploadedBy is required");
  }

  const cid = await uploadToIpfs(file);
  const gatewayUrl = getGatewayUrl(cid, file.originalname);

  const asset = await mediaAsset.create({
    cid,
    kind: kind || "attachment",
    uploaded_by: uploadedBy,
    original_name: file.originalname,
    mime_type: file.mimetype || "application/octet-stream",
    size_bytes: file.size || file.buffer.length,
    gateway_url: gatewayUrl,
    metadata: metadata || {},
  });

  return {
    id: asset.id,
    cid: asset.cid,
    media_url: asset.gateway_url,
    gateway_url: asset.gateway_url,
    mime_type: asset.mime_type,
    original_name: asset.original_name,
    size_bytes: asset.size_bytes,
    kind: asset.kind,
    uploaded_by: asset.uploaded_by,
    created_at: asset.createdAt,
  };
};

module.exports = {
  chunkBuffer,
  getGatewayUrl,
  uploadMediaAsset,
};
