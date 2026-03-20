import React, { useState } from "react";
import "./ChannelModal.css";

/**
 * ChannelModal — reusable dialog for Create or Join channel.
 *
 * Props:
 *   mode        "create" | "join"
 *   onSubmit    async fn(payload) => void
 *   onClose     fn() => void
 */
const ChannelModal = ({ mode, onSubmit, onClose }) => {
    const isCreate = mode === "create";

    const [name, setName] = useState("");
    const [type, setType] = useState("open");
    const [inviteCode, setInviteCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [createdCode, setCreatedCode] = useState(""); // shown after creation

    const handleSubmit = async () => {
        setLoading(true);
        try {
            const result = await onSubmit(
                isCreate ? { name, type } : { invite_code: inviteCode }
            );
            // If join succeeded for a private channel, show pending message
            if (!isCreate && result?.status === "pending") {
                setCreatedCode("PENDING_APPROVAL"); // Use this to toggle specialized view
            } else if (isCreate && result?.invite_code) {
                setCreatedCode(result.invite_code);
            } else {
                onClose();
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="channel_modal_overlay" onClick={onClose}>
            <div className="channel_modal_card" onClick={(e) => e.stopPropagation()}>
                <h2>{isCreate ? "Create a Channel" : "Join a Channel"}</h2>
                <p>
                    {isCreate
                        ? "Set up a new channel and share the invite code with others."
                        : "Enter an invite code to join an existing channel."}
                </p>

                {/* After creation — show the invite code */}
                {createdCode ? (
                    <>
                        <label>
                            {createdCode === "PENDING_APPROVAL"
                                ? "⏳ Join request sent!"
                                : "🎉 Channel created! Share this invite code:"}
                        </label>
                        {createdCode === "PENDING_APPROVAL" ? (
                            <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: '15px 0' }}>
                                This is a private channel. The owner has been notified and needs to approve your request before you can chat.
                            </p>
                        ) : (
                            <div
                                className="invite_code_box"
                                title="Click to copy"
                                onClick={() => navigator.clipboard.writeText(createdCode)}
                            >
                                {createdCode}
                            </div>
                        )}
                        <div className="modal_actions">
                            <button className="modal_btn_submit" onClick={onClose}>
                                Done
                            </button>
                        </div>
                    </>
                ) : isCreate ? (
                    <>
                        <label>Channel Name</label>
                        <input
                            placeholder="e.g. general"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                            autoFocus
                        />
                        <label>Type</label>
                        <select value={type} onChange={(e) => setType(e.target.value)}>
                            <option value="open">🌐 Open — anyone with the invite code can join</option>
                            <option value="private">🔒 Private — only you can add members</option>
                        </select>
                        <div className="modal_actions">
                            <button className="modal_btn_cancel" onClick={onClose}>
                                Cancel
                            </button>
                            <button
                                className="modal_btn_submit"
                                onClick={handleSubmit}
                                disabled={loading || !name.trim()}
                            >
                                {loading ? "Creating…" : "Create"}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <label>Invite Code</label>
                        <input
                            placeholder="Paste invite code here"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                            autoFocus
                        />
                        <div className="modal_actions">
                            <button className="modal_btn_cancel" onClick={onClose}>
                                Cancel
                            </button>
                            <button
                                className="modal_btn_submit"
                                onClick={handleSubmit}
                                disabled={loading || !inviteCode.trim()}
                            >
                                {loading ? "Joining…" : "Join"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ChannelModal;
