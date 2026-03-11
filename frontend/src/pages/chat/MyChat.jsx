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

// Single socket instance for the lifetime of the app
const socket = io(SERVER_URL);

const MyChat = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const logged_user = location.state?.user;
  const token = location.state?.token;

  const [users, setUsers] = useState([]);
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState([]);

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

  // Register on the server
  useEffect(() => {
    if (!logged_user) return;
    socket.emit("login_me", { logged_user });
  }, [logged_user]);

  // Fetch conversation history when switching chat partner
  useEffect(() => {
    if (to && logged_user) {
      get_conversation({ from: logged_user._id, to });
    }
  }, [to, logged_user]);

  // Wire up socket listeners ONCE — cleanup on unmount
  useEffect(() => {
    const handleUsers = ({ connected_users }) => {
      const others = connected_users.filter((u) => u._id !== logged_user?._id);
      setUsers(others);
    };

    const handleNewMessage = ({ new_message }) => {
      setConversation((prev) => [...prev, new_message]);
    };

    socket.on("get_connected_users", handleUsers);
    socket.on("message_sent", handleNewMessage);

    return () => {
      socket.off("get_connected_users", handleUsers);
      socket.off("message_sent", handleNewMessage);
    };
  }, []); // empty deps — register once

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
    if (!to || !message.trim()) return;
    const send_message = { from: logged_user._id, to, body: message };
    socket.emit("send_message", { message: send_message }, ({ data, error }) => {
      if (error) {
        console.error("send_message error:", error);
        alert(error);
      }
      setMessage("");
    });
  };

  if (!logged_user) return null; // redirect is in progress

  return (
    <div className="outer">
      <div className="chat-container">
        {/* Sidebar — search-container maps to the sidebar grid area */}
        <div className="search-container">
          <h2>ChatGram</h2>
          <span>{logged_user.name}</span>
          <UserContainer users={users} setTo={setTo} />
        </div>

        {/* Header */}
        <div className="chat-title">
          <InfoBar
            room={users
              ?.filter((user) => user._id === to)
              .map((user) => user.name)}
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
