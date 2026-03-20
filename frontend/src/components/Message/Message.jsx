import ReactEmoji from "react-emoji";

import "./Message.css";
import { useLocation } from "react-router-dom";
import MediaComponent from "../media/MediaComponent";

const Message = ({ message }) => {
  const location = useLocation();
  const logged_user = location.state?.user;

  // DM messages use `from`; channel messages (from ent) use `user_id`
  const senderId = message.from || message.user_id;
  const isSentByCurrentUser = logged_user && logged_user._id === senderId;

  // Channel messages carry a human-readable sender name
  const senderName = message.user_name || null;

  return isSentByCurrentUser ? (
    <div className="messageContainer justifyEnd">
      <div className="messageBox backgroundBlue">
        <div className="messageText colorWhite">
          {message.media_url ? (
            <MediaComponent mediaUrl={message.media_url} />
          ) : (
            ReactEmoji.emojify(message.body || "")
          )}
        </div>
      </div>
    </div>
  ) : (
    <div className="messageContainer justifyStart">
      {senderName && (
        <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "2px", paddingLeft: "4px" }}>
          {senderName}
        </div>
      )}
      <div className="messageBox backgroundLight">
        <div className="messageText colorDark">
          {message.media_url ? (
            <MediaComponent mediaUrl={message.media_url} />
          ) : (
            ReactEmoji.emojify(message.body || "")
          )}
        </div>
      </div>
    </div>
  );
};

export default Message;
