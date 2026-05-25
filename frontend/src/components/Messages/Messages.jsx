import Message from "../Message/Message";

import "./Messages.css";

const Messages = ({ messages }) => (
  <div className="messages">
    {messages.map((message, index) => (
      <div key={message._id || message.id || index}>
        <Message message={message} />
      </div>
    ))}
  </div>
);

export default Messages;
