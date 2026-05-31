import React, { useState, useEffect } from "react";
import axios from "axios";
import "./ChannelSettings.css";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || '/api';

const ChannelSettings = ({ channel, onClose, token, loggedUser }) => {
    const [members, setMembers] = useState([]);
    const [newName, setNewName] = useState(channel.name);
    const [channelData, setChannelData] = useState(channel);
    const [loading, setLoading] = useState(false);

    const isOwner = loggedUser._id === channelData.owner_id;

    useEffect(() => {
        fetchMembers();
        fetchChannelInfo();
    }, [channel.id]);

    const fetchChannelInfo = async () => {
        try {
            const res = await axios.get(`${API_URL}/channels/${channel.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setChannelData(res.data.channel);
            setNewName(res.data.channel.name);
        } catch (err) {
            console.error("fetch channel info error:", err);
        }
    };

    const fetchMembers = async () => {
        try {
            const res = await axios.get(`${API_URL}/channels/${channel.id}/members`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMembers(res.data.members || []);
        } catch (err) {
            console.error("fetch members error:", err);
        }
    };

    const handleRename = async () => {
        if (!newName.trim() || newName === channelData.name) return;
        setLoading(true);
        try {
            const res = await axios.put(`${API_URL}/channels/${channel.id}`,
                { name: newName },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setChannelData(res.data.channel);
            toast.success("Channel renamed successfully!");
        } catch (err) {
            toast.error(err.response?.data?.error || "Rename failed");
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (membershipId) => {
        try {
            await axios.post(`${API_URL}/channels/members/${membershipId}/approve`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchMembers();
            fetchChannelInfo();
        } catch (err) {
            toast.error(err.response?.data?.error || "Approve failed");
        }
    };

    const handleRemove = async (membershipId) => {
        if (!window.confirm("Are you sure you want to remove/reject this member?")) return;
        try {
            await axios.delete(`${API_URL}/channels/members/${membershipId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchMembers();
            fetchChannelInfo();
        } catch (err) {
            toast.error(err.response?.data?.error || "Removal failed");
        }
    };

    return (
        <div className="channel_settings_overlay" onClick={onClose}>
            <div className="channel_settings_panel" onClick={(e) => e.stopPropagation()}>
                <div className="settings_header">
                    <h2>Channel Settings</h2>
                    <button className="btn_close_settings" onClick={onClose}>&times;</button>
                </div>

                <div className="settings_content">
                    <section className="settings_section">
                        <h3>Channel Info</h3>
                        <div className="channel_info_card">
                            <label style={{ fontSize: '0.7rem', color: '#64748b' }}>NAME</label>
                            <div className="rename_box">
                                <input
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    disabled={!isOwner}
                                />
                                {isOwner && (
                                    <button className="btn_rename" onClick={handleRename} disabled={loading}>
                                        {loading ? "..." : "Save"}
                                    </button>
                                )}
                            </div>
                            <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#e2e8f0' }}>
                                Type: {channelData.type === 'open' ? '🌐 Open' : '🔒 Private'}
                            </div>
                            <div className="invite_code_row">
                                <span>Invite Code:</span>
                                <span className="invite_code_val">{channelData.invite_code}</span>
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>
                                {channelData.member_count} Members
                            </div>
                        </div>
                    </section>

                    <section className="settings_section">
                        <h3>Members</h3>
                        <div className="member_list">
                            {members.map(member => (
                                <div key={member.membership_id} className="member_item">
                                    <div className="member_avatar">{member.user_name?.[0]?.toUpperCase()}</div>
                                    <div className="member_name">
                                        {member.user_name}
                                        {member.user_id === channelData.owner_id && (
                                            <span style={{ fontSize: '0.65rem', color: '#6366f1', marginLeft: '6px', fontWeight: 'bold' }}>OWNER</span>
                                        )}
                                    </div>
                                    <span className={`member_status status_${member.status[0]}`}>
                                        {member.status}
                                    </span>
                                    {isOwner && member.user_id !== loggedUser._id && (
                                        <div className="member_actions">
                                            {member.status === 'pending' && (
                                                <button className="btn_action btn_approve" onClick={() => handleApprove(member.membership_id)} title="Approve">
                                                    ✔️
                                                </button>
                                            )}
                                            <button className="btn_action btn_reject" onClick={() => handleRemove(member.membership_id)} title="Remove">
                                                ❌
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default ChannelSettings;
