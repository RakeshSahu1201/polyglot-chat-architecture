import React from "react";
import "./Input.css";

const Input = ({ message, setMessage, sendMessage, handleFileUpload }) => (
  <div className="form">
    {/* Styled file upload — hidden input, visible label */}
    <label className="file-label" title="Attach file">
      📎
      <input type="file" className="file" onChange={handleFileUpload} />
    </label>

    <input
      className="input"
      type="text"
      placeholder="Type a message..."
      value={message}
      onChange={(e) => setMessage(e.target.value)}
      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
    />

    <button className="sendButton" onClick={sendMessage}>
      Send ➤
    </button>
  </div>
);

export default Input;
