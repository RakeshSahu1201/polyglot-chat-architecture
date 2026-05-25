import "./MyChat.css";
import InfoBar from "../../components/InfoBar/InfoBar";
import Input from "../../components/Input/Input";
import Messages from "../../components/Messages/Messages";
import UserContainer from "../../components/UserContainer/UserContainer";
import ChannelModal from "../../components/ChannelModal/ChannelModal";
import ChannelSettings from "../../components/ChannelSettings/ChannelSettings";
import ScrollToBottom from "react-scroll-to-bottom";
import { useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { resolveMediaSource } from "../../utils/media";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;
const CHANNEL_URL = import.meta.env.VITE_CHANNEL_URL || 'http://localhost/api/channels';
const WS_URL = (CHANNEL_URL || window.location.origin + '/api/channels').replace(/^http/, 'ws');
const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost/api/auth';

// Socket.IO connects to the page origin — nginx routes /socket.io/ to the Node.js chat service.
// Do NOT use SERVER_URL as the io() target (that's the REST base path, not the socket origin).
const socket = io(window.location.origin, {
  transports: ['websocket', 'polling'],
});

const appendUniqueMessage = (messages, nextMessage) => {
  const nextId = nextMessage?._id || nextMessage?.id;
  if (!nextId) {
    return [...messages, nextMessage];
  }

  if (messages.some((message) => (message._id || message.id) === nextId)) {
    return messages;
  }

  return [...messages, nextMessage];
};

const MyChat = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const logged_user = location.state?.user;
  const token = location.state?.token;

  const [allUsers, setAllUsers] = useState([]); // All registered users from Go REST
  const [onlineUserIds, setOnlineUserIds] = useState(new Set()); // IDs of currently connected users
  const [users, setUsers] = useState([]); // Computed array with .isOnline state
  const [channels, setChannels] = useState([]); // List of joined channels
  const [to, setTo] = useState(""); // active DM user id
  const [activeChannel, setActiveChannel] = useState(null); // active channel object
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState([]);

  // Channel modal state
  const [channelModal, setChannelModal] = useState(null); // null | 'create' | 'join'
  const [showChannelSettings, setShowChannelSettings] = useState(false);

  // Ref to hold the active WebSocket for the current channel
  const wsRef = useRef(null);
  const lastUsersRefreshRef = useRef(0);
  // Keep a ref to `to` so the socket message handler always sees the latest value
  // without needing to re-bind the listener on every DM switch.
  const toRef = useRef(to);
  useEffect(() => { toRef.current = to; }, [to]);

  // Use a ref so event listeners always have a fresh reference to conversation
  // without needing to re-subscribe every time it changes
  const conversationRef = useRef(conversation);
  useEffect(() => {
    conversationRef.current = conversation;
  }, [conversation]);

  // Guard: redirect to login if there's no user in state
  useEffect(() => {
    if (!logged_user) {
      navigate("/");
    }
  }, [logged_user, navigate]);

  // Register on the server (handling reconnects)
  useEffect(() => {
    if (!logged_user) return;

    const registerPresence = () => {
      socket.emit("login_me", {
        user: {
          id: logged_user._id || logged_user.id,
          name: logged_user.name,
        },
      });
    };

    // If already connected, emit immediately
    if (socket.connected) {
      registerPresence();
    }

    // Also emit every time the socket reconnects (e.g. after tab wakes up from sleep)
    socket.on("connect", registerPresence);

    return () => {
      socket.off("connect", registerPresence);
    };
  }, [logged_user]);

  // Fetch conversation history when switching chat partner (DM)
  useEffect(() => {
    if (to && logged_user) {
      setActiveChannel(null); // Clear active channel if switching to DM
      setConversation([]);    // Immediately clear stale history
      if (wsRef.current) wsRef.current.close();
      get_conversation({ from: logged_user._id, to });
    }
  }, [to, logged_user]);

  // Fetch channel history and connect WebSocket when switching to a Channel
  useEffect(() => {
    if (activeChannel && logged_user) {
      setTo("");             // Clear DM selection
      setConversation([]);  // Immediately wipe stale history before async fetch

      // 1. Fetch history from Go REST API
      const fetchChannelHistory = async () => {
        try {
          const res = await axios.get(`${CHANNEL_URL}/channels/${activeChannel.id}/messages`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          setConversation(res.data.messages || []);
        } catch (err) {
          console.error("fetch channel history error:", err);
        }
      };
      fetchChannelHistory();

      // 2. Connect raw WebSocket to Go channel-service
      if (wsRef.current) wsRef.current.close();
      const ws = new WebSocket(`${WS_URL}/ws/channels/${activeChannel.id}?token=${token}`);

      ws.onopen = () => console.log("WS connected to channel", activeChannel.id);
      ws.onerror = (e) => console.error("WS error:", e);

      ws.onmessage = (event) => {
        try {
          const envelope = JSON.parse(event.data);
          if (envelope.type === "message") {
            setConversation((prev) => [...prev, envelope.payload]);
          }
        } catch (err) {
          console.error("ws parse error:", err);
        }
      };

      wsRef.current = ws;

      return () => {
        ws.close();
      };
    }
  }, [activeChannel, logged_user, token]);

  const fetchAllUsers = async () => {
    if (!token) return;

    try {
      const res = await axios.get(`${AUTH_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllUsers(res.data.data || []);
    } catch (err) {
      console.error("fetch all users error:", err.response?.data?.error || err.message);
    }
  };

  // Read channels + users on mount
  useEffect(() => {
    if (!token) return;

    axios.get(`${CHANNEL_URL}/channels`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => setChannels(res.data.channels || []))
      .catch(err => console.error("fetch channels error:", err.response?.data?.error || err.message));

    fetchAllUsers();

    // Periodically refresh the user list so newly registered users appear
    // without waiting for a socket presence event.
    const userPollInterval = setInterval(fetchAllUsers, 30_000);
    return () => clearInterval(userPollInterval);
  }, [token]);

  // Compute the final users array by merging allUsers with onlineUserIds
  useEffect(() => {
    const computed = allUsers.map(user => ({
      ...user,
      isOnline: onlineUserIds.has(user._id)
    }));
    // Sort online users to the top
    computed.sort((a, b) => (b.isOnline === a.isOnline) ? 0 : b.isOnline ? 1 : -1);
    setUsers(computed);
  }, [allUsers, onlineUserIds]);

  // Wire up socket listeners ONCE — cleanup on unmount
  useEffect(() => {
    const handleUsers = ({ connected_users }) => {
      // Store just the IDs of who is online
      const ids = new Set(connected_users.map(u => u._id || u.id));
      setOnlineUserIds(ids);

      const now = Date.now();
      if (now - lastUsersRefreshRef.current > 5000) {
        lastUsersRefreshRef.current = now;
        fetchAllUsers();
      }
    };

    const handleNewMessage = ({ new_message }) => {
      // Use ref so we always have the latest selected DM user ID
      // without re-binding this listener on every switch.
      const selectedDmUserId = toRef.current;
      const isRelevantDm =
        selectedDmUserId &&
        ((new_message.from === logged_user?._id && new_message.to === selectedDmUserId) ||
          (new_message.from === selectedDmUserId && new_message.to === logged_user?._id));

      if (!activeChannel && isRelevantDm) {
        setConversation((prev) => appendUniqueMessage(prev, new_message));
      }
    };

    // Also listen for channel events broadcast by Node.js via Redis
    // We only care if the broadcast is for a channel we are NOT currently viewing via WebSocket
    // Actually, WebSockets handle active channel live updates. Redis is useful for sidebar badges (future).
    const handleChannelMessage = ({ channelId, message }) => {
      // If we are looking at this channel right now, the pure WebSocket already appended it
      // So we do nothing here to avoid duplicates.
    };

    socket.on("get_connected_users", handleUsers);
    socket.on("message_sent", handleNewMessage);
    socket.on("channel_message", handleChannelMessage);

    return () => {
      socket.off("get_connected_users", handleUsers);
      socket.off("message_sent", handleNewMessage);
      socket.off("channel_message", handleChannelMessage);
    };
  }, [activeChannel, to, logged_user, token]); // re-bind safely if focus changes

  // ─── REST API ────────────────────────────────────────────────────────────

  const get_conversation = async ({ from, to }) => {
    try {
      const result = await axios.get(
        `${SERVER_URL}/chat/messages/direct`,
        {
          params: { userId: to },
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setConversation(result.data?.data || []);
    } catch (error) {
      console.error(
        "get_conversation error:",
        error.response?.data?.error || error.message
      );
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const media = new FormData();
      media.append("media", file);
      media.append("kind", activeChannel ? "channel-message" : "message");

      if (activeChannel) {
        const result = await axios.post(
          `${CHANNEL_URL}/channels/${activeChannel.id}/media`,
          media,
          {
            headers: {
              "Content-Type": "multipart/form-data",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const normalizedMedia = resolveMediaSource(result.data);
          wsRef.current.send(
            JSON.stringify({
              body: "",
              cid: result.data.cid || "",
              media_url: normalizedMedia.url,
            })
          );
        } else {
          alert("WebSocket not connected");
        }
      } else {
        media.append("from", logged_user._id);
        media.append("to", to);

        const result = await axios.post(`${SERVER_URL}/media/upload`, media, {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        });

        socket.emit(
          "send_message",
          {
            message: {
              from: logged_user._id,
              to,
              body: "",
              cid: result.data.cid || "",
              media_url: resolveMediaSource(result.data).url,
            },
          },
          ({ error }) => {
            if (error) {
              console.error("send_message error:", error);
              alert(error);
            }
          }
        );
      }
    } catch (error) {
      console.error(
        "handleFileUpload error:",
        error.response?.data?.error || error.message
      );
    }
  };

  // ─── Socket emit ────────────────────────────────────────────────────────

  const handleSendMessageClick = () => {
    if (!message.trim()) return;

    if (activeChannel) {
      // Send via Go WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ body: message }));
        setMessage("");
      } else {
        alert("WebSocket not connected");
      }
    } else if (to) {
      // Send via Node.js Socket.IO
      const send_message = { from: logged_user._id, to, body: message };
      socket.emit("send_message", { message: send_message }, ({ data, error }) => {
        if (error) {
          console.error("send_message error:", error);
          alert(error);
          return;
        }
        if (data) {
          setConversation((prev) => appendUniqueMessage(prev, data));
        }
        setMessage("");
      });
    }
  };

  // ─── Channel create / join ────────────────────────────────────────────
  const handleChannelModalSubmit = async (payload) => {
    try {
      if (channelModal === 'create') {
        const res = await axios.post(
          `${CHANNEL_URL}/channels`,
          { name: payload.name, type: payload.type },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const newCh = res.data.channel;
        setChannels(prev => [...prev, newCh]);
        return newCh; // ChannelModal will display the invite_code
      } else {
        const res = await axios.post(
          `${CHANNEL_URL}/channels/join`,
          { invite_code: payload.invite_code },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const joinedCh = res.data.channel;
        const status = res.data.status;
        setChannels(prev =>
          prev.find(c => c.id === joinedCh.id) ? prev : [...prev, joinedCh]
        );
        return { channel: joinedCh, status };
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      alert(msg);
    }
  };

  if (!logged_user) return null; // redirect is in progress

  return (
    <div className="outer">
      <div className="chat-container">
        {/* Sidebar — search-container maps to the sidebar grid area */}
        <div className="search-container">
          <h2>ChatGram</h2>
          <span>{logged_user.name}</span>

          {/* Channels section header with action buttons */}
          <div style={{ marginTop: '20px', padding: '0 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Channels</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setChannelModal('create')}
                title="Create a channel"
                style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '2px 5px', borderRadius: '4px' }}
              >+</button>
              <button
                onClick={() => setChannelModal('join')}
                title="Join a channel"
                style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '12px', lineHeight: 1, padding: '2px 5px', borderRadius: '4px' }}>↗</button>
            </div>
          </div>
          <div className="channel-list" style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {channels.map(ch => (
              <div
                key={ch.id}
                onClick={() => setActiveChannel(ch)}
                style={{
                  cursor: 'pointer',
                  padding: '8px',
                  borderRadius: '6px',
                  background: activeChannel?.id === ch.id ? 'rgba(79, 70, 229, 0.2)' : 'transparent',
                  color: activeChannel?.id === ch.id ? '#818cf8' : '#e2e8f0',
                  fontWeight: activeChannel?.id === ch.id ? '600' : '400'
                }}>
                # {ch.name}
              </div>
            ))}
            {channels.length === 0 && <div style={{ color: '#64748b', fontSize: '12px' }}>No channels joined</div>}
          </div>

          <div style={{ marginTop: '10px', padding: '0 10px', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            Direct Messages
          </div>
          <UserContainer users={users} setTo={setTo} activeTo={to} />
        </div>

        {/* If neither a channel nor a DM is selected, show a placeholder */}
        {!activeChannel && !to ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <h3 style={{ margin: '0 0 10px 0', color: '#cbd5e1' }}>Select a chat</h3>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>Choose a channel or user to start messaging.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="chat-title">
              <InfoBar
                room={activeChannel ? activeChannel.name : users?.filter((user) => user._id === to).map((user) => user.name)}
                canSettings={!!activeChannel}
                onSettings={() => setShowChannelSettings(true)}
              />
            </div>

            {/* Message list */}
            <ScrollToBottom className="chat-message-list">
              <Messages messages={conversation} />
            </ScrollToBottom>

            {/* Input bar */}
            <div className="chat-form">
              <Input
                message={message}
                setMessage={setMessage}
                sendMessage={handleSendMessageClick}
                handleFileUpload={handleFileUpload}
              />
            </div>
          </>
        )}
      </div>

      {/* Channel modals */}
      {channelModal && (
        <ChannelModal
          mode={channelModal}
          onSubmit={handleChannelModalSubmit}
          onClose={() => setChannelModal(null)}
        />
      )}

      {showChannelSettings && activeChannel && (
        <ChannelSettings
          channel={activeChannel}
          token={token}
          loggedUser={logged_user}
          onClose={() => setShowChannelSettings(false)}
        />
      )}
    </div>
  );
};

export default MyChat;
