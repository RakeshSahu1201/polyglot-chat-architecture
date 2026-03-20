import React from "react";
import "./InfoBar.css";

const InfoBar = ({ room, canSettings, onSettings }) => {
  const name = Array.isArray(room) ? room[0] : room;
  const initial = name ? name[0].toUpperCase() : "?";

  return (
    <div className="infoBar">
      <div className="leftInnerContainer" data-initial={initial}>
        <h3>{name || "Select a user"}</h3>
      </div>
      <div className="rightInnerContainer">
        {canSettings && (
          <button
            onClick={onSettings}
            title="Channel Settings"
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', marginRight: '10px' }}
          >
            ⚙️
          </button>
        )}
        <a href="/" title="Leave chat">✕</a>
      </div>
    </div>
  );
};

export default InfoBar;
