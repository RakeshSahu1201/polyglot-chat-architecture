import React from "react";
import "./InfoBar.css";

const InfoBar = ({ room }) => {
  const name = Array.isArray(room) ? room[0] : room;
  const initial = name ? name[0].toUpperCase() : "?";

  return (
    <div className="infoBar">
      <div className="leftInnerContainer" data-initial={initial}>
        <h3>{name || "Select a user"}</h3>
      </div>
      <div className="rightInnerContainer">
        <a href="/" title="Leave chat">✕</a>
      </div>
    </div>
  );
};

export default InfoBar;
