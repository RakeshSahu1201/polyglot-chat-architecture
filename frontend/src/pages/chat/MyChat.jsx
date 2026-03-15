import "./MyChat.css";
import InfoBar from "../../components/InfoBar/InfoBar";
import Input from "../../components/Input/Input";
import Messages from "../../components/Messages/Messages";
import UserContainer from "../../components/UserContainer/UserContainer";
import ScrollToBottom from "react-scroll-to-bottom";
import { useLocation, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { useState, useEffect, useRef } from "react";
import axios from "axios";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;
const CHANNEL_URL = import.meta.env.VITE_CHANNEL_URL || 'http://localhost:8081';
const WS_URL = CHANNEL_URL.replace(/^http/, 'ws');

// Single Socket.IO instance for DMs
const socket = io(SERVER_URL);

const MyChat = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const logged_user = location.state?.user;
  const token = location.state?.token;

  const [users, setUsers] = useState([]);
  const [channels, setChannels] = useState([]); // List of joined channels
  const [to, setTo] = useState(""); // active DM user id
  const [activeChannel, setActiveChannel] = useState(null); // active channel object
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState([]);

  // Ref to hold the active WebSocket for the current channel
  const wsRef = useRef(null);

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
      socket.emit("login_me", { logged_user });
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
      if (wsRef.current) wsRef.current.close();
      get_conversation({ from: logged_user._id, to });
    }
  }, [to, logged_user]);

  // Fetch channel history and connect WebSocket when switching to a Channel
  useEffect(() => {
    if (activeChannel && logged_user) {
      setTo(""); // Clear DM selection

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

  // Read initial list of user's channels on mount
  useEffect(() => {
    if (!token) return;
    axios.get(`${CHANNEL_URL}/channels`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => setChannels(res.data.channels || []))
      .catch(err => console.error("fetch channels error:", err));
  }, [token]);

  // Wire up socket listeners ONCE — cleanup on unmount
  useEffect(() => {
    const handleUsers = ({ connected_users }) => {
      const others = connected_users.filter((u) => u._id !== logged_user?._id);
      setUsers(others);
    };

    const handleNewMessage = ({ new_message }) => {
      // Only append DM if we are actively looking at DMs (not in a channel)
      if (!activeChannel) {
        setConversation((prev) => [...prev, new_message]);
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
  }, [activeChannel]); // re-bind safely if focus changes

  // ─── REST API ────────────────────────────────────────────────────────────

  const get_conversation = async ({ from, to }) => {
    try {
      const result = await axios.post(
        `${SERVER_URL}/conversation/from-to`,
        { from, to },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (result.data.error) {
        alert(result.data.error);
        return;
      }
      setConversation(result.data);
    } catch (error) {
      console.error("get_conversation error:", error.message);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const media = new FormData();
      media.append("from", logged_user._id);
      media.append("to", to);
      media.append("media", file);

      const result = await axios.post(`${SERVER_URL}/conversation/media`, media, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      if (result.data.error) {
        alert(result.data.error);
        return;
      }
      socket.emit("send_media", { media_message: result.data });
      alert("media sent");
    } catch (error) {
      console.error("handleFileUpload error:", error.message);
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
        }
        setMessage("");
      });
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

          <div style={{ marginTop: '20px', padding: '0 10px', color: '#94a3b8', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            Channels
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

        {/* Header */}
        <div className="chat-title">
          <InfoBar
            room={activeChannel ? activeChannel.name : users?.filter((user) => user._id === to).map((user) => user.name)}
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
      </div>
    </div>
  );
};

export default MyChat;
